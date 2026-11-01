'use client';

import { useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { cn } from '@/lib/utils';
import type { QuickCheck } from '@/types/course';

export interface QuickChecksProps {
  checks: readonly QuickCheck[];
  /** Called with true once every question has a correct answer. */
  onAllCorrect?: (allCorrect: boolean) => void;
  className?: string;
}

/**
 * The questions at the end of a lesson. A wrong pick wobbles and stays
 * marked, so the learner can try again; the explanation shows after any
 * attempt. State is never colour alone: each answer says "Correct" or
 * "Not quite" in words.
 */
export function QuickChecks({ checks, onAllCorrect, className }: QuickChecksProps) {
  const [picked, setPicked] = useState<Record<number, number[]>>({});

  function choose(question: number, option: number): void {
    const before = picked[question] ?? [];
    if (before.includes(option) || before.includes(checks[question]?.answer ?? -1)) return;
    const next = { ...picked, [question]: [...before, option] };
    setPicked(next);
    const allCorrect = checks.every((check, index) => (next[index] ?? []).includes(check.answer));
    onAllCorrect?.(allCorrect);
  }

  return (
    <ol className={cn('flex flex-col gap-6', className)}>
      {checks.map((check, questionIndex) => {
        const tries = picked[questionIndex] ?? [];
        const solved = tries.includes(check.answer);
        const lastWrong = tries.length > 0 && !solved;
        return (
          <li key={questionIndex} className="flex flex-col gap-3">
            <p className="font-bold">
              <span className="sr-only">Question {questionIndex + 1}: </span>
              <InlineText text={check.question} />
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
                        'border-line rounded-input flex min-h-12 w-full items-center gap-3 border-2 px-4 py-2 text-left',
                        'squish',
                        !chosen && 'bg-surface',
                        chosen && correct && 'bg-success',
                        chosen && !correct && 'bg-peach',
                        solved && !chosen && 'opacity-60',
                      )}
                    >
                      <span className="grow">
                        <InlineText text={option} />
                      </span>
                      {chosen ? (
                        <span className="text-small shrink-0 font-bold">
                          {correct ? 'Correct' : 'Not quite'}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {tries.length > 0 ? (
              <p className="text-small text-ink-soft animate-rise-in max-w-prose">
                <InlineText text={check.why} />
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
