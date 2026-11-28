import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/** Other answers for the modeling SQL problems. See `test-answers.ts`. */
export const MODELING_SQL_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'late-dim-inferred-member': {
    pass: [
      `INSERT INTO dim_customer (customer_sk, customer_id, segment, is_inferred)
SELECT next_sk(), customer_id, NULL, TRUE
FROM (SELECT customer_id FROM stg_orders WHERE customer_id IS NOT NULL
      EXCEPT SELECT customer_id FROM dim_customer WHERE customer_id IS NOT NULL) m;
INSERT INTO fct_orders
SELECT s.order_id,
       CASE WHEN s.customer_id IS NULL THEN -1
            ELSE (SELECT d.customer_sk FROM dim_customer d WHERE d.customer_id = s.customer_id) END,
       s.ordered_at, s.amount_usd
FROM stg_orders s
ON CONFLICT (order_id) DO NOTHING;`,
    ],
    fail: [
      // Every late customer goes to the unknown member, so its facts never get the real segment.
      `INSERT INTO fct_orders
SELECT s.order_id, COALESCE(d.customer_sk, -1), s.ordered_at, s.amount_usd
FROM stg_orders s LEFT JOIN dim_customer d ON d.customer_id = s.customer_id
WHERE NOT EXISTS (SELECT 1 FROM fct_orders f WHERE f.order_id = s.order_id);`,
      // No DISTINCT: a customer with two orders gets two inferred rows, and the facts fan out.
      `INSERT INTO dim_customer (customer_sk, customer_id, segment, is_inferred)
SELECT next_sk(), s.customer_id, NULL, TRUE FROM stg_orders s
WHERE s.customer_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id);
INSERT INTO fct_orders
SELECT s.order_id, COALESCE(d.customer_sk, -1), s.ordered_at, s.amount_usd
FROM stg_orders s LEFT JOIN dim_customer d ON d.customer_id = s.customer_id
WHERE NOT EXISTS (SELECT 1 FROM fct_orders f WHERE f.order_id = s.order_id);`,
      // An inner join drops the orders with no customer.
      `INSERT INTO dim_customer (customer_sk, customer_id, segment, is_inferred)
SELECT next_sk(), m.customer_id, NULL, TRUE FROM (
  SELECT DISTINCT customer_id FROM stg_orders s WHERE customer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id)) m;
INSERT INTO fct_orders
SELECT s.order_id, d.customer_sk, s.ordered_at, s.amount_usd
FROM stg_orders s JOIN dim_customer d ON d.customer_id = s.customer_id
WHERE NOT EXISTS (SELECT 1 FROM fct_orders f WHERE f.order_id = s.order_id);`,
      // Reloads every order: the second run fails on the key, or overwrites loaded amounts.
      `INSERT INTO dim_customer (customer_sk, customer_id, segment, is_inferred)
SELECT next_sk(), m.customer_id, NULL, TRUE FROM (
  SELECT DISTINCT customer_id FROM stg_orders s WHERE customer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id)) m;
INSERT INTO fct_orders
SELECT s.order_id, COALESCE(d.customer_sk, -1), s.ordered_at, s.amount_usd
FROM stg_orders s LEFT JOIN dim_customer d ON d.customer_id = s.customer_id
ON CONFLICT (order_id) DO UPDATE SET customer_sk = EXCLUDED.customer_sk, amount_usd = EXCLUDED.amount_usd;`,
    ],
  },
  'late-dim-fill-inferred': {
    pass: [
      `UPDATE dim_customer d SET segment = s.segment, is_inferred = FALSE
FROM stg_customers s WHERE s.customer_id = d.customer_id AND d.is_inferred AND d.is_current;
WITH changed AS (
  UPDATE dim_customer d SET valid_to = s.updated_at, is_current = FALSE
  FROM stg_customers s
  WHERE s.customer_id = d.customer_id AND d.is_current AND NOT d.is_inferred
    AND d.valid_from < s.updated_at AND NOT (d.segment IS NOT DISTINCT FROM s.segment)
  RETURNING d.customer_id
)
INSERT INTO dim_customer
SELECT next_sk(), s.customer_id, s.segment, FALSE, s.updated_at, TIMESTAMP '9999-12-31', TRUE
FROM stg_customers s
WHERE s.customer_id IN (SELECT customer_id FROM changed)
   OR NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id);`,
    ],
    fail: [
      // Completes the inferred row but with a new key: the early facts still see NULL.
      `UPDATE dim_customer d SET valid_to = s.updated_at, is_current = FALSE
FROM stg_customers s
WHERE d.customer_id = s.customer_id AND d.is_current
  AND (d.is_inferred OR (d.segment IS DISTINCT FROM s.segment AND s.updated_at > d.valid_from));
INSERT INTO dim_customer
SELECT next_sk(), s.customer_id, s.segment, FALSE, s.updated_at, TIMESTAMP '9999-12-31', TRUE
FROM stg_customers s
WHERE NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id AND d.is_current);`,
      // <> misses the change from a NULL segment on a real row.
      `UPDATE dim_customer d SET segment = s.segment, is_inferred = FALSE
FROM stg_customers s WHERE d.customer_id = s.customer_id AND d.is_current AND d.is_inferred;
UPDATE dim_customer d SET valid_to = s.updated_at, is_current = FALSE
FROM stg_customers s
WHERE d.customer_id = s.customer_id AND d.is_current AND NOT d.is_inferred
  AND d.segment <> s.segment AND s.updated_at > d.valid_from;
INSERT INTO dim_customer
SELECT next_sk(), s.customer_id, s.segment, FALSE, s.updated_at, TIMESTAMP '9999-12-31', TRUE
FROM stg_customers s
WHERE NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id AND d.is_current);`,
      // Treats every row with a NULL segment as inferred, so c6 is overwritten in place.
      `UPDATE dim_customer d SET segment = s.segment, is_inferred = FALSE
FROM stg_customers s WHERE d.customer_id = s.customer_id AND d.is_current AND d.segment IS NULL;
UPDATE dim_customer d SET valid_to = s.updated_at, is_current = FALSE
FROM stg_customers s
WHERE d.customer_id = s.customer_id AND d.is_current
  AND d.segment IS DISTINCT FROM s.segment AND s.updated_at > d.valid_from;
INSERT INTO dim_customer
SELECT next_sk(), s.customer_id, s.segment, FALSE, s.updated_at, TIMESTAMP '9999-12-31', TRUE
FROM stg_customers s
WHERE NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id AND d.is_current);`,
    ],
  },
  'prime-daily-members': {
    pass: [
      `SELECT d::date AS day, p.plan,
       (SELECT COUNT(*) FROM membership_events e
        WHERE e.plan = p.plan AND e.event = 'start' AND e.event_at::date <= d::date
          AND NOT EXISTS (SELECT 1 FROM membership_events n
                          WHERE n.member_id = e.member_id AND n.event_at > e.event_at
                            AND n.event_at::date <= d::date)) AS active_members
FROM generate_series(DATE '2024-03-01', DATE '2024-03-07', INTERVAL '1 day') AS d
CROSS JOIN plans p;`,
    ],
    fail: [
      // Counts a member on the day they cancel.
      `WITH periods AS (
  SELECT member_id, plan, event, event_at::date AS s,
         COALESCE(LEAD(event_at::date) OVER (PARTITION BY member_id ORDER BY event_at), DATE '9999-12-31') AS e
  FROM membership_events)
SELECT d::date AS day, p.plan, COUNT(DISTINCT m.member_id) AS active_members
FROM generate_series(DATE '2024-03-01', DATE '2024-03-07', INTERVAL '1 day') d CROSS JOIN plans p
LEFT JOIN periods m ON m.event = 'start' AND m.plan = p.plan AND m.s <= d::date AND d::date <= m.e
GROUP BY 1, 2;`,
      // No date spine: the days and plans with nobody are missing.
      `WITH periods AS (
  SELECT member_id, plan, event, event_at::date AS s,
         COALESCE(LEAD(event_at::date) OVER (PARTITION BY member_id ORDER BY event_at), DATE '9999-12-31') AS e
  FROM membership_events)
SELECT d::date AS day, m.plan, COUNT(DISTINCT m.member_id) AS active_members
FROM generate_series(DATE '2024-03-01', DATE '2024-03-07', INTERVAL '1 day') d
JOIN periods m ON m.event = 'start' AND m.s <= d::date AND d::date < m.e
GROUP BY 1, 2;`,
      // LEAD within member and plan: a switch to another plan never ends the old one.
      `WITH periods AS (
  SELECT member_id, plan, event, event_at::date AS s,
         COALESCE(LEAD(event_at::date) OVER (PARTITION BY member_id, plan ORDER BY event_at), DATE '9999-12-31') AS e
  FROM membership_events)
SELECT d::date AS day, p.plan, COUNT(DISTINCT m.member_id) AS active_members
FROM generate_series(DATE '2024-03-01', DATE '2024-03-07', INTERVAL '1 day') d CROSS JOIN plans p
LEFT JOIN periods m ON m.event = 'start' AND m.plan = p.plan AND m.s <= d::date AND d::date < m.e
GROUP BY 1, 2;`,
    ],
  },
  'sales-by-vendor-country': {
    pass: [
      `WITH s AS (
  SELECT EXTRACT(YEAR FROM f.sold_at)::int AS year, EXTRACT(MONTH FROM f.sold_at)::int AS month,
         COALESCE(p.vendor, 'UNKNOWN') AS vendor, l.country,
         CASE WHEN f.is_return THEN -f.amount_usd ELSE f.amount_usd END AS amt
  FROM fct_sales f LEFT JOIN dim_product p USING (product_id) JOIN dim_location l USING (location_id))
SELECT year, month, vendor, country, SUM(amt) AS net_sales FROM s GROUP BY 1, 2, 3, 4
UNION ALL
SELECT year, NULL, vendor, country, SUM(amt) FROM s GROUP BY 1, 3, 4;`,
    ],
    fail: [
      // ROLLUP adds the year-only and grand-total rows the task does not ask for.
      `SELECT EXTRACT(YEAR FROM s.sold_at)::int AS year, EXTRACT(MONTH FROM s.sold_at)::int AS month,
       COALESCE(p.vendor, 'UNKNOWN') AS vendor, l.country,
       SUM(CASE WHEN s.is_return THEN -s.amount_usd ELSE s.amount_usd END) AS net_sales
FROM fct_sales s LEFT JOIN dim_product p ON p.product_id = s.product_id
JOIN dim_location l ON l.location_id = s.location_id
GROUP BY ROLLUP (1, 3, 4, 2);`,
      // Adds returns instead of subtracting them.
      `SELECT EXTRACT(YEAR FROM s.sold_at)::int AS year, EXTRACT(MONTH FROM s.sold_at)::int AS month,
       COALESCE(p.vendor, 'UNKNOWN') AS vendor, l.country, SUM(s.amount_usd) AS net_sales
FROM fct_sales s LEFT JOIN dim_product p ON p.product_id = s.product_id
JOIN dim_location l ON l.location_id = s.location_id
GROUP BY GROUPING SETS ((1, 2, 3, 4), (1, 3, 4));`,
      // An inner join to dim_product drops the sales of unknown products.
      `SELECT EXTRACT(YEAR FROM s.sold_at)::int AS year, EXTRACT(MONTH FROM s.sold_at)::int AS month,
       p.vendor, l.country,
       SUM(CASE WHEN s.is_return THEN -s.amount_usd ELSE s.amount_usd END) AS net_sales
FROM fct_sales s JOIN dim_product p ON p.product_id = s.product_id
JOIN dim_location l ON l.location_id = s.location_id
GROUP BY GROUPING SETS ((1, 2, 3, 4), (1, 3, 4));`,
    ],
  },
  'bitemporal-price-as-known': {
    pass: [
      `SELECT o.order_id,
  (SELECT h.price FROM price_history h WHERE h.sku = o.sku AND o.ordered_on >= h.valid_from
     AND o.ordered_on < h.valid_to AND h.recorded_at <= TIMESTAMP '2024-04-01'
   ORDER BY h.recorded_at DESC LIMIT 1) AS price_then,
  (SELECT h.price FROM price_history h WHERE h.sku = o.sku AND o.ordered_on >= h.valid_from
     AND o.ordered_on < h.valid_to ORDER BY h.recorded_at DESC LIMIT 1) AS price_now,
  (SELECT h.price FROM price_history h WHERE h.sku = o.sku AND o.ordered_on >= h.valid_from
     AND o.ordered_on < h.valid_to AND h.recorded_at <= TIMESTAMP '2024-04-01'
   ORDER BY h.recorded_at DESC LIMIT 1)
  IS DISTINCT FROM
  (SELECT h.price FROM price_history h WHERE h.sku = o.sku AND o.ordered_on >= h.valid_from
     AND o.ordered_on < h.valid_to ORDER BY h.recorded_at DESC LIMIT 1) AS restated
FROM orders o;`,
    ],
    fail: [
      // Ignores recorded_at: price_then already sees the April correction.
      `SELECT o.order_id, h.price AS price_then, h.price AS price_now, FALSE AS restated
FROM orders o LEFT JOIN LATERAL (
  SELECT price FROM price_history h WHERE h.sku = o.sku AND h.valid_from <= o.ordered_on
    AND o.ordered_on < h.valid_to ORDER BY recorded_at DESC LIMIT 1) h ON TRUE;`,
      // valid_to taken as inclusive: an order on the boundary date matches the old row too.
      `WITH c AS (SELECT o.order_id, h.price, h.recorded_at FROM orders o
  JOIN price_history h ON h.sku = o.sku AND o.ordered_on BETWEEN h.valid_from AND h.valid_to),
t AS (SELECT DISTINCT ON (order_id) order_id, price FROM c WHERE recorded_at <= TIMESTAMP '2024-04-01'
      ORDER BY order_id, recorded_at),
n AS (SELECT DISTINCT ON (order_id) order_id, price FROM c ORDER BY order_id, recorded_at DESC)
SELECT o.order_id, t.price AS price_then, n.price AS price_now, t.price IS DISTINCT FROM n.price AS restated
FROM orders o LEFT JOIN t USING (order_id) LEFT JOIN n USING (order_id);`,
      // Strictly before the close: a row recorded exactly at 2024-04-01 00:00 is missed.
      `WITH c AS (SELECT o.order_id, h.price, h.recorded_at FROM orders o
  JOIN price_history h ON h.sku = o.sku AND h.valid_from <= o.ordered_on AND o.ordered_on < h.valid_to),
t AS (SELECT DISTINCT ON (order_id) order_id, price FROM c WHERE recorded_at < TIMESTAMP '2024-04-01'
      ORDER BY order_id, recorded_at DESC),
n AS (SELECT DISTINCT ON (order_id) order_id, price FROM c ORDER BY order_id, recorded_at DESC)
SELECT o.order_id, t.price AS price_then, n.price AS price_now, t.price IS DISTINCT FROM n.price AS restated
FROM orders o LEFT JOIN t USING (order_id) LEFT JOIN n USING (order_id);`,
    ],
  },
  'account-daily-balance': {
    pass: [
      `SELECT a.account_id, d::date AS day,
       COALESCE((SELECT SUM(t.amount) FROM transactions t
                 WHERE t.account_id = a.account_id AND t.posted_at < d + INTERVAL '1 day'), 0) AS balance
FROM accounts a
JOIN generate_series(DATE '2024-06-01', DATE '2024-06-07', INTERVAL '1 day') AS d ON d::date >= a.opened_on;`,
    ],
    fail: [
      // Forgets the balance brought forward from May.
      `SELECT a.account_id, d::date AS day,
       COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.account_id = a.account_id
                 AND t.posted_at >= DATE '2024-06-01' AND t.posted_at < d + INTERVAL '1 day'), 0) AS balance
FROM accounts a
JOIN generate_series(DATE '2024-06-01', DATE '2024-06-07', INTERVAL '1 day') AS d ON d::date >= a.opened_on;`,
      // Compares a timestamp with the date: the last second of a day falls into the next day.
      `SELECT a.account_id, d::date AS day,
       COALESCE((SELECT SUM(t.amount) FROM transactions t
                 WHERE t.account_id = a.account_id AND t.posted_at <= d), 0) AS balance
FROM accounts a
JOIN generate_series(DATE '2024-06-01', DATE '2024-06-07', INTERVAL '1 day') AS d ON d::date >= a.opened_on;`,
      // Starts the running sum on the opening day, so a transaction before it is lost.
      `WITH g AS (SELECT a.account_id, d::date AS day FROM accounts a
  JOIN generate_series(DATE '2024-06-01', DATE '2024-06-07', INTERVAL '1 day') d ON d::date >= a.opened_on),
x AS (SELECT account_id, posted_at::date AS day, SUM(amount) AS net FROM transactions GROUP BY 1, 2),
o AS (SELECT account_id, SUM(amount) AS opening FROM transactions WHERE posted_at < DATE '2024-06-01' GROUP BY 1)
SELECT g.account_id, g.day, COALESCE(o.opening, 0) + SUM(COALESCE(x.net, 0)) OVER (PARTITION BY g.account_id ORDER BY g.day) AS balance
FROM g LEFT JOIN x USING (account_id, day) LEFT JOIN o USING (account_id);`,
    ],
  },
};
