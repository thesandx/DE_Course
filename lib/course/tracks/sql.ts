import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'sql',
  title: 'SQL for senior loops',
  summary:
    'Window functions, gaps and islands, deduplication, cohorts and query performance, at interview speed.',
  tone: 'soda',
  why: 'Every data engineering loop at Uber and Google has a SQL round, and it is where senior candidates lose easy points on edge cases. Fluency here buys time for the harder rounds.',
  lessons: [
    {
      slug: 'window-functions',
      title: 'Window functions without guessing',
      summary: 'Pick the right ranking function and frame, and explain the difference out loud.',
      minutes: 14,
      body: `
        A window function computes a value for each row from a set of related rows, **without
        collapsing them** the way «GROUP BY» does. Interviewers use them because one query shows
        whether you understand partitions, ordering and frames.

        ## The three parts of «OVER (...)»

        | Part | Question it answers | Example |
        |---|---|---|
        | «PARTITION BY» | Which rows belong together? | «PARTITION BY rider_id» |
        | «ORDER BY» | In which order inside the group? | «ORDER BY requested_at» |
        | Frame | Which rows around the current one? | «ROWS BETWEEN 6 PRECEDING AND CURRENT ROW» |

        ## Ranking: say which one and why

        ~~~sql
        SELECT
          city_id,
          driver_id,
          trips,
          ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY trips DESC) AS rn,   -- 1,2,3,4
          RANK()       OVER (PARTITION BY city_id ORDER BY trips DESC) AS rnk,  -- 1,2,2,4
          DENSE_RANK() OVER (PARTITION BY city_id ORDER BY trips DESC) AS drnk  -- 1,2,2,3
        FROM driver_daily;
        ~~~

        - «ROW_NUMBER» breaks ties arbitrarily. Use it to pick exactly one row, and add a tie-breaker
          column so the result is deterministic.
        - «RANK» leaves gaps after ties. Use it for "top 3 including ties, like a leaderboard".
        - «DENSE_RANK» has no gaps. Use it for "the three highest distinct values".

        ## Frames: the default is a trap

        With an «ORDER BY» and no frame, most engines use
        «RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW». «RANGE» treats rows with the same
        ordering value as peers, so a running total jumps by all tied rows at once.

        ~~~sql
        -- Rolling 7-row average and a running total that is safe with ties
        SELECT
          day,
          revenue,
          AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS avg_7_rows,
          SUM(revenue) OVER (ORDER BY day, order_id ROWS UNBOUNDED PRECEDING)      AS running_total
        FROM daily_revenue;
        ~~~

        > [!trap] Seven rows are not seven days
        > «ROWS BETWEEN 6 PRECEDING» counts rows. If a day has no row, the window reaches further
        > back in time. For a true calendar window, join to a date spine first, or use
        > «RANGE BETWEEN INTERVAL 6 DAY PRECEDING AND CURRENT ROW» where the engine supports it.

        ## LAG and LEAD

        «LAG(x)» reads the previous row in the window, «LEAD(x)» the next one. They replace most
        self-joins on "the row before". Give a default for the first row: «LAG(x, 1, 0)».

        ~~~sql
        SELECT
          rider_id,
          requested_at,
          requested_at - LAG(requested_at) OVER (PARTITION BY rider_id ORDER BY requested_at) AS gap
        FROM trips;
        ~~~

        > [!senior] What a senior answer adds
        > Name the cost. A window with a «PARTITION BY» makes the engine shuffle and sort by that key.
        > On a skewed key (one huge city) one worker does most of the work. Say so, and mention that
        > filtering before the window keeps the sort small.
      `,
      checks: [
        {
          question:
            'You need the top 3 drivers per city by trips, and ties at third place should all be included. Which function?',
          options: ['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE(3)'],
          answer: 1,
          why: 'RANK gives tied rows the same rank and keeps the leaderboard meaning of "top 3". DENSE_RANK would return three distinct trip counts, which can be many more drivers.',
        },
        {
          question:
            'A running total over ORDER BY day jumps by the full amount of all rows that share a day. Why?',
          options: [
            'SUM ignores ORDER BY',
            'The default frame is RANGE, which treats tied rows as peers',
            'The partition is missing',
            'Window functions run before WHERE',
          ],
          answer: 1,
          why: 'The default frame with ORDER BY is RANGE UNBOUNDED PRECEDING to CURRENT ROW, so all peers are included at once. Use ROWS and a unique tie-breaker.',
        },
      ],
    },
    {
      slug: 'gaps-and-islands',
      title: 'Gaps, islands and sessions',
      summary: 'Find streaks and sessions with the difference trick and running sums.',
      minutes: 16,
      body: `
        "Longest streak", "consecutive days" and "split events into sessions" are the same family of
        problem: rows that belong together because nothing breaks the sequence. There are two
        reliable patterns. Learn both, because interviewers change the problem halfway.

        ## Pattern 1: the difference trick for consecutive values

        For consecutive days, subtract a row number from the date. Inside an unbroken run, the
        date and the row number grow together, so the difference stays constant. That constant is
        the island id.

        ~~~sql
        WITH active AS (
          SELECT DISTINCT driver_id, CAST(online_at AS DATE) AS day
          FROM driver_sessions
        ),
        islands AS (
          SELECT
            driver_id,
            day,
            day - CAST(ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY day) AS INT) AS island
          FROM active
        )
        SELECT driver_id, MIN(day) AS start_day, MAX(day) AS end_day, COUNT(*) AS days
        FROM islands
        GROUP BY driver_id, island;
        ~~~

        > [!trap] Deduplicate first
        > If a driver has two sessions on one day, the row number grows twice while the date grows
        > once, and the island breaks. The «DISTINCT» in the first CTE is not optional.

        ## Pattern 2: flag the breaks, then a running sum

        When "together" means "less than 30 minutes apart", there is no row-number trick. Flag each
        row that starts a new group, then a running sum of the flags numbers the groups.

        ~~~sql
        WITH flagged AS (
          SELECT
            user_id,
            event_time,
            CASE
              WHEN LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) IS NULL THEN 1
              WHEN event_time - LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time)
                   > INTERVAL '30 minutes' THEN 1
              ELSE 0
            END AS is_new_session
          FROM app_events
        )
        SELECT
          user_id,
          event_time,
          SUM(is_new_session) OVER (
            PARTITION BY user_id ORDER BY event_time ROWS UNBOUNDED PRECEDING
          ) AS session_number
        FROM flagged;
        ~~~

        This pattern is general. Swap the condition for "status changed" or "city changed" and the
        same two steps find runs of any kind.

        > [!senior] Talk about the data, not just the query
        > Sessions from mobile clients arrive late and out of order. Say whether you sessionize on
        > event time or arrival time, and what happens when a late event lands between two
        > sessions you already published: it can merge them. That is the bridge to the streaming
        > round, where session windows handle exactly this.
      `,
      checks: [
        {
          question:
            'In the difference trick, why does day minus ROW_NUMBER stay constant inside a streak?',
          options: [
            'Because ROW_NUMBER restarts each day',
            'Both increase by one per row inside an unbroken run',
            'Because dates are stored as integers',
            'It does not; you need RANK',
          ],
          answer: 1,
          why: 'Inside a run of consecutive days the date and the row number both step by one, so their difference is the same value for the whole run.',
        },
        {
          question:
            'Which pattern splits click events into sessions with a 30-minute inactivity gap?',
          options: [
            'The difference trick',
            'Flag gaps with LAG, then a running SUM of the flags',
            'GROUP BY date_trunc of 30 minutes',
            'DENSE_RANK on event_time',
          ],
          answer: 1,
          why: 'Fixed 30-minute buckets cut sessions at arbitrary boundaries. Flagging each gap and summing the flags gives true inactivity-based sessions.',
        },
      ],
    },
    {
      slug: 'dedup-and-top-n',
      title: 'Deduplication and top N per group',
      summary: 'Keep the right row per key, deterministically, and say what "latest" means.',
      minutes: 12,
      body: `
        Event data is full of duplicates: retries from phones, replays from Kafka, and change
        records with several versions of one entity. "Keep the latest version per key" is asked in
        almost every loop, often hidden inside a bigger question.

        ## The standard shape

        ~~~sql
        SELECT *
        FROM (
          SELECT
            t.*,
            ROW_NUMBER() OVER (
              PARTITION BY trip_id
              ORDER BY updated_at DESC, ingest_offset DESC
            ) AS rn
          FROM trip_updates t
        ) ranked
        WHERE rn = 1;
        ~~~

        BigQuery, Snowflake and Databricks support «QUALIFY», which filters on a window function
        without the subquery:

        ~~~sql
        SELECT *
        FROM trip_updates
        QUALIFY ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY updated_at DESC, ingest_offset DESC) = 1;
        ~~~

        ## Questions to ask before you write it

        - **Latest by what clock?** The device time can be wrong. The server receive time is
          monotonic per partition but arrives late. Many teams order by a source version number or
          the log offset.
        - **What breaks ties?** Two updates with the same timestamp are common at millisecond
          precision. Add a second ordering column, or the result changes between runs.
        - **Exact duplicates or versions?** If rows are byte-identical, «SELECT DISTINCT» works and is
          cheaper to explain. If they are versions, you need the window.

        ## Top N per group

        The same window solves "top 3 products per category". Choose the ranking function from the
        tie rule (see the window functions lesson), then filter «rn <= 3».

        > [!senior] Deduplicate where it is cheapest
        > At scale, deduplication belongs at ingestion with an idempotent key, or in an incremental
        > merge (for example «MERGE» on «trip_id» into a Hudi, Iceberg or Delta table), not in every
        > downstream query. Say where you would put it and why.
      `,
      checks: [
        {
          question: 'Why add ingest_offset to ORDER BY updated_at DESC when deduplicating?',
          options: [
            'To make the query faster',
            'To break ties so the same row wins every run',
            'Because ROW_NUMBER needs two columns',
            'To remove NULLs',
          ],
          answer: 1,
          why: 'Without a tie-breaker, two rows with the same updated_at can swap places between runs, so the output is not deterministic.',
        },
      ],
    },
    {
      slug: 'cohorts-and-funnels',
      title: 'Cohorts, retention and funnels',
      summary: 'Write the product analytics queries that marketplace teams ask for every week.',
      minutes: 15,
      body: `
        Product questions show up in SQL rounds because they test whether you can turn a vague
        business question into a precise definition first. Always restate the definition before you
        write SQL. Most wrong answers here are wrong definitions, not wrong syntax.

        ## Retention cohorts

        "Of riders who took a first trip in a week, how many took a trip in each following week?"

        ~~~sql
        WITH first_trip AS (
          SELECT rider_id, DATE_TRUNC('week', MIN(completed_at)) AS cohort_week
          FROM trips
          WHERE status = 'completed'
          GROUP BY rider_id
        ),
        activity AS (
          SELECT DISTINCT rider_id, DATE_TRUNC('week', completed_at) AS active_week
          FROM trips
          WHERE status = 'completed'
        )
        SELECT
          f.cohort_week,
          (a.active_week - f.cohort_week) / 7 AS week_number,  -- engine-specific date maths
          COUNT(DISTINCT a.rider_id) AS riders
        FROM first_trip f
        JOIN activity a ON a.rider_id = f.rider_id AND a.active_week >= f.cohort_week
        GROUP BY 1, 2
        ORDER BY 1, 2;
        ~~~

        Divide each row by the week 0 count for the retention rate. Mention that the newest cohorts
        have fewer weeks of data, so their curves are incomplete, not worse.

        ## Funnels with order

        A funnel counts users who did step 2 **after** step 1. Counting users who did both, in any
        order, overstates conversion.

        ~~~sql
        WITH steps AS (
          SELECT
            rider_id,
            MIN(CASE WHEN event = 'app_open'      THEN event_time END) AS t_open,
            MIN(CASE WHEN event = 'trip_request'  THEN event_time END) AS t_request,
            MIN(CASE WHEN event = 'trip_complete' THEN event_time END) AS t_complete
          FROM rider_events
          WHERE event_time >= DATE '2026-10-01' AND event_time < DATE '2026-11-01'
          GROUP BY rider_id
        )
        SELECT
          COUNT(t_open) AS opened,
          COUNT(CASE WHEN t_request > t_open THEN 1 END) AS requested,
          COUNT(CASE WHEN t_complete > t_request AND t_request > t_open THEN 1 END) AS completed
        FROM steps;
        ~~~

        > [!trap] MIN per step is a simplification
        > Taking the first time of each step can miss a user who opened the app twice and requested
        > after the second open. Say the simplification out loud, and offer the stricter version:
        > per session, or with «LEAD» over an ordered event stream.

        > [!senior] Define the denominator
        > Say who is in the population (new riders only? all riders active in the period?), which
        > time zone defines a week, and whether cancelled trips count. A senior answer settles these
        > in the first two minutes.
      `,
      checks: [
        {
          question:
            'Why can a funnel that counts users with both a request and a completion event overstate conversion?',
          options: [
            'COUNT DISTINCT is approximate',
            'It ignores the order of the steps',
            'It double counts cancelled trips',
            'Funnels need a full outer join',
          ],
          answer: 1,
          why: 'A funnel requires each step to happen after the one before. Ignoring order counts users whose events happened in the wrong sequence.',
        },
      ],
    },
    {
      slug: 'query-performance',
      title: 'Query performance and correctness traps',
      summary: 'Read a plan, prune partitions, pick join strategies and avoid the NULL traps.',
      minutes: 15,
      body: `
        A senior candidate is expected to write SQL that is correct **and** cheap on a warehouse that
        bills by bytes scanned or by slot time. These are the ideas interviewers probe.

        ## Scan less

        - **Partition pruning.** Filter on the partition column directly: «WHERE event_date = '2026-10-31'».
          Wrapping it in a function, such as «WHERE DATE(event_ts) = ...» on a table partitioned by
          «event_date», can stop the engine from pruning.
        - **Column pruning.** Columnar engines read only the columns you name. «SELECT *» on a wide
          table reads everything.
        - **Clustering or sorting** inside partitions lets the engine skip blocks using min and max
          statistics. Cluster on columns that appear in selective filters.

        ## Join strategies

        | Strategy | When the engine picks it | What to say |
        |---|---|---|
        | Broadcast (map-side) join | One side is small | No shuffle of the big side. Fast. |
        | Shuffle hash join | Both sides large, equality join | Both sides move by key. Watch skew. |
        | Sort-merge join | Both sides large, sortable keys | Robust, spills to disk, needs a sort. |
        | Nested loop | Non-equality join | Can explode. Rewrite with ranges or buckets. |

        ## Correctness traps that interviewers plant

        > [!trap] NOT IN with a NULL returns nothing
        > «WHERE rider_id NOT IN (SELECT rider_id FROM banned)» returns zero rows if any
        > «banned.rider_id» is NULL, because «x <> NULL» is unknown. Use «NOT EXISTS» or a left join
        > with «IS NULL».

        ~~~sql
        SELECT r.*
        FROM riders r
        WHERE NOT EXISTS (SELECT 1 FROM banned b WHERE b.rider_id = r.rider_id);
        ~~~

        - **Join fan-out.** Joining trips to a table with several rows per trip (for example
          payment attempts) multiplies trip revenue. Aggregate to the join grain first.
        - **COUNT(column)** skips NULLs; «COUNT(*)» does not. «AVG» ignores NULLs, which changes the
          denominator.
        - **Integer division.** «1 / 4» is 0 in several engines. Cast before dividing.
        - **Time zones.** «DATE(ts)» uses the session time zone. Say which zone defines a day.

        > [!senior] Approximate on purpose
        > «APPROX_COUNT_DISTINCT» (HyperLogLog) gives about 1 percent error for a fraction of the
        > memory. Offering it for a dashboard, and refusing it for billing, shows judgement.
      `,
      checks: [
        {
          question:
            'NOT IN (subquery) returns no rows, but you expected many. What is the most likely cause?',
          options: [
            'The subquery is too large',
            'The subquery returns at least one NULL',
            'NOT IN needs an index',
            'The outer table has duplicates',
          ],
          answer: 1,
          why: 'With a NULL in the list, every comparison is unknown rather than true, so no row passes. NOT EXISTS does not have this problem.',
        },
        {
          question:
            'Which filter is most likely to stop partition pruning on a table partitioned by event_date?',
          options: [
            "WHERE event_date = '2026-10-31'",
            "WHERE event_date BETWEEN '2026-10-01' AND '2026-10-31'",
            "WHERE CAST(event_ts AS DATE) = '2026-10-31'",
            "WHERE event_date >= '2026-10-01'",
          ],
          answer: 2,
          why: 'The partition column is event_date. A filter on an expression over another column does not tell the planner which partitions to read.',
        },
      ],
    },
    {
      slug: 'recursive-ctes',
      title: 'Recursive CTEs: hierarchies, graphs and series',
      summary:
        'Walk org charts, category trees and referral chains in SQL, and stop recursion that never ends.',
      minutes: 14,
      body: `
        A **recursive CTE** repeats a query, feeding each round’s output into the next round,
        until a round returns no rows. It is how SQL walks a hierarchy of unknown depth.

        ## The shape

        ~~~sql
        WITH RECURSIVE chain AS (
          -- Anchor: the starting rows
          SELECT employee_id, name, manager_id, 0 AS depth,
                 CAST(name AS VARCHAR) AS path
          FROM employees
          WHERE manager_id IS NULL
          UNION ALL
          -- Recursive step: join the table to the previous round
          SELECT e.employee_id, e.name, e.manager_id, c.depth + 1,
                 c.path || ' > ' || e.name
          FROM employees e
          JOIN chain c ON e.manager_id = c.employee_id
          WHERE c.depth < 20
        )
        SELECT employee_id, name, depth, path FROM chain ORDER BY path;
        ~~~

        | employee_id | name | depth | path |
        |---|---|---|---|
        | 1 | Asha | 0 | Asha |
        | 2 | Ben | 1 | Asha > Ben |
        | 4 | Dev | 2 | Asha > Ben > Dev |
        | 3 | Chen | 1 | Asha > Chen |

        1. The **anchor** runs once.
        2. The **recursive member** joins the base table to the rows produced by the previous
           round only, not to everything so far.
        3. It stops when a round adds nothing. «UNION ALL» keeps duplicates and is faster;
           «UNION» removes them, which also stops some cycles.

        ## Uses that come up

        - **Hierarchies:** everyone under a manager, a product category tree, a bill of materials.
        - **Graphs:** referral chains, "which accounts are reachable from this one", the shortest
          number of transfers between two airports.
        - **Series:** generate every date in a range to fill gaps, where the engine has no
          «generate_series» or «GENERATE_DATE_ARRAY».

        ~~~sql
        WITH RECURSIVE days AS (
          SELECT DATE '2026-10-01' AS day
          UNION ALL
          SELECT day + 1 FROM days WHERE day < DATE '2026-10-07'
        )
        SELECT day FROM days;
        ~~~

        ## Stopping safely

        Real data has cycles: a manager record pointing back down the chain, two accounts that
        referred each other. Without a guard, recursion runs until the engine’s limit.

        - A **depth cap** in the recursive member («WHERE c.depth < 20»).
        - A **visited path**: carry an array or string of visited ids and skip a row whose id is
          already in it. Postgres 14 and later also offer a «CYCLE» clause.
        - Know the engine limit: BigQuery stops at 500 iterations, SQL Server at 100 by default
          («MAXRECURSION»), Postgres has no limit.

        > [!trap] Recursion in a warehouse is a loop of joins
        > Each round is a full join. A graph that fans out widely produces huge intermediate
        > results by round four or five. For deep or wide graphs, precompute a closure table
        > (every ancestor and descendant pair) in a batch job, or use a graph engine.

        > [!senior] Mention the closure table
        > If the hierarchy is read far more often than it changes, store the transitive closure:
        > one row per (ancestor, descendant, depth). "Everyone under Asha" becomes a single
        > equi-join, with no recursion at query time.
      `,
      checks: [
        {
          question: 'In a recursive CTE, what does the recursive member join to in each round?',
          options: [
            'All rows produced so far',
            'Only the rows produced by the previous round',
            'Only the anchor rows',
            'The final result',
          ],
          answer: 1,
          why: 'Each iteration sees only the previous iteration’s output, which is why it terminates when a round adds nothing.',
        },
        {
          question:
            'A referral table has a cycle (A referred B, B referred A). How do you make the query safe?',
          options: [
            'Use UNION ALL',
            'Add a depth limit or track visited ids and skip repeats',
            'Add ORDER BY to the anchor',
            'Use a window function in the anchor',
          ],
          answer: 1,
          why: 'Cycles make recursion endless. A depth cap or a visited-path check stops it.',
        },
      ],
    },
    {
      slug: 'grouping-sets-rollup-cube',
      title: 'GROUPING SETS, ROLLUP and CUBE',
      summary:
        'Compute subtotals and grand totals in one pass, and tell a real NULL from a subtotal row.',
      minutes: 12,
      body: `
        Reports want totals at several levels: revenue per city and product, per city, and
        overall. Three queries joined with «UNION ALL» scan the table three times. **Grouping
        sets** compute all levels in one scan.

        ## The three forms

        | Syntax | Levels it produces |
        |---|---|
        | «GROUPING SETS ((city, product), (city), ())» | Exactly the listed levels |
        | «ROLLUP (city, product)» | (city, product), (city), () : a hierarchy, right to left |
        | «CUBE (city, product)» | Every combination: (city, product), (city), (product), () |

        «ROLLUP» suits hierarchies (country, city, zone). «CUBE» suits independent dimensions,
        but its size is 2 to the power of the column count, so keep it to two or three columns.

        ## Which NULL is which

        In a subtotal row, the rolled-up column is NULL. If the data has real NULLs too, the
        report shows two rows that look the same. «GROUPING(col)» returns 1 when the column was
        rolled up in that row, 0 otherwise.

        ~~~sql
        SELECT CASE WHEN GROUPING(city) = 1 THEN 'All cities' ELSE COALESCE(city, 'Unknown') END AS city,
               CASE WHEN GROUPING(product) = 1 THEN 'All products' ELSE product END AS product,
               COUNT(*) AS trips
        FROM trips
        GROUP BY CUBE (city, product)
        ORDER BY 1, 2;
        ~~~

        The first rows of the result:

        | city | product | trips |
        |---|---|---|
        | All cities | All products | 5 |
        | All cities | black | 1 |
        | All cities | x | 4 |
        | Unknown | All products | 1 |
        | Unknown | x | 1 |

        Without «GROUPING()», the trip with no city and the grand total both print as NULL, NULL.

        ## Where it matters for a data engineer

        - **Pre-aggregated tables for dashboards:** one job writes every level the dashboard
          needs, with a «grouping_id» column (some engines name it «GROUPING_ID») to filter on.
        - **Distinct counts do not add up.** A city’s distinct riders is not the sum of its
          products’ distinct riders. Grouping sets compute each level correctly from raw rows;
          summing a lower level does not.

        > [!senior] Say why not UNION ALL
        > "One scan instead of three, totals guaranteed consistent with the detail rows, and
        > GROUPING() to label subtotals so real NULLs stay visible." That sentence covers what
        > the interviewer wants.
      `,
      checks: [
        {
          question: 'What does ROLLUP (country, city) produce?',
          options: [
            '(country, city) only',
            '(country, city), (country) and the grand total',
            'Every combination including (city) alone',
            '(city) and (country) only',
          ],
          answer: 1,
          why: 'ROLLUP removes columns from the right, one at a time, down to the grand total.',
        },
        {
          question: 'Why is GROUPING(city) needed in a subtotal report?',
          options: [
            'It speeds up the query',
            'It tells a subtotal row apart from rows where city is really NULL',
            'It sorts subtotals last',
            'It is required by the SQL standard for CUBE',
          ],
          answer: 1,
          why: 'Both show NULL in the city column. GROUPING returns 1 only for the rolled-up row.',
        },
      ],
    },
    {
      slug: 'indexes-and-procedures',
      title: 'Indexes, clustering and stored procedures',
      summary:
        'Choose indexes for an OLTP source and clustering for a warehouse, and know when procedural SQL helps.',
      minutes: 13,
      body: `
        Data engineers sit between two kinds of database. A row store (Postgres, MySQL) serves
        the app with indexes. A columnar warehouse (BigQuery, Snowflake, Redshift) serves
        analysis with partitions, clustering and pruning. Interviewers check that you know which
        tool fits which side.

        ## Indexes in a row store

        A **B-tree index** keeps keys sorted, so a lookup or a range scan reads a few pages
        instead of the table.

        - **Composite index order matters.** An index on «(rider_id, created_at)» serves
          «WHERE rider_id = ? ORDER BY created_at DESC LIMIT 20». It does not serve a filter on
          «created_at» alone. Put equality columns first, then the range or sort column.
        - A **covering index** includes every column the query reads, so the table is never
          touched (Postgres «INCLUDE», MySQL secondary indexes that hold the needed columns).
        - A **partial index** («WHERE status = 'open'») stays small when queries touch a small
          slice.
        - Every index slows writes and takes space. An extract query that scans «updated_at»
          each hour needs one index; ten speculative ones hurt the service you extract from.

        > [!trap] Functions hide the index
        > «WHERE DATE(created_at) = '2026-10-01'» cannot use an index on «created_at». Write a
        > range: «created_at >= '2026-10-01' AND created_at < '2026-10-02'».

        ## The warehouse equivalent

        Warehouses have no B-trees to tune. They skip data instead.

        | Engine | Skips data with |
        |---|---|
        | BigQuery | Partitioning (by date or integer range) and clustering on up to four columns |
        | Snowflake | Micro-partition min and max pruning; optional clustering keys; search optimization for point lookups |
        | Redshift | Sort keys and distribution keys |
        | Iceberg and Delta | Partition transforms, file statistics, Z-order or liquid clustering |

        The rule is the same in all of them: filter on the partition column, cluster on the next
        most selective filters, and read the query plan’s bytes-scanned number.

        ## Stored procedures

        A **stored procedure** keeps procedural logic (variables, loops, IF, transactions) in
        the database. BigQuery scripting, Snowflake Scripting and Postgres PL/pgSQL all have one.

        | Use it for | Avoid it for |
        |---|---|
        | A short multi-statement step that must be one transaction | Business logic nobody can test or review |
        | Admin tasks close to the data, such as partition maintenance | Orchestration: retries, dependencies, alerts |
        | Loops the SQL engine runs well, such as a batch MERGE per partition | Logic you want in version control with tests |

        > [!senior] Where logic should live
        > "Transformations go in versioned SQL models (dbt or similar) with tests; orchestration
        > goes in the orchestrator; a procedure is acceptable for a small transactional step,
        > kept in the repository and deployed by CI." That shows you have inherited a database
        > full of untested procedures before.
      `,
      checks: [
        {
          question:
            'The query is WHERE rider_id = 42 ORDER BY created_at DESC LIMIT 20. Which index serves it best?',
          options: [
            '(created_at, rider_id)',
            '(rider_id, created_at)',
            'Two separate indexes on rider_id and created_at',
            'An index on status',
          ],
          answer: 1,
          why: 'Equality column first, then the sort column. The engine jumps to rider 42 and reads 20 entries in order.',
        },
        {
          question: 'Which filter lets an index on created_at be used?',
          options: [
            "DATE(created_at) = '2026-10-01'",
            "created_at >= '2026-10-01' AND created_at < '2026-10-02'",
            "CAST(created_at AS VARCHAR) LIKE '2026-10-01%'",
            'EXTRACT(DAY FROM created_at) = 1',
          ],
          answer: 1,
          why: 'A function on the column hides it from the index. A half-open range on the raw column uses it.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'month-over-month-revenue',
    title: 'Month-over-month revenue growth',
    track: 'sql',
    kind: 'sql',
    difficulty: 'easy',
    companies: ['uber', 'google'],
    prompt: `
      Table «payments(payment_id, city_id, amount_usd, paid_at TIMESTAMP)».

      Return, for each city and month, the revenue and the growth rate against the previous month
      as a percentage. The first month of a city has no growth value.
    `,
    hints: [
      'Aggregate to city and month first, then compare rows.',
      'LAG over PARTITION BY city_id ORDER BY month gives the previous month.',
      'Guard against division by zero and integer division.',
    ],
    answer: `
      ~~~sql
      WITH monthly AS (
        SELECT city_id, DATE_TRUNC('month', paid_at) AS month, SUM(amount_usd) AS revenue
        FROM payments
        GROUP BY 1, 2
      )
      SELECT
        city_id,
        month,
        revenue,
        100.0 * (revenue - LAG(revenue) OVER w) / NULLIF(LAG(revenue) OVER w, 0) AS growth_pct
      FROM monthly
      WINDOW w AS (PARTITION BY city_id ORDER BY month)
      ORDER BY city_id, month;
      ~~~

      «100.0» forces decimal division and «NULLIF» turns a zero denominator into NULL. If a city
      skips a month, LAG compares against the last month with data. Say so, and offer a calendar
      spine (generate months, left join) if a missing month should count as zero.
    `,
    signals: [
      'Aggregates before applying the window',
      'Handles division by zero and integer division',
      'Calls out missing months and offers a date spine',
    ],
    followUps: [
      'How would you compute the trailing three-month average instead?',
      'Revenue arrives up to three days late. How does that change a daily version of this report?',
    ],
  },
  {
    slug: 'latest-trip-status',
    title: 'Latest status per trip',
    track: 'sql',
    kind: 'sql',
    difficulty: 'easy',
    companies: ['uber'],
    prompt: `
      «trip_events(trip_id, status, event_ts, kafka_offset)» receives one row per status change,
      with duplicates from client retries. Return the current status of every trip.
    `,
    hints: ['This is "keep one row per key".', 'Think about two events with the same event_ts.'],
    answer: `
      ~~~sql
      SELECT trip_id, status, event_ts
      FROM (
        SELECT
          trip_id, status, event_ts,
          ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY event_ts DESC, kafka_offset DESC) AS rn
        FROM trip_events
      ) t
      WHERE rn = 1;
      ~~~

      The offset breaks timestamp ties so the output is deterministic. Mention the clock question:
      if «event_ts» is the device clock, a phone with a wrong clock can make an old event look
      newest. A source sequence number per trip is safer when it exists.
    `,
    signals: [
      'Uses ROW_NUMBER with a deterministic tie-breaker',
      'Questions which timestamp defines "latest"',
      'Suggests deduplicating once upstream instead of in every query',
    ],
    followUps: [
      'The table has 50 billion rows. How do you keep this query cheap every hour?',
      'How would you serve the current status with seconds of freshness?',
    ],
  },
  {
    slug: 'not-in-null-trap',
    title: 'Riders who never cancelled',
    track: 'sql',
    kind: 'sql',
    difficulty: 'easy',
    companies: ['google'],
    prompt: `
      A teammate wrote this and it returns zero rows. Explain why and fix it.

      ~~~sql
      SELECT rider_id FROM riders
      WHERE rider_id NOT IN (SELECT rider_id FROM cancellations);
      ~~~

      «cancellations.rider_id» is nullable because guest checkouts have no rider.
    `,
    hints: [
      'What is the result of 5 <> NULL?',
      'Look for an operator that tests for a match instead.',
    ],
    answer: `
      «NOT IN» is true only if the value differs from **every** element. Comparing with NULL gives
      unknown, so one NULL makes every row unknown and nothing passes.

      ~~~sql
      SELECT r.rider_id
      FROM riders r
      WHERE NOT EXISTS (
        SELECT 1 FROM cancellations c WHERE c.rider_id = r.rider_id
      );
      ~~~

      Alternatives: a left join with «WHERE c.rider_id IS NULL», or filtering NULLs inside the
      subquery. «NOT EXISTS» is the one to prefer because it is correct whatever the data.
    `,
    signals: [
      'Explains three-valued logic precisely',
      'Prefers NOT EXISTS because it is robust to future NULLs',
      'Mentions an anti-join plan and its cost',
    ],
    followUps: ['How does the engine execute NOT EXISTS on two large tables?'],
  },
  {
    slug: 'driver-longest-streak',
    title: 'Longest active streak per driver',
    track: 'sql',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      «driver_sessions(driver_id, online_at TIMESTAMP, offline_at TIMESTAMP)». A driver can have
      several sessions per day. Return each driver's longest run of consecutive days with at least
      one session, with its start and end dates.
    `,
    hints: [
      'Reduce to one row per driver per day first.',
      'Consecutive dates minus a row number give a constant.',
      'Then rank the islands by length.',
    ],
    answer: `
      ~~~sql
      WITH days AS (
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
      ~~~

      Edge cases to raise: a session that crosses midnight (count both days by generating the
      dates between «online_at» and «offline_at»), and the time zone that defines a driver's day
      (the city's local zone, not UTC).
    `,
    signals: [
      'Deduplicates to driver-day before the trick',
      'Handles sessions across midnight',
      'Uses the city local time zone for the day boundary',
      'Breaks ties between equal-length streaks deliberately',
    ],
    followUps: ['Make it incremental: how do you update streaks daily without rescanning history?'],
  },
  {
    slug: 'sessionize-app-events',
    title: 'Sessionize app events',
    track: 'sql',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      «app_events(user_id, event_time, event_name)». A session ends after 30 minutes without an
      event. Return per user and session: start, end, number of events and duration in seconds.
    `,
    hints: [
      'Flag rows where the gap from the previous event is over 30 minutes.',
      'A running sum of the flags is a session number.',
    ],
    answer: `
      ~~~sql
      WITH gaps AS (
        SELECT
          user_id, event_time,
          CASE
            WHEN event_time - LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time)
                 <= INTERVAL '30 minutes' THEN 0
            ELSE 1
          END AS new_session
        FROM app_events
      ),
      numbered AS (
        SELECT user_id, event_time,
               SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_time
                                      ROWS UNBOUNDED PRECEDING) AS session_id
        FROM gaps
      )
      SELECT
        user_id, session_id,
        MIN(event_time) AS session_start,
        MAX(event_time) AS session_end,
        COUNT(*) AS events,
        EXTRACT(EPOCH FROM MAX(event_time) - MIN(event_time)) AS duration_s
      FROM numbered
      GROUP BY user_id, session_id;
      ~~~

      The first event has a NULL gap, which falls to «ELSE 1» and starts session 1. Point out that
      a single-event session has duration 0, and discuss whether to add a fixed tail (for example
      30 seconds) for analytics.
    `,
    signals: [
      'Uses the flag and running-sum pattern',
      'Handles the first event NULL correctly',
      'Discusses event time versus arrival time and late events',
      'Mentions the cost: one sort per user partition, skew from bots',
    ],
    followUps: [
      'Events can arrive up to 2 hours late. How would a daily batch job handle sessions that span the boundary?',
      'How would you do this in a streaming engine?',
    ],
  },
  {
    slug: 'top-videos-with-ties',
    title: 'Top 3 videos per category per day',
    track: 'sql',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['google'],
    prompt: `
      «video_views(view_id, video_id, category, viewed_at)» may contain duplicate «view_id» rows.
      For each day and category, return the top 3 videos by views. If videos tie at third place,
      include all of them.
    `,
    hints: [
      'Remove duplicate view_id rows before counting.',
      'Which ranking function keeps ties but still means "top 3"?',
    ],
    answer: `
      ~~~sql
      WITH views AS (
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
      WHERE rnk <= 3
      ORDER BY day, category, rnk;
      ~~~

      «RANK» includes every video tied at third and never returns a fourth distinct position.
      «DENSE_RANK <= 3» would return all videos with the three highest counts, which can be many
      more rows. State the choice and why.
    `,
    signals: [
      'Deduplicates by view_id before counting',
      'Chooses RANK over DENSE_RANK and explains the difference',
      'Considers the day boundary time zone',
    ],
    followUps: [
      'At YouTube scale, how would you precompute this so a dashboard loads in under a second?',
    ],
  },
  {
    slug: 'trip-funnel-by-city',
    title: 'Trip funnel by city',
    track: 'sql',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      «trip_events(trip_id, city_id, status, event_ts)» with statuses «requested», «accepted»,
      «picked_up», «completed», «cancelled». For last week, return per city the share of requested
      trips that were accepted, picked up and completed, in that order.
    `,
    hints: [
      'Pivot to one row per trip with the first time of each status.',
      'Each step only counts if it happened after the previous step.',
    ],
    answer: `
      ~~~sql
      WITH per_trip AS (
        SELECT
          trip_id,
          city_id,
          MIN(CASE WHEN status = 'requested' THEN event_ts END) AS t_req,
          MIN(CASE WHEN status = 'accepted'  THEN event_ts END) AS t_acc,
          MIN(CASE WHEN status = 'picked_up' THEN event_ts END) AS t_pick,
          MIN(CASE WHEN status = 'completed' THEN event_ts END) AS t_done
        FROM trip_events
        WHERE event_ts >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'
          AND event_ts <  DATE_TRUNC('week', CURRENT_DATE)
        GROUP BY trip_id, city_id
      )
      SELECT
        city_id,
        COUNT(t_req) AS requested,
        AVG(CASE WHEN t_acc  > t_req  THEN 1.0 ELSE 0 END) AS accept_rate,
        AVG(CASE WHEN t_pick > t_acc  AND t_acc > t_req THEN 1.0 ELSE 0 END) AS pickup_rate,
        AVG(CASE WHEN t_done > t_pick AND t_pick > t_acc AND t_acc > t_req THEN 1.0 ELSE 0 END)
          AS completion_rate
      FROM per_trip
      WHERE t_req IS NOT NULL
      GROUP BY city_id;
      ~~~

      Raise the edge cases: a trip requested late on Sunday and completed on Monday is cut by the
      time filter (filter on the request time only, and allow later events), and a re-dispatched
      trip can be accepted twice.
    `,
    signals: [
      'Pivots with conditional aggregation in one pass',
      'Enforces step order',
      'Filters the population on request time so trips are not cut in half',
      'Uses decimal maths for rates',
    ],
    followUps: ['How would you show where in the funnel cancellations happen?'],
  },
  {
    slug: 'median-trip-duration',
    title: 'Median trip duration without MEDIAN',
    track: 'sql',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      «trips(trip_id, city_id, duration_s)». Your engine has no «MEDIAN» or «PERCENTILE_CONT».
      Return the median trip duration per city, averaging the two middle values for an even count.
    `,
    hints: [
      'Number the rows in order and count them per city.',
      'For n rows the middle positions are floor((n+1)/2) and floor((n+2)/2).',
    ],
    answer: `
      ~~~sql
      WITH ordered AS (
        SELECT
          city_id, duration_s,
          ROW_NUMBER() OVER (PARTITION BY city_id ORDER BY duration_s) AS rn,
          COUNT(*)     OVER (PARTITION BY city_id) AS n
        FROM trips
        WHERE duration_s IS NOT NULL
      )
      SELECT city_id, AVG(duration_s) AS median_s
      FROM ordered
      WHERE rn IN (FLOOR((n + 1) / 2.0), FLOOR((n + 2) / 2.0))
      GROUP BY city_id;
      ~~~

      For odd n both positions are the same row. For even n they are the two middle rows. Mention
      the cost (a full sort per city) and that at scale you would use an approximate quantile
      sketch such as «APPROX_QUANTILES» in BigQuery or t-digest.
    `,
    signals: [
      'Handles odd and even counts in one expression',
      'Excludes NULL durations deliberately',
      'Offers approximate quantiles for scale and says when they are acceptable',
    ],
    followUps: ['How would you compute p95 latency per city per minute on a stream?'],
  },
  {
    slug: 'weekly-retention-cohorts',
    title: 'Weekly retention by signup cohort',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      «users(user_id, signup_at)» and «sessions(user_id, started_at)». Return a retention table:
      cohort week, week number 0 to 8, active users, and retention as a share of the cohort size.
      Cohorts with no activity in a week must still show that week with 0.
    `,
    hints: [
      'Cohort size comes from users, not from sessions.',
      'Generate the grid of cohort × week number, then left join activity.',
      'Count distinct users per cohort and week offset.',
    ],
    answer: `
      ~~~sql
      WITH cohorts AS (
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
        SELECT
          c.cohort_week,
          (CAST(DATE_TRUNC('week', se.started_at) AS DATE) - CAST(c.cohort_week AS DATE)) / 7
            AS week_number,
          COUNT(DISTINCT se.user_id) AS active_users
        FROM cohorts c
        JOIN sessions se ON se.user_id = c.user_id AND se.started_at >= c.cohort_week
        GROUP BY 1, 2
      )
      SELECT
        g.cohort_week,
        g.week_number,
        COALESCE(a.active_users, 0) AS active_users,
        ROUND(COALESCE(a.active_users, 0) * 1.0 / g.cohort_size, 4) AS retention
      FROM grid g
      LEFT JOIN activity a
        ON a.cohort_week = g.cohort_week AND a.week_number = g.week_number
      WHERE g.cohort_week + g.week_number * INTERVAL '7 days' <= CURRENT_DATE
      ORDER BY 1, 2;
      ~~~

      The last filter drops weeks that have not happened yet, so new cohorts do not show false
      zeros. «generate_series» is Postgres; in BigQuery use «UNNEST(GENERATE_ARRAY(0, 8))».
    `,
    signals: [
      'Takes cohort size from the users table, so inactive users count in the denominator',
      'Builds a grid so zero weeks appear',
      'Drops future weeks instead of reporting false zeros',
      'Notes dialect differences for date maths and series generation',
    ],
    followUps: [
      'This runs daily on two years of sessions. How do you make it incremental?',
      'Product asks for retention by acquisition channel too. What changes in the model?',
    ],
  },
  {
    slug: 'ad-clicks-dedup-ctr',
    title: 'Click-through rate with click deduplication',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['google'],
    prompt: `
      «impressions(imp_id, ad_id, user_id, ts)» and «clicks(click_id, imp_id, ts)». Users double
      click: count at most one click per impression, and ignore clicks more than 30 minutes after
      the impression (likely bots or stale pages). Return daily CTR per ad.
    `,
    hints: [
      'Join clicks to impressions to get the impression time and ad.',
      'Keep one valid click per imp_id.',
      'CTR = impressions with a valid click / impressions.',
    ],
    answer: `
      ~~~sql
      WITH valid_clicks AS (
        SELECT DISTINCT c.imp_id
        FROM clicks c
        JOIN impressions i ON i.imp_id = c.imp_id
        WHERE c.ts >= i.ts
          AND c.ts <= i.ts + INTERVAL '30 minutes'
      )
      SELECT
        CAST(i.ts AS DATE) AS day,
        i.ad_id,
        COUNT(*) AS impressions,
        COUNT(v.imp_id) AS clicked_impressions,
        COUNT(v.imp_id) * 1.0 / COUNT(*) AS ctr
      FROM impressions i
      LEFT JOIN valid_clicks v ON v.imp_id = i.imp_id
      GROUP BY 1, 2;
      ~~~

      Attribute the click to the impression's day, not the click's day, so CTR never exceeds 1.
      Discuss duplicates in «impressions» too (dedupe by «imp_id»), and that a click can arrive in
      the next day's partition: the daily job must reprocess the previous day, or use a watermark.
    `,
    signals: [
      'Counts impressions with a click, not raw clicks, so CTR is at most 1',
      'Attributes by impression day',
      'Handles clicks that land in the next partition',
      'Separates bot filtering policy from the query and calls it a business rule',
    ],
    followUps: [
      'How would you make this real-time with Dataflow and still correct after late clicks?',
    ],
  },
  {
    slug: 'org-chart-span-of-control',
    title: 'Total reports under every manager',
    track: 'sql',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['google'],
    prompt: `
      «employees(employee_id, name, manager_id)» holds the org chart. «manager_id» is NULL for
      the CEO. For every employee, return the number of direct reports, the number of all reports
      at any depth, and how many levels sit below them.
    `,
    hints: [
      'A self-join counts direct reports only. The depth is unknown.',
      'Build every (ancestor, descendant) pair with a recursive CTE.',
      'Carry the depth so you can count direct reports from the same pairs.',
    ],
    answer: `
      Build the transitive closure: one row per (ancestor, descendant, depth). Then aggregate per
      ancestor. A left join keeps people with no reports.

      ~~~sql
      WITH RECURSIVE reports AS (
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
      GROUP BY m.employee_id, m.name
      ORDER BY total_reports DESC, m.employee_id;
      ~~~

      | employee_id | name | direct_reports | total_reports | levels_below |
      |---|---|---|---|---|
      | 1 | Asha | 2 | 5 | 3 |
      | 2 | Ben | 1 | 2 | 2 |
      | 5 | Eli | 0 | 0 | 0 |

      The anchor starts from every employee-manager edge, not only the CEO, so each manager is
      an ancestor of their whole subtree. The depth cap guards against a bad record that
      creates a cycle.
    `,
    signals: [
      'Builds ancestor and descendant pairs instead of walking from the root only',
      'Uses a left join so leaves report zero',
      'Adds a depth cap or cycle guard',
      'Suggests storing the closure table if this runs often',
    ],
    followUps: [
      'The org chart changes daily and HR needs it as of any past date. What do you store?',
    ],
  },
  {
    slug: 'regional-subtotals-report',
    title: 'Revenue report with subtotals and shares',
    track: 'sql',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      From «trips(region, city, fare)», produce one result with revenue per city, a subtotal per
      region and a grand total. Each row also shows its share of the grand total and its share of
      its region. Some trips have a NULL city and must show as «unknown», not be mistaken for a
      subtotal.
    `,
    hints: [
      'One scan with ROLLUP.',
      'GROUPING() tells subtotal rows from real NULLs.',
      'Window functions over the rolled-up result give the shares.',
    ],
    answer: `
      ~~~sql
      WITH rolled AS (
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
             ROUND(100.0 * revenue / MAX(CASE WHEN g_city = 1 THEN revenue END) OVER (PARTITION BY region, g_region), 1) AS pct_of_region
      FROM rolled
      ORDER BY g_region, region, g_city, revenue DESC;
      ~~~

      | region | city | revenue | pct_of_total | pct_of_region |
      |---|---|---|---|---|
      | EU | lon | 14.00 | 16.1 | 56.0 |
      | EU | unknown | 5.00 | 5.7 | 20.0 |
      | EU | ALL | 25.00 | 28.7 | 100.0 |
      | NA | nyc | 50.00 | 57.5 | 80.6 |
      | TOTAL | ALL | 87.00 | 100.0 | 100.0 |

      - «ROLLUP (region, city)» gives city rows, region subtotals and the grand total in one scan.
      - «GROUPING(city) = 1» marks the subtotal, so the trip with a NULL city stays a separate
        «unknown» row.
      - The grand total is the row where «g_region = 1»; a window over all rows picks it up.
        The region total is the «g_city = 1» row within each region.
    `,
    signals: [
      'Uses ROLLUP or GROUPING SETS instead of three scans',
      'Uses GROUPING() to separate real NULLs from subtotal rows',
      'Computes shares with window functions over the rolled-up result',
      'Notes that distinct counts cannot be summed up the hierarchy',
    ],
    followUps: [
      'Add distinct riders per row. Why can you not sum the city values to get the region value?',
    ],
  },
  {
    slug: 'referral-chain-root',
    title: 'Find the original referrer',
    track: 'sql',
    kind: 'sql',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      «referrals(user_id, referred_by)» records who invited whom. «referred_by» is NULL for users
      who signed up on their own. Growth wants, for every user, the root of their referral chain
      and the chain length. Bad data contains cycles (7 referred 8 and 8 referred 7). The query
      must finish and flag those users.
    `,
    hints: [
      'Walk upward from each user, one hop per round.',
      'Carry the path of visited ids as a string or array.',
      'Keep the deepest row per user. Was it the true root?',
    ],
    answer: `
      Walk up from every user. Each round moves to the next referrer and appends it to a path.
      A referrer already in the path means a cycle, so the walk stops.

      ~~~sql
      WITH RECURSIVE walk AS (
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
      WHERE d.rn = 1
      ORDER BY d.user_id;
      ~~~

      | user_id | root_user | chain_length | stopped_early |
      |---|---|---|---|
      | 4 | 1 | 3 | false |
      | 6 | 5 | 1 | false |
      | 7 | 8 | 1 | true |
      | 8 | 7 | 1 | true |

      «stopped_early» is true when the last ancestor still has a referrer, which means the walk
      hit a cycle or the depth cap. Those users go to a data quality queue rather than into a
      growth report. In BigQuery, use an «ARRAY» of ids and «IN UNNEST(path)» instead of string
      matching, and remember its 500-iteration limit.
    `,
    signals: [
      'Walks upward from every user rather than downward from roots',
      'Detects cycles with a visited path, not only a depth cap',
      'Picks the deepest row per user with a window function',
      'Flags rows that ended on a cycle instead of silently returning them',
      'Knows the engine’s recursion limit',
    ],
    followUps: [
      'There are 400 million users. How do you compute this daily without recursion at all?',
    ],
  },
];
