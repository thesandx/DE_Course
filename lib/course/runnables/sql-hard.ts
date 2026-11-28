import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the hard multi-table SQL problems of the SQL track:
 * fan-out across two child tables, currency rates with gaps, payouts that
 * carry a negative balance, a rolling active-user count over a changing
 * country, last-click attribution and a payout reconciliation. They run on
 * PostgreSQL 18, like every SQL problem.
 */

const ORDER_COLUMNS = [
  { name: 'order_id', type: 'int' },
  { name: 'merchant_id', type: 'int' },
  { name: 'ordered_at', type: 'timestamp' },
  { name: 'status', type: 'text' },
] as const;

const ORDER_ITEM_COLUMNS = [
  { name: 'order_id', type: 'int' },
  { name: 'sku', type: 'text' },
  { name: 'qty', type: 'int' },
  { name: 'unit_price', type: 'numeric(10,2)' },
] as const;

const ORDER_PAYMENT_COLUMNS = [
  { name: 'payment_id', type: 'int' },
  { name: 'order_id', type: 'int' },
  { name: 'amount', type: 'numeric(10,2)' },
  { name: 'status', type: 'text' },
] as const;

const FX_ORDER_COLUMNS = [
  { name: 'order_id', type: 'int' },
  { name: 'ordered_at', type: 'timestamp' },
  { name: 'currency', type: 'text' },
  { name: 'amount', type: 'numeric(12,2)' },
] as const;

const FX_RATE_COLUMNS = [
  { name: 'currency', type: 'text' },
  { name: 'rate_date', type: 'date' },
  { name: 'usd_per_unit', type: 'numeric(12,6)' },
] as const;

const SELLER_SALE_COLUMNS = [
  { name: 'order_id', type: 'int' },
  { name: 'seller_id', type: 'int' },
  { name: 'amount', type: 'numeric(10,2)' },
  { name: 'delivered_at', type: 'timestamp' },
] as const;

const REFUND_COLUMNS = [
  { name: 'refund_id', type: 'int' },
  { name: 'order_id', type: 'int' },
  { name: 'amount', type: 'numeric(10,2)' },
  { name: 'refunded_at', type: 'timestamp' },
] as const;

const USER_COUNTRY_COLUMNS = [
  { name: 'user_id', type: 'int' },
  { name: 'country', type: 'text' },
  { name: 'valid_from', type: 'date' },
  { name: 'valid_to', type: 'date' },
] as const;

const USER_EVENT_COLUMNS = [
  { name: 'user_id', type: 'int' },
  { name: 'event_at', type: 'timestamp' },
] as const;

const ATTR_ORDER_COLUMNS = [
  { name: 'order_id', type: 'int' },
  { name: 'user_id', type: 'int' },
  { name: 'ordered_at', type: 'timestamp' },
  { name: 'amount', type: 'numeric(10,2)' },
] as const;

const AD_CLICK_COLUMNS = [
  { name: 'click_id', type: 'int' },
  { name: 'user_id', type: 'int' },
  { name: 'campaign_id', type: 'int' },
  { name: 'clicked_at', type: 'timestamp' },
] as const;

const PAYOUT_TRIP_COLUMNS = [
  { name: 'trip_id', type: 'int' },
  { name: 'driver_id', type: 'int' },
  { name: 'fare', type: 'numeric(10,2)' },
  { name: 'status', type: 'text' },
] as const;

const PAYOUT_LINE_COLUMNS = [
  { name: 'line_id', type: 'int' },
  { name: 'trip_id', type: 'int' },
  { name: 'amount', type: 'numeric(10,2)' },
] as const;

