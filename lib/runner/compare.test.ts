import { describe, expect, it } from 'vitest';

import {
  cellsEqual,
  compareTables,
  MAX_SHOWN_ROWS,
  normalizeCell,
  type SqlTable,
  tableOutput,
} from '@/lib/runner/compare';

const INT = 23;
const NUMERIC = 1700;
const TEXT = 25;
const BOOL = 16;
const TIMESTAMP = 1114;

function table(
  names: readonly string[],
  types: readonly number[],
  rows: (string | null)[][],
): SqlTable {
  return { fields: names.map((name, index) => ({ name, dataTypeID: types[index] ?? TEXT })), rows };
}

describe('normalizeCell', () => {
  it('reads numbers, booleans and timestamps by type', () => {
    expect(normalizeCell('12.50', NUMERIC)).toBe(12.5);
    expect(normalizeCell('NaN', NUMERIC)).toBeNaN();
    expect(normalizeCell('t', BOOL)).toBe(true);
    expect(normalizeCell('2024-01-02 00:00:00', TIMESTAMP)).toBe('2024-01-02');
    expect(normalizeCell('2024-01-02 10:00:00+00', 1184)).toBe('2024-01-02 10:00:00');
    expect(normalizeCell('x', TEXT)).toBe('x');
    expect(normalizeCell(null, INT)).toBeNull();
  });
});

describe('cellsEqual', () => {
  it('compares numbers with a relative tolerance and numeric text as numbers', () => {
    expect(cellsEqual(0.30000000000000004, 0.3, 1e-6)).toBe(true);
    expect(cellsEqual(3, '3.0', 1e-6)).toBe(true);
    expect(cellsEqual(3, 'three', 1e-6)).toBe(false);
    expect(cellsEqual(Number.NaN, Number.NaN, 1e-6)).toBe(true);
    expect(cellsEqual(null, null, 1e-6)).toBe(true);
    expect(cellsEqual(null, 0, 1e-6)).toBe(false);
    expect(cellsEqual('a', 'a', 1e-6)).toBe(true);
  });
});

describe('compareTables', () => {
  const expected = table(
    ['city', 'trips'],
    [TEXT, INT],
    [
      ['Pune', '3'],
      ['Delhi', '5'],
    ],
  );

  it('passes the same rows in any order by default', () => {
    const got = table(
      ['c', 'n'],
      [TEXT, NUMERIC],
      [
        ['Delhi', '5.0'],
        ['Pune', '3'],
      ],
    );
    expect(compareTables(got, expected)).toEqual({ passed: true, message: '' });
  });

  it('says when the column count differs', () => {
    const got = table(['city'], [TEXT], [['Pune'], ['Delhi']]);
    expect(compareTables(got, expected).message).toBe(
      'Expected 2 columns (city, trips), got 1 (city).',
    );
  });

  it('says when the row count differs', () => {
    const got = table(['city', 'trips'], [TEXT, INT], [['Pune', '3']]);
    expect(compareTables(got, expected).message).toBe('Expected 2 rows, got 1.');
  });

  it('names a missing and an unexpected row', () => {
    const got = table(
      ['city', 'trips'],
      [TEXT, INT],
      [
        ['Pune', '3'],
        ['Delhi', '6'],
      ],
    );
    expect(compareTables(got, expected).message).toBe(
      'Missing row (Delhi, 5). Unexpected row (Delhi, 6).',
    );
  });

  it('checks order when the case asks for it', () => {
    const got = table(
      ['city', 'trips'],
      [TEXT, INT],
      [
        ['Delhi', '5'],
        ['Pune', '3'],
      ],
    );
    expect(compareTables(got, expected, 'exact').message).toBe(
      'Row 1 differs: expected (Pune, 3), got (Delhi, 5).',
    );
  });

  it('shows NULL for a missing value', () => {
    const got = table(
      ['city', 'trips'],
      [TEXT, INT],
      [
        ['Pune', null],
        ['Delhi', '5'],
      ],
    );
    expect(compareTables(got, expected).message).toContain('Unexpected row (Pune, NULL).');
  });
});

describe('tableOutput', () => {
  it('caps the rows it shows and keeps the total', () => {
    const rows = Array.from({ length: MAX_SHOWN_ROWS + 5 }, (_, index) => [String(index), 't']);
    const output = tableOutput(table(['n', 'flag'], [INT, BOOL], rows));
    expect(output).toMatchObject({
      kind: 'table',
      columns: ['n', 'flag'],
      total: MAX_SHOWN_ROWS + 5,
    });
    expect(output.kind === 'table' ? output.rows : []).toHaveLength(MAX_SHOWN_ROWS);
    expect(output.kind === 'table' ? output.rows[0] : []).toEqual(['0', 'true']);
  });
});
