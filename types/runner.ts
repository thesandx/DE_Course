/**
 * The runnable editor: a problem's sample data, the reference solution and the
 * test cases, plus the messages between the page and the engines that run the
 * learner's code in the browser.
 *
 * Specs live in `lib/course/runnables/`. The engines live in `hooks/workers/`.
 * ADR-0016 records why the code runs in the browser. `lib/course/README.md` >
 * Runnable problems says how to write a spec.
 */

/**
 * The engine a problem runs on. `sql` is PostgreSQL (PGlite). `python` is
 * CPython (Pyodide), with pandas when the code imports it. `pyspark` is the
 * DataFrame API on DuckDB, inside Pyodide.
 */
export type RunnerLanguage = 'sql' | 'python' | 'pyspark';

/** One cell of sample data. Objects and arrays are JSON, or a Spark struct and array. */
export type DataCell =
  string | number | boolean | null | readonly DataCell[] | { readonly [key: string]: DataCell };

export interface DataColumn {
  name: string;
  /**
   * The type in the engine's own words: a PostgreSQL type for `sql`
   * (`int`, `numeric(10,2)`, `timestamp`), a Spark type for `pyspark`
   * (`string`, `array<struct<sku:string,qty:int>>`), and `int`, `float`,
   * `str`, `bool`, `date` or `datetime` for a pandas DataFrame.
   */
  type: string;
}

/** A table of sample data. SQL loads it into a table; Python into a DataFrame of that name. */
export interface DataTable {
  name: string;
  columns: readonly DataColumn[];
  rows: readonly (readonly DataCell[])[];
}

/** How the order of rows or list items counts when two results are compared. */
export type CompareOrder = 'exact' | 'any' | 'nested';

/** One test: the data, an optional extra setup and what is compared. */
export interface RunCase {
  name: string;
  /** What this case tests. The learner sees it when the case fails. */
  note?: string;
  /** Tables that replace the base tables with the same name for this case. */
  tables?: readonly DataTable[];
  /** Python: code that runs before the learner's code. SQL: statements after the tables load. */
  setup?: string;
  /**
   * What is compared. Python: an expression, such as `error_rates(lines)`
   * (default `result`). SQL: a query that reads the final state, for a
   * problem that changes data (default: the last result of the learner's code).
   */
  check?: string;
  /** Default: `any` for SQL and PySpark rows, `exact` for Python values. */
  order?: CompareOrder;
  /** Relative tolerance for numbers. Default 1e-6. */
  tolerance?: number;
  /** Seconds. A slower answer fails, even when its output is right. */
  limitS?: number;
  /** Shown when the case is too slow. */
  slowHint?: string;
  /** A hidden case runs on Submit only, and its data is not shown up front. */
  hidden?: boolean;
  /** SQL: how many times the code runs before the check. Default: the spec's `repeat`. */
  repeat?: number;
}

/** Everything a problem needs for the runnable editor. */
export interface RunnableSpec {
  language: RunnerLanguage;
  /** The contract in the course Markdown dialect: exactly what the code must return. */
  task: string;
  /** Sample data. The first case uses it as it is. */
  tables?: readonly DataTable[];
  /** Python: imports and inputs. SQL: statements that run after the tables load. Shown with the data. */
  setup?: string;
  /**
   * Python: code the tests need but the learner does not, such as the
   * functions a `check` calls that return `verdict(...)`. Runs after `setup`
   * in every case. Not shown.
   */
  helpers?: string;
  /** What the editor holds the first time. */
  starter: string;
  /** The reference solution. Its output is the expected output of every case. */
  solution: string;
  /** At least one. The first one is the sample that Run uses. */
  cases: readonly RunCase[];
  /** Small fake libraries the Python harness installs: a Prefect, Airflow or pytest look-alike. */
  modules?: readonly SandboxModule[];
  /** SQL: run the learner's code this many times in a row, to prove a rerun is safe. */
  repeat?: number;
}

export type SandboxModule = 'prefect' | 'airflow' | 'pytest';

/** A result the page can show: a table, or text such as a Python value. */
export type RunOutput =
  | {
      kind: 'table';
      columns: readonly string[];
      rows: readonly (readonly string[])[];
      total: number;
    }
  | { kind: 'text'; text: string };

export interface RunError {
  message: string;
  /** The line in the learner's code, when the engine can tell. */
  line: number | null;
}

/** The result of one case. */
export interface CaseResult {
  name: string;
  note: string;
  hidden: boolean;
  passed: boolean;
  /** Empty when the case passed; otherwise one or two sentences on what differs. */
  message: string;
  stdout: string;
  ms: number;
  got?: RunOutput | null;
  expected?: RunOutput | null;
  error?: RunError;
}

/** Asks a worker to run the learner's code. */
export interface RunRequest {
  id: number;
  /** `run` checks the sample case only; `check` runs every case. */
  action: 'run' | 'check';
  /** Caches the expected results: the problem slug and a hash of its spec. */
  key: string;
  code: string;
  spec: RunnableSpec;
}

/** Asks a worker to download and start its engine before the first run. */
export interface WarmRequest {
  id: number;
  action: 'warm';
  language: RunnerLanguage;
  modules?: readonly SandboxModule[];
}

export type WorkerRequest = RunRequest | WarmRequest;

/**
 * What a worker tells the page. `loading` while the engine downloads or
 * starts, `ready` when a warm-up is done, `running` when the clock starts.
 */
export type WorkerEvent =
  | { type: 'status'; id: number; phase: 'loading' | 'ready' | 'running'; detail: string }
  | { type: 'case'; id: number; index: number; result: CaseResult }
  | { type: 'done'; id: number; cases: readonly CaseResult[] }
  | { type: 'failed'; id: number; message: string };
