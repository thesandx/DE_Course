'use client';

import { useState } from 'react';

import { CompleteButton } from '@/components/course/CompleteButton';
import { InlineText } from '@/components/course/InlineText';
import { Button } from '@/components/ui/Button';
import {
  isMatchCorrect,
  isOrderCorrect,
  scrambledIndexes,
  seededRandom,
  shuffleChoices,
} from '@/lib/course/gcp/quiz';
import { cn } from '@/lib/utils';
import type { StationCheck } from '@/types/gcp';

import { ChoiceList } from './ChoiceList';

export interface StationChecksProps {
  itemId: string;
  checks: readonly StationCheck[];
  done: boolean;
  xp: number;
  /** A link back to the previous station, shown beside the finish button. */
  previous?: React.ReactNode;
}

type CheckProps<T extends StationCheck['type']> = {
  check: Extract<StationCheck, { type: T }>;
  onSolved: () => void;
};

function Why({ text }: { text: string }) {
  return (
    <p className="text-small text-ink-soft bg-sunken rounded-input animate-rise-in p-3">
      <InlineText text={text} />
    </p>
  );
}

/** One correct option. A wrong pick wobbles and stays marked, so the learner tries again. */
function ChoiceCheck({ check: source, onSolved }: CheckProps<'choice'>) {
  // The content lists the right option first. A seeded shuffle moves it, and
  // gives the server and the browser the same order.
  const check = shuffleChoices(source, seededRandom(source.prompt));
  const [tries, setTries] = useState<number[]>([]);
  const answer = check.answers[0] ?? 0;
  const solved = tries.includes(answer);

  function choose(option: number): void {
    if (solved || tries.includes(option)) return;
    setTries([...tries, option]);
    if (option === answer) onSolved();
  }

  return (
    <div className="flex flex-col gap-3">
      <ChoiceList
        options={check.options}
        state={(index) =>
          tries.includes(index) ? (index === answer ? 'right' : 'wrong') : solved ? 'muted' : 'idle'
        }
        onChoose={choose}
        wobble={tries.length > 0 && !solved}
      />
      {tries.length > 0 && <Why text={check.why} />}
    </div>
  );
}

