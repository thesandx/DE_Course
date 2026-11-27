// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { SqlTable } from '@/lib/runner/compare';
import {
  type ExpectedCache,
  judgeSql,
  lineAt,
  type SqlEngine,
  tooSlow,
} from '@/lib/runner/sql-judge';
import type { RunnableSpec, RunRequest } from '@/types/runner';

/**
 * The judge with a scripted engine: each statement the judge sends gets the
 * answer the test chose. PGlite itself is covered by
 * `lib/course/runnables/sql-specs.test.ts`.
 */

const INT = 23;

function table(...values: number[]): SqlTable {
  return { fields: [{ name: 'n', dataTypeID: INT }], rows: values.map((value) => [String(value)]) };
}

const NO_TABLE: SqlTable = { fields: [], rows: [] };

type Answer = SqlTable[] | Error | { message: string; position: number };

class FakeEngine implements SqlEngine {
  readonly sent: string[] = [];
  resets = 0;

  constructor(private readonly answer: (sql: string) => Answer) {}

  exec(sql: string): Promise<SqlTable[]> {
    this.sent.push(sql);
    const result = this.answer(sql);
    if (Array.isArray(result)) return Promise.resolve(result);
    return Promise.reject(
      result instanceof Error ? result : Object.assign(new Error(result.message), result),
    );
  }

  reset(): Promise<void> {
    this.resets += 1;
    return Promise.resolve();
  }
}

const SPEC: RunnableSpec = {
  language: 'sql',
  task: 'Return n.',
  tables: [{ name: 'numbers', columns: [{ name: 'n', type: 'int' }], rows: [[1], [2]] }],
  starter: '-- your query',
  solution: 'SELECT n FROM numbers',
  cases: [{ name: 'Sample' }, { name: 'Hidden', hidden: true, note: 'More rows.' }],
};

function request(code: string, action: 'run' | 'check' = 'check', spec = SPEC): RunRequest {
  return { id: 1, action, key: 'numbers:abc', code, spec };
}

/** Learner code and the solution both answer 1, 2; setup is accepted. */
function agreeing(sql: string): Answer {
  if (sql.startsWith('CREATE TABLE')) return [NO_TABLE, NO_TABLE];
  return [table(1, 2)];
}

describe('lineAt', () => {
  it('maps a 1-based offset to its line', () => {
    const code = 'SELECT 1;\nSELEC 2;\n';
    expect(lineAt(code, 1)).toBe(1);
    expect(lineAt(code, 11)).toBe(2);
    expect(lineAt(code, 0)).toBe(1);
  });
});

describe('tooSlow', () => {
  it('says how slow and gives the hint, or a default', () => {
    expect(tooSlow(1.234, 0.5, 'Use an index.')).toBe(
      'Too slow: this test took 1.23 s and the limit is 0.50 s. Use an index.',
    );
    expect(tooSlow(2, 1, undefined)).toMatch(/Look for a faster approach\.$/);
  });
});

