// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { PROBLEMS } from '@/lib/course/catalog';
import { RUNNABLES } from '@/lib/course/runnables';
import { TEST_ANSWERS } from '@/lib/course/runnables/test-answers';

/**
 * The course promises a runnable editor on every coding round. These tests
 * keep that promise as problems are added: each SQL and coding problem has a
 * spec, each spec belongs to a problem, and each grader is tested against
 * other correct answers and the usual mistakes.
 */

const RUNNABLE_KINDS = new Set(['sql', 'coding']);
const SLUGS = new Set(PROBLEMS.map((problem) => problem.slug));

describe('runnable coverage', () => {
  it('gives every SQL and coding problem a runnable spec', () => {
    const missing = PROBLEMS.filter(
      (problem) => RUNNABLE_KINDS.has(problem.kind) && !Object.hasOwn(RUNNABLES, problem.slug),
    ).map((problem) => `${problem.track}/${problem.slug}`);
    expect(missing).toEqual([]);
  });

  it('runs SQL problems in SQL and coding problems in Python or PySpark', () => {
    const wrong = PROBLEMS.filter((problem) => Object.hasOwn(RUNNABLES, problem.slug))
      .filter((problem) => {
        const language = RUNNABLES[problem.slug]?.language;
        return problem.kind === 'sql' ? language !== 'sql' : language === 'sql';
      })
      .map(
        (problem) => `${problem.slug}: ${problem.kind} runs ${RUNNABLES[problem.slug]?.language}`,
      );
    expect(wrong).toEqual([]);
  });

  it('has no spec for a problem that does not exist', () => {
    expect(Object.keys(RUNNABLES).filter((slug) => !SLUGS.has(slug))).toEqual([]);
  });

  it('tests each grader with at least one usual mistake', () => {
    const untested = Object.keys(RUNNABLES).filter(
      (slug) => (TEST_ANSWERS[slug]?.fail ?? []).length === 0,
    );
    expect(untested).toEqual([]);
  });

  it('keeps at least one hidden case for each problem, so Submit checks more than Run', () => {
    const open = Object.entries(RUNNABLES)
      .filter(([, spec]) => !spec.cases.some((runCase) => runCase.hidden === true))
      .map(([slug]) => slug);
    expect(open).toEqual([]);
  });
});
