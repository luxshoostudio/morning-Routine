import { useEffect, useMemo, useRef, useState } from 'react';

import {
  formatLogMarkdown,
  loadLog,
  saveLog,
  type LogEntry,
} from '@/lib/routine/log';
import {
  CROSSFADE_MS,
  DELAY_CHOICES,
  DELAY_REASONS,
  INTRO_FADE_MS,
  MIX_LABELS,
  PREVIEW_SECONDS,
  buildPlan,
  endLabel,
  prefersWeekday,
  type MixId,
  type RoutineBlock,
  type RoutineMode,
} from '@/lib/routine/plan';
import { RoutinePlayer, setSession } from '@/lib/routine/player';
import {
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
  type ScheduleRow,
} from '@/lib/routine/schedule';
import { allRoutineLayers, layersFor } from '@/lib/routine/sounds';
import {
  loadMode,
  loadStarts,
  loadVolume,
  saveMode,
  saveStarts,
  saveVolume,
} from '@/lib/routine/storage';
import { readZonedNow, type ZonedNow } from '@/lib/routine/time';

import styles from './routine.module.css';

type PreviewState = {
  endsAt: number;
  index: number;
  mix: MixId | null;
  name: string;
  total: number;
};

type SheetKind = 'delay' | 'skip';

const MODES: Array<{ id: RoutineMode; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'weekday', label: 'Weekday' },
  { id: 'weekend', label: 'Weekend' },
];

