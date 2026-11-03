/**
 * The course catalogue: every track, lesson, problem and company guide, and
 * the lookups and statistics that pages need. Pure data and pure functions.
 *
 * The order of `TRACKS` is the recommended study order.
 */

import { COMPANIES } from '@/lib/course/companies';
import { type DoneMap, LESSON_XP, lessonId, PROBLEM_XP, problemId } from '@/lib/course/progress';
import * as architecture from '@/lib/course/tracks/architecture';
import * as behavioral from '@/lib/course/tracks/behavioral';
import * as dbt from '@/lib/course/tracks/dbt';
import * as lakehouse from '@/lib/course/tracks/lakehouse';
import * as modeling from '@/lib/course/tracks/modeling';
import * as orchestration from '@/lib/course/tracks/orchestration';
import * as playbook from '@/lib/course/tracks/playbook';
import * as python from '@/lib/course/tracks/python';
import * as quality from '@/lib/course/tracks/quality';
import * as snowflakeDatabricks from '@/lib/course/tracks/snowflake-databricks';
import * as spark from '@/lib/course/tracks/spark';
import * as sql from '@/lib/course/tracks/sql';
import * as streaming from '@/lib/course/tracks/streaming';
import * as systemDesign from '@/lib/course/tracks/system-design';
import type { Company, CompanyGuide, Difficulty, Lesson, Problem, Track } from '@/types/course';

const MODULES = [
  playbook,
  sql,
  python,
  modeling,
  spark,
  orchestration,
  dbt,
  streaming,
  lakehouse,
  snowflakeDatabricks,
  quality,
  architecture,
  systemDesign,
  behavioral,
] as const;

export const TRACKS: readonly Track[] = MODULES.map((module) => module.track);

export const PROBLEMS: readonly Problem[] = MODULES.flatMap((module) => module.problems);

export function getTrack(slug: string): Track | undefined {
  return TRACKS.find((track) => track.slug === slug);
}

export function getLesson(
  trackSlug: string,
  lessonSlug: string,
): { track: Track; lesson: Lesson; index: number } | undefined {
  const track = getTrack(trackSlug);
  if (track === undefined) return undefined;
  const index = track.lessons.findIndex((lesson) => lesson.slug === lessonSlug);
  const lesson = track.lessons[index];
  return lesson === undefined ? undefined : { track, lesson, index };
}

export function getProblem(slug: string): Problem | undefined {
  return PROBLEMS.find((problem) => problem.slug === slug);
}

export function problemsForTrack(trackSlug: string): Problem[] {
  return PROBLEMS.filter((problem) => problem.track === trackSlug);
}

export function getCompany(slug: string): CompanyGuide | undefined {
  return COMPANIES.find((company) => company.slug === slug);
}

/** XP for one item id, or 0 for an id the catalogue does not know. */
export function xpForItem(itemId: string): number {
  const [kind, first, second] = itemId.split(':');
  if (kind === 'lesson' && first !== undefined && second !== undefined) {
    return getLesson(first, second) === undefined ? 0 : LESSON_XP;
  }
  if (kind === 'problem' && first !== undefined) {
    const problem = getProblem(first);
    return problem === undefined ? 0 : PROBLEM_XP[problem.difficulty];
  }
  return 0;
}

/** True when the id names a lesson or problem that exists. The API accepts nothing else. */
export function isKnownItem(itemId: string): boolean {
  return xpForItem(itemId) > 0;
}

export function totalXp(done: DoneMap): number {
  return Object.keys(done).reduce((sum, id) => sum + xpForItem(id), 0);
}

export interface TrackProgress {
  lessonsDone: number;
  lessonsTotal: number;
  problemsDone: number;
  problemsTotal: number;
  /** 0 to 1, lessons and problems weighted equally per item. */
  ratio: number;
}

export function trackProgress(track: Track, done: DoneMap): TrackProgress {
  const lessonsDone = track.lessons.filter(
    (lesson) => done[lessonId(track.slug, lesson.slug)] !== undefined,
  ).length;
  const problems = problemsForTrack(track.slug);
  const problemsDone = problems.filter(
    (problem) => done[problemId(problem.slug)] !== undefined,
  ).length;
  const total = track.lessons.length + problems.length;
  return {
    lessonsDone,
    lessonsTotal: track.lessons.length,
    problemsDone,
    problemsTotal: problems.length,
    ratio: total === 0 ? 0 : (lessonsDone + problemsDone) / total,
  };
}

export type SolvedByDifficulty = Record<Difficulty, { done: number; total: number }>;

export function solvedByDifficulty(done: DoneMap): SolvedByDifficulty {
  const result: SolvedByDifficulty = {
    easy: { done: 0, total: 0 },
    medium: { done: 0, total: 0 },
    hard: { done: 0, total: 0 },
  };
  for (const problem of PROBLEMS) {
    result[problem.difficulty].total += 1;
    if (done[problemId(problem.slug)] !== undefined) result[problem.difficulty].done += 1;
  }
  return result;
}

/** Readiness for one company's loop: track progress weighted by what that loop tests. 0 to 1. */
export function readiness(company: CompanyGuide, done: DoneMap): number {
  let weighted = 0;
  let weights = 0;
  for (const track of TRACKS) {
    const weight = company.weights[track.slug] ?? 0;
    if (weight <= 0) continue;
    weighted += weight * trackProgress(track, done).ratio;
    weights += weight;
  }
  return weights === 0 ? 0 : weighted / weights;
}

export interface NextStep {
  track: Track;
  lesson: Lesson;
}

/** The first unfinished lesson in study order, or undefined when every lesson is done. */
export function nextLesson(done: DoneMap): NextStep | undefined {
  for (const track of TRACKS) {
    const lesson = track.lessons.find(
      (item) => done[lessonId(track.slug, item.slug)] === undefined,
    );
    if (lesson !== undefined) return { track, lesson };
  }
  return undefined;
}

export const COMPANY_NAMES: Readonly<Record<Company, string>> = {
  uber: 'Uber',
  google: 'Google',
};

export const KIND_LABELS: Readonly<Record<Problem['kind'], string>> = {
  sql: 'SQL',
  coding: 'Coding',
  design: 'System design',
  modeling: 'Data modeling',
  concept: 'Concepts',
  behavioral: 'Behavioral',
};

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export { COMPANIES };
