'use client';

import Link from 'next/link';
import { useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Face } from '@/components/ui/Face';
import { Progress } from '@/components/ui/Progress';
import { outcomeMessage, useRecordProgress } from '@/hooks/useRecordProgress';
import { isChoiceCorrect, mockExam, passes, shuffle, shuffleChoices } from '@/lib/course/gcp/quiz';
import { cn } from '@/lib/utils';
import type { BankQuestion, GcpLine } from '@/types/gcp';

import { ChoiceList, type ChoiceState } from './ChoiceList';

/** The questions of one line, with what the result screen needs to name it. */
export interface QuizGroup {
  line: Pick<GcpLine, 'slug' | 'short' | 'weight'>;
  questions: readonly BankQuestion[];
}

export interface QuizRunProps {
  /** `boss`: one line, a boss to beat. `mock`: every line, weighted like the exam. */
  mode: 'boss' | 'mock';
  title: string;
  /** The story line on the start screen. */
  story: string;
  groups: readonly QuizGroup[];
  count: number;
  passRatio: number;
  itemId: string;
  xp: number;
  /** True when the learner already passed: they can replay, but earn nothing new. */
  done: boolean;
  /** Where "Back" goes on the result screen. */
  backHref: string;
  backLabel: string;
}

interface Answered {
  question: BankQuestion;
  line: string;
  correct: boolean;
}

/**
 * A boss round or the mock exam. The learner answers one question at a time,
 * checks it, reads why, and moves on. In a boss round each right answer takes
 * a hit off the boss; the boss falls at the pass mark. Passing records the
 * item once, which is where the XP comes from.
 *
 * The questions are drawn when the learner presses Start, in the browser, so
 * the server render and the first client render agree.
 */