export function Routine() {
  const playerRef = useRef<RoutinePlayer | null>(null);
  const audioKey = useRef('');
  const previewTimer = useRef(0);
  const volumeRef = useRef(70);
  const seenWeekday = useRef<boolean | null>(null);

  const [now, setNow] = useState<ZonedNow | null>(null);
  const [mode, setMode] = useState<RoutineMode>('auto');
  const [volume, setVolume] = useState(70);
  const [starts, setStarts] = useState<number[] | null>(null);
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [note, setNote] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [sheetMins, setSheetMins] = useState(5);
  const [chosenChip, setChosenChip] = useState(5);
  const [reason, setReason] = useState('');
  const [copied, setCopied] = useState(false);

  volumeRef.current = volume;

  const weekday = now ? prefersWeekday(mode, now.weekday) : true;
  const plan = useMemo(() => buildPlan(weekday), [weekday]);
  const dateKey = now?.dateKey ?? '';

  const activeStarts =
    starts && starts.length === plan.length ? starts : baseStarts(plan);

  const idx =
    now && activeStarts.length ? idxAt(activeStarts, now.minutes) : -1;
  const block = idx >= 0 ? plan[idx] : undefined;
  const done = idx >= plan.length - 1 && plan.length > 0;
  const inBlock = Boolean(block?.mix);
  const showAdjust = running && !previewing && inBlock;
  const delayState = canDelay(activeStarts, idx);
  const skipOk = now ? canSkip(activeStarts, idx, now.minutes) : false;

  useEffect(() => {
    setMode(loadMode());
    setVolume(loadVolume());
    setLog(loadLog());
    const tick = () => setNow(readZonedNow());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!dateKey) return;
    setStarts(loadStarts(dateKey, weekday, baseStarts(plan)));
  }, [dateKey, weekday, plan]);

  useEffect(() => {
    if (seenWeekday.current === null) {
      seenWeekday.current = weekday;
      return;
    }
    if (seenWeekday.current === weekday) return;
    seenWeekday.current = weekday;
    if (running && !previewing) audioKey.current = '';
  }, [weekday, running, previewing]);

  useEffect(() => {
    if (!running || previewing || !now || !starts) return;
    if (starts.length !== plan.length) return;

    const index = idxAt(starts, now.minutes);
    if (index >= plan.length - 1) {
      audioKey.current = '';
      playerRef.current?.stop(CROSSFADE_MS);
      setSession(plan[index]?.name ?? 'Done. Nice work.', false);
      setRunning(false);
      return;
    }

    const current = index >= 0 ? plan[index] : undefined;
    const key = audioKeyFor(weekday, index, current?.mix ?? null);
    if (audioKey.current === key) return;
    const intro = audioKey.current === '';
    audioKey.current = key;
    const player = ensurePlayer(playerRef);
    player.setMaster(volumeRef.current / 100);
    if (!current?.mix) {
      player.stop(intro ? 400 : CROSSFADE_MS);
      setSession('Morning Routine', true);
      return;
    }
    player.playMix(
      layersFor(current.mix),
      intro ? INTRO_FADE_MS : CROSSFADE_MS,
    );
    setSession(current.name, true);
  }, [running, previewing, now, starts, plan, weekday]);

  useEffect(() => {
    if (!running) return;
    let released = false;
    let sentinel: WakeLockSentinel | null = null;

    async function acquire() {
      if (released || !('wakeLock' in navigator)) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        sentinel = null;
      }
    }

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void playerRef.current?.unlock();
      void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
    };
  }, [running]);

  useEffect(() => {
    return () => {
      window.clearTimeout(previewTimer.current);
      playerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sheet && !logOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSheet(null);
      setLogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet, logOpen]);

  function chooseMode(next: RoutineMode) {
    saveMode(next);
    setMode(next);
    if (!previewing) {
      audioKey.current = '';
      return;
    }
    window.clearTimeout(previewTimer.current);
    playerRef.current?.stop(400);
    setPreview(null);
    setPreviewing(false);
    setRunning(false);
    setSession('Morning Routine', false);
  }

  function onVolume(value: number) {
    setVolume(value);
    saveVolume(value);
    playerRef.current?.setMaster(value / 100);
  }

  function beginClock() {
    if (!now || done) return;
    const fresh = readZonedNow();
    const index = idxAt(activeStarts, fresh.minutes);
    if (index >= plan.length - 1) return;
    const player = ensurePlayer(playerRef);
    player.setMaster(volume / 100);
    player.preload(allRoutineLayers());
    void player.unlock();
    const current = index >= 0 ? plan[index] : undefined;
    if (current?.mix) {
      player.playMix(layersFor(current.mix), INTRO_FADE_MS);
      setSession(current.name, true);
    } else {
      player.stop(400);
      setSession('Morning Routine', true);
    }
    audioKey.current = audioKeyFor(weekday, index, current?.mix ?? null);
    setNote('');
    setPreview(null);
    setPreviewing(false);
    setRunning(true);
  }

  function beginPreview() {
    const player = ensurePlayer(playerRef);
    player.setMaster(volume / 100);
    player.preload(allRoutineLayers());
    void player.unlock();
    setNote('');
    setRunning(true);
    setPreviewing(true);
    playPreview(plan, 0);
  }

  function playPreview(blocks: RoutineBlock[], index: number) {
    const sounding = blocks.filter(item => item.mix);
    if (index >= sounding.length) {
      playerRef.current?.stop(400);
      setSession('Morning Routine', false);
      setPreview(null);
      setPreviewing(false);
      setRunning(false);
      setNote('Preview finished. Tomorrow it will follow the clock.');
      return;
    }
    const item = sounding[index];
    if (item?.mix) {
      ensurePlayer(playerRef).playMix(
        layersFor(item.mix),
        index === 0 ? INTRO_FADE_MS : CROSSFADE_MS,
      );
      setSession(item.name, true);
    }
    setPreview({
      endsAt: Date.now() + PREVIEW_SECONDS * 1000,
      index,
      mix: item?.mix ?? null,
      name: item?.name ?? '',
      total: sounding.length,
    });
    previewTimer.current = window.setTimeout(
      () => playPreview(blocks, index + 1),
      PREVIEW_SECONDS * 1000,
    );
  }

  function openSheet(kind: SheetKind) {
    if (kind === 'delay' && !delayState.ok) return;
    if (kind === 'skip' && !skipOk) return;
    const max = delayState.max;
    const initial = max >= 5 ? 5 : max;
    setSheetMins(initial);
    setChosenChip(5);
    setReason('');
    setSheet(kind);
  }

  function applySheet() {
    if (!sheet || !now) return;
    const fresh = readZonedNow();
    const index = idxAt(activeStarts, fresh.minutes);
    const current = plan[index];
    if (!current?.mix) {
      setSheet(null);
      return;
    }
    const why = reason.trim().slice(0, 80);
    if (sheet === 'delay') {
      const capped = Math.min(sheetMins, canDelay(activeStarts, index).max);
      const result = delayStarts(activeStarts, index, capped);
      if (result.applied <= 0) {
        setSheet(null);
        return;
      }
      saveStarts(fresh.dateKey, weekday, result.starts);
      setStarts(result.starts);
      pushLog({
        action: 'delay',
        at: Date.now(),
        block: current.name,
        date: fresh.dateKey,
        minutes: Math.round(result.applied),
        reason: why,
        time: fresh.clock,
      });
      setSheet(null);
      return;
    }

    const result = skipStarts(activeStarts, index, fresh.minutes);
    if (!result.applied) {
      setSheet(null);
      return;
    }
    saveStarts(fresh.dateKey, weekday, result.starts);
    setStarts(result.starts);
    audioKey.current = '';
    pushLog({
      action: 'skip',
      at: Date.now(),
      block: current.name,
      date: fresh.dateKey,
      minutes: 0,
      reason: why,
      time: fresh.clock,
    });
    setSheet(null);
  }

  function pushLog(entry: LogEntry) {
    const next = [entry, ...log];
    setLog(next);
    saveLog(next);
  }

  async function exportLog() {
    const text = formatLogMarkdown(log);
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const previewLeft = preview
    ? Math.max(0, Math.ceil((preview.endsAt - Date.now()) / 1000))
    : 0;

  const view = describeView({
    block,
    done,
    idx,
    now,
    plan,
    preview,
    previewLeft,
    previewing,
    starts: activeStarts,
  });

  const tint =
    previewing && preview?.mix
      ? (plan.find(item => item.mix === preview.mix)?.tint ?? '#1a1c20')
      : (block?.tint ?? '#0b0c0e');
  const rows = scheduleRows(plan, activeStarts, now ? now.minutes : null);

  return (
    <main
      className={styles.page}
      data-block={view.title}
      data-previewing={previewing ? 'true' : 'false'}
      data-running={running ? 'true' : 'false'}
      style={{ ['--glow' as string]: tint }}
    >
      <a className={styles.home} href="/">
        Moodist
      </a>

      <div className={styles.layout}>
        <div className={styles.stage}>
          <p className={styles.clock}>{now ? now.clock : '--:--'}</p>
          <h1 className={view.long ? styles.long : styles.block}>
            {view.title}
          </h1>
          {view.minutes && <p className={styles.minutes}>{view.minutes}</p>}
          <p className={styles.sub}>{view.sub}</p>
          {view.mix && <p className={styles.mix}>{view.mix}</p>}
          <div
            aria-label="Block progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(view.progress)}
            className={styles.bar}
            role="progressbar"
          >
            <div
              className={styles.fill}
              style={{ width: `${view.progress}%` }}
            />
          </div>

          {note && !previewing && <p className={styles.hint}>{note}</p>}
          {!running && !done && !note && (
            <p className={styles.hint}>
              Tap Start. When the sound changes, move on.
            </p>
          )}

          {!running && (
            <div className={styles.actions}>
              <button
                className={styles.pill}
                disabled={!now || done}
                type="button"
                onClick={beginClock}
              >
                Start
              </button>
              <button
                className={`${styles.pill} ${styles.ghost}`}
                disabled={!now}
                type="button"
                onClick={beginPreview}
              >
                Preview
              </button>
            </div>
          )}

          <label className={styles.volume}>
            Volume
            <input
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={volume}
              max={100}
              min={0}
              type="range"
              value={volume}
              onChange={event => onVolume(Number(event.target.value))}
            />
          </label>

          {showAdjust && (
            <div className={styles.adjust}>
              <button
                disabled={!delayState.ok}
                type="button"
                onClick={() => openSheet('delay')}
              >
                Delay
              </button>
              <button
                disabled={!skipOk}
                type="button"
                onClick={() => openSheet('skip')}
              >
                Skip
              </button>
              {!delayState.ok && !skipOk && (
                <p className={styles.adjustNote}>
                  This block runs until {endLabel(plan)}.
                </p>
              )}
            </div>
          )}
        </div>

        <aside aria-label="Today's schedule" className={styles.schedule}>
          <p className={styles.scheduleLabel}>Today</p>
          <ol>
            {rows.map(row => (
              <li
                aria-current={row.state === 'current' ? 'step' : undefined}
                className={rowClass(row)}
                key={row.name}
              >
                <span className={styles.when}>
                  {formatRange(row.start, row.end)}
                </span>
                <span className={styles.what}>{row.name}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <div className={styles.footer}>
        <div aria-label="Day type" className={styles.modes} role="group">
          {MODES.map((item, index) => (
            <span key={item.id}>
              {index > 0 && <span className={styles.dot}>·</span>}
              <button
                aria-pressed={mode === item.id}
                className={mode === item.id ? styles.on : undefined}
                type="button"
                onClick={() => chooseMode(item.id)}
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
        <button
          className={styles.logButton}
          type="button"
          onClick={() => setLogOpen(true)}
        >
          Log
        </button>
      </div>

      {sheet && (
        <div className={styles.overlay}>
          <button
            aria-label="Close"
            className={styles.backdrop}
            type="button"
            onClick={() => setSheet(null)}
          />
          <div
            aria-labelledby="sheet-title"
            aria-modal="true"
            className={styles.card}
            role="dialog"
          >
            <h2 id="sheet-title">
              {sheet === 'delay' ? 'Delay this block' : 'Skip this block'}
            </h2>
            <p className={styles.sheetNote}>
              Today only. The day still ends at {endLabel(plan)}.
            </p>
            {sheet === 'delay' && (
              <div className={styles.chips}>
                {DELAY_CHOICES.map(choice => {
                  const disabled =
                    choice === 5
                      ? delayState.max <= 0
                      : delayState.max <= choice - 5;
                  const label =
                    choice === 5 && delayState.max > 0 && delayState.max < 5
                      ? `${Math.round(delayState.max)} min`
                      : `${choice} min`;
                  return (
                    <button
                      className={
                        chosenChip === choice ? styles.chipOn : undefined
                      }
                      disabled={disabled}
                      key={choice}
                      type="button"
                      onClick={() => {
                        setChosenChip(choice);
                        setSheetMins(Math.min(choice, delayState.max));
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className={styles.chips}>
              {DELAY_REASONS.map(item => (
                <button
                  className={reason === item ? styles.chipOn : undefined}
                  key={item}
                  type="button"
                  onClick={() =>
                    setReason(current => (current === item ? '' : item))
                  }
                >
                  {item}
                </button>
              ))}
            </div>
            <input
              maxLength={80}
              placeholder="Reason (optional)"
              type="text"
              value={reason}
              onChange={event => setReason(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') applySheet();
              }}
            />
            <div className={styles.actions}>
              <button
                className={`${styles.pill} ${styles.ghost}`}
                type="button"
                onClick={() => setSheet(null)}
              >
                Cancel
              </button>
              <button
                className={styles.pill}
                type="button"
                onClick={applySheet}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {logOpen && (
        <div className={styles.overlay}>
          <button
            aria-label="Close"
            className={styles.backdrop}
            type="button"
            onClick={() => setLogOpen(false)}
          />
          <div
            aria-labelledby="log-title"
            aria-modal="true"
            className={styles.card}
            role="dialog"
          >
            <h2 id="log-title">Log</h2>
            <div className={styles.logList}>
              {log.length === 0 && (
                <p className={styles.empty}>No entries yet</p>
              )}
              {log.map(entry => (
                <article
                  className={styles.logItem}
                  key={`${entry.at}-${entry.time}`}
                >
                  <p>
                    {entry.date} {entry.time}
                  </p>
                  <p>{logLine(entry)}</p>
                  {entry.reason && (
                    <p className={styles.logMeta}>Reason: {entry.reason}</p>
                  )}
                </article>
              ))}
            </div>
            <div className={styles.actions}>
              <button
                className={`${styles.pill} ${styles.ghost}`}
                type="button"
                onClick={() => setLogOpen(false)}
              >
                Close
              </button>
              <button
                className={styles.pill}
                type="button"
                onClick={() => void exportLog()}
              >
                {copied ? 'Copied' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ensurePlayer(ref: { current: RoutinePlayer | null }) {
  if (!ref.current) ref.current = new RoutinePlayer();
  return ref.current;
}

function audioKeyFor(
  weekday: boolean,
  index: number,
  mix: MixId | null,
): string {
  return `${weekday ? 'weekday' : 'weekend'}:${index}:${mix ?? 'silence'}`;
}

function rowClass(row: ScheduleRow): string | undefined {
  if (row.skipped) return styles.skipped;
  if (row.state === 'current') return styles.current;
  if (row.state === 'past') return styles.past;
  return undefined;
}

function describeView(input: {
  block: RoutineBlock | undefined;
  done: boolean;
  idx: number;
  now: ZonedNow | null;
  plan: RoutineBlock[];
  preview: PreviewState | null;
  previewLeft: number;
  previewing: boolean;
  starts: number[];
}) {
  if (input.previewing && input.preview) {
    const elapsed = PREVIEW_SECONDS - input.previewLeft;
    const progress =
      ((input.preview.index + elapsed / PREVIEW_SECONDS) /
        input.preview.total) *
      100;
    return {
      long: input.preview.name.length > 24,
      minutes: null as string | null,
      mix: input.preview.mix ? MIX_LABELS[input.preview.mix] : null,
      progress: Math.max(0, Math.min(100, progress)),
      sub: `Preview ${input.preview.index + 1} / ${input.preview.total}, switches in about ${input.previewLeft} seconds`,
      title: input.preview.name,
    };
  }

  if (!input.now || input.idx < 0) {
    const first = input.plan[0];
    return {
      long: false,
      minutes: null,
      mix: null,
      progress: 0,
      sub: first
        ? `Starts at ${fromMin(input.starts[0] ?? 0)} with ${first.name}`
        : 'Tap Start. When the sound changes, move on.',
      title: 'Not started yet',
    };
  }

  if (input.done) {
    return {
      long: false,
      minutes: null,
      mix: null,
      progress: 100,
      sub: "Today's morning routine is done. Nice work.",
      title: input.block?.name ?? 'Done. Nice work.',
    };
  }

  const next = input.plan[input.idx + 1];
  const start = input.starts[input.idx] ?? 0;
  const end = input.starts[input.idx + 1] ?? start;
  const span = end - start;
  const progress = span > 0 ? ((input.now.minutes - start) / span) * 100 : 100;

  return {
    long: (input.block?.name.length ?? 0) > 24,
    minutes: `${fmtRemain(end - input.now.minutes)} left`,
    mix: input.block?.mix ? MIX_LABELS[input.block.mix] : null,
    progress: Math.max(0, Math.min(100, progress)),
    sub: next ? `Next: ${next.name}` : '',
    title: input.block?.name ?? '',
  };
}

function logLine(entry: LogEntry): string {
  if (entry.action === 'delay') {
    return `Delayed "${entry.block}" by ${entry.minutes} minutes`;
  }
  return `Skipped "${entry.block}"`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }
}
