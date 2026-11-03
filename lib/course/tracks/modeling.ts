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
    {
      slug: 'data-vault',
      title: 'Data Vault: hubs, links and satellites',
      summary:
        'Model an integration layer that absorbs many changing sources, keeps full history and stays insert-only.',
      minutes: 16,
      body: `
        A star schema is built for people who ask questions. **Data Vault** is built for the layer
        under it: the place where twenty source systems land, each with its own keys, its own
        schema changes and its own release calendar. It trades query comfort for three things:
        every source loads in parallel, history is never overwritten, and a new source adds
        tables instead of changing old ones.

        ## The three table types

        | Table | Holds | Example |
        |---|---|---|
        | **Hub** | One row per business key, ever. Nothing else. | «hub_rider»: rider key, hash key, first load time, source |
        | **Link** | One row per relationship between hubs | «link_trip»: rider, driver and vehicle hash keys |
        | **Satellite** | Descriptive attributes of one hub or link, with history | «sat_rider_profile»: name, rating, city, load time, hash diff |

        Hubs and links never change after insert. Satellites add a row when the attributes change,
        which a **hash diff** (a hash of all descriptive columns) detects cheaply. The result is
        an insert-only model: a load is a set of appends, so you can rerun it and replay it.

        ~~~sql
        CREATE TABLE hub_rider (
          rider_hk      CHAR(32)    NOT NULL PRIMARY KEY,  -- md5 of the business key
          rider_id      VARCHAR     NOT NULL,              -- the business key
          load_ts       TIMESTAMP   NOT NULL,
          record_source VARCHAR     NOT NULL
        );

        CREATE TABLE sat_rider_profile (
          rider_hk      CHAR(32)    NOT NULL,
          load_ts       TIMESTAMP   NOT NULL,
          hash_diff     CHAR(32)    NOT NULL,
          full_name     VARCHAR,
          home_city     VARCHAR,
          record_source VARCHAR     NOT NULL,
          PRIMARY KEY (rider_hk, load_ts)
        );
        ~~~

        ## Why hash keys

        Data Vault 2.0 replaces sequence surrogate keys with a hash of the business key. Every
        loader can compute the key on its own, so the hub, the link and the satellite load in
        parallel without a lookup. The cost: 16 to 32 bytes per key instead of 8, and a
        collision risk that is real only at absurd volumes. Normalise the business key first
        (trim, upper case, a fixed separator for composite keys), or the same rider gets two
        hashes.

        ## Raw vault, business vault, marts

        1. **Raw vault:** the sources as they are, split into hubs, links and satellites. No
           business rules, so it is auditable.
        2. **Business vault:** derived satellites with rules applied, such as a resolved
           customer, and helper tables. A **point-in-time (PIT)** table lists, for each key and
           snapshot date, the satellite row that was current. A **bridge** table pre-joins hubs
           and links along a common path.
        3. **Marts:** star schemas on top, built from PIT and bridge tables. Analysts never query
           the vault directly.

        > [!senior] When to choose it, and when not
        > Choose Data Vault when there are many sources that change often, when auditors must
        > trace every value to its source and load, and when several teams load in parallel. Banks
        > and insurers fit. For one product database feeding dashboards, it is three times the
        > tables for no gain: build staging and a star schema. Say that the vault is an
        > integration layer and that you still build dimensional marts on top.

        > [!trap] Satellites split by rate of change
        > Put a rider's name and their live rating in one satellite and the rating's daily change
        > copies the name every day. Split satellites by source and by how often the columns
        > change.
      `,
      checks: [
        {
          question:
            'Where does a rider’s home city, which changes over time, live in a Data Vault?',
          options: [
            'In the hub, updated in place',
            'In a satellite on the rider hub, with a new row per change',
            'In a link between rider and city',
            'In the point-in-time table only',
          ],
          answer: 1,
          why: 'Hubs hold only the business key. Descriptive attributes and their history live in satellites, which are insert-only.',
        },
        {
          question: 'Why does Data Vault 2.0 use a hash of the business key instead of a sequence?',
          options: [
            'Hashes are smaller than integers',
            'Each table can compute keys without a lookup, so hubs, links and satellites load in parallel',
            'Hashes hide personal data',
            'Sequences cannot be joined',
          ],
          answer: 1,
          why: 'A deterministic hash removes the dependency on the hub load, so all tables load at once.',
        },
      ],
    },
    {
      slug: 'activity-schema-and-graphs',
      title: 'Activity schema and graph models',
      summary:
        'Model customer journeys as one activity stream, and relationships as nodes and edges, and know when each fits.',
      minutes: 15,
      body: `
        Two shapes answer questions that a star schema answers badly: "what did this customer do
        before and after X" and "who is connected to whom, in several hops".

        ## Activity schema: one stream per entity

        An **activity schema** stores everything a customer does in one narrow table, with a
        fixed set of columns, instead of one fact table per process.

        | Column | Meaning |
        |---|---|
        | «activity_id» | Unique id of the event |
        | «ts» | When it happened |
        | «customer» | The entity the stream is about |
        | «activity» | A short name: «signed_up», «requested_trip», «completed_trip» |
        | «feature_json» | A few attributes specific to that activity |
        | «revenue_impact» | Money, if any |
        | «activity_occurrence» | 1 for the customer’s first time, 2 for the second |
        | «activity_repeated_at» | When the customer next did the same activity |

        Each new activity is a new value of «activity», not a new table. Questions become
        **temporal joins** between two activities of the same customer: "first completed trip
        after signing up", "last support ticket before cancelling". The two precomputed columns
        make the common ones cheap: «activity_occurrence = 1» is a first-ever filter, and
        «activity_repeated_at» bounds "in between" joins.

        ~~~sql
        -- Days from signup to first completed trip
        SELECT s.customer,
               MIN(c.ts) - s.ts AS time_to_first_trip
        FROM activity_stream s
        JOIN activity_stream c
          ON c.customer = s.customer
         AND c.activity = 'completed_trip'
         AND c.ts >= s.ts
        WHERE s.activity = 'signed_up' AND s.activity_occurrence = 1
        GROUP BY s.customer, s.ts;
        ~~~

        It suits journey and funnel analysis, and it makes a new source cheap. It suits money and
        inventory badly: those need typed columns, constraints and a clear grain, so keep a star
        schema for them.

        ## Graph models: when relationships are the data

        A **property graph** has nodes (rider, device, card, address) and edges (USED, PAID_WITH,
        LIVES_AT), and both carry properties. In a warehouse the same graph is two tables: a node
        table and an edge table with «src», «dst», «type» and validity times.

        | Store it as | Good at | Weak at |
        |---|---|---|
        | Edge table in the warehouse | Batch analytics, one or two hops, recursive CTEs | Deep traversals at request time |
        | Graph database (Neo4j, Amazon Neptune, Spanner Graph) | Many hops with low latency, path queries | Wide aggregations, scans |
        | Adjacency lists in a key-value store | One-hop lookups at huge scale | Anything multi-hop |

        A fraud team asking "which accounts share a device or a card with this banned account,
        within three hops" is a graph question. A dashboard counting accounts per city is not.

        > [!senior] Model edges with time
        > A rider shared a device with a fraudster last year, not today. Give each edge
        > «valid_from» and «valid_to», like an SCD type 2 row. Without it, old links pull innocent
        > accounts into every ring, and a model trained on the graph leaks the future.

        > [!trap] Super nodes
        > A shared office Wi-Fi address or a default device id connects thousands of accounts.
        > One traversal through it touches everything. Cap the degree, or drop edges to nodes
        > above a threshold, before you run multi-hop queries.
      `,
      checks: [
        {
          question: 'Product adds a new event, "rated_driver". What changes in an activity schema?',
          options: [
            'A new fact table and a new dimension',
            'Nothing structural: rows with activity = rated_driver appear in the same stream',
            'A new column on the stream table',
            'A new satellite',
          ],
          answer: 1,
          why: 'The schema is fixed. A new activity is a new value in the activity column, with its specifics in feature_json.',
        },
        {
          question: 'Which question most needs a graph store rather than a warehouse table?',
          options: [
            'Daily trips per city',
            'At request time, find accounts within three hops of a banned card',
            'Revenue by product line by month',
            'The top 10 drivers by rating',
          ],
          answer: 1,
          why: 'Low-latency multi-hop traversal is what graph stores are built for. The others are scans and aggregations.',
        },
      ],
    },
    {
      slug: 'normalization-and-special-dimensions',
      title: 'Normal forms and the special dimensions',
      summary:
        'Explain why sources normalize and warehouses do not, and use junk, role-playing, mini and bridge dimensions correctly.',
      minutes: 14,
      body: `
        ## Normal forms in one minute

        Operational databases normalize so each fact is stored once and an update touches one row.

        - **1NF:** every column holds one value; no repeating groups such as «phone1», «phone2».
        - **2NF:** every non-key column depends on the whole key, not part of a composite key.
        - **3NF:** no non-key column depends on another non-key column. A city name stored next
          to a city id on every trip breaks it.

        A warehouse denormalizes on purpose. It is read far more than it is written, columns
        compress repeated values well, and a join avoided is a shuffle avoided. The interview
        point is that you know which rule you are breaking and why. An ER diagram of the source
        is still where modeling starts, because it shows the real keys and cardinalities.

        ## The special dimensions

        | Pattern | Problem it solves | Example |
        |---|---|---|
        | **Junk dimension** | Many low-cardinality flags clutter the fact | «dim_trip_flags»: one row per combination of is_pool, is_scheduled, payment_type |
        | **Role-playing dimension** | One dimension used several times by one fact | «dim_date» as request date, pickup date and payout date, through views |
        | **Degenerate dimension** | An id with no attributes of its own | «order_id» kept on the fact, no table |
        | **Mini-dimension** | A few attributes change too often for SCD 2 | Rider rating band and tenure band split out of «dim_rider» |
        | **Bridge table** | A many-to-many between a fact and a dimension | A trip with several promotions: «bridge_trip_promo» with a weight per row |
        | **Outrigger** | A dimension that references another dimension | «dim_driver» pointing at «dim_vehicle» |

        A junk dimension with five flags of two to four values each has at most a few hundred
        rows. The fact carries one small key instead of five columns, and the flag
        combinations get readable labels.

        ~~~sql
        -- Role-playing: one physical table, three views with clear names
        CREATE VIEW dim_request_date AS SELECT date_key AS request_date_key, calendar_date AS request_date FROM dim_date;
        CREATE VIEW dim_pickup_date  AS SELECT date_key AS pickup_date_key,  calendar_date AS pickup_date  FROM dim_date;
        ~~~

        > [!trap] Bridge tables double count
        > Join a trip to its two promotions and the fare appears twice. Either allocate with a
        > weight column that sums to 1 per trip, or tell users that the bridge answers "trips
        > touched by promo X", not "revenue from promo X".

        > [!senior] Name the pattern, then the cost
        > "That is a mini-dimension: the rating band changes weekly, so in SCD 2 it would create a
        > new rider row each week. I split it out and put its key on the fact." Naming the
        > pattern and the reason is what interviewers listen for.
      `,
      checks: [
        {
          question:
            'A trip fact needs request date, pickup date and payout date. What is the standard design?',
          options: [
            'Three separate date dimension tables with copied data',
            'One date dimension used in three roles, usually through views',
            'Store the three dates as strings on the fact',
            'A bridge table between trips and dates',
          ],
          answer: 1,
          why: 'That is a role-playing dimension: one physical table, joined three times under different names.',
        },
        {
          question: 'A trip can have several promotions. What is the risk of a bridge table?',
          options: [
            'It cannot be indexed',
            'Additive measures such as fare are counted once per promotion unless weighted',
            'It breaks SCD type 2',
            'It forces a snowflake schema',
          ],
          answer: 1,
          why: 'A many-to-many join multiplies fact rows. A weight column or a clear meaning prevents double counting.',
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
  {
    slug: 'data-vault-rider-integration',
    title: 'Integrate rider data from four systems',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      Rider data comes from four systems: the app database (rider id), payments (card holder id),
      the support CRM (email-based contact id) and a recently acquired scooter company (its own
      user id). Each changes schema a few times a year. Auditors want every number in the rider
      mart traced to its source row and load. Design the integration layer and say how the
      rider dimension is built on top.
    `,
    hints: [
      'What is the one thing that never changes for a rider in each system?',
      'How do you record that two keys are the same person without merging them?',
      'Think about point-in-time tables for the mart.',
    ],
    answer: `
      A **Data Vault** raw layer, because there are many sources, schema churn and an audit need.

      **Hubs:** «hub_rider» keyed by the app rider id. The other systems’ keys get their own hubs
      («hub_payment_account», «hub_crm_contact», «hub_scooter_user») because their keys are not
      the same business key.

      **Links:**
      - «link_rider_payment_account», «link_rider_crm_contact», loaded from the systems that know
        the mapping.
      - A **same-as link** («sal_rider») for identity resolution with the acquired company: two
        hub keys, a match rule id and a confidence. A wrong match is fixed by adding a new link
        row with an end date, never by deleting.

      **Satellites:** one per source per hub, split by rate of change: «sat_rider_app_profile»,
      «sat_rider_app_rating», «sat_payment_account», «sat_crm_contact». Each has «load_ts»,
      «record_source» and «hash_diff». A schema change in the CRM adds columns to its satellite
      or a new satellite; nothing else moves.

      **Business vault:** a computed satellite that resolves the golden record (which source wins
      for name, email, home city) with the rule recorded per column, and a **PIT table** with
      one row per rider per day naming the current row of each satellite.

      **Mart:** «dim_rider» as SCD type 2, built from the PIT table with simple equi-joins. Every
      column carries lineage back to a satellite row, and the satellite row to a source and a
      load time, which is the audit answer.
    `,
    signals: [
      'Justifies Data Vault from many sources, churn and audit, not fashion',
      'Keeps different business keys in different hubs and links them',
      'Uses a same-as link for identity resolution that can be corrected without deletes',
      'Splits satellites by source and rate of change',
      'Builds the dimensional mart from PIT tables, not directly on the raw vault',
    ],
    followUps: [
      'The match rule merged two different riders for six months. How do you correct history in the mart?',
      'How do you handle a GDPR erasure request in an insert-only model?',
    ],
  },
  {
    slug: 'fraud-ring-graph-model',
    title: 'Find accounts linked to a banned card',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      Risk wants a nightly list of accounts within two hops of any banned account, where a hop is
      a shared device, payment card or phone number. Design the tables in the warehouse and write
      the query. What breaks at scale?
    `,
    hints: [
      'Accounts are not linked to each other directly. What sits between them?',
      'Model it as nodes and edges.',
      'A shared office device links thousands of accounts.',
    ],
    answer: `
      **Model:** an edge table between accounts and identifiers, with time.

      ~~~sql
      CREATE TABLE account_identifier_edge (
        account_id  VARCHAR NOT NULL,
        id_type     VARCHAR NOT NULL,   -- device, card, phone
        id_value    VARCHAR NOT NULL,   -- hashed
        valid_from  TIMESTAMP NOT NULL,
        valid_to    TIMESTAMP           -- NULL while current
      );
      ~~~

      Two accounts are one hop apart when they share an identifier. Two hops is one more round.

      ~~~sql
      WITH current_edges AS (
        SELECT account_id, id_type, id_value
        FROM account_identifier_edge
        WHERE valid_to IS NULL OR valid_to > CURRENT_DATE - INTERVAL 90 DAY
      ),
      hop1 AS (
        SELECT DISTINCT b.account_id
        FROM banned_accounts x
        JOIN current_edges a ON a.account_id = x.account_id
        JOIN current_edges b ON b.id_type = a.id_type AND b.id_value = a.id_value
      ),
      hop2 AS (
        SELECT DISTINCT d.account_id
        FROM hop1 h
        JOIN current_edges c ON c.account_id = h.account_id
        JOIN current_edges d ON d.id_type = c.id_type AND d.id_value = c.id_value
      )
      SELECT account_id FROM hop1
      UNION
      SELECT account_id FROM hop2
      EXCEPT
      SELECT account_id FROM banned_accounts;
      ~~~

      **At scale:**
      - **Super nodes:** an identifier shared by thousands of accounts (a rental car’s device,
        a corporate card) explodes the join. Compute the degree per identifier and drop edges
        above a threshold, or flag them for review.
      - **Time:** old shared devices create false rings. Keep a recency window on edges.
      - **Request-time checks** (at signup) need a graph store or precomputed neighbour lists in
        a key-value store; the warehouse query is for the nightly batch.
    `,
    signals: [
      'Models identifiers as nodes between accounts, not account-to-account edges only',
      'Keeps validity times on edges',
      'Handles super nodes by degree before traversing',
      'Separates nightly batch from request-time lookups',
    ],
    followUps: ['Risk now wants five hops. What do you change?'],
  },
  {
    slug: 'junk-and-mini-dimensions',
    title: 'Tame a trip fact with twelve flags',
    track: 'modeling',
    kind: 'modeling',
    difficulty: 'easy',
    companies: ['uber', 'google'],
    prompt: `
      The trip fact has twelve boolean and small-enum columns (is_pool, is_scheduled,
      payment_type, surge_band and others). «dim_rider» is SCD type 2 and has a «rating_band»
      that changes most weeks, so the dimension grows by millions of rows a week. Fix both.
    `,
    hints: ['One problem is clutter, the other is churn.', 'Both fixes are small dimensions.'],
    answer: `
      **The flags:** move them to a **junk dimension**, «dim_trip_profile», with one row per
      combination that actually occurs and readable labels. The fact keeps one small key.
      Twelve low-cardinality columns usually produce a few thousand real combinations.

      **The rating band:** split it into a **mini-dimension**, «dim_rider_band», with one row per
      combination of rating band and tenure band. Put «rider_band_key» on the trip fact, so each
      trip records the band at the time of the trip. «dim_rider» stays SCD 2 only for the slow
      attributes and stops growing every week.

      If analysts need the current band per rider, keep it as a type 1 column on «dim_rider» as
      well, and name it clearly («current_rating_band»).
    `,
    signals: [
      'Names the junk dimension and builds it from existing combinations',
      'Names the mini-dimension and explains the SCD 2 churn it stops',
      'Records the band on the fact so history is still right',
    ],
    followUps: ['A new flag arrives. What happens to the junk dimension and the existing facts?'],
  },
];
