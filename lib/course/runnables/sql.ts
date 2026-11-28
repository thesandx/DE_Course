import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the SQL track's problems. Each runs on PostgreSQL 18 in
 * the browser. See `lib/course/README.md` > Runnable problems.
 */
const PAYMENT_COLUMNS = [
  { name: 'payment_id', type: 'int' },
  { name: 'city_id', type: 'int' },
  { name: 'amount_usd', type: 'numeric(10,2)' },
  { name: 'paid_at', type: 'timestamp' },
] as const;

const TRIP_EVENT_COLUMNS = [
  { name: 'trip_id', type: 'text' },
  { name: 'status', type: 'text' },
  { name: 'event_ts', type: 'timestamp' },
  { name: 'kafka_offset', type: 'bigint' },
] as const;

const CANCELLATION_COLUMNS = [
  { name: 'cancellation_id', type: 'int' },
  { name: 'rider_id', type: 'int' },
] as const;

const APP_EVENT_COLUMNS = [
  { name: 'user_id', type: 'int' },
  { name: 'event_time', type: 'timestamp' },
  { name: 'event_name', type: 'text' },
] as const;

const VIDEO_VIEW_COLUMNS = [
  { name: 'view_id', type: 'int' },
  { name: 'video_id', type: 'text' },
  { name: 'category', type: 'text' },
  { name: 'viewed_at', type: 'timestamp' },
] as const;

const FUNNEL_COLUMNS = [
  { name: 'trip_id', type: 'text' },
  { name: 'city_id', type: 'int' },
  { name: 'status', type: 'text' },
  { name: 'event_ts', type: 'timestamp' },
] as const;

const DURATION_COLUMNS = [
  { name: 'trip_id', type: 'int' },
  { name: 'city_id', type: 'int' },
  { name: 'duration_s', type: 'int' },
] as const;

const SESSION_COLUMNS = [
  { name: 'user_id', type: 'int' },
  { name: 'started_at', type: 'timestamp' },
] as const;

const IMPRESSION_COLUMNS = [
  { name: 'imp_id', type: 'int' },
  { name: 'ad_id', type: 'text' },
  { name: 'user_id', type: 'int' },
  { name: 'ts', type: 'timestamp' },
] as const;

const CLICK_COLUMNS = [
  { name: 'click_id', type: 'int' },
  { name: 'imp_id', type: 'int' },
  { name: 'ts', type: 'timestamp' },
] as const;

const EMPLOYEE_COLUMNS = [
  { name: 'employee_id', type: 'int' },
  { name: 'name', type: 'text' },
  { name: 'manager_id', type: 'int' },
] as const;

const REGION_TRIP_COLUMNS = [
  { name: 'trip_id', type: 'int' },
  { name: 'region', type: 'text' },
  { name: 'city', type: 'text' },
  { name: 'fare', type: 'numeric(10,2)' },
] as const;

