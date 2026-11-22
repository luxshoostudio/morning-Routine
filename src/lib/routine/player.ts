import { Howl, Howler } from 'howler';

import type { ResolvedLayer } from './sounds';

/**
 * Mixes Moodist's own loop files with Howler, the same engine as the main
 * mixer. Playback stays off the persisted sound store, so a routine does not
 * replace someone's saved mix.
 */
export class RoutinePlayer {
  private active = new Map<string, number>();
  private howls = new Map<string, Howl>();
  private master = 0.7;
  private tokens = new Map<string, number>();

  setMaster(volume: number) {
    this.master = clamp01(volume);
    for (const [id, layerVolume] of this.active) {
      const howl = this.howls.get(id);
      if (!howl?.playing()) continue;
      howl.volume(layerVolume * this.master);
    }
  }

  preload(layers: ResolvedLayer[]) {
    for (const layer of layers) this.howlFor(layer);
  }

  async unlock() {
    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') await ctx.resume();
  }

  playMix(layers: ResolvedLayer[], fadeMs: number) {
    const next = new Set(layers.map(layer => layer.id));
    for (const id of this.active.keys()) {
      if (!next.has(id)) this.fadeOut(id, fadeMs);
    }
    for (const layer of layers) this.fadeIn(layer, fadeMs);
  }

  stop(fadeMs: number) {
    for (const id of [...this.active.keys()]) this.fadeOut(id, fadeMs);
  }

  dispose() {
    for (const howl of this.howls.values()) howl.unload();
    this.howls.clear();
    this.active.clear();
    this.tokens.clear();
  }

  private howlFor(layer: ResolvedLayer): Howl {
    const existing = this.howls.get(layer.id);
    if (existing) return existing;
    const howl = new Howl({
      loop: true,
      preload: true,
      src: [layer.src],
      volume: 0,
    });
    this.howls.set(layer.id, howl);
    return howl;
  }

  private fadeIn(layer: ResolvedLayer, fadeMs: number) {
    const howl = this.howlFor(layer);
    const target = clamp01(layer.volume * this.master);
    const token = (this.tokens.get(layer.id) ?? 0) + 1;
    this.tokens.set(layer.id, token);
    this.active.set(layer.id, layer.volume);

    if (!howl.playing()) {
      howl.volume(0);
      howl.play();
    }

    const from = howl.volume();
    if (fadeMs <= 0 || Math.abs(from - target) < 0.01) {
      howl.volume(target);
      return;
    }
    howl.fade(from, target, fadeMs);
  }

  private fadeOut(id: string, fadeMs: number) {
    const howl = this.howls.get(id);
    this.active.delete(id);
    if (!howl) return;

    const token = (this.tokens.get(id) ?? 0) + 1;
    this.tokens.set(id, token);

    if (!howl.playing()) {
      howl.volume(0);
      return;
    }

    const from = howl.volume();
    if (fadeMs <= 0 || from <= 0) {
      howl.pause();
      howl.volume(0);
      return;
    }

    howl.fade(from, 0, fadeMs);
    window.setTimeout(() => {
      if (this.tokens.get(id) !== token) return;
      howl.pause();
      howl.volume(0);
    }, fadeMs + 40);
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function setSession(title: string, playing: boolean) {
  try {
    if (!navigator.mediaSession) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      album: 'Morning Routine',
      artist: 'Moodist',
      title,
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  } catch {
    // Media Session is a progressive enhancement.
  }
}
