import { describe, expect, it } from 'vitest';

import {
  addToHistory,
  advance,
  elapsedMs,
  endRound,
  HISTORY_LIMIT,
  isTimeUp,
  lastActivity,
  limitMs,
  matchesPlan,
  type MockHistoryEntry,
  newSession,
  openSessions,
  parseHistory,
  parseSession,
  pause,
  recordTests,
  resume,
  sessionKey,
  setCovered,
  setPace,
  takeHint,
} from '@/lib/course/mock-session';

const PLAN = [['sql-a', 'sql-b'], ['design-a']];
const MIN = 60_000;

function started() {
  return advance(newSession('senior', 42, PLAN), 1_000);
}

describe('a mock session', () => {
  it('starts in the briefing with every question unanswered', () => {
    const session = newSession('senior', 42, PLAN);
    expect(session.phase).toBe('brief');
    expect(session.rounds[0]?.problems.map((problem) => problem.slug)).toEqual(['sql-a', 'sql-b']);
    expect(matchesPlan(session, PLAN)).toBe(true);
    expect(matchesPlan(session, [['sql-a'], ['design-a']])).toBe(false);
    expect(sessionKey('senior', 42)).toBe('mock:senior:42');
  });

  it('sets the pace only before the first round', () => {
    const session = setPace(newSession('senior', 42, PLAN), 1.5);
    expect(session.pace).toBe(1.5);
    expect(limitMs(45, session.pace)).toBe(67.5 * MIN);
    expect(setPace(advance(session, 0), 1).pace).toBe(1.5);
  });

  it('runs the clock without the paused time', () => {
    let session = started();
    expect(session.phase).toBe('round');
    session = pause(session, 1_000 + 10 * MIN);
    session = pause(session, 1_000 + 11 * MIN);
    const round = () => session.rounds[0] ?? newSession('x', 1, [[]]).rounds[0];
    expect(elapsedMs(round()!, 1_000 + 15 * MIN)).toBe(10 * MIN);
    session = resume(session, 1_000 + 20 * MIN);
    expect(round()?.pauses).toBe(1);
    expect(elapsedMs(round()!, 1_000 + 25 * MIN)).toBe(15 * MIN);
    expect(isTimeUp(session, 45, 1_000 + 54 * MIN)).toBe(false);
    expect(isTimeUp(session, 45, 1_000 + 55 * MIN)).toBe(true);
  });

  it('ends a round on time, and closes an open pause first', () => {
    let session = pause(started(), 1_000 + 5 * MIN);
    session = endRound(session, 1_000 + 8 * MIN, true);
    expect(session.phase).toBe('review');
    expect(session.rounds[0]?.timedOut).toBe(true);
    expect(session.rounds[0]?.pausedAt).toBeNull();
    expect(elapsedMs(session.rounds[0]!, 1_000 + 99 * MIN)).toBe(5 * MIN);
    expect(endRound(session, 0, false)).toBe(session);
  });

  it('counts hints and keeps the best Submit while the round runs', () => {
    let session = takeHint(takeHint(started(), 1), 1);
    session = recordTests(session, 0, 2, 4);
    session = recordTests(session, 0, 1, 4);
    session = recordTests(session, 0, 0, 0);
    expect(session.rounds[0]?.problems[0]?.tests).toEqual({ passed: 2, total: 4 });
    expect(recordTests(session, 0, 2, 4)).toBe(session);
    expect(recordTests(session, 7, 4, 4)).toBe(session);
    session = recordTests(session, 0, 4, 4);
    expect(session.rounds[0]?.problems[0]?.tests).toEqual({ passed: 4, total: 4 });
    expect(session.rounds[0]?.problems[1]?.hints).toBe(2);
    const reviewed = endRound(session, 2_000, false);
    expect(takeHint(reviewed, 0)).toBe(reviewed);
    expect(recordTests(reviewed, 0, 1, 1)).toBe(reviewed);
  });

  it('ticks signals only once the round has ended', () => {
    const running = started();
    expect(setCovered(running, 0, 0, 1, true)).toBe(running);
    let session = endRound(running, 2_000, false);
    session = setCovered(session, 0, 0, 2, true);
    session = setCovered(session, 0, 0, 0, true);
    session = setCovered(session, 0, 0, 2, true);
    expect(session.rounds[0]?.problems[0]?.covered).toEqual([0, 2]);
    session = setCovered(session, 0, 0, 0, false);
    expect(session.rounds[0]?.problems[0]?.covered).toEqual([2]);
    expect(setCovered(session, 5, 0, 0, true)).toBe(session);
  });

  it('moves round by round to the scorecard', () => {
    let session = endRound(started(), 2_000, false);
    session = advance(session, 3_000);
    expect(session.current).toBe(1);
    expect(session.rounds[1]?.startedAt).toBe(3_000);
    expect(advance(session, 3_500)).toBe(session);
    session = advance(endRound(session, 4_000, false), 5_000);
    expect(session.phase).toBe('done');
    expect(session.finishedAt).toBe(5_000);
    expect(pause(session, 6_000)).toBe(session);
    expect(resume(session, 6_000)).toBe(session);
  });
});

describe('saved sessions and history', () => {
  it('reads back a saved session and refuses a damaged one', () => {
    const session = started();
    expect(parseSession(JSON.stringify(session))).toEqual(session);
    expect(parseSession(null)).toBeNull();
    expect(parseSession('{not json')).toBeNull();
    expect(parseSession(JSON.stringify({ ...session, version: 2 }))).toBeNull();
  });

  it('finds the sessions under way, the most recent first', () => {
    const early = started();
    const late = pause(advance(newSession('staff', 7, PLAN), 5_000), 9_000);
    const done = { ...started(), seed: 3, phase: 'done' as const };
    const entries: [string, string | null][] = [
      [sessionKey('senior', 42), JSON.stringify(early)],
      [sessionKey('staff', 7), JSON.stringify(late)],
      [sessionKey('senior', 3), JSON.stringify(done)],
      [sessionKey('quick', 9), JSON.stringify(newSession('quick', 9, PLAN))],
      ['mock:senior:42:code:sql-a', 'select 1'],
      ['mock:history', '[]'],
      ['mock:senior:99', JSON.stringify(early)],
      ['mock:senior:5', null],
    ];
    expect(lastActivity(late)).toBe(9_000);
    expect(lastActivity(newSession('quick', 9, PLAN))).toBe(0);
    expect(openSessions(entries).map((session) => session.loop)).toEqual(['staff', 'senior']);
  });

  it('keeps the newest scorecards first, one per session, at most twenty', () => {
    const entry = (seed: number): MockHistoryEntry => ({
      loop: 'senior',
      name: 'Senior data engineer loop',
      seed,
      finishedAt: seed,
      score: 0.5,
      verdict: 'Lean no hire',
      rounds: [{ name: 'SQL', score: 0.5 }],
    });
    let history: MockHistoryEntry[] = [];
    for (let seed = 1; seed <= HISTORY_LIMIT + 3; seed += 1)
      history = addToHistory(history, entry(seed));
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0]?.seed).toBe(HISTORY_LIMIT + 3);
    history = addToHistory(history, { ...entry(HISTORY_LIMIT + 3), score: 0.9 });
    expect(history.filter((item) => item.seed === HISTORY_LIMIT + 3)).toHaveLength(1);
    expect(parseHistory(JSON.stringify(history))).toEqual(history);
    expect(parseHistory('[{"loop": 1}]')).toEqual([]);
    expect(parseHistory('oops')).toEqual([]);
    expect(parseHistory(null)).toEqual([]);
  });
});
