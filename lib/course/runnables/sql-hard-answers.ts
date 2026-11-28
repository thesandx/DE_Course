import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/** Other answers for the hard multi-table SQL problems. See `test-answers.ts`. */
export const SQL_HARD_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'order-revenue-fanout': {
    pass: [
      `SELECT o.merchant_id, o.ordered_at::date AS day, COUNT(*) AS orders,
       SUM((SELECT COALESCE(SUM(qty * unit_price), 0) FROM order_items i WHERE i.order_id = o.order_id)) AS item_revenue,
       SUM((SELECT COALESCE(SUM(amount), 0) FROM payments p WHERE p.order_id = o.order_id AND p.status = 'captured')) AS captured
FROM orders o
WHERE o.status <> 'cancelled'
GROUP BY 1, 2;`,
    ],
    fail: [
      // Left joins to both child tables still multiply items by payments.
      `SELECT o.merchant_id, o.ordered_at::date AS day, COUNT(DISTINCT o.order_id) AS orders,
       COALESCE(SUM(i.qty * i.unit_price), 0) AS item_revenue,
       COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'captured'), 0) AS captured
FROM orders o
LEFT JOIN order_items i ON i.order_id = o.order_id
LEFT JOIN payments p ON p.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY 1, 2;`,
      // Pre-aggregates, but the inner join drops orders with no items.
      `WITH i AS (SELECT order_id, SUM(qty * unit_price) AS r FROM order_items GROUP BY 1),
p AS (SELECT order_id, SUM(amount) AS c FROM payments WHERE status = 'captured' GROUP BY 1)
SELECT o.merchant_id, o.ordered_at::date AS day, COUNT(*) AS orders,
       SUM(i.r) AS item_revenue, COALESCE(SUM(p.c), 0) AS captured
FROM orders o JOIN i ON i.order_id = o.order_id LEFT JOIN p ON p.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY 1, 2;`,
      // Counts failed payments as captured.
      `WITH i AS (SELECT order_id, SUM(qty * unit_price) AS r FROM order_items GROUP BY 1),
p AS (SELECT order_id, SUM(amount) AS c FROM payments GROUP BY 1)
SELECT o.merchant_id, o.ordered_at::date AS day, COUNT(*) AS orders,
       COALESCE(SUM(i.r), 0) AS item_revenue, COALESCE(SUM(p.c), 0) AS captured
FROM orders o LEFT JOIN i ON i.order_id = o.order_id LEFT JOIN p ON p.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY 1, 2;`,
    ],
  },
  'fx-revenue-with-gaps': {
    pass: [
      `WITH priced AS (
  SELECT o.ordered_at::date AS day, o.amount,
         CASE WHEN o.currency = 'USD' THEN 1 END AS usd_rate,
         (SELECT usd_per_unit FROM fx_rates f
          WHERE f.currency = o.currency AND f.rate_date = (
            SELECT MAX(rate_date) FROM fx_rates g
            WHERE g.currency = o.currency AND g.rate_date <= o.ordered_at::date)) AS fx_rate
  FROM orders o)
SELECT day, ROUND(COALESCE(SUM(amount * COALESCE(usd_rate, fx_rate)), 0), 2) AS revenue_usd,
       COUNT(*) - COUNT(COALESCE(usd_rate, fx_rate)) AS unpriced_orders
FROM priced GROUP BY day;`,
    ],
    fail: [
      // Falls back to rate 1 when the exact day has no rate.
      `SELECT o.ordered_at::date AS day, ROUND(SUM(o.amount * COALESCE(r.usd_per_unit, 1)), 2) AS revenue_usd,
       0 AS unpriced_orders
FROM orders o LEFT JOIN fx_rates r ON r.currency = o.currency AND r.rate_date = o.ordered_at::date
GROUP BY 1;`,
      // Takes the nearest rate in either direction, so it can use a future rate.
      `SELECT o.ordered_at::date AS day,
       ROUND(COALESCE(SUM(o.amount * r.rate), 0), 2) AS revenue_usd,
       COUNT(*) FILTER (WHERE r.rate IS NULL) AS unpriced_orders
FROM orders o LEFT JOIN LATERAL (
  SELECT CASE WHEN o.currency = 'USD' THEN 1 ELSE (
    SELECT usd_per_unit FROM fx_rates f WHERE f.currency = o.currency
    ORDER BY ABS(f.rate_date - o.ordered_at::date), f.rate_date LIMIT 1) END AS rate) r ON TRUE
GROUP BY 1;`,
      // Forgets that USD has no rates.
      `SELECT o.ordered_at::date AS day,
       ROUND(COALESCE(SUM(o.amount * r.usd_per_unit), 0), 2) AS revenue_usd,
       COUNT(*) FILTER (WHERE r.usd_per_unit IS NULL) AS unpriced_orders
FROM orders o LEFT JOIN LATERAL (
  SELECT usd_per_unit FROM fx_rates f WHERE f.currency = o.currency AND f.rate_date <= o.ordered_at::date
  ORDER BY f.rate_date DESC LIMIT 1) r ON TRUE
GROUP BY 1;`,
      // A day with only unpriced orders shows NULL revenue instead of 0.
      `SELECT o.ordered_at::date AS day,
       ROUND(SUM(o.amount * r.rate), 2) AS revenue_usd,
       COUNT(*) FILTER (WHERE r.rate IS NULL) AS unpriced_orders
FROM orders o LEFT JOIN LATERAL (
  SELECT CASE WHEN o.currency = 'USD' THEN 1 ELSE (
    SELECT usd_per_unit FROM fx_rates f WHERE f.currency = o.currency AND f.rate_date <= o.ordered_at::date
    ORDER BY f.rate_date DESC LIMIT 1) END AS rate) r ON TRUE
GROUP BY 1;`,
    ],
  },
  'seller-payouts-with-refunds': {
    pass: [
      `WITH RECURSIVE w AS (
  SELECT s.seller_id, x.week_start::date AS week_start, x.i,
    0.9 * (COALESCE((SELECT SUM(amount) FROM sales a WHERE a.seller_id = s.seller_id
             AND a.delivered_at >= x.week_start AND a.delivered_at < x.week_start + INTERVAL '7 days'), 0)
         - COALESCE((SELECT SUM(r.amount) FROM refunds r JOIN sales a ON a.order_id = r.order_id
             WHERE a.seller_id = s.seller_id
             AND r.refunded_at >= x.week_start AND r.refunded_at < x.week_start + INTERVAL '7 days'), 0)) AS net
  FROM sellers s
  CROSS JOIN generate_series(DATE '2024-07-01', DATE '2024-07-22', INTERVAL '7 days') WITH ORDINALITY AS x(week_start, i)
), r AS (
  SELECT seller_id, week_start, i, net, GREATEST(net, 0) AS payout, LEAST(net, 0) AS balance
  FROM w WHERE i = 1
  UNION ALL
  SELECT w.seller_id, w.week_start, w.i, w.net,
         GREATEST(r.balance + w.net, 0), LEAST(r.balance + w.net, 0)
  FROM r JOIN w ON w.seller_id = r.seller_id AND w.i = r.i + 1
)
SELECT seller_id, week_start, net, payout FROM r;`,
    ],
    fail: [
      // No carry: a negative week is simply paid 0 and forgotten.
      `WITH weeks AS (SELECT w::date AS week_start FROM generate_series(DATE '2024-07-01', DATE '2024-07-22', INTERVAL '7 days') w),
m AS (SELECT seller_id, delivered_at AS at, amount FROM sales
      UNION ALL SELECT s.seller_id, r.refunded_at, -r.amount FROM refunds r JOIN sales s USING (order_id)),
k AS (SELECT seller_id, DATE_TRUNC('week', at)::date AS week_start, 0.9 * SUM(amount) AS net FROM m
      WHERE at >= DATE '2024-07-01' AND at < DATE '2024-07-29' GROUP BY 1, 2)
SELECT s.seller_id, w.week_start, COALESCE(k.net, 0) AS net, GREATEST(COALESCE(k.net, 0), 0) AS payout
FROM sellers s CROSS JOIN weeks w LEFT JOIN k ON k.seller_id = s.seller_id AND k.week_start = w.week_start;`,
      // Counts a refund only when the order was delivered in July too.
      `WITH weeks AS (SELECT w::date AS week_start FROM generate_series(DATE '2024-07-01', DATE '2024-07-22', INTERVAL '7 days') w),
m AS (SELECT seller_id, delivered_at AS at, amount FROM sales
      UNION ALL SELECT s.seller_id, r.refunded_at, -r.amount FROM refunds r JOIN sales s USING (order_id)
      WHERE s.delivered_at >= DATE '2024-07-01'),
k AS (SELECT seller_id, DATE_TRUNC('week', at)::date AS week_start, 0.9 * SUM(amount) AS net FROM m
      WHERE at >= DATE '2024-07-01' AND at < DATE '2024-07-29' GROUP BY 1, 2),
g AS (SELECT s.seller_id, w.week_start, COALESCE(k.net, 0) AS net FROM sellers s CROSS JOIN weeks w
      LEFT JOIN k ON k.seller_id = s.seller_id AND k.week_start = w.week_start),
p AS (SELECT g.*, GREATEST(0, MAX(c) OVER (PARTITION BY seller_id ORDER BY week_start)) AS ptd
      FROM (SELECT g.*, SUM(net) OVER (PARTITION BY seller_id ORDER BY week_start) AS c FROM g) g)
SELECT seller_id, week_start, net, ptd - COALESCE(LAG(ptd) OVER (PARTITION BY seller_id ORDER BY week_start), 0) AS payout FROM p;`,
      // Pays the change in a positive running total: a week after a debt can pay a negative amount.
      `WITH weeks AS (SELECT w::date AS week_start FROM generate_series(DATE '2024-07-01', DATE '2024-07-22', INTERVAL '7 days') w),
m AS (SELECT seller_id, delivered_at AS at, amount FROM sales
      UNION ALL SELECT s.seller_id, r.refunded_at, -r.amount FROM refunds r JOIN sales s USING (order_id)),
k AS (SELECT seller_id, DATE_TRUNC('week', at)::date AS week_start, 0.9 * SUM(amount) AS net FROM m
      WHERE at >= DATE '2024-07-01' AND at < DATE '2024-07-29' GROUP BY 1, 2),
g AS (SELECT s.seller_id, w.week_start, COALESCE(k.net, 0) AS net FROM sellers s CROSS JOIN weeks w
      LEFT JOIN k ON k.seller_id = s.seller_id AND k.week_start = w.week_start),
p AS (SELECT g.*, GREATEST(0, SUM(net) OVER (PARTITION BY seller_id ORDER BY week_start)) AS ptd FROM g)
SELECT seller_id, week_start, net, ptd - COALESCE(LAG(ptd) OVER (PARTITION BY seller_id ORDER BY week_start), 0) AS payout FROM p;`,
    ],
  },
  'l7-active-by-country': {
    fail: [
      // Uses the country at the time of each event, not on the reporting day.
      `WITH days AS (SELECT d::date AS day FROM generate_series(DATE '2024-05-01', DATE '2024-05-07', INTERVAL '1 day') d),
x AS (SELECT DISTINCT days.day, uc.country, e.user_id FROM days
      JOIN events e ON e.event_at::date BETWEEN days.day - 6 AND days.day
      JOIN user_country uc ON uc.user_id = e.user_id AND uc.valid_from <= e.event_at::date AND e.event_at::date < uc.valid_to)
SELECT days.day, k.country, COUNT(DISTINCT x.user_id) AS l7_users
FROM days CROSS JOIN countries k LEFT JOIN x ON x.day = days.day AND x.country = k.country
GROUP BY 1, 2;`,
      // An eight-day window: day - 7 to day.
      `WITH days AS (SELECT d::date AS day FROM generate_series(DATE '2024-05-01', DATE '2024-05-07', INTERVAL '1 day') d),
x AS (SELECT DISTINCT days.day, e.user_id FROM days JOIN events e ON e.event_at >= days.day - 7 AND e.event_at < days.day + 1)
SELECT days.day, k.country, COUNT(DISTINCT uc.user_id) AS l7_users
FROM days CROSS JOIN countries k LEFT JOIN x ON x.day = days.day
LEFT JOIN user_country uc ON uc.user_id = x.user_id AND uc.country = k.country AND uc.valid_from <= days.day AND days.day < uc.valid_to
GROUP BY 1, 2;`,
      // Uses the current country for every day.
      `WITH days AS (SELECT d::date AS day FROM generate_series(DATE '2024-05-01', DATE '2024-05-07', INTERVAL '1 day') d),
x AS (SELECT DISTINCT days.day, e.user_id FROM days JOIN events e ON e.event_at >= days.day - 6 AND e.event_at < days.day + 1)
SELECT days.day, k.country, COUNT(DISTINCT uc.user_id) AS l7_users
FROM days CROSS JOIN countries k LEFT JOIN x ON x.day = days.day
LEFT JOIN user_country uc ON uc.user_id = x.user_id AND uc.country = k.country AND uc.valid_to = DATE '9999-12-31'
GROUP BY 1, 2;`,
    ],
  },
  'last-click-attribution': {
    pass: [
      `WITH c AS (
  SELECT o.order_id, o.amount, k.campaign_id, k.click_id,
         ROW_NUMBER() OVER (PARTITION BY o.order_id ORDER BY k.clicked_at DESC NULLS LAST, k.click_id DESC) AS rn
  FROM orders o LEFT JOIN clicks k ON k.user_id = o.user_id
   AND k.clicked_at BETWEEN o.ordered_at - INTERVAL '7 days' + INTERVAL '1 microsecond' AND o.ordered_at)
SELECT CASE WHEN c.click_id IS NULL THEN 'direct' ELSE COALESCE(g.channel, 'unknown') END AS channel,
       COUNT(*) AS orders, SUM(c.amount) AS revenue
FROM c LEFT JOIN campaigns g ON g.campaign_id = c.campaign_id
WHERE c.rn = 1
GROUP BY 1;`,
    ],
    fail: [
      // First click instead of last.
      `WITH c AS (
  SELECT o.order_id, o.amount, k.campaign_id, k.click_id,
         ROW_NUMBER() OVER (PARTITION BY o.order_id ORDER BY k.clicked_at, k.click_id DESC) AS rn
  FROM orders o LEFT JOIN clicks k ON k.user_id = o.user_id
   AND k.clicked_at <= o.ordered_at AND k.clicked_at > o.ordered_at - INTERVAL '7 days')
SELECT CASE WHEN c.click_id IS NULL THEN 'direct' ELSE COALESCE(g.channel, 'unknown') END AS channel,
       COUNT(*) AS orders, SUM(c.amount) AS revenue
FROM c LEFT JOIN campaigns g ON g.campaign_id = c.campaign_id WHERE c.rn = 1 GROUP BY 1;`,
      // The window includes a click exactly seven days before.
      `WITH c AS (
  SELECT o.order_id, o.amount, k.campaign_id, k.click_id,
         ROW_NUMBER() OVER (PARTITION BY o.order_id ORDER BY k.clicked_at DESC, k.click_id DESC) AS rn
  FROM orders o LEFT JOIN clicks k ON k.user_id = o.user_id
   AND k.clicked_at <= o.ordered_at AND k.clicked_at >= o.ordered_at - INTERVAL '7 days')
SELECT CASE WHEN c.click_id IS NULL THEN 'direct' ELSE COALESCE(g.channel, 'unknown') END AS channel,
       COUNT(*) AS orders, SUM(c.amount) AS revenue
FROM c LEFT JOIN campaigns g ON g.campaign_id = c.campaign_id WHERE c.rn = 1 GROUP BY 1;`,
      // Breaks ties by the lower click id.
      `WITH c AS (
  SELECT o.order_id, o.amount, k.campaign_id, k.click_id,
         ROW_NUMBER() OVER (PARTITION BY o.order_id ORDER BY k.clicked_at DESC, k.click_id) AS rn
  FROM orders o LEFT JOIN clicks k ON k.user_id = o.user_id
   AND k.clicked_at <= o.ordered_at AND k.clicked_at > o.ordered_at - INTERVAL '7 days')
SELECT CASE WHEN c.click_id IS NULL THEN 'direct' ELSE COALESCE(g.channel, 'unknown') END AS channel,
       COUNT(*) AS orders, SUM(c.amount) AS revenue
FROM c LEFT JOIN campaigns g ON g.campaign_id = c.campaign_id WHERE c.rn = 1 GROUP BY 1;`,
      // Picks the last click whose campaign is known, so unknown campaigns never win.
      `WITH c AS (
  SELECT o.order_id, o.amount, g.channel, k.click_id,
         ROW_NUMBER() OVER (PARTITION BY o.order_id ORDER BY k.clicked_at DESC, k.click_id DESC) AS rn
  FROM orders o LEFT JOIN (clicks k JOIN campaigns g ON g.campaign_id = k.campaign_id) ON k.user_id = o.user_id
   AND k.clicked_at <= o.ordered_at AND k.clicked_at > o.ordered_at - INTERVAL '7 days')
SELECT COALESCE(channel, 'direct') AS channel, COUNT(*) AS orders, SUM(amount) AS revenue
FROM c WHERE rn = 1 GROUP BY 1;`,
    ],
  },
  'driver-payout-reconciliation': {
    fail: [
      // Compares each line on its own, so a duplicate that adds up shows as two mismatches or nothing.
      `SELECT t.trip_id,
       CASE WHEN t.trip_id IS NULL THEN 'unknown_trip' WHEN t.status <> 'completed' THEN 'not_payable'
            WHEN p.line_id IS NULL THEN 'missing' ELSE 'mismatch' END AS issue,
       CASE WHEN t.status = 'completed' THEN ROUND(t.fare * 0.8, 2) END AS expected,
       COALESCE(p.amount, 0) AS paid
FROM trips t FULL JOIN payout_lines p ON p.trip_id = t.trip_id
WHERE t.trip_id IS NULL OR (t.status <> 'completed' AND p.line_id IS NOT NULL)
   OR (t.status = 'completed' AND (p.line_id IS NULL OR p.amount <> ROUND(t.fare * 0.8, 2)));`,
      // Does not round the expected amount, so 9.99 x 0.8 = 7.992 looks underpaid.
      `WITH l AS (SELECT trip_id, COUNT(*) AS n, SUM(amount) AS paid FROM payout_lines GROUP BY 1),
j AS (SELECT COALESCE(t.trip_id, l.trip_id) AS trip_id, t.status, t.trip_id IS NULL AS unknown,
             CASE WHEN t.status = 'completed' THEN t.fare * 0.8 END AS expected,
             COALESCE(l.n, 0) AS n, COALESCE(l.paid, 0) AS paid
      FROM trips t FULL JOIN l ON l.trip_id = t.trip_id),
c AS (SELECT trip_id, expected, paid, CASE WHEN unknown THEN 'unknown_trip'
        WHEN status <> 'completed' AND n > 0 THEN 'not_payable' WHEN status = 'completed' AND n = 0 THEN 'missing'
        WHEN status = 'completed' AND n > 1 THEN 'duplicate' WHEN status = 'completed' AND paid <> expected THEN 'mismatch' END AS issue
      FROM j)
SELECT trip_id, issue, expected, paid FROM c WHERE issue IS NOT NULL;`,
      // Starts from trips with a left join, so lines for unknown trips are never seen.
      `WITH l AS (SELECT trip_id, COUNT(*) AS n, SUM(amount) AS paid FROM payout_lines GROUP BY 1),
j AS (SELECT t.trip_id, t.status, CASE WHEN t.status = 'completed' THEN ROUND(t.fare * 0.8, 2) END AS expected,
             COALESCE(l.n, 0) AS n, COALESCE(l.paid, 0) AS paid
      FROM trips t LEFT JOIN l ON l.trip_id = t.trip_id),
c AS (SELECT trip_id, expected, paid, CASE
        WHEN status <> 'completed' AND n > 0 THEN 'not_payable' WHEN status = 'completed' AND n = 0 THEN 'missing'
        WHEN status = 'completed' AND n > 1 THEN 'duplicate' WHEN status = 'completed' AND paid <> expected THEN 'mismatch' END AS issue
      FROM j)
SELECT trip_id, issue, expected, paid FROM c WHERE issue IS NOT NULL;`,
    ],
  },
};
