import type { Metadata } from 'next';

import { ProblemTable } from '@/components/course/ProblemTable';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { getTrack, KIND_LABELS, PROBLEMS, TRACKS } from '@/lib/course/catalog';
import { problemId } from '@/lib/course/progress';
import { requireLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Problems',
  description:
    'Every interview problem in the course, filterable by track, difficulty and company.',
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function ProblemsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.slice(0, 80) ?? '';
  const { name, progress, summary } = await requireLearner('/problems');
  const solved = PROBLEMS.filter((problem) => progress.done[problemId(problem.slug)] !== undefined);

  return (
    <AppShell learnerName={name} summary={summary}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading
          eyebrow="Practice"
          title="Problems"
          end={
            <p className="bg-surface border-line rounded-pill text-small inline-flex min-h-10 items-center gap-2 border px-4">
              <span className="bg-easy-bar size-2 rounded-full" aria-hidden="true" />
              <b>{solved.length}</b> of {PROBLEMS.length} solved
            </p>
          }
        >
          Each problem is a question as an interviewer asks it, with hints, a model answer and the
          signals a senior answer covers.
        </PageHeading>
        <ProblemTable
          key={query}
          initialQuery={query}
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
    </AppShell>
  );
}
