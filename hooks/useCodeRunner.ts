'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RUN_TIMEOUT_MS } from '@/lib/runner/engines';
import type {
  CaseResult,
  RunnableSpec,
  RunnerLanguage,
  WorkerEvent,
  WorkerRequest,
} from '@/types/runner';

/**
 * Runs a learner's code in a Web Worker and reports each case as it lands.
 *
 * One worker per engine lives for the whole visit, shared by every problem
 * page, so the engine downloads and starts once. SQL has its own worker;
 * Python and PySpark share one, because both run in Pyodide.
 *
 * A run that passes `RUN_TIMEOUT_MS` is stopped by terminating its worker:
 * the only way to stop an infinite loop in WebAssembly. The next run starts
 * a new worker, which loads the engine again from the browser cache.
 */

type WorkerKind = 'sql' | 'python';

export type RunnerPhase = 'idle' | 'loading' | 'ready' | 'running' | 'done' | 'failed';

export interface RunnerState {
  phase: RunnerPhase;
  /** What the engine is doing, in words: "Loading pandas". */
  detail: string;
  /** What the last request was. */
  action: 'run' | 'check' | null;
  /** The results so far, by case index. A slot is empty until its case finishes. */
  cases: readonly (CaseResult | undefined)[];
  /** How many cases the action runs. */
  total: number;
  /** Why the run failed: the engine did not load, the run timed out, or it was stopped. */
  error: string;
}

export interface CodeRunner {
  state: RunnerState;
  /** Downloads and starts the engine, so the first Run is quick. */
  warm: () => void;
  /** `run` checks the sample case; `check` runs every case, hidden ones too. */
  run: (action: 'run' | 'check', code: string) => void;
  /** Stops the current run. */
  stop: () => void;
}

const workers = new Map<WorkerKind, Worker>();
let nextId = 1;

function kindOf(language: RunnerLanguage): WorkerKind {
  return language === 'sql' ? 'sql' : 'python';
}

function createWorker(kind: WorkerKind): Worker {
  // Each `new URL(..., import.meta.url)` is written out in full: it is the
  // shape the bundler looks for to build a worker.
  return kind === 'sql'
    ? new Worker(new URL('./workers/sql.worker.ts', import.meta.url), {
        type: 'module',
        name: 'sql-runner',
      })
    : new Worker(new URL('./workers/python.worker.ts', import.meta.url), {
        type: 'module',
        name: 'python-runner',
      });
}

function workerFor(kind: WorkerKind): Worker {
  let worker = workers.get(kind);
  if (worker === undefined) {
    worker = createWorker(kind);
    workers.set(kind, worker);
  }
  return worker;
}

function stopWorker(kind: WorkerKind): void {
  workers.get(kind)?.terminate();
  workers.delete(kind);
}

/** Names the test that was running when the clock ran out. */
function timeoutMessage(state: RunnerState, cases: RunnableSpec['cases']): string {
  const index = state.cases.findIndex((result) => result === undefined);
  const running = index === -1 ? state.cases.length : index;
  const name = cases[running]?.name;
  const which =
    state.total > 1 && name !== undefined
      ? `Test ${running + 1} of ${state.total} (${name}) was still running after`
      : 'Your code was still running after';
  return `${which} ${RUN_TIMEOUT_MS / 1000} seconds, so it was stopped. Look for a loop that never ends, a query that never finishes, or an approach that is too slow for big inputs.`;
}

const IDLE: RunnerState = {
  phase: 'idle',
  detail: '',
  action: null,
  cases: [],
  total: 0,
  error: '',
};

interface Flight {
  id: number;
  kind: WorkerKind;
  worker: Worker;
  timer: ReturnType<typeof setTimeout> | null;
  detach: () => void;
  /** A warm-up: no clock, and the result is only "ready". */
  warm: boolean;
}

export function useCodeRunner(spec: RunnableSpec, key: string): CodeRunner {
  const [state, setState] = useState<RunnerState>(IDLE);
  const flight = useRef<Flight | null>(null);
  const kind = kindOf(spec.language);
  const { cases } = spec;

  const finish = useCallback((): void => {
    const current = flight.current;
    if (current === null) return;
    if (current.timer !== null) clearTimeout(current.timer);
    current.detach();
    flight.current = null;
  }, []);

  const send = useCallback(
    (request: WorkerRequest, warm: boolean): void => {
      finish();
      const worker = workerFor(kind);
      const { id } = request;

      const onMessage = (event: MessageEvent<WorkerEvent>): void => {
        const message = event.data;
        if (message.id !== id) return;
        switch (message.type) {
          case 'status': {
            if (message.phase === 'running' && flight.current !== null) {
              flight.current.timer = setTimeout(() => {
                finish();
                stopWorker(kind);
                setState((previous) => ({
                  ...previous,
                  phase: 'failed',
                  error: timeoutMessage(previous, cases),
                }));
              }, RUN_TIMEOUT_MS);
            }
            if (message.phase === 'ready') finish();
            setState((previous) => ({
              ...previous,
              phase: message.phase,
              detail: message.detail,
            }));
            return;
          }
          case 'case':
            setState((previous) => {
              const cases = [...previous.cases];
              cases[message.index] = message.result;
              return { ...previous, cases };
            });
            return;
          case 'done':
            finish();
            setState((previous) => ({
              ...previous,
              phase: 'done',
              detail: '',
              cases: message.cases,
            }));
            return;
          case 'failed':
            finish();
            setState((previous) => ({ ...previous, phase: 'failed', error: message.message }));
            return;
        }
      };

      const onError = (): void => {
        // The worker itself crashed: out of memory, or its script did not load.
        finish();
        stopWorker(kind);
        setState((previous) => ({
          ...previous,
          phase: 'failed',
          error:
            'The engine stopped unexpectedly. It may have run out of memory. Try again, or reload the page.',
        }));
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      flight.current = {
        id,
        kind,
        worker,
        timer: null,
        warm,
        detach: () => {
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
        },
      };
      worker.postMessage(request);
    },
    [cases, finish, kind],
  );

  const warm = useCallback((): void => {
    if (flight.current !== null || state.phase !== 'idle') return;
    const id = nextId++;
    setState({ ...IDLE, phase: 'loading' });
    send(
      {
        id,
        action: 'warm',
        language: spec.language,
        ...(spec.modules !== undefined ? { modules: spec.modules } : {}),
      },
      true,
    );
  }, [send, spec.language, spec.modules, state.phase]);

  const run = useCallback(
    (action: 'run' | 'check', code: string): void => {
      if (flight.current !== null && !flight.current.warm) return;
      const id = nextId++;
      const total = action === 'run' ? Math.min(1, spec.cases.length) : spec.cases.length;
      setState({ ...IDLE, phase: 'loading', action, total });
      send({ id, action, key, code, spec }, false);
    },
    [key, send, spec],
  );

  const stop = useCallback((): void => {
    if (flight.current === null) return;
    finish();
    stopWorker(kind);
    setState((previous) => ({ ...previous, phase: 'failed', error: 'Stopped.' }));
  }, [finish, kind]);

  // Leaving the page mid-run stops the run, so a loop that never ends cannot
  // hold the engine for the next problem.
  useEffect(
    () => () => {
      const current = flight.current;
      if (current === null) return;
      finish();
      if (!current.warm) stopWorker(current.kind);
    },
    [finish],
  );

  return useMemo(() => ({ state, warm, run, stop }), [state, warm, run, stop]);
}