const REFERRAL_COLUMNS = [
  { name: 'user_id', type: 'int' },
  { name: 'referred_by', type: 'int' },
] as const;

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
  'month-over-month-revenue': {
    language: 'sql',
    task: `Return «city_id, month, revenue, growth_pct»: one row per city and calendar month that has payments. «month» is the first day of the month. «revenue» is the sum of «amount_usd». «growth_pct» compares «revenue» with the city's previous month that has payments: «100 × (revenue − previous) / previous», rounded to 2 decimal places. It is NULL for a city's first month and when the previous revenue is 0. Row order does not matter.`,
    tables: [
      {
        name: 'payments',
        columns: PAYMENT_COLUMNS,
        rows: [
          [1, 1, 100.0, '2024-01-05 10:00:00'],
          [2, 1, 50.0, '2024-01-31 23:59:59'],
          [3, 1, 200.0, '2024-02-01 00:00:00'],
          [4, 1, 120.0, '2024-03-15 09:30:00'],
          [5, 2, 80.0, '2024-01-10 12:00:00'],
          [6, 2, 100.0, '2024-03-02 08:00:00'],
          [7, 2, 30.0, '2024-03-20 19:45:00'],
        ],
      },
    ],
    starter: `-- payments(payment_id, city_id, amount_usd, paid_at)
-- Return city_id, month, revenue, growth_pct.
SELECT city_id,
       DATE_TRUNC('month', paid_at) AS month,
       SUM(amount_usd) AS revenue,
       NULL AS growth_pct
FROM payments
GROUP BY 1, 2;
`,
    solution: `WITH monthly AS (
  SELECT city_id, DATE_TRUNC('month', paid_at) AS month, SUM(amount_usd) AS revenue
  FROM payments
  GROUP BY 1, 2
)
SELECT city_id,
       month,
       revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER w) / NULLIF(LAG(revenue) OVER w, 0), 2) AS growth_pct
FROM monthly
WINDOW w AS (PARTITION BY city_id ORDER BY month);
`,
    cases: [
      {
        name: 'Sample',
        note: 'City 2 has no payments in February, so March compares with January.',
      },
      {
        name: 'A month that nets to zero',
        note: 'A refund cancels January for city 3. February has no growth value, not an error.',
        tables: [
          {
            name: 'payments',
            columns: PAYMENT_COLUMNS,
            rows: [
              [1, 3, 50.0, '2024-01-03 10:00:00'],
              [2, 3, -50.0, '2024-01-09 16:00:00'],
              [3, 3, 70.0, '2024-02-11 11:00:00'],
              [4, 3, 35.0, '2024-03-08 13:00:00'],
              [5, 4, 42.5, '2024-03-30 08:00:00'],
            ],
          },
        ],
      },
      {
        name: 'Forty cities over eighteen months',
        hidden: true,
        note: 'Every city skips some months.',
        setup: `TRUNCATE payments;
INSERT INTO payments
SELECT ROW_NUMBER() OVER (), c, ((c * 37 + m * 11 + k * 7) % 90 + 10)::numeric(10, 2),
       TIMESTAMP '2023-01-01' + m * INTERVAL '1 month' + ((c + k * 5) % 27) * INTERVAL '1 day' + k * INTERVAL '1 hour'
FROM generate_series(1, 40) AS c, generate_series(0, 17) AS m, generate_series(0, 3) AS k
WHERE (c + m) % 7 <> 0;`,
      },
    ],
  },
  'latest-trip-status': {
    language: 'sql',
    task: `Return «trip_id, status, event_ts»: one row per trip, from its latest event. The latest event has the largest «event_ts». When two events share «event_ts», the one with the larger «kafka_offset» is later. Client retries repeat some rows exactly. Row order does not matter.`,
    tables: [
      {
        name: 'trip_events',
        columns: TRIP_EVENT_COLUMNS,
        rows: [
          ['t1', 'requested', '2024-05-01 08:00:00', 10],
          ['t1', 'accepted', '2024-05-01 08:01:00', 14],
          ['t1', 'accepted', '2024-05-01 08:01:00', 14],
          ['t1', 'completed', '2024-05-01 08:25:00', 31],
          ['t2', 'requested', '2024-05-01 09:00:00', 20],
          ['t2', 'cancelled', '2024-05-01 09:03:00', 22],
          ['t3', 'requested', '2024-05-01 09:10:00', 23],
          ['t3', 'accepted', '2024-05-01 09:12:00', 24],
          ['t3', 'cancelled', '2024-05-01 09:12:00', 27],
        ],
      },
    ],
    starter: `-- trip_events(trip_id, status, event_ts, kafka_offset)
-- Return trip_id, status, event_ts: the current status of every trip.
SELECT trip_id, status, event_ts
FROM trip_events;
`,
    solution: `SELECT trip_id, status, event_ts
FROM (
  SELECT trip_id, status, event_ts,
         ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY event_ts DESC, kafka_offset DESC) AS rn
  FROM trip_events
) t
WHERE rn = 1;
`,
    cases: [
      { name: 'Sample', note: 't3 has two events at 09:12. The larger offset wins.' },
      {
        name: 'A late arrival',
        note: 'The picked_up event arrived last (largest offset) but happened before completed.',
        tables: [
          {
            name: 'trip_events',
            columns: TRIP_EVENT_COLUMNS,
            rows: [
              ['t4', 'requested', '2024-05-02 10:00:00', 40],
              ['t4', 'accepted', '2024-05-02 10:02:00', 41],
              ['t4', 'completed', '2024-05-02 10:30:00', 43],
              ['t4', 'picked_up', '2024-05-02 10:10:00', 50],
              ['t5', 'requested', '2024-05-02 11:00:00', 44],
            ],
          },
        ],
      },
      {
        name: 'Three thousand trips with retries',
        hidden: true,
        note: 'Ties on the timestamp, and whole trips sent twice.',
        setup: `TRUNCATE trip_events;
INSERT INTO trip_events
SELECT 't' || t, s.status,
       TIMESTAMP '2024-05-01' + t * INTERVAL '1 minute' + s.step * INTERVAL '4 minutes'
         - CASE WHEN s.step = 3 AND t % 5 = 0 THEN INTERVAL '4 minutes' ELSE INTERVAL '0 minutes' END,
       t * 10 + s.step + CASE WHEN t % 7 = 0 THEN 100000 ELSE 0 END
FROM generate_series(1, 3000) AS t,
     (VALUES (0, 'requested'), (1, 'accepted'), (2, 'picked_up'), (3, 'completed')) AS s(step, status)
WHERE s.step <= t % 4 OR t % 3 = 0;
INSERT INTO trip_events SELECT * FROM trip_events WHERE trip_id LIKE '%7';`,
      },
    ],
  },
  'not-in-null-trap': {
    language: 'sql',
    task: `Return «rider_id» for every rider with no row in «cancellations». Guest checkouts leave «cancellations.rider_id» NULL. Row order does not matter.`,
    tables: [
      {
        name: 'riders',
        columns: [
          { name: 'rider_id', type: 'int' },
          { name: 'name', type: 'text' },
        ],
        rows: [
          [1, 'Asha'],
          [2, 'Ben'],
          [3, 'Cara'],
          [4, 'Dev'],
          [5, 'Eli'],
          [6, 'Fay'],
        ],
      },
      {
        name: 'cancellations',
        columns: CANCELLATION_COLUMNS,
        rows: [
          [1, 2],
          [2, null],
          [3, 5],
          [4, 2],
        ],
      },
    ],
    starter: `-- A teammate wrote this, and it returns zero rows.
SELECT rider_id FROM riders
WHERE rider_id NOT IN (SELECT rider_id FROM cancellations);
`,
    solution: `SELECT r.rider_id
FROM riders r
WHERE NOT EXISTS (
  SELECT 1 FROM cancellations c WHERE c.rider_id = r.rider_id
);
`,
    cases: [
      { name: 'Sample', note: 'Cancellation 2 is a guest checkout with no rider.' },
      {
        name: 'Nobody cancelled',
        note: 'An empty «cancellations» table: every rider qualifies.',
        tables: [{ name: 'cancellations', columns: CANCELLATION_COLUMNS, rows: [] }],
      },
      {
        name: 'Five thousand riders',
        hidden: true,
        note: 'Riders who cancelled twice, and many guest checkouts.',
        setup: `TRUNCATE riders, cancellations;
INSERT INTO riders SELECT n, 'rider ' || n FROM generate_series(1, 5000) AS n;
INSERT INTO cancellations
SELECT n, CASE WHEN n % 9 = 0 THEN NULL ELSE (n * 7919) % 6000 END
FROM generate_series(1, 3000) AS n;`,
      },
    ],
  },
  'sessionize-app-events': {
    language: 'sql',
    task: `Return «user_id, session_id, session_start, session_end, events, duration_s»: one row per session. A user's events stay in one session while each gap to the previous event is at most 30 minutes; a longer gap starts a new session. «session_id» numbers each user's sessions 1, 2, 3 in time order. «events» counts the session's events. «duration_s» is the seconds from the first to the last event, so a one-event session has 0. Row order does not matter.`,
    tables: [
      {
        name: 'app_events',
        columns: APP_EVENT_COLUMNS,
        rows: [
          [1, '2024-04-01 09:00:00', 'app_open'],
          [1, '2024-04-01 09:10:00', 'search'],
          [1, '2024-04-01 09:40:00', 'book'],
          [1, '2024-04-01 10:20:00', 'app_open'],
          [1, '2024-04-01 10:21:30', 'search'],
          [2, '2024-04-01 12:00:00', 'app_open'],
          [2, '2024-04-01 12:30:01', 'search'],
          [3, '2024-04-01 23:50:00', 'app_open'],
          [3, '2024-04-02 00:15:00', 'book'],
        ],
      },
    ],
    starter: `-- app_events(user_id, event_time, event_name)
-- Return user_id, session_id, session_start, session_end, events, duration_s.
SELECT user_id,
       1 AS session_id,
       MIN(event_time) AS session_start,
       MAX(event_time) AS session_end,
       COUNT(*) AS events,
       0 AS duration_s
FROM app_events
GROUP BY user_id;
`,
    solution: `WITH gaps AS (
  SELECT user_id, event_time,
         CASE
           WHEN event_time - LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time)
                <= INTERVAL '30 minutes' THEN 0
           ELSE 1
         END AS new_session
  FROM app_events
),
numbered AS (
  SELECT user_id, event_time,
         -- The default frame takes peers together, so two events in the
         -- same second can never land in different sessions.
         SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_time) AS session_id
  FROM gaps
)
SELECT user_id, session_id,
       MIN(event_time) AS session_start,
       MAX(event_time) AS session_end,
       COUNT(*) AS events,
       EXTRACT(EPOCH FROM MAX(event_time) - MIN(event_time)) AS duration_s
FROM numbered
GROUP BY user_id, session_id;
`,
    cases: [
      {
        name: 'Sample',
        note: 'A gap of exactly 30 minutes keeps the session. One second more starts a new one.',
      },
      {
        name: 'Events in the same second',
        note: 'Two events can share a timestamp. Both count.',
        tables: [
          {
            name: 'app_events',
            columns: APP_EVENT_COLUMNS,
            rows: [
              [8, '2024-04-03 07:00:00', 'app_open'],
              [8, '2024-04-03 07:00:00', 'push_open'],
              [8, '2024-04-03 07:29:59', 'search'],
              [8, '2024-04-03 08:30:00', 'app_open'],
            ],
          },
        ],
      },
      {
        name: 'Two hundred users',
        hidden: true,
        note: 'Sixty events each, with gaps of 10 to 70 minutes, some exactly 30.',
        setup: `TRUNCATE app_events;
INSERT INTO app_events
SELECT u,
       TIMESTAMP '2024-04-01'
         + (u * 13 + n * 20 + (n / 7) * 40 + CASE WHEN n % 5 = 0 THEN 10 ELSE 0 END) * INTERVAL '1 minute',
       'e' || (n % 5)
FROM generate_series(1, 200) AS u, generate_series(1, 60) AS n;`,
      },
    ],
  },
  'top-videos-with-ties': {
    language: 'sql',
    task: `Return «day, category, video_id, views» for the top videos of each day and category. «day» is the date of «viewed_at». «views» counts distinct «view_id»: the feed repeats some rows. Keep a video when fewer than 3 videos of its day and category have more views than it, so every video tied at third place stays. Row order does not matter.`,
    tables: [
      {
        name: 'video_views',
        columns: VIDEO_VIEW_COLUMNS,
        rows: [
          [1, 'v1', 'music', '2024-06-01 08:00:00'],
          [2, 'v1', 'music', '2024-06-01 08:05:00'],
          [3, 'v1', 'music', '2024-06-01 09:00:00'],
          [4, 'v1', 'music', '2024-06-01 12:00:00'],
          [5, 'v1', 'music', '2024-06-01 21:00:00'],
          [6, 'v2', 'music', '2024-06-01 08:10:00'],
          [7, 'v2', 'music', '2024-06-01 10:10:00'],
          [8, 'v2', 'music', '2024-06-01 11:10:00'],
          [9, 'v2', 'music', '2024-06-01 13:10:00'],
          [10, 'v3', 'music', '2024-06-01 09:30:00'],
          [11, 'v3', 'music', '2024-06-01 10:30:00'],
          [12, 'v3', 'music', '2024-06-01 11:30:00'],
          [13, 'v4', 'music', '2024-06-01 14:00:00'],
          [14, 'v4', 'music', '2024-06-01 15:00:00'],
          [15, 'v4', 'music', '2024-06-01 16:00:00'],
          [16, 'v5', 'music', '2024-06-01 17:00:00'],
          [16, 'v5', 'music', '2024-06-01 17:00:00'],
          [16, 'v5', 'music', '2024-06-01 17:00:00'],
          [17, 'n1', 'news', '2024-06-01 07:00:00'],
          [18, 'n1', 'news', '2024-06-01 07:30:00'],
          [19, 'n2', 'news', '2024-06-01 07:10:00'],
          [20, 'n2', 'news', '2024-06-01 07:40:00'],
          [21, 'n3', 'news', '2024-06-01 08:10:00'],
          [22, 'n3', 'news', '2024-06-01 08:40:00'],
          [23, 'n4', 'news', '2024-06-01 09:10:00'],
          [24, 'v1', 'music', '2024-06-02 00:05:00'],
        ],
      },
    ],
    starter: `-- video_views(view_id, video_id, category, viewed_at)
-- Return day, category, video_id, views.
SELECT CAST(viewed_at AS DATE) AS day, category, video_id, COUNT(*) AS views
FROM video_views
GROUP BY 1, 2, 3;
`,
    solution: `WITH views AS (
  SELECT DISTINCT view_id, video_id, category, CAST(viewed_at AS DATE) AS day
  FROM video_views
),
counts AS (
  SELECT day, category, video_id, COUNT(*) AS views
  FROM views
  GROUP BY 1, 2, 3
)
SELECT day, category, video_id, views
FROM (
  SELECT counts.*,
         RANK() OVER (PARTITION BY day, category ORDER BY views DESC) AS rnk
  FROM counts
) ranked
WHERE rnk <= 3;
`,
    cases: [
      {
        name: 'Sample',
        note: 'v3 and v4 tie at third place. The three news videos tie at first, so n4 is fourth.',
      },
      {
        name: 'Six thousand views over five days',
        hidden: true,
        note: 'Three categories, 23 videos and repeated rows.',
        setup: `TRUNCATE video_views;
INSERT INTO video_views
SELECT n, 'v' || ((n * 7) % 23), (ARRAY['music', 'news', 'games'])[1 + n % 3],
       TIMESTAMP '2024-06-01' + ((n * 37) % (5 * 1440)) * INTERVAL '1 minute'
FROM generate_series(1, 6000) AS n;
INSERT INTO video_views SELECT * FROM video_views WHERE view_id % 11 = 0;`,
      },
    ],
  },
  'trip-funnel-by-city': {
    language: 'sql',
    task: `Report the week of Monday 3 June 2024: from «2024-06-03 00:00» up to, but not including, «2024-06-10 00:00». A trip is in the week when its first «requested» event is; its later events count even after the week ends. Return «city_id, requested, accept_rate, pickup_rate, completion_rate» for each city with trips in the week. A stage counts only when it comes after the stage before it, in the order requested, accepted, picked_up, completed, using each status's first time. Each rate is a share of the city's requested trips, rounded to 4 decimal places. Row order does not matter.`,
    tables: [
      {
        name: 'trip_events',
        columns: FUNNEL_COLUMNS,
        rows: [
          ['t1', 1, 'requested', '2024-06-03 08:00:00'],
          ['t1', 1, 'accepted', '2024-06-03 08:01:00'],
          ['t1', 1, 'picked_up', '2024-06-03 08:10:00'],
          ['t1', 1, 'completed', '2024-06-03 08:30:00'],
          ['t2', 1, 'requested', '2024-06-04 09:00:00'],
          ['t2', 1, 'accepted', '2024-06-04 09:02:00'],
          ['t2', 1, 'cancelled', '2024-06-04 09:05:00'],
          ['t3', 1, 'requested', '2024-06-05 10:00:00'],
          ['t3', 1, 'cancelled', '2024-06-05 10:01:00'],
          ['t4', 1, 'requested', '2024-06-09 23:50:00'],
          ['t4', 1, 'accepted', '2024-06-09 23:52:00'],
          ['t4', 1, 'picked_up', '2024-06-10 00:05:00'],
          ['t4', 1, 'completed', '2024-06-10 00:40:00'],
          ['t5', 2, 'requested', '2024-06-06 12:00:00'],
          ['t5', 2, 'accepted', '2024-06-06 12:03:00'],
          ['t5', 2, 'picked_up', '2024-06-06 12:15:00'],
          ['t5', 2, 'completed', '2024-06-06 12:50:00'],
          ['t6', 2, 'requested', '2024-06-02 22:00:00'],
          ['t6', 2, 'accepted', '2024-06-03 00:01:00'],
          ['t7', 2, 'requested', '2024-06-07 18:00:00'],
          ['t7', 2, 'accepted', '2024-06-07 18:01:00'],
          ['t7', 2, 'accepted', '2024-06-07 18:09:00'],
          ['t7', 2, 'picked_up', '2024-06-07 18:20:00'],
          ['t7', 2, 'completed', '2024-06-07 18:45:00'],
          ['t8', 3, 'requested', '2024-06-10 08:00:00'],
        ],
      },
    ],
    starter: `-- trip_events(trip_id, city_id, status, event_ts)
-- Return city_id, requested, accept_rate, pickup_rate, completion_rate.
SELECT city_id,
       COUNT(DISTINCT trip_id) AS requested,
       0 AS accept_rate,
       0 AS pickup_rate,
       0 AS completion_rate
FROM trip_events
GROUP BY city_id;
`,
    solution: `WITH per_trip AS (
  SELECT trip_id, city_id,
         MIN(CASE WHEN status = 'requested' THEN event_ts END) AS t_req,
         MIN(CASE WHEN status = 'accepted' THEN event_ts END) AS t_acc,
         MIN(CASE WHEN status = 'picked_up' THEN event_ts END) AS t_pick,
         MIN(CASE WHEN status = 'completed' THEN event_ts END) AS t_done
  FROM trip_events
  GROUP BY trip_id, city_id
)
SELECT city_id,
       COUNT(*) AS requested,
       ROUND(AVG(CASE WHEN t_acc > t_req THEN 1.0 ELSE 0 END), 4) AS accept_rate,
       ROUND(AVG(CASE WHEN t_pick > t_acc AND t_acc > t_req THEN 1.0 ELSE 0 END), 4) AS pickup_rate,
       ROUND(AVG(CASE WHEN t_done > t_pick AND t_pick > t_acc AND t_acc > t_req THEN 1.0 ELSE 0 END), 4)
         AS completion_rate
FROM per_trip
WHERE t_req >= TIMESTAMP '2024-06-03 00:00:00'
  AND t_req < TIMESTAMP '2024-06-10 00:00:00'
GROUP BY city_id;
`,
    cases: [
      {
        name: 'Sample',
        note: 't4 is requested on Sunday night and completes on Monday: it still counts. t6 is requested before the week, t8 after it.',
      },
      {
        name: 'Stages out of order',
        note: 'Bad data: t9 is picked up before it is accepted. Only the accept counts.',
        tables: [
          {
            name: 'trip_events',
            columns: FUNNEL_COLUMNS,
            rows: [
              ['t9', 4, 'requested', '2024-06-05 07:00:00'],
              ['t9', 4, 'picked_up', '2024-06-05 07:05:00'],
              ['t9', 4, 'accepted', '2024-06-05 07:06:00'],
              ['t9', 4, 'completed', '2024-06-05 07:30:00'],
              ['t10', 4, 'requested', '2024-06-05 08:00:00'],
              ['t10', 4, 'accepted', '2024-06-05 08:02:00'],
              ['t10', 4, 'picked_up', '2024-06-05 08:09:00'],
              ['t10', 4, 'completed', '2024-06-05 08:31:00'],
              ['t11', 4, 'requested', '2024-06-05 09:00:00'],
            ],
          },
        ],
      },
      {
        name: 'Three weeks of trips in ten cities',
        hidden: true,
        note: 'Trips on both sides of the week boundaries.',
        setup: `TRUNCATE trip_events;
INSERT INTO trip_events
SELECT 't' || t, 1 + t % 10, s.status,
       TIMESTAMP '2024-05-27' + (t * 7) * INTERVAL '1 minute' + s.step * ((t % 9) + 2) * INTERVAL '1 minute'
FROM generate_series(1, 4300) AS t,
     (VALUES (0, 'requested'), (1, 'accepted'), (2, 'picked_up'), (3, 'completed')) AS s(step, status)
WHERE s.step <= (t * 13) % 5;`,
      },
    ],
  },
  'median-trip-duration': {
    language: 'sql',
    task: `Return «city_id, median_s»: the median «duration_s» of each city. Leave out NULL durations, and cities with no durations at all. For an even count, the median is the mean of the two middle values. Solve it with window functions: in this round, «PERCENTILE_CONT» and «MEDIAN» are off limits. Row order does not matter.`,
    tables: [
      {
        name: 'trips',
        columns: DURATION_COLUMNS,
        rows: [
          [1, 1, 600],
          [2, 1, 300],
          [3, 1, 900],
          [4, 2, 1000],
          [5, 2, 100],
          [6, 2, 400],
          [7, 2, 200],
          [8, 3, 500],
          [9, 3, null],
          [10, 4, null],
        ],
      },
    ],
    starter: `-- trips(trip_id, city_id, duration_s)
-- Return city_id, median_s.
SELECT city_id, AVG(duration_s) AS median_s
FROM trips
GROUP BY city_id;
`,
    solution: `WITH ordered AS (
  SELECT city_id, duration_s,
         ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY duration_s) AS rn,
         COUNT(*) OVER (PARTITION BY city_id) AS n
  FROM trips
  WHERE duration_s IS NOT NULL
)
SELECT city_id, AVG(duration_s) AS median_s
FROM ordered
WHERE rn IN (FLOOR((n + 1) / 2.0), FLOOR((n + 2) / 2.0))
GROUP BY city_id;
`,
    cases: [
      {
        name: 'Sample',
        note: 'City 1 has an odd count, city 2 an even one. City 4 has no durations.',
      },
      {
        name: 'Repeated values',
        note: 'Equal durations still count one by one.',
        tables: [
          {
            name: 'trips',
            columns: DURATION_COLUMNS,
            rows: [
              [1, 5, 60],
              [2, 5, 60],
              [3, 5, 60],
              [4, 5, 120],
              [5, 6, 45],
              [6, 7, 10],
              [7, 7, 10],
              [8, 7, 30],
              [9, 7, 50],
              [10, 7, 50],
              [11, 7, null],
            ],
          },
        ],
      },
      {
        name: 'Thirty cities',
        hidden: true,
        note: 'Odd and even counts, NULLs, and one city with no durations.',
        setup: `TRUNCATE trips;
INSERT INTO trips
SELECT n, 1 + n % 30,
       CASE WHEN n % 17 = 0 OR n % 30 = 29 THEN NULL ELSE (n * 7919) % 3600 END
FROM generate_series(1, 4007) AS n;`,
      },
    ],
  },
  'weekly-retention-cohorts': {
    language: 'sql',
    task: `Return «cohort_week, week_number, active_users, retention». «cohort_week» is the Monday of the week a user signed up. «week_number» runs from 0 to 8: the number of whole weeks from the cohort week to the week of a session. «active_users» counts the cohort's users with a session in that week; ignore sessions before the cohort week. «retention» is «active_users» divided by the cohort size, rounded to 4 decimal places. Every cohort shows every week from 0 to 8, with 0 when nobody came back, except weeks that start after today. Today is «2024-03-20». Row order does not matter.`,
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'user_id', type: 'int' },
          { name: 'signup_at', type: 'timestamp' },
        ],
        rows: [
          [1, '2024-01-01 09:00:00'],
          [2, '2024-01-02 18:30:00'],
          [3, '2024-01-03 07:15:00'],
          [4, '2024-01-08 10:00:00'],
          [5, '2024-01-10 12:00:00'],
          [6, '2024-03-12 20:00:00'],
        ],
      },
      {
        name: 'sessions',
        columns: SESSION_COLUMNS,
        rows: [
          [1, '2024-01-01 09:05:00'],
          [1, '2024-01-09 08:00:00'],
          [1, '2024-01-16 08:00:00'],
          [1, '2024-02-20 19:00:00'],
          [2, '2024-01-02 18:40:00'],
          [2, '2024-01-10 21:00:00'],
          [2, '2024-01-10 22:30:00'],
          [3, '2024-03-01 11:00:00'],
          [3, '2024-03-12 11:00:00'],
          [4, '2024-01-08 10:05:00'],
          [4, '2024-01-30 17:00:00'],
          [5, '2024-01-07 23:00:00'],
          [5, '2024-01-12 08:00:00'],
          [6, '2024-03-12 20:10:00'],
          [6, '2024-03-19 07:00:00'],
        ],
      },
    ],
    starter: `-- users(user_id, signup_at), sessions(user_id, started_at)
-- Return cohort_week, week_number, active_users, retention.
SELECT DATE_TRUNC('week', u.signup_at) AS cohort_week,
       0 AS week_number,
       COUNT(*) AS active_users,
       1.0 AS retention
FROM users u
GROUP BY 1;
`,
    solution: `WITH cohorts AS (
  SELECT user_id, DATE_TRUNC('week', signup_at) AS cohort_week
  FROM users
),
sizes AS (
  SELECT cohort_week, COUNT(*) AS cohort_size FROM cohorts GROUP BY 1
),
grid AS (
  SELECT s.cohort_week, w.week_number, s.cohort_size
  FROM sizes s
  CROSS JOIN generate_series(0, 8) AS w(week_number)
),
activity AS (
  SELECT c.cohort_week,
         (CAST(DATE_TRUNC('week', se.started_at) AS DATE) - CAST(c.cohort_week AS DATE)) / 7 AS week_number,
         COUNT(DISTINCT se.user_id) AS active_users
  FROM cohorts c
  JOIN sessions se ON se.user_id = c.user_id AND se.started_at >= c.cohort_week
  GROUP BY 1, 2
)
SELECT g.cohort_week,
       g.week_number,
       COALESCE(a.active_users, 0) AS active_users,
       ROUND(COALESCE(a.active_users, 0) * 1.0 / g.cohort_size, 4) AS retention
FROM grid g
LEFT JOIN activity a
  ON a.cohort_week = g.cohort_week AND a.week_number = g.week_number
WHERE g.cohort_week + g.week_number * INTERVAL '7 days' <= DATE '2024-03-20';
`,
    cases: [
      {
        name: 'Sample',
        note: 'User 5 has a session the day before their cohort week: it does not count. The March cohort has only weeks 0 and 1 so far.',
      },
      {
        name: 'A cohort that never came back',
        note: 'Users 7 and 8 never open the app again: their cohort shows weeks 0 to 8, all 0. The 12 February cohort has weeks 0 to 5 so far.',
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'user_id', type: 'int' },
              { name: 'signup_at', type: 'timestamp' },
            ],
            rows: [
              [7, '2024-01-15 09:00:00'],
              [8, '2024-01-16 09:00:00'],
              [9, '2024-02-12 09:00:00'],
            ],
          },
          {
            name: 'sessions',
            columns: SESSION_COLUMNS,
            rows: [[9, '2024-02-27 09:00:00']],
          },
        ],
      },
      {
        name: 'Three hundred users over ten weeks',
        hidden: true,
        note: 'Many cohorts, repeat sessions, and cohorts near today.',
        setup: `TRUNCATE users, sessions;
INSERT INTO users
SELECT n, TIMESTAMP '2024-01-08' + ((n * 37) % 70) * INTERVAL '1 day' + (n % 24) * INTERVAL '1 hour'
FROM generate_series(1, 300) AS n;
INSERT INTO sessions
SELECT u.user_id, u.signup_at + ((u.user_id * k * 13) % 75) * INTERVAL '1 day'
FROM users u, generate_series(1, 6) AS k
WHERE (u.user_id + k) % 4 <> 0;`,
      },
    ],
  },
  'ad-clicks-dedup-ctr': {
    language: 'sql',
    task: `Return «day, ad_id, impressions, clicked_impressions, ctr» for each impression day and ad. «imp_id» is unique in «impressions». A click counts when it comes 0 to 30 minutes after its impression, 30 minutes included. An impression counts as clicked at most once, however often it is clicked. A click belongs to its impression's day. «ctr» is «clicked_impressions / impressions», rounded to 4 decimal places. An ad with no valid clicks still shows, with «ctr» 0. Row order does not matter.`,
    tables: [
      {
        name: 'impressions',
        columns: IMPRESSION_COLUMNS,
        rows: [
          [1, 'ad1', 10, '2024-07-01 10:00:00'],
          [2, 'ad1', 11, '2024-07-01 10:05:00'],
          [3, 'ad1', 12, '2024-07-01 23:50:00'],
          [8, 'ad1', 16, '2024-07-01 18:00:00'],
          [4, 'ad2', 10, '2024-07-01 12:00:00'],
          [5, 'ad2', 13, '2024-07-01 12:30:00'],
          [6, 'ad2', 14, '2024-07-02 09:00:00'],
          [7, 'ad3', 15, '2024-07-01 15:00:00'],
        ],
      },
      {
        name: 'clicks',
        columns: CLICK_COLUMNS,
        rows: [
          [100, 1, '2024-07-01 10:00:05'],
          [101, 1, '2024-07-01 10:00:06'],
          [102, 2, '2024-07-01 10:35:00'],
          [103, 3, '2024-07-02 00:10:00'],
          [104, 4, '2024-07-01 12:45:01'],
          [105, 5, '2024-07-01 12:29:00'],
          [106, 99, '2024-07-01 11:00:00'],
        ],
      },
    ],
    starter: `-- impressions(imp_id, ad_id, user_id, ts), clicks(click_id, imp_id, ts)
-- Return day, ad_id, impressions, clicked_impressions, ctr.
SELECT CAST(i.ts AS DATE) AS day, i.ad_id,
       COUNT(*) AS impressions,
       COUNT(c.click_id) AS clicked_impressions,
       COUNT(c.click_id) * 1.0 / COUNT(*) AS ctr
FROM impressions i
LEFT JOIN clicks c ON c.imp_id = i.imp_id
GROUP BY 1, 2;
`,
    solution: `WITH valid_clicks AS (
  SELECT DISTINCT c.imp_id
  FROM clicks c
  JOIN impressions i ON i.imp_id = c.imp_id
  WHERE c.ts >= i.ts
    AND c.ts <= i.ts + INTERVAL '30 minutes'
)
SELECT CAST(i.ts AS DATE) AS day,
       i.ad_id,
       COUNT(*) AS impressions,
       COUNT(v.imp_id) AS clicked_impressions,
       ROUND(COUNT(v.imp_id) * 1.0 / COUNT(*), 4) AS ctr
FROM impressions i
LEFT JOIN valid_clicks v ON v.imp_id = i.imp_id
GROUP BY 1, 2;
`,
    cases: [
      {
        name: 'Sample',
        note: 'Impression 1 is clicked twice. Click 102 comes at exactly 30 minutes, 103 the next day, 104 too late and 105 before its impression.',
      },
      {
        name: 'Five thousand impressions',
        hidden: true,
        note: 'Double clicks, late clicks and clicks across midnight.',
        setup: `TRUNCATE impressions, clicks;
INSERT INTO impressions
SELECT n, 'ad' || (n % 12), n % 900, TIMESTAMP '2024-07-01' + ((n * 41) % 4320) * INTERVAL '1 minute'
FROM generate_series(1, 5000) AS n;
INSERT INTO clicks
SELECT 100000 + k, i.imp_id, i.ts + ((i.imp_id * 7 + k * 13) % 50 - 5) * INTERVAL '1 minute'
FROM impressions i, generate_series(1, 2) AS k
WHERE (i.imp_id + k) % 3 = 0;`,
      },
    ],
  },
  'org-chart-span-of-control': {
    language: 'sql',
    task: `Return «employee_id, name, direct_reports, total_reports, levels_below» for every employee. «direct_reports» counts the people whose «manager_id» is the employee. «total_reports» counts everyone below them at any depth. «levels_below» is the number of levels in their subtree: 0 with no reports, 1 with only direct reports. Row order does not matter.`,
    tables: [
      {
        name: 'employees',
        columns: EMPLOYEE_COLUMNS,
        rows: [
          [1, 'Asha', null],
          [2, 'Ben', 1],
          [3, 'Cara', 1],
          [4, 'Dan', 2],
          [5, 'Eli', 4],
          [6, 'Fay', 3],
        ],
      },
    ],
    starter: `-- employees(employee_id, name, manager_id)
-- Return employee_id, name, direct_reports, total_reports, levels_below.
SELECT m.employee_id, m.name,
       COUNT(e.employee_id) AS direct_reports,
       COUNT(e.employee_id) AS total_reports,
       1 AS levels_below
FROM employees m
LEFT JOIN employees e ON e.manager_id = m.employee_id
GROUP BY m.employee_id, m.name;
`,
    solution: `WITH RECURSIVE reports AS (
  SELECT manager_id AS ancestor_id, employee_id, 1 AS depth
  FROM employees
  WHERE manager_id IS NOT NULL
  UNION ALL
  SELECT r.ancestor_id, e.employee_id, r.depth + 1
  FROM reports r
  JOIN employees e ON e.manager_id = r.employee_id
  WHERE r.depth < 30
)
SELECT m.employee_id, m.name,
       COUNT(CASE WHEN r.depth = 1 THEN 1 END) AS direct_reports,
       COUNT(r.employee_id) AS total_reports,
       COALESCE(MAX(r.depth), 0) AS levels_below
FROM employees m
LEFT JOIN reports r ON r.ancestor_id = m.employee_id
GROUP BY m.employee_id, m.name;
`,
    cases: [
      { name: 'Sample', note: 'Asha has 2 direct reports and 5 in all, 3 levels deep.' },
      {
        name: 'A long chain',
        note: 'Twelve levels, one person each.',
        tables: [
          {
            name: 'employees',
            columns: EMPLOYEE_COLUMNS,
            rows: Array.from({ length: 12 }, (_, index) => [
              index + 1,
              `level ${index + 1}`,
              index === 0 ? null : index,
            ]),
          },
        ],
      },
      {
        name: 'A company of 2,000',
        hidden: true,
        note: 'A tree where each manager has three reports.',
        setup: `TRUNCATE employees;
INSERT INTO employees
SELECT n, 'employee ' || n, CASE WHEN n = 1 THEN NULL ELSE (n + 1) / 3 END
FROM generate_series(1, 2000) AS n;`,
      },
    ],
  },
  'regional-subtotals-report': {
    language: 'sql',
    task: `Return «region, city, revenue, pct_of_total, pct_of_region»: one row per region and city, one subtotal row per region with city «ALL», and one grand total row with region «TOTAL» and city «ALL». Trips with a NULL city count under the city «unknown», which is a city row, not a subtotal. «revenue» is the sum of «fare». «pct_of_total» is the row's share of the grand total, and «pct_of_region» its share of its region (100.0 for a subtotal and for the grand total), both as percentages rounded to 1 decimal place. Row order does not matter.`,
    tables: [
      {
        name: 'trips',
        columns: REGION_TRIP_COLUMNS,
        rows: [
          [1, 'EU', 'lon', 6.0],
          [2, 'EU', 'lon', 8.0],
          [3, 'EU', null, 5.0],
          [4, 'EU', 'par', 6.0],
          [5, 'NA', 'nyc', 20.0],
          [6, 'NA', 'nyc', 30.0],
          [7, 'NA', 'sfo', 12.0],
        ],
      },
    ],
    starter: `-- trips(trip_id, region, city, fare)
-- Return region, city, revenue, pct_of_total, pct_of_region.
SELECT region, city, SUM(fare) AS revenue,
       NULL AS pct_of_total, NULL AS pct_of_region
FROM trips
GROUP BY region, city;
`,
    solution: `WITH rolled AS (
  SELECT region, city,
         GROUPING(region) AS g_region,
         GROUPING(city) AS g_city,
         SUM(fare) AS revenue
  FROM trips
  GROUP BY ROLLUP (region, city)
)
SELECT CASE WHEN g_region = 1 THEN 'TOTAL' ELSE region END AS region,
       CASE WHEN g_city = 1 THEN 'ALL' ELSE COALESCE(city, 'unknown') END AS city,
       revenue,
       ROUND(100.0 * revenue / SUM(CASE WHEN g_region = 1 THEN revenue END) OVER (), 1) AS pct_of_total,
       ROUND(100.0 * revenue / MAX(CASE WHEN g_city = 1 THEN revenue END) OVER (PARTITION BY region, g_region), 1)
         AS pct_of_region
FROM rolled;
`,
    cases: [
      {
        name: 'Sample',
        note: 'Trip 3 has no city. It is the «unknown» city of EU, not a subtotal.',
      },
      {
        name: 'A region with only unknown cities',
        note: 'Every APAC trip has a NULL city, and one fare is NULL.',
        tables: [
          {
            name: 'trips',
            columns: REGION_TRIP_COLUMNS,
            rows: [
              [1, 'APAC', null, 9.0],
              [2, 'APAC', null, 11.0],
              [3, 'EU', 'ber', 30.0],
              [4, 'EU', 'ber', null],
            ],
          },
        ],
      },
      {
        name: 'Four thousand trips',
        hidden: true,
        note: 'Five regions, eight cities each, and some NULL cities.',
        setup: `TRUNCATE trips;
INSERT INTO trips
SELECT n, 'R' || (n % 5),
       CASE WHEN n % 23 = 0 THEN NULL ELSE 'c' || (n % 5) || '-' || ((n * 7) % 8) END,
       ((n * 37) % 4000) / 100.0 + 2
FROM generate_series(1, 4000) AS n;`,
      },
    ],
  },
  'referral-chain-root': {
    language: 'sql',
    task: `Return «user_id, root_user, chain_length, stopped_early» for every user in «referrals». Walk up «referred_by» from the user, one hop at a time, until a user with no referrer: that user is the root and «chain_length» counts the hops. Bad data has cycles: stop before a referrer that is already in the chain, and set «stopped_early» to true. A user with no referrer is their own root, with length 0. Every «referred_by» is a «user_id» in the table. Row order does not matter.`,
    tables: [
      {
        name: 'referrals',
        columns: REFERRAL_COLUMNS,
        rows: [
          [1, null],
          [2, 1],
          [3, 2],
          [4, 3],
          [5, null],
          [6, 5],
          [7, 8],
          [8, 7],
        ],
      },
    ],
    starter: `-- referrals(user_id, referred_by)
-- Return user_id, root_user, chain_length, stopped_early.
SELECT user_id,
       COALESCE(referred_by, user_id) AS root_user,
       CASE WHEN referred_by IS NULL THEN 0 ELSE 1 END AS chain_length,
       FALSE AS stopped_early
FROM referrals;
`,
    solution: `WITH RECURSIVE walk AS (
  SELECT user_id, user_id AS ancestor_id, 0 AS hops,
         '/' || CAST(user_id AS VARCHAR) || '/' AS path
  FROM referrals
  UNION ALL
  SELECT w.user_id, r.referred_by, w.hops + 1,
         w.path || CAST(r.referred_by AS VARCHAR) || '/'
  FROM walk w
  JOIN referrals r ON r.user_id = w.ancestor_id
  WHERE r.referred_by IS NOT NULL
    AND w.path NOT LIKE '%/' || CAST(r.referred_by AS VARCHAR) || '/%'
    AND w.hops < 50
),
deepest AS (
  SELECT user_id, ancestor_id, hops,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY hops DESC) AS rn
  FROM walk
)
SELECT d.user_id,
       d.ancestor_id AS root_user,
       d.hops AS chain_length,
       r.referred_by IS NOT NULL AS stopped_early
FROM deepest d
JOIN referrals r ON r.user_id = d.ancestor_id
WHERE d.rn = 1;
`,
    cases: [
      { name: 'Sample', note: 'Users 7 and 8 referred each other.' },
      {
        name: 'A longer loop and a self-referral',
        note: '10, 11 and 12 form a loop, 13 hangs off it, and 20 referred themselves.',
        tables: [
          {
            name: 'referrals',
            columns: REFERRAL_COLUMNS,
            rows: [
              [10, 12],
              [11, 10],
              [12, 11],
              [13, 10],
              [20, 20],
              [21, null],
            ],
          },
        ],
      },
      {
        name: 'A thousand users',
        hidden: true,
        note: 'Chains up to 40 hops deep, and a few loops.',
        setup: `TRUNCATE referrals;
INSERT INTO referrals
SELECT n,
       CASE
         WHEN n % 40 = 1 THEN NULL
         WHEN n > 990 THEN 991 + (n - 990) % 10
         ELSE n - 1
       END
FROM generate_series(1, 1000) AS n;`,
      },
    ],
  },
};
