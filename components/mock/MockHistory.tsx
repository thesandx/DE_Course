'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { percent, toneOf, type Verdict } from '@/lib/course/mock-score';
import {
  HISTORY_KEY,
  type MockHistoryEntry,
  type MockSession,
  openSessions,
  parseHistory,
} from '@/lib/course/mock-session';
import { cn } from '@/lib/utils';

export interface MockHistoryProps {
  /** The loops this course runs, by slug. A saved session of any other loop is left out. */
  loops: readonly { slug: string; name: string }[];
}

interface Saved {
  open: MockSession[];
  history: MockHistoryEntry[];
}

/** The scorecards the list shows. The browser keeps more. */
const SHOWN = 6;

const TONE: Record<Verdict['tone'], string> = {
  easy: 'bg-easy-soft text-easy',
  medium: 'bg-medium-soft text-medium',
  hard: 'bg-hard-soft text-hard',
};

const WHEN = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

function readSaved(): Saved {
  const storage = window.localStorage;
  const entries: [string, string | null][] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && key.startsWith('mock:')) entries.push([key, storage.getItem(key)]);
  }
  return { open: openSessions(entries), history: parseHistory(storage.getItem(HISTORY_KEY)) };
}

function where(session: MockSession): string {
  const round = session.rounds[session.current];
  const place = `round ${session.current + 1} of ${session.rounds.length}`;
  if (session.phase === 'review') return `In the review of ${place}.`;
  return round?.pausedAt !== null
    ? `Paused in ${place}.`
    : `In ${place}. Its clock is still running.`;
}

const hrefFor = (loop: string, seed: number): string => `/de/mock/${loop}?seed=${seed}`;

/**
 * The mocks this browser holds: the loops under way, with a link back in, and
 * the latest scorecards. It renders nothing until it has read the browser's
 * storage, and nothing when that holds no mock.
 */
export function MockHistory({ loops }: MockHistoryProps) {
  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    try {
      // Reading browser storage is only possible after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the saved mocks once, on mount
      setSaved(readSaved());
    } catch {
      // Storage can be blocked (private mode). Then there is no history to show.
      setSaved({ open: [], history: [] });
    }
  }, []);

  if (saved === null) return null;
  const names = new Map(loops.map((loop) => [loop.slug, loop.name]));
  const open = saved.open.filter((session) => names.has(session.loop));
  const history = saved.history.filter((entry) => names.has(entry.loop)).slice(0, SHOWN);
  if (open.length === 0 && history.length === 0) return null;

  return (
    <section
      aria-labelledby="mock-history-heading"
      className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <p className="eyebrow text-ink-faint">Kept in this browser</p>
        <h2 id="mock-history-heading" className="text-title">
          Your mocks
        </h2>
      </div>

      {open.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-heading">Under way</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {open.map((session) => (
              <li
                key={`${session.loop}:${session.seed}`}
                className="border-line bg-sunken rounded-input flex flex-col gap-1 border p-4"
              >
                <p className="font-semibold">{names.get(session.loop)}</p>
                <p className="text-small text-ink-soft">{where(session)}</p>
                <Link
                  href={hrefFor(session.loop, session.seed)}
                  className="text-small text-brand-deep inline-flex min-h-11 w-fit items-center font-semibold hover:underline md:min-h-0 md:py-1"
                >
                  Resume →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-heading">Recent scorecards</h3>
          <ul className="divide-line flex flex-col divide-y">
            {history.map((entry) => (
              <li
                key={`${entry.loop}:${entry.seed}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
              >
                <Link
                  href={hrefFor(entry.loop, entry.seed)}
                  className="inline-flex min-h-11 min-w-0 flex-1 basis-48 items-center font-semibold hover:underline"
                >
                  {names.get(entry.loop)}
                </Link>
                <span className="text-small text-ink-faint whitespace-nowrap">
                  {WHEN.format(entry.finishedAt)}
                </span>
                <span
                  className={cn(
                    'rounded-pill text-small px-2.5 py-0.5 font-semibold whitespace-nowrap',
                    TONE[toneOf(entry.verdict)],
                  )}
                >
                  {entry.verdict}
                </span>
                <span className="font-display w-12 text-right font-semibold">
                  {percent(entry.score)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
