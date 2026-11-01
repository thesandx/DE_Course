import 'server-only';

import { redirect } from 'next/navigation';

import type { ProgressRecord } from '@/lib/course/progress';
import { getCurrentUser, type SessionUser } from '@/services/auth.service';
import { getProgress } from '@/services/progress.service';

export interface Learner {
  user: SessionUser;
  progress: ProgressRecord;
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
  return { user, progress: await getProgress(user.uid) };
}
