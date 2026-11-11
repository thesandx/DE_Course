/**
 * Pure maths for the study streak map on the home page.
 *
 * The learner document holds `studyTime`: day (`YYYY-MM-DD`) → seconds the
 * learner spent on a course page that day, in their local day. Each course
 * tracker also holds `days`: day → items finished. The map joins both, so a
 * day before time tracking existed still shows as studied when the learner
 * finished something on it.
 */

import { COURSE_SLUGS } from '@/lib/course/courses';
import { type DayMap, type LearnerRecord, MAX_DAYS_KEPT } from '@/lib/course/progress';

/** Seconds studied on each day (`YYYY-MM-DD` → seconds). */
export type StudyTimeMap = Readonly<Record<string, number>>;

/** The most one report from the browser may add. The browser reports about once a minute. */
export const MAX_SECONDS_PER_REPORT = 300;

/** A day has 86 400 seconds. No total for one day can be larger. */
export const MAX_SECONDS_PER_DAY = 86_400;

/** A day counts as studied from one minute, so opening a page for a moment does not count. */
export const ACTIVE_DAY_SECONDS = 60;

/** The map shows 53 weeks, the same span as a contribution graph. */
export const STUDY_MAP_WEEKS = 53;

const DAY_MS = 86_400_000;

function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Adds `seconds` to `day`. Returns a new map; the input is not changed. A day
 * is capped at 24 hours, and the map keeps the newest `MAX_DAYS_KEPT` days, so
 * the learner document stays bounded.
 */
export function applyStudyTime(
  map: StudyTimeMap | undefined,
  day: string,
  seconds: number,
): StudyTimeMap {
  const next: Record<string, number> = { ...map };
  const added = Math.max(0, Math.min(Math.round(seconds), MAX_SECONDS_PER_REPORT));
  next[day] = Math.min((next[day] ?? 0) + added, MAX_SECONDS_PER_DAY);
  const kept = Object.keys(next).sort().slice(-MAX_DAYS_KEPT);
  const trimmed: Record<string, number> = {};
  for (const key of kept) trimmed[key] = next[key] ?? 0;
  return trimmed;
}

/** Adds study time to a learner record. Returns a new record. */
export function applyLearnerStudyTime(
  record: LearnerRecord,
  day: string,
  seconds: number,
): LearnerRecord {
  return { ...record, studyTime: applyStudyTime(record.studyTime, day, seconds) };
}

/** Items finished per day, summed over every course the learner has a tracker for. */
export function itemsPerDay(record: LearnerRecord): DayMap {
  const total: Record<string, number> = {};
  for (const slug of COURSE_SLUGS) {
    const days = record.courses[slug]?.days ?? {};
    for (const [day, count] of Object.entries(days)) total[day] = (total[day] ?? 0) + count;
  }
  return total;
}

/** What the home page sends to the map: the two raw maps, small enough to ship as props. */
export interface StudyActivity {
  seconds: StudyTimeMap;
  items: DayMap;
}

export function studyActivity(record: LearnerRecord): StudyActivity {
  return { seconds: record.studyTime ?? {}, items: itemsPerDay(record) };
}

export interface StudyDay {
  day: string;
  seconds: number;
  items: number;
  /** 0 (nothing) to 4 (an hour or more). */
  level: 0 | 1 | 2 | 3 | 4;
  /** True when the day is after `today`, in the last column only. */
  future: boolean;
}

export interface StudyWeek {
  days: StudyDay[];
  /** The short month name when this week holds the 1st of a month, else null. */
  month: string | null;
}

export interface StudyMap {
  weeks: StudyWeek[];
  activeDays: number;
  totalSeconds: number;
  /** Days in a row ending today, or yesterday when today has nothing yet. */
  currentStreak: number;
  longestStreak: number;
}

export function isActive(seconds: number, items: number): boolean {
  return seconds >= ACTIVE_DAY_SECONDS || items > 0;
}

/**
 * The colour step for a day. Time decides it: 15 minutes, 30 minutes and an
 * hour are the steps. A day with a finished item but too little tracked time,
 * such as a day before tracking began, gets the first step.
 */
export function studyLevel(seconds: number, items: number): StudyDay['level'] {
  if (seconds >= 3600) return 4;
  if (seconds >= 1800) return 3;
  if (seconds >= 900) return 2;
  return isActive(seconds, items) ? 1 : 0;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * The last `weeks` weeks as columns of seven days, Monday first, ending with
 * the week that holds `today`. Days after today are kept, marked `future`, so
 * every column has seven cells and the rows line up with their labels.
 */
export function buildStudyMap(
  activity: StudyActivity,
  today: string,
  weeks: number = STUDY_MAP_WEEKS,
): StudyMap {
  const mondayOffset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(today, -mondayOffset - (weeks - 1) * 7);
  const columns: StudyWeek[] = [];
  let activeDays = 0;
  let totalSeconds = 0;
  let longestStreak = 0;
  let run = 0;

  for (let w = 0; w < weeks; w += 1) {
    const days: StudyDay[] = [];
    let month: string | null = null;
    for (let d = 0; d < 7; d += 1) {
      const day = addDays(start, w * 7 + d);
      const future = day > today;
      const seconds = future ? 0 : (activity.seconds[day] ?? 0);
      const items = future ? 0 : (activity.items[day] ?? 0);
      if (day.endsWith('-01')) month = MONTHS[Number(day.slice(5, 7)) - 1] ?? null;
      if (!future) {
        totalSeconds += seconds;
        if (isActive(seconds, items)) {
          activeDays += 1;
          run += 1;
          longestStreak = Math.max(longestStreak, run);
        } else {
          run = 0;
        }
      }
      days.push({ day, seconds, items, level: studyLevel(seconds, items), future });
    }
    columns.push({ days, month });
  }

  return {
    weeks: columns,
    activeDays,
    totalSeconds,
    currentStreak: currentStreak(activity, today),
    longestStreak,
  };
}

function currentStreak(activity: StudyActivity, today: string): number {
  const active = (day: string): boolean =>
    isActive(activity.seconds[day] ?? 0, activity.items[day] ?? 0);
  let cursor = active(today) ? today : addDays(today, -1);
  let count = 0;
  while (active(cursor) && count <= MAX_DAYS_KEPT) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** `1h 20m`, `45m`, `under 1m`. */
export function formatStudyTime(seconds: number): string {
  if (seconds < ACTIVE_DAY_SECONDS) return seconds > 0 ? 'under 1m' : '0m';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** `Wed, 11 Nov 2026`, for the line under the map. Formatted in UTC so the day never shifts. */
export function formatStudyDay(day: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

/** One sentence for a day: what the learner did, for the detail line and screen readers. */
export function describeStudyDay(cell: Pick<StudyDay, 'day' | 'seconds' | 'items'>): string {
  const date = formatStudyDay(cell.day);
  const parts: string[] = [];
  if (cell.seconds >= ACTIVE_DAY_SECONDS) parts.push(`${formatStudyTime(cell.seconds)} studied`);
  if (cell.items > 0) parts.push(`${cell.items} ${cell.items === 1 ? 'item' : 'items'} finished`);
  return parts.length === 0 ? `${date}: no study` : `${date}: ${parts.join(', ')}`;
}
