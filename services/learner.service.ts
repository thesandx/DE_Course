import 'server-only';

import { redirect } from 'next/navigation';

import { isoDay, type ProgressRecord } from '@/lib/course/progress';
import { type LearnerSummary, summarize } from '@/lib/course/summary';
import { getCurrentUser, type SessionUser } from '@/services/auth.service';
import { getProgress } from '@/services/progress.service';

export interface Learner {
  user: SessionUser;
  /** The name the shell and the dashboard greet. */
  name: string;
  progress: ProgressRecord;
  /** XP, level, streaks and recent items, derived once for the page. */
  summary: LearnerSummary;
  /** `YYYY-MM-DD`, the day the summary was derived for. */
  today: string;
}

/** The learner, for a signed-in user. Shared by `requireLearner` and the home page. */
export async function loadLearner(user: SessionUser): Promise<Learner> {
  const progress = await getProgress(user.uid);
  const today = isoDay(new Date());
  return {
    user,
    name: user.displayName ?? 'Learner',
    progress,
    summary: summarize(progress, today),
    today,
  };
}

/**
 * The signed-in learner and their progress, for a course page.
 *
 * The course is for signed-in learners only, so a signed-out visitor goes to
 * sign-in and comes back to `returnTo` afterwards. Call it first in the page,
 * outside any Suspense boundary, so the redirect is a real 307 and not a
 * client-side jump after a spinner (see the note in `app/profile/page.tsx`).
 */
export async function requireLearner(returnTo: string): Promise<Learner> {
  const user = await getCurrentUser();
  if (user === null) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return loadLearner(user);
}
