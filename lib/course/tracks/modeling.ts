import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'modeling',
  title: 'Data modeling and warehousing',
  summary:
    'Grain, facts, dimensions, slowly changing history and modern layouts, applied to marketplace and ads data.',
  tone: 'peach',
  why: 'Both Uber and Google run a modeling round where you design tables for a product and then query them. Getting the grain right in the first five minutes decides the rest of the hour.',
  lessons: [
    {
      slug: 'grain-facts-dimensions',
      title: 'Grain first, then facts and dimensions',
      summary: 'Declare the grain of every fact table and let it decide the keys and measures.',
      minutes: 13,
      body: `
        Dimensional modeling has one rule that prevents most mistakes: **state the grain of the
        fact table in one sentence before you add a column.** The grain is what one row means.

        > [!example] Good grain sentences
        > "One row per completed trip." "One row per ad impression." "One row per driver per hour
        > online." If you cannot finish the sentence, you are not ready to add columns.

        ## Facts and dimensions

        | | Fact table | Dimension table |
        |---|---|---|
        | Holds | Measurements of an event or a state | Descriptive context |
        | Examples | fare, distance, duration, clicks | rider, driver, city, product, date |
        | Size | Very large, append-heavy | Small to medium, updated |
        | Keys | Foreign keys to dimensions plus a degenerate id | One surrogate key per version |

        ## Three kinds of fact tables

        - **Transaction facts:** one row per event (a trip, a payment). Most common.
        - **Periodic snapshots:** one row per entity per period (driver balance per day). Good for
          "state at a point in time" questions.
        - **Accumulating snapshots:** one row per process instance, updated as it moves through
          milestones (an order: placed, picked, delivered). Good for lag between steps.

        ## Additivity

        Measures are additive (sum across every dimension: fare), semi-additive (sum across some
        dimensions but not time: account balance) or non-additive (never sum: a ratio such as
        surge multiplier). Store the parts of a ratio (numerator and denominator), not the ratio.

        > [!trap] Mixed grain in one table
        > Putting trip-level rows and daily totals in the same table means every «SUM» double
        > counts. One grain per fact table, always.

        > [!senior] Grain follows the questions
        > Ask what the business will query. If nearly every question is per trip, the trip grain is
        > right. If GPS pings matter, they are a separate, finer fact table, not columns on trips.
      `,
      checks: [
        {
          question:
            'You store average surge multiplier per trip and analysts sum it by city. What should you store instead?',
          options: [
            'The same average, but rounded',
            'The parts: surge revenue and base revenue, so the ratio can be recomputed at any level',
            'A daily average per city only',
            'Nothing, surge is not a fact',
          ],
          answer: 1,
          why: 'Ratios are non-additive. Storing numerator and denominator lets any aggregation compute the correct ratio.',
        },
      ],
    },
    {
      slug: 'slowly-changing-dimensions',
      title: 'Slowly changing dimensions',
      summary: 'Keep history where it matters with SCD type 2, and load it correctly with MERGE.',
      minutes: 15,
      body: `
        Dimensions change: a driver moves city, a restaurant changes its cuisine, a product changes
        category. The question is whether facts should see the old value or the new one.

        | Type | What happens on change | Use when |
        |---|---|---|
        | 0 | Never changes | Original signup date |
        | 1 | Overwrite | Typo fixes, values where history does not matter |
        | 2 | New row per version, with validity dates | History matters for reporting |
        | 3 | Previous value in an extra column | Only one prior value matters |

        ## Type 2 in practice

        ~~~sql
        CREATE TABLE dim_driver (
          driver_sk     BIGINT,       -- surrogate key, one per version
          driver_id     STRING,       -- natural key from the source
          city_id       INT,
          vehicle_type  STRING,
          valid_from    TIMESTAMP,
          valid_to      TIMESTAMP,    -- '9999-12-31' for the current row
          is_current    BOOLEAN
        );
        ~~~

        Facts store «driver_sk» captured at event time, so a trip from last year joins to the
        driver's city as it was then. To get current attributes instead, join on «driver_id» with
        «is_current».

        ## Loading type 2 with MERGE

        Two steps: close the current row when a tracked attribute changed, then insert new versions.

        ~~~sql
        -- 1. Close changed rows
        MERGE INTO dim_driver d
        USING staging_driver s
          ON d.driver_id = s.driver_id AND d.is_current
        WHEN MATCHED AND (d.city_id <> s.city_id OR d.vehicle_type <> s.vehicle_type) THEN
          UPDATE SET valid_to = s.changed_at, is_current = FALSE;

        -- 2. Insert new and changed drivers as current rows
        INSERT INTO dim_driver
        SELECT next_sk(), s.driver_id, s.city_id, s.vehicle_type, s.changed_at,
               TIMESTAMP '9999-12-31', TRUE
        FROM staging_driver s
        LEFT JOIN dim_driver d ON d.driver_id = s.driver_id AND d.is_current
        WHERE d.driver_id IS NULL;
        ~~~

        After step 1, changed drivers have no current row, so step 2 inserts them alongside brand
        new drivers. «next_sk()» stands for your key generator.

        > [!trap] NULLs hide changes
        > «d.city_id <> s.city_id» is unknown when either side is NULL, so a change from NULL to a
        > value is missed. Use «IS DISTINCT FROM» or compare hashes of the tracked columns.

        > [!senior] Late changes and reruns
        > Ask what happens if the job reruns, or if a change arrives with an older «changed_at» than
        > the current row. A senior answer makes the load idempotent and either rejects or
        > re-sequences out-of-order changes.
      `,
      checks: [
        {
          question:
            'A trip fact stores driver_sk. The driver moves city next month. Which city does a report on that trip show?',
          options: ['The new city', 'The city at the time of the trip', 'Both cities', 'NULL'],
          answer: 1,
          why: 'The surrogate key points to the dimension version that was current when the trip happened. That is the point of type 2.',
        },
      ],
    },
    {
      slug: 'layouts-star-to-obt',
      title: 'Star, snowflake, wide tables and nested data',
      summary: 'Choose a physical layout for a columnar warehouse and defend it.',
      minutes: 12,
      body: `
        A logical model can be stored in several physical layouts. Modern columnar warehouses
        changed which one is usually best, and interviewers like to hear that you know why.

        | Layout | Shape | Strength | Weakness |
        |---|---|---|---|
        | Star schema | Fact plus denormalised dimensions | Simple joins, clear semantics | Joins at query time |
        | Snowflake | Dimensions normalised into sub-dimensions | Less duplication | More joins, harder for analysts |
        | One big table (OBT) | Fact with dimension columns copied in | No joins, fast scans | History and updates are harder, wide rows |
        | Nested (BigQuery «STRUCT» and «ARRAY») | Child rows stored inside the parent row | Keeps one-to-many together, no join | Needs «UNNEST», tooling support varies |

        ## Why wide tables became popular

        Columnar engines read only the columns a query names, so a 300-column table costs nothing
        for a query that uses five columns. Storage is cheap; joins at petabyte scale are not.
        Many teams keep a star schema as the governed core and publish wide, query-friendly tables
        on top of it for dashboards.

        ## Nested data in BigQuery

        ~~~sql
        -- One row per trip, with its stops as a repeated field
        SELECT
          trip_id,
          stop.sequence,
          stop.lat,
          stop.lng
        FROM trips, UNNEST(stops) AS stop
        WHERE trip_date = '2026-10-31';
        ~~~

        > [!senior] Layout depends on update patterns
        > Wide tables are easy when data is append-only. When dimension attributes change (type 2),
        > copying them into a wide table means rewriting history. Say which attributes are stable
        > enough to denormalise and which stay in a joined dimension.

        ## Partitioning and clustering

        Partition big fact tables by event date so queries prune whole days. Cluster or sort by
        the columns most used in filters, such as «city_id» or «advertiser_id». Avoid partitioning
        on high-cardinality columns: millions of tiny partitions hurt more than they help.
      `,
      checks: [
        {
          question:
            'Why is a 300-column wide table often fine in BigQuery for a query that uses 5 columns?',
          options: [
            'BigQuery caches every column',
            'Columnar storage reads only the referenced columns',
            'Wide tables are compressed into one column',
            'Queries on wide tables are free',
          ],
          answer: 1,
          why: 'Columnar engines scan and bill only the columns a query references, so unused columns cost storage but not query time.',
        },
      ],
    },
    {
      slug: 'modeling-a-marketplace',
      title: 'Modeling a ride-hailing marketplace',
      summary:
        'Walk through a full model for trips, drivers, pricing and payments the way a round expects.',
      minutes: 16,
      body: `
        A modeling round usually sounds like "Design the data model for a ride-hailing app's
        analytics." Here is a structure that works, with the reasoning out loud.

        ## 1. Ask what questions the model must answer

        Trips and revenue by city and hour, cancellation rates and who cancelled, driver
        utilisation, surge effectiveness, and rider retention. These decide the facts.

        ## 2. Declare facts with their grain

        | Fact table | Grain | Key measures |
        |---|---|---|
        | «fact_trip» | One row per trip request | fare, distance, duration, surge parts, status |
        | «fact_trip_event» | One row per trip state change | event time, status |
        | «fact_driver_hour» | One row per driver per hour | minutes online, minutes on trip |
        | «fact_payment» | One row per payment attempt | amount, currency, result |

        ## 3. Conformed dimensions

        «dim_rider», «dim_driver» (type 2 for city and vehicle), «dim_city» (with time zone),
        «dim_date» and «dim_time», «dim_product» (UberX, Comfort, Black). Conformed means every fact
        uses the same dimension, so "trips by city" and "payments by city" agree.

        ## 4. Hard parts to raise yourself

        - **Status changes:** a trip moves through requested, accepted, picked up, completed or
          cancelled. Keep the event fact for timing questions, and an accumulating snapshot style
          set of timestamp columns on «fact_trip» for fast funnel queries.
        - **Money:** fares can be adjusted after the trip (tips, refunds). Store adjustments as
          their own fact rows rather than updating the original fare, so history is auditable.
        - **Currency and time:** store amounts in the local currency plus a converted reporting
          currency with the rate used, and timestamps in UTC plus the city's local date.
        - **Geography:** pickup and dropoff as a cell id (for example an H3 index) as well as raw
          coordinates, so aggregation by area is a join, not a geometry computation.

        > [!senior] Finish with a query
        > Close the round by writing one query the model makes easy, such as cancellation rate by
        > city and hour last week. It proves the model works, and interviewers often ask for it.
      `,
      checks: [
        {
          question: 'A rider adds a tip two days after a trip. Best way to model it?',
          options: [
            'Update the fare on the original trip row',
            'Add an adjustment row in a fact table, linked to the trip',
            'Ignore tips in analytics',
            'Create a new trip',
          ],
          answer: 1,
          why: 'Adjustment rows keep the original fact unchanged and make every change auditable and additive.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'choose-the-grain',
    title: 'Pick the grain for food delivery',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'easy',
    companies: ['uber'],
    prompt: `
      A food delivery team wants to analyse orders: revenue per restaurant, items sold, delivery
      time, and courier performance. An order has several items and one courier.

      What fact tables do you create, and what is the grain of each?
    `,
    hints: [
      'Items and orders are different grains.',
      'Courier performance is about the delivery, not items.',
    ],
    answer: `
      - «fact_order»: one row per order. Measures: order total, fees, delivery time, timestamps for
        placed, accepted, picked up, delivered. Keys: restaurant, eater, courier, date.
      - «fact_order_item»: one row per item line in an order. Measures: quantity, item price.
        Keys: order id (degenerate), menu item, restaurant, date.

      Do not put item columns on the order row or order totals on the item rows. Summing
      «order_total» on the item table would multiply revenue by the number of items. Courier
      metrics come from «fact_order» timestamps, or a separate «fact_courier_shift» if online time
      matters.
    `,
    signals: [
      'Separates order grain from item grain',
      'Explains the double counting risk of mixing grains',
      'Places courier timing at the order or shift grain',
    ],
    followUps: ['A restaurant can refund one item. Where does the refund go?'],
  },
  {
    slug: 'scd2-driver-city',
    title: 'Load an SCD type 2 driver dimension',
    track: 'modeling',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      «dim_driver(driver_sk, driver_id, city_id, valid_from, valid_to, is_current)» is type 2 on
      «city_id». Each day «stg_driver(driver_id, city_id, updated_at)» holds the latest snapshot of
      every driver. Write the daily load. It must be safe to rerun.
    `,
    hints: [
      'Find changed drivers by comparing to current rows.',
      'Close changed rows, then insert new current rows.',
      'NULL-safe comparison, and rerun safety: a second run should change nothing.',
    ],
    answer: `
      ~~~sql
      -- Close the current version when the city changed
      UPDATE dim_driver d
      SET valid_to = s.updated_at, is_current = FALSE
      FROM stg_driver s
      WHERE d.driver_id = s.driver_id
        AND d.is_current
        AND d.city_id IS DISTINCT FROM s.city_id;

      -- Insert a current version for new drivers and drivers just closed
      INSERT INTO dim_driver (driver_sk, driver_id, city_id, valid_from, valid_to, is_current)
      SELECT next_sk(), s.driver_id, s.city_id, s.updated_at, TIMESTAMP '9999-12-31', TRUE
      FROM stg_driver s
      LEFT JOIN dim_driver d ON d.driver_id = s.driver_id AND d.is_current
      WHERE d.driver_id IS NULL;
      ~~~

      Rerun safety: on a second run nothing differs from the current rows, so the update touches
      nothing and every driver already has a current row, so the insert adds nothing. Run both
      statements in one transaction so a failure between them cannot leave drivers with no
      current row.
    `,
    signals: [
      'Uses a NULL-safe comparison',
      'Explains why the load is idempotent',
      'Wraps both steps in one transaction',
      'Mentions drivers deleted at the source',
    ],
    followUps: ['A driver changes city twice in one day. What does your load keep?'],
  },
  {
    slug: 'youtube-views-model',
    title: 'Model video views for analytics',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'medium',
    companies: ['google'],
    prompt: `
      Design tables for video analytics: views, watch time, likes, and creator dashboards that show
      daily totals per video. There are billions of views a day.
    `,
    hints: [
      'The raw grain is one view or one watch segment.',
      'Dashboards need a pre-aggregated table.',
      'Think partitioning and clustering for BigQuery.',
    ],
    answer: `
      - «fact_view»: one row per view session. Measures: watch seconds, completed flag, device,
        country, traffic source. Partition by «view_date», cluster by «video_id».
      - «fact_engagement»: one row per like, comment or share event.
      - «agg_video_daily»: one row per video per day: views, watch seconds, likes, unique viewers
        (approximate, from HyperLogLog sketches so they can be merged across days).
      - Dimensions: «dim_video» (title, creator, category, type 2 on category), «dim_creator»,
        «dim_date», «dim_country».

      Creator dashboards read only «agg_video_daily», which is small and fast. Unique viewers
      across a date range cannot be summed from daily counts, which is why storing mergeable
      sketches matters. Views must be deduplicated and filtered for bots before aggregation.
    `,
    signals: [
      'Separates raw facts from a serving aggregate',
      'Knows unique counts are not additive and proposes sketches',
      'Chooses partition and cluster keys from the access pattern',
      'Mentions bot filtering and deduplication',
    ],
    followUps: ['A video’s view count is corrected after fraud review. How do aggregates update?'],
  },
  {
    slug: 'accumulating-snapshot-orders',
    title: 'Measure lag between order milestones',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      Operations want the average time from order placed to restaurant accepted, accepted to
      picked up, and picked up to delivered, per city per day. Events arrive as a stream of status
      changes. Propose a model that makes this query trivial.
    `,
    hints: ['One row per order, updated as it progresses.', 'This fact type has a name.'],
    answer: `
      An **accumulating snapshot**: «fact_order_lifecycle» with one row per order and one column
      per milestone: «placed_at», «accepted_at», «picked_up_at», «delivered_at», «cancelled_at»,
      plus lag columns computed when the row updates.

      ~~~sql
      SELECT city_id, DATE(placed_at) AS day,
             AVG(TIMESTAMP_DIFF(accepted_at, placed_at, SECOND))     AS s_to_accept,
             AVG(TIMESTAMP_DIFF(picked_up_at, accepted_at, SECOND))  AS s_to_pickup,
             AVG(TIMESTAMP_DIFF(delivered_at, picked_up_at, SECOND)) AS s_to_deliver
      FROM fact_order_lifecycle
      WHERE delivered_at IS NOT NULL
      GROUP BY 1, 2;
      ~~~

      Rows are updated with a «MERGE» as events arrive, which works well on a lakehouse table
      format or a warehouse. Keep the raw status event fact as well, for audit and for orders that
      go back a step (re-dispatch).
    `,
    signals: [
      'Names the accumulating snapshot pattern',
      'Uses MERGE for updates and keeps the raw events',
      'Handles cancelled and in-progress orders explicitly',
    ],
    followUps: ['Averages hide long tails. What would you show instead?'],
  },
  {
    slug: 'ads-click-attribution-model',
    title: 'Model ad attribution',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'hard',
    companies: ['google'],
    prompt: `
      Advertisers want conversions attributed to the last ad click within 7 days, and later want
      to compare with first-click and linear attribution. Design the tables, and say how a new
      attribution model can be added without reprocessing everything.
    `,
    hints: [
      'Keep raw impressions, clicks and conversions as separate facts.',
      'Attribution is a derived fact with a model column.',
      'Think about the 7-day lookback when data arrives late.',
    ],
    answer: `
      Raw facts, immutable and partitioned by date: «fact_impression», «fact_click» (with
      «impression_id»), «fact_conversion» (with user or device key, value, time).

      Derived fact: «fact_attribution» at grain one row per conversion per credited click per
      model: «conversion_id», «click_id», «campaign_id», «model» ('last_click', 'first_click',
      'linear'), «credit» (fraction, sums to 1 per conversion per model), «attributed_value».

      Adding a model means a new job that writes rows with a new «model» value. Nothing else
      changes, and reports filter by model. Because the lookback is 7 days, each daily run
      recomputes attribution for conversions from the last 7 days plus late arrivals, overwriting
      those partitions idempotently. Mention identity: joining clicks to conversions across
      devices needs a user graph and has privacy limits.
    `,
    signals: [
      'Keeps raw facts immutable and attribution derived',
      'Uses a model column so new models are additive',
      'Ensures credits sum to one per conversion',
      'Handles the lookback window with partition overwrites',
      'Raises identity and privacy constraints',
    ],
    followUps: ['How do you show advertisers numbers that do not change every day for a week?'],
  },
  {
    slug: 'factless-promotion-coverage',
    title: 'Which promotions had no trips?',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'easy',
    companies: ['uber'],
    prompt: `
      Marketing runs promotions per city per day. They ask: "Which active promotions produced no
      trips?" The trip fact has a «promo_id» column. Why can't you answer from the trip fact alone,
      and what table do you add?
    `,
    hints: [
      'A trip fact only has rows for things that happened.',
      'Record what was eligible, not just what happened.',
    ],
    answer: `
      The trip fact only contains trips. A promotion with zero trips has no rows, so it is
      invisible. Add a **factless fact table** that records coverage: «fact_promo_active» with one
      row per promotion per city per day it was live, and no measures.

      ~~~sql
      SELECT a.promo_id, a.city_id, a.day
      FROM fact_promo_active a
      LEFT JOIN fact_trip t
        ON t.promo_id = a.promo_id AND t.city_id = a.city_id AND t.trip_date = a.day
      WHERE t.trip_id IS NULL;
      ~~~
    `,
    signals: [
      'Explains why absence cannot be queried from an event fact',
      'Names the factless fact pattern',
      'Writes the anti-join',
    ],
    followUps: ['How would you measure promotion lift, not just usage?'],
  },
];
