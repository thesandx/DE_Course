import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DifficultyTag } from '@/components/course/DifficultyTag';
import { ProblemWorkspace } from '@/components/course/ProblemWorkspace';
import { Prose } from '@/components/course/Prose';
import { AppBar } from '@/components/layout/AppBar';
import { Chip } from '@/components/ui/Chip';
import { COMPANY_NAMES, getProblem, getTrack, KIND_LABELS } from '@/lib/course/catalog';
import { PROBLEM_XP, problemId } from '@/lib/course/progress';
import { requireLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const problem = getProblem((await params).slug);
  return problem === undefined
    ? { title: 'Problem not found', description: 'This problem does not exist.' }
    : {
        title: problem.title,
        description: `A ${problem.difficulty} ${KIND_LABELS[problem.kind]} interview problem with hints and a model answer.`,
      };
}

export const dynamic = 'force-dynamic';

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (problem === undefined) notFound();

  const { progress } = await requireLearner(`/problems/${slug}`);
  const track = getTrack(problem.track);
  const itemId = problemId(slug);

  return (
    <>
      <AppBar
        title={problem.title}
        back={{ fallbackHref: '/problems', label: 'Back to problems' }}
      />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-2 lg:items-start lg:gap-12">
        <section
          aria-labelledby="prompt-heading"
          className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24"
        >
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyTag difficulty={problem.difficulty} />
            <Chip>{KIND_LABELS[problem.kind]}</Chip>
            {problem.companies.map((company) => (
              <Chip key={company}>Asked at {COMPANY_NAMES[company]}</Chip>
            ))}
          </div>
          <h2 id="prompt-heading" className="text-title">
            The question
          </h2>
          <Prose source={problem.prompt} />
          {track !== undefined ? (
            <p className="text-small text-ink-soft">
              From the track{' '}
              <Link href={`/tracks/${track.slug}`} className="font-bold underline">
                {track.title}
              </Link>
              .
            </p>
          ) : null}
        </section>
        <ProblemWorkspace
          slug={slug}
          itemId={itemId}
          done={progress.done[itemId] !== undefined}
          xp={PROBLEM_XP[problem.difficulty]}
          hints={problem.hints}
          signals={problem.signals}
          followUps={problem.followUps}
          answer={<Prose source={problem.answer} />}
        />
      </main>
    </>
  );
}
