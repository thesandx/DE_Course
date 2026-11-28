'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';

import {
  advance,
  endRound,
  isTimeUp,
  matchesPlan,
  type MockSession,
  newSession,
  type Pace,
  parseSession,
  pause,
  type PipGrade,
  type PlanSlugs,
  recordTests,
  resume,
  sessionKey,
  setCovered,
  setPace,
  setPipGrade,
  takeHint,
} from '@/lib/course/mock-session';

type Action =
  | { type: 'load'; session: MockSession }
  | { type: 'pace'; pace: Pace }
  | { type: 'advance'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'end'; now: number; timedOut: boolean }
  | { type: 'hint'; problem: number }
  | { type: 'tests'; problem: number; passed: number; total: number }
  | { type: 'cover'; round: number; problem: number; signal: number; covered: boolean }
  | { type: 'grade'; round: number; problem: number; grade: PipGrade }
  | { type: 'restart'; session: MockSession };

function reduce(session: MockSession, action: Action): MockSession {
  switch (action.type) {
    case 'load':
    case 'restart':
      return action.session;
    case 'pace':
      return setPace(session, action.pace);
    case 'advance':
      return advance(session, action.now);
    case 'pause':
      return pause(session, action.now);
    case 'resume':
      return resume(session, action.now);
    case 'end':
      return endRound(session, action.now, action.timedOut);
    case 'hint':
      return takeHint(session, action.problem);
    case 'tests':
      return recordTests(session, action.problem, action.passed, action.total);
    case 'cover':
      return setCovered(session, action.round, action.problem, action.signal, action.covered);
    case 'grade':
      return setPipGrade(session, action.round, action.problem, action.grade);
  }
}

/** Removes a session and everything stored under it: code, drafts. */
function clearStored(key: string): void {
  try {
    const doomed: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const name = window.localStorage.key(index);
      if (name !== null && (name === key || name.startsWith(`${key}:`))) doomed.push(name);
    }
    for (const name of doomed) window.localStorage.removeItem(name);
  } catch {
    // Storage can be blocked. Nothing was saved there, so nothing is left behind.
    return;
  }
}

export interface MockSessionApi {
  session: MockSession;
  /** False until the saved session, if any, is read. Render a placeholder until then. */
  ready: boolean;
  /** The clock, updated each second while a round runs. Null before hydration. */
  now: number | null;
  /** Where the session's code and drafts live: `<key>:code:<slug>`, `<key>:draft:<slug>`. */
  storageKey: string;
  setPace: (pace: Pace) => void;
  advance: () => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  hint: (problem: number) => void;
  tests: (problem: number, passed: number, total: number) => void;
  cover: (round: number, problem: number, signal: number, covered: boolean) => void;
  /** Stores Pip's grade of a written answer. Pip's signals replace the ticks. */
  grade: (round: number, problem: number, grade: PipGrade) => void;
  /** Starts the same questions again, from the briefing, with fresh code and drafts. */
  restart: () => void;
}

/**
 * One timed mock, kept in this browser. The state lives in `localStorage`
 * under `mock:<loop>:<seed>`, so a refresh resumes it, clock included. When a
 * round's time is up, the round ends by itself.
 */
export function useMockSession(
  loop: string,
  seed: number,
  plan: PlanSlugs,
  minutes: readonly number[],
): MockSessionApi {
  const storageKey = sessionKey(loop, seed);
  const [session, dispatch] = useReducer(reduce, undefined, () => newSession(loop, seed, plan));
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let saved: MockSession | null = null;
    try {
      saved = parseSession(window.localStorage.getItem(storageKey));
    } catch {
      // Storage can be blocked (private mode). The session then lives in memory.
      saved = null;
    }
    if (saved !== null && matchesPlan(saved, plan)) dispatch({ type: 'load', session: saved });
    // Reading browser storage is only possible after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the saved session as read, once
    setReady(true);
  }, [storageKey, plan]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    } catch {
      // Storage can be blocked or full. The session stays in memory for this visit.
      return;
    }
  }, [ready, session, storageKey]);

  const running = session.phase === 'round';
  useEffect(() => {
    // The clock reads the time only in the browser, so the server render never differs.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the visible clock on mount
    setNow(Date.now());
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const roundMinutes = minutes[session.current] ?? 0;
  useEffect(() => {
    if (now !== null && isTimeUp(session, roundMinutes, now)) {
      dispatch({ type: 'end', now, timedOut: true });
    }
  }, [now, roundMinutes, session]);

  return {
    session,
    ready,
    now,
    storageKey,
    setPace: useCallback((pace: Pace) => dispatch({ type: 'pace', pace }), []),
    advance: useCallback(() => dispatch({ type: 'advance', now: Date.now() }), []),
    pause: useCallback(() => dispatch({ type: 'pause', now: Date.now() }), []),
    resume: useCallback(() => dispatch({ type: 'resume', now: Date.now() }), []),
    end: useCallback(() => dispatch({ type: 'end', now: Date.now(), timedOut: false }), []),
    hint: useCallback((problem: number) => dispatch({ type: 'hint', problem }), []),
    tests: useCallback(
      (problem: number, passed: number, total: number) =>
        dispatch({ type: 'tests', problem, passed, total }),
      [],
    ),
    cover: useCallback(
      (round: number, problem: number, signal: number, covered: boolean) =>
        dispatch({ type: 'cover', round, problem, signal, covered }),
      [],
    ),
    grade: useCallback(
      (round: number, problem: number, grade: PipGrade) =>
        dispatch({ type: 'grade', round, problem, grade }),
      [],
    ),
    restart: useCallback(() => {
      clearStored(storageKey);
      dispatch({ type: 'restart', session: newSession(loop, seed, plan) });
    }, [loop, plan, seed, storageKey]),
  };
}
