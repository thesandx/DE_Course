import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the SQL problems outside the SQL track: modeling,
 * lakehouse, dbt, data quality, Snowflake, databases and AI. They run on
 * PostgreSQL 18 like the SQL track. A problem written for another engine
 * (Snowflake's VARIANT, BigQuery's QUALIFY, dbt's Jinja) keeps its idea and
 * says in the task what PostgreSQL uses instead.
 */

const KEYWORD_COLUMNS = [
  { name: 'query_id', type: 'text' },
  { name: 'chunk_id', type: 'text' },
  { name: 'score', type: 'double precision' },
] as const;

const VECTOR_COLUMNS = [
  { name: 'query_id', type: 'text' },
  { name: 'chunk_id', type: 'text' },
  { name: 'distance', type: 'double precision' },
] as const;

const LABEL_COLUMNS = [
  { name: 'order_id', type: 'int' },
  { name: 'user_id', type: 'int' },
  { name: 'ordered_at', type: 'timestamp' },
  { name: 'is_fraud', type: 'boolean' },
] as const;

const FEATURE_COLUMNS = [
  { name: 'user_id', type: 'int' },
  { name: 'feature_ts', type: 'timestamp' },
  { name: 'orders_7d', type: 'int' },
  { name: 'avg_basket_usd', type: 'numeric(10,2)' },
  { name: '_loaded_at', type: 'timestamp' },
] as const;

const WALLET_COLUMNS = [
  { name: 'wallet_id', type: 'int' },
  { name: 'balance', type: 'numeric(12,2)' },
] as const;

const LEDGER_COLUMNS = [
  { name: 'request_id', type: 'text' },
  { name: 'wallet_id', type: 'int' },
  { name: 'amount', type: 'numeric(12,2)' },
] as const;

const STG_TRIP_COLUMNS = [
  { name: 'trip_id', type: 'text' },
  { name: 'driver_id', type: 'text' },
  { name: 'completed_at', type: 'timestamp' },
  { name: 'fare_usd', type: 'numeric(10,2)' },
  { name: 'tip_usd', type: 'numeric(10,2)' },
  { name: 'status', type: 'text' },
  { name: '_loaded_at', type: 'timestamp' },
] as const;

const EARNINGS_COLUMNS = [
  { name: 'driver_id', type: 'text' },
  { name: 'earning_date', type: 'date' },
  { name: 'trips', type: 'int' },
  { name: 'fares_usd', type: 'numeric(10,2)' },
  { name: 'tips_usd', type: 'numeric(10,2)' },
  { name: 'last_loaded_at', type: 'timestamp' },
] as const;

const CORE_DRIVER_COLUMNS = [
  { name: 'driver_id', type: 'int' },
  { name: 'name', type: 'text' },
  { name: 'city_id', type: 'int' },
  { name: 'changed_at', type: 'timestamp' },
] as const;

const CHANGE_COLUMNS = [
  { name: 'driver_id', type: 'int' },
  { name: 'name', type: 'text' },
  { name: 'city_id', type: 'int' },
  { name: 'op', type: 'char(1)' },
  { name: 'changed_at', type: 'timestamp' },
] as const;

const DIM_DRIVER_COLUMNS = [
  { name: 'driver_sk', type: 'int' },
  { name: 'driver_id', type: 'int' },
  { name: 'city_id', type: 'int' },
  { name: 'valid_from', type: 'timestamp' },
  { name: 'valid_to', type: 'timestamp' },
  { name: 'is_current', type: 'boolean' },
] as const;

const STG_DRIVER_COLUMNS = [
  { name: 'driver_id', type: 'int' },
  { name: 'city_id', type: 'int' },
  { name: 'updated_at', type: 'timestamp' },
] as const;

const FCT_TRIP_COLUMNS = [
  { name: 'trip_id', type: 'text' },
  { name: 'driver_id', type: 'text' },
  { name: 'city_id', type: 'int' },
  { name: 'status', type: 'text' },
  { name: 'fare_usd', type: 'numeric(10,2)' },
  { name: 'trip_date', type: 'date' },
] as const;

const DIM_QUALITY_DRIVER_COLUMNS = [
  { name: 'driver_id', type: 'text' },
  { name: 'name', type: 'text' },
] as const;

const RAW_ORDER_COLUMNS = [{ name: 'payload', type: 'jsonb' }] as const;

/** One raw order version, as the Eats service writes it. */
function order(
  id: string,
  city: string,
  status: string,
  updatedAt: string,
  items?: readonly (readonly [string, number, number])[],
): [Record<string, string | number | Record<string, string | number>[]>] {
  return [
    {
      order_id: id,
      city,
      status,
      updated_at: updatedAt,
      ...(items !== undefined
        ? { items: items.map(([sku, qty, price]) => ({ sku, qty, price })) }
        : {}),
    },
  ];
}

const SCD2_CHECK = `SELECT driver_id, city_id, valid_from, valid_to, is_current,
       (SELECT COUNT(DISTINCT driver_sk) = COUNT(*) FROM dim_driver) AS keys_unique
FROM dim_driver`;

export const WAREHOUSE_SQL_RUNNABLES: Record<string, RunnableSpec> = {
  'ai-hybrid-search-rrf': {
    language: 'sql',
    task: `Return «query_id, chunk_id, rrf_score, lists_found_in»: the top 10 chunks of each query by reciprocal rank fusion with k = 60. Rank each list per query from 1: keyword hits by «score», highest first, vector hits by «distance», lowest first, with ties broken by «chunk_id» ascending. A chunk's «rrf_score» is the sum of «1 / (60 + rank)» over the lists that found it, and «lists_found_in» counts those lists. Keep the 10 highest scores per query; a tie at the cut goes to the smaller «chunk_id». PostgreSQL has no «QUALIFY»: filter a row number in a subquery. Row order does not matter.`,
    tables: [
      {
        name: 'keyword_hits',
        columns: KEYWORD_COLUMNS,
        rows: [
          ['q1', 'c01', 12.0],
          ['q1', 'c02', 11.5],
          ['q1', 'c03', 9.0],
          ['q1', 'c04', 9.0],
          ['q1', 'c05', 7.5],
          ['q1', 'c06', 5.0],
          ['q1', 'c07', 4.2],
          ['q1', 'c08', 3.3],
          ['q2', 'c20', 8.0],
          ['q2', 'c21', 6.0],
        ],
      },
      {
        name: 'vector_hits',
        columns: VECTOR_COLUMNS,
        rows: [
          ['q1', 'c09', 0.1],
          ['q1', 'c03', 0.12],
          ['q1', 'c10', 0.15],
          ['q1', 'c01', 0.2],
          ['q1', 'c11', 0.22],
          ['q1', 'c06', 0.25],
          ['q1', 'c12', 0.3],
          ['q1', 'c13', 0.33],
          ['q2', 'c21', 0.05],
          ['q2', 'c22', 0.4],
        ],
      },
    ],
    starter: `-- keyword_hits(query_id, chunk_id, score): higher is better
-- vector_hits(query_id, chunk_id, distance): lower is better
-- Return query_id, chunk_id, rrf_score, lists_found_in.
SELECT query_id, chunk_id, score AS rrf_score, 1 AS lists_found_in
FROM keyword_hits;
`,
    solution: `WITH ranked AS (
  SELECT query_id, chunk_id,
         ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY score DESC, chunk_id) AS rnk
  FROM keyword_hits
  UNION ALL
  SELECT query_id, chunk_id,
         ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY distance ASC, chunk_id) AS rnk
  FROM vector_hits
),
fused AS (
  SELECT query_id, chunk_id,
         SUM(1.0 / (60 + rnk)) AS rrf_score,
         COUNT(*) AS lists_found_in
  FROM ranked
  GROUP BY query_id, chunk_id
)
SELECT query_id, chunk_id, rrf_score, lists_found_in
FROM (
  SELECT fused.*,
         ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY rrf_score DESC, chunk_id) AS pos
  FROM fused
) t
WHERE pos <= 10;
`,
    cases: [
      {
        name: 'Sample',
        note: 'c03 and c04 tie on score. c07 and c12 tie at the cut, and c07 wins it.',
      },
      {
        name: 'Ties inside both lists',
        note: 'Equal scores and equal distances: the rank still follows «chunk_id».',
        tables: [
          {
            name: 'keyword_hits',
            columns: KEYWORD_COLUMNS,
            rows: [
              ['q3', 'c30', 5.0],
              ['q3', 'c31', 5.0],
              ['q3', 'c32', 1.0],
            ],
          },
          {
            name: 'vector_hits',
            columns: VECTOR_COLUMNS,
            rows: [
              ['q3', 'c31', 0.2],
              ['q3', 'c30', 0.2],
            ],
          },
        ],
      },
      {
        name: 'Two hundred queries',
        hidden: true,
        note: 'Thirty hits per list, many chunks found by both.',
        setup: `TRUNCATE keyword_hits, vector_hits;
INSERT INTO keyword_hits
SELECT 'q' || q, 'c' || LPAD(((q * 7 + h * 3) % 45)::text, 3, '0'), ((q * 31 + h * 17) % 200) / 10.0
FROM generate_series(1, 200) AS q, generate_series(1, 30) AS h;
INSERT INTO vector_hits
SELECT 'q' || q, 'c' || LPAD(((q * 5 + h * 2) % 45)::text, 3, '0'), ((q * 13 + h * 29) % 100) / 100.0
FROM generate_series(1, 200) AS q, generate_series(1, 30) AS h;
DELETE FROM keyword_hits a USING keyword_hits b
WHERE a.ctid < b.ctid AND a.query_id = b.query_id AND a.chunk_id = b.chunk_id;
DELETE FROM vector_hits a USING vector_hits b
WHERE a.ctid < b.ctid AND a.query_id = b.query_id AND a.chunk_id = b.chunk_id;`,
      },
    ],
  },
  'ai-point-in-time-training-set': {
    language: 'sql',
    task: `Return «order_id, user_id, ordered_at, orders_7d, avg_basket_usd, is_fraud»: one row per order, with the features the model could have seen at order time. Use the latest feature row of the user that reached the store strictly before the order («_loaded_at < ordered_at») and no more than 30 days before it («_loaded_at >= ordered_at - 30 days»). «feature_ts» is the time the values describe, not the time they could be read. An order with no such row keeps NULL features. Row order does not matter.`,
    tables: [
      {
        name: 'labels',
        columns: LABEL_COLUMNS,
        rows: [
          [1, 10, '2024-05-10 09:05:00', false],
          [2, 10, '2024-05-10 09:30:00', true],
          [3, 11, '2024-05-12 12:00:00', false],
          [4, 12, '2024-05-15 08:00:00', false],
          [5, 13, '2024-06-20 10:00:00', true],
        ],
      },
      {
        name: 'user_features',
        columns: FEATURE_COLUMNS,
        rows: [
          [10, '2024-05-09 09:00:00', 2, 22.5, '2024-05-09 09:10:00'],
          [10, '2024-05-10 09:00:00', 3, 25.0, '2024-05-10 09:20:00'],
          [11, '2024-05-11 11:00:00', 6, 38.0, '2024-05-11 11:30:00'],
          [11, '2024-05-12 11:00:00', 7, 40.0, '2024-05-12 12:00:00'],
          [13, '2024-05-10 10:00:00', 1, 99.0, '2024-05-10 10:05:00'],
        ],
      },
    ],
    setup: 'CREATE INDEX ON user_features (user_id, _loaded_at);',
    starter: `-- labels(order_id, user_id, ordered_at, is_fraud)
-- user_features(user_id, feature_ts, orders_7d, avg_basket_usd, _loaded_at)
-- user_features has an index on (user_id, _loaded_at).
SELECT l.order_id, l.user_id, l.ordered_at, f.orders_7d, f.avg_basket_usd, l.is_fraud
FROM labels l
JOIN user_features f ON f.user_id = l.user_id;
`,
    solution: `SELECT order_id, user_id, ordered_at, orders_7d, avg_basket_usd, is_fraud
FROM (
  SELECT l.order_id, l.user_id, l.ordered_at, f.orders_7d, f.avg_basket_usd, l.is_fraud,
         ROW_NUMBER() OVER (PARTITION BY l.order_id ORDER BY f._loaded_at DESC) AS rn
  FROM labels l
  LEFT JOIN user_features f
    ON f.user_id = l.user_id
   AND f._loaded_at < l.ordered_at
   AND f._loaded_at >= l.ordered_at - INTERVAL '30 days'
) t
WHERE rn = 1;
`,
    cases: [
      {
        name: 'Sample',
        note: 'The 09:00 row for user 10 landed at 09:20, after order 1. The second row for user 11 landed at the exact order time. User 13’s only row is 41 days old.',
      },
      {
        name: 'Exactly 30 days',
        note: 'A row loaded 30 days to the second before the order still counts; one second older does not.',
        tables: [
          {
            name: 'labels',
            columns: LABEL_COLUMNS,
            rows: [
              [6, 20, '2024-07-31 12:00:00', false],
              [7, 21, '2024-07-31 12:00:00', true],
            ],
          },
          {
            name: 'user_features',
            columns: FEATURE_COLUMNS,
            rows: [
              [20, '2024-07-01 11:00:00', 4, 31.0, '2024-07-01 12:00:00'],
              [21, '2024-07-01 11:00:00', 9, 55.0, '2024-07-01 11:59:59'],
            ],
          },
        ],
      },
      {
        name: 'A backfilled feature row',
        hidden: true,
        note: 'A backfill loaded an old row for user 30 at 08:00, after the 09:00 row of the day before. The latest row to reach the store wins, whatever time its values describe.',
        tables: [
          {
            name: 'labels',
            columns: LABEL_COLUMNS,
            rows: [[8, 30, '2024-05-10 09:00:00', false]],
          },
          {
            name: 'user_features',
            columns: FEATURE_COLUMNS,
            rows: [
              [30, '2024-05-09 09:00:00', 3, 20.0, '2024-05-09 10:00:00'],
              [30, '2024-05-01 09:00:00', 1, 15.0, '2024-05-10 08:00:00'],
            ],
          },
        ],
      },
      {
        name: 'Three thousand orders',
        hidden: true,
        note: 'Feature rows every few hours, loaded 5 to 40 minutes late.',
        setup: `TRUNCATE labels, user_features;
INSERT INTO labels
SELECT n, n % 400, TIMESTAMP '2024-05-01' + ((n * 97) % (60 * 24 * 40)) * INTERVAL '1 minute', n % 13 = 0
FROM generate_series(1, 3000) AS n;
INSERT INTO user_features
SELECT u, ts, (u + k) % 20, ((u * 7 + k * 3) % 500) / 10.0 + 5,
       ts + (5 + (u + k) % 36) * INTERVAL '1 minute'
FROM generate_series(0, 399) AS u, generate_series(0, 79) AS k,
     LATERAL (SELECT TIMESTAMP '2024-04-01' + (k * 18 + u % 7) * INTERVAL '1 hour' AS ts) AS t
WHERE (u + k) % 3 <> 0;`,
      },
    ],
  },
  'db-wallet-lost-update': {
    language: 'sql',
    rules: [
      {
        kind: 'require',
        pattern:
          'update\\s+wallets(?:\\s+(?:as\\s+)?(\\w+))?\\s+set\\s+balance\\s*=\\s*(?:\\1\\.|wallets\\.)?balance\\s*-',
        message:
          'Compute the new balance from the row the UPDATE locks: SET balance = balance - 80. A balance read earlier, by a CTE, a subquery or the app, is a lost update when two requests run at once: both read 100, and the second write overwrites the first. These tests run one request at a time, so only this rule can see it.',
      },
    ],
    task: `Write request «w-1001»: withdraw 80 from wallet 42 in one statement. Debit only when the balance covers 80 and the ledger has no row for «w-1001» yet. Write the ledger row («w-1001», 42, -80) only when the debit happened. Two requests at once, or a client retry, must never overdraw the wallet or debit twice. «ledger.request_id» is unique. The tests run your statement twice in a row, like a retry, and then read every wallet with its ledger.`,
    tables: [
      {
        name: 'wallets',
        columns: WALLET_COLUMNS,
        rows: [
          [42, 100.0],
          [7, 500.0],
        ],
      },
      { name: 'ledger', columns: LEDGER_COLUMNS, rows: [] },
    ],
    setup: `ALTER TABLE wallets ADD PRIMARY KEY (wallet_id);
ALTER TABLE ledger ADD PRIMARY KEY (request_id);`,
    starter: `-- What the service runs today, after it read balance = 100.
UPDATE wallets SET balance = 100 - 80 WHERE wallet_id = 42;
INSERT INTO ledger (request_id, wallet_id, amount) VALUES ('w-1001', 42, -80);
`,
    solution: `WITH debit AS (
  UPDATE wallets
  SET balance = balance - 80
  WHERE wallet_id = 42
    AND balance >= 80
    AND NOT EXISTS (SELECT 1 FROM ledger WHERE request_id = 'w-1001')
  RETURNING wallet_id
)
INSERT INTO ledger (request_id, wallet_id, amount)
SELECT 'w-1001', wallet_id, -80 FROM debit;
`,
    repeat: 2,
    cases: [
      {
        name: 'Sample',
        note: 'Run twice: the retry must not debit again.',
        check: `SELECT w.wallet_id, w.balance, COUNT(l.request_id) AS debits, COALESCE(SUM(l.amount), 0) AS ledger_total
FROM wallets w LEFT JOIN ledger l ON l.wallet_id = w.wallet_id
GROUP BY w.wallet_id, w.balance`,
      },
      {
        name: 'Plenty of money',
        note: 'The balance covers two debits, but it is the same request.',
        tables: [{ name: 'wallets', columns: WALLET_COLUMNS, rows: [[42, 500.0]] }],
        check: `SELECT w.wallet_id, w.balance, COUNT(l.request_id) AS debits, COALESCE(SUM(l.amount), 0) AS ledger_total
FROM wallets w LEFT JOIN ledger l ON l.wallet_id = w.wallet_id
GROUP BY w.wallet_id, w.balance`,
      },
      {
        name: 'Not enough money',
        note: 'A balance of 60 cannot pay 80: nothing changes and the ledger stays empty.',
        tables: [{ name: 'wallets', columns: WALLET_COLUMNS, rows: [[42, 60.0]] }],
        check: `SELECT w.wallet_id, w.balance, COUNT(l.request_id) AS debits, COALESCE(SUM(l.amount), 0) AS ledger_total
FROM wallets w LEFT JOIN ledger l ON l.wallet_id = w.wallet_id
GROUP BY w.wallet_id, w.balance`,
      },
      {
        name: 'Exactly enough',
        hidden: true,
        note: 'A balance of exactly 80 pays once and ends at 0.',
        tables: [
          {
            name: 'wallets',
            columns: WALLET_COLUMNS,
            rows: [
              [42, 80.0],
              [43, 80.0],
            ],
          },
        ],
        check: `SELECT w.wallet_id, w.balance, COUNT(l.request_id) AS debits, COALESCE(SUM(l.amount), 0) AS ledger_total
FROM wallets w LEFT JOIN ledger l ON l.wallet_id = w.wallet_id
GROUP BY w.wallet_id, w.balance`,
      },
      {
        name: 'Already applied',
        hidden: true,
        note: 'An earlier attempt already wrote «w-1001».',
        tables: [
          { name: 'wallets', columns: WALLET_COLUMNS, rows: [[42, 20.0]] },
          { name: 'ledger', columns: LEDGER_COLUMNS, rows: [['w-1001', 42, -80.0]] },
        ],
        check: `SELECT w.wallet_id, w.balance, COUNT(l.request_id) AS debits, COALESCE(SUM(l.amount), 0) AS ledger_total
FROM wallets w LEFT JOIN ledger l ON l.wallet_id = w.wallet_id
GROUP BY w.wallet_id, w.balance`,
      },
    ],
  },
  'dbt-daily-driver-earnings': {
    language: 'sql',
    task: `Write, in plain SQL, what one incremental run of «fct_driver_daily_earnings» does. The table holds the last run's output; staging keeps only a few days, so days you do not touch must stay as they are. First find the changed days: the dates of «completed_at» of staging rows with «_loaded_at» later than the table's latest «last_loaded_at» minus 6 hours. Then replace the table's rows for those days with fresh totals from «stg_trips»: one row per driver and day over completed trips, with «trips», «fares_usd», «tips_usd» (a NULL tip is 0) and «last_loaded_at», the latest «_loaded_at» of those trips. A driver with no completed trip left on a changed day loses that day's row. The tests run your code twice in a row and then read the whole table.`,
    tables: [
      {
        name: 'fct_driver_daily_earnings',
        columns: EARNINGS_COLUMNS,
        rows: [
          ['d1', '2024-08-01', 3, 45.0, 6.0, '2024-08-02 01:00:00'],
          ['d1', '2024-08-03', 2, 30.0, 0.0, '2024-08-04 01:00:00'],
          ['d2', '2024-08-03', 1, 18.0, 2.0, '2024-08-04 01:00:00'],
          ['d1', '2024-08-04', 1, 12.0, 0.0, '2024-08-05 01:00:00'],
        ],
      },
      {
        name: 'stg_trips',
        columns: STG_TRIP_COLUMNS,
        rows: [
          ['t3', 'd1', '2024-08-03 10:00:00', 14.0, 5.0, 'completed', '2024-08-05 02:00:00'],
          ['t4', 'd1', '2024-08-03 15:00:00', 16.0, null, 'completed', '2024-08-04 01:00:00'],
          ['t5', 'd2', '2024-08-03 18:00:00', 18.0, 2.0, 'cancelled', '2024-08-05 03:00:00'],
          ['t6', 'd1', '2024-08-04 09:00:00', 12.0, null, 'completed', '2024-08-05 01:00:00'],
          ['t7', 'd2', '2024-08-05 08:00:00', 20.0, 3.0, 'completed', '2024-08-05 12:00:00'],
          ['t8', 'd3', '2024-08-05 09:30:00', 9.5, 0.5, 'completed', '2024-08-05 12:00:00'],
        ],
      },
    ],
    setup: `ALTER TABLE fct_driver_daily_earnings ADD PRIMARY KEY (driver_id, earning_date);`,
    starter: `-- fct_driver_daily_earnings(driver_id, earning_date, trips, fares_usd, tips_usd, last_loaded_at)
-- stg_trips(trip_id, driver_id, completed_at, fare_usd, tip_usd, status, _loaded_at)
INSERT INTO fct_driver_daily_earnings
SELECT driver_id, CAST(completed_at AS DATE), COUNT(*), SUM(fare_usd), SUM(tip_usd), MAX(_loaded_at)
FROM stg_trips
WHERE _loaded_at > (SELECT MAX(last_loaded_at) FROM fct_driver_daily_earnings)
GROUP BY 1, 2;
`,
    solution: `BEGIN;

DROP TABLE IF EXISTS changed_days;
CREATE TEMP TABLE changed_days AS
SELECT DISTINCT CAST(completed_at AS DATE) AS earning_date
FROM stg_trips
WHERE _loaded_at > (
  SELECT MAX(last_loaded_at) - INTERVAL '6 hours' FROM fct_driver_daily_earnings
);

DELETE FROM fct_driver_daily_earnings
WHERE earning_date IN (SELECT earning_date FROM changed_days);

INSERT INTO fct_driver_daily_earnings
  (driver_id, earning_date, trips, fares_usd, tips_usd, last_loaded_at)
SELECT t.driver_id, CAST(t.completed_at AS DATE), COUNT(*),
       SUM(t.fare_usd), SUM(COALESCE(t.tip_usd, 0)), MAX(t._loaded_at)
FROM stg_trips t
JOIN changed_days d ON CAST(t.completed_at AS DATE) = d.earning_date
WHERE t.status = 'completed'
GROUP BY 1, 2;

COMMIT;
`,
    repeat: 2,
    cases: [
      {
        name: 'Sample',
        note: 'Trip t3 got a tip and t5 was refunded after the last run. 1 August is gone from staging but stays in the table.',
        check: 'SELECT * FROM fct_driver_daily_earnings',
      },
      {
        name: 'Nothing new',
        note: 'No staging row is newer than the window: the run changes nothing.',
        tables: [
          {
            name: 'fct_driver_daily_earnings',
            columns: EARNINGS_COLUMNS,
            rows: [
              ['d1', '2024-08-04', 1, 12.0, 0.0, '2024-08-05 01:00:00'],
              ['d9', '2024-07-30', 4, 50.0, 4.0, '2024-07-31 01:00:00'],
            ],
          },
          {
            name: 'stg_trips',
            columns: STG_TRIP_COLUMNS,
            rows: [
              ['t6', 'd1', '2024-08-04 09:00:00', 12.0, null, 'completed', '2024-08-04 18:00:00'],
            ],
          },
        ],
        check: 'SELECT * FROM fct_driver_daily_earnings',
      },
      {
        name: 'A late row inside the lookback',
        hidden: true,
        note: "Trip t21 landed at 22:00 on 4 August, three hours before the table's latest load. It is inside the 6-hour lookback, so 2 August is rebuilt with it.",
        tables: [
          {
            name: 'fct_driver_daily_earnings',
            columns: EARNINGS_COLUMNS,
            rows: [
              ['d1', '2024-08-02', 1, 10.0, 0.0, '2024-08-03 00:30:00'],
              ['d2', '2024-08-04', 1, 12.0, 0.0, '2024-08-05 01:00:00'],
            ],
          },
          {
            name: 'stg_trips',
            columns: STG_TRIP_COLUMNS,
            rows: [
              ['t20', 'd1', '2024-08-02 11:00:00', 10.0, 0.0, 'completed', '2024-08-03 00:30:00'],
              ['t21', 'd1', '2024-08-02 18:00:00', 15.0, 2.0, 'completed', '2024-08-04 22:00:00'],
              ['t22', 'd2', '2024-08-04 09:00:00', 12.0, null, 'completed', '2024-08-05 01:00:00'],
            ],
          },
        ],
        check: 'SELECT * FROM fct_driver_daily_earnings',
      },
      {
        name: 'A week of corrections',
        hidden: true,
        note: 'Five hundred trips, late tips and refunds, and old history.',
        setup: `TRUNCATE fct_driver_daily_earnings, stg_trips;
INSERT INTO stg_trips
SELECT 't' || n, 'd' || (n % 25), ts,
       (5 + n % 30)::numeric(10, 2),
       CASE WHEN n % 4 = 0 THEN NULL ELSE (n % 5)::numeric(10, 2) END,
       CASE WHEN n % 17 = 0 THEN 'cancelled' ELSE 'completed' END,
       ts + (1 + (n * 7) % 40) * INTERVAL '1 hour'
FROM generate_series(1, 500) AS n,
     LATERAL (SELECT TIMESTAMP '2024-08-01' + ((n * 37) % (6 * 24)) * INTERVAL '1 hour' AS ts) AS t;
INSERT INTO fct_driver_daily_earnings
SELECT driver_id, CAST(completed_at AS DATE), COUNT(*), SUM(fare_usd), SUM(COALESCE(tip_usd, 0)), MAX(_loaded_at)
FROM stg_trips
WHERE status = 'completed' AND _loaded_at <= TIMESTAMP '2024-08-05 00:00'
GROUP BY 1, 2;
INSERT INTO fct_driver_daily_earnings
SELECT 'd' || n, DATE '2024-07-20', n, n * 10, n, TIMESTAMP '2024-07-21 01:00'
FROM generate_series(1, 25) AS n;`,
        check: 'SELECT * FROM fct_driver_daily_earnings',
      },
    ],
  },
  'cdc-merge-latest': {
    language: 'sql',
    task: `Apply the batch in «staging.driver_changes» to «core.drivers». A driver can appear several times in the batch: only its newest event («changed_at») counts. A newer 'c' or 'u' inserts or updates the driver; a newer 'd' deletes it. An event older than the driver's row in «core.drivers» changes nothing, and a delete for a driver that does not exist does nothing. Applying the same batch twice must change nothing the second time. PostgreSQL has «MERGE» but no «QUALIFY». The tests run your code twice and then read «core.drivers».`,
    tables: [
      {
        name: 'core.drivers',
        columns: CORE_DRIVER_COLUMNS,
        rows: [
          [1, 'Asha', 10, '2024-09-01 08:00:00'],
          [2, 'Ben', 20, '2024-09-01 08:00:00'],
          [3, 'Cara', 30, '2024-09-03 12:00:00'],
          [4, 'Dev', 40, '2024-09-01 08:00:00'],
        ],
      },
      {
        name: 'staging.driver_changes',
        columns: CHANGE_COLUMNS,
        rows: [
          [1, 'Asha', 11, 'u', '2024-09-02 09:00:00'],
          [1, 'Asha', 12, 'u', '2024-09-02 10:00:00'],
          [2, 'Ben', 20, 'd', '2024-09-02 11:00:00'],
          [3, 'Cara', 31, 'u', '2024-09-02 12:00:00'],
          [5, 'Eli', 50, 'c', '2024-09-02 07:00:00'],
          [5, 'Eli', 51, 'u', '2024-09-02 08:00:00'],
          [6, 'Fay', 60, 'c', '2024-09-02 07:30:00'],
          [6, 'Fay', 60, 'd', '2024-09-02 07:45:00'],
          [7, null, null, 'd', '2024-09-02 09:00:00'],
        ],
      },
    ],
    setup: 'ALTER TABLE core.drivers ADD PRIMARY KEY (driver_id);',
    starter: `-- core.drivers(driver_id, name, city_id, changed_at)
-- staging.driver_changes(driver_id, name, city_id, op, changed_at)
MERGE INTO core.drivers AS t
USING staging.driver_changes AS s
ON t.driver_id = s.driver_id
WHEN MATCHED THEN
  UPDATE SET name = s.name, city_id = s.city_id, changed_at = s.changed_at
WHEN NOT MATCHED THEN
  INSERT (driver_id, name, city_id, changed_at)
  VALUES (s.driver_id, s.name, s.city_id, s.changed_at);
`,
    solution: `MERGE INTO core.drivers AS t
USING (
  SELECT driver_id, name, city_id, op, changed_at
  FROM (
    SELECT c.*, ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY changed_at DESC) AS rn
    FROM staging.driver_changes c
  ) newest
  WHERE rn = 1
) AS s
ON t.driver_id = s.driver_id
WHEN MATCHED AND s.op = 'd' AND s.changed_at >= t.changed_at THEN
  DELETE
WHEN MATCHED AND s.op IN ('c', 'u') AND s.changed_at > t.changed_at THEN
  UPDATE SET name = s.name, city_id = s.city_id, changed_at = s.changed_at
WHEN NOT MATCHED AND s.op IN ('c', 'u') THEN
  INSERT (driver_id, name, city_id, changed_at)
  VALUES (s.driver_id, s.name, s.city_id, s.changed_at);
`,
    repeat: 2,
    cases: [
      {
        name: 'Sample',
        note: 'Driver 3’s event is older than its row. Driver 6 is created and deleted in the batch.',
        check: 'SELECT driver_id, name, city_id, changed_at FROM core.drivers',
      },
      {
        name: 'Delete, then create again',
        note: 'Driver 4 is deleted and created again in the same batch: the creation is newest.',
        tables: [
          {
            name: 'staging.driver_changes',
            columns: CHANGE_COLUMNS,
            rows: [
              [4, 'Dev', 40, 'd', '2024-09-02 08:00:00'],
              [4, 'Devi', 41, 'c', '2024-09-02 09:00:00'],
              [1, 'Asha', 10, 'd', '2024-09-02 10:00:00'],
            ],
          },
        ],
        check: 'SELECT driver_id, name, city_id, changed_at FROM core.drivers',
      },
      {
        name: 'Two thousand drivers',
        hidden: true,
        note: 'A batch of 5,000 events, out of order, with replays.',
        setup: `TRUNCATE core.drivers, staging.driver_changes;
INSERT INTO core.drivers
SELECT n, 'driver ' || n, n % 50, TIMESTAMP '2024-09-01' + (n % 90) * INTERVAL '1 hour'
FROM generate_series(1, 2000) AS n;
INSERT INTO staging.driver_changes
SELECT 1 + (k * 7) % 2600, 'name ' || k, k % 60,
       (ARRAY['c', 'u', 'u', 'u', 'd'])[1 + k % 5],
       TIMESTAMP '2024-09-01' + ((k * 13) % 200) * INTERVAL '1 hour' + k * INTERVAL '1 second'
FROM generate_series(1, 5000) AS k;`,
        check: 'SELECT driver_id, name, city_id, changed_at FROM core.drivers',
      },
    ],
  },
  'scd2-driver-city': {
    language: 'sql',
    task: `Write the daily load of «dim_driver», which keeps the history of «city_id» (SCD type 2), from today's snapshot «stg_driver». When a driver's city differs from their current version (NULL counts as a value), close that version: «valid_to» becomes the snapshot's «updated_at» and «is_current» false. Then give the driver a new current version from «updated_at» to «9999-12-31». A new driver gets a first version the same way. A driver missing from the snapshot keeps their current version. A snapshot row whose «updated_at» is not later than the current version's «valid_from» is stale, and changes nothing. Take each new «driver_sk» from «next_sk()». The tests run your code twice in a row, then read the history and check that every key is unique.`,
    tables: [
      {
        name: 'dim_driver',
        columns: DIM_DRIVER_COLUMNS,
        rows: [
          [1, 101, 10, '2024-01-01 00:00:00', '9999-12-31 00:00:00', true],
          [2, 102, 20, '2024-01-01 00:00:00', '2024-03-01 00:00:00', false],
          [3, 102, 21, '2024-03-01 00:00:00', '9999-12-31 00:00:00', true],
          [4, 103, 30, '2024-01-01 00:00:00', '9999-12-31 00:00:00', true],
          [5, 104, null, '2024-02-01 00:00:00', '9999-12-31 00:00:00', true],
        ],
      },
      {
        name: 'stg_driver',
        columns: STG_DRIVER_COLUMNS,
        rows: [
          [101, 10, '2024-05-01 06:00:00'],
          [102, 22, '2024-05-01 06:00:00'],
          [104, 40, '2024-05-01 06:00:00'],
          [105, 50, '2024-05-01 06:00:00'],
        ],
      },
    ],
    setup: `CREATE SEQUENCE dim_driver_sk START 5000;
CREATE FUNCTION next_sk() RETURNS int LANGUAGE sql AS $$ SELECT nextval('dim_driver_sk')::int $$;`,
    starter: `-- dim_driver(driver_sk, driver_id, city_id, valid_from, valid_to, is_current)
-- stg_driver(driver_id, city_id, updated_at)
INSERT INTO dim_driver (driver_sk, driver_id, city_id, valid_from, valid_to, is_current)
SELECT next_sk(), driver_id, city_id, updated_at, TIMESTAMP '9999-12-31', TRUE
FROM stg_driver;
`,
    solution: `BEGIN;

-- Close the current version when the city changed.
UPDATE dim_driver d
SET valid_to = s.updated_at, is_current = FALSE
FROM stg_driver s
WHERE d.driver_id = s.driver_id
  AND d.is_current
  AND d.city_id IS DISTINCT FROM s.city_id
  AND s.updated_at > d.valid_from;

-- Open a current version for new drivers and for drivers just closed.
INSERT INTO dim_driver (driver_sk, driver_id, city_id, valid_from, valid_to, is_current)
SELECT next_sk(), s.driver_id, s.city_id, s.updated_at, TIMESTAMP '9999-12-31', TRUE
FROM stg_driver s
LEFT JOIN dim_driver d ON d.driver_id = s.driver_id AND d.is_current
WHERE d.driver_id IS NULL;

COMMIT;
`,
    repeat: 2,
    cases: [
      {
        name: 'Sample',
        note: 'Driver 102 moves, 104 goes from no city to city 40, 105 is new and 103 is not in the snapshot.',
        check: SCD2_CHECK,
      },
      {
        name: 'Back to an old city, and to no city',
        note: 'Driver 102 returns to city 20: that is a new version, not the old one reopened. Driver 101 loses their city.',
        tables: [
          {
            name: 'stg_driver',
            columns: STG_DRIVER_COLUMNS,
            rows: [
              [101, null, '2024-05-01 06:00:00'],
              [102, 20, '2024-05-01 06:00:00'],
              [103, 30, '2024-05-01 06:00:00'],
            ],
          },
        ],
        check: SCD2_CHECK,
      },
      {
        name: 'A stale snapshot row',
        hidden: true,
        note: 'The row for driver 102 is from 15 February, older than their current version from 1 March. It is stale: nothing changes for 102.',
        tables: [
          {
            name: 'stg_driver',
            columns: STG_DRIVER_COLUMNS,
            rows: [
              [102, 25, '2024-02-15 06:00:00'],
              [103, 31, '2024-05-01 06:00:00'],
            ],
          },
        ],
        check: SCD2_CHECK,
      },
      {
        name: 'After a single run',
        hidden: true,
        note: 'Every snapshot driver has a current version after one run, not only after the rerun.',
        repeat: 1,
        check: SCD2_CHECK,
      },
      {
        name: 'A thousand drivers',
        hidden: true,
        note: 'About one in ten moves and one in twenty is new.',
        setup: `TRUNCATE dim_driver, stg_driver;
INSERT INTO dim_driver
SELECT n, n, CASE WHEN n % 31 = 0 THEN NULL ELSE n % 40 END,
       TIMESTAMP '2024-01-01', TIMESTAMP '9999-12-31', TRUE
FROM generate_series(1, 1000) AS n;
INSERT INTO stg_driver
SELECT n,
       CASE WHEN n % 10 = 3 THEN (n + 1) % 40 WHEN n % 77 = 0 THEN NULL
            WHEN n % 31 = 0 AND n % 2 = 0 THEN 5 ELSE n % 40 END,
       TIMESTAMP '2024-05-01 06:00'
FROM generate_series(1, 1050) AS n
WHERE n % 13 <> 0;`,
        check: SCD2_CHECK,
      },
    ],
  },
  'quality-checks-in-sql': {
    language: 'sql',
    task: `Run the checks for «trip_date» 2024-10-08 and return «check_name, failures», one row per failed check: «duplicate_trip_id» counts the trip ids that appear more than once; «unknown_driver» counts rows whose «driver_id» is not in «dim_driver» (NULL included); «negative_fare» counts completed rows with a fare below 0; «low_volume» is 1 when the day has fewer than 70% of the rows of 2024-10-01. A check with no failures returns no row, so an empty result means the day may publish. PostgreSQL has no «IF()»: use «CASE». Row order does not matter.`,
    tables: [
      {
        name: 'fct_trips',
        columns: FCT_TRIP_COLUMNS,
        rows: [
          ['t1', 'd1', 1, 'completed', 12.5, '2024-10-08'],
          ['t2', 'd2', 1, 'completed', 9.0, '2024-10-08'],
          ['t2', 'd2', 1, 'completed', 9.0, '2024-10-08'],
          ['t3', 'd9', 2, 'completed', 15.0, '2024-10-08'],
          ['t4', 'd1', 2, 'completed', -5.0, '2024-10-08'],
          ['t5', 'd3', 2, 'cancelled', -3.0, '2024-10-08'],
          ...Array.from(
            { length: 10 },
            (_, index): [string, string, number, string, number, string] => [
              `p${index + 1}`,
              'd1',
              1,
              'completed',
              10.0,
              '2024-10-01',
            ],
          ),
        ],
      },
      {
        name: 'dim_driver',
        columns: DIM_QUALITY_DRIVER_COLUMNS,
        rows: [
          ['d1', 'Asha'],
          ['d2', 'Ben'],
          ['d3', 'Cara'],
        ],
      },
    ],
    starter: `-- fct_trips(trip_id, driver_id, city_id, status, fare_usd, trip_date)
-- dim_driver(driver_id, name)
SELECT 'negative_fare' AS check_name, COUNT(*) AS failures
FROM fct_trips
WHERE trip_date = DATE '2024-10-08' AND fare_usd < 0;
`,
    solution: `WITH today AS (
  SELECT * FROM fct_trips WHERE trip_date = DATE '2024-10-08'
),
dupes AS (
  SELECT 'duplicate_trip_id' AS check_name, COUNT(*) AS failures
  FROM (SELECT trip_id FROM today GROUP BY trip_id HAVING COUNT(*) > 1) d
),
orphans AS (
  SELECT 'unknown_driver' AS check_name, COUNT(*) AS failures
  FROM today t
  LEFT JOIN dim_driver d ON d.driver_id = t.driver_id
  WHERE d.driver_id IS NULL
),
negative_fares AS (
  SELECT 'negative_fare' AS check_name, COUNT(*) AS failures
  FROM today
  WHERE status = 'completed' AND fare_usd < 0
),
volume AS (
  SELECT 'low_volume' AS check_name,
         CASE
           WHEN (SELECT COUNT(*) FROM today)
                < 0.7 * (SELECT COUNT(*) FROM fct_trips WHERE trip_date = DATE '2024-10-01')
           THEN 1 ELSE 0
         END AS failures
)
SELECT check_name, failures
FROM (
  SELECT * FROM dupes
  UNION ALL SELECT * FROM orphans
  UNION ALL SELECT * FROM negative_fares
  UNION ALL SELECT * FROM volume
) checks
WHERE failures > 0;
`,
    cases: [
      {
        name: 'Sample',
        note: 't2 is loaded twice, d9 is not a driver, and the cancelled refund of t5 is not a failure.',
      },
      {
        name: 'A clean day at exactly 70%',
        note: 'Seven rows against ten a week earlier is not below 70%. Every check passes, so no rows.',
        tables: [
          {
            name: 'fct_trips',
            columns: FCT_TRIP_COLUMNS,
            rows: [
              ...Array.from(
                { length: 7 },
                (_, index): [string, string, number, string, number, string] => [
                  `n${index + 1}`,
                  'd2',
                  1,
                  'completed',
                  11.0,
                  '2024-10-08',
                ],
              ),
              ...Array.from(
                { length: 10 },
                (_, index): [string, string, number, string, number, string] => [
                  `p${index + 1}`,
                  'd1',
                  1,
                  'completed',
                  10.0,
                  '2024-10-01',
                ],
              ),
            ],
          },
        ],
      },
      {
        name: 'A NULL driver and a quiet day',
        hidden: true,
        note: 'Rows with no driver count as unknown.',
        setup: `TRUNCATE fct_trips;
INSERT INTO fct_trips
SELECT 'x' || n, CASE WHEN n % 9 = 0 THEN NULL WHEN n % 7 = 0 THEN 'd8' ELSE 'd' || (1 + n % 3) END,
       n % 4, CASE WHEN n % 5 = 0 THEN 'cancelled' ELSE 'completed' END,
       CASE WHEN n % 6 = 0 THEN -2 ELSE 8 END, DATE '2024-10-08'
FROM generate_series(1, 60) AS n;
INSERT INTO fct_trips SELECT * FROM fct_trips WHERE trip_id IN ('x3', 'x10', 'x11');
INSERT INTO fct_trips
SELECT 'y' || n, 'd1', 1, 'completed', 10, DATE '2024-10-01' FROM generate_series(1, 120) AS n;`,
      },
    ],
  },
  'sf-flatten-order-items': {
    language: 'sql',
    task: `«raw.orders» holds one «jsonb» «payload» per order version, like a Snowflake VARIANT. Use only the latest version of each «order_id» (largest «updated_at»), then keep delivered orders. Return «city, sku, revenue»: each city's SKUs with revenue, the sum of «qty × price», keeping a SKU when fewer than 3 SKUs of its city have more revenue, so ties at third place stay. An order without an «items» key adds nothing. In PostgreSQL, «payload->>'city'» reads a field as text and «jsonb_array_elements(payload->'items')» flattens the array. Row order does not matter.`,
    tables: [
      {
        name: 'raw.orders',
        columns: RAW_ORDER_COLUMNS,
        rows: [
          order('o1', 'SF', 'delivered', '2024-11-01T10:00:00', [
            ['burger', 2, 8.5],
            ['fries', 1, 3.0],
          ]),
          order('o1', 'SF', 'delivered', '2024-11-01T10:30:00', [
            ['burger', 3, 8.5],
            ['fries', 1, 3.0],
          ]),
          order('o2', 'SF', 'delivered', '2024-11-01T11:00:00', [
            ['salad', 1, 12.0],
            ['soda', 2, 2.5],
          ]),
          order('o3', 'SF', 'cancelled', '2024-11-01T11:05:00', [['burger', 5, 8.5]]),
          order('o4', 'SF', 'delivered', '2024-11-01T11:10:00'),
          order('o5', 'SF', 'delivered', '2024-11-01T12:00:00', [
            ['fries', 4, 3.0],
            ['soda', 2, 2.5],
          ]),
          order('o6', 'NYC', 'delivered', '2024-11-01T09:00:00', [
            ['bagel', 3, 4.0],
            ['coffee', 2, 4.0],
            ['juice', 1, 7.0],
            ['muffin', 2, 3.5],
            ['tea', 1, 2.0],
          ]),
          order('o7', 'NYC', 'delivered', '2024-11-01T09:30:00', [['tea', 20, 2.0]]),
          order('o7', 'NYC', 'cancelled', '2024-11-01T09:45:00', [['tea', 20, 2.0]]),
        ],
      },
    ],
    starter: `-- raw.orders(payload jsonb)
SELECT payload->>'city' AS city, item->>'sku' AS sku,
       SUM((item->>'qty')::int * (item->>'price')::numeric) AS revenue
FROM raw.orders, jsonb_array_elements(payload->'items') AS item
GROUP BY 1, 2;
`,
    solution: `WITH latest AS (
  SELECT payload
  FROM (
    SELECT payload,
           ROW_NUMBER() OVER (
             PARTITION BY payload->>'order_id'
             ORDER BY (payload->>'updated_at')::timestamp DESC
           ) AS rn
    FROM raw.orders
  ) versions
  WHERE rn = 1
),
items AS (
  SELECT l.payload->>'city' AS city,
         i->>'sku' AS sku,
         (i->>'qty')::int * (i->>'price')::numeric(10, 2) AS revenue
  FROM latest l
  CROSS JOIN LATERAL jsonb_array_elements(l.payload->'items') AS i
  WHERE l.payload->>'status' = 'delivered'
),
by_sku AS (
  SELECT city, sku, SUM(revenue) AS revenue
  FROM items
  GROUP BY city, sku
)
SELECT city, sku, revenue
FROM (
  SELECT by_sku.*, RANK() OVER (PARTITION BY city ORDER BY revenue DESC) AS rnk
  FROM by_sku
) ranked
WHERE rnk <= 3;
`,
    cases: [
      {
        name: 'Sample',
        note: 'o1 has two versions, o4 has no items, and o7 was cancelled after it was delivered. In NYC, juice and muffin tie at third.',
      },
      {
        name: 'Four hundred orders',
        hidden: true,
        note: 'Three cities, several versions per order and some orders without items.',
        setup: `TRUNCATE raw.orders;
INSERT INTO raw.orders
SELECT jsonb_build_object(
         'order_id', 'o' || n,
         'city', (ARRAY['SF', 'NYC', 'LA'])[1 + n % 3],
         'status', CASE WHEN (n + v) % 6 = 0 THEN 'cancelled' ELSE 'delivered' END,
         'updated_at', to_char(TIMESTAMP '2024-11-01' + (n * 3 + v * 20) * INTERVAL '1 minute', 'YYYY-MM-DD"T"HH24:MI:SS')
       ) || CASE WHEN n % 11 = 0 THEN '{}'::jsonb ELSE jsonb_build_object('items', jsonb_build_array(
         jsonb_build_object('sku', 'sku' || ((n * 7 + v) % 9), 'qty', 1 + (n + v) % 4, 'price', 2.5 + n % 5),
         jsonb_build_object('sku', 'sku' || ((n * 5) % 9), 'qty', 1 + n % 3, 'price', 4.0)
       )) END
FROM generate_series(1, 400) AS n, generate_series(0, n % 3) AS v;`,
      },
    ],
  },
};
