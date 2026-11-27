import type { CompareOrder, RunOutput } from '@/types/runner';

/**
 * Compares two SQL results, the learner's and the reference solution's. The
 * cells arrive as PostgreSQL text (what psql prints), with each column's type
 * id, so the comparison sees `12.50` and `12.5` as the same number. Pure, so
 * it is tested without an engine.
 */

export interface SqlField {
  name: string;
  /** The PostgreSQL type oid. */
  dataTypeID: number;
}

export interface SqlTable {
  fields: readonly SqlField[];
  rows: readonly (readonly (string | null)[])[];
}

/** int2, int4, int8, oid, float4, float8, numeric. */
const NUMERIC_TYPES = new Set([20, 21, 23, 26, 700, 701, 1700]);
const BOOLEAN_TYPE = 16;
const TIMESTAMP_TYPES = new Set([1114, 1184]);

type Cell = number | string | boolean | null;

export function normalizeCell(raw: string | null, typeId: number): Cell {
  if (raw === null) return null;
  if (NUMERIC_TYPES.has(typeId)) {
    if (raw === 'NaN') return Number.NaN;
    const value = Number(raw);
    return Number.isNaN(value) ? raw : value;
  }
  if (typeId === BOOLEAN_TYPE) return raw === 't' || raw === 'true';
  if (TIMESTAMP_TYPES.has(typeId)) {
    // A date and a timestamp at midnight are the same answer to most questions.
    return raw.replace(/ 00:00:00(\+00)?$/, '').replace(/\+00$/, '');
  }
  return raw;
}

function asNumber(cell: Cell): number | null {
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'string' && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(cell.trim())) {
    return Number(cell);
  }
  return null;
}

export function cellsEqual(a: Cell, b: Cell, tolerance: number): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' || typeof b === 'number') {
    const x = asNumber(a);
    const y = asNumber(b);
    if (x === null || y === null) return false;
    if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) && Number.isNaN(y);
    return Math.abs(x - y) <= tolerance * Math.max(1, Math.abs(y));
  }
  return a === b;
}

function normalizeRows(table: SqlTable): Cell[][] {
  return table.rows.map((row) =>
    row.map((raw, index) => normalizeCell(raw, table.fields[index]?.dataTypeID ?? 25)),
  );
}

function sortKey(row: readonly Cell[]): string {
  return JSON.stringify(
    row.map((cell) => (typeof cell === 'number' ? Math.round(cell * 1e4) / 1e4 : cell)),
  );
}

function showCell(cell: Cell): string {
  if (cell === null) return 'NULL';
  return String(cell);
}

function showRow(row: readonly Cell[]): string {
  return `(${row.map(showCell).join(', ')})`;
}

export interface Comparison {
  passed: boolean;
  /** Empty when passed. */
  message: string;
}

/** Compares the learner's result with the expected one. */
export function compareTables(
  got: SqlTable,
  expected: SqlTable,
  order: CompareOrder = 'any',
  tolerance = 1e-6,
): Comparison {
  if (got.fields.length !== expected.fields.length) {
    return {
      passed: false,
      message: `Expected ${expected.fields.length} columns (${expected.fields.map((field) => field.name).join(', ')}), got ${got.fields.length} (${got.fields.map((field) => field.name).join(', ') || 'none'}).`,
    };
  }
  let left = normalizeRows(got);
  let right = normalizeRows(expected);
  if (left.length !== right.length) {
    return {
      passed: false,
      message: `Expected ${right.length} ${right.length === 1 ? 'row' : 'rows'}, got ${left.length}.`,
    };
  }
  if (order !== 'exact') {
    left = [...left].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    right = [...right].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }
  for (let index = 0; index < right.length; index += 1) {
    const a = left[index] ?? [];
    const b = right[index] ?? [];
    const same = b.every((cell, column) => cellsEqual(a[column] ?? null, cell, tolerance));
    if (!same) {
      if (order !== 'exact') {
        const missing = right.find(
          (row) =>
            !left.some((other) =>
              row.every((cell, i) => cellsEqual(other[i] ?? null, cell, tolerance)),
            ),
        );
        const extra = left.find(
          (row) =>
            !right.some((other) =>
              other.every((cell, i) => cellsEqual(row[i] ?? null, cell, tolerance)),
            ),
        );
        const parts = [];
        if (missing !== undefined) parts.push(`Missing row ${showRow(missing)}.`);
        if (extra !== undefined) parts.push(`Unexpected row ${showRow(extra)}.`);
        if (parts.length > 0) return { passed: false, message: parts.join(' ') };
      }
      return {
        passed: false,
        message: `Row ${index + 1} differs: expected ${showRow(b)}, got ${showRow(a)}.`,
      };
    }
  }
  return { passed: true, message: '' };
}

/** How many rows a result shows. The count above the table still says the total. */
export const MAX_SHOWN_ROWS = 50;

/** A result table as the page shows it. */
export function tableOutput(table: SqlTable): RunOutput {
  const rows = normalizeRows({ fields: table.fields, rows: table.rows.slice(0, MAX_SHOWN_ROWS) });
  return {
    kind: 'table',
    columns: table.fields.map((field) => field.name),
    rows: rows.map((row) => row.map(showCell)),
    total: table.rows.length,
  };
}