export function QuizRun({
  mode,
  title,
  story,
  groups,
  count,
  passRatio,
  itemId,
  xp,
  done,
  backHref,
  backLabel,
}: QuizRunProps) {
  const [questions, setQuestions] = useState<Array<{ question: BankQuestion; line: string }>>([]);
  const [position, setPosition] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [saved, setSaved] = useState<'idle' | 'saved' | string>('idle');
  // Whether the XP was banked before this run. `done` turns true as soon as a
  // pass saves and the page refreshes, so the result screen reads this instead.
  const [bankedBefore, setBankedBefore] = useState(done);
  const { record, busy } = useRecordProgress('gcp');

  const total = questions.length;
  const needed = Math.ceil(count * passRatio);
  const correctSoFar = answered.filter((item) => item.correct).length;
  const finished = total > 0 && answered.length === total;
  const current = questions[position];

  function start(): void {
    const lineOf = new Map<BankQuestion, string>();
    for (const group of groups) for (const q of group.questions) lineOf.set(q, group.line.slug);
    const drawn =
      mode === 'mock'
        ? mockExam(
            groups.map((group) => group.line),
            (slug) => groups.find((group) => group.line.slug === slug)?.questions ?? [],
            count,
            Math.random,
          )
        : shuffle(
            groups.flatMap((group) => group.questions),
            Math.random,
          ).slice(0, count);
    setQuestions(
      drawn.map((question) => ({
        question: shuffleChoices(question, Math.random),
        line: lineOf.get(question) ?? '',
      })),
    );
    setBankedBefore(done);
    setPosition(0);
    setPicked([]);
    setChecked(false);
    setAnswered([]);
    setSaved('idle');
  }

  async function finish(results: Answered[]): Promise<void> {
    const score = results.filter((item) => item.correct).length;
    if (bankedBefore || !passes(score, results.length, passRatio)) return;
    const outcome = await record(itemId, true);
    setSaved(outcome === 'saved' ? 'saved' : (outcomeMessage(outcome) ?? 'failed'));
  }

  function check(): void {
    if (current === undefined) return;
    setChecked(true);
    const results = [
      ...answered,
      {
        question: current.question,
        line: current.line,
        correct: isChoiceCorrect(picked, current.question.answers),
      },
    ];
    setAnswered(results);
    if (results.length === total) void finish(results);
  }

  function next(): void {
    setPosition(position + 1);
    setPicked([]);
    setChecked(false);
  }

  // ── Start screen ────────────────────────────────────────────────────────
  if (total === 0) {
    return (
      <section className="bg-night-glow rounded-sheet text-on-night shadow-raised flex flex-col gap-5 p-6 md:p-8">
        <p className="eyebrow text-on-night-soft">{mode === 'boss' ? 'Boss round' : 'Mock exam'}</p>
        <h1 className="text-display">{title}</h1>
        <p className="text-lead text-on-night-soft max-w-2xl">{story}</p>
        <ul className="flex flex-wrap gap-2">
          {[
            `${count} questions`,
            `Pass at ${Math.round(passRatio * 100)}%`,
            done ? 'Already beaten · replay for practice' : `+${xp} XP for a pass`,
          ].map((fact) => (
            <li
              key={fact}
              className="border-night-line bg-night-raised rounded-pill text-small border px-3 py-1 font-semibold"
            >
              {fact}
            </li>
          ))}
        </ul>
        <div>
          <Button size="lg" onClick={start}>
            {mode === 'boss' ? 'Start the boss round' : 'Start the mock exam'}
          </Button>
        </div>
      </section>
    );
  }

  // ── Result screen ───────────────────────────────────────────────────────
  if (finished) {
    const score = correctSoFar;
    const passed = passes(score, total, passRatio);
    const byLine = groups.map((group) => {
      const items = answered.filter((item) => item.line === group.line.slug);
      return { group, right: items.filter((item) => item.correct).length, of: items.length };
    });
    const missed = answered.filter((item) => !item.correct);
    return (
      <div className="flex flex-col gap-5">
        <section
          className={cn(
            'rounded-sheet shadow-raised flex flex-col items-start gap-4 p-6 md:p-8',
            passed ? 'bg-night-glow text-on-night' : 'bg-surface border-line border',
          )}
        >
          <span className="bg-brand-soft border-line animate-pop inline-grid size-16 place-items-center rounded-full border">
            <Face mood={passed ? 'wow' : 'happy'} size={48} />
          </span>
          <p className={cn('eyebrow', passed ? 'text-on-night-soft' : 'text-ink-faint')}>
            {passed ? (mode === 'boss' ? 'Boss defeated' : 'Mock exam passed') : 'Not this time'}
          </p>
          <h2 className="text-display">
            {score} / {total}
          </h2>
          <p className={cn('text-body max-w-xl', passed ? 'text-on-night-soft' : 'text-ink-soft')}>
            {passed
              ? bankedBefore
                ? 'Another clean run. You had already banked the XP for this one.'
                : `You cleared the ${Math.round(passRatio * 100)}% bar.`
              : `You need ${needed} right to pass. Read the misses below, then go again: each run draws new questions.`}
          </p>
          {passed && !bankedBefore && saved === 'saved' && (
            <p className="text-key font-display animate-pop">+{xp} XP</p>
          )}
          {busy && <p className="text-small">Saving</p>}
          {saved !== 'idle' && saved !== 'saved' && (
            <Alert tone="danger" title="Not saved">
              {saved}
            </Alert>
          )}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant={passed ? 'night' : 'primary'} onClick={start}>
              Play again
            </Button>
            <Link
              href={backHref}
              className={buttonStyles({ size: 'lg', variant: passed ? 'primary' : 'secondary' })}
            >
              {backLabel}
            </Link>
          </div>
        </section>

        {mode === 'mock' && (
          <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6">
            <h3 className="text-heading">Score by domain</h3>
            <ul className="flex flex-col gap-3">
              {byLine.map(({ group, right, of }) => (
                <li key={group.line.slug}>
                  <Progress
                    value={of === 0 ? 0 : (right / of) * 100}
                    label={group.line.short}
                    valueText={`${right} of ${of}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {missed.length > 0 && (
          <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6">
            <h3 className="text-heading">Review your misses</h3>
            <ol className="flex flex-col gap-5">
              {missed.map(({ question }) => (
                <li key={question.prompt} className="flex flex-col gap-2">
                  <p className="text-body font-semibold">
                    <InlineText text={question.prompt} />
                  </p>
                  <p className="text-small text-easy">
                    Answer:{' '}
                    {question.answers.map((answer) => (
                      <span key={answer} className="block">
                        <InlineText text={question.options[answer] ?? ''} />
                      </span>
                    ))}
                  </p>
                  <p className="text-small text-ink-soft bg-sunken rounded-input p-3">
                    <InlineText text={question.why} />
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    );
  }

  // ── A question ──────────────────────────────────────────────────────────
  if (current === undefined) return null;
  const { question } = current;
  const multi = question.answers.length > 1;
  const isRight = checked && isChoiceCorrect(picked, question.answers);
  const bossLeft = Math.max(needed - correctSoFar, 0);

  function stateOf(index: number): ChoiceState {
    const chosen = picked.includes(index);
    const answer = question.answers.includes(index);
    if (!checked) return chosen ? 'selected' : 'idle';
    if (chosen) return answer ? 'right' : 'wrong';
    return answer ? 'answer' : 'muted';
  }

  function choose(index: number): void {
    if (checked) return;
    if (multi) {
      setPicked(
        picked.includes(index)
          ? picked.filter((value) => value !== index)
          : picked.length < question.answers.length
            ? [...picked, index]
            : picked,
      );
    } else {
      setPicked([index]);
    }
  }

  return (
    <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-5 sm:p-6">
      <div className="flex flex-col gap-3">
        <p className="text-small text-ink-soft font-mono">
          Question {position + 1} of {total}
        </p>
        {mode === 'boss' ? (
          <Progress
            label="Boss health"
            value={needed === 0 ? 0 : (bossLeft / needed) * 100}
            valueText={bossLeft === 0 ? 'Defeated' : `${bossLeft} hits left`}
          />
        ) : (
          <Progress
            label="Exam progress"
            value={((position + 1) / total) * 100}
            valueText={`${correctSoFar} right so far`}
          />
        )}
      </div>

      <p className="text-heading">
        <InlineText text={question.prompt} />
      </p>
      {multi && <p className="eyebrow text-brand-deep">Choose {question.answers.length}</p>}

      <ChoiceList
        options={question.options}
        state={stateOf}
        onChoose={choose}
        lettered
        wobble={checked && !isRight}
      />

      {checked && (
        <div className="flex flex-col gap-2">
          <p className={cn('text-body font-semibold', isRight ? 'text-easy' : 'text-hard')}>
            {isRight ? (mode === 'boss' ? 'Hit! Correct.' : 'Correct.') : 'Not quite.'}
          </p>
          <p className="text-small text-ink-soft bg-sunken rounded-input animate-rise-in p-3">
            <InlineText text={question.why} />
          </p>
        </div>
      )}

      <div className="flex justify-end">
        {!checked ? (
          <Button
            size="lg"
            className="w-full sm:w-auto"
            disabled={picked.length !== question.answers.length}
            onClick={check}
          >
            Check answer
          </Button>
        ) : position < total - 1 ? (
          <Button size="lg" variant="dark" className="w-full sm:w-auto" onClick={next}>
            Next question
          </Button>
        ) : null}
      </div>
    </section>
  );
}
