import type { Lesson, Problem } from '@/types/course';

/**
 * More depth for the modeling track: late-arriving dimensions, and the
 * modeling questions that Amazon, Meta, Walmart and fintech loops ask. The
 * lesson and problems join the modeling track in `modeling.ts`. The SQL
 * problems run in the browser; their specs are in
 * `lib/course/runnables/modeling-sql.ts`.
 */

export const modelingDepthLessons: readonly Lesson[] = [
  {
    slug: 'late-arriving-dimensions',
    title: 'Late-arriving dimensions and facts',
    summary:
      'Load an order whose customer has not arrived yet, complete it later without breaking old facts, and key a late fact to the right version.',
    minutes: 15,
    body: `
      ## Start with the problem

      At 09:00 the orders feed brings order o2 for customer c3. The customer feed is a nightly
      export, so c3 arrives tomorrow. Your fact load joins orders to «dim_customer» to find the
      surrogate key. There is no row for c3, so the inner join silently drops o2.

      Tomorrow c3 arrives, but nothing reloads o2. Revenue for today is short, and nobody knows.

      This is a **late-arriving dimension**, also called an early-arriving fact. It happens in every
      system where facts and dimensions come from different sources on different schedules.
      Interviewers ask it because the obvious join loses data without an error.

      ## Idea 1: four choices, and only two are good

      When a fact has a natural key that the dimension does not know yet, you can:

      - **Drop the fact.** This is what an inner join does. Never do it.
      - **Hold the fact** in a parking table and retry it when the dimension row arrives. Correct, but
        today's numbers are short until the retry, and the retry is one more job that can fail.
      - **Point it at the unknown member**, a fixed row with key -1. The fact counts in totals, but it
        stays on -1 for ever unless you write a second job to fix it.
      - **Add an inferred member**: a new dimension row with a real surrogate key, the natural key,
        empty attributes and a flag «is_inferred = true». The fact gets that key at once.

      Use the inferred member when the fact has a natural key. Use the unknown member only when the
      natural key itself is missing, for example a guest checkout with no customer id.

      ## Idea 2: the inferred member in the fact load

      The load has two steps, in one transaction.

      ~~~sql
      -- 1. One inferred row per customer the dimension does not know yet.
      INSERT INTO dim_customer (customer_sk, customer_id, segment, is_inferred)
      SELECT next_sk(), missing.customer_id, NULL, TRUE
      FROM (
        SELECT DISTINCT s.customer_id
        FROM stg_orders s
        WHERE s.customer_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dim_customer d WHERE d.customer_id = s.customer_id)
      ) missing;

      -- 2. Every order gets a key: the real one, the inferred one, or -1.
      INSERT INTO fct_orders (order_id, customer_sk, ordered_at, amount_usd)
      SELECT s.order_id, COALESCE(d.customer_sk, -1), s.ordered_at, s.amount_usd
      FROM stg_orders s
      LEFT JOIN dim_customer d ON d.customer_id = s.customer_id
      WHERE NOT EXISTS (SELECT 1 FROM fct_orders f WHERE f.order_id = s.order_id);
      ~~~

      Three details make it correct.

      - **DISTINCT.** A customer with five orders gets one inferred row, not five. Five rows would
        make the join in step 2 multiply each order by five.
      - **LEFT JOIN with COALESCE.** An order with no customer id still loads, on -1.
      - **NOT EXISTS on the fact.** A rerun loads nothing twice.

      > [!trap] Two loads at the same time
      > If two fact loads run at once, both can see c3 as missing and both add an inferred row. Run
      > the loads one at a time, or put a unique constraint on the natural key of the current row
      > and let the second insert do nothing.

      ## Idea 3: completing the inferred member

      Tomorrow the customer feed brings c3 with segment «bronze». Your SCD type 2 load sees a
      current row for c3 whose segment differs (NULL against bronze). If it treats this as a normal
      change, it closes the inferred row and adds a new version with a new key.

      That is wrong. The orders from today still point at the inferred key, and that row still says
      segment NULL. Every report on today's orders shows "unknown segment", for ever.

      The inferred row was never a real version. It was a placeholder for the first real version.
      So **complete it in place**, like a type 1 update: set the attributes, set «is_inferred» to
      false, and keep the same key and dates.

      ~~~sql
      UPDATE dim_customer d
      SET segment = s.segment, is_inferred = FALSE
      FROM stg_customers s
      WHERE d.customer_id = s.customer_id AND d.is_current AND d.is_inferred;
      ~~~

      Run this step before the normal type 2 steps. After it, the row is a real version, and later
      changes follow the usual close-and-insert path. This is why the flag matters: a real customer
      can also have a NULL segment, and that row must get a new version when the segment arrives.

      ## Idea 4: late-arriving facts

      The other direction is a fact that arrives after the dimension has changed. A trip from 28
      February arrives on 3 March. Driver 7 moved from Pune to Mumbai on 1 March. If the load joins
      on «is_current», the February trip gets the Mumbai key and counts in the wrong city.

      Join on the natural key **and the event time** instead:

      ~~~sql
      SELECT t.trip_id, d.driver_sk
      FROM stg_trips t
      JOIN dim_driver d
        ON d.driver_id = t.driver_id
       AND d.valid_from <= t.started_at
       AND t.started_at < d.valid_to;
      ~~~

      Use this join in every fact load, not only for late rows. Then an on-time row and a late row
      take the same path, and a backfill of last month gives the same keys as the original load.

      ## Now say it like a senior engineer

      > [!senior] Say the policy, then measure it
      > "Facts never wait for dimensions. A fact with an unknown natural key gets an inferred member,
      > and the dimension load completes it in place. A fact with no natural key goes to the unknown
      > member. Every fact load joins on event time, not on the current row. I alert when the share
      > of inferred rows older than two days goes above one percent, because that means the
      > dimension feed is broken, not late."

      ## In one breath

      Never drop a fact because its dimension row is late. Add an inferred member with a real key,
      complete that same row when the real data arrives, and key every fact by event time, so late
      facts land on the version that was true when they happened.
    `,
    checks: [
      {
        question:
          'Customer c3 has an inferred row (key 5001, segment NULL). Today the feed brings c3 with segment gold. What should the load do?',
        options: [
          'Close key 5001 and add a new current version with a new key',
          'Set segment to gold on key 5001 and mark it not inferred',
          'Delete key 5001 and repoint the facts',
          'Nothing, because inferred rows are never updated',
        ],
        answer: 1,
        why: 'The inferred row is a placeholder for the first real version. Completing it in place keeps the key, so the facts already loaded see the real segment.',
      },
      {
        question:
          'A trip from 28 February arrives on 3 March. The driver changed city on 1 March. Which dimension row should the trip get?',
        options: [
          'The current row, because the load runs today',
          'The row valid on 28 February',
          'The unknown member, because the trip is late',
          'A new inferred row',
        ],
        answer: 1,
        why: 'Join on the natural key and the event time. The trip happened in February, so it gets the version that was valid in February.',
      },
    ],
  },
];

