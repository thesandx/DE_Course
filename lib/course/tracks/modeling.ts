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
      minutes: 14,
      body: `
        ## Start with the problem

        An analyst sums the «fare» column and gets a number twice as big as finance's. After a day of
        digging, the cause: the table has one row per trip **and** one row per trip status change,
        mixed together. Every completed trip appears several times. Nobody ever wrote down what one
        row means.

        Dimensional modeling has one rule that prevents most mistakes like this: **state the grain of
        the fact table in one sentence before you add a column.** The **grain** is what one row
        means.

        > [!example] Good grain sentences
        > "One row per completed trip." "One row per ad impression." "One row per driver per hour
        > online." If you cannot finish the sentence, you are not ready to add columns.

        ## Idea 1: things that happened, and words that describe them

        Look at a shop receipt. Some parts are **numbers you can add up**: price, quantity, total.
        Other parts **describe** the purchase: which shop, which cashier, which day, which product.

        A data model splits the same way.

        - A **fact table** holds measurements of an event or a state. Examples: fare, distance,
          duration, clicks. It is very large and mostly appended to. Its keys point at dimensions,
          plus a **degenerate id** like the trip id that has no table of its own.
        - A **dimension table** holds descriptive context. Examples: rider, driver, city, product,
          date. It is small to medium and gets updated. It has one **surrogate key** per version.

        Facts answer "how much?". Dimensions answer "by what?". "Revenue by city by week" is a
        fact, sliced by two dimensions.

        ## Idea 2: three kinds of fact tables

        Different questions need different kinds of rows.

        - **Transaction facts:** one row per event, such as a trip or a payment. The most common
          kind.
        - **Periodic snapshots:** one row per entity per period, such as a driver's balance per day.
          Good for "what was the state at a point in time?" questions. Think of a daily photo.
        - **Accumulating snapshots:** one row per process, updated as it passes milestones. An order
          is placed, picked, then delivered, and the same row fills in each timestamp. Good for "how
          long between steps?" questions.

        ## Idea 3: not every number can be added up (additivity)

        - **Additive:** sum across every dimension. Fare: total fare per city, per day, per anything.
        - **Semi-additive:** sum across some dimensions but not time. An account balance: add
          balances across accounts on one day, yes. Add Monday's and Tuesday's balance, no; that number
          means nothing.
        - **Non-additive:** never sum. A ratio such as a surge multiplier. Two trips at 2x surge do
          not make 4x.

        So for a ratio, store its parts (numerator and denominator), not the ratio. Then any level can
        compute the right ratio by summing the parts first.

        > [!trap] Mixed grain in one table
        > Putting trip-level rows and daily totals in the same table means every «SUM» double counts.
        > One grain per fact table, always.

        ## Now say it like a senior engineer

        > [!senior] Grain follows the questions
        > Ask what the business will query. If nearly every question is per trip, the trip grain is
        > right. If GPS pings matter, they are a separate, finer fact table, not columns on trips.

        ## In one breath

        First say what one row means; then put the numbers you add up in facts and the words you slice
        by in dimensions. Store the parts of a ratio, and never mix two grains in one table.
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
      minutes: 16,
      body: `
        ## Start with the problem

        Driver 7 drove in Pune all of last year. In March she moved to Mumbai. Now you run "trips by
        city, last year". If the driver table simply says "city: Mumbai", all of her Pune trips from
        last year move to Mumbai in the report. Last year's numbers changed, and nobody touched last
        year's data.

        Dimensions change: a driver moves city, a restaurant changes cuisine, a product changes
        category. For each attribute, you must choose: should old facts see **the old value** or **the
        new value**? The standard answers are called **slowly changing dimension (SCD) types**.

        ## Idea 1: four choices

        - **Type 0: never changes.** The original signup date.
        - **Type 1: overwrite.** Typo fixes, and values whose history does not matter. Simple, but
          history is gone.
        - **Type 2: add a new row per version**, with validity dates. Use it when history matters for
          reporting. This is the one interviews probe.
        - **Type 3: keep the previous value in an extra column.** Use it when only one prior value
          matters.

        ## Idea 2: type 2, versions like passport stamps

        Think of a passport. A new visa does not erase the old one. Each stamp has a "valid from" and
        a "valid to" date. To know where you were allowed to be on a date, find the stamp that covers
        that date.

        Type 2 does that for a driver.

        Driver 7 now has two rows:

        | Key | City | Valid from | Valid to |
        |---|---|---|---|
        | 101 | Pune | Jan 2025 | Mar 2026 |
        | 245 | Mumbai | Mar 2026 | open |

        Two ids appear here, and the difference is the whole trick.

        - «driver_id» (7) is the **natural key** from the source. It is the same for every version.
        - «driver_sk» (101, 245) is the **surrogate key**. There is one per version.

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

        Each trip fact stores the «driver_sk» that was current **at event time**. So a trip from last
        year carries 101 and joins to Pune. A trip from April carries 245 and joins to Mumbai.
        Last year's report never changes. To see current attributes instead, join on «driver_id» with
        «is_current».

        ## Idea 3: loading type 2 in two steps

        Each day, new driver data arrives in staging. You need two steps.

        1. **Close** the current row of every driver whose tracked attributes changed: set its
           «valid_to» and make «is_current» false.
        2. **Insert** a new current row for every driver that now has none. That covers both changed
           drivers (just closed in step 1) and brand-new drivers.

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

        «next_sk()» stands for your key generator.

        > [!trap] NULLs hide changes
        > «d.city_id <> s.city_id» is unknown when either side is NULL, so a change from NULL to a
        > value is missed. Use «IS DISTINCT FROM», or compare hashes of the tracked columns.

        ## Now say it like a senior engineer

        > [!senior] Late changes and reruns
        > Ask what happens if the job reruns, or if a change arrives with an older «changed_at» than
        > the current row. A senior answer makes the load idempotent and either rejects or
        > re-sequences out-of-order changes.

        ## In one breath

        Type 2 keeps every version of a dimension row, like stamps in a passport, and each fact points
        at the version that was true when it happened. Load it by closing changed rows, then
        inserting new current ones.
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
      minutes: 13,
      body: `
        ## Start with the problem

        You have a clean model: trips, riders, drivers, cities. Now you must decide how to **store**
        it. One logical model can be laid out in several physical ways. Analysts want no joins.
        Engineers want no duplicated data. Finance wants history to stay correct. Each layout favours
        someone. Modern columnar warehouses changed which one is usually best, and interviewers like to
        hear that you know why.

        ## Idea 1: four layouts

        - **Star schema.** A fact table in the middle, with denormalised dimensions around it, like
          a star. Simple joins and clear meaning. The cost: joins at query time.
        - **Snowflake schema.** Dimensions split into sub-dimensions (city into state into country).
          Less duplication. The cost: more joins, harder for analysts.
        - **One big table (OBT).** The fact table with the dimension columns copied in. No joins,
          fast scans. The cost: wide rows, and history and updates are harder.
        - **Nested data** (BigQuery «STRUCT» and «ARRAY»). Child rows stored inside the parent row,
          like a trip that holds its list of stops. Keeps a one-to-many together with no join. The
          cost: you need «UNNEST», and tool support varies.

        ## Idea 2: why wide tables became popular

        In a row store, a 300-column table is expensive, because reading a row reads every column. In
        a **columnar** engine, each column is stored separately, and a query reads only the columns it
        names. So a 300-column table costs nothing extra for a query that uses five.

        Storage is cheap; joins at petabyte scale are not. So many teams keep a star schema as the
        governed core, and publish wide, query-friendly tables on top of it for dashboards.

        ## Idea 3: nested data, reading the list inside a row

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

        «UNNEST» unpacks the list, so a trip with 3 stops becomes 3 rows in the result.

        ## Idea 4: partitioning and clustering

        **Partition** big fact tables by event date, so queries skip whole days. **Cluster** or sort
        by the columns most used in filters, such as «city_id» or «advertiser_id». Avoid partitioning
        on high-cardinality columns: millions of tiny partitions hurt more than they help.

        ## Now say it like a senior engineer

        > [!senior] Layout depends on update patterns
        > Wide tables are easy when data is append-only. When dimension attributes change (type 2),
        > copying them into a wide table means rewriting history. Say which attributes are stable
        > enough to denormalise, and which stay in a joined dimension.

        ## In one breath

        A star keeps facts and dimensions apart and joins at query time; a wide table copies
        dimensions in, which a columnar engine makes cheap to read. Copy in only what does not change,
        and partition by date.
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
        ## Start with the problem

        The interviewer says: "Design the data model for a ride-hailing app's analytics." Then they
        stop talking. Most candidates start drawing tables at once, and twenty minutes later they have
        a pile of tables and no idea if it answers anything.

        The fix is an order of work. Go step by step, say your reasons out loud, and let each step
        decide the next one. Here is a structure that works.

        ## Step 1: ask what questions the model must answer

        Models exist to answer questions. So list them first.

        - Trips and revenue by city and hour.
        - Cancellation rates, and who cancelled.
        - Driver utilisation.
        - Surge effectiveness.
        - Rider retention.

        These decide the facts.

        ## Step 2: declare each fact with its grain

        Each question points at an event or a state. Write one sentence per fact table.

        - «fact_trip»: one row per trip request. Measures: fare, distance, duration, surge parts,
          status.
        - «fact_trip_event»: one row per trip state change. Measures: event time, status.
        - «fact_driver_hour»: one row per driver per hour. Measures: minutes online, minutes on trip.
        - «fact_payment»: one row per payment attempt. Measures: amount, currency, result.

        ## Step 3: share the dimensions (conformed dimensions)

        «dim_rider», «dim_driver» (type 2 for city and vehicle), «dim_city» (with time zone),
        «dim_date» and «dim_time», «dim_product» (UberX, Comfort, Black).

        **Conformed** means every fact uses the same dimension. Then "trips by city" and "payments by
        city" agree, because "city" means one thing everywhere. Two teams with two city tables will
        eventually show two different numbers in the same meeting.

        ## Step 4: raise the hard parts yourself

        Interviewers wait to see if you find these without being asked.

        - **Status changes.** A trip moves through requested, accepted, picked up, then completed or
          cancelled. Keep the event fact for timing questions, and an accumulating-snapshot style set
          of timestamp columns on «fact_trip» for fast funnel queries.
        - **Money.** Fares can change after the trip: tips, refunds. Store adjustments as their own
          fact rows instead of updating the original fare, so history stays auditable.
        - **Currency and time.** Store amounts in the local currency plus a converted reporting
          currency with the rate used. Store timestamps in UTC plus the city's local date.
        - **Geography.** Store pickup and dropoff as a cell id (for example an H3 index) as well as
          raw coordinates. Then aggregation by area is a join, not a geometry computation.

        ## Now say it like a senior engineer

        > [!senior] Finish with a query
        > Close the round by writing one query the model makes easy, such as cancellation rate by city
        > and hour last week. It proves the model works, and interviewers often ask for it.

        ## In one breath

        Questions first, then one grain sentence per fact, then shared dimensions, then the hard parts
        (status, money, currency, geography) raised by you. End with a query that proves it works.
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
      minutes: 17,
      body: `
        ## Start with the problem

        A bank has twenty source systems: the app, payments, the call centre CRM, a company it bought
        last year, and more. Each has its own keys, changes its schema a few times a year, and
        releases on its own calendar. Auditors want every number traced back to the source row and
        the load that brought it in.

        Try to load all of that straight into a star schema. Every source change means changing shared
        tables. Every load waits for the others, because they all touch the same dimension. And
        updates overwrite the old values the auditors want to see.

        A star schema is built for people who ask questions. **Data Vault** is built for the layer
        **under** it, where the sources land. It trades query comfort for three things: every source
        loads in parallel, history is never overwritten, and a new source **adds** tables instead of
        changing old ones.

        ## Idea 1: split every source into three kinds of table

        Think of a contacts app. There is the person (just their identity). There are relationships
        (Priya is married to Arjun). And there are details that change over time (Priya's address,
        her phone number). Data Vault keeps those three apart.

        - **Hub:** one row per business key, ever, and nothing else. Example: «hub_rider» with the
          rider key, a hash key, the first load time and the source.
        - **Link:** one row per relationship between hubs. Example: «link_trip» with the rider,
          driver and vehicle hash keys.
        - **Satellite:** the descriptive attributes of one hub or link, with history. Example:
          «sat_rider_profile» with name, rating, city, load time and hash diff.

        Hubs and links never change after insert. A satellite adds a new row only when the attributes
        change. To spot a change cheaply, it compares a **hash diff**: one hash of all the descriptive
        columns. Same hash, nothing changed; skip it.

        The result is an **insert-only** model. A load is a set of appends, so you can rerun it and
        replay it safely.

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

        ## Idea 2: keys that every loader can compute alone (hash keys)

        With normal sequence keys (1, 2, 3), a satellite loader must first look up the hub to find
        rider 7's key. So the hub must load first, then the satellite. Loads wait for each other.

        Data Vault 2.0 uses a **hash of the business key** instead. Every loader can compute
        md5("R-7") by itself, so the hub, the link and the satellite all load **in parallel**, with no
        lookup.

        The cost: 16 to 32 bytes per key instead of 8, and a collision risk that is real only at
        absurd volumes. And normalise the business key first (trim, upper case, a fixed separator
        for composite keys), or "r-7 " and "R-7" become two riders.

        ## Idea 3: three layers on top of each other

        1. **Raw vault:** the sources as they are, split into hubs, links and satellites. No
           business rules, so it is auditable.
        2. **Business vault:** derived satellites with rules applied, such as a resolved customer,
           plus helper tables. A **point-in-time (PIT)** table lists, for each key and snapshot date,
           the satellite row that was current. A **bridge** table pre-joins hubs and links along a
           common path.
        3. **Marts:** star schemas on top, built from PIT and bridge tables. Analysts never query the
           vault directly.

        > [!trap] Satellites split by rate of change
        > Put a rider's name and their live rating in one satellite, and the rating's daily change
        > copies the name every day. Split satellites by source and by how often the columns change.

        ## Now say it like a senior engineer

        > [!senior] When to choose it, and when not
        > Choose Data Vault when there are many sources that change often, when auditors must trace
        > every value to its source and load, and when several teams load in parallel. Banks and
        > insurers fit. For one product database feeding dashboards, it is three times the tables for
        > no gain: build staging and a star schema. Say that the vault is an integration layer, and
        > that you still build dimensional marts on top.

        ## In one breath

        Data Vault splits every source into identities (hubs), relationships (links) and changing
        details (satellites), all insert-only and keyed by hashes so everything loads in parallel.
        It is the landing layer; you still build stars on top for people.
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
      minutes: 16,
      body: `
        ## Start with the problem

        Two questions that a star schema answers badly.

        1. "For each rider, how many days from signup to their first completed trip?" Signup is in
           one fact table, trips in another. You join across processes, filter to "first", and the
           query grows every time a product manager adds a condition.
        2. "Which accounts share a device or a card with this banned account, within three hops?"
           That is "who is connected to whom", and a star schema has no idea what "connected" means.

        Two other shapes fit these questions: an **activity stream** for journeys, and a **graph**
        for connections.

        ## Idea 1: a diary per customer (activity schema)

        Picture each customer keeping a diary: one line per thing they did, with the time. "Signed up
        at 10:02. Requested a trip at 10:15. Completed the trip at 10:40."

        An **activity schema** is that diary, for everyone, in **one narrow table** with a fixed set of
        columns, instead of one fact table per process.

        - «activity_id»: the unique id of the event.
        - «ts»: when it happened.
        - «customer»: the entity the stream is about.
        - «activity»: a short name, such as «signed_up», «requested_trip» or «completed_trip».
        - «feature_json»: a few attributes specific to that activity.
        - «revenue_impact»: money, if any.
        - «activity_occurrence»: 1 for the customer's first time, 2 for the second, and so on.
        - «activity_repeated_at»: when the customer next did the same activity.

        A new kind of activity is a new value of «activity», not a new table. Questions become
        **temporal joins** between two activities of the same customer: "first completed trip after
        signing up", "last support ticket before cancelling".

        The two precomputed columns make the common ones cheap. «activity_occurrence = 1» is a
        "first ever" filter. «activity_repeated_at» bounds "in between" joins.

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

        ## Idea 2: when the connections are the data (graph models)

        Draw dots for riders, devices, cards and addresses. Draw lines when a rider USED a device or
        PAID_WITH a card. Now "who is connected to the banned account" is just "follow the lines".

        That drawing is a **property graph**: **nodes** (rider, device, card, address) and **edges**
        (USED, PAID_WITH, LIVES_AT), and both carry properties. In a warehouse the same graph is two
        tables: a node table, and an edge table with «src», «dst», «type» and validity times.

        Where to store it depends on the question.

        - **Edge table in the warehouse:** good for batch analytics, one or two hops, and recursive
          CTEs. Weak at deep traversals at request time.
        - **Graph database** (Neo4j, Amazon Neptune, Spanner Graph): good for many hops with low
          latency and path queries. Weak at wide aggregations and scans.
        - **Adjacency lists in a key-value store:** good for one-hop lookups at huge scale. Weak at
          anything multi-hop.

        A fraud team asking "which accounts share a device or a card with this banned account, within
        three hops" is a graph question. A dashboard counting accounts per city is not.

        > [!trap] Super nodes
        > A shared office Wi-Fi address or a default device id connects thousands of accounts. One
        > traversal through it touches everything. Cap the degree, or drop edges to nodes above a
        > threshold, before you run multi-hop queries.

        ## Now say it like a senior engineer

        > [!senior] Model edges with time
        > A rider shared a device with a fraudster last year, not today. Give each edge «valid_from»
        > and «valid_to», like an SCD type 2 row. Without it, old links pull innocent accounts into
        > every ring, and a model trained on the graph leaks the future.

        ## In one breath

        An activity schema is one diary table of everything each customer did, so journeys become
        joins between two lines of the same diary. A graph stores dots and lines, so "connected
        within three hops" becomes following lines, with time on every line.
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
      minutes: 15,
      body: `
        ## Start with the problem

        An app database stores a trip with a «city_id», and the city name lives once, in a cities
        table. A warehouse often copies the city name onto every trip row. One looks careful, the other
        looks sloppy. Both are right, for their own job. Interviewers want to hear that you know which
        rule you are breaking, and why.

        Then there are the awkward cases that no basic star schema handles cleanly: twelve yes/no
        flags, a date used three ways, a trip with two promotions. Each has a named pattern.

        ## Idea 1: normal forms, in one minute

        Operational databases **normalize** so each fact is stored once, and an update touches one row.
        Change a city's name, and you change one row, not ten million trips.

        - **1NF:** every column holds one value. No repeating groups such as «phone1», «phone2».
        - **2NF:** every non-key column depends on the whole key, not part of a composite key.
        - **3NF:** no non-key column depends on another non-key column. A city name stored next to
          a city id on every trip breaks it, because the name depends on the id, not on the trip.

        ## Idea 2: why the warehouse breaks the rules on purpose

        A warehouse is read far more than it is written. Columnar storage compresses repeated values
        well, so copying "Mumbai" ten million times costs little. And a join avoided is a shuffle
        avoided. So it **denormalizes** on purpose.

        An ER diagram of the source is still where modeling starts, because it shows the real keys and
        cardinalities.

        ## Idea 3: the special dimensions, one problem each

        - **Junk dimension.** Problem: many low-cardinality flags clutter the fact. Fix:
          «dim_trip_flags», one row per combination of is_pool, is_scheduled, payment_type. Five flags
          of two to four values each make at most a few hundred rows. The fact carries one small key
          instead of five columns, and the combinations get readable labels.
        - **Role-playing dimension.** Problem: one dimension used several times by one fact. Fix:
          «dim_date» plays request date, pickup date and payout date, through views.
        - **Degenerate dimension.** Problem: an id with no attributes of its own. Fix: keep
          «order_id» on the fact, with no table.
        - **Mini-dimension.** Problem: a few attributes change too often for SCD 2, so the dimension
          explodes. Fix: split the rider rating band and tenure band out of «dim_rider».
        - **Bridge table.** Problem: a many-to-many between a fact and a dimension, such as a trip
          with several promotions. Fix: «bridge_trip_promo», with a weight per row.
        - **Outrigger.** Problem: a dimension that references another dimension. Example:
          «dim_driver» pointing at «dim_vehicle».

        ~~~sql
        -- Role-playing: one physical table, three views with clear names
        CREATE VIEW dim_request_date AS SELECT date_key AS request_date_key, calendar_date AS request_date FROM dim_date;
        CREATE VIEW dim_pickup_date  AS SELECT date_key AS pickup_date_key,  calendar_date AS pickup_date  FROM dim_date;
        ~~~

        > [!trap] Bridge tables double count
        > Join a trip to its two promotions, and the fare appears twice. Either allocate with a weight
        > column that sums to 1 per trip, or tell users that the bridge answers "trips touched by promo
        > X", not "revenue from promo X".

        ## Now say it like a senior engineer

        > [!senior] Name the pattern, then the cost
        > "That is a mini-dimension: the rating band changes weekly, so in SCD 2 it would create a new
        > rider row each week. I split it out and put its key on the fact." Naming the pattern and the
        > reason is what interviewers listen for.

        ## In one breath

        Sources normalize so each fact lives once; warehouses copy on purpose because reads dominate
        and columns compress. When a star gets awkward, reach for the named fix: junk, role-playing,
        degenerate, mini, bridge or outrigger.
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
    companies: ['uber', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
    companies: ['uber', 'google', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
    companies: ['google', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
    companies: ['uber', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
    companies: ['google', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
    companies: ['uber', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
    companies: ['uber', 'google', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
    companies: ['uber', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
    companies: ['uber', 'google', 'amazon', 'meta', 'flipkart', 'swiggy'],
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
