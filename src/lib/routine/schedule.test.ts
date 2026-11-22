import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildPlan, prefersWeekday } from './plan.ts';
import {
  MIN_BLOCK,
  baseStarts,
  canDelay,
  canSkip,
  delayStarts,
  fmtRemain,
  formatRange,
  fromMin,
  idxAt,
  scheduleRows,
  skipStarts,
  toMin,
} from './schedule.ts';
import { readZonedNow } from './time.ts';

const weekday = [
  { t: '08:00' },
  { t: '08:15' },
  { t: '09:40' },
  { t: '10:15' },
  { t: '10:25' },
  { t: '11:00' },
];
// 480, 495, 580, 615, 625, 660

function times(starts: number[]) {
  return starts.map(fromMin).join(' ');
}

test('base starts and idxAt follow the reference schedule', () => {
  const base = baseStarts(weekday);
  assert.deepEqual(base, [480, 495, 580, 615, 625, 660]);
  assert.equal(idxAt(base, toMin('08:00')), 0);
  assert.equal(idxAt(base, toMin('08:14')), 0);
  assert.equal(idxAt(base, toMin('08:15')), 1);
  assert.equal(idxAt(base, 579.9), 1);
  assert.equal(idxAt(base, 580), 2);
  assert.equal(idxAt(base, toMin('11:00')), 5);
  assert.equal(idxAt(base, toMin('07:59')), -1);
  assert.equal(times(base), '08:00 08:15 09:40 10:15 10:25 11:00');
});

test('delay Daily Briefing 15 compresses Spanish only and keeps 11:00', () => {
  const base = baseStarts(weekday);
  const result = delayStarts(base, 1, 15);
  assert.equal(result.applied, 15);
  assert.deepEqual(result.starts, [480, 495, 595, 615, 625, 660]);
  assert.equal(result.starts[result.starts.length - 1], 660);
  assert.equal(result.starts[3] - result.starts[2], 20);
});

test('delay Spanish 15 keeps the break at 5 minutes and shrinks ACSM', () => {
  const base = baseStarts(weekday);
  const result = delayStarts(base, 2, 15);
  assert.equal(result.applied, 15);
  assert.equal(result.starts[5], 660);
  assert.deepEqual(result.starts, [480, 495, 580, 630, 635, 660]);
  assert.equal(result.starts[4] - result.starts[3], 5);
  assert.equal(result.starts[5] - result.starts[4], 25);
});

test('delay Break 15 compresses only ACSM', () => {
  const base = baseStarts(weekday);
  const result = delayStarts(base, 3, 15);
  assert.equal(result.applied, 15);
  assert.deepEqual(result.starts, [480, 495, 580, 615, 640, 660]);
});

test('the last sounding block cannot be delayed', () => {
  const base = baseStarts(weekday);
  const result = delayStarts(base, 4, 10);
  assert.equal(result.applied, 0);
  assert.deepEqual(result.starts, base);
  assert.equal(canDelay(base, 4).ok, false);
});

test('stacked delays never move 11:00 and respect the 5 minute floor', () => {
  const base = baseStarts(weekday);
  const starts = delayStarts(base, 2, 15).starts;
  const result = delayStarts(starts, 2, 15);
  assert.equal(result.starts[5], 660);
  assert.ok(result.applied > 0);
  assert.equal(result.applied, 15);
  assert.ok(result.starts[3] - result.starts[2] >= MIN_BLOCK);
  assert.ok(result.starts[4] - result.starts[3] >= MIN_BLOCK);
  assert.ok(result.starts[5] - result.starts[4] >= MIN_BLOCK);
});

test('a delay larger than the stealable time is capped', () => {
  const base = baseStarts(weekday);
  const result = delayStarts(base, 2, 100);
  assert.equal(result.applied, 35);
  assert.equal(result.starts[5], 660);
  assert.equal(result.starts[3] - result.starts[2], 70);
  assert.equal(result.starts[4] - result.starts[3], 5);
  assert.equal(result.starts[5] - result.starts[4], 5);
});

test('skip Spanish at 09:50 starts the break now and keeps later times', () => {
  const base = baseStarts(weekday);
  const now = toMin('09:50');
  const result = skipStarts(base, 2, now);
  assert.equal(result.applied, true);
  assert.equal(result.starts[3], now);
  assert.deepEqual(result.starts.slice(0, 3), [480, 495, 580]);
  assert.deepEqual(result.starts.slice(4), [625, 660]);
  assert.equal(idxAt(result.starts, now), 3);
});

test('skip is refused before a block starts or on the last block', () => {
  const base = baseStarts(weekday);
  assert.equal(canSkip(base, 2, toMin('09:39')), false);
  assert.equal(skipStarts(base, 2, toMin('09:39')).applied, false);
  assert.equal(canSkip(base, 4, toMin('10:30')), false);
  assert.equal(skipStarts(base, 4, toMin('10:30')).applied, false);
});

test('weekend-shaped plan from the reference tests keeps 11:00', () => {
  const weekend = [
    { t: '08:15' },
    { t: '09:40' },
    { t: '10:15' },
    { t: '10:25' },
    { t: '11:00' },
  ];
  const base = baseStarts(weekend);
  assert.deepEqual(base, [495, 580, 615, 625, 660]);
  const skipped = skipStarts(base, 0, toMin('08:40'));
  assert.equal(skipped.applied, true);
  assert.equal(skipped.starts[1], toMin('08:40'));
  assert.equal(skipped.starts[skipped.starts.length - 1], 660);
  const delayed = delayStarts(base, 0, 10);
  assert.equal(delayed.applied, 10);
  assert.equal(delayed.starts[1], 590);
  assert.equal(delayed.starts[4], 660);
});

