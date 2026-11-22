export type RoutineMode = 'auto' | 'weekday' | 'weekend';

export type MixId = 'meditation' | 'cafe' | 'rain' | 'rest' | 'brown';

export type MixLayer = {
  id: string;
  volume: number;
};

export type RoutineBlock = {
  mix: MixId | null;
  name: string;
  t: string;
  tint: string;
};

/** Moodist sound ids and relative levels for each block. */
export const MIXES: Record<MixId, MixLayer[]> = {
  brown: [{ id: 'brown-noise', volume: 0.6 }],
  cafe: [{ id: 'cafe', volume: 0.7 }],
  meditation: [
    { id: 'singing-bowl', volume: 0.62 },
    { id: 'wind', volume: 0.38 },
  ],
  rain: [{ id: 'light-rain', volume: 0.72 }],
  rest: [
    { id: 'birds', volume: 0.48 },
    { id: 'river', volume: 0.55 },
  ],
};

export const MIX_LABELS: Record<MixId, string> = {
  brown: 'Brown Noise',
  cafe: 'Cafe',
  meditation: 'Singing Bowl + Wind',
  rain: 'Light Rain',
  rest: 'Birds + River',
};

export const PREVIEW_SECONDS = 18;
export const CROSSFADE_MS = 2500;
export const INTRO_FADE_MS = 1200;

const REASONS = [
  'Overslept',
  'Tired',
  'Something came up',
  'Low energy',
] as const;

export const DELAY_REASONS: readonly string[] = REASONS;
export const DELAY_CHOICES = [5, 10, 15] as const;

/**
 * Weekday keeps the 8:00 meditation block. Weekend drops it and starts
 * Daily Briefing at 8:00. Later clock times, including the 11:00 end, stay.
 */
export function buildPlan(weekday: boolean): RoutineBlock[] {
  const blocks: RoutineBlock[] = [];

  if (weekday) {
    blocks.push({
      mix: 'meditation',
      name: 'Wake up & Meditation',
      t: '08:00',
      tint: '#16141c',
    });
    blocks.push({
      mix: 'cafe',
      name: 'Daily Briefing',
      t: '08:15',
      tint: '#1a1612',
    });
  } else {
    blocks.push({
      mix: 'cafe',
      name: 'Daily Briefing',
      t: '08:00',
      tint: '#1a1612',
    });
  }

  blocks.push(
    {
      mix: 'rain',
      name: 'Spanish class with Grok Bot Professor Laura',
      t: '09:40',
      tint: '#12161c',
    },
    {
      mix: 'rest',
      name: 'Break',
      t: '10:15',
      tint: '#121815',
    },
    {
      mix: 'brown',
      name: 'ACSM with Grok Bot Professor Livy',
      t: '10:25',
      tint: '#141414',
    },
    {
      mix: null,
      name: 'Done. Nice work.',
      t: '11:00',
      tint: '#0b0c0e',
    },
  );

  return blocks;
}

export function prefersWeekday(mode: RoutineMode, day: number): boolean {
  if (mode === 'weekday') return true;
  if (mode === 'weekend') return false;
  return day >= 1 && day <= 5;
}

export function endLabel(plan: RoutineBlock[]): string {
  const end = plan[plan.length - 1];
  return end ? end.t : '11:00';
}
