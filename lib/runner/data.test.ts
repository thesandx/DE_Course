import { describe, expect, it } from 'vitest';

import {
  assertIdentifier,
  caseTables,
  jobSource,
  pythonJob,
  pythonLiteral,
  pythonPrelude,
  specHash,
  sqlLiteral,
  sqlSetup,
  sqlTable,
} from '@/lib/runner/data';
import type { DataTable, RunnableSpec } from '@/types/runner';

const trips: DataTable = {
  name: 'trips',
  columns: [
    { name: 'id', type: 'int' },
    { name: 'city', type: 'text' },
  ],
  rows: [
    [1, "Ko'n"],
    [2, null],
  ],
};

const sqlSpec: RunnableSpec = {
  language: 'sql',
  task: 'Count trips.',
  tables: [trips],
  setup: 'CREATE INDEX ON trips (city);',
  starter: 'SELECT 1;',
  solution: 'SELECT count(*) FROM trips;',
  cases: [
    { name: 'Sample' },
    {
      name: 'Empty',
      tables: [{ ...trips, rows: [] }],
      setup: 'ANALYZE trips;',
    },
  ],
};

describe('identifiers and tables', () => {
  it('accepts plain lowercase names, with one schema', () => {
    expect(assertIdentifier('raw.trips_2024')).toBe('raw.trips_2024');
    expect(() => assertIdentifier('Trips; DROP')).toThrow(/plain lowercase identifier/);
  });

  it('lets a case replace a base table of the same name', () => {
    const [table] = caseTables(sqlSpec, sqlSpec.cases[1] ?? { name: 'x' });
    expect(table?.rows).toEqual([]);
  });

  it('writes SQL literals for each kind of cell', () => {
    expect(sqlLiteral(null, 'int')).toBe('NULL');
    expect(sqlLiteral("it's", 'text')).toBe("'it''s'");
    expect(sqlLiteral(true, 'boolean')).toBe('TRUE');
    expect(sqlLiteral(Number.POSITIVE_INFINITY, 'float8')).toBe('NULL');
    expect(sqlLiteral([1, 2], 'int[]')).toBe('ARRAY[1, 2]::int[]');
    expect(sqlLiteral({ a: 1 }, 'jsonb')).toBe(`'{"a":1}'::jsonb`);
    expect(sqlLiteral({ a: 1 }, 'text')).toBe(`'{"a":1}'`);
  });

  it('creates the schema of a qualified table, then the table and its rows', () => {
    expect(sqlTable({ ...trips, name: 'raw.trips' })).toBe(
      "CREATE SCHEMA IF NOT EXISTS raw;\nCREATE TABLE raw.trips (id int, city text);\nINSERT INTO raw.trips VALUES\n  (1, 'Ko''n'),\n  (2, NULL);",
    );
  });

  it('loads the tables, then the spec setup, then the case setup', () => {
    const setup = sqlSetup(sqlSpec, sqlSpec.cases[1] ?? { name: 'x' });
    expect(setup).toBe(
      'CREATE TABLE trips (id int, city text);\nCREATE INDEX ON trips (city);\nANALYZE trips;',
    );
  });
});

