import 'server-only';

import { z } from 'zod';

import { isKnownItem } from '@/lib/course/catalog';
import {
  applyCompletion,
  EMPTY_PROGRESS,
  MAX_DAYS_KEPT,
  type ProgressRecord,
} from '@/lib/course/progress';
import { logger } from '@/lib/logger';
import type { SessionUser } from '@/services/auth.service';
import { createRepository, DocumentAlreadyExistsError } from '@/services/repository';

/**
 * Course progress — `progress/{uid}`, one document per learner.
 *
 * ## Why one document and two maps
 *
 * Every course page needs the learner's whole record: the home dashboard
 * shows totals, a track shows each lesson's state, and the problem list shows
 * a tick per row. One document makes that one key lookup per page.
 *
 * The maps are bounded, which is what makes them safe in one document:
 *
 *   - `done` has one key per lesson or problem, and the API accepts only ids
 *     that exist in the catalogue (`isKnownItem`). Its size is capped by the
 *     course itself: a few hundred keys, well under the 1 MiB document limit.
 *   - `days` has one key per active day, trimmed to the newest
 *     `MAX_DAYS_KEPT` on every write.
 *
 * A learner writes about once per finished item, far below Firestore's one
 * write per second per document. Nothing queries inside the maps, so
 * `firestore.indexes.json` exempts both fields from indexing.
 *
 * XP, levels and streaks are not stored. They are derived from this record
 * and the catalogue in `lib/course/`, so a change to the XP table applies to
 * everyone at once and can never disagree with what the learner finished.
 *
 * The id is the Firebase uid, for the same reason as `users/{uid}`; see
 * `services/user.service.ts`.
 */

export const PROGRESS_COLLECTION = 'progress';

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const progressSchema = z.object({
  done: z.record(z.string().max(160), daySchema),
  days: z
    .record(daySchema, z.number().int().min(0).max(10_000))
    .refine((days) => Object.keys(days).length <= MAX_DAYS_KEPT, 'too many days'),
});

export type ProgressPayload = z.infer<typeof progressSchema>;

export const progress = createRepository({
  collection: PROGRESS_COLLECTION,
  schema: progressSchema,
});

/** Thrown when a client names a lesson or problem the catalogue does not have. */
export class UnknownCourseItemError extends Error {
  constructor(itemId: string) {
    super(`Unknown course item: ${itemId}`);
    this.name = 'UnknownCourseItemError';
  }
}

/** The learner's record, or an empty one before their first finished item. One key lookup. */
export async function getProgress(uid: string): Promise<ProgressRecord> {
  const document = await progress.get(uid);
  return document === null ? EMPTY_PROGRESS : { done: document.done, days: document.days };
}

/**
 * Marks one lesson or problem as finished or not finished for the caller.
 *
 * Runs in a transaction, because a learner can finish two items from two tabs
 * at once, and a plain read-modify-write would drop one of them.
 */
export async function recordCompletion(
  user: SessionUser,
  itemId: string,
  done: boolean,
  day: string,
): Promise<ProgressRecord> {
  if (!isKnownItem(itemId)) throw new UnknownCourseItemError(itemId);

  const write = (): Promise<ProgressRecord> =>
    progress.runTransaction(async (repo) => {
      const existing = await repo.get(user.uid);
      const before: ProgressRecord =
        existing === null ? EMPTY_PROGRESS : { done: existing.done, days: existing.days };
      const after = applyCompletion(before, itemId, done, day);

      if (existing === null) {
        if (after !== before)
          repo.createWithId(user.uid, { done: { ...after.done }, days: { ...after.days } });
      } else if (after !== before) {
        repo.update(user.uid, { done: { ...after.done }, days: { ...after.days } });
      }
      return after;
    });

  try {
    const result = await write();
    logger.info('Course progress recorded', { uid: user.uid, itemId, done });
    return result;
  } catch (error) {
    // Two first writes raced to create the document. It exists now, so the
    // retry takes the update path inside a fresh transaction.
    if (!(error instanceof DocumentAlreadyExistsError)) throw error;
    return write();
  }
}
