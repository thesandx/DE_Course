import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DifficultyTag } from '@/components/course/DifficultyTag';
import { ProblemWorkspace } from '@/components/course/ProblemWorkspace';
import { Prose } from '@/components/course/Prose';
import { AppShell } from '@/components/layout/AppShell';
import { COMPANY_NAMES, getProblem, getTrack, KIND_LABELS } from '@/lib/course/catalog';
import { PROBLEM_XP, problemId } from '@/lib/course/progress';
import { requireDeLearner } from '@/services/learner.service';
import type { Company } from '@/types/course';

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

/** "Loops: Google, Amazon +4". Nine chips would fill a phone screen. */
function loopsLabel(companies: readonly Company[]): string {
  const names = companies.slice(0, 2).map((company) => COMPANY_NAMES[company]);
  const more = companies.length - names.length;
  return `Loops: ${names.join(', ')}${more > 0 ? ` +${more}` : ''}`;
}

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (problem === undefined) notFound();

  const { progress, shell } = await requireDeLearner(`/de/problems/${slug}`);
  const track = getTrack(problem.track);
  const itemId = problemId(slug);

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'DE course', href: '/de' },
        { label: 'Problems', href: '/de/problems' },
        { label: problem.title },
      ]}
      back={{ fallbackHref: '/de/problems', label: 'Back to problems' }}
    >
      <main className="flex w-full flex-col">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-8 md:py-8 lg:grid-cols-2 lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
            <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyTag difficulty={problem.difficulty} />
                <span className="border-night-line rounded-pill text-micro text-on-night-soft border px-2.5 py-1 font-semibold">
                  {KIND_LABELS[problem.kind]}
                </span>
                <span className="border-night-line rounded-pill text-micro text-on-night-soft border px-2.5 py-1 font-semibold">
                  {loopsLabel(problem.companies)}
                </span>
              </div>
              <h1 className="text-display">{problem.title}</h1>
              <dl className="border-night-line grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
                <div className="flex flex-col gap-0.5">
                  <dt className="eyebrow text-on-night-soft">Reward</dt>
                  <dd className="font-display text-heading font-semibold">
                    +{PROBLEM_XP[problem.difficulty]} XP
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="eyebrow text-on-night-soft">Hints</dt>
                  <dd className="font-display text-heading font-semibold">
                    {problem.hints.length}
                  </dd>
                </div>
                {track !== undefined ? (
                  <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-1">
                    <dt className="eyebrow text-on-night-soft">Track</dt>
                    <dd className="text-small font-semibold">
                      <Link href={`/de/tracks/${track.slug}`} className="hover:underline">
                        {track.title}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </header>
            <section
              aria-labelledby="prompt-heading"
              className="bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-4 border border-l-4 border-l-brand p-5 sm:p-6"
            >
              <h2 id="prompt-heading" className="text-title">
                The question
              </h2>
              <Prose source={problem.prompt} />
            </section>
          </div>
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
        </div>
      </main>
    </AppShell>
  );
}
