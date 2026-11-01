'use client';

import { useEffect, useState } from 'react';

import { CompleteButton } from '@/components/course/CompleteButton';
import { InlineText } from '@/components/course/InlineText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Textarea } from '@/components/ui/Textarea';

export interface ProblemWorkspaceProps {
  slug: string;
  itemId: string;
  done: boolean;
  xp: number;
  hints: readonly string[];
  signals: readonly string[];
  followUps: readonly string[];
  /** The model answer, rendered on the server and kept hidden until the learner asks. */
  answer: React.ReactNode;
}

const draftKey = (slug: string): string => `draft:${slug}`;

/**
 * Where the learner works a problem the way an interview runs: draft an answer
 * first, take hints one at a time, then compare with the model answer and
 * tick off the signals they covered.
 *
 * The draft stays in this browser only (localStorage), as a convenience. It
 * is not progress: progress is the "Mark solved" record on the server.
 */
export function ProblemWorkspace({
  slug,
  itemId,
  done,
  xp,
  hints,
  signals,
  followUps,
  answer,
}: ProblemWorkspaceProps) {
  const [draft, setDraft] = useState('');
  const [hintsShown, setHintsShown] = useState(0);
  const [revealed, setRevealed] = useState(done);
  const [covered, setCovered] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(slug));
      // Reading browser storage is only possible after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restores a saved draft once, on mount
      if (saved !== null) setDraft(saved);
    } catch {
      // Storage can be blocked (private mode). The draft then lives in memory only.
      return;
    }
  }, [slug]);

  function updateDraft(value: string): void {
    setDraft(value);
    try {
      window.localStorage.setItem(draftKey(slug), value);
    } catch {
      // Storage can be blocked or full. The draft stays in memory.
      return;
    }
  }

  const coveredCount = Object.values(covered).filter(Boolean).length;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <Textarea
        label="Your answer"
        hint="Write it as you would say it in the interview. It stays in this browser."
        rows={8}
        value={draft}
        onChange={(event) => updateDraft(event.target.value)}
      />

      {hints.length > 0 ? (
        <section aria-labelledby="hints-heading" className="flex flex-col gap-3">
          <h2 id="hints-heading" className="text-heading">
            Hints
          </h2>
          {hintsShown > 0 ? (
            <ol className="flex flex-col gap-2">
              {hints.slice(0, hintsShown).map((hint, index) => (
                <li
                  key={index}
                  className="bg-butter border-line rounded-input animate-rise-in border-2 px-4 py-3"
                >
                  <span className="font-bold">Hint {index + 1}. </span>
                  <InlineText text={hint} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-small text-ink-soft">Try it first. Hints cost nothing but pride.</p>
          )}
          {hintsShown < hints.length ? (
            <Button
              variant="secondary"
              onClick={() => setHintsShown(hintsShown + 1)}
              className="self-start"
            >
              Show hint {hintsShown + 1} of {hints.length}
            </Button>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="answer-heading" className="flex flex-col gap-4">
        <h2 id="answer-heading" className="text-heading">
          Model answer
        </h2>
        {revealed ? (
          <div className="animate-fade-in flex flex-col gap-6">
            {answer}
            <Card tone="grape" className="flex flex-col gap-4">
              <h3 className="font-bold">What a senior answer covers</h3>
              <p className="text-small">
                Tick each one your answer covered. {coveredCount} of {signals.length} covered.
              </p>
              <ul className="flex flex-col gap-3">
                {signals.map((signal, index) => (
                  <li key={index}>
                    <Checkbox
                      label={signal}
                      checked={covered[index] === true}
                      onChange={(event) =>
                        setCovered({ ...covered, [index]: event.target.checked })
                      }
                    />
                  </li>
                ))}
              </ul>
            </Card>
            {followUps.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="font-bold">Follow-ups the interviewer may ask</h3>
                <ul className="flex max-w-prose list-disc flex-col gap-2 pl-6">
                  {followUps.map((followUp, index) => (
                    <li key={index}>
                      <InlineText text={followUp} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setRevealed(true)} className="self-start">
            Reveal the model answer
          </Button>
        )}
      </section>

      <CompleteButton
        itemId={itemId}
        done={done}
        xp={xp}
        label="Mark solved"
        doneLabel="Problem solved"
        {...(!revealed && !done
          ? { blockedReason: 'Compare with the model answer before you mark it solved.' }
          : {})}
      />
    </div>
  );
}