describe('Python literals and preludes', () => {
  it('writes dates, timestamps, floats, lists and structs', () => {
    expect(pythonLiteral('2024-02-29', 'date')).toBe('date(2024, 2, 29)');
    expect(pythonLiteral('2024-02-29 10:05', 'timestamp')).toBe('datetime(2024, 2, 29, 10, 5, 0)');
    expect(pythonLiteral(3, 'double')).toBe('3.0');
    expect(pythonLiteral(3, 'int')).toBe('3');
    expect(pythonLiteral(Number.NaN)).toBe('None');
    expect(pythonLiteral(false)).toBe('False');
    expect(pythonLiteral(['2024-01-01'], 'array<date>')).toBe('[date(2024, 1, 1)]');
    expect(pythonLiteral({ sku: 'a', at: '2024-01-01' }, 'struct<sku:string,at:date>')).toBe(
      '{"sku": "a", "at": date(2024, 1, 1)}',
    );
    expect(() => pythonLiteral('soon', 'date')).toThrow(/not a date/);
    expect(() => pythonLiteral('soon', 'timestamp')).toThrow(/not a timestamp/);
  });

  it('builds Spark DataFrames for PySpark, with a one-column tuple comma', () => {
    const spec: RunnableSpec = {
      language: 'pyspark',
      task: 't',
      tables: [{ name: 'ids', columns: [{ name: 'id', type: 'long' }], rows: [[1], [2]] }],
      starter: '',
      solution: '',
      cases: [{ name: 'Sample' }],
    };
    const prelude = pythonPrelude(spec, { name: 'Sample' });
    expect(prelude).toContain('spark = SparkSession.builder.getOrCreate()');
    expect(prelude).toContain('ids = spark.createDataFrame([\n    (1,),\n    (2,),\n], "id long")');
  });

  it('builds pandas DataFrames, with dates parsed, then the setup and helpers', () => {
    const spec: RunnableSpec = {
      language: 'python',
      task: 't',
      tables: [
        {
          name: 'rides',
          columns: [
            { name: 'day', type: 'date' },
            { name: 'fare', type: 'float' },
          ],
          rows: [['2024-01-01', 10]],
        },
      ],
      setup: 'LIMIT = 5',
      helpers: 'def check(x):\n    return verdict(True)',
      starter: '',
      solution: '',
      cases: [{ name: 'Sample' }],
    };
    expect(pythonPrelude(spec, { name: 'Sample' })).toBe(
      'import pandas as pd\nfrom datetime import date, datetime, timedelta\nrides = pd.DataFrame({\n    "day": pd.to_datetime(["2024-01-01"]),\n    "fare": [10.0],\n})\nLIMIT = 5\ndef check(x):\n    return verdict(True)',
    );
  });
});

describe('pythonJob', () => {
  const spec: RunnableSpec = {
    language: 'python',
    task: 't',
    setup: 'xs = [1, 2]',
    starter: 'result = None',
    solution: 'result = sum(xs)',
    modules: ['prefect'],
    cases: [
      { name: 'Sample' },
      {
        name: 'Big',
        hidden: true,
        setup: 'xs = list(range(10))',
        limitS: 1,
        slowHint: 'Loop once.',
      },
    ],
  };

  it('runs only the sample for Run, and every case for Submit', () => {
    const run = pythonJob({ id: 1, action: 'run', key: 'k', code: 'result = 3', spec });
    expect(run.cases.map((runCase) => runCase.name)).toEqual(['Sample']);
    const check = pythonJob({ id: 2, action: 'check', key: 'k', code: 'result = 3', spec });
    expect(check.cases[1]).toEqual({
      name: 'Big',
      note: '',
      hidden: true,
      prelude: 'xs = [1, 2]',
      setup: 'xs = list(range(10))',
      check: '',
      order: null,
      tolerance: null,
      limitS: 1,
      slowHint: 'Loop once.',
    });
    expect(check.modules).toEqual(['prefect']);
    expect(jobSource(check)).toContain('result = sum(xs)');
  });

  it('leaves the imports of a sandbox module out of the source it scans', () => {
    const code = 'import prefect\nfrom prefect import flow\n  import pandas as pd\nimport prefects';
    const job = pythonJob({ id: 1, action: 'run', key: 'k', code, spec });
    const source = jobSource(job);
    expect(source).not.toContain('import prefect\n');
    expect(source).not.toContain('from prefect import flow');
    expect(source).toContain('import pandas as pd');
    expect(source).toContain('import prefects');
    const plain = pythonJob({
      id: 1,
      action: 'run',
      key: 'k',
      code,
      spec: { ...spec, modules: [] },
    });
    expect(jobSource(plain)).toContain('from prefect import flow');
  });

  it('refuses a SQL spec', () => {
    expect(() => pythonJob({ id: 1, action: 'run', key: 'k', code: '', spec: sqlSpec })).toThrow();
  });
});

describe('specHash', () => {
  it('is stable for a spec and changes when the spec changes', () => {
    expect(specHash(sqlSpec)).toBe(specHash({ ...sqlSpec }));
    expect(specHash(sqlSpec)).not.toBe(specHash({ ...sqlSpec, solution: 'SELECT 2;' }));
  });
});
