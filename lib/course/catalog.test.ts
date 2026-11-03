import { describe, expect, it } from 'vitest';

import {
  COMPANIES,
  getCompany,
  getLesson,
  getProblem,
  getTrack,
  isKnownItem,
  nextLesson,
  PROBLEMS,
  problemsForTrack,
  readiness,
  solvedByDifficulty,
  totalXp,
  trackProgress,
  TRACKS,
  xpForItem,
} from './catalog';
import { parseMarkdown } from './markdown';
import { LESSON_XP, lessonId, PROBLEM_XP, problemId } from './progress';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Every prose field in the catalogue, with a label that names it in a failure. */
function proseFields(): Array<[string, string]> {
  const fields: Array<[string, string]> = [];
  for (const track of TRACKS) {
    for (const lesson of track.lessons) {
      fields.push([`lesson ${track.slug}/${lesson.slug}`, lesson.body]);
    }
  }
  for (const problem of PROBLEMS) {
    fields.push([`problem ${problem.slug} prompt`, problem.prompt]);
    fields.push([`problem ${problem.slug} answer`, problem.answer]);
  }
  for (const company of COMPANIES) {
    fields.push([`company ${company.slug}`, company.overview]);
    for (const round of company.rounds) fields.push([`round ${round.name}`, round.focus]);
  }
  return fields;
}

describe('catalogue integrity', () => {
  it('has twelve tracks with unique, URL-safe slugs', () => {
    const slugs = TRACKS.map((track) => track.slug);
    expect(slugs).toHaveLength(12);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(SLUG);
  });

  it('has unique lesson slugs inside each track, and every lesson has a check', () => {
    for (const track of TRACKS) {
      const slugs = track.lessons.map((lesson) => lesson.slug);
      expect(new Set(slugs).size, track.slug).toBe(slugs.length);
      for (const lesson of track.lessons) {
        expect(lesson.slug).toMatch(SLUG);
        expect(lesson.checks.length, lesson.slug).toBeGreaterThan(0);
        expect(lesson.minutes).toBeGreaterThan(0);
      }
    }
  });

  it('points every check answer at a real option', () => {
    for (const track of TRACKS) {
      for (const lesson of track.lessons) {
        for (const check of lesson.checks) {
          expect(check.options.length, check.question).toBeGreaterThanOrEqual(2);
          expect(check.options[check.answer], check.question).toBeDefined();
        }
      }
    }
  });

  it('has unique problem slugs, each in a real track and asked by a real company', () => {
    const slugs = PROBLEMS.map((problem) => problem.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const problem of PROBLEMS) {
      expect(problem.slug).toMatch(SLUG);
      expect(getTrack(problem.track), problem.slug).toBeDefined();
      expect(problem.companies.length, problem.slug).toBeGreaterThan(0);
      expect(problem.hints.length, problem.slug).toBeGreaterThan(0);
      expect(problem.signals.length, problem.slug).toBeGreaterThan(0);
    }
  });

  it('gives every track at least four problems', () => {
    for (const track of TRACKS) {
      expect(problemsForTrack(track.slug).length, track.slug).toBeGreaterThanOrEqual(4);
    }
  });

  it('names only real tracks in company rounds and weights', () => {
    for (const company of COMPANIES) {
      for (const round of company.rounds) {
        for (const slug of round.tracks) expect(getTrack(slug), round.name).toBeDefined();
      }
      for (const slug of Object.keys(company.weights)) {
        expect(getTrack(slug), `${company.slug} weight`).toBeDefined();
      }
    }
  });

  it('writes prose that parses cleanly', () => {
    for (const [label, text] of proseFields()) {
      const fences = text.split('\n').filter((line) => line.trim().startsWith('~~~')).length;
      expect(fences % 2, `${label}: unclosed code fence`).toBe(0);
      expect(text.split('«').length, `${label}: unbalanced «»`).toBe(text.split('»').length);
      expect(text.includes('`'), `${label}: backtick`).toBe(false);
      expect(parseMarkdown(text).length, label).toBeGreaterThan(0);
    }
  });
});

