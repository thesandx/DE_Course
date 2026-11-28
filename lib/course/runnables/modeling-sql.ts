import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the modeling problems that a loop asks you to prove in
 * SQL: late-arriving dimensions, a membership model, a rollup over a star
 * schema, a bitemporal lookup and a periodic snapshot. They run on
 * PostgreSQL 18, like every SQL problem.
 */

const DIM_CUSTOMER_COLUMNS = [
  { name: 'customer_sk', type: 'int' },
  { name: 'customer_id', type: 'text' },
  { name: 'segment', type: 'text' },
  { name: 'is_inferred', type: 'boolean' },
] as const;

const STG_ORDER_COLUMNS = [
  { name: 'order_id', type: 'text' },
  { name: 'customer_id', type: 'text' },
  { name: 'ordered_at', type: 'timestamp' },
  { name: 'amount_usd', type: 'numeric(10,2)' },
] as const;

const FCT_ORDER_COLUMNS = [
  { name: 'order_id', type: 'text' },
  { name: 'customer_sk', type: 'int' },
  { name: 'ordered_at', type: 'timestamp' },
  { name: 'amount_usd', type: 'numeric(10,2)' },
] as const;

const INFERRED_CHECK = `SELECT 'fact' AS kind, f.order_id, d.customer_id, d.is_inferred, f.amount_usd, NULL::bigint AS dim_rows
FROM fct_orders f JOIN dim_customer d ON d.customer_sk = f.customer_sk
UNION ALL
SELECT 'dim', NULL, customer_id, NULL, NULL, COUNT(*)
FROM dim_customer GROUP BY customer_id`;

const DIM_HISTORY_COLUMNS = [
  { name: 'customer_sk', type: 'int' },
  { name: 'customer_id', type: 'text' },
  { name: 'segment', type: 'text' },
  { name: 'is_inferred', type: 'boolean' },
  { name: 'valid_from', type: 'timestamp' },
  { name: 'valid_to', type: 'timestamp' },
  { name: 'is_current', type: 'boolean' },
] as const;

const STG_CUSTOMER_COLUMNS = [
  { name: 'customer_id', type: 'text' },
  { name: 'segment', type: 'text' },
  { name: 'updated_at', type: 'timestamp' },
] as const;

// Keys below 5000 existed before the run; a new key comes from next_sk() and is shown as NULL.
const FILL_CHECK = `SELECT CASE WHEN customer_sk < 5000 THEN customer_sk END AS kept_sk,
       customer_id, segment, is_inferred, valid_from, valid_to, is_current,
       (SELECT COUNT(*) FROM dim_customer c WHERE c.customer_id = d.customer_id AND c.is_current) AS current_rows
FROM dim_customer d`;

const MEMBERSHIP_COLUMNS = [
  { name: 'member_id', type: 'int' },
  { name: 'plan', type: 'text' },
  { name: 'event', type: 'text' },
  { name: 'event_at', type: 'timestamp' },
] as const;

const SALE_COLUMNS = [
  { name: 'sale_id', type: 'int' },
  { name: 'product_id', type: 'int' },
  { name: 'location_id', type: 'int' },
  { name: 'sold_at', type: 'timestamp' },
  { name: 'amount_usd', type: 'numeric(10,2)' },
  { name: 'is_return', type: 'boolean' },
] as const;

const PRICE_HISTORY_COLUMNS = [
  { name: 'sku', type: 'text' },
  { name: 'price', type: 'numeric(10,2)' },
  { name: 'valid_from', type: 'date' },
  { name: 'valid_to', type: 'date' },
  { name: 'recorded_at', type: 'timestamp' },
] as const;

const PRICED_ORDER_COLUMNS = [
  { name: 'order_id', type: 'int' },
  { name: 'sku', type: 'text' },
  { name: 'ordered_on', type: 'date' },
] as const;

const ACCOUNT_COLUMNS = [
  { name: 'account_id', type: 'int' },
  { name: 'opened_on', type: 'date' },
] as const;

const TRANSACTION_COLUMNS = [
  { name: 'txn_id', type: 'int' },
  { name: 'account_id', type: 'int' },
  { name: 'posted_at', type: 'timestamp' },
  { name: 'amount', type: 'numeric(12,2)' },
] as const;

