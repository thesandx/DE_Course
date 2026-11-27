import { compareTables, type SqlTable, tableOutput } from '@/lib/runner/compare';
import { sqlSetup } from '@/lib/runner/data';
import type { CaseResult, RunCase, RunError, RunRequest } from '@/types/runner';

/**
 * Judges a SQL answer: runs the learner's code and the reference solution on
 * the same data for each case, then compares the results. The engine is
 * passed in, so the browser worker uses PGlite from the CDN and the tests use
 * PGlite from `node_modules` with the same judge.
 */

/** What the judge needs from PostgreSQL. */
export interface SqlEngine {
  /** Runs one or more statements and returns one table per statement, in order. */
  exec(sql: string): Promise<SqlTable[]>;
  /** Drops everything the last program made: tables, schemas and session settings. */
  reset(): Promise<void>;
}

/** An error from the engine, with the 1-based character offset PostgreSQL reports. */
export interface SqlEngineError {
  message: string;
  position?: number;
}

/** The expected result of each case, cached by problem key and case index. */
export type ExpectedCache = Map<string, SqlTable>;

interface Program {
  table: SqlTable | null;
  ms: number;
}

class ProgramError extends Error {
  readonly detail: RunError;

  constructor(detail: RunError) {
    super(detail.message);
    this.detail = detail;
  }
}

/** The line of a 1-based character offset in `code`. */
export function lineAt(code: string, position: number): number {
  return code.slice(0, Math.max(0, position - 1)).split('\n').length;
}

function engineError(caught: unknown, code: string | null): RunError {
  const error = caught as Partial<SqlEngineError> | null;
  const message =
    typeof error?.message === 'string' && error.message !== '' ? error.message : String(caught);
  const position = typeof error?.position === 'number' ? error.position : undefined;
  return {
    message: message.length > 1500 ? `${message.slice(0, 1500)}...` : message,
    line: code !== null && position !== undefined ? lineAt(code, position) : null,
  };
}

/** The last result that has columns: a SELECT, or a statement with RETURNING. */
function lastTable(tables: readonly SqlTable[]): SqlTable | null {
  for (let index = tables.length - 1; index >= 0; index -= 1) {
    const table = tables[index];
    if (table !== undefined && table.fields.length > 0) return table;
  }
  return null;
}

async function runProgram(
  engine: SqlEngine,
  setup: string,
  code: string,
  repeat: number,
  check: string | undefined,
  now: () => number,
): Promise<Program> {
  await engine.reset();
  if (setup.trim() !== '') {
    try {
      await engine.exec(setup);
    } catch (caught) {
      throw new ProgramError({
        message: `The sample data did not load: ${engineError(caught, null).message}`,
        line: null,
      });
    }
  }
  const started = now();
  let results: SqlTable[] = [];
  for (let run = 0; run < repeat; run += 1) {
    try {
      results = await engine.exec(code);
    } catch (caught) {
      const detail = engineError(caught, code);
      throw new ProgramError(
        run === 0
          ? detail
          : { ...detail, message: `Run ${run + 1} of ${repeat} failed: ${detail.message}` },
      );
    }
  }
  const ms = now() - started;
  if (check === undefined || check.trim() === '') return { table: lastTable(results), ms };
  try {
    return { table: lastTable(await engine.exec(check)), ms };
  } catch (caught) {
    throw new ProgramError({
      message: `The check query failed after your code ran: ${engineError(caught, null).message}`,
      line: null,
    });
  }
}

export interface JudgeOptions {
  engine: SqlEngine;
  cache: ExpectedCache;
  /** Called after each case, so the page can show results as they arrive. */
  onCase?: (index: number, result: CaseResult) => void;
  now?: () => number;
}

/** The same sentence the Python harness writes for a slow case. */
export function tooSlow(seconds: number, limitS: number, hint: string | undefined): string {
  const advice = hint !== undefined && hint !== '' ? hint : 'Look for a faster approach.';
  return `Too slow: this test took ${seconds.toFixed(2)} s and the limit is ${limitS.toFixed(2)} s. ${advice}`;
}

function emptyResult(runCase: RunCase): CaseResult {
  return {
    name: runCase.name,
    note: runCase.note ?? '',
    hidden: runCase.hidden === true,
    passed: false,
    message: '',
    stdout: '',
    ms: 0,
  };
}

async function judgeCase(
  request: RunRequest,
  runCase: RunCase,
  index: number,
  options: JudgeOptions,
): Promise<CaseResult> {
  const { engine, cache } = options;
  const now = options.now ?? (() => performance.now());
  const setup = sqlSetup(request.spec, runCase);
  const repeat = Math.max(1, request.spec.repeat ?? 1);
  const result = emptyResult(runCase);

  let got: Program;
  try {
    got = await runProgram(engine, setup, request.code, repeat, runCase.check, now);
  } catch (caught) {
    if (!(caught instanceof ProgramError)) throw caught;
    return { ...result, message: caught.detail.message, error: caught.detail };
  }
  result.ms = Math.round(got.ms * 10) / 10;
  if (runCase.limitS !== undefined && got.ms > runCase.limitS * 1000) {
    return { ...result, message: tooSlow(got.ms / 1000, runCase.limitS, runCase.slowHint) };
  }

  const cacheKey = `${request.key}:${index}`;
  let expected = cache.get(cacheKey);
  if (expected === undefined) {
    try {
      const reference = await runProgram(
        engine,
        setup,
        request.spec.solution,
        repeat,
        runCase.check,
        now,
      );
      if (reference.table === null) {
        return { ...result, message: 'The reference solution returned no table for this case.' };
      }
      expected = reference.table;
      cache.set(cacheKey, expected);
    } catch (caught) {
      if (!(caught instanceof ProgramError)) throw caught;
      return {
        ...result,
        message: `The reference solution failed on this case: ${caught.detail.message}`,
      };
    }
  }

  result.expected = tableOutput(expected);
  if (got.table === null) {
    return {
      ...result,
      message:
        'Your code ran but returned no rows to check. End it with the SELECT that answers the question.',
    };
  }
  result.got = tableOutput(got.table);
  const comparison = compareTables(got.table, expected, runCase.order ?? 'any', runCase.tolerance);
  return { ...result, passed: comparison.passed, message: comparison.message };
}

/** Runs the sample case (`run`) or every case (`check`) and returns the results in order. */
export async function judgeSql(
  request: RunRequest,
  options: JudgeOptions,
): Promise<readonly CaseResult[]> {
  const cases = request.action === 'run' ? request.spec.cases.slice(0, 1) : request.spec.cases;
  const results: CaseResult[] = [];
  for (const [index, runCase] of cases.entries()) {
    const result = await judgeCase(request, runCase, index, options);
    results.push(result);
    options.onCase?.(index, result);
  }
  return results;
}
