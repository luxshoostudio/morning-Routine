export type LogAction = 'delay' | 'skip';

export type LogEntry = {
  action: LogAction;
  at: number;
  block: string;
  date: string;
  minutes: number;
  reason: string;
  time: string;
};

const LOG_KEY = 'moodist-routine-log';

export function sortLog(entries: LogEntry[]): LogEntry[] {
  return entries.slice().sort((a, b) => {
    const byStamp = `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
    if (byStamp !== 0) return byStamp;
    return b.at - a.at;
  });
}

export function formatLogMarkdown(entries: LogEntry[]): string {
  const sorted = sortLog(entries);
  let text = '# Morning routine log\n';
  if (!sorted.length) {
    text += '\nNo entries yet\n';
    return text;
  }

  let day = '';
  for (const entry of sorted) {
    if (entry.date !== day) {
      day = entry.date;
      text += `\n## ${day}\n`;
    }
    text += `- ${entry.time} `;
    if (entry.action === 'delay') {
      text += `Delayed "${entry.block}" by ${entry.minutes} minutes`;
    } else {
      text += `Skipped "${entry.block}"`;
    }
    if (entry.reason) text += `. Reason: ${entry.reason}`;
    text += '\n';
  }
  return text;
}

export function loadLog(): LogEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return sortLog(
      parsed.flatMap(entry => {
        const normalized = normalize(entry);
        return normalized ? [normalized] : [];
      }),
    );
  } catch {
    return [];
  }
}

export function saveLog(entries: LogEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

function normalize(value: unknown): LogEntry | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<LogEntry>;
  if (entry.action !== 'delay' && entry.action !== 'skip') return null;
  if (typeof entry.block !== 'string') return null;
  if (typeof entry.date !== 'string' || typeof entry.time !== 'string') {
    return null;
  }
  return {
    action: entry.action,
    at: typeof entry.at === 'number' ? entry.at : 0,
    block: entry.block,
    date: entry.date,
    minutes: typeof entry.minutes === 'number' ? entry.minutes : 0,
    reason: typeof entry.reason === 'string' ? entry.reason : '',
    time: entry.time,
  };
}
