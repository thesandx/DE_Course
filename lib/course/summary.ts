/**
 * One learner's numbers, derived once per page: XP and level, streaks,
 * solved counts, this week's goal and recent activity. Pure, so the shell,
 * the dashboard and the lesson page agree and the maths is tested without
 * Firestore. Everything comes from the stored record and the catalogue.
 */

import { getLesson, getProblem, PROBLEMS, totalXp } from '@/lib/course/catalog';
import {
  activityGrid,
  bestStreak,
  type Level,
  levelFor,
  type ProgressRecord,
  streak,
} from '@/lib/course/progress';

/** Problems a learner aims to solve each week. The weekly milestone card counts toward it. */
export const WEEKLY_GOAL = 5;

/** How many weeks the study calendar shows. */
export const CALENDAR_WEEKS = 16;

export interface RecentItem {
  id: string;
  kind: 'lesson' | 'problem';
  title: string;
  href: string;
  day: string;
  /** Whole days between `day` and today. */
  daysAgo: number;
}

export interface LearnerSummary {
  xp: number;
  level: Level;
  /** 0 to 1: progress from this level to the next. 1 at the top level. */
  levelRatio: number;
  streak: number;
  bestStreak: number;
  solved: number;
  totalProblems: number;
  /** Days with any activity in the calendar window. */
  activeDays: number;
  /** Items finished in the calendar window. */
  itemsInWindow: number;
  /** Problems solved since Monday of this week. */
  solvedThisWeek: number;
  recent: RecentItem[];
}

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Monday of the week that holds `day`, as `YYYY-MM-DD`. */
export function mondayOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** The catalogue title and link for an item id, or undefined if the item no longer exists. */
function describe(
  id: string,
): { kind: RecentItem['kind']; title: string; href: string } | undefined {
  const [kind, first, second] = id.split(':');
  if (kind === 'lesson' && first !== undefined && second !== undefined) {
    const found = getLesson(first, second);
    return found && { kind, title: found.lesson.title, href: `/tracks/${first}/${second}` };
  }
  if (kind === 'problem' && first !== undefined) {
    const problem = getProblem(first);
    return problem && { kind, title: problem.title, href: `/problems/${first}` };
  }
  return undefined;
}

export function summarize(record: ProgressRecord, today: string, recentCount = 3): LearnerSummary {
  const xp = totalXp(record.done);
  const level = levelFor(xp);
  const levelRatio = level.to === null ? 1 : (xp - level.from) / (level.to - level.from);

  const grid = activityGrid(record.days, today, CALENDAR_WEEKS).flat();
  const monday = mondayOf(today);

  const entries = Object.entries(record.done);
  const solvedIds = new Set(PROBLEMS.map((problem) => `problem:${problem.slug}`));
  const solved = entries.filter(([id]) => solvedIds.has(id));

  const recent = entries
    .sort(([idA, dayA], [idB, dayB]) => dayB.localeCompare(dayA) || idA.localeCompare(idB))
    .flatMap(([id, day]) => {
      const item = describe(id);
      return item === undefined ? [] : [{ id, day, daysAgo: daysBetween(day, today), ...item }];
    })
    .slice(0, recentCount);

  return {
    xp,
    level,
    levelRatio,
    streak: streak(record.days, today),
    bestStreak: bestStreak(record.days),
    solved: solved.length,
    totalProblems: PROBLEMS.length,
    activeDays: grid.filter((cell) => cell.count > 0).length,
    itemsInWindow: grid.reduce((sum, cell) => sum + cell.count, 0),
    solvedThisWeek: solved.filter(([, day]) => day >= monday && day <= today).length,
    recent,
  };
}

/** "today", "1d", "3d": how long ago, in the short form the activity list uses. */
export function agoLabel(daysAgo: number): string {
  return daysAgo <= 0 ? 'today' : `${daysAgo}d`;
}
