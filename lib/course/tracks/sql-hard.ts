import type { Problem } from '@/types/course';

/**
 * Hard multi-table SQL problems for the SQL track: the questions that phone
 * screens at Meta, Amazon and Uber end on, where the trap is in the joins.
 * They join the SQL track in `sql.ts`. The specs are in
 * `lib/course/runnables/sql-hard.ts`.
 */
export const hardSqlProblems: readonly Problem[] = [
  {
    slug: 'order-revenue-fanout',
    title: 'Revenue and payments without join fan-out',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['amazon', 'swiggy', 'flipkart', 'uber', 'meta'],
    prompt: `
      Tables «orders(order_id, merchant_id, ordered_at, status)», «order_items(order_id, sku, qty,
      unit_price)» and «payments(payment_id, order_id, amount, status)».

      For each merchant and day, return the number of orders, the item revenue and the captured
      payment amount. Leave out cancelled orders. The numbers go to finance.
    `,
    hints: [
      'What happens to an order with three items and two payments when you join both tables?',
      'Bring each child table to one row per order before the join.',
      'Some orders have no items or no payments yet.',
    ],
    answer: `
      Joining both child tables at once makes every item meet every payment, so both sums are
      multiplied. **Aggregate each child table to the order grain first**, then join.

      ~~~sql
      WITH items AS (
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
      ~~~

      The left joins keep orders with no items or no payments, and «COALESCE» turns their NULL
      sums into 0. «COUNT(DISTINCT ...)» on the fanned-out join fixes the order count but not the
      sums, which is why it is a trap: the count looks right and the money is wrong. Say the rule
      out loud: never join two one-to-many tables to the same parent in one step.
    `,
    signals: [
      'Spots the fan-out before writing the query',
      'Aggregates each child to the parent grain, then joins',
      'Keeps orders with no items or no payments',
      'Filters payment status inside the child aggregate',
      'Explains why COUNT(DISTINCT) hides the bug',
    ],
    followUps: [
      'How would a test catch this fan-out before it reaches finance?',
      'The tables are billions of rows in BigQuery. Does the plan change?',
    ],
  },
  {
    slug: 'fx-revenue-with-gaps',
    title: 'Convert revenue with missing exchange rates',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['amazon', 'google', 'microsoft', 'walmart', 'phonepe'],
    prompt: `
      Tables «orders(order_id, ordered_at, currency, amount)» and «fx_rates(currency, rate_date,
      usd_per_unit)». Rates are published only on working days. Return revenue in USD per day, and
      how many orders could not be converted.
    `,
    hints: [
      'An exact-date join finds no rate on a weekend.',
      'You want the latest rate on or before the order date, per currency.',
      'USD needs no rate. And some currencies have no rate yet: do not invent one.',
    ],
    answer: `
      Use the **latest rate on or before** the order date. A lateral subquery with «ORDER BY ...
      DESC LIMIT 1» says that directly.

      ~~~sql
      SELECT CAST(o.ordered_at AS DATE) AS day,
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
      ~~~

      Never fall back to rate 1, and never use a future rate: both produce numbers that look
      plausible and are wrong. Count the unpriced orders so the gap is visible. At warehouse scale,
      build a daily rate table once, with every currency and every calendar day filled forward,
      and join on the exact date: it is cheaper than a lateral lookup per order, and finance can
      audit it.
    `,
    signals: [
      'Uses the latest rate on or before the date, not an exact match',
      'Handles the base currency without a rate row',
      'Reports unconvertible orders instead of guessing',
      'Proposes a filled-forward daily rate table for scale',
    ],
    followUps: [
      'Finance wants month-end rates for the balance sheet and daily rates for revenue. How do you model both?',
      'A rate is corrected two days later. Which reports change?',
    ],
  },
  {
    slug: 'seller-payouts-with-refunds',
    title: 'Weekly seller payouts that carry a debt',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['amazon', 'flipkart', 'walmart', 'swiggy'],
    prompt: `
      A marketplace pays sellers every Monday: 90% of the week's delivered sales minus 90% of the
      week's refunds. A refund can be for an old order. When a week nets negative, the seller is
      paid nothing and the debt carries forward until later sales cover it. Return the net and the
      payout per seller per week for July.
    `,
    hints: [
      'First get the net per seller per week, with 0 for quiet weeks.',
      'The balance rule looks recursive. Write a few weeks by hand and look at the total paid so far.',
      'Total paid so far is the highest the running net has ever been, and never below 0.',
    ],
    answer: `
      The carry rule is a recursion: «balance = min(0, balance + net)», «payout = max(0, balance +
      net)». The recursion has a closed form. **Paid to date is the running maximum of the
      cumulative net, floored at 0**, and each payout is the change in it.

      ~~~sql
      WITH weeks AS (
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
      ~~~

      Check it by hand: +90 then −90 pays 90 then 0, and the next +36 pays 0 because the debt is
      54. A recursive CTE gives the same answer and is easier to explain, but it walks the weeks
      one at a time. Join refunds to sales to find the seller, and date them by «refunded_at»: a
      July refund for a June order still reduces July.
    `,
    signals: [
      'Builds a seller by week grid so quiet weeks appear',
      'Dates refunds by refund time and finds the seller through the order',
      'Turns the carry rule into a running maximum, or writes a correct recursion',
      'Checks the result by hand on a small case',
      'Raises how finance audits a payout',
    ],
    followUps: [
      'A seller disputes a payout. What table lets you explain every cent?',
      'Payouts are now daily. What changes in the query and in the model?',
    ],
  },
  {
    slug: 'l7-active-by-country',
    title: 'L7 active users by country with moves',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['meta', 'google', 'microsoft', 'uber'],
    prompt: `
      Tables «events(user_id, event_at)», «user_country(user_id, country, valid_from, valid_to)»
      (type 2 history) and «countries(country)». For each day of the first week of May and each
      country, return the number of users active in the last seven days. A user who moved counts
      in the country they are in on the reporting day.
    `,
    hints: [
      'Daily actives first, then the window: which days does the window of 1 May cover?',
      'Build days × countries first, so zero rows appear.',
      'Join the history on the reporting day, not the event day.',
    ],
    answer: `
      Three steps: a **date spine**, the **set of users active in each day's window**, then the
      country valid **on that day**.

      ~~~sql
      WITH days AS (
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
      ~~~

      The window is the day and the six before it, seven days. «BETWEEN day - 6 AND day» on the
      event date is easier to get right than timestamps. The reporting-day rule matters: Meta
      counts a user where they are now, so a country's L7 is not the sum of its daily actives. At
      scale, keep a «user_day_activity» table with one row per active user and day, so the window
      scans 7 small partitions, not 7 days of raw events.
    `,
    signals: [
      'Gets the seven-day window boundaries right',
      'Counts distinct users per window, not the sum of daily counts',
      'Joins the country history on the reporting day',
      'Uses a days by countries spine for zero rows',
      'Proposes a user-day activity table for scale',
    ],
    followUps: [
      'Product now wants L28. What breaks in your plan?',
      'How do you compute L7 for every day of a year without seven scans per day?',
    ],
  },
  {
    slug: 'last-click-attribution',
    title: 'Last-click attribution in a seven-day window',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['meta', 'google', 'amazon', 'flipkart'],
    prompt: `
      Tables «orders(order_id, user_id, ordered_at, amount)», «clicks(click_id, user_id,
      campaign_id, clicked_at)» and «campaigns(campaign_id, channel)». Credit each order to the
      last ad click of the user in the seven days before it, and report orders and revenue per
      channel. Orders with no click are direct.
    `,
    hints: [
      'One order, many clicks: pick exactly one.',
      'Window edges: a click after the order does not count. Is exactly seven days in or out?',
      'A click on a deleted campaign is still the last click.',
    ],
    answer: `
      Pick **one** click per order with a lateral subquery, then aggregate. A plain join credits
      every click in the window, so revenue is counted several times.

      ~~~sql
      WITH credited AS (
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
      ~~~

      State the edges: the window is «(ordered_at − 7 days, ordered_at]», and ties go to the higher
      click id so the result never depends on the plan. Choose the click first and look up its
      campaign after: if you join campaigns inside the pick, a deleted campaign silently hands the
      order to an older click. Say which model the business uses; last click is simple, and it
      under-credits the channels that start a journey.
    `,
    signals: [
      'Picks exactly one click per order with a deterministic tie-break',
      'States the window edges and tests them',
      'Keeps orders with no click as direct',
      'Joins campaigns after choosing the click',
      'Names the limits of last-click attribution',
    ],
    followUps: [
      'Marketing wants linear attribution across all clicks in the window. Change the query.',
      'Clicks arrive up to two days late. When is yesterday’s attribution final?',
    ],
  },
  {
    slug: 'driver-payout-reconciliation',
    title: 'Reconcile driver payouts with trips',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['uber', 'swiggy', 'phonepe', 'amazon'],
    prompt: `
      Tables «trips(trip_id, driver_id, fare, status)» and «payout_lines(line_id, trip_id,
      amount)». Each completed trip should be paid once, 80% of the fare rounded to cents. Find
      every problem: missing payouts, duplicates, wrong amounts, payouts for trips that were not
      completed, and payouts for trips that do not exist.
    `,
    hints: [
      'Problems exist on both sides: trips with no line, and lines with no trip.',
      'Aggregate the lines per trip before you compare.',
      'Decide an order for the checks, so each trip gets one issue.',
    ],
    answer: `
      Aggregate lines per trip, **full outer join** to trips so both kinds of orphan appear, then
      classify each trip with one ordered «CASE».

      ~~~sql
      WITH lines AS (
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
      ~~~

      Aggregating first means a duplicate is found by count, even when the two halves add up to
      the right total. Round the expected amount the same way the payout system does, or every
      fare with a third decimal shows as a mismatch. In production, run this daily, write the
      issues to a table with the run date, and alert on the count by issue type.
    `,
    signals: [
      'Uses a full outer join so orphans on both sides appear',
      'Aggregates lines per trip before comparing',
      'Classifies with one ordered CASE so each trip has one issue',
      'Rounds the expected amount like the source system',
      'Turns the query into a daily control with alerts',
    ],
    followUps: [
      'There are 2 billion trips. How do you reconcile only what changed?',
      'Finance wants the total money at risk per issue type each day. Add it.',
    ],
  },
];
