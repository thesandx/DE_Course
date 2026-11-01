import 'server-only';

import { redirect } from 'next/navigation';

import { COURSE_SLUGS, type CourseSlug } from '@/lib/course/courses';
import { type GcpSummary, summarizeGcp } from '@/lib/course/gcp/summary';
import {
  courseRecord,
  isEnrolled,
  isoDay,
  type LearnerRecord,
  type ProgressRecord,
} from '@/lib/course/progress';
import { deShellStats, gcpShellStats, type ShellStats } from '@/lib/course/shell-stats';
import { type LearnerSummary, summarize } from '@/lib/course/summary';
import { getCurrentUser, type SessionUser } from '@/services/auth.service';
import { getLearnerRecord } from '@/services/progress.service';

/** What `AppShell` needs: who is signed in, which courses they joined, and the course on screen. */
export interface ShellContext {
  learnerName: string;
  enrolled: readonly CourseSlug[];
  /** The course the page belongs to. Absent on the hub and the profile. */
  course?: CourseSlug;
  /** The course's streak and XP for the top bar. Absent outside a course. */
  stats?: ShellStats;
}

export interface Learner {
  user: SessionUser;
  /** The name the shell and the dashboard greet. */
  name: string;
  record: LearnerRecord;
  enrolled: CourseSlug[];
  /** `YYYY-MM-DD`, the day the summaries were derived for. */
  today: string;
  /** The shell for a page outside any course. */
  shell: ShellContext;
}

export interface CourseLearner<TSummary> extends Learner {
  course: CourseSlug;
  /** True when the learner joined the course. */
  joined: boolean;
  /** The course's tracker. */
  progress: ProgressRecord;
  summary: TSummary;
}

/** The learner, for a signed-in user. Shared by every signed-in page. */
export async function loadLearner(user: SessionUser): Promise<Learner> {
  const record = await getLearnerRecord(user.uid);
  const name = user.displayName ?? 'Learner';
  const enrolled = COURSE_SLUGS.filter((slug) => isEnrolled(record, slug));
  return {
    user,
    name,
    record,
    enrolled,
    today: isoDay(new Date()),
    shell: { learnerName: name, enrolled },
  };
}

/**
 * The signed-in learner, for a page that needs a session.
 *
 * Every course page is for signed-in learners only, so a signed-out visitor
 * goes to sign-in and comes back to `returnTo` afterwards. Call it first in
 * the page, outside any Suspense boundary, so the redirect is a real 307 and
 * not a client-side jump after a spinner (see the note in
 * `app/profile/page.tsx`).
 */
export async function requireLearner(returnTo: string): Promise<Learner> {
  const user = await getCurrentUser();
  if (user === null) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return loadLearner(user);
}

interface CourseOptions {
  /** True on the course's own home page, which shows the "join" screen to a learner not in it. */
  allowUnenrolled?: boolean;
}

function courseLearner<TSummary>(
  learner: Learner,
  course: CourseSlug,
  options: CourseOptions,
  derive: (progress: ProgressRecord, today: string) => { summary: TSummary; stats: ShellStats },
): CourseLearner<TSummary> {
  const joined = isEnrolled(learner.record, course);
  // A page inside a course is for its learners. The course home shows the
  // join screen, so a learner who follows a deep link lands one tap from it.
  if (!joined && options.allowUnenrolled !== true) redirect(`/${course}`);
  const progress = courseRecord(learner.record, course);
  const { summary, stats } = derive(progress, learner.today);
  return {
    ...learner,
    course,
    joined,
    progress,
    summary,
    // A learner not in the course has no tracker to show in the shell yet.
    shell: joined ? { ...learner.shell, course, stats } : { ...learner.shell, course },
  };
}

/** The signed-in DE learner, their DE tracker and the DE summary. */
export async function requireDeLearner(
  returnTo: string,
  options: CourseOptions = {},
): Promise<CourseLearner<LearnerSummary>> {
  return courseLearner(await requireLearner(returnTo), 'de', options, (progress, today) => {
    const summary = summarize(progress, today);
    return { summary, stats: deShellStats(summary) };
  });
}

/** The signed-in GCP learner, their GCP tracker and the GCP summary. */
export async function requireGcpLearner(
  returnTo: string,
  options: CourseOptions = {},
): Promise<CourseLearner<GcpSummary>> {
  return courseLearner(await requireLearner(returnTo), 'gcp', options, (progress, today) => {
    const summary = summarizeGcp(progress, today);
    return { summary, stats: gcpShellStats(summary) };
  });
}
