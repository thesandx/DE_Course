import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { Prose } from '@/components/course/Prose';
import { AppShell } from '@/components/layout/AppShell';
import { MockRunner } from '@/components/mock/MockRunner';
import { getTrack, KIND_LABELS } from '@/lib/course/catalog';
import {
  chooseSeed,
  getMockLoop,
  loopMinutes,
  parseSeed,
  planMock,
  randomSeeds,
} from '@/lib/course/mock';
import { formatMinutes } from '@/lib/course/mock-score';
import { problemId } from '@/lib/course/progress';
import { getRunnable } from '@/lib/course/runnables';
import { specHash } from '@/lib/runner/data';
import { requireDeLearner } from '@/services/learner.service';
import type { Problem } from '@/types/course';
import type { MockQuestionView, MockRoundView } from '@/types/mock';

interface Props {
  params: Promise<{ loop: string }>;
  searchParams: Promise<{ seed?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loop = getMockLoop((await params).loop);
  return loop === undefined
    ? { title: 'Mock loop not found', description: 'There is no mock loop with this name.' }
    : {
        title: `${loop.name}: timed mock`,
        description: `A timed mock of the ${loop.name}: ${loop.rounds.length} rounds in ${formatMinutes(loopMinutes(loop))}, with runnable editors, model answers and a hiring verdict.`,
      };
}

export const dynamic = 'force-dynamic';

/** How many random seeds the page tries, to find a loop of mostly unsolved problems. */
const CANDIDATES = 16;

/** One question as the mock screen needs it, with its course text rendered here. */
function questionView(problem: Problem): MockQuestionView {
  const runnable = getRunnable(problem.slug);
  return {
    slug: problem.slug,
    title: problem.title,
    kindLabel: KIND_LABELS[problem.kind],
    difficulty: problem.difficulty,
    track: { slug: problem.track, title: getTrack(problem.track)?.title ?? problem.track },
    prompt: <Prose source={problem.prompt} />,
    answer: <Prose source={problem.answer} />,
    hints: problem.hints,
    signals: problem.signals,
    followUps: problem.followUps,
    ...(runnable !== undefined
      ? {
          runner: {
            spec: runnable,
            runKey: `${problem.slug}:${specHash(runnable)}`,
            task: <Prose source={runnable.task} />,
          },
        }
      : {}),
  };
}

/**
 * One timed mock loop. The `seed` in the URL picks the questions, so a refresh
 * or a link back from the hub opens the same loop. Without a seed, the page
 * picks one whose questions the learner has mostly not solved, and redirects
 * to it.
 */
export default async function MockLoopPage({ params, searchParams }: Props) {
  const { loop: slug } = await params;
  const loop = getMockLoop(slug);
  if (loop === undefined) notFound();

  const { progress, shell } = await requireDeLearner(`/de/mock/${slug}`);
  const seed = parseSeed((await searchParams).seed);
  if (seed === null) {
    const fresh = chooseSeed(
      loop,
      randomSeeds(CANDIDATES),
      (problem) => progress.done[problemId(problem)] !== undefined,
    );
    redirect(`/de/mock/${slug}?seed=${fresh}`);
  }

  const rounds: MockRoundView[] = planMock(loop, seed).map(({ round, problems }) => ({
    name: round.name,
    minutes: round.minutes,
    focus: <Prose source={round.focus} />,
    questions: problems.map(questionView),
  }));

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'DE course', href: '/de' },
        { label: 'Mock loops', href: '/de/mock' },
        { label: loop.name },
      ]}
      back={{ fallbackHref: '/de/mock', label: 'Back to mock loops' }}
    >
      <MockRunner
        loop={{
          slug: loop.slug,
          name: loop.name,
          summary: loop.summary,
          ...(loop.company !== undefined ? { guideHref: `/de/companies/${loop.company}` } : {}),
        }}
        seed={seed}
        rounds={rounds}
      />
    </AppShell>
  );
}
