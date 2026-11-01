import type { Metadata } from 'next';

import { ProblemTable } from '@/components/course/ProblemTable';
import { AppBar } from '@/components/layout/AppBar';
import { getTrack, KIND_LABELS, PROBLEMS, TRACKS } from '@/lib/course/catalog';
import { problemId } from '@/lib/course/progress';
import { requireLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Problems',
  description:
    'Every interview problem in the course, filterable by track, difficulty and company.',
};

export const dynamic = 'force-dynamic';

export default async function ProblemsPage() {
  const { progress } = await requireLearner('/problems');
  const solved = PROBLEMS.filter((problem) => progress.done[problemId(problem.slug)] !== undefined);

  return (
    <>
      <AppBar title="Problems" />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10">
        <p className="text-ink-soft max-w-prose">
          You have solved {solved.length} of {PROBLEMS.length}. Each problem is a question as an
          interviewer asks it, with hints, a model answer and the signals a senior answer covers.
        </p>
        <ProblemTable
          tracks={TRACKS.map((track) => ({ slug: track.slug, title: track.title }))}
          rows={PROBLEMS.map((problem) => ({
            slug: problem.slug,
            title: problem.title,
            trackSlug: problem.track,
            trackTitle: getTrack(problem.track)?.title ?? problem.track,
            kindLabel: KIND_LABELS[problem.kind],
            difficulty: problem.difficulty,
            companies: problem.companies,
            done: progress.done[problemId(problem.slug)] !== undefined,
          }))}
        />
      </main>
    </>
  );
}
