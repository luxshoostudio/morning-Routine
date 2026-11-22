/** Today-only start times. The final marker never moves later. */
export const MIN_BLOCK = 5;

export function toMin(t: string | number): number {
  if (typeof t === 'number') return t;
  const parts = String(t).split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

export function fromMin(m: number): string {
  const rounded = Math.max(0, Math.round(m));
  const h = Math.floor(rounded / 60);
  const mm = rounded % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function baseStarts(plan: Array<{ t: string | number }>): number[] {
  return plan.map(point => toMin(point.t));
}

/** Index of the block that contains `now`, or -1 before the first start. */
export function idxAt(starts: number[], now: number): number {
  let index = -1;
  for (let k = 0; k < starts.length; k++) {
    if (now >= starts[k]) index = k;
  }
  return index;
}

/**
 * Minutes that can be taken from blocks after `i` without pushing the end
 * back or shrinking any later block under MIN_BLOCK. The done marker is not
 * a block that can be compressed on its own; the last sounding block is the
 * final one that may shrink.
 */
export function stealable(starts: number[], i: number): number {
  const last = starts.length - 1;
  if (i < 0 || i >= last - 1) return 0;
  let steal = 0;
  for (let k = i + 1; k < last; k++) {
    steal += Math.max(0, starts[k + 1] - starts[k] - MIN_BLOCK);
  }
  return steal;
}

export function canDelay(
  starts: number[],
  i: number,
): { ok: boolean; max: number } {
  const max = stealable(starts, i);
  return { ok: max > 0, max };
}

export function canSkip(starts: number[], i: number, now: number): boolean {
  const last = starts.length - 1;
  return i >= 0 && i < last - 1 && now >= starts[i] && now < starts[i + 1];
}

export function delayStarts(
  input: number[],
  i: number,
  minutes: number,
): { applied: number; starts: number[] } {
  const starts = input.slice();
  const last = starts.length - 1;
  const end = starts[last];
  const result = { applied: 0, starts };
  if (i < 0 || i >= last - 1 || !(minutes > 0)) return result;

  const max = stealable(starts, i);
  const applied = Math.min(minutes, max);
  if (applied <= 0) return result;

  starts[i + 1] += applied;

  for (let k = i + 1; k < last - 1; k++) {
    const dur = starts[k + 1] - starts[k];
    if (dur >= MIN_BLOCK) break;
    const nRem = last - (k + 1);
    const maxBoundary = end - nRem * MIN_BLOCK;
    const need = starts[k] + MIN_BLOCK;
    if (need > maxBoundary) break;
    if (need <= starts[k + 1]) break;
    starts[k + 1] = need;
  }

  starts[last] = end;
  for (let k2 = 1; k2 < last; k2++) {
    if (starts[k2] < starts[k2 - 1]) starts[k2] = starts[k2 - 1];
  }
  starts[last] = end;
  result.applied = applied;
  return result;
}

export function skipStarts(
  input: number[],
  i: number,
  now: number,
): { applied: boolean; starts: number[] } {
  const starts = input.slice();
  const last = starts.length - 1;
  const end = starts[last];
  const result = { applied: false, starts };
  if (!canSkip(starts, i, now)) return result;
  starts[i + 1] = now;
  starts[last] = end;
  result.applied = true;
  return result;
}

export type ScheduleRowState = 'past' | 'current' | 'future';

export type ScheduleRow = {
  end: number | null;
  name: string;
  skipped: boolean;
  start: number;
  state: ScheduleRowState;
};

/**
 * Rows for the side list. Times are today's adjusted starts. A block is
 * skipped when its end moved earlier than the base plan (Skip is the only
 * adjustment that does that).
 */
export function scheduleRows(
  plan: Array<{ name: string; t: string | number }>,
  starts: number[],
  now: number | null,
): ScheduleRow[] {
  const base = baseStarts(plan);
  return plan.map((block, index) => {
    const start = starts[index] ?? base[index] ?? 0;
    const last = index === plan.length - 1;
    const end = last ? null : (starts[index + 1] ?? base[index + 1] ?? start);
    const baseEnd = base[index + 1];
    const skipped =
      !last && end !== null && baseEnd !== undefined && end < baseEnd;
    let state: ScheduleRowState = 'future';
    if (now !== null && now >= start) {
      state = end === null || now < end ? 'current' : 'past';
    }
    return { end, name: block.name, skipped, start, state };
  });
}

export function formatRange(start: number, end: number | null): string {
  if (end === null) return fromMin(start);
  return `${fromMin(start)}–${fromMin(end)}`;
}

export function fmtRemain(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    const hourLabel = hours === 1 ? '1 hour' : `${hours} hours`;
    if (!rest) return hourLabel;
    const minuteLabel = rest === 1 ? '1 minute' : `${rest} minutes`;
    return `${hourLabel} ${minuteLabel}`;
  }
  if (rounded === 1) return '1 minute';
  return `${rounded} minutes`;
}
