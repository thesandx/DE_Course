'use client';

import { useState } from 'react';

import { CodeBlock } from '@/components/gcp/CodeBlock';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { outcomeMessage, useRecordProgress } from '@/hooks/useRecordProgress';
import { commandHint, isCommandRight, normalizeCommand } from '@/lib/course/k8s/dojo-check';
import { cn } from '@/lib/utils';
import type { DojoTask } from '@/types/k8s';

export interface CommandDojoProps {
  tasks: readonly DojoTask[];
  /** The progress id of each task, in the same order. */
  ids: readonly string[];
  /** The ids of the tasks the learner already solved. */
  solved: readonly string[];
  xpPerTask: number;
}

type Result =
  { kind: 'idle' } | { kind: 'right'; typed: string } | { kind: 'wrong' } | { kind: 'shown' };

/**
 * The kubectl dojo: a task appears, and the learner types the real command.
 * The check reads the command the way a shell would, so flags can come in any
 * order and `k` works as an alias. A solved task is saved once, for XP.
 */
export function CommandDojo({ tasks, ids, solved, xpPerTask }: CommandDojoProps) {
  const solvedSet = new Set(solved);
  const firstOpen = ids.findIndex((id) => !solvedSet.has(id));
  const [position, setPosition] = useState(firstOpen < 0 ? 0 : firstOpen);
  const [typed, setTyped] = useState('');
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const { record, busy } = useRecordProgress('k8s');

  const task = tasks[position];
  const id = ids[position];
  if (task === undefined || id === undefined) return null;

  function go(next: number): void {
    setPosition(((next % tasks.length) + tasks.length) % tasks.length);
    setTyped('');
    setTries(0);
    setResult({ kind: 'idle' });
    setError(null);
  }

  async function check(): Promise<void> {
    if (task === undefined || id === undefined || normalizeCommand(typed) === '') return;
    if (!isCommandRight(task, typed)) {
      setTries(tries + 1);
      setResult({ kind: 'wrong' });
      return;
    }
    setResult({ kind: 'right', typed: normalizeCommand(typed) });
    if (!solvedSet.has(id)) setError(outcomeMessage(await record(id, true)));
  }

  return (
    <div className="flex flex-col gap-5">
      <Progress
        label="Commands solved"
        value={(solvedSet.size / tasks.length) * 100}
        valueText={`${solvedSet.size} of ${tasks.length}`}
      />

      <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6">
        <p className="eyebrow text-ink-faint">
          Task {position + 1} of {tasks.length}
          {solvedSet.has(id) && <span className="text-easy"> · Solved</span>}
        </p>
        <h2 className="text-title">{task.task}</h2>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void check();
          }}
        >
          <label className="bg-night-deep rounded-input text-on-night flex min-h-12 items-center gap-3 px-4 font-mono">
            <span aria-hidden="true" className="text-easy-bar">
              $
            </span>
            <span className="sr-only">Your command</span>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="type the command"
              className="text-body placeholder:text-on-night-soft min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy || typed.trim() === ''}>
              {busy ? 'Saving' : 'Run'}
            </Button>
            <Button variant="secondary" onClick={() => setResult({ kind: 'shown' })}>
              Show answer
            </Button>
            <Button variant="quiet" onClick={() => go(position + 1)}>
              Skip
            </Button>
          </div>
        </form>

        <div aria-live="polite" className="flex flex-col gap-3">
          {result.kind === 'right' && (
            <>
              <CodeBlock
                label="kind-kq"
                code={`$ ${result.typed}${task.output === '' ? '' : `\n${task.output}`}`}
              />
              <p className="text-body text-easy font-semibold">
                Correct.{!solvedSet.has(id) && error === null ? ` +${xpPerTask} XP` : ''}
              </p>
              <div>
                <Button variant="dark" onClick={() => go(position + 1)}>
                  Next task
                </Button>
              </div>
            </>
          )}
          {result.kind === 'wrong' && (
            <p className="text-small bg-hard-soft text-hard rounded-input animate-wobble p-3">
              <strong>Not quite.</strong>{' '}
              {tries >= 2 ? (
                <>
                  It starts with <code className="font-mono">{commandHint(task, tries)}</code>.
                </>
              ) : (
                'Check the resource, the name and the flags.'
              )}
            </p>
          )}
          {result.kind === 'shown' && (
            <p className="text-small text-ink-soft bg-sunken rounded-input p-3">
              One answer: <code className="text-ink font-mono break-words">{task.answer}</code>.
              Type it yourself to bank the XP.
            </p>
          )}
          {error !== null && (
            <Alert tone="danger" title="Not saved">
              {error}
            </Alert>
          )}
        </div>
      </section>

      <nav aria-label="Tasks">
        <ul className="flex flex-wrap gap-2">
          {tasks.map((item, index) => {
            const itemId = ids[index] ?? '';
            return (
              <li key={item.task}>
                <button
                  type="button"
                  aria-current={index === position ? 'true' : undefined}
                  aria-label={`Task ${index + 1}: ${item.task}${solvedSet.has(itemId) ? ' (solved)' : ''}`}
                  onClick={() => go(index)}
                  className={cn(
                    'rounded-input text-small inline-grid size-11 place-items-center border font-mono font-semibold',
                    index === position
                      ? 'bg-ink text-on-ink border-ink'
                      : solvedSet.has(itemId)
                        ? 'bg-easy-soft text-easy border-easy-bar'
                        : 'bg-surface border-line text-ink-soft hover:text-ink',
                  )}
                >
                  {index + 1}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
