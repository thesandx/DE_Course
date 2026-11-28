import { COMPANIES, PROBLEMS } from '@/lib/course/catalog';
import { MOCK } from '@/lib/course/mock-slots';
import type { Company, CompanyGuide, Difficulty, MockSlot, Problem } from '@/types/course';

/**
 * Timed mock loops: a run of rounds, each with its own clock and one to three
 * questions drawn from the catalogue. A company loop asks what that company's
 * rounds ask (`LoopRound.mock`). Four general loops cover the usual senior
 * and staff shapes, a one-hour practice and a speed screen.
 *
 * A seed picks the questions, so one URL always shows the same loop: a refresh
 * keeps the learner's place, and "retry" asks the same questions again.
 */

export interface MockRound {
  name: string;
  minutes: number;
  /** What the round tests, in the course Markdown dialect. */
  focus: string;
  tracks: readonly string[];
  slots: readonly MockSlot[];
}

export interface MockLoop {
  slug: string;
  name: string;
  summary: string;
  /** The company whose loop this is. Absent on a general loop. */
  company?: Company;
  rounds: readonly MockRound[];
}

const DESIGN_TRACKS = [
  'system-design',
  'streaming',
  'lakehouse',
  'databases',
  'quality',
  'orchestration',
] as const;

const GENERAL_LOOPS: readonly MockLoop[] = [
  {
    slug: 'quick',
    name: 'One-hour practice loop',
    summary:
      'Three short rounds for a day with one free hour: a SQL problem, a coding problem and a design outline.',
    rounds: [
      {
        name: 'SQL',
        minutes: 20,
        focus:
          'One SQL problem. Read the tables, say the grain of the result, then write the query.',
        tracks: ['sql'],
        slots: [MOCK.sql],
      },
      {
        name: 'Coding',
        minutes: 20,
        focus:
          'One Python or algorithms problem. Say the approach and its complexity before you type.',
        tracks: ['python', 'dsa'],
        slots: [MOCK.coding],
      },
      {
        name: 'Design outline',
        minutes: 20,
        focus:
          'One design question, in outline: the requirements, the numbers, the main parts and one failure.',
        tracks: DESIGN_TRACKS,
        slots: [MOCK.design],
      },
    ],
  },
  {
    slug: 'senior',
    name: 'Senior data engineer loop',
    summary:
      'The usual shape of a senior loop: SQL, coding, PySpark, data modeling, system design and stories.',
    rounds: [
      {
        name: 'SQL',
        minutes: 45,
        focus:
          'Two SQL problems of rising difficulty: window functions, joins and NULL edge cases.',
        tracks: ['sql'],
        slots: [MOCK.sql, MOCK.sql],
      },
      {
        name: 'Coding',
        minutes: 45,
        focus:
          'A Python data task and an algorithms problem. Clean code, the complexity, and tests.',
        tracks: ['python', 'dsa'],
        slots: [MOCK.python, MOCK.dsa],
      },
      {
        name: 'PySpark',
        minutes: 45,
        focus: 'Two DataFrame exercises: joins, windows, and the plan that Spark runs.',
        tracks: ['spark'],
        slots: [MOCK.spark, MOCK.spark],
      },
      {
        name: 'Data modeling',
        minutes: 45,
        focus:
          'Model a business process: the grain, facts, dimensions and history. Then query your model.',
        tracks: ['modeling'],
        slots: [MOCK.modeling],
      },
      {
        name: 'System design',
        minutes: 60,
        focus:
          'A pipeline end to end: requirements, scale, the parts, the failure modes and the cost.',
        tracks: DESIGN_TRACKS,
        slots: [MOCK.design],
      },
      {
        name: 'Behavioral',
        minutes: 45,
        focus: 'Two stories at senior scope: ownership, conflict, ambiguity and impact.',
        tracks: ['behavioral'],
        slots: [MOCK.behavioral, MOCK.behavioral],
      },
    ],
  },
  {
    slug: 'staff',
    name: 'Staff data engineer loop',
    summary:
      'Less coding, more design: a staff loop tests strategy, depth and leadership across teams.',
    rounds: [
      {
        name: 'Coding and SQL',
        minutes: 45,
        focus: 'One SQL problem and one Python problem. The bar is correct, clean and quick.',
        tracks: ['sql', 'python'],
        slots: [MOCK.sql, MOCK.python],
      },
      {
        name: 'System design',
        minutes: 60,
        focus:
          'A large design that several teams use: contracts, scale, failure and cost over years.',
        tracks: [...DESIGN_TRACKS, 'snowflake-databricks', 'ai'],
        slots: [MOCK.design],
      },
      {
        name: 'Architecture and strategy',
        minutes: 60,
        focus:
          'A platform, a migration or a build-or-buy decision: the trade-offs, a plan in steps, and how you measure it.',
        tracks: ['staff', 'architecture'],
        slots: [MOCK.architecture],
      },
      {
        name: 'Deep dive',
        minutes: 45,
        focus:
          'Three questions on how the engines work underneath. Expect "and then what happens?" after each answer.',
        tracks: ['spark', 'streaming', 'databases', 'lakehouse'],
        slots: [MOCK.deepDive, MOCK.deepDive, MOCK.deepDive],
      },
      {
        name: 'Leadership',
        minutes: 45,
        focus:
          'Two stories at staff scope: influence without authority, raising the bar, a hard decision.',
        tracks: ['staff', 'behavioral'],
        slots: [MOCK.leadership, MOCK.leadership],
      },
    ],
  },
  {
    slug: 'speed-screen',
    name: 'Speed screen: 5 SQL and 5 Python',
    summary:
      'The fast technical screen that Meta and others use: ten short problems in an hour, where speed and correct edge cases decide.',
    rounds: [
      {
        name: 'SQL',
        minutes: 30,
        focus:
          'Five short SQL problems, about six minutes each. Write the query, run it once, move on. A pass needs four of five correct.',
        tracks: ['sql'],
        slots: [MOCK.quickSql, MOCK.quickSql, MOCK.quickSql, MOCK.quickSql, MOCK.quickSql],
      },
      {
        name: 'Python',
        minutes: 30,
        focus:
          'Five short Python problems on dictionaries, lists and strings. No libraries beyond the standard library. Say the complexity in one sentence.',
        tracks: ['python'],
        slots: [
          MOCK.quickPython,
          MOCK.quickPython,
          MOCK.quickPython,
          MOCK.quickPython,
          MOCK.quickPython,
        ],
      },
    ],
  },
];