describe('judgeSql', () => {
  it('runs the sample only for Run, every case for Submit, in order', async () => {
    const engine = new FakeEngine(agreeing);
    const onCase = vi.fn();
    const run = await judgeSql(request('SELECT n FROM numbers', 'run'), {
      engine,
      cache: new Map(),
      onCase,
    });
    expect(run).toHaveLength(1);
    const check = await judgeSql(request('SELECT n FROM numbers'), {
      engine,
      cache: new Map(),
      onCase,
    });
    expect(check.map((result) => [result.name, result.passed, result.hidden])).toEqual([
      ['Sample', true, false],
      ['Hidden', true, true],
    ]);
    expect(check[1]?.note).toBe('More rows.');
    expect(onCase.mock.calls.map(([index]) => index)).toEqual([0, 0, 1]);
    expect(check[0]?.expected).toEqual({
      kind: 'table',
      columns: ['n'],
      rows: [['1'], ['2']],
      total: 2,
    });
  });

  it('loads the sample data before the code and resets between programs', async () => {
    const engine = new FakeEngine(agreeing);
    await judgeSql(request('SELECT n FROM numbers', 'run'), { engine, cache: new Map() });
    expect(engine.sent[0]).toContain('CREATE TABLE numbers (n int);');
    expect(engine.sent[1]).toBe('SELECT n FROM numbers');
    // The learner's program, then the reference solution's: each starts clean.
    expect(engine.resets).toBe(2);
  });

  it('caches the expected result by key and case', async () => {
    const engine = new FakeEngine(agreeing);
    const cache: ExpectedCache = new Map();
    await judgeSql(request('SELECT 1', 'run'), { engine, cache });
    expect(cache.has('numbers:abc:0')).toBe(true);
    const before = engine.sent.filter((sql) => sql === SPEC.solution).length;
    await judgeSql(request('SELECT 2', 'run'), { engine, cache });
    expect(engine.sent.filter((sql) => sql === SPEC.solution).length).toBe(before);
  });

  it('fails a wrong answer and shows both outputs', async () => {
    const engine = new FakeEngine((sql) => (sql === 'SELECT 1' ? [table(1)] : agreeing(sql)));
    const [result] = await judgeSql(request('SELECT 1', 'run'), { engine, cache: new Map() });
    expect(result?.passed).toBe(false);
    expect(result?.message).not.toBe('');
    expect(result?.got).toEqual({ kind: 'table', columns: ['n'], rows: [['1']], total: 1 });
  });

  it('points an error at the line of the learner code', async () => {
    const code = 'SELECT n\nFRM numbers';
    const engine = new FakeEngine((sql) =>
      sql === code ? { message: 'syntax error at or near "FRM"', position: 10 } : agreeing(sql),
    );
    const [result] = await judgeSql(request(code, 'run'), { engine, cache: new Map() });
    expect(result?.passed).toBe(false);
    expect(result?.error).toEqual({ message: 'syntax error at or near "FRM"', line: 2 });
  });

  it('says when the sample data does not load', async () => {
    const engine = new FakeEngine((sql) =>
      sql.startsWith('CREATE TABLE') ? new Error('relation exists') : agreeing(sql),
    );
    const [result] = await judgeSql(request('SELECT 1', 'run'), { engine, cache: new Map() });
    expect(result?.message).toBe('The sample data did not load: relation exists');
    expect(result?.error?.line).toBeNull();
  });

  it('runs the code again for a rerun-safe problem and names the run that failed', async () => {
    let runs = 0;
    const code = 'INSERT INTO numbers VALUES (3)';
    const engine = new FakeEngine((sql) => {
      if (sql !== code) return agreeing(sql);
      runs += 1;
      return runs === 2 ? new Error('duplicate key') : [NO_TABLE];
    });
    const spec = { ...SPEC, repeat: 2 };
    const [result] = await judgeSql(request(code, 'run', spec), { engine, cache: new Map() });
    expect(result?.message).toBe('Run 2 of 2 failed: duplicate key');
  });

  it('reads the final state with the check query', async () => {
    const spec: RunnableSpec = {
      ...SPEC,
      solution: 'DELETE FROM numbers WHERE n = 2',
      cases: [{ name: 'Sample', check: 'SELECT n FROM numbers' }],
    };
    const engine = new FakeEngine((sql) => {
      if (sql === 'SELECT n FROM numbers') return [table(1)];
      if (sql.startsWith('DELETE')) return [NO_TABLE];
      return agreeing(sql);
    });
    const [passed] = await judgeSql(request('DELETE FROM numbers WHERE n > 1', 'run', spec), {
      engine,
      cache: new Map(),
    });
    expect(passed?.passed).toBe(true);

    const broken = new FakeEngine((sql) =>
      sql === 'SELECT n FROM numbers' ? new Error('no such table') : agreeing(sql),
    );
    const [failed] = await judgeSql(request('DROP TABLE numbers', 'run', spec), {
      engine: broken,
      cache: new Map(),
    });
    expect(failed?.message).toBe('The check query failed after your code ran: no such table');
  });

  it('asks for a final SELECT when the code returns no rows', async () => {
    const engine = new FakeEngine((sql) =>
      sql === 'CREATE TABLE t (x int)' ? [NO_TABLE] : agreeing(sql),
    );
    const [result] = await judgeSql(request('CREATE TABLE t (x int)', 'run'), {
      engine,
      cache: new Map(),
    });
    expect(result?.passed).toBe(false);
    expect(result?.message).toMatch(/returned no rows to check/);
    expect(result?.expected).toBeDefined();
  });

  it('reports a broken reference solution instead of blaming the learner', async () => {
    const failing = new FakeEngine((sql) =>
      sql === SPEC.solution ? new Error('bad solution') : agreeing(sql),
    );
    const [failed] = await judgeSql(request('SELECT 1', 'run'), {
      engine: failing,
      cache: new Map(),
    });
    expect(failed?.message).toBe('The reference solution failed on this case: bad solution');

    const empty = new FakeEngine((sql) => (sql === SPEC.solution ? [NO_TABLE] : agreeing(sql)));
    const [none] = await judgeSql(request('SELECT 1', 'run'), { engine: empty, cache: new Map() });
    expect(none?.message).toBe('The reference solution returned no table for this case.');
  });

  it('fails a right answer that is over the time limit', async () => {
    const spec: RunnableSpec = {
      ...SPEC,
      cases: [{ name: 'Big', limitS: 0.5, slowHint: 'Avoid the self-join.' }],
    };
    let clock = 0;
    const now = (): number => {
      clock += 600;
      return clock;
    };
    const engine = new FakeEngine(agreeing);
    const [result] = await judgeSql(request('SELECT n FROM numbers', 'run', spec), {
      engine,
      cache: new Map(),
      now,
    });
    expect(result?.passed).toBe(false);
    expect(result?.message).toBe(
      'Too slow: this test took 0.60 s and the limit is 0.50 s. Avoid the self-join.',
    );
    expect(result?.ms).toBe(600);
  });

  it('cuts a very long error message', async () => {
    const engine = new FakeEngine((sql) =>
      sql === 'SELECT x' ? new Error('e'.repeat(2000)) : agreeing(sql),
    );
    const [result] = await judgeSql(request('SELECT x', 'run'), { engine, cache: new Map() });
    expect(result?.message.length).toBe(1503);
  });

  it('lets an engine failure outside a program reach the caller', async () => {
    const engine = new FakeEngine(agreeing);
    engine.reset = () => Promise.reject(new Error('engine crashed'));
    await expect(
      judgeSql(request('SELECT 1', 'run'), { engine, cache: new Map() }),
    ).rejects.toThrow('engine crashed');
  });
});
