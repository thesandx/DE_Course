import type { Metadata } from 'next';
import Link from 'next/link';

import { AppShell } from '@/components/layout/AppShell';
import { MockHistory } from '@/components/mock/MockHistory';
import { buttonStyles } from '@/components/ui/Button';
import { loopMinutes, MOCK_LOOPS, type MockLoop } from '@/lib/course/mock';
import { formatMinutes } from '@/lib/course/mock-score';
import { requireDeLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Timed mock loops',
  description:
    'Run a whole data engineering interview loop against the clock: timed rounds, runnable editors, model answers, and a hiring verdict at the end.',
};

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    title: 'Briefing',
    text: 'See the rounds and their clocks. The questions stay hidden until their round starts.',
  },
  {
    title: 'Rounds on the clock',
    text: 'Each round has its own timer. Code runs in the editor against hidden tests.',
  },
  {
    title: 'Review',
    text: 'After each round, read the model answers and tick the senior signals you covered.',
  },
  {
    title: 'Scorecard',
    text: 'A hiring verdict, the score of each round, and the tracks to study next.',
  },
] as const;

function questionCount(loop: MockLoop): number {
  return loop.rounds.reduce((sum, round) => sum + round.slots.length, 0);
}

function LoopCard({ loop }: { loop: MockLoop }) {
  const questions = questionCount(loop);
  return (
    <li className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-heading">{loop.name}</h3>
        <p className="text-micro text-ink-faint font-mono">
          {loop.rounds.length} rounds · {questions} questions · {formatMinutes(loopMinutes(loop))}
        </p>
      </div>
      <p className="text-small text-ink-soft">{loop.summary}</p>
      <ol className="flex flex-wrap gap-1.5" aria-label={`Rounds of the ${loop.name}`}>
        {loop.rounds.map((round, index) => (
          <li
            key={round.name}
            className="border-line rounded-pill text-micro text-ink-soft border px-2.5 py-1 font-semibold"
          >
            {index + 1}. {round.name}
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-wrap items-center gap-x-5">
        <Link
          href={`/de/mock/${loop.slug}`}
          className="text-small text-brand-deep inline-flex min-h-11 items-center font-semibold hover:underline"
        >
          Start this loop →
        </Link>
        {loop.company !== undefined ? (
          <Link
            href={`/de/companies/${loop.company}`}
            className="text-small text-ink-soft hover:text-ink inline-flex min-h-11 items-center font-semibold hover:underline"
          >
            Read the guide
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/** The mock loops: the general loops, one per company, and this browser's mocks. */
export default async function MockLoopsPage() {
  const { shell } = await requireDeLearner('/de/mock');
  const general = MOCK_LOOPS.filter((loop) => loop.company === undefined);
  const companies = MOCK_LOOPS.filter((loop) => loop.company !== undefined);

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8 md:py-8">
        <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-col gap-3">
            <p className="eyebrow text-on-night-soft">Practice under the clock</p>
            <h1 className="text-display">Timed mock loops</h1>
            <p className="text-body text-on-night-soft max-w-2xl">
              Run a whole interview loop in one sitting. Each round has its own clock, the code runs
              against hidden tests, and the debrief gives the verdict a hiring committee would
              reach.
            </p>
          </div>
          <dl className="border-night-line grid max-w-lg grid-cols-3 gap-4 border-t pt-4">
            <div className="flex flex-col gap-0.5">
              <dt className="eyebrow text-on-night-soft">Loops</dt>
              <dd className="font-display text-heading font-semibold">{MOCK_LOOPS.length}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="eyebrow text-on-night-soft">Companies</dt>
              <dd className="font-display text-heading font-semibold">{companies.length}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="eyebrow text-on-night-soft">Shortest</dt>
              <dd className="font-display text-heading font-semibold">
                {formatMinutes(Math.min(...MOCK_LOOPS.map(loopMinutes)))}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/de/mock/senior" className={buttonStyles({ variant: 'primary' })}>
              Start the senior loop
            </Link>
            <Link href="/de/mock/quick" className={buttonStyles({ variant: 'night' })}>
              Try the one-hour loop
            </Link>
          </div>
        </header>

        <MockHistory loops={MOCK_LOOPS.map((loop) => ({ slug: loop.slug, name: loop.name }))} />

        <section aria-labelledby="how-heading" className="flex flex-col gap-4">
          <h2 id="how-heading" className="text-title">
            How a mock runs
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="bg-surface border-line rounded-card flex flex-col gap-2 border p-4"
              >
                <span
                  aria-hidden="true"
                  className="bg-ink text-on-ink text-small rounded-box inline-grid size-8 place-items-center font-mono font-semibold"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-heading">{step.title}</h3>
                <p className="text-small text-ink-soft">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="general-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="general-heading" className="text-title">
              General loops
            </h2>
            <p className="text-body text-ink-soft max-w-2xl">
              The usual shapes of a senior and a staff loop, and a short loop for a busy day.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {general.map((loop) => (
              <LoopCard key={loop.slug} loop={loop} />
            ))}
          </ul>
        </section>

        <section aria-labelledby="company-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="company-heading" className="text-title">
              Company loops
            </h2>
            <p className="text-body text-ink-soft max-w-2xl">
              Each one asks what that company&apos;s rounds ask, at the length of its real rounds.
              The recruiter screens are left out.
            </p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((loop) => (
              <LoopCard key={loop.slug} loop={loop} />
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
