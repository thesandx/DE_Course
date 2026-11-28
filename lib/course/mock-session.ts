import { z } from 'zod';

/**
 * The state of one timed mock, as pure transitions. The mock screen keeps it
 * in this browser (localStorage), so a refresh or a closed tab resumes the
 * loop where it was, clock included. Every transition takes `now`, so the
 * clock logic is tested without timers.
 *
 * Phases: `brief` (the plan, not started), `round` (the clock runs),
 * `review` (the round ended: answers and signals), `done` (the scorecard).
 */

export const PACES = [1, 1.5] as const;
export type Pace = (typeof PACES)[number];

const problemRecordSchema = z.object({
  slug: z.string(),
  hints: z.number().int().min(0),
  tests: z.object({ passed: z.number().int().min(0), total: z.number().int().min(1) }).nullable(),
  covered: z.array(z.number().int().min(0)),
});

const roundRecordSchema = z.object({
  startedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  /** Paused time already over. A pause in progress counts from `pausedAt`. */
  pausedMs: z.number().min(0),
  pausedAt: z.number().nullable(),
  pauses: z.number().int().min(0),
  timedOut: z.boolean(),
  problems: z.array(problemRecordSchema),
});

export const mockSessionSchema = z.object({
  version: z.literal(1),
  loop: z.string(),
  seed: z.number().int(),
  pace: z.union([z.literal(1), z.literal(1.5)]),
  phase: z.enum(['brief', 'round', 'review', 'done']),
  current: z.number().int().min(0),
  rounds: z.array(roundRecordSchema),
  finishedAt: z.number().nullable(),
});

export type MockSession = z.infer<typeof mockSessionSchema>;
export type RoundRecord = MockSession['rounds'][number];
export type ProblemRecord = RoundRecord['problems'][number];

/** The problem slugs of each round, in order: what a session must match. */
export type PlanSlugs = readonly (readonly string[])[];

export function newSession(loop: string, seed: number, plan: PlanSlugs): MockSession {
  return {
    version: 1,
    loop,
    seed,
    pace: 1,
    phase: 'brief',
    current: 0,
    rounds: plan.map((slugs) => ({
      startedAt: null,
      endedAt: null,
      pausedMs: 0,
      pausedAt: null,
      pauses: 0,
      timedOut: false,
      problems: slugs.map((slug) => ({ slug, hints: 0, tests: null, covered: [] })),
    })),
    finishedAt: null,
  };
}

/** True when a saved session belongs to this loop, seed and set of questions. */
export function matchesPlan(session: MockSession, plan: PlanSlugs): boolean {
  return (
    session.rounds.length === plan.length &&
    session.rounds.every(
      (round, index) =>
        round.problems.length === plan[index]?.length &&
        round.problems.every((problem, at) => problem.slug === plan[index]?.[at]),
    ) &&
    session.current < session.rounds.length
  );
}

/** The round's clock limit at the chosen pace. */
export function limitMs(minutes: number, pace: Pace): number {
  return Math.round(minutes * 60_000 * pace);
}

/** Clock time the round has run, pauses taken out. */
export function elapsedMs(round: RoundRecord, now: number): number {
  if (round.startedAt === null) return 0;
  const end = round.endedAt ?? now;
  const pausing = round.pausedAt === null ? 0 : Math.max(0, end - round.pausedAt);
  return Math.max(0, end - round.startedAt - round.pausedMs - pausing);
}

function mapRound(
  session: MockSession,
  index: number,
  change: (round: RoundRecord) => RoundRecord,
): MockSession {
  return {
    ...session,
    rounds: session.rounds.map((round, at) => (at === index ? change(round) : round)),
  };
}

function mapProblem(
  session: MockSession,
  roundIndex: number,
  problemIndex: number,
  change: (problem: ProblemRecord) => ProblemRecord,
): MockSession {
  return mapRound(session, roundIndex, (round) => ({
    ...round,
    problems: round.problems.map((problem, at) =>
      at === problemIndex ? change(problem) : problem,
    ),
  }));
}

export function setPace(session: MockSession, pace: Pace): MockSession {
  return session.phase === 'brief' ? { ...session, pace } : session;
}

/**
 * The next step: from the briefing, round 1 starts; from a review, the next
 * round starts, or the loop ends after the last one.
 */
export function advance(session: MockSession, now: number): MockSession {
  if (session.phase === 'brief') {
    return mapRound({ ...session, phase: 'round', current: 0 }, 0, (round) => ({
      ...round,
      startedAt: now,
    }));
  }
  if (session.phase !== 'review') return session;
  const next = session.current + 1;
  if (next >= session.rounds.length) return { ...session, phase: 'done', finishedAt: now };
  return mapRound({ ...session, phase: 'round', current: next }, next, (round) => ({
    ...round,
    startedAt: now,
  }));
}

export function pause(session: MockSession, now: number): MockSession {
  if (session.phase !== 'round') return session;
  return mapRound(session, session.current, (round) =>
    round.pausedAt === null ? { ...round, pausedAt: now, pauses: round.pauses + 1 } : round,
  );
}

