import Link from 'next/link';

import { ProgressRing } from '@/components/course/ProgressRing';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { average, formatClock, percent, type Verdict } from '@/lib/course/mock-score';
import { elapsedMs, type MockSession } from '@/lib/course/mock-session';
import { cn } from '@/lib/utils';
import type { MockLoopView, MockRoundView } from '@/types/mock';

export interface MockScorecardProps {
  loop: MockLoopView;
  rounds: readonly MockRoundView[];
  session: MockSession;
  scores: readonly number[];
  verdict: Verdict;
  /** The clock limit of each round, in ms, at the pace of this run. */
  limits: readonly number[];
  onRetry: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}

/** A round below this goes on the study list. */
const STUDY_BELOW = 0.7;

const RING_TONE = { easy: 'easy', medium: 'gold', hard: 'brand' } as const;

/**
 * The debrief: the verdict a hiring committee would reach from these rounds,
 * the score of each round, and what to study next. The study list names the
 * tracks behind the weak rounds and the questions to try again.
 */
export function MockScorecard({
  loop,
  rounds,
  session,
  scores,
  verdict,
  limits,
  onRetry,
  headingRef,
}: MockScorecardProps) {
  const overall = average(scores);
  const weak = rounds.flatMap((round, index) =>
    (scores[index] ?? 0) < STUDY_BELOW ? [{ round, index }] : [],
  );
  const tracks = new Map<string, string>();
  for (const { round } of weak) {
    for (const question of round.questions) tracks.set(question.track.slug, question.track.title);
  }
  const hints = session.rounds.reduce(
    (sum, round) => sum + round.problems.reduce((count, problem) => count + problem.hints, 0),
    0,
  );
  const pauses = session.rounds.reduce((sum, round) => sum + round.pauses, 0);
  const timedOut = session.rounds.filter((round) => round.timedOut).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
      <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="eyebrow text-on-night-soft">Debrief: {loop.name}</p>
          <h1 ref={headingRef} tabIndex={-1} className="text-display outline-none">
            {verdict.label}
          </h1>
          <p className="text-body text-on-night-soft max-w-2xl">{verdict.reason}</p>
          <dl className="border-night-line grid max-w-md grid-cols-3 gap-4 border-t pt-4">
            <div className="flex flex-col gap-0.5">
              <dt className="eyebrow text-on-night-soft">Hints</dt>
              <dd className="font-display text-heading font-semibold">{hints}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="eyebrow text-on-night-soft">Pauses</dt>
              <dd className="font-display text-heading font-semibold">{pauses}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="eyebrow text-on-night-soft">Out of time</dt>
              <dd className="font-display text-heading font-semibold">{timedOut}</dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 items-center gap-4 md:flex-col md:gap-3">
          <ProgressRing
            ratio={overall}
            label="Loop score"
            size={112}
            thickness={10}
            tone={RING_TONE[verdict.tone]}
            surface="night"
          >
            <span className="text-title">{percent(overall)}</span>
          </ProgressRing>
          <p className="text-small text-on-night-soft max-w-48 md:text-center">
            The average of {rounds.length === 1 ? 'the round' : `${rounds.length} rounds`}. A very
            weak round can still cap the verdict.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <section
          aria-labelledby="by-round-heading"
          className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-5 sm:p-6 lg:col-span-3"
        >
          <h2 id="by-round-heading" className="text-title">
            Round by round
          </h2>
          <ol className="flex flex-col gap-5">
            {rounds.map((round, index) => {
              const record = session.rounds[index];
              const limit = limits[index] ?? 0;
              const used =
                record === undefined ? 0 : Math.min(elapsedMs(record, record.endedAt ?? 0), limit);
              return (
                <li key={round.name} className="flex flex-col gap-2">
                  <Progress
                    label={`${index + 1}. ${round.name}`}
                    value={Math.round((scores[index] ?? 0) * 100)}
                    valueText={percent(scores[index] ?? 0)}
                  />
                  <p className="text-small text-ink-faint">
                    {record?.timedOut === true
                      ? `Ran out of time at ${formatClock(limit)}.`
                      : `Used ${formatClock(used)} of ${formatClock(limit)}.`}{' '}
                    {round.questions.map((question) => question.title).join('; ')}.
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="study-heading"
          className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6 lg:col-span-2"
        >
          <h2 id="study-heading" className="text-title">
            Study next
          </h2>
          {weak.length === 0 ? (
            <p className="text-body text-ink-soft">
              Every round scored {percent(STUDY_BELOW)} or more. Try a harder loop next: the staff
              loop, or a company you have not run yet.
            </p>
          ) : (
            <>
              <p className="text-body text-ink-soft">
                {weak.length === 1 ? 'One round' : `${weak.length} rounds`} scored under{' '}
                {percent(STUDY_BELOW)}. These tracks teach what they asked:
              </p>
              <ul className="flex flex-wrap gap-2">
                {[...tracks].map(([slug, title]) => (
                  <li key={slug}>
                    <Link
                      href={`/de/tracks/${slug}`}
                      className="border-line bg-surface hover:border-line-strong rounded-pill text-small inline-flex min-h-11 items-center border px-3 font-medium transition-colors"
                    >
                      {title}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-small text-ink-soft">Then solve the questions again, untimed:</p>
              <ul className="flex flex-col gap-1">
                {weak.flatMap(({ round }) =>
                  round.questions.map((question) => (
                    <li key={question.slug}>
                      <Link
                        href={`/de/problems/${question.slug}`}
                        className="text-small text-brand-deep inline-flex min-h-11 items-center font-semibold hover:underline md:min-h-0 md:py-1"
                      >
                        {question.title} →
                      </Link>
                    </li>
                  )),
                )}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href={`/de/mock/${loop.slug}`} className={buttonStyles({ variant: 'primary' })}>
          Run a new {loop.slug === 'quick' ? 'practice loop' : 'loop'}
        </Link>
        <Button variant="secondary" onClick={onRetry}>
          Retry these questions
        </Button>
        <Link
          href="/de/mock"
          className={cn(buttonStyles({ variant: 'quiet' }), 'self-start sm:self-center')}
        >
          All mock loops
        </Link>
      </div>
    </main>
  );
}
