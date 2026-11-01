/**
 * Pure progress maths: item ids, XP, levels, streaks and the activity grid.
 *
 * The service in `services/progress.service.ts` stores a learner's raw record
 * (what they finished, and on which days). Everything a page shows is derived
 * here from that record and the catalogue, so it is tested without Firestore
 * and never drifts between the server and the screen.
 */

import type { Difficulty } from '@/types/course';

/** What a learner has finished: item id → the day they finished it (`YYYY-MM-DD`). */
export type DoneMap = Readonly<Record<string, string>>;

/** How many items a learner finished on each day (`YYYY-MM-DD` → count). */
export type DayMap = Readonly<Record<string, number>>;

export interface ProgressRecord {
  done: DoneMap;
  days: DayMap;
}

export const EMPTY_PROGRESS: ProgressRecord = { done: {}, days: {} };

/** The activity grid keeps about thirteen months. Older days drop off on the next write. */
export const MAX_DAYS_KEPT = 400;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function lessonId(track: string, lesson: string): string {
  return `lesson:${track}:${lesson}`;
}

export function problemId(slug: string): string {
  return `problem:${slug}`;
}

export const LESSON_XP = 40;

export const PROBLEM_XP: Readonly<Record<Difficulty, number>> = {
  easy: 20,
  medium: 40,
  hard: 60,
};

export interface Level {
  /** 1-based. */
  number: number;
  title: string;
  /** XP where this level starts. */
  from: number;
  /** XP where the next level starts, or null at the top. */
  to: number | null;
}

/** Titles follow a data engineer's career, so the next level is a promotion. */
const LEVELS: ReadonlyArray<{ title: string; from: number }> = [
  { title: 'Intern', from: 0 },
  { title: 'Data analyst', from: 150 },
  { title: 'Data engineer I', from: 400 },
  { title: 'Data engineer II', from: 900 },
  { title: 'Senior data engineer', from: 1700 },
  { title: 'Staff data engineer', from: 2900 },
  { title: 'Principal data engineer', from: 4500 },
];

export function levelFor(xp: number): Level {
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (xp >= level.from) index = i;
  });
  const current = LEVELS[index] ?? { title: 'Intern', from: 0 };
  const next = LEVELS[index + 1];
  return { number: index + 1, title: current.title, from: current.from, to: next?.from ?? null };
}

/** `YYYY-MM-DD` for a date in UTC. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return isoDay(date);
}

/**
 * Accepts the learner's local day if it is within one day of the server's UTC
 * day, which covers every time zone. Anything else falls back to UTC, so a
 * client cannot invent activity on arbitrary dates.
 */
export function trustedDay(clientDay: string | undefined, now: Date): string {
  const today = isoDay(now);
  if (clientDay === undefined || !DAY.test(clientDay)) return today;
  return clientDay === today || clientDay === addDays(today, -1) || clientDay === addDays(today, 1)
    ? clientDay
    : today;
}

/**
 * Days in a row with activity, ending today or yesterday. A streak survives
 * until the end of the day after the last activity, so it does not reset at
 * midnight before the learner had a chance to study.
 */
export function streak(days: DayMap, today: string): number {
  let cursor = (days[today] ?? 0) > 0 ? today : addDays(today, -1);
  let count = 0;
  while ((days[cursor] ?? 0) > 0) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** The longest run of active days in the record. */
export function bestStreak(days: DayMap): number {
  const active = Object.keys(days)
    .filter((day) => (days[day] ?? 0) > 0)
    .sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of active) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export interface GridDay {
  day: string;
  count: number;
}

/**
 * The last `weeks` weeks as columns of seven days, Monday first, ending with
 * the week that holds `today`. Days after today are left out of the last column.
 */
export function activityGrid(days: DayMap, today: string, weeks: number): GridDay[][] {
  const date = new Date(`${today}T00:00:00Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const start = addDays(today, -mondayOffset - (weeks - 1) * 7);
  const columns: GridDay[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    const column: GridDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const day = addDays(start, w * 7 + d);
      if (day > today) break;
      column.push({ day, count: days[day] ?? 0 });
    }
    columns.push(column);
  }
  return columns;
}

/**
 * Applies one completion or undo to a record. Returns a new record; the input
 * is not changed. Finishing an item twice counts once. Undoing removes the
 * item but keeps the day's activity, because the learner did study that day.
 */
export function applyCompletion(
  record: ProgressRecord,
  itemId: string,
  done: boolean,
  day: string,
): ProgressRecord {
  const nextDone: Record<string, string> = { ...record.done };
  const nextDays: Record<string, number> = { ...record.days };

  if (done) {
    if (nextDone[itemId] !== undefined) return record;
    nextDone[itemId] = day;
    nextDays[day] = (nextDays[day] ?? 0) + 1;
  } else {
    if (nextDone[itemId] === undefined) return record;
    delete nextDone[itemId];
  }

  const kept = Object.keys(nextDays).sort().slice(-MAX_DAYS_KEPT);
  const trimmed: Record<string, number> = {};
  for (const key of kept) trimmed[key] = nextDays[key] ?? 0;

  return { done: nextDone, days: trimmed };
}
