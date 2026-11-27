// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { RUNNABLES } from '@/lib/course/runnables';
import { TEST_ANSWERS } from '@/lib/course/runnables/test-answers';
import { pgliteEngine } from '@/lib/runner/pglite-engine';
import { judgeSql, type SqlEngine } from '@/lib/runner/sql-judge';
import type { CaseResult, RunnableSpec } from '@/types/runner';

/**
 * Runs every SQL spec on PostgreSQL 18 (PGlite, the same engine the browser
 * loads): the reference solution passes, the starter does not, other correct
 * answers pass and the usual mistakes fail.
 */

let engine: SqlEngine;

beforeAll(async () => {
  engine = await pgliteEngine(await PGlite.create());
}, 60_000);

const SQL_SPECS = Object.entries(RUNNABLES).filter(([, spec]) => spec.language === 'sql');

function judge(slug: string, spec: RunnableSpec, code: string): Promise<readonly CaseResult[]> {
  return judgeSql(
    { id: 1, action: 'check', key: `${slug}:test`, code, spec },
    { engine, cache: new Map() },
  );
}

function failures(results: readonly CaseResult[]): string[] {
  return results
    .filter((result) => !result.passed)
    .map((result) => `${result.name}: ${result.message}`);
}

describe.each(SQL_SPECS)('runnable SQL problem %s', (slug, spec) => {
  it('passes every case with the reference solution, on real data', async () => {
    const results = await judge(slug, spec, spec.solution);
    expect(failures(results)).toEqual([]);
    const rows = results.map((result) =>
      result.expected?.kind === 'table' ? result.expected.total : 0,
    );
    expect(Math.max(...rows), 'every case expects an empty result').toBeGreaterThan(0);
  });

  it('does not pass with the starter code', async () => {
    const results = await judge(slug, spec, spec.starter);
    expect(results.every((result) => result.passed)).toBe(false);
  });

  const answers = TEST_ANSWERS[slug] ?? {};
  it.each((answers.pass ?? []).map((code, index) => [index + 1, code] as const))(
    'accepts correct answer %i',
    async (_, code) => {
      expect(failures(await judge(slug, spec, code))).toEqual([]);
    },
  );
  it.each((answers.fail ?? []).map((code, index) => [index + 1, code] as const))(
    'rejects wrong answer %i',
    async (_, code) => {
      expect(failures(await judge(slug, spec, code)).length).toBeGreaterThan(0);
    },
  );
});
