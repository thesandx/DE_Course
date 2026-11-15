'use client';

import { useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { ChoiceList } from '@/components/gcp/ChoiceList';
import { seededRandom, shuffleChoices } from '@/lib/course/gcp/quiz';
import type { ChoiceQuestion } from '@/types/gcp';

export interface PredictProps {
  question: ChoiceQuestion;
  /** What the step shows once the learner has predicted: the commands and the output. */
  children: React.ReactNode;
}

/**
 * "Predict first": the learner says what a command will do before they run
 * it. One pick only, then the answer and the reason show, and the rest of the
 * step opens. A wrong guess costs nothing: the point is to commit to a guess.
 */
export function Predict({ question: source, children }: PredictProps) {
  // The content lists the right option first. A seeded shuffle moves it, and
  // gives the server and the browser the same order.
  const question = shuffleChoices(source, seededRandom(source.prompt));
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked !== null && question.answers.includes(picked);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-brand-soft/60 border-line rounded-input flex flex-col gap-3 border p-4">
        <p className="eyebrow text-brand-deep">Predict first</p>
        <p className="text-body font-semibold">
          <InlineText text={question.prompt} />
        </p>
        <ChoiceList
          options={question.options}
          state={(index) => {
            if (picked === null) return 'idle';
            if (index === picked) return right ? 'right' : 'wrong';
            return question.answers.includes(index) ? 'answer' : 'muted';
          }}
          onChoose={(index) => {
            if (picked === null) setPicked(index);
          }}
        />
        {picked !== null && (
          <p className="text-small text-ink-soft bg-surface rounded-input animate-rise-in p-3">
            <strong className="text-ink">
              {right ? 'You called it. ' : 'Good to find out now. '}
            </strong>
            <InlineText text={question.why} />
          </p>
        )}
      </div>
      {picked === null ? (
        <p className="text-small text-ink-soft bg-sunken border-line rounded-input border border-dashed p-3">
          Answer the prediction to see the commands and the expected output.
        </p>
      ) : (
        children
      )}
    </div>
  );
}
