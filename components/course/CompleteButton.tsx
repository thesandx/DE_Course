'use client';

import { useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Face } from '@/components/ui/Face';
import { Speech } from '@/components/ui/Speech';
import { outcomeMessage, useRecordProgress } from '@/hooks/useRecordProgress';
import type { CourseSlug } from '@/lib/course/courses';

export interface CompleteButtonProps {
  /** The course whose tracker the item belongs to. */
  course: CourseSlug;
  /** The catalogue id, e.g. `lesson:sql:window-functions` or `problem:latest-trip-status`. */
  itemId: string;
  /** True when the learner already finished the item. */
  done: boolean;
  /** XP the item is worth, shown on the button and in the win moment. */
  xp: number;
  /** Button label before the item is finished, e.g. "Finish lesson". */
  label: string;
  /** What the learner did, for the success message, e.g. "Lesson finished". */
  doneLabel: string;
  /** Disables the button until the learner meets a condition, with the reason shown. */
  blockedReason?: string;
  /** A second, quieter action before the button, such as a link to the previous lesson. */
  secondary?: React.ReactNode;
  className?: string;
}

/**
 * Marks a lesson or problem finished and plays the win moment: the XP pops
 * in, the mascot reacts, and the page refreshes so every count on it updates.
 * The server decides the XP; the number here is only what the button promises.
 */
export function CompleteButton({
  course,
  itemId,
  done,
  xp,
  label,
  doneLabel,
  blockedReason,
  secondary,
  className,
}: CompleteButtonProps) {
  const { record, busy } = useRecordProgress(course);
  const [won, setWon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextDone: boolean): Promise<void> {
    setError(null);
    const outcome = await record(itemId, nextDone);
    setError(outcomeMessage(outcome));
    if (outcome === 'saved') setWon(nextDone);
  }

  return (
    <div className={className}>
      {won ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="bg-brand-soft border-line animate-pop inline-grid size-16 shrink-0 place-items-center rounded-full border">
              <Face mood="wow" size={48} />
            </span>
            <p className="text-key font-display animate-pop">+{xp} XP</p>
          </div>
          <Speech mood="wow">Nice. That one counts toward your streak.</Speech>
          <Alert tone="success" title={`${doneLabel}.`} />
        </div>
      ) : done ? (
        <div className="flex flex-wrap items-center gap-3">
          <Alert tone="success" title={`${doneLabel}.`} className="grow" />
          <Button variant="quiet" onClick={() => void save(false)} disabled={busy}>
            {busy ? 'Saving' : 'Mark as not done'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {secondary ?? <span />}
            <Button
              size="lg"
              onClick={() => void save(true)}
              disabled={busy || blockedReason !== undefined}
              className="w-full sm:w-auto"
            >
              {busy ? 'Saving' : `${label} · +${xp} XP`}
            </Button>
          </div>
          {blockedReason !== undefined ? (
            <p className="text-small text-ink-soft sm:text-right">{blockedReason}</p>
          ) : null}
        </div>
      )}
      {error !== null ? (
        <Alert tone="danger" title="Not saved" className="mt-4">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
