'use client';

import { useEffect, useMemo, useRef } from 'react';

import { MockBriefing } from '@/components/mock/MockBriefing';
import { MockReview } from '@/components/mock/MockReview';
import { MockRoundStage } from '@/components/mock/MockRoundStage';
import { MockScorecard } from '@/components/mock/MockScorecard';
import { Spinner } from '@/components/ui/Spinner';
import { useMockSession } from '@/hooks/useMockSession';
import { average, scoreRounds, verdictFor } from '@/lib/course/mock-score';
import {
  addToHistory,
  elapsedMs,
  HISTORY_KEY,
  limitMs,
  parseHistory,
} from '@/lib/course/mock-session';
import type { MockLoopView, MockRoundView } from '@/types/mock';

export interface MockRunnerProps {
  loop: MockLoopView;
  seed: number;
  rounds: readonly MockRoundView[];
  /** False when the server has no OpenRouter key: Pip does not grade. */
  pipEnabled?: boolean;
}

/**
 * A timed mock loop from the briefing to the debrief. The state lives in
 * `useMockSession`; this component picks the screen for the phase, moves
 * focus to its heading, and writes the finished loop to this browser's
 * history of scorecards.
 */
export function MockRunner({ loop, seed, rounds, pipEnabled = false }: MockRunnerProps) {
  const plan = useMemo(
    () => rounds.map((round) => round.questions.map((question) => question.slug)),
    [rounds],
  );
  const minutes = useMemo(() => rounds.map((round) => round.minutes), [rounds]);
  const facts = useMemo(
    () =>
      rounds.map((round) =>
        round.questions.map((question) => ({
          signals: question.signals.length,
          runnable: question.runner !== undefined,
        })),
      ),
    [rounds],
  );
  const mock = useMockSession(loop.slug, seed, plan, minutes);
  const { session, now } = mock;
  const heading = useRef<HTMLHeadingElement>(null);

  const scores = scoreRounds(
    facts,
    session.rounds.map((round) => round.problems),
  );
  const verdict = verdictFor(scores);
  const limits = rounds.map((round) => limitMs(round.minutes, session.pace));

  // A new screen starts at the top, with focus on its heading.
  const { phase, current: step } = session;
  useEffect(() => {
    if (!mock.ready) return;
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [mock.ready, phase, step]);

  // Keep the scorecard in this browser's history once the loop ends.
  const finishedAt = session.finishedAt;
  const roundNames = rounds.map((round) => round.name).join('\n');
  const scoreKey = scores.join(',');
  useEffect(() => {
    if (finishedAt === null) return;
    const names = roundNames.split('\n');
    const values = scoreKey.split(',').map(Number);
    try {
      const history = parseHistory(window.localStorage.getItem(HISTORY_KEY));
      const entry = {
        loop: loop.slug,
        name: loop.name,
        seed,
        finishedAt,
        score: average(values),
        verdict: verdictFor(values).label,
        rounds: names.map((name, index) => ({ name, score: values[index] ?? 0 })),
      };
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(addToHistory(history, entry)));
    } catch {
      // Storage can be blocked. The scorecard still shows; only the history misses it.
      return;
    }
  }, [finishedAt, loop.name, loop.slug, roundNames, scoreKey, seed]);

  if (!mock.ready) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-16">
        <Spinner label="Opening the loop…" />
      </main>
    );
  }

  const index = session.current;
  const round = rounds[index];
  const record = session.rounds[index];

  if (session.phase === 'brief' || round === undefined || record === undefined) {
    return (
      <MockBriefing
        loop={loop}
        rounds={rounds}
        pace={session.pace}
        onPace={mock.setPace}
        onStart={mock.advance}
        headingRef={heading}
      />
    );
  }

  if (session.phase === 'round') {
    const limit = limits[index] ?? 0;
    return (
      <MockRoundStage
        key={index}
        index={index}
        total={rounds.length}
        round={round}
        record={record}
        leftMs={now === null ? null : limit - elapsedMs(record, now)}
        limitMs={limit}
        storageKey={mock.storageKey}
        onPause={mock.pause}
        onResume={mock.resume}
        onEnd={mock.end}
        onHint={mock.hint}
        onChecked={mock.tests}
        headingRef={heading}
      />
    );
  }

  if (session.phase === 'review') {
    return (
      <MockReview
        key={index}
        index={index}
        total={rounds.length}
        round={round}
        record={record}
        roundScore={scores[index] ?? 0}
        limitMs={limits[index] ?? 0}
        storageKey={mock.storageKey}
        onCover={(question, signal, covered) => mock.cover(index, question, signal, covered)}
        onGrade={(question, grade) => mock.grade(index, question, grade)}
        pipEnabled={pipEnabled}
        onNext={mock.advance}
        headingRef={heading}
      />
    );
  }

  return (
    <MockScorecard
      loop={loop}
      rounds={rounds}
      session={session}
      scores={scores}
      verdict={verdict}
      limits={limits}
      onRetry={mock.restart}
      headingRef={heading}
    />
  );
}