export const modelingDepthProblems: readonly Problem[] = [
  {
    slug: 'late-dim-inferred-member',
    title: 'Load orders whose customer has not arrived',
    track: 'modeling',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['amazon', 'walmart', 'flipkart', 'microsoft'],
    prompt: `
      The orders feed lands every hour. The customer feed lands once a night. Today's load drops
      every order from a new customer, because the join to «dim_customer» finds no row. Rewrite the
      fact load so that no order is lost and each order still gets a real customer key.
    `,
    hints: [
      'The inner join is what drops the orders.',
      'Give the missing customer a row before you load the facts.',
      'One new row per customer, not per order. And an order with no customer at all needs a key too.',
    ],
    answer: `
      Add an **inferred member** for each customer the dimension does not know, then load the facts
      with a left join. Run both steps in one transaction.

      ~~~sql
      BEGIN;

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
      ~~~

      «DISTINCT» gives one inferred row per customer, so the join in step 2 cannot multiply orders.
      An order with no customer id goes to the unknown member, -1. «NOT EXISTS» makes a rerun load
      nothing twice. The nightly customer load then completes the inferred rows in place.
    `,
    signals: [
      'Refuses to drop the facts and says why the inner join is the bug',
      'Uses an inferred member with a real key, not only the -1 member',
      'Adds one inferred row per customer, so the facts do not fan out',
      'Makes the load safe to rerun',
      'Says how the dimension load completes the inferred row later',
    ],
    followUps: [
      'Two fact loads run at the same time. What can go wrong, and how do you stop it?',
      'How do you know the customer feed is broken, not only late?',
    ],
  },
  {
    slug: 'late-dim-fill-inferred',
    title: 'Complete inferred customers in an SCD2 load',
    track: 'modeling',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['amazon', 'walmart', 'microsoft', 'google'],
    prompt: `
      «dim_customer» is SCD type 2 on «segment». The fact load adds inferred members for customers
      it does not know yet. Write the nightly customer load. When the real customer arrives, the
      orders loaded earlier must show its real segment.
    `,
    hints: [
      'An inferred row is not a real version. Should it get a new key?',
      'Complete the inferred row before the normal change detection.',
      'A real customer can also have a NULL segment. Use the flag, not the NULL.',
    ],
    answer: `
      Three steps in one transaction. The first one is the part most answers miss.

      ~~~sql
      BEGIN;

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
      ~~~

      If step 1 were a normal type 2 change, the inferred row would close and the facts loaded
      earlier would keep pointing at a row with a NULL segment. Completing it in place keeps the
      key. After step 1 the row is real, so step 2 sees no difference and a rerun changes nothing.
      «IS DISTINCT FROM» catches a change from a real NULL segment, and the «updated_at» guard
      ignores a stale snapshot row.
    `,
    signals: [
      'Completes the inferred row in place and keeps its key',
      'Explains what goes wrong for the earlier facts with a new key',
      'Uses the inferred flag, not a NULL attribute, to find placeholders',
      'Compares NULL-safely and keeps the load safe to rerun',
    ],
    followUps: [
      'The real customer arrives with a valid_from earlier than the inferred row. Do you change the dates?',
      'Finance wants to know which facts were loaded against an inferred member. How do you show it?',
    ],
  },
  {
    slug: 'prime-daily-members',
    title: 'Count active members per plan per day',
    track: 'modeling',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['amazon', 'meta', 'google', 'flipkart'],
    prompt: `
      A subscription product (think Prime) stores membership as events: «start» and «cancel», with
      the plan. Members cancel, come back and switch plans. The dashboard needs active members per
      plan per day, including the days and plans with nobody. Model it and write the query.
    `,
    hints: [
      'Turn events into periods first: each start runs until the next event of that member.',
      'The next event can be on another plan.',
      'Build the days and plans first, then join the periods to them.',
    ],
    answer: `
      Turn the event log into **periods**, then count periods over a **date spine**. The periods are
      a useful table on their own: an accumulating view of each membership.

      ~~~sql
      WITH ordered AS (
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
      ~~~

      «LEAD» is partitioned by member only, so a switch from monthly to annual ends the monthly
      period. The end is exclusive, so a member who cancels on 4 March is not active on 4 March. The
      cross join of days and plans gives the zero rows. In production, materialise the periods as
      «fct_membership_period» and a daily periodic snapshot «fct_membership_daily», because a
      dashboard should not replay the event log on every load.
    `,
    signals: [
      'Converts events to periods with a window function',
      'Ends a period on the next event of the member, on any plan',
      'States whether the end day counts, and why',
      'Uses a date spine so empty days and plans show 0',
      'Proposes a periodic snapshot table for the dashboard',
    ],
    followUps: [
      'A cancel event arrives two days late. Which rows of the daily snapshot change?',
      'Product asks for members who paid this month. Is that the same number?',
    ],
  },
  {
    slug: 'sales-by-vendor-country',
    title: 'Roll up sales by vendor and country',
    track: 'modeling',
    kind: 'sql',
    difficulty: 'easy',
    companies: ['walmart', 'amazon', 'flipkart', 'microsoft'],
    prompt: `
      A retail star schema has «fct_sales», «dim_product» (with the vendor) and «dim_location» (with
      the country). Finance wants net sales by year, month, vendor and country, and a yearly
      subtotal per vendor and country in the same result. Returns must reduce sales.
    `,
    hints: [
      'Returns are rows with a flag: subtract them.',
      'Some products are not in the product dimension. Do not lose those sales.',
      'You need two levels of grouping in one query, and only those two.',
    ],
    answer: `
      One pass over the fact, with **GROUPING SETS** for exactly the two levels asked for.

      ~~~sql
      SELECT EXTRACT(YEAR FROM s.sold_at)::int AS year,
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
      ~~~

      «ROLLUP» would add a year-only row and a grand total that finance did not ask for. The left
      join keeps sales of products that are not in the dimension yet; a better model fixes that
      with an unknown or inferred product member, so the fact never has an orphan key. If a real
      month could be NULL, add «GROUPING(month)» so a reader can tell a subtotal from missing data.
    `,
    signals: [
      'Subtracts returns instead of filtering or adding them',
      'Keeps the sales of products missing from the dimension',
      'Uses GROUPING SETS and explains why not ROLLUP or CUBE',
      'Mentions GROUPING() to tell a subtotal row from a NULL',
    ],
    followUps: [
      'The vendor of a product changes in June. Which vendor should January sales show?',
      'This query scans five years of sales each morning. How do you make it cheap?',
    ],
  },
  {
    slug: 'bitemporal-price-as-known',
    title: 'Report prices as known at the month close',
    track: 'modeling',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['amazon', 'walmart', 'phonepe', 'google'],
    prompt: `
      Prices get corrected after the fact. Finance closed March on 1 April with the prices they knew
      then. Audit now asks: for each order, what price did we use at the close, what is the correct
      price today, and which orders were restated? Model the price history so both questions have
      an answer, and write the query.
    `,
    hints: [
      'There are two times: when a price is true, and when we learned it.',
      'Never update a row. A correction is a new row.',
      'For each question, pick the latest row recorded before the cut-off that covers the order date.',
    ],
    answer: `
      Keep the history **bitemporal** and append-only: «valid_from» and «valid_to» say when the price
      is true in the business, «recorded_at» says when we learned it. A correction adds a row.

      ~~~sql
      WITH candidates AS (
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
      ~~~

      The «valid_to» end is exclusive, so a boundary date matches one row. «IS DISTINCT FROM» marks a
      price that was unknown at the close and known now as restated. An SCD type 2 table cannot
      answer the first question, because it overwrites what we believed. This is why ledgers,
      insurance and pricing teams keep two time axes.
    `,
    signals: [
      'Separates valid time from recorded time',
      'Keeps the history append-only and never updates a row',
      'Treats valid_to as exclusive',
      'Explains why SCD type 2 alone cannot reproduce the close',
      'Handles a price that did not exist at the close',
    ],
    followUps: [
      'Two corrections for the same dates are recorded in the same second. What breaks, and how do you prevent it?',
      'How do you store this in a lakehouse table so the as-of query stays cheap?',
    ],
  },
  {
    slug: 'account-daily-balance',
    title: 'Build a daily balance snapshot',
    track: 'modeling',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['phonepe', 'amazon', 'google', 'microsoft'],
    prompt: `
      A wallet stores every transaction. Risk wants the end-of-day balance of every account for every
      day, including quiet days, so they can find accounts whose balance dropped fast. Design the
      table and write the load for one week.
    `,
    hints: [
      'This is a periodic snapshot: one row per account per day, whether or not anything happened.',
      'The balance on 1 June includes everything before 1 June.',
      'A running sum over a date spine carries the balance forward.',
    ],
    answer: `
      A **periodic snapshot**, «fct_account_daily», grain one row per account per day. Balances are
      semi-additive: you can sum them across accounts for one day, never across days.

      ~~~sql
      WITH days AS (
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
      ~~~

      In production the opening balance is yesterday's snapshot row, not a sum over all history, so
      each daily load reads one day of transactions. A transaction posted late for an old day
      changes every snapshot row after it: reload from that day forward, and say so in the design.
    `,
    signals: [
      'Names the periodic snapshot and its grain',
      'Says that a balance is semi-additive',
      'Includes the opening balance from before the window',
      'Carries the balance forward on quiet days',
      'Explains how a late transaction is reprocessed',
    ],
    followUps: [
      'The wallet has 400 million accounts and most are idle. Do you still write a row for each per day?',
      'Risk wants the balance at any second, not only at the end of the day. What changes?',
    ],
  },
  {
    slug: 'prime-video-viewing-model',
    title: 'Model viewing for a video streaming service',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'medium',
    companies: ['amazon', 'google', 'meta', 'microsoft'],
    prompt: `
      A video streaming service (think Prime Video) sends a player heartbeat every 30 seconds while a
      profile watches. Product wants minutes watched per title per day, completion rate of each
      episode, and the number of profiles that started a series this week. Design the model.
    `,
    hints: [
      'Heartbeats are too fine for analysts. What is the natural unit of watching?',
      'A series has seasons and episodes. Where does that hierarchy live?',
      'Completion and "started a series" are different grains.',
    ],
    answer: `
      **Grains.**

      - «fct_playback_heartbeat»: raw, one row per heartbeat. Keep it for 30 days for debugging and
        for the session builder. Analysts do not query it.
      - «fct_playback_session»: one row per profile, title and session, where a gap of more than
        30 minutes or a title change ends a session. Measures: seconds watched, start and end
        position, max position reached, device, start time. This is the main fact.
      - «fct_profile_title_daily»: one row per profile, title and day, built from sessions. Minutes
        watched per title per day is a sum here.
      - «fct_series_start»: a factless fact, one row per profile and series, with the date of the
        first session. "Started a series this week" is a count on it.

      **Dimensions.** «dim_title» holds one row per playable title, with the series, season and
      episode number on the episode row (a flattened hierarchy), runtime and genre. «dim_profile»
      points at the account, because one account has several profiles. «dim_device» and «dim_date».

      **Completion.** An episode is complete when max position reaches the credits marker, or 90
      percent of runtime if there is no marker. Store the rule's result as a flag on the session,
      with the rule version, so a change of rule does not silently change history.

      **Traps to name.** Seconds watched is not «end - start»: seeking and pausing break that, so
      sum the heartbeats. Two devices on one profile at the same time are two sessions. Late
      heartbeats from an offline download arrive days later, so the session builder must reopen a
      closed day.
    `,
    signals: [
      'Builds sessions from heartbeats and states the session rule',
      'Separates session, daily and first-start grains',
      'Puts the series and episode hierarchy in the title dimension',
      'Defines completion explicitly and versions the rule',
      'Handles late heartbeats from offline viewing',
    ],
    followUps: [
      'Product changes the session gap from 30 to 10 minutes. What do you rebuild?',
      'How do you count unique viewers per title per month without scanning a month of sessions?',
    ],
  },
  {
    slug: 'returns-accumulating-snapshot',
    title: 'Model the life of a return',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'medium',
    companies: ['amazon', 'walmart', 'flipkart'],
    prompt: `
      An e-commerce return goes through these steps: requested, approved, picked up, received at the
      warehouse, refunded. Operations wants the average days between each step, and the returns
      stuck in a step for more than three days. Design the model.
    `,
    hints: [
      'The process has a fixed set of milestones, and each return reaches each one at most once.',
      'One row that is updated as the return moves.',
      'Some returns skip steps or are reopened.',
    ],
    answer: `
      Use an **accumulating snapshot**: «fct_return», one row per return line, updated as it moves.

      - **Milestone dates**: requested_at, approved_at, picked_up_at, received_at, refunded_at.
        Each is NULL until the step happens.
      - **Lag measures**, computed on load: days_to_approve, days_to_pickup, days_to_receive,
        days_to_refund. An average of a lag column answers the first question.
      - **Current state** and «state_entered_at», so "stuck for more than three days" is a filter
        on the current state and «now() - state_entered_at».
      - **Keys**: order line, product, customer, warehouse, carrier, return reason.

      Feed it from an append-only «fct_return_event» transaction fact (one row per status change).
      The snapshot is rebuilt or merged from the events, so a late or duplicate event is easy to
      replay, and the event fact keeps the full history the snapshot overwrites.

      **Edge cases.** A refund issued before pickup (a trusted customer) leaves picked_up_at NULL:
      the lag columns must allow it, and the average must say it excludes them. A rejected return
      ends in a terminal state with no refund. A reopened return keeps its first dates and adds a
      «reopened_count», or becomes a new return line, and you say which.
    `,
    signals: [
      'Names the accumulating snapshot and its one row per return line',
      'Stores milestone dates and lag measures',
      'Keeps an event fact underneath for history and replay',
      'Handles skipped steps, rejections and reopened returns',
      'Answers the stuck-return question from current state and entry time',
    ],
    followUps: [
      'A new step "inspected" is added between received and refunded. What changes?',
      'The snapshot table has 2 billion rows and only open returns change. How do you load it cheaply?',
    ],
  },
  {
    slug: 'streaming-and-batch-model',
    title: 'One model for a live dashboard and finance',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'hard',
    companies: ['uber', 'swiggy', 'meta', 'google'],
    prompt: `
      Operations wants trips and revenue per city on a dashboard that is at most one minute old.
      Finance wants the same numbers, exact, for the daily close. Today there are two pipelines and
      the numbers never match. Design one model that serves both.
    `,
    hints: [
      'Both views must come from the same events and the same definitions.',
      'Events arrive late and out of order. Which time do you group by?',
      'What makes a fast number become an exact number?',
    ],
    answer: `
      **One source of truth:** «trip_events» in Kafka, with an event id, the trip id, the event time
      and the event type. Every downstream table derives from it with one shared set of metric
      definitions.

      **The model.**

      - «fct_trip»: one row per trip, keyed by trip id, upserted (merge on trip id) from events.
        Store event time and processing time. A late event updates the same row; a duplicate event
        changes nothing, because the merge is idempotent on the event id.
      - «agg_city_minute»: trips and revenue per city per minute of **event time**, written by the
        streaming job with a watermark. Rows for a minute can be updated until the allowed lateness
        passes. The dashboard reads this table.
      - «agg_city_day»: the finance table, rebuilt from «fct_trip» after the day closes plus a grace
        period (for example 02:00 next day). It is the number of record.

      **Why they match.** Both aggregates use event time, the same definitions and the same
      deduplicated trip rows. The dashboard number is provisional and labelled so; it converges to
      the finance number once late data stops. Publish the difference between them as a metric,
      and alert when it is larger than the expected late share.

      **Corrections.** A fare adjustment days later is an event too. It updates «fct_trip», and the
      daily finance table for that day is restated in a controlled way, with an audit row, after the
      close.
    `,
    signals: [
      'Derives both views from one event log and one set of definitions',
      'Groups by event time, with a watermark and allowed lateness',
      'Makes the fact idempotent with upserts keyed on ids',
      'Labels the fast number provisional and shows how it converges',
      'Handles corrections after the close with a restatement process',
    ],
    followUps: [
      'The streaming job is down for two hours. What does the dashboard show, and how do you recover?',
      'Finance asks why yesterday changed after the close. What do you show them?',
    ],
  },
  {
    slug: 'food-delivery-order-lifecycle',
    title: 'Model a food delivery order from cart to doorstep',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'medium',
    companies: ['swiggy', 'uber', 'flipkart'],
    prompt: `
      A food delivery order is placed, accepted by the restaurant, assigned to a rider (sometimes
      reassigned), picked up and delivered, or cancelled at any step. Questions: cancellation rate
      by the step it happened in, average prep time per restaurant, and how often orders are
      reassigned. Design the tables.
    `,
    hints: [
      'Some questions are about the order, some about each rider assignment.',
      'Reassignment means one order can have several riders.',
      'Cancellations need the step, the actor and the reason.',
    ],
    answer: `
      **Three facts at three grains.**

      - «fct_order» (accumulating snapshot): one row per order with placed_at, accepted_at,
        food_ready_at, picked_up_at, delivered_at, cancelled_at, «cancel_stage», «cancelled_by»
        (customer, restaurant, rider, system) and a reason key. Prep time is
        «food_ready_at - accepted_at»; cancellation rate by stage is a group by «cancel_stage».
      - «fct_order_assignment»: one row per order and rider assignment, with assigned_at,
        accepted_at, released_at and the release reason. Reassignment rate is orders with more than
        one row. Rider metrics (acceptance rate) use this grain, not the order.
      - «fct_order_event»: append-only, one row per status event, the source for the other two and
        for replay.

      **Dimensions.** Restaurant (SCD 2 on cuisine and zone), customer, rider, zone, date and time of
      day, cancel reason. Keep «order_id» as a degenerate dimension on all three facts.

      **Traps.** The rider on «fct_order» is the final rider only; do not use it for rider metrics.
      «food_ready_at» comes from the restaurant tablet and is often missing; prep time must exclude
      those rows and report the share it excluded. Times are in the zone's local time for "lunch
      peak" questions, so store both UTC and local.
    `,
    signals: [
      'Separates order, assignment and event grains',
      'Records the cancel stage, actor and reason',
      'Measures reassignment at the assignment grain',
      'Calls out missing restaurant timestamps and how prep time handles them',
      'Stores local time for peak-hour analysis',
    ],
    followUps: [
      'Product adds batching: one rider carries two orders. What changes in the model?',
      'How do you compute rider idle time between orders?',
    ],
  },
];
