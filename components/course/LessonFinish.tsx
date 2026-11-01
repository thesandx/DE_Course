'use client';

import { useState } from 'react';

import { CompleteButton } from '@/components/course/CompleteButton';
import { QuickChecks } from '@/components/course/QuickChecks';
import type { QuickCheck } from '@/types/course';

export interface LessonFinishProps {
  itemId: string;
  checks: readonly QuickCheck[];
  done: boolean;
  xp: number;
  /** A link back to the previous lesson, shown beside the finish button. */
  previous?: React.ReactNode;
}

/**
 * The end of a lesson: the "Check yourself" card, then the finish card. The
 * button waits until every check has a correct answer, so finishing a lesson
 * means the learner showed they got it, not only that they scrolled.
 */
export function LessonFinish({ itemId, checks, done, xp, previous }: LessonFinishProps) {
  const [solved, setSolved] = useState(0);
  const allCorrect = solved === checks.length;

  return (
    <div className="flex flex-col gap-4">
      {checks.length > 0 ? (
        <section
          aria-labelledby="checks-heading"
          className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="bg-brand-soft text-brand-deep rounded-pill eyebrow w-fit px-2.5 py-1">
                Check yourself
              </span>
              <h2 id="checks-heading" className="text-title">
                Did it land?
              </h2>
            </div>
            <p className="text-small text-ink-faint font-mono" aria-live="polite">
              {solved} of {checks.length} · no penalty for trying
            </p>
          </div>
          <QuickChecks checks={checks} onSolvedChange={setSolved} />
        </section>
      ) : null}

      <section
        aria-label="Finish the lesson"
        className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6"
      >
        <CompleteButton
          course="de"
          itemId={itemId}
          done={done}
          xp={xp}
          label="Finish lesson"
          doneLabel="Lesson finished"
          {...(previous !== undefined ? { secondary: previous } : {})}
          {...(!allCorrect && !done
            ? { blockedReason: 'Answer every question correctly to finish the lesson.' }
            : {})}
        />
      </section>
    </div>
  );
}