export function resume(session: MockSession, now: number): MockSession {
  if (session.phase !== 'round') return session;
  return mapRound(session, session.current, (round) =>
    round.pausedAt === null
      ? round
      : { ...round, pausedMs: round.pausedMs + Math.max(0, now - round.pausedAt), pausedAt: null },
  );
}

/** Ends the running round: the learner stopped, or the clock ran out. */
export function endRound(session: MockSession, now: number, timedOut: boolean): MockSession {
  if (session.phase !== 'round') return session;
  const resumed = resume(session, now);
  return mapRound({ ...resumed, phase: 'review' }, session.current, (round) => ({
    ...round,
    endedAt: now,
    timedOut,
  }));
}

/** True when the running round has used its time. */
export function isTimeUp(session: MockSession, minutes: number, now: number): boolean {
  const round = session.rounds[session.current];
  return (
    session.phase === 'round' &&
    round !== undefined &&
    elapsedMs(round, now) >= limitMs(minutes, session.pace)
  );
}

export function takeHint(session: MockSession, problemIndex: number): MockSession {
  if (session.phase !== 'round') return session;
  return mapProblem(session, session.current, problemIndex, (problem) => ({
    ...problem,
    hints: problem.hints + 1,
  }));
}

/** Keeps the round's best Submit for a problem. A later, worse run does not undo it. */
export function recordTests(
  session: MockSession,
  problemIndex: number,
  passed: number,
  total: number,
): MockSession {
  if (session.phase !== 'round' || total <= 0) return session;
  const before = session.rounds[session.current]?.problems[problemIndex]?.tests;
  // The same session back for a result that is no better, so a repeated report is a no-op.
  if (before === undefined) return session;
  if (before !== null && passed / total <= before.passed / before.total) return session;
  return mapProblem(session, session.current, problemIndex, (problem) => ({
    ...problem,
    tests: { passed, total },
  }));
}

/** Ticks or clears a senior signal, in the review of a round that has ended. */
export function setCovered(
  session: MockSession,
  roundIndex: number,
  problemIndex: number,
  signal: number,
  covered: boolean,
): MockSession {
  const round = session.rounds[roundIndex];
  if (round === undefined || round.endedAt === null) return session;
  return mapProblem(session, roundIndex, problemIndex, (problem) => {
    const rest = problem.covered.filter((index) => index !== signal);
    return { ...problem, covered: covered ? [...rest, signal].sort((a, b) => a - b) : rest };
  });
}

/** Where this browser keeps a session. One per loop and seed. */
export function sessionKey(loop: string, seed: number): string {
  return `mock:${loop}:${seed}`;
}

/** The time of the session's last step: a start, a pause or an end. */
export function lastActivity(session: MockSession): number {
  return Math.max(
    0,
    ...session.rounds.flatMap((round) => [
      round.startedAt ?? 0,
      round.endedAt ?? 0,
      round.pausedAt ?? 0,
    ]),
  );
}

const SESSION_KEY = /^mock:[a-z0-9-]+:\d+$/;

/**
 * The sessions under way among stored entries: started, and not at the
 * scorecard yet. The most recent first. Code, drafts and the history are
 * stored under other keys, so they are left out.
 */
export function openSessions(entries: Iterable<readonly [string, string | null]>): MockSession[] {
  const open: MockSession[] = [];
  for (const [key, value] of entries) {
    if (!SESSION_KEY.test(key)) continue;
    const session = parseSession(value);
    if (session === null || session.phase === 'brief' || session.phase === 'done') continue;
    if (sessionKey(session.loop, session.seed) === key) open.push(session);
  }
  return open.sort((a, b) => lastActivity(b) - lastActivity(a));
}

/** A saved session, or null when there is none, or it is damaged or out of date. */
export function parseSession(text: string | null): MockSession | null {
  if (text === null) return null;
  try {
    const parsed = mockSessionSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    // A damaged entry is the same as no entry: the loop starts again.
    return null;
  }
}

const historyEntrySchema = z.object({
  loop: z.string(),
  name: z.string(),
  seed: z.number().int(),
  finishedAt: z.number(),
  score: z.number().min(0).max(1),
  verdict: z.string(),
  rounds: z.array(z.object({ name: z.string(), score: z.number().min(0).max(1) })),
});

export type MockHistoryEntry = z.infer<typeof historyEntrySchema>;

export const HISTORY_KEY = 'mock:history';

/** The scorecards this browser keeps: the most recent first. */
export const HISTORY_LIMIT = 20;

export function parseHistory(text: string | null): MockHistoryEntry[] {
  if (text === null) return [];
  try {
    const parsed = z.array(historyEntrySchema).safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : [];
  } catch {
    // A damaged history reads as empty, and the next finish writes a good one.
    return [];
  }
}

/** The history with `entry` first. Finishing the same session twice keeps one entry. */
export function addToHistory(
  history: readonly MockHistoryEntry[],
  entry: MockHistoryEntry,
): MockHistoryEntry[] {
  const others = history.filter((item) => !(item.loop === entry.loop && item.seed === entry.seed));
  return [entry, ...others].slice(0, HISTORY_LIMIT);
}
