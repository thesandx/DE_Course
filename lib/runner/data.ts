import { ruleViolation } from '@/lib/runner/code-rules';
import type {
  CompareOrder,
  DataCell,
  DataTable,
  RunCase,
  RunnableSpec,
  RunRequest,
  SandboxModule,
} from '@/types/runner';

/**
 * Turns a spec's sample data into setup code: SQL statements for PostgreSQL,
 * or Python that builds DataFrames. Pure, so every spec's setup is tested
 * without an engine.
 */

const IDENTIFIER = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

/** The tables a case runs on: the base tables, with the case's tables replacing ones of the same name. */
export function caseTables(spec: RunnableSpec, runCase: RunCase): readonly DataTable[] {
  const base = spec.tables ?? [];
  const overrides = runCase.tables ?? [];
  const replaced = new Set(overrides.map((table) => table.name));
  return [...base.filter((table) => !replaced.has(table.name)), ...overrides];
}

export function assertIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new Error(`"${name}" is not a plain lowercase identifier.`);
  return name;
}

// ---------------------------------------------------------------- SQL

function sqlString(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

export function sqlLiteral(cell: DataCell, type: string): string {
  if (cell === null) return 'NULL';
  const lower = type.toLowerCase();
  if (lower.endsWith('[]') && Array.isArray(cell)) {
    const element = lower.slice(0, -2);
    return `ARRAY[${cell.map((item) => sqlLiteral(item, element)).join(', ')}]::${lower}`;
  }
  if (lower === 'json' || lower === 'jsonb') return `${sqlString(JSON.stringify(cell))}::${lower}`;
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : 'NULL';
  if (typeof cell === 'string') return sqlString(cell);
  return sqlString(JSON.stringify(cell));
}

/** CREATE TABLE and one INSERT for a table. A qualified name creates its schema first. */
export function sqlTable(table: DataTable): string {
  const name = assertIdentifier(table.name);
  const statements: string[] = [];
  const dot = name.indexOf('.');
  if (dot > 0) statements.push(`CREATE SCHEMA IF NOT EXISTS ${name.slice(0, dot)};`);
  const columns = table.columns.map((column) => `${assertIdentifier(column.name)} ${column.type}`);
  statements.push(`CREATE TABLE ${name} (${columns.join(', ')});`);
  if (table.rows.length > 0) {
    const values = table.rows.map(
      (row) =>
        `(${table.columns.map((column, index) => sqlLiteral(row[index] ?? null, column.type)).join(', ')})`,
    );
    statements.push(`INSERT INTO ${name} VALUES\n  ${values.join(',\n  ')};`);
  }
  return statements.join('\n');
}

/** Everything that runs before the learner's SQL for one case. */
export function sqlSetup(spec: RunnableSpec, runCase: RunCase): string {
  return [...caseTables(spec, runCase).map(sqlTable), spec.setup ?? '', runCase.setup ?? '']
    .filter((part) => part.trim() !== '')
    .join('\n');
}

// ---------------------------------------------------------------- Python

function pythonString(text: string): string {
  return JSON.stringify(text);
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

function pythonDate(text: string): string {
  const match = DATE.exec(text);
  if (match === null) throw new Error(`"${text}" is not a date (YYYY-MM-DD).`);
  return `date(${Number(match[1])}, ${Number(match[2])}, ${Number(match[3])})`;
}

function pythonDateTime(text: string): string {
  const match = DATETIME.exec(text);
  if (match === null) throw new Error(`"${text}" is not a timestamp (YYYY-MM-DD HH:MM[:SS]).`);
  const parts = match.slice(1, 7).map((part) => Number(part ?? 0));
  return `datetime(${parts.join(', ')})`;
}

const FLOAT_TYPES = new Set(['double', 'float', 'real']);

/** A Python literal for a cell. `type` decides dates and floats. */
export function pythonLiteral(cell: DataCell, type = ''): string {
  if (cell === null) return 'None';
  const lower = type.toLowerCase();
  if (typeof cell === 'boolean') return cell ? 'True' : 'False';
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return 'None';
    const wantsFloat = FLOAT_TYPES.has(lower) || lower.startsWith('decimal');
    return wantsFloat && Number.isInteger(cell) ? `${cell}.0` : String(cell);
  }
  if (typeof cell === 'string') {
    if (lower === 'date') return pythonDate(cell);
    if (lower === 'timestamp' || lower === 'datetime') return pythonDateTime(cell);
    return pythonString(cell);
  }
  if (Array.isArray(cell)) {
    const element = /^array<(.*)>$/.exec(lower)?.[1] ?? '';
    return `[${cell.map((item) => pythonLiteral(item, element)).join(', ')}]`;
  }
  const fields = structFields(lower);
  const entries = Object.entries(cell).map(
    ([key, value]) => `${pythonString(key)}: ${pythonLiteral(value, fields.get(key) ?? '')}`,
  );
  return `{${entries.join(', ')}}`;
}

/** The field types of a Spark `struct<a:int,b:string>` type, by name. */
function structFields(type: string): Map<string, string> {
  const match = /^struct<(.*)>$/.exec(type);
  const fields = new Map<string, string>();
  if (match === null || match[1] === undefined) return fields;
  let depth = 0;
  let current = '';
  const parts: string[] = [];
  for (const char of match[1]) {
    if (char === '<') depth += 1;
    if (char === '>') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  if (current !== '') parts.push(current);
  for (const part of parts) {
    const colon = part.indexOf(':');
    if (colon > 0) fields.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
  }
  return fields;
}

const PYSPARK_IMPORTS = [
  'from datetime import date, datetime, timedelta',
  'from pyspark.sql import SparkSession, Row, Window',
  'from pyspark.sql import functions as F',
  'from pyspark.sql import types as T',
  'spark = SparkSession.builder.getOrCreate()',
].join('\n');

function sparkFrame(table: DataTable): string {
  const name = assertIdentifier(table.name);
  const schema = table.columns.map((column) => `${column.name} ${column.type}`).join(', ');
  const rows = table.rows.map(
    (row) =>
      `    (${table.columns.map((column, index) => pythonLiteral(row[index] ?? null, column.type)).join(', ')}${table.columns.length === 1 ? ',' : ''}),`,
  );
  return `${name} = spark.createDataFrame([\n${rows.join('\n')}\n], ${pythonString(schema)})`;
}

const PANDAS_DATES = new Set(['date', 'datetime', 'timestamp']);

function pandasFrame(table: DataTable): string {
  const name = assertIdentifier(table.name);
  const columns = table.columns.map((column, index) => {
    const values = table.rows.map((row) => {
      const cell = row[index] ?? null;
      return PANDAS_DATES.has(column.type) && typeof cell === 'string'
        ? pythonString(cell)
        : pythonLiteral(cell, column.type);
    });
    const list = `[${values.join(', ')}]`;
    const value = PANDAS_DATES.has(column.type) ? `pd.to_datetime(${list})` : list;
    return `    ${pythonString(column.name)}: ${value},`;
  });
  return `${name} = pd.DataFrame({\n${columns.join('\n')}\n})`;
}

/** The Python that runs before the learner's code for one case. */
export function pythonPrelude(spec: RunnableSpec, runCase: RunCase): string {
  const tables = caseTables(spec, runCase);
  const parts: string[] = [];
  if (spec.language === 'pyspark') {
    parts.push(PYSPARK_IMPORTS, ...tables.map(sparkFrame));
  } else if (tables.length > 0) {
    parts.push(
      'import pandas as pd',
      'from datetime import date, datetime, timedelta',
      ...tables.map(pandasFrame),
    );
  }
  if (spec.setup !== undefined) parts.push(spec.setup);
  if (spec.helpers !== undefined) parts.push(spec.helpers);
  return parts.join('\n');
}

/** One case as `run_job()` in `hooks/workers/python/harness.py` reads it. */
export interface PythonCase {
  name: string;
  note: string;
  hidden: boolean;
  /** Imports and data, built from the spec. */
  prelude: string;
  /** The case's own extra code, which runs after the prelude. */
  setup: string;
  check: string;
  order: CompareOrder | null;
  tolerance: number | null;
  limitS: number | null;
  slowHint: string;
}

/** The JSON job the Python worker hands to the harness. */
export interface PythonJob {
  key: string;
  action: 'run' | 'check';
  language: 'python' | 'pyspark';
  code: string;
  solution: string;
  modules: readonly SandboxModule[];
  /** The message of a broken code rule. The harness then fails every case with it. */
  violation: string | null;
  cases: readonly PythonCase[];
}

/** Builds the harness job for a request. A `run` checks the sample case only. */
export function pythonJob(request: RunRequest): PythonJob {
  const { spec } = request;
  if (spec.language === 'sql') throw new Error('A SQL spec has no Python job.');
  const cases = request.action === 'run' ? spec.cases.slice(0, 1) : spec.cases;
  return {
    key: request.key,
    action: request.action,
    language: spec.language,
    code: request.code,
    solution: spec.solution,
    modules: spec.modules ?? [],
    violation: ruleViolation(spec, request.code),
    cases: cases.map((runCase) => ({
      name: runCase.name,
      note: runCase.note ?? '',
      hidden: runCase.hidden === true,
      prelude: pythonPrelude(spec, runCase),
      setup: runCase.setup ?? '',
      check: runCase.check ?? '',
      order: runCase.order ?? null,
      tolerance: runCase.tolerance ?? null,
      limitS: runCase.limitS ?? null,
      slowHint: runCase.slowHint ?? '',
    })),
  };
}

/**
 * The Python source a job runs, for working out which packages to load. An
 * import of a sandbox module is left out: the harness provides that module,
 * and Pyodide must not download the real package of the same name.
 */
export function jobSource(job: PythonJob): string {
  const source = [
    job.code,
    job.solution,
    ...job.cases.flatMap((runCase) => [runCase.prelude, runCase.setup, runCase.check]),
  ].join('\n');
  if (job.modules.length === 0) return source;
  const sandboxImport = new RegExp(
    `^[ \\t]*(?:import|from)[ \\t]+(?:${job.modules.join('|')})\\b.*$`,
    'gm',
  );
  return source.replace(sandboxImport, '');
}

/**
 * A short, stable hash of a spec (FNV-1a over its JSON). It keys the cached
 * expected results, so an edited spec never compares against stale ones.
 */
export function specHash(spec: RunnableSpec): string {
  const text = JSON.stringify(spec);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
