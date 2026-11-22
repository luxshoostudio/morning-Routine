import type { RoutineMode } from './plan';

const MODE_KEY = 'moodist-routine-mode';
const VOLUME_KEY = 'moodist-routine-volume';

export function startsStorageKey(dateKey: string, weekday: boolean): string {
  return `moodist-routine-starts-${dateKey}-${weekday ? 'weekday' : 'weekend'}`;
}

export function loadMode(): RoutineMode {
  if (typeof localStorage === 'undefined') return 'auto';
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === 'auto' || saved === 'weekday' || saved === 'weekend') {
    return saved;
  }
  return 'auto';
}

export function saveMode(mode: RoutineMode) {
  localStorage.setItem(MODE_KEY, mode);
}

export function loadVolume(): number {
  if (typeof localStorage === 'undefined') return 70;
  const saved = Number(localStorage.getItem(VOLUME_KEY));
  if (!Number.isFinite(saved)) return 70;
  return Math.min(100, Math.max(0, saved));
}

export function saveVolume(volume: number) {
  localStorage.setItem(VOLUME_KEY, String(volume));
}

export function loadStarts(
  dateKey: string,
  weekday: boolean,
  fallback: number[],
): number[] {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(startsStorageKey(dateKey, weekday));
    if (!raw) return fallback.slice();
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === fallback.length &&
      parsed.every(value => typeof value === 'number' && Number.isFinite(value))
    ) {
      return parsed;
    }
  } catch {
    return fallback.slice();
  }
  return fallback.slice();
}

export function saveStarts(
  dateKey: string,
  weekday: boolean,
  starts: number[],
) {
  localStorage.setItem(
    startsStorageKey(dateKey, weekday),
    JSON.stringify(starts),
  );
}
