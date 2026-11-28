'use client';

import { useState } from 'react';

import { MockClock } from '@/components/mock/MockClock';
import { MockQuestion } from '@/components/mock/MockQuestion';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Tabs } from '@/components/ui/Tabs';
import { formatClock } from '@/lib/course/mock-score';
import type { RoundRecord } from '@/lib/course/mock-session';
import type { MockRoundView } from '@/types/mock';

export interface MockRoundStageProps {
  index: number;
  total: number;
  round: MockRoundView;
  record: RoundRecord;
  leftMs: number | null;
  limitMs: number;
  storageKey: string;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onHint: (question: number) => void;
  /** Keep it stable (a `useCallback`): each editor reports through it after a Submit. */
  onChecked: (question: number, passed: number, total: number) => void;
  /** Focus moves here when the round opens. */
  headingRef: React.Ref<HTMLHeadingElement>;
}

/**
 * A round in progress: the clock pinned at the top, then the round's
 * questions. A round with two or three questions shows them as tabs, all
 * kept mounted, so an editor keeps its engine and its output on a switch.
 */
export function MockRoundStage({
  index,
  total,
  round,
  record,
  leftMs,
  limitMs,
  storageKey,
  onPause,
  onResume,
  onEnd,
  onHint,
  onChecked,
  headingRef,
}: MockRoundStageProps) {
  const [confirming, setConfirming] = useState(false);
  const paused = record.pausedAt !== null;
  const many = round.questions.length > 1;

  const views = round.questions.map((question, at) => (
    <MockQuestion
      key={question.slug}
      question={question}
      index={at}
      label={many ? `Question ${at + 1}` : 'The question'}
      hintsShown={record.problems[at]?.hints ?? 0}
      onHint={onHint}
      onChecked={onChecked}
      storageKey={storageKey}
    />
  ));

  return (
    <main className="flex w-full flex-col">
      <MockClock
        round={index + 1}
        rounds={total}
        name={round.name}
        leftMs={leftMs}
        limitMs={limitMs}
        paused={paused}
        onPause={onPause}
        onResume={onResume}
        onEnd={() => setConfirming(true)}
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-8 md:py-8">
        <div className="flex flex-col gap-1">
          <h1 ref={headingRef} tabIndex={-1} className="sr-only">
            Round {index + 1}: {round.name}
          </h1>
          <div className="text-small text-ink-soft max-w-prose">{round.focus}</div>
        </div>
        {paused ? (
          <Alert tone="info" title="The clock is paused.">
            A real loop has no pause. Resume when you are back, and keep the question in mind until
            then.
          </Alert>
        ) : null}
        {many ? (
          <Tabs
            label={`Round ${index + 1} questions`}
            items={round.questions.map((question, at) => ({
              id: question.slug,
              label: `Question ${at + 1}: ${question.kindLabel}`,
              content: views[at],
            }))}
          />
        ) : (
          views[0]
        )}
      </div>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="End this round now?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep working
            </Button>
            <Button
              variant="dark"
              onClick={() => {
                setConfirming(false);
                onEnd();
              }}
            >
              End round
            </Button>
          </>
        }
      >
        <p className="text-body text-ink-soft">
          {leftMs === null
            ? 'The round ends with your answers as they are now.'
            : `${formatClock(leftMs)} is left. The round ends with your answers as they are now, and the model answers open.`}
        </p>
      </Dialog>
    </main>
  );
}
