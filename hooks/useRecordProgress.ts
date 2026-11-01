'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import type { CourseSlug } from '@/lib/course/courses';

export type RecordOutcome = 'saved' | 'signed-out' | 'failed';

/** The learner's local day, so a late-night study session counts for today. */
export function localDay(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** The message to show for an outcome that did not save, or null when it saved. */
export function outcomeMessage(outcome: RecordOutcome): string | null {
  if (outcome === 'signed-out') return 'Your session ended. Sign in again to save progress.';
  if (outcome === 'failed') return 'Progress was not saved. Check your connection and try again.';
  return null;
}

/**
 * Saves one finished (or un-finished) item to a course's tracker through
 * `POST /api/progress`, then refreshes the page so every count on it updates.
 * The server checks the id and decides the XP.
 */
export function useRecordProgress(course: CourseSlug) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const record = useCallback(
    async (itemId: string, done: boolean): Promise<RecordOutcome> => {
      setBusy(true);
      try {
        const response = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ course, itemId, done, day: localDay() }),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status === 401) return 'signed-out';
        if (!response.ok) return 'failed';
        router.refresh();
        return 'saved';
      } catch {
        return 'failed';
      } finally {
        setBusy(false);
      }
    },
    [course, router],
  );

  return { record, busy };
}
