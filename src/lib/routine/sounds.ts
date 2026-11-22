import { sounds } from '@/data/sounds';

import { MIXES, type MixId, type MixLayer } from './plan';

export type ResolvedLayer = MixLayer & { src: string };

const srcById = new Map<string, string>();

for (const category of sounds.categories) {
  for (const sound of category.sounds) {
    srcById.set(sound.id, sound.src);
  }
}

export function resolveLayers(layers: MixLayer[]): ResolvedLayer[] {
  return layers.map(layer => {
    const src = srcById.get(layer.id);
    if (!src) {
      throw new Error(`Moodist sound not found: ${layer.id}`);
    }
    return { ...layer, src };
  });
}

export function layersFor(mix: MixId): ResolvedLayer[] {
  return resolveLayers(MIXES[mix]);
}

export function allRoutineLayers(): ResolvedLayer[] {
  const seen = new Map<string, ResolvedLayer>();
  for (const mix of Object.values(MIXES)) {
    for (const layer of resolveLayers(mix)) {
      if (!seen.has(layer.id)) seen.set(layer.id, layer);
    }
  }
  return [...seen.values()];
}
