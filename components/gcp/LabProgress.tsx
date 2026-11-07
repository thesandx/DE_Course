'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

import { CompleteButton } from '@/components/course/CompleteButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { Progress } from '@/components/ui/Progress';

interface LabTicks {
  ticked: ReadonlySet<string>;
  toggle: (id: string, on: boolean) => void;
}

const TicksContext = createContext<LabTicks | null>(null);

function useTicks(): LabTicks {
  const value = useContext(TicksContext);
  if (value === null) throw new Error('A lab tick must sit inside <LabProgress>.');
  return value;
}

function storageKey(station: string): string {
  return `loop-ready-lab:${station}`;
}

// The ticks live in localStorage, read through useSyncExternalStore. A
// fallback map keeps them for this visit when storage is blocked.
const fallback = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback.get(key) ?? '[]';
  } catch {
    return fallback.get(key) ?? '[]';
  }
}

function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A private window may refuse to store. The fallback keeps the ticks for this visit.
    fallback.set(key, value);
  }
  listeners.forEach((listener) => listener());
}

function parseTicks(raw: string): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

export interface LabProgressProps {
  /** The station slug. The ticks are remembered per lab in this browser. */
  station: string;
  children: React.ReactNode;
}

/**
 * Holds which steps of one lab the learner has ticked. The ticks are a
 * convenience kept in this browser only; the lab's completion is saved to
 * the learner's tracker by `LabFinish`.
 */
export function LabProgress({ station, children }: LabProgressProps) {
  const key = storageKey(station);
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => '[]',
  );
  const ticked = useMemo(() => parseTicks(raw), [raw]);

  const toggle = useCallback(
    (id: string, on: boolean) => {
      const next = new Set(parseTicks(readRaw(key)));
      if (on) next.add(id);
      else next.delete(id);
      writeRaw(key, JSON.stringify([...next]));
    },
    [key],
  );

  const value = useMemo(() => ({ ticked, toggle }), [ticked, toggle]);
  return <TicksContext.Provider value={value}>{children}</TicksContext.Provider>;
}

export interface LabTickProps {
  id: string;
  label: string;
}

/** The "I did this" checkbox at the foot of a step. */
export function LabTick({ id, label }: LabTickProps) {
  const { ticked, toggle } = useTicks();
  return (
    <Checkbox
      label={label}
      checked={ticked.has(id)}
      onChange={(event) => toggle(id, event.target.checked)}
    />
  );
}

export interface LabMeterProps {
  ids: readonly string[];
  label: string;
}

/** How many of the given ticks are done, as a bar. */
export function LabMeter({ ids, label }: LabMeterProps) {
  const { ticked } = useTicks();
  const done = ids.filter((id) => ticked.has(id)).length;
  return (
    <Progress label={label} value={done} max={ids.length} valueText={`${done} of ${ids.length}`} />
  );
}

export interface LabFinishProps {
  itemId: string;
  done: boolean;
  xp: number;
  /** The cleanup ticks. The lab cannot be finished until every one is ticked. */
  cleanup: readonly string[];
}

/** Saves the lab as done, but only once every cleanup step is ticked. */
export function LabFinish({ itemId, done, xp, cleanup }: LabFinishProps) {
  const { ticked } = useTicks();
  const clean = cleanup.every((id) => ticked.has(id));
  return (
    <CompleteButton
      course="gcp"
      itemId={itemId}
      done={done}
      xp={xp}
      label="Finish lab"
      doneLabel="Lab finished and cleaned up"
      {...(clean
        ? {}
        : {
            blockedReason:
              'Tick every cleanup step first. Nothing the lab made should keep costing you money.',
          })}
    />
  );
}