export const SQL_HARD_RUNNABLES: Record<string, RunnableSpec> = {
  'order-revenue-fanout': {
    language: 'sql',
    task: `Return «merchant_id, day, orders, item_revenue, captured» for each merchant and day with orders. Leave out orders with «status» «cancelled». «orders» is the number of orders. «item_revenue» is the sum of «qty × unit_price» over their items. «captured» is the sum of their payments with «status» «captured». An order has any number of items and payments, none included: it still counts, with 0 for what it lacks. Row order does not matter.`,
    tables: [
      {
        name: 'orders',
        columns: ORDER_COLUMNS,
        rows: [
          [1, 10, '2024-05-01 09:00:00', 'delivered'],
          [2, 10, '2024-05-01 12:00:00', 'delivered'],
          [3, 10, '2024-05-01 18:00:00', 'cancelled'],
          [4, 20, '2024-05-01 10:00:00', 'delivered'],
          [5, 20, '2024-05-02 11:00:00', 'placed'],
        ],
      },
      {
        name: 'order_items',
        columns: ORDER_ITEM_COLUMNS,
        rows: [
          [1, 'tea', 2, 3.5],
          [1, 'cake', 1, 6.0],
          [2, 'tea', 1, 3.5],
          [3, 'tea', 4, 3.5],
          [4, 'pizza', 1, 12.0],
          [4, 'cola', 2, 2.0],
          [4, 'fries', 1, 3.0],
        ],
      },
      {
        name: 'payments',
        columns: ORDER_PAYMENT_COLUMNS,
        rows: [
          [100, 1, 13.0, 'captured'],
          [101, 2, 3.5, 'failed'],
          [102, 2, 3.5, 'captured'],
          [103, 3, 14.0, 'captured'],
          [104, 4, 10.0, 'captured'],
          [105, 4, 9.0, 'captured'],
        ],
      },
    ],
    starter: `-- orders(order_id, merchant_id, ordered_at, status)
-- order_items(order_id, sku, qty, unit_price)
-- payments(payment_id, order_id, amount, status)
-- This joins both child tables at once: every item meets every payment.
SELECT o.merchant_id, CAST(o.ordered_at AS DATE) AS day,
       COUNT(DISTINCT o.order_id) AS orders,
       SUM(i.qty * i.unit_price) AS item_revenue,
       SUM(p.amount) AS captured
FROM orders o
JOIN order_items i ON i.order_id = o.order_id
JOIN payments p ON p.order_id = o.order_id
GROUP BY 1, 2;
`,
    solution: `WITH items AS (
  SELECT order_id, SUM(qty * unit_price) AS item_revenue
  FROM order_items
  GROUP BY order_id
),
paid AS (
  SELECT order_id, SUM(amount) AS captured
  FROM payments
  WHERE status = 'captured'
  GROUP BY order_id
)
SELECT o.merchant_id,
       CAST(o.ordered_at AS DATE) AS day,
       COUNT(*) AS orders,
       COALESCE(SUM(i.item_revenue), 0) AS item_revenue,
       COALESCE(SUM(p.captured), 0) AS captured
FROM orders o
LEFT JOIN items i ON i.order_id = o.order_id
LEFT JOIN paid p ON p.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY 1, 2;
`,
    cases: [
      {
        name: 'Sample',
        note: 'Order 4 has three items and two payments: a direct join counts each payment three times. Order 5 has no items and no payments. Order 3 is cancelled.',
      },
      {
        name: 'An order with items but no payment',
        note: 'Order 6 is not paid yet. Order 7 has a payment and no items.',
        tables: [
          {
            name: 'orders',
            columns: ORDER_COLUMNS,
            rows: [
              [6, 30, '2024-05-03 08:00:00', 'placed'],
              [7, 30, '2024-05-03 09:00:00', 'delivered'],
            ],
          },
          { name: 'order_items', columns: ORDER_ITEM_COLUMNS, rows: [[6, 'soup', 2, 4.25]] },
          { name: 'payments', columns: ORDER_PAYMENT_COLUMNS, rows: [[200, 7, 5.0, 'captured']] },
        ],
      },
      {
        name: 'Five thousand orders',
        hidden: true,
        note: 'Up to four items and three payments per order, failed payments and cancellations.',
        setup: `TRUNCATE orders, order_items, payments;
INSERT INTO orders
SELECT n, 1 + n % 25, TIMESTAMP '2024-05-01' + ((n * 13) % 240) * INTERVAL '1 hour',
       CASE WHEN n % 17 = 0 THEN 'cancelled' WHEN n % 5 = 0 THEN 'placed' ELSE 'delivered' END
FROM generate_series(1, 5000) AS n;
INSERT INTO order_items
SELECT n, 'sku' || k, 1 + (n + k) % 3, (2 + (n * k) % 15)::numeric(10, 2)
FROM generate_series(1, 5000) AS n, generate_series(1, 4) AS k
WHERE k <= n % 5;
INSERT INTO payments
SELECT n * 10 + k, n, (5 + (n + k) % 20)::numeric(10, 2), CASE WHEN (n + k) % 4 = 0 THEN 'failed' ELSE 'captured' END
FROM generate_series(1, 5000) AS n, generate_series(1, 3) AS k
WHERE k <= n % 4;`,
      },
    ],
  },

  'fx-revenue-with-gaps': {
    language: 'sql',
    task: `Return «day, revenue_usd, unpriced_orders» for each day with orders. Convert each order with the rate of its currency on the order date. «fx_rates» has no rows on weekends and holidays: then use the latest earlier rate of that currency. «USD» has no rates and always converts at 1. An order with no rate on or before its date is left out of «revenue_usd» and counted in «unpriced_orders». Round «revenue_usd» to 2 decimal places. Row order does not matter.`,
    tables: [
      {
        name: 'orders',
        columns: FX_ORDER_COLUMNS,
        rows: [
          [1, '2024-03-08 10:00:00', 'EUR', 100.0],
          [2, '2024-03-09 11:00:00', 'EUR', 50.0],
          [3, '2024-03-10 23:30:00', 'INR', 8300.0],
          [4, '2024-03-10 09:00:00', 'USD', 20.0],
          [5, '2024-03-11 08:00:00', 'EUR', 10.0],
          [6, '2024-03-11 09:00:00', 'JPY', 1500.0],
        ],
      },
      {
        name: 'fx_rates',
        columns: FX_RATE_COLUMNS,
        rows: [
          ['EUR', '2024-03-07', 1.09],
          ['EUR', '2024-03-08', 1.1],
          ['EUR', '2024-03-11', 1.08],
          ['INR', '2024-03-08', 0.012],
          ['JPY', '2024-03-12', 0.0068],
        ],
      },
    ],
    starter: `-- orders(order_id, ordered_at, currency, amount)
-- fx_rates(currency, rate_date, usd_per_unit)
-- This only finds a rate on the exact order date.
SELECT CAST(o.ordered_at AS DATE) AS day,
       ROUND(SUM(o.amount * r.usd_per_unit), 2) AS revenue_usd,
       0 AS unpriced_orders
FROM orders o
JOIN fx_rates r ON r.currency = o.currency AND r.rate_date = CAST(o.ordered_at AS DATE)
GROUP BY 1;
`,
    solution: `SELECT CAST(o.ordered_at AS DATE) AS day,
       ROUND(COALESCE(SUM(o.amount * r.rate), 0), 2) AS revenue_usd,
       COUNT(*) FILTER (WHERE r.rate IS NULL) AS unpriced_orders
FROM orders o
LEFT JOIN LATERAL (
  SELECT CASE WHEN o.currency = 'USD' THEN 1 ELSE (
    SELECT f.usd_per_unit
    FROM fx_rates f
    WHERE f.currency = o.currency AND f.rate_date <= CAST(o.ordered_at AS DATE)
    ORDER BY f.rate_date DESC
    LIMIT 1
  ) END AS rate
) r ON TRUE
GROUP BY 1;
`,
    cases: [
      {
        name: 'Sample',
        note: 'The 9th and 10th are a weekend: EUR and INR use the rate of the 8th. JPY has no rate until the 12th, so order 6 is unpriced.',
      },
      {
        name: 'A day with only unpriced orders',
        note: 'Every order on the 1st is in a currency with no rate yet: revenue_usd is 0, not NULL.',
        tables: [
          {
            name: 'orders',
            columns: FX_ORDER_COLUMNS,
            rows: [
              [7, '2024-03-01 10:00:00', 'GBP', 40.0],
              [8, '2024-03-02 10:00:00', 'GBP', 40.0],
            ],
          },
          {
            name: 'fx_rates',
            columns: FX_RATE_COLUMNS,
            rows: [['GBP', '2024-03-02', 1.27]],
          },
        ],
      },
      {
        name: 'Six thousand orders',
        hidden: true,
        note: 'Five currencies, rates only on weekdays, and one currency whose rates start late.',
        setup: `TRUNCATE orders, fx_rates;
INSERT INTO fx_rates
SELECT c, d::date, (ARRAY[1.08, 0.012, 1.27, 0.0068, 0.74])[i] * (1 + ((EXTRACT(DOY FROM d)::int * i) % 9) / 1000.0)
FROM generate_series(DATE '2024-01-01', DATE '2024-03-31', INTERVAL '1 day') AS d,
     unnest(ARRAY['EUR', 'INR', 'GBP', 'JPY', 'SGD']) WITH ORDINALITY AS u(c, i)
WHERE EXTRACT(ISODOW FROM d) < 6 AND (c <> 'SGD' OR d >= DATE '2024-02-15');
INSERT INTO orders
SELECT n, TIMESTAMP '2024-01-01' + ((n * 17) % 2150) * INTERVAL '1 hour',
       (ARRAY['EUR', 'INR', 'GBP', 'JPY', 'SGD', 'USD'])[1 + n % 6], (10 + (n * 7) % 500)::numeric(12, 2)
FROM generate_series(1, 6000) AS n;`,
      },
    ],
  },

  'seller-payouts-with-refunds': {
    language: 'sql',
    task: `Pay each seller once a week. Return «seller_id, week_start, net, payout» for every seller in «sellers» and each of the four weeks that start on Monday 2024-07-01, 07-08, 07-15 and 07-22. «net» is 90% of the sales delivered that week, minus 90% of the refunds made that week on the seller's orders (by «refunded_at», whenever the order was delivered). The balance starts at 0 on 1 July. Each week the seller's balance grows by «net». When the balance is positive, «payout» pays all of it and the balance goes back to 0. When it is 0 or negative, «payout» is 0 and the negative balance carries to the next week. Count only activity from 1 to 28 July. Row order does not matter.`,
    tables: [
      { name: 'sellers', columns: [{ name: 'seller_id', type: 'int' }], rows: [[1], [2], [3]] },
      {
        name: 'sales',
        columns: SELLER_SALE_COLUMNS,
        rows: [
          [10, 1, 100.0, '2024-07-02 10:00:00'],
          [11, 1, 50.0, '2024-07-09 10:00:00'],
          [12, 1, 40.0, '2024-07-23 10:00:00'],
          [20, 2, 60.0, '2024-07-03 12:00:00'],
          [21, 2, 30.0, '2024-07-16 12:00:00'],
          [22, 2, 200.0, '2024-06-28 12:00:00'],
        ],
      },
      {
        name: 'refunds',
        columns: REFUND_COLUMNS,
        rows: [
          [1, 11, 50.0, '2024-07-10 09:00:00'],
          [2, 10, 100.0, '2024-07-11 09:00:00'],
          [3, 22, 200.0, '2024-07-09 09:00:00'],
        ],
      },
    ],
    starter: `-- sellers(seller_id)
-- sales(order_id, seller_id, amount, delivered_at)
-- refunds(refund_id, order_id, amount, refunded_at)
-- This pays a negative week as a negative payout, and skips quiet weeks.
SELECT s.seller_id, CAST(DATE_TRUNC('week', s.delivered_at) AS DATE) AS week_start,
       0.9 * SUM(s.amount) AS net, 0.9 * SUM(s.amount) AS payout
FROM sales s
GROUP BY 1, 2;
`,
    solution: `WITH weeks AS (
  SELECT CAST(w AS DATE) AS week_start
  FROM generate_series(DATE '2024-07-01', DATE '2024-07-22', INTERVAL '7 days') AS w
),
moves AS (
  SELECT seller_id, delivered_at AS at, amount
  FROM sales
  UNION ALL
  SELECT s.seller_id, r.refunded_at, -r.amount
  FROM refunds r
  JOIN sales s ON s.order_id = r.order_id
),
weekly AS (
  SELECT seller_id, CAST(DATE_TRUNC('week', at) AS DATE) AS week_start, 0.9 * SUM(amount) AS net
  FROM moves
  WHERE at >= DATE '2024-07-01' AND at < DATE '2024-07-29'
  GROUP BY 1, 2
),
grid AS (
  SELECT s.seller_id, w.week_start, COALESCE(k.net, 0) AS net
  FROM sellers s
  CROSS JOIN weeks w
  LEFT JOIN weekly k ON k.seller_id = s.seller_id AND k.week_start = w.week_start
),
running AS (
  SELECT seller_id, week_start, net,
         SUM(net) OVER (PARTITION BY seller_id ORDER BY week_start) AS cum_net
  FROM grid
),
-- Paid to date is the highest the running total has reached, never below 0.
paid AS (
  SELECT seller_id, week_start, net,
         GREATEST(0, MAX(cum_net) OVER (PARTITION BY seller_id ORDER BY week_start)) AS paid_to_date
  FROM running
)
SELECT seller_id, week_start, net,
       paid_to_date - COALESCE(LAG(paid_to_date) OVER (PARTITION BY seller_id ORDER BY week_start), 0) AS payout
FROM paid;
`,
    cases: [
      {
        name: 'Sample',
        note: 'Seller 1 is paid 90 in week 1, then two refunds make week 2 negative: weeks 3 and 4 pay off the debt first. Seller 2 is refunded in July for a June sale. Seller 3 sells nothing.',
      },
      {
        name: 'A debt that is never paid off',
        note: 'Seller 4 has a large refund in week 1 and small sales after it: every payout is 0.',
        tables: [
          { name: 'sellers', columns: [{ name: 'seller_id', type: 'int' }], rows: [[4]] },
          {
            name: 'sales',
            columns: SELLER_SALE_COLUMNS,
            rows: [
              [40, 4, 500.0, '2024-06-20 10:00:00'],
              [41, 4, 20.0, '2024-07-09 10:00:00'],
              [42, 4, 20.0, '2024-07-28 23:59:59'],
              [43, 4, 20.0, '2024-07-29 00:00:00'],
            ],
          },
          {
            name: 'refunds',
            columns: REFUND_COLUMNS,
            rows: [[4, 40, 500.0, '2024-07-01 00:00:00']],
          },
        ],
      },
      {
        name: 'Two hundred sellers',
        hidden: true,
        note: 'Sales and refunds every day of July, and refunds bigger than a week of sales.',
        setup: `TRUNCATE sellers, sales, refunds;
INSERT INTO sellers SELECT n FROM generate_series(1, 200) AS n;
INSERT INTO sales
SELECT n, 1 + n % 200, (5 + (n * 7) % 60)::numeric(10, 2),
       TIMESTAMP '2024-06-20' + ((n * 37) % 1000) * INTERVAL '1 hour'
FROM generate_series(1, 6000) AS n;
INSERT INTO refunds
SELECT n, n * 3, (5 + (n * 21) % 60)::numeric(10, 2) * (1 + n % 3),
       TIMESTAMP '2024-06-25' + ((n * 53) % 820) * INTERVAL '1 hour'
FROM generate_series(1, 1500) AS n;`,
      },
    ],
  },

  'l7-active-by-country': {
    language: 'sql',
    task: `Return «day, country, l7_users» for every day from 2024-05-01 to 2024-05-07 and every country in «countries». «l7_users» counts the distinct users with at least one event in the seven days ending on «day» (that day and the six before it). A user counts under the country that «user_country» gives them **on «day»**, even if their events were in another country. «valid_to» is exclusive. A user with no country on «day» does not count. Show 0 for a country with nobody. Row order does not matter.`,
    tables: [
      {
        name: 'countries',
        columns: [{ name: 'country', type: 'text' }],
        rows: [['IN'], ['US'], ['BR']],
      },
      {
        name: 'user_country',
        columns: USER_COUNTRY_COLUMNS,
        rows: [
          [1, 'IN', '2024-01-01', '2024-05-04'],
          [1, 'US', '2024-05-04', '9999-12-31'],
          [2, 'IN', '2024-01-01', '9999-12-31'],
          [3, 'US', '2024-05-02', '9999-12-31'],
        ],
      },
      {
        name: 'events',
        columns: USER_EVENT_COLUMNS,
        rows: [
          [1, '2024-04-26 10:00:00'],
          [1, '2024-04-26 11:00:00'],
          [2, '2024-04-24 23:59:59'],
          [2, '2024-05-03 08:00:00'],
          [3, '2024-04-30 08:00:00'],
          [3, '2024-05-07 23:00:00'],
        ],
      },
    ],
    starter: `-- countries(country)
-- user_country(user_id, country, valid_from, valid_to)
-- events(user_id, event_at)
-- This counts daily actives, and uses the current country.
SELECT CAST(e.event_at AS DATE) AS day, c.country, COUNT(DISTINCT e.user_id) AS l7_users
FROM events e
JOIN user_country c ON c.user_id = e.user_id AND c.valid_to = DATE '9999-12-31'
GROUP BY 1, 2;
`,
    solution: `WITH days AS (
  SELECT CAST(d AS DATE) AS day
  FROM generate_series(DATE '2024-05-01', DATE '2024-05-07', INTERVAL '1 day') AS d
),
active_days AS (
  SELECT DISTINCT user_id, CAST(event_at AS DATE) AS active_day
  FROM events
),
l7 AS (
  SELECT DISTINCT days.day, a.user_id
  FROM days
  JOIN active_days a ON a.active_day BETWEEN days.day - 6 AND days.day
)
SELECT days.day, k.country, COUNT(DISTINCT uc.user_id) AS l7_users
FROM days
CROSS JOIN countries k
LEFT JOIN l7 ON l7.day = days.day
LEFT JOIN user_country uc
  ON uc.user_id = l7.user_id AND uc.country = k.country
 AND uc.valid_from <= days.day AND days.day < uc.valid_to
GROUP BY days.day, k.country;
`,
    cases: [
      {
        name: 'Sample',
        note: 'User 1 was last active on 26 April and moves to US on 4 May. User 3 has no country before 2 May. Nobody is in BR.',
      },
      {
        name: 'The edges of the window',
        note: 'An event at 00:00 on 25 April is in the window of 1 May. One at 23:59 on 24 April is not.',
        tables: [
          {
            name: 'user_country',
            columns: USER_COUNTRY_COLUMNS,
            rows: [
              [4, 'BR', '2024-01-01', '9999-12-31'],
              [5, 'BR', '2024-01-01', '9999-12-31'],
            ],
          },
          {
            name: 'events',
            columns: USER_EVENT_COLUMNS,
            rows: [
              [4, '2024-04-25 00:00:00'],
              [5, '2024-04-24 23:59:59'],
              [5, '2024-05-07 00:00:00'],
            ],
          },
        ],
      },
      {
        name: 'Three thousand users',
        hidden: true,
        note: 'Users who move country during the week, and users active on many days.',
        setup: `TRUNCATE user_country, events;
INSERT INTO user_country
SELECT u, (ARRAY['IN', 'US', 'BR'])[1 + u % 3], DATE '2024-01-01',
       CASE WHEN u % 9 = 0 THEN DATE '2024-05-01' + u % 7 ELSE DATE '9999-12-31' END
FROM generate_series(1, 3000) AS u;
INSERT INTO user_country
SELECT u, (ARRAY['IN', 'US', 'BR'])[1 + (u + 1) % 3], DATE '2024-05-01' + u % 7, DATE '9999-12-31'
FROM generate_series(1, 3000) AS u
WHERE u % 9 = 0;
INSERT INTO events
SELECT u, TIMESTAMP '2024-04-20' + ((u * 31 + k * 67) % 432) * INTERVAL '1 hour'
FROM generate_series(1, 3000) AS u, generate_series(1, 4) AS k
WHERE (u + k) % 5 <> 0;`,
      },
    ],
  },

  'last-click-attribution': {
    language: 'sql',
    task: `Attribute each order to the last ad click of the same user in the seven days before it: «clicked_at» at or before «ordered_at» and after «ordered_at − 7 days». If two clicks have the same «clicked_at», the higher «click_id» wins. The order goes to the click's campaign channel from «campaigns», or to «unknown» when the campaign is not in «campaigns». An order with no such click goes to «direct». Return «channel, orders, revenue» for each channel with orders. Row order does not matter.`,
    tables: [
      {
        name: 'orders',
        columns: ATTR_ORDER_COLUMNS,
        rows: [
          [1, 1, '2024-06-10 12:00:00', 50.0],
          [2, 1, '2024-06-20 12:00:00', 30.0],
          [3, 2, '2024-06-10 09:00:00', 80.0],
          [4, 3, '2024-06-10 09:00:00', 15.0],
          [5, 4, '2024-06-12 10:00:00', 25.0],
        ],
      },
      {
        name: 'clicks',
        columns: AD_CLICK_COLUMNS,
        rows: [
          [100, 1, 1, '2024-06-05 08:00:00'],
          [101, 1, 2, '2024-06-09 22:00:00'],
          [102, 2, 1, '2024-06-10 09:05:00'],
          [103, 2, 2, '2024-06-03 09:00:00'],
          [104, 3, 3, '2024-06-03 09:00:01'],
          [105, 4, 9, '2024-06-11 10:00:00'],
        ],
      },
      {
        name: 'campaigns',
        columns: [
          { name: 'campaign_id', type: 'int' },
          { name: 'channel', type: 'text' },
        ],
        rows: [
          [1, 'search'],
          [2, 'social'],
          [3, 'email'],
        ],
      },
    ],
    starter: `-- orders(order_id, user_id, ordered_at, amount)
-- clicks(click_id, user_id, campaign_id, clicked_at)
-- campaigns(campaign_id, channel)
-- This credits every click in the window, so one order counts many times.
SELECT c.channel, COUNT(*) AS orders, SUM(o.amount) AS revenue
FROM orders o
JOIN clicks k ON k.user_id = o.user_id
  AND k.clicked_at <= o.ordered_at AND k.clicked_at > o.ordered_at - INTERVAL '7 days'
JOIN campaigns c ON c.campaign_id = k.campaign_id
GROUP BY 1;
`,
    solution: `WITH credited AS (
  SELECT o.order_id, o.amount,
         CASE WHEN last_click.click_id IS NULL THEN 'direct'
              ELSE COALESCE(c.channel, 'unknown') END AS channel
  FROM orders o
  LEFT JOIN LATERAL (
    SELECT k.click_id, k.campaign_id
    FROM clicks k
    WHERE k.user_id = o.user_id
      AND k.clicked_at <= o.ordered_at
      AND k.clicked_at > o.ordered_at - INTERVAL '7 days'
    ORDER BY k.clicked_at DESC, k.click_id DESC
    LIMIT 1
  ) last_click ON TRUE
  LEFT JOIN campaigns c ON c.campaign_id = last_click.campaign_id
)
SELECT channel, COUNT(*) AS orders, SUM(amount) AS revenue
FROM credited
GROUP BY channel;
`,
    cases: [
      {
        name: 'Sample',
        note: 'Order 1 goes to social, the later click. Order 2 has no click in its window. Click 102 is after order 3. Click 104 is exactly seven days minus one second before order 4. Campaign 9 is unknown.',
      },
      {
        name: 'Two clicks in the same second',
        note: 'Clicks 201 and 202 share a time: the higher id, 202, wins.',
        tables: [
          {
            name: 'orders',
            columns: ATTR_ORDER_COLUMNS,
            rows: [
              [6, 5, '2024-06-15 10:00:00', 40.0],
              [7, 6, '2024-06-15 10:00:00', 10.0],
            ],
          },
          {
            name: 'clicks',
            columns: AD_CLICK_COLUMNS,
            rows: [
              [201, 5, 1, '2024-06-14 10:00:00'],
              [202, 5, 3, '2024-06-14 10:00:00'],
              [203, 6, 2, '2024-06-08 10:00:00'],
            ],
          },
        ],
      },
      {
        name: 'Four thousand orders',
        hidden: true,
        note: 'Users with many clicks, clicks after orders and clicks on campaigns that were deleted.',
        setup: `TRUNCATE orders, clicks;
INSERT INTO orders
SELECT n, 1 + n % 900, TIMESTAMP '2024-06-01' + ((n * 41) % 700) * INTERVAL '1 hour', (5 + n % 120)::numeric(10, 2)
FROM generate_series(1, 4000) AS n;
INSERT INTO clicks
SELECT n, 1 + (n * 7) % 900, 1 + n % 4, TIMESTAMP '2024-05-25' + ((n * 29) % 860) * INTERVAL '1 hour'
FROM generate_series(1, 9000) AS n;
CREATE INDEX IF NOT EXISTS clicks_by_user_time ON clicks (user_id, clicked_at);`,
      },
    ],
  },

  'driver-payout-reconciliation': {
    language: 'sql',
    task: `Reconcile trips with payout lines. A trip with «status» «completed» should have exactly one payout line of «ROUND(fare × 0.8, 2)». Return «trip_id, issue, expected, paid» for each problem, one row per trip id: «missing» (a completed trip with no line, «paid» 0), «duplicate» (two or more lines), «mismatch» (one line with the wrong amount), «not_payable» (lines for a trip that is not completed, «expected» NULL) and «unknown_trip» (lines for a trip id not in «trips», «expected» NULL). «paid» is the sum of the trip's lines. «expected» is the amount above for a completed trip. Leave out trips that are correct. Row order does not matter.`,
    tables: [
      {
        name: 'trips',
        columns: PAYOUT_TRIP_COLUMNS,
        rows: [
          [1, 7, 10.0, 'completed'],
          [2, 7, 12.5, 'completed'],
          [3, 7, 20.0, 'completed'],
          [4, 8, 8.0, 'cancelled'],
          [5, 8, 15.0, 'completed'],
          [6, 8, 9.99, 'completed'],
        ],
      },
      {
        name: 'payout_lines',
        columns: PAYOUT_LINE_COLUMNS,
        rows: [
          [100, 1, 8.0],
          [101, 3, 16.0],
          [102, 3, 16.0],
          [103, 4, 6.4],
          [104, 5, 11.0],
          [105, 9, 5.0],
          [106, 6, 7.99],
        ],
      },
    ],
    starter: `-- trips(trip_id, driver_id, fare, status)
-- payout_lines(line_id, trip_id, amount)
-- This only compares the lines that match a trip, one by one.
SELECT t.trip_id, 'mismatch' AS issue, ROUND(t.fare * 0.8, 2) AS expected, p.amount AS paid
FROM trips t
JOIN payout_lines p ON p.trip_id = t.trip_id
WHERE p.amount <> ROUND(t.fare * 0.8, 2);
`,
    solution: `WITH lines AS (
  SELECT trip_id, COUNT(*) AS n, SUM(amount) AS paid
  FROM payout_lines
  GROUP BY trip_id
),
joined AS (
  SELECT COALESCE(t.trip_id, l.trip_id) AS trip_id,
         t.status,
         CASE WHEN t.status = 'completed' THEN ROUND(t.fare * 0.8, 2) END AS expected,
         COALESCE(l.n, 0) AS n,
         COALESCE(l.paid, 0) AS paid,
         t.trip_id IS NULL AS unknown
  FROM trips t
  FULL OUTER JOIN lines l ON l.trip_id = t.trip_id
),
classified AS (
  SELECT trip_id, expected, paid,
         CASE
           WHEN unknown THEN 'unknown_trip'
           WHEN status <> 'completed' AND n > 0 THEN 'not_payable'
           WHEN status = 'completed' AND n = 0 THEN 'missing'
           WHEN status = 'completed' AND n > 1 THEN 'duplicate'
           WHEN status = 'completed' AND paid <> expected THEN 'mismatch'
         END AS issue
  FROM joined
)
SELECT trip_id, issue, expected, paid
FROM classified
WHERE issue IS NOT NULL;
`,
    cases: [
      {
        name: 'Sample',
        note: 'Trip 2 has no line. Trip 3 is paid twice. Trip 4 was cancelled. Trip 5 is underpaid. Line 105 points at a trip that does not exist. Trip 6 rounds to 7.99 and is correct.',
      },
      {
        name: 'A duplicate that adds up',
        note: 'Trip 11 has two half payments that sum to the right amount: it is still a duplicate.',
        tables: [
          {
            name: 'trips',
            columns: PAYOUT_TRIP_COLUMNS,
            rows: [
              [11, 9, 10.0, 'completed'],
              [12, 9, 10.0, 'completed'],
            ],
          },
          {
            name: 'payout_lines',
            columns: PAYOUT_LINE_COLUMNS,
            rows: [
              [200, 11, 4.0],
              [201, 11, 4.0],
              [202, 12, 8.0],
            ],
          },
        ],
      },
      {
        name: 'Ten thousand trips',
        hidden: true,
        note: 'Every kind of problem, mixed with many correct trips.',
        setup: `TRUNCATE trips, payout_lines;
INSERT INTO trips
SELECT n, 1 + n % 300, (3 + (n * 7) % 4000 / 100.0)::numeric(10, 2),
       CASE WHEN n % 23 = 0 THEN 'cancelled' ELSE 'completed' END
FROM generate_series(1, 10000) AS n;
INSERT INTO payout_lines
SELECT trip_id, trip_id, CASE WHEN trip_id % 41 = 0 THEN ROUND(fare * 0.75, 2) ELSE ROUND(fare * 0.8, 2) END
FROM trips
WHERE trip_id % 37 <> 0;
INSERT INTO payout_lines
SELECT 20000 + n, n, 1.00 FROM generate_series(1, 10000, 53) AS n;
INSERT INTO payout_lines
SELECT 40000 + n, 10000 + n, 2.00 FROM generate_series(1, 40) AS n;`,
      },
    ],
  },
};
