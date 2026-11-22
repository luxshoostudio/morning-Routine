/** Lux's morning clock. The schedule follows this zone, not the browser zone. */
export const ROUTINE_TIME_ZONE = 'America/Los_Angeles';

export type ZonedNow = {
  clock: string;
  dateKey: string;
  minutes: number;
  weekday: number;
};

const WEEKDAYS: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 0,
  Thu: 4,
  Tue: 2,
  Wed: 3,
};

export function readZonedNow(date = new Date()): ZonedNow {
  const fmt = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: ROUTINE_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );

  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  return {
    clock: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + minute + second / 60,
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  };
}
