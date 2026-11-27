import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the SQL track's problems. Each runs on PostgreSQL 18 in
 * the browser. See `lib/course/README.md` > Runnable problems.
 */
export const SQL_RUNNABLES: Record<string, RunnableSpec> = {
  'driver-longest-streak': {
    language: 'sql',
    task: `Return one row per driver: «driver_id, start_day, end_day, length». A driver's day is the date of «online_at». «length» counts the days in the run. When two runs tie on length, return the later one. Row order does not matter.`,
    tables: [
      {
        name: 'driver_sessions',
        columns: [
          { name: 'driver_id', type: 'int' },
          { name: 'online_at', type: 'timestamp' },
          { name: 'offline_at', type: 'timestamp' },
        ],
        rows: [
          [1, '2024-03-01 08:00', '2024-03-01 11:00'],
          [1, '2024-03-01 18:00', '2024-03-01 20:00'],
          [1, '2024-03-02 09:00', '2024-03-02 12:00'],
          [1, '2024-03-03 07:30', '2024-03-03 09:00'],
          [1, '2024-03-05 10:00', '2024-03-05 13:00'],
          [1, '2024-03-06 10:00', '2024-03-06 13:00'],
          [2, '2024-03-02 22:00', '2024-03-02 23:30'],
          [2, '2024-03-04 06:00', '2024-03-04 09:00'],
          [2, '2024-03-05 06:00', '2024-03-05 09:00'],
          [3, '2024-03-10 12:00', '2024-03-10 14:00'],
        ],
      },
    ],
    starter: `-- driver_sessions(driver_id, online_at, offline_at)
-- Return driver_id, start_day, end_day, length.
SELECT driver_id
FROM driver_sessions;
`,
    solution: `WITH days AS (
  SELECT DISTINCT driver_id, CAST(online_at AS DATE) AS day
  FROM driver_sessions
),
islands AS (
  SELECT driver_id, day,
         day - CAST(ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY day) AS INT) AS grp
  FROM days
),
runs AS (
  SELECT driver_id, MIN(day) AS start_day, MAX(day) AS end_day, COUNT(*) AS length
  FROM islands
  GROUP BY driver_id, grp
)
SELECT driver_id, start_day, end_day, length
FROM (
  SELECT runs.*,
         ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY length DESC, end_day DESC) AS rn
  FROM runs
) r
WHERE rn = 1;
`,
    cases: [
      { name: 'Sample', note: 'The data in the Data tab.' },
      {
        name: 'Ties go to the later run',
        note: 'Two runs of three days: the later one wins.',
        tables: [
          {
            name: 'driver_sessions',
            columns: [
              { name: 'driver_id', type: 'int' },
              { name: 'online_at', type: 'timestamp' },
              { name: 'offline_at', type: 'timestamp' },
            ],
            rows: [
              [7, '2024-01-01 09:00', '2024-01-01 10:00'],
              [7, '2024-01-02 09:00', '2024-01-02 10:00'],
              [7, '2024-01-03 09:00', '2024-01-03 10:00'],
              [7, '2024-01-10 09:00', '2024-01-10 10:00'],
              [7, '2024-01-11 09:00', '2024-01-11 10:00'],
              [7, '2024-01-12 09:00', '2024-01-12 10:00'],
            ],
          },
        ],
      },
      {
        name: 'Across a month end',
        note: 'The run crosses 29 February in a leap year.',
        tables: [
          {
            name: 'driver_sessions',
            columns: [
              { name: 'driver_id', type: 'int' },
              { name: 'online_at', type: 'timestamp' },
              { name: 'offline_at', type: 'timestamp' },
            ],
            rows: [
              [4, '2024-02-28 23:00', '2024-02-28 23:50'],
              [4, '2024-02-29 08:00', '2024-02-29 09:00'],
              [4, '2024-03-01 08:00', '2024-03-01 09:00'],
              [4, '2024-03-03 08:00', '2024-03-03 09:00'],
            ],
          },
        ],
      },
      {
        name: 'A fleet of 200 drivers',
        hidden: true,
        note: 'Many drivers, up to two sessions a day, gaps every few days.',
        setup: `TRUNCATE driver_sessions;
INSERT INTO driver_sessions
SELECT d, ts, ts + INTERVAL '2 hours'
FROM generate_series(1, 200) AS d,
     generate_series(0, 59) AS n,
     generate_series(0, 1) AS k,
     LATERAL (SELECT TIMESTAMP '2024-01-01 06:00' + n * INTERVAL '1 day'
                     + (k * 9 + n % 3) * INTERVAL '1 hour' AS ts) AS t
WHERE (n + d) % (5 + d % 7) <> 0 AND (k = 0 OR (n + d) % 2 = 0);`,
      },
    ],
  },
};
