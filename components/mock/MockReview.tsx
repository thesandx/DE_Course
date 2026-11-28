'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { DifficultyTag } from '@/components/course/DifficultyTag';
import { InlineText } from '@/components/course/InlineText';
import { ProgressRing } from '@/components/course/ProgressRing';
import { codeKeyFor, draftKeyFor } from '@/components/mock/MockQuestion';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { formatClock, percent, problemScore } from '@/lib/course/mock-score';
import { elapsedMs, type RoundRecord } from '@/lib/course/mock-session';
import type { MockQuestionView, MockRoundView } from '@/types/mock';

export interface MockReviewProps {
  index: number;
  total: number;
  round: MockRoundView;
  record: RoundRecord;
  roundScore: number;
  limitMs: number;
  storageKey: string;
  onCover: (question: number, signal: number, covered: boolean) => void;
  onNext: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}

/** What the learner wrote in the round: the code or the draft, read back from this browser. */
function useWritten(storageKey: string, question: MockQuestionView): string | null {
  const [written, setWritten] = useState<string | null>(null);
  useEffect(() => {
    const key =
      question.runner !== undefined
        ? codeKeyFor(storageKey, question.slug)
        : draftKeyFor(storageKey, question.slug);
    try {
      // Reading browser storage is only possible after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the round's work once, on mount
      setWritten(window.localStorage.getItem(key));
    } catch {
      // Storage can be blocked. The review then shows no copy of the work.
      setWritten(null);
    }
  }, [storageKey, question]);
  return written;
}

function QuestionReview({
  question,
  number,
  record,
  storageKey,
  onCover,
}: {
  question: MockQuestionView;
  number: number;
  record: RoundRecord['problems'][number] | undefined;
  storageKey: string;
  onCover: (signal: number, covered: boolean) => void;
}) {
  const written = useWritten(storageKey, question);
  const covered = new Set(record?.covered ?? []);
  const hints = record?.hints ?? 0;
  const tests = record?.tests ?? null;
  const score = problemScore(
    { signals: question.signals.length, runnable: question.runner !== undefined },
    { hints, tests, covered: record?.covered ?? [] },
  );

  return (
    <article
      aria-labelledby={`review-${question.slug}`}
      className="bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-5 border p-5 sm:p-6"
    >
      <header className="flex flex-col gap-3">
        <p className="eyebrow text-ink-faint">Question {number}</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id={`review-${question.slug}`} className="text-title min-w-0">
            <Link href={`/de/problems/${question.slug}`} className="hover:underline">
              {question.title}
            </Link>
          </h2>
          <span className="font-display text-title font-semibold">{percent(score)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-line rounded-pill text-micro text-ink-soft border px-2.5 py-1 font-semibold">
            {question.kindLabel}
          </span>
          <DifficultyTag difficulty={question.difficulty} />
          {question.runner !== undefined ? (
            <span className="border-line rounded-pill text-micro text-ink-soft border px-2.5 py-1 font-semibold">
              {tests === null ? 'Not submitted' : `Tests: ${tests.passed} of ${tests.total} passed`}
            </span>
          ) : null}
          <span className="border-line rounded-pill text-micro text-ink-soft border px-2.5 py-1 font-semibold">
            {hints === 0 ? 'No hints' : hints === 1 ? '1 hint' : `${hints} hints`}
          </span>
        </div>
      </header>

      {written !== null && written.trim() !== '' ? (
        <details className="group">
          <summary className="text-body hover:text-ink text-ink-soft min-h-11 cursor-pointer py-2 font-semibold">
            Your {question.runner !== undefined ? 'code' : 'answer'}
          </summary>
          {question.runner !== undefined ? (
            <CodeBlock code={written} lang={question.runner.spec.language} className="mt-2" />
          ) : (
            <p className="bg-sunken rounded-input text-body mt-2 px-4 py-3 break-words whitespace-pre-wrap">
              {written}
            </p>
          )}
        </details>
      ) : null}

      <section aria-label="Model answer" className="flex flex-col gap-3">
        <h3 className="text-heading">Model answer</h3>
        {question.answer}
      </section>

      <div className="bg-night-glow rounded-card text-on-night flex flex-col gap-4 p-5">
        <p className="eyebrow text-gold">Senior signal</p>
        <h3 className="text-heading">Score yourself</h3>
        <p className="text-small text-on-night-soft">
          Tick each one that your answer covered without a hint. {covered.size} of{' '}
          {question.signals.length} ticked.
        </p>
        <ul className="flex flex-col gap-3">
          {question.signals.map((signal, at) => (
            <li key={at}>
              <Checkbox
                label={signal}
                checked={covered.has(at)}
                onChange={(event) => onCover(at, event.target.checked)}
              />
            </li>
          ))}
        </ul>
      </div>

      {question.followUps.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-heading">Follow-ups to rehearse</h3>
          <ul className="text-ink-soft flex max-w-prose list-disc flex-col gap-2 pl-6">
            {question.followUps.map((followUp, at) => (
              <li key={at}>
                <InlineText text={followUp} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

/**
 * The end of a round: each question's title, the learner's work, the model
 * answer and the senior signals to tick. The round's score updates with each
 * tick. One button goes on to the next round, or to the scorecard.
 */
export function MockReview({
  index,
  total,
  round,
  record,
  roundScore,
  limitMs,
  storageKey,
  onCover,
  onNext,
  headingRef,
}: MockReviewProps) {
  const used = Math.min(elapsedMs(record, record.endedAt ?? 0), limitMs);
  const last = index + 1 >= total;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
      <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="eyebrow text-on-night-soft">
            Review of round {index + 1} of {total}
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="text-display outline-none">
            {round.name}
          </h1>
          <p className="text-body text-on-night-soft max-w-2xl">
            {record.timedOut
              ? 'The clock ran out. '
              : `You ended it after ${formatClock(used)} of ${formatClock(limitMs)}. `}
            Read each model answer, then tick the signals your answer covered.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 md:flex-col md:gap-3">
          <ProgressRing
            ratio={roundScore}
            label={`Round ${index + 1} score`}
            size={104}
            thickness={9}
            tone="gold"
            surface="night"
          >
            <span className="text-title">{percent(roundScore)}</span>
          </ProgressRing>
          <p className="text-small text-on-night-soft max-w-48 md:text-center">
            The round&apos;s score. It rises with each signal you tick.
          </p>
        </div>
      </header>

      {round.questions.map((question, at) => (
        <QuestionReview
          key={question.slug}
          question={question}
          number={at + 1}
          record={record.problems[at]}
          storageKey={storageKey}
          onCover={(signal, covered) => onCover(at, signal, covered)}
        />
      ))}

      <div className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-body text-ink-soft">
          {last
            ? 'That was the last round. The scorecard gives the verdict.'
            : `Next: round ${index + 2} of ${total}. Its clock starts when you press the button.`}
        </p>
        <Button variant="primary" onClick={onNext} className="shrink-0">
          {last ? 'See the scorecard' : `Start round ${index + 2}`}
        </Button>
      </div>
    </main>
  );
}
