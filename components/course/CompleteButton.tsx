'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Face } from '@/components/ui/Face';
import { Speech } from '@/components/ui/Speech';

export interface CompleteButtonProps {
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
  className?: string;
}

/** The learner's local day, so a late-night study session counts for today. */
function localDay(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * Marks a lesson or problem finished and plays the win moment: the XP pops
 * in, the mascot reacts, and the page refreshes so every count on it updates.
 * The server decides the XP; the number here is only what the button promises.
 */
export function CompleteButton({
  itemId,
  done,
  xp,
  label,
  doneLabel,
  blockedReason,
  className,
}: CompleteButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextDone: boolean): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, done: nextDone, day: localDay() }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401) {
        setError('Your session ended. Sign in again to save progress.');
        return;
      }
      if (!response.ok) {
        setError('Progress was not saved. Check your connection and try again.');
        return;
      }
      setWon(nextDone);
      router.refresh();
    } catch {
      setError('Progress was not saved. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      {won ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="bg-brand-soft border-line animate-pop inline-grid size-16 shrink-0 place-items-center rounded-full border-2">
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
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            onClick={() => void save(true)}
            disabled={busy || blockedReason !== undefined}
            className="w-full sm:w-auto"
          >
            {busy ? 'Saving' : `${label} for ${xp} XP`}
          </Button>
          {blockedReason !== undefined ? (
            <p className="text-small text-ink-soft">{blockedReason}</p>
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
