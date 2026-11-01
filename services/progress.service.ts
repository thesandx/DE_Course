import 'server-only';

import { z } from 'zod';

import { COURSE_SLUGS, type CourseSlug } from '@/lib/course/courses';
import {
  applyCourseCompletion,
  applyEnrollment,
  EMPTY_LEARNER,
  type LearnerRecord,
  MAX_DAYS_KEPT,
  type ProgressRecord,
} from '@/lib/course/progress';
import { COURSE_RULES } from '@/lib/course/rules';
import { logger } from '@/lib/logger';
import type { SessionUser } from '@/services/auth.service';
import { createRepository, DocumentAlreadyExistsError } from '@/services/repository';

/**
 * Course enrollment and progress — `learners/{uid}`, one document per learner.
 *
 * ## Why one document for every course
 *
 * Every signed-in page needs the learner's enrollments (the hub, the tab bar,
 * the gate on each course page) and the tracker of the course it shows. One
 * document makes that one key lookup per page, as ADR-0006 decided for a
 * single course. ADR-0008 extends it to many courses.
 *
 * The document holds two maps, keyed by course slug:
 *
 *   - `enrolled`: course → the day the learner joined it.
 *   - `courses`: course → that course's tracker, `{ done, days }`.
 *
 * Each tracker is bounded the same way as before: `done` holds only ids that
 * exist in that course's catalogue (`COURSE_RULES`), and `days` keeps the
 * newest `MAX_DAYS_KEPT` days. The number of courses is fixed by
 * `COURSE_SLUGS`. So the document stays far below the 1 MiB limit: a few
 * hundred keys per course.
 *
 * Nothing queries inside the maps, so `firestore.indexes.json` exempts both.
 *
 * ## The single-course document
 *
 * Before the platform had several courses, progress lived in `progress/{uid}`
 * as one `{ done, days }` record for the DE course. That collection is read,
 * never written: a learner with no `learners` document but an old `progress`
 * document is treated as enrolled in the DE course with that record. Their
 * first write copies it into `learners/{uid}`.
 */

export const LEARNERS_COLLECTION = 'learners';

/** The single-course collection. Read once per learner for the move, never written. */
export const LEGACY_PROGRESS_COLLECTION = 'progress';

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const courseSchema = z.enum(COURSE_SLUGS);

export const progressSchema = z.object({
  done: z.record(z.string().max(160), daySchema),
  days: z
    .record(daySchema, z.number().int().min(0).max(10_000))
    .refine((days) => Object.keys(days).length <= MAX_DAYS_KEPT, 'too many days'),
});

export const learnerSchema = z.object({
  enrolled: z.partialRecord(courseSchema, daySchema),
  courses: z.partialRecord(courseSchema, progressSchema),
});

export type LearnerPayload = z.infer<typeof learnerSchema>;

export const learners = createRepository({
  collection: LEARNERS_COLLECTION,
  schema: learnerSchema,
});

const legacyProgress = createRepository({
  collection: LEGACY_PROGRESS_COLLECTION,
  schema: progressSchema,
});

/** Thrown when a client names an item the course's catalogue does not have. */
export class UnknownCourseItemError extends Error {
  constructor(course: CourseSlug, itemId: string) {
    super(`Unknown item in course ${course}: ${itemId}`);
    this.name = 'UnknownCourseItemError';
  }
}

function toRecord(document: LearnerPayload): LearnerRecord {
  return { enrolled: document.enrolled, courses: document.courses };
}

function toPayload(record: LearnerRecord): LearnerPayload {
  const courses: LearnerPayload['courses'] = {};
  for (const [slug, tracker] of Object.entries(record.courses) as Array<
    [CourseSlug, ProgressRecord | undefined]
  >) {
    if (tracker !== undefined)
      courses[slug] = { done: { ...tracker.done }, days: { ...tracker.days } };
  }
  return { enrolled: { ...record.enrolled }, courses };
}

/** The DE record from the single-course document, as a learner record. */
async function legacyRecord(uid: string): Promise<LearnerRecord> {
  const old = await legacyProgress.get(uid);
  if (old === null || Object.keys(old.done).length === 0) return EMPTY_LEARNER;
  const firstDay = Object.values(old.done).sort()[0] ?? Object.keys(old.days).sort()[0];
  if (firstDay === undefined) return EMPTY_LEARNER;
  return { enrolled: { de: firstDay }, courses: { de: { done: old.done, days: old.days } } };
}

/** The learner's enrollments and trackers. One key lookup, two for a learner not yet moved. */
export async function getLearnerRecord(uid: string): Promise<LearnerRecord> {
  const document = await learners.get(uid);
  return document === null ? legacyRecord(uid) : toRecord(document);
}

/**
 * Writes `change(before)` for the caller in a transaction. A learner can act
 * from two tabs at once, and a plain read-modify-write would drop one change.
 */
async function writeLearner(
  user: SessionUser,
  change: (before: LearnerRecord) => LearnerRecord,
): Promise<LearnerRecord> {
  // Read outside the transaction: the old collection is never written, so it
  // cannot change under us.
  const seed = await legacyRecord(user.uid);

  const write = (): Promise<LearnerRecord> =>
    learners.runTransaction(async (repo) => {
      const existing = await repo.get(user.uid);
      const before = existing === null ? seed : toRecord(existing);
      const after = change(before);
      if (existing === null) {
        if (after !== EMPTY_LEARNER) repo.createWithId(user.uid, toPayload(after));
      } else if (after !== before) {
        repo.update(user.uid, toPayload(after));
      }
      return after;
    });

  try {
    return await write();
  } catch (error) {
    // Two first writes raced to create the document. It exists now, so the
    // retry takes the update path inside a fresh transaction.
    if (!(error instanceof DocumentAlreadyExistsError)) throw error;
    return write();
  }
}

/** Joins a course. Joining twice keeps the first day. */
export async function enroll(
  user: SessionUser,
  course: CourseSlug,
  day: string,
): Promise<LearnerRecord> {
  const result = await writeLearner(user, (before) => applyEnrollment(before, course, day));
  logger.info('Course enrollment recorded', { uid: user.uid, course });
  return result;
}

/** Marks one item of one course finished or not finished for the caller. */
export async function recordCompletion(
  user: SessionUser,
  course: CourseSlug,
  itemId: string,
  done: boolean,
  day: string,
): Promise<LearnerRecord> {
  if (!COURSE_RULES[course].isKnownItem(itemId)) throw new UnknownCourseItemError(course, itemId);
  const result = await writeLearner(user, (before) =>
    applyCourseCompletion(before, course, itemId, done, day),
  );
  logger.info('Course progress recorded', { uid: user.uid, course, itemId, done });
  return result;
}
