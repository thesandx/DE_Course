'use client';

import { useEffect, useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { outcomeMessage, useRecordProgress } from '@/hooks/useRecordProgress';
import { shuffle } from '@/lib/course/gcp/quiz';
import { cn } from '@/lib/utils';
import type { SprintRound } from '@/types/gcp';

export interface SprintMilestone {
  target: number;
  itemId: string;
  xp: number;
  done: boolean;
}

export interface ServiceSprintProps {
  rounds: readonly SprintRound[];
  seconds: number;
  milestones: readonly SprintMilestone[];
}

interface Card {
  round: SprintRound;
  options: string[];
}

/**
 * Service Sprint: a scenario appears, tap the Google Cloud service that fits.
 * As many as you can in the time. A wrong tap costs you only time. Reaching a
 * milestone (10, then 20 right in one run) saves it once, for XP.
 */
export function ServiceSprint({ rounds, seconds, milestones }: ServiceSprintProps) {
  const [deck, setDeck] = useState<Card[]>([]);
  const [position, setPosition] = useState(0);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [left, setLeft] = useState(seconds);
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null);
  const [phase, setPhase] = useState<'ready' | 'running' | 'over'>('ready');
  const [earned, setEarned] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { record } = useRecordProgress('gcp');

  useEffect(() => {
    if (phase !== 'running') return undefined;
    const timer = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setPhase('over');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'over') return;
    const reached = milestones.filter((milestone) => !milestone.done && score >= milestone.target);
    if (reached.length === 0) return;
    void (async () => {
      for (const milestone of reached) {
        const message = outcomeMessage(await record(milestone.itemId, true));
        if (message !== null) {
          setError(message);
          return;
        }
        setEarned((before) => [...before, milestone.target]);
      }
    })();
    // Runs once per finished run; `score` is final by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the run's result is read once, when the phase turns "over"
  }, [phase]);

  function start(): void {
    const cards = shuffle(rounds, Math.random).map((round) => ({
      round,
      options: shuffle([round.answer, ...round.distractors], Math.random),
    }));
    setDeck(cards);
    setPosition(0);
    setScore(0);
    setMisses(0);
    setLeft(seconds);
    setEarned([]);
    setError(null);
    setPhase('running');
  }

  function pick(option: string): void {
    const card = deck[position];
    if (phase !== 'running' || card === undefined) return;
    const right = option === card.round.answer;
    setFlash(right ? 'right' : 'wrong');
    window.setTimeout(() => setFlash(null), 250);
    if (right) setScore(score + 1);
    else setMisses(misses + 1);
    if (position + 1 >= deck.length) setPhase('over');
    else setPosition(position + 1);
  }

  if (phase === 'ready') {
    return (
      <section className="bg-night-glow rounded-sheet text-on-night shadow-raised flex flex-col gap-5 p-6 md:p-8">
        <p className="eyebrow text-on-night-soft">Speed drill</p>
        <h1 className="text-display">Service Sprint</h1>
        <p className="text-lead text-on-night-soft max-w-2xl">
          {seconds} seconds. A requirement appears; tap the service that fits it. Picking the right
          store fast is the skill the exam tests most.
        </p>
        <ul className="flex flex-wrap gap-2">
          {milestones.map((milestone) => (
            <li
              key={milestone.target}
              className="border-night-line bg-night-raised rounded-pill text-small border px-3 py-1 font-semibold"
            >
              {milestone.target} right · {milestone.done ? 'reached' : `+${milestone.xp} XP`}
            </li>
          ))}
        </ul>
        <div>
          <Button size="lg" onClick={start}>
            Start the sprint
          </Button>
        </div>
      </section>
    );
  }

  if (phase === 'over') {
    return (
      <section className="bg-surface border-line rounded-sheet shadow-raised flex flex-col items-start gap-4 p-6 md:p-8">
        <p className="eyebrow text-ink-faint">Time</p>
        <h2 className="text-display">{score} right</h2>
        <p className="text-body text-ink-soft">
          {misses} {misses === 1 ? 'miss' : 'misses'}. Next milestone:{' '}
          {milestones.find((milestone) => score < milestone.target)?.target ?? 'all reached'}.
        </p>
        {earned.map((target) => (
          <p key={target} className="text-key font-display animate-pop">
            {target} right · +{milestones.find((milestone) => milestone.target === target)?.xp} XP
          </p>
        ))}
        {error !== null && (
          <Alert tone="danger" title="Not saved">
            {error}
          </Alert>
        )}
        <Button size="lg" onClick={start}>
          Run again
        </Button>
      </section>
    );
  }

  const card = deck[position];
  if (card === undefined) return null;
  return (
    <section
      className={cn(
        'bg-surface rounded-card shadow-card flex flex-col gap-5 border p-5 transition-colors sm:p-6',
        flash === 'right' && 'border-easy-bar',
        flash === 'wrong' && 'border-hard-bar animate-wobble',
        flash === null && 'border-line',
      )}
    >
      <Progress
        label="Time left"
        value={(left / seconds) * 100}
        valueText={`${left}s · ${score} right`}
      />
      <p className="text-title min-h-20">
        <InlineText text={card.round.scenario} />
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {card.options.map((option) => (
          <li key={option}>
            <button
              type="button"
              onClick={() => pick(option)}
              className="press bg-surface border-line hover:border-line-strong rounded-input text-body min-h-13 w-full border px-4 py-3 text-left font-semibold"
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="assertive">
        {flash === 'right' ? 'Correct' : flash === 'wrong' ? 'Wrong' : ''}
      </p>
    </section>
  );
}