describe('lookups', () => {
  it('finds tracks, lessons, problems and companies', () => {
    expect(getTrack('sql')?.title).toBeDefined();
    expect(getTrack('cobol')).toBeUndefined();
    const found = getLesson('sql', 'window-functions');
    expect(found?.index).toBe(0);
    expect(getLesson('sql', 'nope')).toBeUndefined();
    expect(getLesson('nope', 'window-functions')).toBeUndefined();
    expect(getProblem('not-in-null-trap')?.track).toBe('sql');
    expect(getCompany('uber')?.name).toBe('Uber');
  });
});

describe('XP and progress', () => {
  it('prices items by kind and difficulty, and knows only real items', () => {
    const problem = PROBLEMS[0];
    if (problem === undefined) throw new Error('no problems');
    expect(xpForItem(lessonId('sql', 'window-functions'))).toBe(LESSON_XP);
    expect(xpForItem(problemId(problem.slug))).toBe(PROBLEM_XP[problem.difficulty]);
    expect(xpForItem('lesson:sql:nope')).toBe(0);
    expect(xpForItem('problem:nope')).toBe(0);
    expect(xpForItem('quiz:anything')).toBe(0);
    expect(isKnownItem(problemId(problem.slug))).toBe(true);
    expect(isKnownItem('lesson:sql')).toBe(false);
  });

  it('sums XP and ignores unknown ids', () => {
    const done = {
      [lessonId('sql', 'window-functions')]: '2026-11-01',
      'problem:removed-later': '2026-11-01',
    };
    expect(totalXp(done)).toBe(LESSON_XP);
  });

  it('reports track progress', () => {
    const track = getTrack('sql');
    if (track === undefined) throw new Error('no sql track');
    const empty = trackProgress(track, {});
    expect(empty.ratio).toBe(0);
    const all: Record<string, string> = {};
    for (const lesson of track.lessons) all[lessonId(track.slug, lesson.slug)] = '2026-11-01';
    for (const problem of problemsForTrack(track.slug)) all[problemId(problem.slug)] = '2026-11-01';
    expect(trackProgress(track, all)).toMatchObject({
      lessonsDone: track.lessons.length,
      problemsDone: problemsForTrack(track.slug).length,
      ratio: 1,
    });
  });

  it('counts solved problems by difficulty', () => {
    const counts = solvedByDifficulty({ 'problem:not-in-null-trap': '2026-11-01' });
    const total = counts.easy.total + counts.medium.total + counts.hard.total;
    expect(total).toBe(PROBLEMS.length);
    expect(counts.easy.done + counts.medium.done + counts.hard.done).toBe(1);
  });

  it('scores loop readiness from 0 to 1', () => {
    const uber = getCompany('uber');
    if (uber === undefined) throw new Error('no uber guide');
    expect(readiness(uber, {})).toBe(0);
    const everything: Record<string, string> = {};
    for (const track of TRACKS) {
      for (const lesson of track.lessons) everything[lessonId(track.slug, lesson.slug)] = 'd';
    }
    for (const problem of PROBLEMS) everything[problemId(problem.slug)] = 'd';
    expect(readiness(uber, everything)).toBeCloseTo(1);
    expect(readiness({ ...uber, weights: {} }, everything)).toBe(0);
  });

  it('suggests the first unfinished lesson in study order', () => {
    const first = TRACKS[0];
    const firstLesson = first?.lessons[0];
    if (first === undefined || firstLesson === undefined) throw new Error('empty catalogue');
    expect(nextLesson({})?.lesson.slug).toBe(firstLesson.slug);
    const second = first.lessons[1];
    expect(nextLesson({ [lessonId(first.slug, firstLesson.slug)]: 'd' })?.lesson.slug).toBe(
      second?.slug,
    );
    const everything: Record<string, string> = {};
    for (const track of TRACKS) {
      for (const lesson of track.lessons) everything[lessonId(track.slug, lesson.slug)] = 'd';
    }
    expect(nextLesson(everything)).toBeUndefined();
  });
});
