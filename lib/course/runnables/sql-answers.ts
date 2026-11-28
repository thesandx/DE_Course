import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/** Other answers for the SQL track's runnable problems. See `test-answers.ts`. */
export const SQL_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'driver-longest-streak': {
    pass: [
      `WITH days AS (
  SELECT DISTINCT driver_id, online_at::date AS day FROM driver_sessions
), g AS (
  SELECT driver_id, day, day - (ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY day))::int AS grp FROM days
), runs AS (
  SELECT driver_id, MIN(day) AS start_day, MAX(day) AS end_day, COUNT(*) AS length FROM g GROUP BY 1, grp
)
SELECT DISTINCT ON (driver_id) driver_id, start_day, end_day, length
FROM runs ORDER BY driver_id, length DESC, end_day DESC;`,
    ],
    fail: [
      // Counts sessions, not distinct days, so two sessions on one day break the run.
      `WITH g AS (
  SELECT driver_id, online_at::date AS day,
         online_at::date - (ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY online_at))::int AS grp
  FROM driver_sessions
), runs AS (
  SELECT driver_id, MIN(day) AS start_day, MAX(day) AS end_day, COUNT(*) AS length FROM g GROUP BY 1, grp
)
SELECT DISTINCT ON (driver_id) driver_id, start_day, end_day, length
FROM runs ORDER BY driver_id, length DESC, end_day DESC;`,
      // Breaks ties toward the earlier run.
      `WITH days AS (
  SELECT DISTINCT driver_id, online_at::date AS day FROM driver_sessions
), g AS (
  SELECT driver_id, day, day - (ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY day))::int AS grp FROM days
), runs AS (
  SELECT driver_id, MIN(day) AS start_day, MAX(day) AS end_day, COUNT(*) AS length FROM g GROUP BY 1, grp
)
SELECT DISTINCT ON (driver_id) driver_id, start_day, end_day, length
FROM runs ORDER BY driver_id, length DESC, end_day ASC;`,
    ],
  },
  'month-over-month-revenue': {
    pass: [
      `SELECT city_id, month, revenue,
       ROUND((revenue / NULLIF(prev, 0) - 1) * 100, 2) AS growth_pct
FROM (
  SELECT city_id, DATE_TRUNC('month', paid_at)::date AS month, SUM(amount_usd) AS revenue,
         LAG(SUM(amount_usd)) OVER (PARTITION BY city_id ORDER BY DATE_TRUNC('month', paid_at)) AS prev
  FROM payments
  GROUP BY city_id, DATE_TRUNC('month', paid_at)
) t;`,
    ],
    fail: [
      // LAG without PARTITION BY compares a city's first month with another city.
      `WITH monthly AS (
  SELECT city_id, DATE_TRUNC('month', paid_at) AS month, SUM(amount_usd) AS revenue
  FROM payments GROUP BY 1, 2
)
SELECT city_id, month, revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY city_id, month))
             / NULLIF(LAG(revenue) OVER (ORDER BY city_id, month), 0), 2) AS growth_pct
FROM monthly;`,
      // No NULLIF: a month after a zero month divides by zero.
      `WITH monthly AS (
  SELECT city_id, DATE_TRUNC('month', paid_at) AS month, SUM(amount_usd) AS revenue
  FROM payments GROUP BY 1, 2
)
SELECT city_id, month, revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER w) / LAG(revenue) OVER w, 2) AS growth_pct
FROM monthly WINDOW w AS (PARTITION BY city_id ORDER BY month);`,
      // Compares with the previous calendar month, not the previous month with data.
      `WITH monthly AS (
  SELECT city_id, DATE_TRUNC('month', paid_at) AS month, SUM(amount_usd) AS revenue
  FROM payments GROUP BY 1, 2
)
SELECT m.city_id, m.month, m.revenue,
       ROUND(100.0 * (m.revenue - p.revenue) / NULLIF(p.revenue, 0), 2) AS growth_pct
FROM monthly m
LEFT JOIN monthly p ON p.city_id = m.city_id AND p.month = m.month - INTERVAL '1 month';`,
    ],
  },
  'latest-trip-status': {
    pass: [
      `SELECT DISTINCT ON (trip_id) trip_id, status, event_ts
FROM trip_events
ORDER BY trip_id, event_ts DESC, kafka_offset DESC;`,
    ],
    fail: [
      // Joins back on the max timestamp: a tie or a retry returns two rows.
      `SELECT e.trip_id, e.status, e.event_ts
FROM trip_events e
JOIN (SELECT trip_id, MAX(event_ts) AS ts FROM trip_events GROUP BY trip_id) m
  ON m.trip_id = e.trip_id AND m.ts = e.event_ts;`,
      // Trusts arrival order: a late event wins.
      `SELECT DISTINCT ON (trip_id) trip_id, status, event_ts
FROM trip_events
ORDER BY trip_id, kafka_offset DESC;`,
    ],
  },
  'not-in-null-trap': {
    pass: [
      `SELECT r.rider_id
FROM riders r
LEFT JOIN cancellations c ON c.rider_id = r.rider_id
WHERE c.cancellation_id IS NULL;`,
      `SELECT rider_id FROM riders
WHERE rider_id NOT IN (SELECT rider_id FROM cancellations WHERE rider_id IS NOT NULL);`,
    ],
    fail: [
      // The IS NULL test sits in the ON clause, so every rider survives the left join.
      `SELECT r.rider_id
FROM riders r
LEFT JOIN cancellations c ON c.rider_id = r.rider_id AND c.rider_id IS NULL;`,
    ],
  },
  'sessionize-app-events': {
    pass: [
      `WITH flagged AS (
  SELECT user_id, event_time,
         CASE WHEN EXTRACT(EPOCH FROM event_time - LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time)) <= 1800
              THEN 0 ELSE 1 END AS starts
  FROM app_events
), sessions AS (
  SELECT user_id, event_time,
         SUM(starts) OVER (PARTITION BY user_id ORDER BY event_time, starts DESC ROWS UNBOUNDED PRECEDING) AS session_id
  FROM flagged
)
SELECT user_id, session_id, MIN(event_time), MAX(event_time), COUNT(*),
       EXTRACT(EPOCH FROM MAX(event_time) - MIN(event_time))
FROM sessions
GROUP BY 1, 2;`,
    ],
    fail: [
      // "Less than 30 minutes" splits a session at exactly 30.
      `WITH gaps AS (
  SELECT user_id, event_time,
         CASE WHEN event_time - LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time)
                   < INTERVAL '30 minutes' THEN 0 ELSE 1 END AS new_session
  FROM app_events
), numbered AS (
  SELECT user_id, event_time, SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_time) AS session_id
  FROM gaps
)
SELECT user_id, session_id, MIN(event_time), MAX(event_time), COUNT(*),
       EXTRACT(EPOCH FROM MAX(event_time) - MIN(event_time))
FROM numbered GROUP BY 1, 2;`,
      // LAG across users: one user's events continue another user's session.
      `WITH gaps AS (
  SELECT user_id, event_time,
         CASE WHEN event_time - LAG(event_time) OVER (ORDER BY event_time)
                   <= INTERVAL '30 minutes' THEN 0 ELSE 1 END AS new_session
  FROM app_events
), numbered AS (
  SELECT user_id, event_time, SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_time) AS session_id
  FROM gaps
)
SELECT user_id, session_id, MIN(event_time), MAX(event_time), COUNT(*),
       EXTRACT(EPOCH FROM MAX(event_time) - MIN(event_time))
FROM numbered GROUP BY 1, 2;`,
    ],
  },
  'top-videos-with-ties': {
    pass: [
      `SELECT day, category, video_id, views
FROM (
  SELECT viewed_at::date AS day, category, video_id, COUNT(DISTINCT view_id) AS views,
         RANK() OVER (PARTITION BY viewed_at::date, category ORDER BY COUNT(DISTINCT view_id) DESC) AS r
  FROM video_views
  GROUP BY 1, 2, 3
) t
WHERE r <= 3;`,
    ],
    fail: [
      // DENSE_RANK keeps every video with one of the three highest counts.
      `SELECT day, category, video_id, views
FROM (
  SELECT viewed_at::date AS day, category, video_id, COUNT(DISTINCT view_id) AS views,
         DENSE_RANK() OVER (PARTITION BY viewed_at::date, category ORDER BY COUNT(DISTINCT view_id) DESC) AS r
  FROM video_views GROUP BY 1, 2, 3
) t WHERE r <= 3;`,
      // ROW_NUMBER drops a video tied at third.
      `SELECT day, category, video_id, views
FROM (
  SELECT viewed_at::date AS day, category, video_id, COUNT(DISTINCT view_id) AS views,
         ROW_NUMBER() OVER (PARTITION BY viewed_at::date, category ORDER BY COUNT(DISTINCT view_id) DESC) AS r
  FROM video_views GROUP BY 1, 2, 3
) t WHERE r <= 3;`,
      // COUNT(*) counts the repeated rows.
      `SELECT day, category, video_id, views
FROM (
  SELECT viewed_at::date AS day, category, video_id, COUNT(*) AS views,
         RANK() OVER (PARTITION BY viewed_at::date, category ORDER BY COUNT(*) DESC) AS r
  FROM video_views GROUP BY 1, 2, 3
) t WHERE r <= 3;`,
    ],
  },
  'trip-funnel-by-city': {
    pass: [
      `WITH t AS (
  SELECT trip_id, city_id,
         MIN(event_ts) FILTER (WHERE status = 'requested') AS r,
         MIN(event_ts) FILTER (WHERE status = 'accepted') AS a,
         MIN(event_ts) FILTER (WHERE status = 'picked_up') AS p,
         MIN(event_ts) FILTER (WHERE status = 'completed') AS c
  FROM trip_events
  GROUP BY 1, 2
)
SELECT city_id, COUNT(*) AS requested,
       ROUND(COUNT(*) FILTER (WHERE a > r)::numeric / COUNT(*), 4),
       ROUND(COUNT(*) FILTER (WHERE a > r AND p > a)::numeric / COUNT(*), 4),
       ROUND(COUNT(*) FILTER (WHERE a > r AND p > a AND c > p)::numeric / COUNT(*), 4)
FROM t
WHERE r >= '2024-06-03' AND r < '2024-06-10'
GROUP BY city_id;`,
    ],
    fail: [
      // Filters every event to the week, so a trip completed on Monday loses its last stages.
      `WITH per_trip AS (
  SELECT trip_id, city_id,
         MIN(CASE WHEN status = 'requested' THEN event_ts END) AS t_req,
         MIN(CASE WHEN status = 'accepted' THEN event_ts END) AS t_acc,
         MIN(CASE WHEN status = 'picked_up' THEN event_ts END) AS t_pick,
         MIN(CASE WHEN status = 'completed' THEN event_ts END) AS t_done
  FROM trip_events
  WHERE event_ts >= '2024-06-03' AND event_ts < '2024-06-10'
  GROUP BY trip_id, city_id
)
SELECT city_id, COUNT(t_req) AS requested,
       ROUND(AVG(CASE WHEN t_acc > t_req THEN 1.0 ELSE 0 END), 4),
       ROUND(AVG(CASE WHEN t_pick > t_acc AND t_acc > t_req THEN 1.0 ELSE 0 END), 4),
       ROUND(AVG(CASE WHEN t_done > t_pick AND t_pick > t_acc AND t_acc > t_req THEN 1.0 ELSE 0 END), 4)
FROM per_trip WHERE t_req IS NOT NULL GROUP BY city_id;`,
      // Counts a stage that happened before the stage it should follow.
      `WITH t AS (
  SELECT trip_id, city_id,
         MIN(event_ts) FILTER (WHERE status = 'requested') AS r,
         BOOL_OR(status = 'accepted') AS a,
         BOOL_OR(status = 'picked_up') AS p,
         BOOL_OR(status = 'completed') AS c
  FROM trip_events GROUP BY 1, 2
)
SELECT city_id, COUNT(*),
       ROUND(AVG(CASE WHEN a THEN 1.0 ELSE 0 END), 4),
       ROUND(AVG(CASE WHEN p THEN 1.0 ELSE 0 END), 4),
       ROUND(AVG(CASE WHEN c THEN 1.0 ELSE 0 END), 4)
FROM t WHERE r >= '2024-06-03' AND r < '2024-06-10' GROUP BY city_id;`,
    ],
  },
  'median-trip-duration': {
    pass: [
      `SELECT city_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_s) AS median_s
FROM trips
WHERE duration_s IS NOT NULL
GROUP BY city_id;`,
      `SELECT city_id, AVG(duration_s) AS median_s
FROM (
  SELECT city_id, duration_s,
         ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY duration_s) AS rn,
         COUNT(*) OVER (PARTITION BY city_id) AS n
  FROM trips WHERE duration_s IS NOT NULL
) a
WHERE 2 * rn BETWEEN n AND n + 2
GROUP BY city_id;`,
    ],
    fail: [
      // Integer division takes only the lower middle value for an even count.
      `WITH o AS (
  SELECT city_id, duration_s,
         ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY duration_s) AS rn,
         COUNT(*) OVER (PARTITION BY city_id) AS n
  FROM trips WHERE duration_s IS NOT NULL
)
SELECT city_id, AVG(duration_s) FROM o WHERE rn = (n + 1) / 2 GROUP BY city_id;`,
      // Keeps NULL durations, so a city with none still gets a row.
      `WITH o AS (
  SELECT city_id, duration_s,
         ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY duration_s) AS rn,
         COUNT(*) OVER (PARTITION BY city_id) AS n
  FROM trips
)
SELECT city_id, AVG(duration_s) FROM o
WHERE rn IN (FLOOR((n + 1) / 2.0), FLOOR((n + 2) / 2.0)) GROUP BY city_id;`,
    ],
  },
  'weekly-retention-cohorts': {
    pass: [
      `WITH c AS (
  SELECT user_id, DATE_TRUNC('week', signup_at)::date AS cw FROM users
), g AS (
  SELECT cw, w, COUNT(*) AS size FROM c, generate_series(0, 8) AS w GROUP BY cw, w
)
SELECT g.cw AS cohort_week, g.w AS week_number,
       COUNT(DISTINCT s.user_id) AS active_users,
       ROUND(COUNT(DISTINCT s.user_id)::numeric / g.size, 4) AS retention
FROM g
LEFT JOIN c ON c.cw = g.cw
LEFT JOIN sessions s
  ON s.user_id = c.user_id AND DATE_TRUNC('week', s.started_at)::date = g.cw + 7 * g.w
WHERE g.cw + 7 * g.w <= DATE '2024-03-20'
GROUP BY g.cw, g.w, g.size;`,
    ],
    fail: [
      // No grid: weeks with no activity are missing instead of 0.
      `WITH c AS (
  SELECT user_id, DATE_TRUNC('week', signup_at)::date AS cw FROM users
), sizes AS (SELECT cw, COUNT(*) AS size FROM c GROUP BY cw)
SELECT c.cw, (DATE_TRUNC('week', s.started_at)::date - c.cw) / 7 AS w,
       COUNT(DISTINCT s.user_id),
       ROUND(COUNT(DISTINCT s.user_id)::numeric / MAX(sizes.size), 4)
FROM c JOIN sessions s ON s.user_id = c.user_id AND s.started_at >= c.cw
JOIN sizes ON sizes.cw = c.cw
WHERE (DATE_TRUNC('week', s.started_at)::date - c.cw) / 7 <= 8
GROUP BY 1, 2;`,
      // Keeps weeks that have not started yet.
      `WITH c AS (
  SELECT user_id, DATE_TRUNC('week', signup_at)::date AS cw FROM users
), g AS (
  SELECT cw, w, COUNT(*) AS size FROM c, generate_series(0, 8) AS w GROUP BY cw, w
)
SELECT g.cw, g.w, COUNT(DISTINCT s.user_id),
       ROUND(COUNT(DISTINCT s.user_id)::numeric / g.size, 4)
FROM g
LEFT JOIN c ON c.cw = g.cw
LEFT JOIN sessions s
  ON s.user_id = c.user_id AND DATE_TRUNC('week', s.started_at)::date = g.cw + 7 * g.w
GROUP BY g.cw, g.w, g.size;`,
    ],
  },
  'ad-clicks-dedup-ctr': {
    pass: [
      `WITH flagged AS (
  SELECT i.imp_id, i.ad_id, i.ts::date AS day,
         EXISTS (
           SELECT 1 FROM clicks c
           WHERE c.imp_id = i.imp_id AND c.ts BETWEEN i.ts AND i.ts + INTERVAL '30 minutes'
         ) AS clicked
  FROM impressions i
)
SELECT day, ad_id, COUNT(*), COUNT(*) FILTER (WHERE clicked),
       ROUND(AVG(CASE WHEN clicked THEN 1.0 ELSE 0 END), 4)
FROM flagged GROUP BY day, ad_id;`,
    ],
    fail: [
      // Credits a click to the day it happened, not the impression's day.
      `WITH valid AS (
  SELECT DISTINCT c.imp_id, c.ts::date AS click_day FROM clicks c
  JOIN impressions i ON i.imp_id = c.imp_id
  WHERE c.ts >= i.ts AND c.ts <= i.ts + INTERVAL '30 minutes'
), days AS (
  SELECT i.ts::date AS day, i.ad_id, COUNT(*) AS impressions FROM impressions i GROUP BY 1, 2
)
SELECT d.day, d.ad_id, d.impressions,
       (SELECT COUNT(*) FROM valid v JOIN impressions i ON i.imp_id = v.imp_id
        WHERE i.ad_id = d.ad_id AND v.click_day = d.day),
       ROUND((SELECT COUNT(*) FROM valid v JOIN impressions i ON i.imp_id = v.imp_id
        WHERE i.ad_id = d.ad_id AND v.click_day = d.day)::numeric / d.impressions, 4)
FROM days d;`,
      // "Under 30 minutes" drops a click at exactly 30.
      `WITH valid_clicks AS (
  SELECT DISTINCT c.imp_id FROM clicks c JOIN impressions i ON i.imp_id = c.imp_id
  WHERE c.ts >= i.ts AND c.ts < i.ts + INTERVAL '30 minutes'
)
SELECT i.ts::date, i.ad_id, COUNT(*), COUNT(v.imp_id), ROUND(COUNT(v.imp_id) * 1.0 / COUNT(*), 4)
FROM impressions i LEFT JOIN valid_clicks v ON v.imp_id = i.imp_id GROUP BY 1, 2;`,
    ],
  },
  'org-chart-span-of-control': {
    pass: [
      `WITH RECURSIVE sub AS (
  SELECT employee_id AS root, employee_id, 0 AS depth FROM employees
  UNION ALL
  SELECT s.root, e.employee_id, s.depth + 1
  FROM sub s JOIN employees e ON e.manager_id = s.employee_id
)
SELECT e.employee_id, e.name,
       COUNT(*) FILTER (WHERE s.depth = 1),
       COUNT(*) FILTER (WHERE s.depth > 0),
       MAX(s.depth)
FROM employees e JOIN sub s ON s.root = e.employee_id
GROUP BY 1, 2;`,
    ],
    fail: [
      // An inner join drops everyone with no reports.
      `WITH RECURSIVE reports AS (
  SELECT manager_id AS ancestor_id, employee_id, 1 AS depth FROM employees WHERE manager_id IS NOT NULL
  UNION ALL
  SELECT r.ancestor_id, e.employee_id, r.depth + 1 FROM reports r JOIN employees e ON e.manager_id = r.employee_id
)
SELECT m.employee_id, m.name, COUNT(CASE WHEN r.depth = 1 THEN 1 END), COUNT(*), MAX(r.depth)
FROM employees m JOIN reports r ON r.ancestor_id = m.employee_id
GROUP BY 1, 2;`,
      // Counts levels as people in the longest line, one too many.
      `WITH RECURSIVE sub AS (
  SELECT employee_id AS root, employee_id, 1 AS depth FROM employees
  UNION ALL
  SELECT s.root, e.employee_id, s.depth + 1 FROM sub s JOIN employees e ON e.manager_id = s.employee_id
)
SELECT e.employee_id, e.name, COUNT(*) FILTER (WHERE s.depth = 2), COUNT(*) - 1, MAX(s.depth)
FROM employees e JOIN sub s ON s.root = e.employee_id GROUP BY 1, 2;`,
    ],
  },
  'regional-subtotals-report': {
    pass: [
      `WITH base AS (
  SELECT region, COALESCE(city, 'unknown') AS city, fare FROM trips
), report AS (
  SELECT region, city, SUM(fare) AS revenue FROM base GROUP BY 1, 2
  UNION ALL
  SELECT region, 'ALL', SUM(fare) FROM base GROUP BY 1
  UNION ALL
  SELECT 'TOTAL', 'ALL', SUM(fare) FROM base
)
SELECT r.region, r.city, r.revenue,
       ROUND(100.0 * r.revenue / (SELECT SUM(fare) FROM trips), 1) AS pct_of_total,
       ROUND(100.0 * r.revenue / CASE WHEN r.region = 'TOTAL' THEN r.revenue
                                      ELSE (SELECT SUM(fare) FROM trips t WHERE t.region = r.region) END, 1)
         AS pct_of_region
FROM report r;`,
    ],
    fail: [
      // COALESCE cannot tell a NULL city from a subtotal row.
      `WITH rolled AS (
  SELECT COALESCE(region, 'TOTAL') AS region, COALESCE(city, 'ALL') AS city, SUM(fare) AS revenue
  FROM trips GROUP BY ROLLUP (region, city)
)
SELECT region, city, revenue,
       ROUND(100.0 * revenue / (SELECT SUM(fare) FROM trips), 1),
       ROUND(100.0 * revenue / MAX(CASE WHEN city = 'ALL' THEN revenue END) OVER (PARTITION BY region), 1)
FROM rolled;`,
    ],
  },
  'referral-chain-root': {
    pass: [
      `WITH RECURSIVE walk AS (
  SELECT user_id, user_id AS at, 0 AS hops, ARRAY[user_id] AS seen FROM referrals
  UNION ALL
  SELECT w.user_id, r.referred_by, w.hops + 1, w.seen || r.referred_by
  FROM walk w JOIN referrals r ON r.user_id = w.at
  WHERE r.referred_by IS NOT NULL AND r.referred_by <> ALL (w.seen)
)
SELECT DISTINCT ON (w.user_id) w.user_id, w.at AS root_user, w.hops AS chain_length,
       r.referred_by IS NOT NULL AS stopped_early
FROM walk w JOIN referrals r ON r.user_id = w.at
ORDER BY w.user_id, w.hops DESC;`,
    ],
    fail: [
      // A depth cap without a cycle check walks round the loop until the cap.
      `WITH RECURSIVE walk AS (
  SELECT user_id, user_id AS at, 0 AS hops FROM referrals
  UNION ALL
  SELECT w.user_id, r.referred_by, w.hops + 1
  FROM walk w JOIN referrals r ON r.user_id = w.at
  WHERE r.referred_by IS NOT NULL AND w.hops < 20
)
SELECT DISTINCT ON (w.user_id) w.user_id, w.at, w.hops, r.referred_by IS NOT NULL
FROM walk w JOIN referrals r ON r.user_id = w.at
ORDER BY w.user_id, w.hops DESC;`,
    ],
  },
};