export const MODELING_SQL_RUNNABLES: Record<string, RunnableSpec> = {
  'late-dim-inferred-member': {
    language: 'sql',
    task: `Load «stg_orders» into «fct_orders». Each order gets the «customer_sk» of its customer in «dim_customer». When the customer is not in «dim_customer» yet, add an **inferred member** first: a new «customer_sk» from «next_sk()», the «customer_id», a NULL «segment» and «is_inferred» true. Add one inferred row per customer, however many orders it has. An order with a NULL «customer_id» points at the unknown member, «customer_sk» -1, which already exists. Never drop an order. An order already in «fct_orders» is not loaded again. The tests run your code twice in a row, then read every fact with its customer and count the rows of each customer.`,
    tables: [
      {
        name: 'dim_customer',
        columns: DIM_CUSTOMER_COLUMNS,
        rows: [
          [-1, null, 'unknown', false],
          [1, 'c1', 'gold', false],
          [2, 'c2', 'silver', false],
        ],
      },
      {
        name: 'stg_orders',
        columns: STG_ORDER_COLUMNS,
        rows: [
          ['o1', 'c1', '2024-09-01 10:00:00', 40.0],
          ['o2', 'c3', '2024-09-01 11:00:00', 25.0],
          ['o3', 'c3', '2024-09-01 12:30:00', 18.5],
          ['o4', null, '2024-09-01 13:00:00', 9.0],
          ['o5', 'c4', '2024-09-01 14:00:00', 61.0],
          ['o0', 'c1', '2024-08-31 09:00:00', 99.0],
        ],
      },
      {
        name: 'fct_orders',
        columns: FCT_ORDER_COLUMNS,
        rows: [['o0', 1, '2024-08-31 09:00:00', 12.0]],
      },
    ],
    setup: `CREATE SEQUENCE customer_sk_seq START 5000;
CREATE FUNCTION next_sk() RETURNS int LANGUAGE sql AS $$ SELECT nextval('customer_sk_seq')::int $$;
ALTER TABLE fct_orders ADD PRIMARY KEY (order_id);
ALTER TABLE dim_customer ADD PRIMARY KEY (customer_sk);`,
    starter: `-- dim_customer(customer_sk, customer_id, segment, is_inferred)
-- stg_orders(order_id, customer_id, ordered_at, amount_usd)
-- fct_orders(order_id, customer_sk, ordered_at, amount_usd)
-- This drops every order whose customer has not arrived yet.
INSERT INTO fct_orders (order_id, customer_sk, ordered_at, amount_usd)
SELECT s.order_id, d.customer_sk, s.ordered_at, s.amount_usd
FROM stg_orders s
JOIN dim_customer d ON d.customer_id = s.customer_id;
`,
    solution: `BEGIN;

-- 1. One inferred member for each customer that has not arrived yet.
INSERT INTO dim_customer (customer_sk, customer_id, segment, is_inferred)
SELECT next_sk(), missing.customer_id, NULL, TRUE
FROM (
  SELECT DISTINCT s.customer_id
  FROM stg_orders s
  WHERE s.customer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id)
) missing;

-- 2. Every new order, keyed to its customer or to the unknown member.
INSERT INTO fct_orders (order_id, customer_sk, ordered_at, amount_usd)
SELECT s.order_id, COALESCE(d.customer_sk, -1), s.ordered_at, s.amount_usd
FROM stg_orders s
LEFT JOIN dim_customer d ON d.customer_id = s.customer_id
WHERE NOT EXISTS (SELECT 1 FROM fct_orders f WHERE f.order_id = s.order_id);

COMMIT;
`,
    repeat: 2,
    cases: [
      {
        name: 'Sample',
        note: 'c3 and c4 have not arrived: each gets one inferred row. o4 has no customer. o0 is already loaded and keeps its amount.',
        check: INFERRED_CHECK,
      },
      {
        name: 'Every customer is known',
        note: 'Nothing is inferred when every customer is already in the dimension.',
        tables: [
          {
            name: 'stg_orders',
            columns: STG_ORDER_COLUMNS,
            rows: [
              ['o7', 'c2', '2024-09-02 08:00:00', 14.0],
              ['o8', 'c1', '2024-09-02 09:00:00', 30.0],
            ],
          },
          { name: 'fct_orders', columns: FCT_ORDER_COLUMNS, rows: [] },
        ],
        check: INFERRED_CHECK,
      },
      {
        name: 'Three thousand orders',
        hidden: true,
        note: '400 customers, 150 of them not in the dimension yet, and some orders with no customer.',
        setup: `TRUNCATE dim_customer, stg_orders, fct_orders;
INSERT INTO dim_customer VALUES (-1, NULL, 'unknown', FALSE);
INSERT INTO dim_customer SELECT n, 'c' || n, (ARRAY['gold', 'silver', 'bronze'])[1 + n % 3], FALSE
FROM generate_series(1, 250) AS n;
INSERT INTO stg_orders
SELECT 'o' || n, CASE WHEN n % 37 = 0 THEN NULL ELSE 'c' || (1 + (n * 7) % 400) END,
       TIMESTAMP '2024-09-01' + n * INTERVAL '3 minutes', (5 + n % 90)::numeric(10, 2)
FROM generate_series(1, 3000) AS n;
INSERT INTO fct_orders SELECT 'o' || n, 1, TIMESTAMP '2024-08-01', 1 FROM generate_series(1, 200, 7) AS n;`,
        check: INFERRED_CHECK,
      },
    ],
  },

  'late-dim-fill-inferred': {
    language: 'sql',
    task: `«stg_customers» is today's customer feed. Apply it to «dim_customer», which is SCD type 2 on «segment» and holds inferred members from earlier fact loads («is_inferred» true, «segment» NULL). For a customer whose current row is inferred, **complete that row in place**: set «segment» and make «is_inferred» false, and keep its «customer_sk», «valid_from» and «valid_to», so the facts already pointing at it see the real values. For a real current row whose «segment» differs (NULL counts as a value) and whose «valid_from» is before «updated_at», close it («valid_to» = «updated_at», «is_current» false) and add a new current version from «updated_at» to «9999-12-31» with a key from «next_sk()». A customer not in the dimension gets a first version the same way. The tests run your code twice, then read the dimension. A key below 5000 shows as itself, a new key as NULL.`,
    tables: [
      {
        name: 'dim_customer',
        columns: DIM_HISTORY_COLUMNS,
        rows: [
          [1, 'c1', 'gold', false, '2024-01-01 00:00:00', '9999-12-31 00:00:00', true],
          [2, 'c2', 'silver', false, '2024-01-01 00:00:00', '9999-12-31 00:00:00', true],
          [3, 'c3', null, true, '2024-09-01 11:00:00', '9999-12-31 00:00:00', true],
          [4, 'c4', null, true, '2024-09-01 14:00:00', '9999-12-31 00:00:00', true],
        ],
      },
      {
        name: 'stg_customers',
        columns: STG_CUSTOMER_COLUMNS,
        rows: [
          ['c1', 'gold', '2024-09-02 06:00:00'],
          ['c2', 'gold', '2024-09-02 06:00:00'],
          ['c3', 'bronze', '2024-09-02 06:00:00'],
          ['c5', 'silver', '2024-09-02 06:00:00'],
        ],
      },
    ],
    setup: `CREATE SEQUENCE customer_sk_seq START 5000;
CREATE FUNCTION next_sk() RETURNS int LANGUAGE sql AS $$ SELECT nextval('customer_sk_seq')::int $$;`,
    starter: `-- dim_customer(customer_sk, customer_id, segment, is_inferred, valid_from, valid_to, is_current)
-- stg_customers(customer_id, segment, updated_at)
-- This treats an inferred row like any change: it gets a new key, and old facts keep NULLs.
UPDATE dim_customer d
SET valid_to = s.updated_at, is_current = FALSE
FROM stg_customers s
WHERE d.customer_id = s.customer_id AND d.is_current
  AND d.segment IS DISTINCT FROM s.segment;

INSERT INTO dim_customer
SELECT next_sk(), s.customer_id, s.segment, FALSE, s.updated_at, TIMESTAMP '9999-12-31', TRUE
FROM stg_customers s
WHERE NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id AND d.is_current);
`,
    solution: `BEGIN;

-- 1. Complete inferred members in place: same key, so earlier facts see real values.
UPDATE dim_customer d
SET segment = s.segment, is_inferred = FALSE
FROM stg_customers s
WHERE d.customer_id = s.customer_id AND d.is_current AND d.is_inferred;

-- 2. Close real versions whose segment changed.
UPDATE dim_customer d
SET valid_to = s.updated_at, is_current = FALSE
FROM stg_customers s
WHERE d.customer_id = s.customer_id
  AND d.is_current
  AND NOT d.is_inferred
  AND d.segment IS DISTINCT FROM s.segment
  AND s.updated_at > d.valid_from;

-- 3. Open a version for changed and brand-new customers.
INSERT INTO dim_customer (customer_sk, customer_id, segment, is_inferred, valid_from, valid_to, is_current)
SELECT next_sk(), s.customer_id, s.segment, FALSE, s.updated_at, TIMESTAMP '9999-12-31', TRUE
FROM stg_customers s
WHERE NOT EXISTS (
  SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id AND d.is_current
);

COMMIT;
`,
    repeat: 2,
    cases: [
      {
        name: 'Sample',
        note: 'c3 is inferred: it is completed in place, key 3 kept. c4 is inferred but not in the feed: it stays. c2 changes segment: a new version. c5 is new.',
        check: FILL_CHECK,
      },
      {
        name: 'A real customer with no segment',
        note: 'c6 is a real row with a NULL segment, not an inferred one. A segment arriving is a change: a new version.',
        tables: [
          {
            name: 'dim_customer',
            columns: DIM_HISTORY_COLUMNS,
            rows: [
              [6, 'c6', null, false, '2024-03-01 00:00:00', '9999-12-31 00:00:00', true],
              [7, 'c7', null, true, '2024-09-01 09:00:00', '9999-12-31 00:00:00', true],
            ],
          },
          {
            name: 'stg_customers',
            columns: STG_CUSTOMER_COLUMNS,
            rows: [
              ['c6', 'gold', '2024-09-02 06:00:00'],
              ['c7', null, '2024-09-02 06:00:00'],
            ],
          },
        ],
        check: FILL_CHECK,
      },
      {
        name: 'Five hundred customers',
        hidden: true,
        note: 'A tenth are inferred, a tenth change segment and some are new.',
        setup: `TRUNCATE dim_customer, stg_customers;
INSERT INTO dim_customer
SELECT n, 'c' || n,
       CASE WHEN n % 10 = 0 THEN NULL ELSE (ARRAY['gold', 'silver', 'bronze'])[1 + n % 3] END,
       n % 10 = 0, TIMESTAMP '2024-01-01' + n * INTERVAL '1 hour', TIMESTAMP '9999-12-31', TRUE
FROM generate_series(1, 500) AS n;
INSERT INTO stg_customers
SELECT 'c' || n,
       CASE WHEN n % 10 = 3 THEN (ARRAY['gold', 'silver', 'bronze'])[1 + (n + 1) % 3]
            ELSE (ARRAY['gold', 'silver', 'bronze'])[1 + n % 3] END,
       TIMESTAMP '2024-09-02 06:00'
FROM generate_series(1, 560) AS n
WHERE n % 7 <> 0;`,
        check: FILL_CHECK,
      },
    ],
  },

  'prime-daily-members': {
    language: 'sql',
    task: `Return «day, plan, active_members» for every day from 2024-03-01 to 2024-03-07 and every plan in «plans», with 0 when a plan has no members that day. «membership_events» holds each member's «start» and «cancel» events, which alternate. A membership is active from the date of its «start» up to, but not including, the date of the next event. A member can cancel and start again, on another plan too. A start with no later event is still active. Row order does not matter.`,
    tables: [
      {
        name: 'plans',
        columns: [{ name: 'plan', type: 'text' }],
        rows: [['monthly'], ['annual'], ['student']],
      },
      {
        name: 'membership_events',
        columns: MEMBERSHIP_COLUMNS,
        rows: [
          [1, 'monthly', 'start', '2024-02-20 10:00:00'],
          [1, 'monthly', 'cancel', '2024-03-03 09:00:00'],
          [1, 'annual', 'start', '2024-03-05 18:00:00'],
          [2, 'annual', 'start', '2024-03-01 00:00:00'],
          [3, 'monthly', 'start', '2024-03-04 12:00:00'],
          [3, 'monthly', 'cancel', '2024-03-04 20:00:00'],
          [4, 'monthly', 'start', '2024-03-06 07:00:00'],
        ],
      },
    ],
    starter: `-- plans(plan)
-- membership_events(member_id, plan, event, event_at)
-- This counts events, not members who are active.
SELECT CAST(event_at AS DATE) AS day, plan, COUNT(*) AS active_members
FROM membership_events
WHERE event = 'start'
GROUP BY 1, 2;
`,
    solution: `WITH ordered AS (
  SELECT member_id, plan, event, CAST(event_at AS DATE) AS event_day,
         LEAD(CAST(event_at AS DATE)) OVER (PARTITION BY member_id ORDER BY event_at) AS next_day
  FROM membership_events
),
periods AS (
  SELECT member_id, plan, event_day AS start_day, COALESCE(next_day, DATE '9999-12-31') AS end_day
  FROM ordered
  WHERE event = 'start'
),
days AS (
  SELECT CAST(d AS DATE) AS day
  FROM generate_series(DATE '2024-03-01', DATE '2024-03-07', INTERVAL '1 day') AS d
)
SELECT days.day, p.plan, COUNT(DISTINCT m.member_id) AS active_members
FROM days
CROSS JOIN plans p
LEFT JOIN periods m
  ON m.plan = p.plan AND m.start_day <= days.day AND days.day < m.end_day
GROUP BY days.day, p.plan;
`,
    cases: [
      {
        name: 'Sample',
        note: 'Member 1 is monthly until 3 March and annual from 5 March. Member 3 starts and cancels on 4 March: active no day. Nobody is on student.',
      },
      {
        name: 'Cancel and start on the same day',
        note: 'Member 5 cancels monthly and starts annual on 4 March: on 4 March they count as annual only.',
        tables: [
          {
            name: 'membership_events',
            columns: MEMBERSHIP_COLUMNS,
            rows: [
              [5, 'monthly', 'start', '2024-02-01 08:00:00'],
              [5, 'monthly', 'cancel', '2024-03-04 08:00:00'],
              [5, 'annual', 'start', '2024-03-04 08:05:00'],
              [6, 'student', 'start', '2024-03-07 23:59:00'],
            ],
          },
        ],
      },
      {
        name: 'Two thousand members',
        hidden: true,
        note: 'Members who churn and come back, across all three plans.',
        setup: `TRUNCATE membership_events;
INSERT INTO membership_events
SELECT m, (ARRAY['monthly', 'annual', 'student'])[1 + (m + k / 2) % 3],
       CASE WHEN k % 2 = 0 THEN 'start' ELSE 'cancel' END,
       TIMESTAMP '2024-02-25' + ((m * 13 + k * 29) % 20 + k * 3) * INTERVAL '1 day' + (m % 24) * INTERVAL '1 hour'
FROM generate_series(1, 2000) AS m, generate_series(0, 3) AS k
WHERE k <= m % 4;`,
      },
    ],
  },

  'sales-by-vendor-country': {
    language: 'sql',
    task: `Return «year, month, vendor, country, net_sales» from the star schema: one row for each year, month, vendor and country with sales, plus one row for each year, vendor and country with «month» NULL. «net_sales» is the sum of «amount_usd», with returns («is_return» true) subtracted. A product with no row in «dim_product» counts under the vendor «UNKNOWN». Row order does not matter.`,
    tables: [
      {
        name: 'fct_sales',
        columns: SALE_COLUMNS,
        rows: [
          [1, 10, 1, '2024-01-05 10:00:00', 100.0, false],
          [2, 10, 1, '2024-01-20 10:00:00', 40.0, true],
          [3, 11, 2, '2024-01-21 12:00:00', 75.0, false],
          [4, 12, 1, '2024-02-02 09:00:00', 60.0, false],
          [5, 99, 3, '2024-02-03 09:00:00', 20.0, false],
          [6, 10, 1, '2024-02-10 15:00:00', 30.0, false],
          [7, 11, 3, '2025-01-04 11:00:00', 55.0, false],
        ],
      },
      {
        name: 'dim_product',
        columns: [
          { name: 'product_id', type: 'int' },
          { name: 'vendor', type: 'text' },
        ],
        rows: [
          [10, 'Acme'],
          [11, 'Bolt'],
          [12, 'Acme'],
        ],
      },
      {
        name: 'dim_location',
        columns: [
          { name: 'location_id', type: 'int' },
          { name: 'country', type: 'text' },
          { name: 'city', type: 'text' },
        ],
        rows: [
          [1, 'IN', 'Pune'],
          [2, 'IN', 'Delhi'],
          [3, 'US', 'Austin'],
        ],
      },
    ],
    starter: `-- fct_sales(sale_id, product_id, location_id, sold_at, amount_usd, is_return)
-- dim_product(product_id, vendor), dim_location(location_id, country, city)
SELECT EXTRACT(YEAR FROM s.sold_at)::int AS year,
       EXTRACT(MONTH FROM s.sold_at)::int AS month,
       p.vendor, l.country, SUM(s.amount_usd) AS net_sales
FROM fct_sales s
JOIN dim_product p ON p.product_id = s.product_id
JOIN dim_location l ON l.location_id = s.location_id
GROUP BY 1, 2, 3, 4;
`,
    solution: `SELECT EXTRACT(YEAR FROM s.sold_at)::int AS year,
       EXTRACT(MONTH FROM s.sold_at)::int AS month,
       COALESCE(p.vendor, 'UNKNOWN') AS vendor,
       l.country,
       SUM(CASE WHEN s.is_return THEN -s.amount_usd ELSE s.amount_usd END) AS net_sales
FROM fct_sales s
LEFT JOIN dim_product p ON p.product_id = s.product_id
JOIN dim_location l ON l.location_id = s.location_id
GROUP BY GROUPING SETS (
  (EXTRACT(YEAR FROM s.sold_at), EXTRACT(MONTH FROM s.sold_at), COALESCE(p.vendor, 'UNKNOWN'), l.country),
  (EXTRACT(YEAR FROM s.sold_at), COALESCE(p.vendor, 'UNKNOWN'), l.country)
);
`,
    cases: [
      {
        name: 'Sample',
        note: 'Sale 2 is a return. Product 99 is not in dim_product. Pune and Delhi are both IN.',
      },
      {
        name: 'Four thousand sales',
        hidden: true,
        note: 'Two years, five vendors, returns and unknown products.',
        setup: `TRUNCATE fct_sales;
INSERT INTO fct_sales
SELECT n, 10 + n % 6, 1 + n % 3, TIMESTAMP '2024-01-01' + ((n * 37) % 700) * INTERVAL '1 day',
       (10 + n % 70)::numeric(10, 2), n % 11 = 0
FROM generate_series(1, 4000) AS n;
INSERT INTO dim_product VALUES (13, 'Core'), (14, 'Bolt');`,
      },
    ],
  },

  'bitemporal-price-as-known': {
    language: 'sql',
    task: `«price_history» is append-only and bitemporal: each row says the price of a SKU for the dates «valid_from» up to, but not including, «valid_to», and «recorded_at» says when we learned it. A correction adds a newer row for the same dates. For each order in «orders», return «order_id, price_then, price_now, restated»: «price_then» is the price for «ordered_on» as we knew it at the March close, «2024-04-01 00:00» (the latest row recorded at or before then), and «price_now» is the price for «ordered_on» from the latest row of all. «restated» is true when the two differ, and a price that was unknown at the close but is known now is a difference. An order with no price at all keeps NULLs, and «restated» is false. One SKU never has two rows with the same «recorded_at». Row order does not matter.`,
    tables: [
      {
        name: 'price_history',
        columns: PRICE_HISTORY_COLUMNS,
        rows: [
          ['tea', 4.0, '2024-01-01', '2024-03-01', '2024-01-01 00:00:00'],
          ['tea', 4.5, '2024-03-01', '9999-12-31', '2024-03-01 00:00:00'],
          ['tea', 4.2, '2024-03-01', '2024-03-15', '2024-04-10 09:00:00'],
          ['jam', 6.0, '2024-01-01', '9999-12-31', '2024-01-01 00:00:00'],
          ['jam', 6.5, '2024-02-01', '9999-12-31', '2024-03-31 23:59:59'],
          ['oat', 3.0, '2024-04-05', '9999-12-31', '2024-04-05 00:00:00'],
        ],
      },
      {
        name: 'orders',
        columns: PRICED_ORDER_COLUMNS,
        rows: [
          [1, 'tea', '2024-02-29'],
          [2, 'tea', '2024-03-10'],
          [3, 'tea', '2024-03-20'],
          [4, 'jam', '2024-03-02'],
          [5, 'oat', '2024-03-02'],
        ],
      },
    ],
    starter: `-- price_history(sku, price, valid_from, valid_to, recorded_at)
-- orders(order_id, sku, ordered_on)
-- This mixes up the two times: it ignores when each price was recorded.
SELECT o.order_id, h.price AS price_then, h.price AS price_now, FALSE AS restated
FROM orders o
JOIN price_history h ON h.sku = o.sku AND h.valid_from <= o.ordered_on;
`,
    solution: `WITH candidates AS (
  SELECT o.order_id, h.price, h.recorded_at
  FROM orders o
  JOIN price_history h
    ON h.sku = o.sku AND h.valid_from <= o.ordered_on AND o.ordered_on < h.valid_to
),
known_then AS (
  SELECT DISTINCT ON (order_id) order_id, price
  FROM candidates
  WHERE recorded_at <= TIMESTAMP '2024-04-01 00:00'
  ORDER BY order_id, recorded_at DESC
),
known_now AS (
  SELECT DISTINCT ON (order_id) order_id, price
  FROM candidates
  ORDER BY order_id, recorded_at DESC
)
SELECT o.order_id,
       t.price AS price_then,
       n.price AS price_now,
       t.price IS DISTINCT FROM n.price AS restated
FROM orders o
LEFT JOIN known_then t ON t.order_id = o.order_id
LEFT JOIN known_now n ON n.order_id = o.order_id;
`,
    cases: [
      {
        name: 'Sample',
        note: 'A correction on 10 April changed the tea price for 1 to 14 March, after the close. The jam change was recorded one second before it. Oat had no price in March.',
      },
      {
        name: 'Recorded exactly at the close',
        note: 'A row recorded at 2024-04-01 00:00 counts as known at the close.',
        tables: [
          {
            name: 'price_history',
            columns: PRICE_HISTORY_COLUMNS,
            rows: [
              ['milk', 2.0, '2024-01-01', '9999-12-31', '2024-01-01 00:00:00'],
              ['milk', 2.2, '2024-03-01', '9999-12-31', '2024-04-01 00:00:00'],
            ],
          },
          {
            name: 'orders',
            columns: PRICED_ORDER_COLUMNS,
            rows: [
              [6, 'milk', '2024-03-05'],
              [7, 'milk', '2024-02-05'],
            ],
          },
        ],
      },
      {
        name: 'Two thousand orders',
        hidden: true,
        note: 'Forty SKUs, price changes every month and late corrections.',
        setup: `TRUNCATE price_history, orders;
INSERT INTO price_history
SELECT 's' || s, (2 + (s * 3 + m) % 17)::numeric(10, 2),
       DATE '2024-01-01' + m * 30, DATE '2024-01-01' + (m + 1) * 30,
       TIMESTAMP '2024-01-01' + m * 30 * INTERVAL '1 day'
FROM generate_series(1, 40) AS s, generate_series(0, 5) AS m;
INSERT INTO price_history
SELECT 's' || s, (3 + (s * 5 + m) % 13)::numeric(10, 2),
       DATE '2024-01-01' + m * 30, DATE '2024-01-01' + m * 30 + 10,
       TIMESTAMP '2024-03-20' + (s * 2 + m * 5) * INTERVAL '1 day'
FROM generate_series(1, 40) AS s, generate_series(0, 3) AS m
WHERE s % 3 = 0;
INSERT INTO orders
SELECT n, 's' || (1 + n % 45), DATE '2024-01-01' + (n * 7) % 170
FROM generate_series(1, 2000) AS n;`,
      },
    ],
  },

  'account-daily-balance': {
    language: 'sql',
    task: `Build the periodic snapshot «fct_account_daily»: return «account_id, day, balance» for each account and each day from 2024-06-01 to 2024-06-07 on or after its «opened_on». «balance» is the sum of every «amount» posted up to the end of that day, transactions before 1 June included. A day with no transactions carries the balance forward. Row order does not matter.`,
    tables: [
      {
        name: 'accounts',
        columns: ACCOUNT_COLUMNS,
        rows: [
          [1, '2024-05-01'],
          [2, '2024-06-03'],
          [3, '2024-06-08'],
        ],
      },
      {
        name: 'transactions',
        columns: TRANSACTION_COLUMNS,
        rows: [
          [1, 1, '2024-05-20 10:00:00', 100.0],
          [2, 1, '2024-06-02 09:00:00', -30.0],
          [3, 1, '2024-06-02 18:00:00', 5.0],
          [4, 1, '2024-06-06 23:59:59', 20.0],
          [5, 2, '2024-06-03 12:00:00', 50.0],
          [6, 2, '2024-06-08 00:00:00', 70.0],
        ],
      },
    ],
    starter: `-- accounts(account_id, opened_on)
-- transactions(txn_id, account_id, posted_at, amount)
-- This returns only days with transactions, and starts every balance at 1 June.
SELECT account_id, CAST(posted_at AS DATE) AS day,
       SUM(SUM(amount)) OVER (PARTITION BY account_id ORDER BY CAST(posted_at AS DATE)) AS balance
FROM transactions
WHERE posted_at >= DATE '2024-06-01' AND posted_at < DATE '2024-06-08'
GROUP BY 1, 2;
`,
    solution: `WITH days AS (
  SELECT CAST(d AS DATE) AS day
  FROM generate_series(DATE '2024-06-01', DATE '2024-06-07', INTERVAL '1 day') AS d
),
daily AS (
  SELECT account_id, CAST(posted_at AS DATE) AS day, SUM(amount) AS net
  FROM transactions
  WHERE posted_at >= DATE '2024-06-01'
  GROUP BY 1, 2
),
opening AS (
  SELECT account_id, SUM(amount) AS opening
  FROM transactions
  WHERE posted_at < DATE '2024-06-01'
  GROUP BY 1
),
-- Run the balance over the whole week first, then keep the days after opening,
-- so a transaction before «opened_on» still counts.
running AS (
  SELECT a.account_id, a.opened_on, days.day,
         COALESCE(o.opening, 0)
           + SUM(COALESCE(d.net, 0)) OVER (PARTITION BY a.account_id ORDER BY days.day) AS balance
  FROM accounts a
  CROSS JOIN days
  LEFT JOIN daily d ON d.account_id = a.account_id AND d.day = days.day
  LEFT JOIN opening o ON o.account_id = a.account_id
)
SELECT account_id, day, balance
FROM running
WHERE day >= opened_on;
`,
    cases: [
      {
        name: 'Sample',
        note: 'Account 1 opens with 100 from May. Account 2 opens on 3 June. Account 3 opens after the week.',
      },
      {
        name: 'No transactions at all',
        note: 'Account 4 has no transactions: its balance is 0 every day.',
        tables: [
          { name: 'accounts', columns: ACCOUNT_COLUMNS, rows: [[4, '2024-06-05']] },
          { name: 'transactions', columns: TRANSACTION_COLUMNS, rows: [] },
        ],
      },
      {
        name: 'Three hundred accounts',
        hidden: true,
        note: 'Accounts that open during the week, and quiet days.',
        setup: `TRUNCATE accounts, transactions;
INSERT INTO accounts SELECT n, DATE '2024-05-25' + n % 16 FROM generate_series(1, 300) AS n;
INSERT INTO transactions
SELECT ROW_NUMBER() OVER (), a, TIMESTAMP '2024-05-25' + ((a * 31 + k * 17) % 360) * INTERVAL '1 hour',
       ((a * 7 + k * 13) % 200 - 60)::numeric(12, 2)
FROM generate_series(1, 300) AS a, generate_series(1, 6) AS k
WHERE (a + k) % 4 <> 0;`,
      },
    ],
  },
};
