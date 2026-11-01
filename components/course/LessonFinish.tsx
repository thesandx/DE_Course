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
}

/**
 * The end of a lesson: the quick checks, then the finish button. The button
 * waits until every check has a correct answer, so finishing a lesson means
 * the learner showed they got it, not only that they scrolled.
 */
export function LessonFinish({ itemId, checks, done, xp }: LessonFinishProps) {
  const [allCorrect, setAllCorrect] = useState(checks.length === 0);

  return (
    <div className="flex flex-col gap-8">
      {checks.length > 0 ? (
        <section aria-labelledby="checks-heading" className="flex flex-col gap-4">
          <h2 id="checks-heading" className="text-title">
            Check yourself
          </h2>
          <QuickChecks checks={checks} onAllCorrect={setAllCorrect} />
        </section>
      ) : null}
      <CompleteButton
        itemId={itemId}
        done={done}
        xp={xp}
        label="Finish lesson"
        doneLabel="Lesson finished"
        {...(!allCorrect && !done
          ? { blockedReason: 'Answer every question correctly to finish the lesson.' }
          : {})}
      />
    </div>
  );
}
