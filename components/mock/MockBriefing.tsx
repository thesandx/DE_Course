import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { formatMinutes } from '@/lib/course/mock-score';
import { type Pace, PACES } from '@/lib/course/mock-session';
import type { MockLoopView, MockRoundView } from '@/types/mock';

export interface MockBriefingProps {
  loop: MockLoopView;
  rounds: readonly MockRoundView[];
  pace: Pace;
  onPace: (pace: Pace) => void;
  onStart: () => void;
  /** Focus moves here when the screen opens. */
  headingRef: React.Ref<HTMLHeadingElement>;
}

const PACE_LABELS: Readonly<Record<Pace, string>> = {
  1: 'Interview pace',
  1.5: 'Extra time',
};

const RULES = [
  'Each round has its own clock. When it runs out, the round ends.',
  'Hints are there, but each one costs a tenth of that question’s score.',
  'Code runs in the editor and must pass its tests, hidden ones included.',
  'The model answers open after each round, when you score yourself.',
  'You can pause, which a real loop cannot. The scorecard counts the pauses.',
  'Your work stays in this browser, so a refresh keeps your place. The clock runs on while you are away, unless you pause it.',
] as const;

/**
 * The plan of a mock loop before the clock starts: the rounds, how long each
 * runs, what it asks, and the rules. The questions stay hidden until their
 * round, as in a real loop.
 */
export function MockBriefing({
  loop,
  rounds,
  pace,
  onPace,
  onStart,
  headingRef,
}: MockBriefingProps) {
  const minutes = rounds.reduce((sum, round) => sum + round.minutes, 0);
  const questions = rounds.reduce((sum, round) => sum + round.questions.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
      <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="eyebrow text-on-night-soft">Timed mock loop</p>
          <h1 ref={headingRef} tabIndex={-1} className="text-display outline-none">
            {loop.name}
          </h1>
          <p className="text-body text-on-night-soft max-w-2xl">{loop.summary}</p>
        </div>
        <dl className="border-night-line grid max-w-lg grid-cols-3 gap-4 border-t pt-4">
          <div className="flex flex-col gap-0.5">
            <dt className="eyebrow text-on-night-soft">Rounds</dt>
            <dd className="font-display text-heading font-semibold">{rounds.length}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="eyebrow text-on-night-soft">Questions</dt>
            <dd className="font-display text-heading font-semibold">{questions}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="eyebrow text-on-night-soft">Clock</dt>
            <dd className="font-display text-heading font-semibold">
              {formatMinutes(minutes * pace)}
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <section aria-labelledby="plan-heading" className="flex flex-col gap-3 lg:col-span-3">
          <h2 id="plan-heading" className="text-title">
            The rounds
          </h2>
          <ol className="flex flex-col gap-3">
            {rounds.map((round, index) => (
              <li
                key={round.name}
                className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-heading flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="bg-ink text-on-ink text-small rounded-box inline-grid size-8 shrink-0 place-items-center font-semibold"
                    >
                      {index + 1}
                    </span>
                    {round.name}
                  </h3>
                  <span className="text-small text-ink-soft">
                    {formatMinutes(round.minutes * pace)}
                  </span>
                </div>
                <div className="text-small text-ink-soft">{round.focus}</div>
                <ul className="flex flex-wrap gap-2" aria-label="What the round asks">
                  {round.questions.map((question, at) => (
                    <li
                      key={question.slug}
                      className="border-line rounded-pill text-micro text-ink-soft border px-2.5 py-1 font-semibold"
                    >
                      Question {at + 1}: {question.kindLabel}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <aside
          aria-labelledby="start-heading"
          className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-5 sm:p-6 lg:sticky lg:top-24 lg:col-span-2"
        >
          <h2 id="start-heading" className="text-title">
            Before you start
          </h2>
          <RadioGroup
            label="Pace"
            name="pace"
            value={String(pace)}
            onChange={(value) => onPace(value === '1.5' ? 1.5 : 1)}
            options={PACES.map((option) => ({
              value: String(option),
              label: PACE_LABELS[option],
              hint:
                option === 1
                  ? `The real clock: ${formatMinutes(minutes)} in all.`
                  : `Half as long again: ${formatMinutes(minutes * option)}. Good for a first loop.`,
            }))}
          />
          <ul className="text-small text-ink-soft flex list-disc flex-col gap-1.5 pl-5">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <Button variant="primary" block onClick={onStart}>
            Start round 1
          </Button>
          {loop.guideHref !== undefined ? (
            <Link
              href={loop.guideHref}
              className="text-small text-brand-deep inline-flex min-h-11 w-fit items-center font-semibold hover:underline"
            >
              Read the loop guide first →
            </Link>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
