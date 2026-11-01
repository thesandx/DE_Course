'use client';

import { useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { cn } from '@/lib/utils';
import type { QuickCheck } from '@/types/course';

export interface QuickChecksProps {
  checks: readonly QuickCheck[];
  /** Called with true once every question has a correct answer. */
  onAllCorrect?: (allCorrect: boolean) => void;
  /** Called with the number of questions answered correctly so far. */
  onSolvedChange?: (solved: number) => void;
  className?: string;
}

/**
 * The questions at the end of a lesson. A wrong pick wobbles and stays
 * marked, so the learner can try again; the explanation shows after any
 * attempt. State is never colour alone: each answer says "Correct" or
 * "Not quite" in words.
 */
export function QuickChecks({ checks, onAllCorrect, onSolvedChange, className }: QuickChecksProps) {
  const [picked, setPicked] = useState<Record<number, number[]>>({});

  function choose(question: number, option: number): void {
    const before = picked[question] ?? [];
    if (before.includes(option) || before.includes(checks[question]?.answer ?? -1)) return;
    const next = { ...picked, [question]: [...before, option] };
    setPicked(next);
    const solvedCount = checks.filter((check, index) =>
      (next[index] ?? []).includes(check.answer),
    ).length;
    onAllCorrect?.(solvedCount === checks.length);
    onSolvedChange?.(solvedCount);
  }

  return (
    <ol className={cn('flex flex-col gap-7', className)}>
      {checks.map((check, questionIndex) => {
        const tries = picked[questionIndex] ?? [];
        const solved = tries.includes(check.answer);
        const lastWrong = tries.length > 0 && !solved;
        return (
          <li key={questionIndex} className="flex flex-col gap-3">
            <p className="text-heading flex gap-2">
              <span className="text-ink-faint font-mono" aria-hidden="true">
                {questionIndex + 1}.
              </span>
              <span className="sr-only">Question {questionIndex + 1}: </span>
              <span>
                <InlineText text={check.question} />
              </span>
            </p>
            <ul className={cn('flex flex-col gap-2', lastWrong && 'animate-wobble')}>
              {check.options.map((option, optionIndex) => {
                const chosen = tries.includes(optionIndex);
                const correct = optionIndex === check.answer;
                return (
                  <li key={optionIndex}>
                    <button
                      type="button"
                      onClick={() => choose(questionIndex, optionIndex)}
                      aria-pressed={chosen}
                      disabled={solved && !chosen}
                      className={cn(
                        'rounded-input text-body flex min-h-12 w-full items-center gap-3 border px-4 py-2.5 text-left transition-colors',
                        !chosen && 'bg-surface border-line hover:border-line-strong',
                        chosen && correct && 'bg-easy-soft border-easy-bar',
                        chosen && !correct && 'bg-hard-soft border-hard-bar',
                        solved && !chosen && 'opacity-60',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'rounded-dot inline-grid size-5 shrink-0 place-items-center border',
                          !chosen && 'border-line-strong bg-surface',
                          chosen && correct && 'bg-easy-bar border-easy-bar',
                          chosen && !correct && 'bg-hard-bar border-hard-bar',
                        )}
                      >
                        {chosen ? (
                          <svg
                            viewBox="0 0 24 24"
                            className="stroke-on-night animate-check size-3.5"
                            fill="none"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d={correct ? 'M6 12.5l4 4 8-9' : 'M7 7l10 10M17 7L7 17'} />
                          </svg>
                        ) : null}
                      </span>
                      <span className="grow">
                        <InlineText text={option} />
                      </span>
                      {chosen ? (
                        <span
                          className={cn(
                            'text-small shrink-0 font-semibold',
                            correct ? 'text-easy' : 'text-hard',
                          )}
                        >
                          {correct ? 'Correct' : 'Not quite'}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {tries.length > 0 ? (
              <p className="text-small text-ink-soft bg-sunken rounded-input animate-rise-in p-3">
                <InlineText text={check.why} />
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