test('today adjustments do not leak into a fresh base', () => {
  const base = baseStarts(weekday);
  const delayed = delayStarts(base, 1, 15).starts;
  const tomorrow = baseStarts(weekday);
  assert.deepEqual(tomorrow, base);
  assert.notDeepEqual(delayed, tomorrow);
});

test('product weekday and weekend plans', () => {
  const week = buildPlan(true);
  const end = buildPlan(false);
  assert.deepEqual(baseStarts(week), [480, 495, 580, 615, 625, 660]);
  assert.deepEqual(baseStarts(end), [480, 580, 615, 625, 660]);
  assert.deepEqual(
    week.map(block => block.name),
    [
      'Wake up & Meditation',
      'Daily Briefing',
      'Spanish class with Grok Bot Professor Laura',
      'Break',
      'ACSM with Grok Bot Professor Livy',
      'Done. Nice work.',
    ],
  );
  assert.equal(end[0]?.name, 'Daily Briefing');
  assert.equal(end[0]?.t, '08:00');
  assert.equal(end[0]?.mix, 'cafe');
  assert.deepEqual(
    week.map(block => block.mix),
    ['meditation', 'cafe', 'rain', 'rest', 'brown', null],
  );

  const weekend = baseStarts(end);
  const delayed = delayStarts(weekend, 0, 10);
  assert.equal(delayed.applied, 10);
  assert.equal(delayed.starts[1], 590);
  assert.equal(delayed.starts[4], 660);
  assert.equal(canDelay(weekend, 3).ok, false);
  assert.equal(canSkip(weekend, 3, toMin('10:30')), false);
});

test('auto follows Monday–Friday in the routine zone', () => {
  assert.equal(prefersWeekday('auto', 0), false);
  assert.equal(prefersWeekday('auto', 6), false);
  assert.equal(prefersWeekday('auto', 1), true);
  assert.equal(prefersWeekday('auto', 5), true);
  assert.equal(prefersWeekday('weekday', 0), true);
  assert.equal(prefersWeekday('weekend', 3), false);
});

test('America/Los_Angeles clock, including a Sunday morning', () => {
  const eight = readZonedNow(new Date('2026-11-22T16:00:00.000Z'));
  assert.equal(eight.clock, '08:00');
  assert.equal(eight.dateKey, '2026-11-22');
  assert.equal(eight.weekday, 0);
  assert.equal(eight.minutes, 480);

  const during = readZonedNow(new Date('2026-11-22T18:42:30.000Z'));
  assert.equal(during.clock, '10:42');
  assert.equal(during.minutes, 642.5);
  assert.equal(prefersWeekday('auto', during.weekday), false);
});

test('schedule rows follow adjustments, skip, and the clock', () => {
  const plan = buildPlan(true);
  const base = baseStarts(plan);
  const atBriefing = scheduleRows(plan, base, toMin('08:20'));
  assert.equal(atBriefing[0]?.state, 'past');
  assert.equal(atBriefing[1]?.state, 'current');
  assert.equal(atBriefing[2]?.state, 'future');
  assert.equal(
    formatRange(atBriefing[1]?.start ?? 0, atBriefing[1]?.end ?? null),
    '08:15–09:40',
  );
  assert.equal(
    atBriefing.every(row => !row.skipped),
    true,
  );

  const delayed = delayStarts(base, 1, 15).starts;
  const afterDelay = scheduleRows(plan, delayed, toMin('08:20'));
  assert.equal(
    formatRange(afterDelay[1]?.start ?? 0, afterDelay[1]?.end ?? null),
    '08:15–09:55',
  );
  assert.equal(
    afterDelay.every(row => !row.skipped),
    true,
  );
  assert.equal(
    formatRange(afterDelay[5]?.start ?? 0, afterDelay[5]?.end ?? null),
    '11:00',
  );

  const skipped = skipStarts(base, 2, toMin('09:50')).starts;
  const afterSkip = scheduleRows(plan, skipped, toMin('09:50'));
  assert.equal(afterSkip[2]?.skipped, true);
  assert.equal(afterSkip[2]?.state, 'past');
  assert.equal(
    formatRange(afterSkip[2]?.start ?? 0, afterSkip[2]?.end ?? null),
    '09:40–09:50',
  );
  assert.equal(afterSkip[3]?.skipped, false);
  assert.equal(afterSkip[3]?.state, 'current');
  assert.equal(
    formatRange(afterSkip[3]?.start ?? 0, afterSkip[3]?.end ?? null),
    '09:50–10:25',
  );

  const weekend = buildPlan(false);
  const weekendRows = scheduleRows(
    weekend,
    baseStarts(weekend),
    toMin('08:05'),
  );
  assert.equal(weekendRows[0]?.name, 'Daily Briefing');
  assert.equal(
    formatRange(weekendRows[0]?.start ?? 0, weekendRows[0]?.end ?? null),
    '08:00–09:40',
  );
  assert.equal(weekendRows[0]?.state, 'current');
});

test('remaining time labels', () => {
  assert.equal(fmtRemain(1), '1 minute');
  assert.equal(fmtRemain(18), '18 minutes');
  assert.equal(fmtRemain(60), '1 hour');
  assert.equal(fmtRemain(85), '1 hour 25 minutes');
});
