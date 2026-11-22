import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatLogMarkdown, sortLog, type LogEntry } from './log.ts';

const older: LogEntry = {
  action: 'delay',
  at: 1,
  block: 'Daily Briefing',
  date: '2026-11-22',
  minutes: 15,
  reason: 'Overslept',
  time: '08:20',
};

const newer: LogEntry = {
  action: 'skip',
  at: 2,
  block: 'Spanish class with Grok Bot Professor Laura',
  date: '2026-11-22',
  minutes: 0,
  reason: '',
  time: '09:50',
};

test('log sorts newest first', () => {
  assert.deepEqual(
    sortLog([older, newer]).map(entry => entry.time),
    ['09:50', '08:20'],
  );
});

test('export copies entries as Markdown, newest first', () => {
  const text = formatLogMarkdown([older, newer]);
  assert.equal(
    text,
    [
      '# Morning routine log',
      '',
      '## 2026-11-22',
      '- 09:50 Skipped "Spanish class with Grok Bot Professor Laura"',
      '- 08:20 Delayed "Daily Briefing" by 15 minutes. Reason: Overslept',
      '',
    ].join('\n'),
  );
});

test('an empty log still exports a heading', () => {
  assert.equal(
    formatLogMarkdown([]),
    '# Morning routine log\n\nNo entries yet\n',
  );
});