/** Match each left item to a right item from a list, then check them together. */
function MatchCheck({ check, onSolved }: CheckProps<'match'>) {
  const order = scrambledIndexes(check.pairs.length, check.prompt);
  const [chosen, setChosen] = useState<Array<number | null>>(check.pairs.map(() => null));
  const [checked, setChecked] = useState(false);
  const solved = checked && isMatchCorrect(chosen);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {check.pairs.map(([left], row) => {
          const value = chosen[row];
          const state = !checked || value === null ? 'idle' : value === row ? 'right' : 'wrong';
          return (
            <li
              key={left}
              className={cn(
                'rounded-input flex flex-col gap-2 border p-3 sm:flex-row sm:items-center sm:gap-4',
                state === 'idle' && 'bg-surface border-line',
                state === 'right' && 'bg-easy-soft border-easy-bar',
                state === 'wrong' && 'bg-hard-soft border-hard-bar',
              )}
            >
              <span className="text-body grow">
                <InlineText text={left} />
              </span>
              <label className="flex min-w-0 flex-col gap-1 sm:w-64 sm:shrink-0">
                <span className="sr-only">Match for: {left}</span>
                <select
                  value={value === null ? '' : String(value)}
                  disabled={solved}
                  onChange={(event) => {
                    const next = [...chosen];
                    next[row] = event.target.value === '' ? null : Number(event.target.value);
                    setChosen(next);
                    setChecked(false);
                  }}
                  className="bg-surface border-line-strong rounded-input text-small min-h-11 w-full cursor-pointer border px-3"
                >
                  <option value="">Choose…</option>
                  {order.map((pair) => (
                    <option key={pair} value={pair}>
                      {check.pairs[pair]?.[1]}
                    </option>
                  ))}
                </select>
              </label>
              {state !== 'idle' && (
                <span
                  className={cn(
                    'text-small shrink-0 font-semibold',
                    state === 'right' ? 'text-easy' : 'text-hard',
                  )}
                >
                  {state === 'right' ? 'Correct' : 'Not quite'}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!solved && (
        <Button
          variant="secondary"
          className="self-start"
          disabled={chosen.some((value) => value === null)}
          onClick={() => {
            setChecked(true);
            if (isMatchCorrect(chosen)) onSolved();
          }}
        >
          Check matches
        </Button>
      )}
      {checked && <Why text={check.why} />}
    </div>
  );
}

/** Put the steps in order with the up and down buttons, then check. */
function OrderCheck({ check, onSolved }: CheckProps<'order'>) {
  const [order, setOrder] = useState<number[]>(() =>
    scrambledIndexes(check.steps.length, check.prompt),
  );
  const [checked, setChecked] = useState(false);
  const solved = checked && isOrderCorrect(order);

  function move(position: number, delta: number): void {
    const target = position + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const a = next[position] as number;
    next[position] = next[target] as number;
    next[target] = a;
    setOrder(next);
    setChecked(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {order.map((step, position) => {
          const state = !checked ? 'idle' : step === position ? 'right' : 'wrong';
          return (
            <li
              key={step}
              className={cn(
                'rounded-input flex items-center gap-3 border p-2 pl-3',
                state === 'idle' && 'bg-surface border-line',
                state === 'right' && 'bg-easy-soft border-easy-bar',
                state === 'wrong' && 'bg-hard-soft border-hard-bar',
              )}
            >
              <span className="text-small text-ink-faint w-5 shrink-0 font-mono">
                {position + 1}
              </span>
              <span className="text-body grow">
                <InlineText text={check.steps[step] ?? ''} />
              </span>
              {!solved && (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`Move up: ${check.steps[step] ?? ''}`}
                    disabled={position === 0}
                    onClick={() => move(position, -1)}
                    className="border-line bg-surface rounded-input text-ink-soft hover:text-ink inline-grid size-11 place-items-center border disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move down: ${check.steps[step] ?? ''}`}
                    disabled={position === order.length - 1}
                    onClick={() => move(position, 1)}
                    className="border-line bg-surface rounded-input text-ink-soft hover:text-ink inline-grid size-11 place-items-center border disabled:opacity-40"
                  >
                    ↓
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!solved && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => {
            setChecked(true);
            if (isOrderCorrect(order)) onSolved();
          }}
        >
          Check order
        </Button>
      )}
      {checked && <Why text={check.why} />}
    </div>
  );
}

const KIND_LABEL: Record<StationCheck['type'], string> = {
  choice: 'Pick one',
  match: 'Match',
  order: 'Put in order',
};

/**
 * The checkpoint at the end of a station: one check per key point, of three
 * kinds (pick, match, order). The finish button waits until every check is
 * right, so a finished station means the learner proved each point.
 */
export function StationChecks({ itemId, checks, done, xp, previous }: StationChecksProps) {
  const [solved, setSolved] = useState<ReadonlySet<number>>(new Set());
  const allCorrect = solved.size === checks.length;

  function markSolved(index: number): void {
    setSolved((before) => new Set(before).add(index));
  }

  return (
    <div className="flex flex-col gap-4">
      {checks.length > 0 && (
        <section
          aria-labelledby="checkpoint-heading"
          className="bg-surface border-line rounded-card shadow-card flex flex-col gap-6 border p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="bg-brand-soft text-brand-deep rounded-pill eyebrow w-fit px-2.5 py-1">
                Checkpoint
              </span>
              <h2 id="checkpoint-heading" className="text-title">
                Prove each key point
              </h2>
            </div>
            <p className="text-small text-ink-faint font-mono" aria-live="polite">
              {solved.size} of {checks.length} · no penalty for trying
            </p>
          </div>
          <ol className="flex flex-col gap-8">
            {checks.map((check, index) => (
              <li key={check.prompt} className="flex flex-col gap-3">
                <p className="eyebrow text-ink-faint">
                  {index + 1} · {KIND_LABEL[check.type]}
                  {solved.has(index) && <span className="text-easy"> · Done</span>}
                </p>
                <p className="text-heading">
                  <InlineText text={check.prompt} />
                </p>
                {check.type === 'choice' && (
                  <ChoiceCheck check={check} onSolved={() => markSolved(index)} />
                )}
                {check.type === 'match' && (
                  <MatchCheck check={check} onSolved={() => markSolved(index)} />
                )}
                {check.type === 'order' && (
                  <OrderCheck check={check} onSolved={() => markSolved(index)} />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section
        aria-label="Finish the station"
        className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6"
      >
        <CompleteButton
          course="gcp"
          itemId={itemId}
          done={done}
          xp={xp}
          label="Finish station"
          doneLabel="Station finished"
          {...(previous !== undefined ? { secondary: previous } : {})}
          {...(!allCorrect && !done
            ? { blockedReason: 'Get every checkpoint right to finish the station.' }
            : {})}
        />
      </section>
    </div>
  );
}