function fromCompany(guide: CompanyGuide): MockLoop {
  return {
    slug: guide.slug,
    name: `${guide.name} loop`,
    summary: guide.summary,
    company: guide.slug,
    rounds: guide.rounds.flatMap((round) =>
      round.mock === undefined
        ? []
        : [
            {
              name: round.name,
              minutes: round.minutes,
              focus: round.focus,
              tracks: round.tracks,
              slots: round.mock,
            },
          ],
    ),
  };
}

/** The general loops first, then one per company guide. */
export const MOCK_LOOPS: readonly MockLoop[] = [...GENERAL_LOOPS, ...COMPANIES.map(fromCompany)];

export function getMockLoop(slug: string): MockLoop | undefined {
  return MOCK_LOOPS.find((loop) => loop.slug === slug);
}

/** The loop's clock time at interview pace. */
export function loopMinutes(loop: MockLoop): number {
  return loop.rounds.reduce((sum, round) => sum + round.minutes, 0);
}

/** Every problem a slot of this round can ask. */
export function slotPool(slot: MockSlot, round: MockRound): Problem[] {
  const tracks = slot.tracks ?? round.tracks;
  return PROBLEMS.filter(
    (problem) =>
      slot.kinds.includes(problem.kind) &&
      tracks.includes(problem.track) &&
      (slot.difficulties === undefined || slot.difficulties.includes(problem.difficulty)),
  );
}

/** A seeded random source (mulberry32): the same seed gives the same numbers. */
function randomSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A senior loop asks few easy questions. Medium and hard come up three times as often. */
const WEIGHTS: Readonly<Record<Difficulty, number>> = { easy: 1, medium: 3, hard: 3 };

function weightedPick(pool: readonly Problem[], next: () => number): Problem {
  const total = pool.reduce((sum, problem) => sum + WEIGHTS[problem.difficulty], 0);
  let mark = next() * total;
  for (const problem of pool) {
    mark -= WEIGHTS[problem.difficulty];
    if (mark < 0) return problem;
  }
  const last = pool[pool.length - 1];
  if (last === undefined) throw new Error('A mock slot has no problem to ask.');
  return last;
}

export interface PlannedRound {
  round: MockRound;
  problems: readonly Problem[];
}

const RANK: Readonly<Record<Difficulty, number>> = { easy: 0, medium: 1, hard: 2 };

/**
 * Questions drawn for a run of the same slot come easiest first, as an
 * interviewer warms up: "two SQL problems of rising difficulty".
 */
function easiestFirst(slots: readonly MockSlot[], problems: readonly Problem[]): Problem[] {
  const ordered = [...problems];
  let start = 0;
  while (start < slots.length) {
    let end = start + 1;
    while (end < slots.length && slots[end]?.label === slots[start]?.label) end += 1;
    const run = ordered.slice(start, end).sort((a, b) => RANK[a.difficulty] - RANK[b.difficulty]);
    ordered.splice(start, run.length, ...run);
    start = end;
  }
  return ordered;
}

/**
 * The questions of a loop for a seed. A loop never asks one problem twice
 * while its slots have others left.
 */
export function planMock(loop: MockLoop, seed: number): PlannedRound[] {
  const next = randomSource(seed);
  const used = new Set<string>();
  return loop.rounds.map((round) => ({
    round,
    problems: easiestFirst(
      round.slots,
      round.slots.map((slot) => {
        const pool = slotPool(slot, round);
        const fresh = pool.filter((problem) => !used.has(problem.slug));
        const problem = weightedPick(fresh.length > 0 ? fresh : pool, next);
        used.add(problem.slug);
        return problem;
      }),
    ),
  }));
}

/** Seeds are positive 31-bit integers, so they stay short in a URL. */
const MAX_SEED = 2 ** 31 - 1;

/** The seed in a `?seed=` value, or null when it is missing or not a seed. */
export function parseSeed(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return null;
  const seed = Number(value);
  return seed >= 1 && seed <= MAX_SEED ? seed : null;
}

/** `count` fresh random seeds, from the platform's cryptographic source. */
export function randomSeeds(count: number): number[] {
  const values = crypto.getRandomValues(new Uint32Array(count));
  return Array.from(values, (value) => (value % MAX_SEED) + 1);
}

/**
 * Of the candidate seeds, the one whose loop asks the most problems the
 * learner has not solved yet, so a new mock feels new. Ties go to the first.
 */
export function chooseSeed(
  loop: MockLoop,
  candidates: readonly number[],
  solved: (slug: string) => boolean,
): number {
  let best = candidates[0] ?? 1;
  let bestFresh = -1;
  for (const seed of candidates) {
    const fresh = planMock(loop, seed)
      .flatMap((planned) => planned.problems)
      .filter((problem) => !solved(problem.slug)).length;
    if (fresh > bestFresh) {
      best = seed;
      bestFresh = fresh;
    }
  }
  return best;
}
