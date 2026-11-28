'use client';

import { useCallback, useEffect, useState } from 'react';

import { CodeRunner } from '@/components/course/CodeRunner';
import { DifficultyTag } from '@/components/course/DifficultyTag';
import { InlineText } from '@/components/course/InlineText';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { HINT_COST } from '@/lib/course/mock-score';
import type { MockQuestionView } from '@/types/mock';

export interface MockQuestionProps {
  question: MockQuestionView;
  /** The question's place in its round, from 0. The callbacks name it. */
  index: number;
  /** "Question 2", which stands in for the title until the round ends. */
  label: string;
  hintsShown: number;
  onHint: (question: number) => void;
  onChecked: (question: number, passed: number, total: number) => void;
  /** The session's storage key. The code and the draft live under it. */
  storageKey: string;
}

export const draftKeyFor = (storageKey: string, slug: string): string =>
  `${storageKey}:draft:${slug}`;
export const codeKeyFor = (storageKey: string, slug: string): string =>
  `${storageKey}:code:${slug}`;

/**
 * One question while its round runs: the question on the left, the work on
 * the right. A problem with tests gets the runnable editor; any other gets a
 * draft box. The title stays hidden, because a title can give the approach
 * away; the review shows it.
 */
export function MockQuestion({
  question,
  index,
  label,
  hintsShown,
  onHint,
  onChecked,
  storageKey,
}: MockQuestionProps) {
  const draftKey = draftKeyFor(storageKey, question.slug);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      // Reading browser storage is only possible after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restores a saved draft once, on mount
      if (saved !== null) setDraft(saved);
    } catch {
      // Storage can be blocked (private mode). The draft then lives in memory only.
      return;
    }
  }, [draftKey]);

  function updateDraft(value: string): void {
    setDraft(value);
    try {
      window.localStorage.setItem(draftKey, value);
    } catch {
      // Storage can be blocked or full. The draft stays in memory.
      return;
    }
  }

  // A stable callback: the editor reports each finished Submit once, not on each render.
  const checked = useCallback(
    (passed: number, total: number) => onChecked(index, passed, total),
    [index, onChecked],
  );
  const costPercent = Math.round(HINT_COST * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
      <section
        aria-label={`${label}: the question`}
        className="bg-surface border-line rounded-card shadow-card border-l-brand flex min-w-0 flex-col gap-4 border border-l-4 p-5 sm:p-6 lg:sticky lg:top-40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-title mr-auto">{label}</h2>
          <span className="border-line rounded-pill text-micro text-ink-soft border px-2.5 py-1 font-semibold">
            {question.kindLabel}
          </span>
          <DifficultyTag difficulty={question.difficulty} />
        </div>
        {question.prompt}
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {question.runner !== undefined ? (
          <CodeRunner
            slug={question.slug}
            spec={question.runner.spec}
            runKey={question.runner.runKey}
            task={question.runner.task}
            onChecked={checked}
            storageKey={codeKeyFor(storageKey, question.slug)}
            acceptedNote="Every test passes. Say the complexity and the edge cases out loud, then end the round or go to the next question."
          />
        ) : (
          <div className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6">
            <Textarea
              label="Your answer"
              hint="Write it as you would say it. The model answer opens when the round ends."
              rows={12}
              value={draft}
              onChange={(event) => updateDraft(event.target.value)}
            />
          </div>
        )}

        {question.hints.length > 0 ? (
          <section
            aria-label={`${label}: hints`}
            className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6"
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-heading">Hints</h3>
              <p className="text-small text-ink-soft">
                Each hint costs {costPercent}% of this question’s score, as a nudge from the
                interviewer would.
              </p>
            </div>
            {hintsShown > 0 ? (
              <ol className="flex flex-col gap-2">
                {question.hints.slice(0, hintsShown).map((hint, at) => (
                  <li
                    key={at}
                    className="bg-medium-soft border-l-medium-bar rounded-input animate-rise-in border-l-4 px-4 py-3"
                  >
                    <span className="text-medium font-semibold">Hint {at + 1}. </span>
                    <InlineText text={hint} />
                  </li>
                ))}
              </ol>
            ) : null}
            {hintsShown < question.hints.length ? (
              <Button variant="secondary" onClick={() => onHint(index)} className="self-start">
                Take hint {hintsShown + 1} of {question.hints.length}
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
