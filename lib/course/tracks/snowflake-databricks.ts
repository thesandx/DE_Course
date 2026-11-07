import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'snowflake-databricks',
  title: 'Snowflake and Databricks',
  summary:
    'How the two big data platforms store, load, speed up, recover and govern data, and how to choose between them.',
  tone: 'peach',
  why: 'Most job posts name Snowflake or Databricks, and interviewers probe past the brochure: why a query skips no partitions, why Snowpipe loaded a file twice, what a Unity Catalog grant really covers. A senior answer explains the mechanism and its cost.',
  lessons: [
    {
      slug: 'snowflake-architecture',
      title: 'Snowflake architecture and warehouses',
      summary:
        'Explain the three layers, micro-partitions and virtual warehouses, and size a warehouse from the symptoms.',
      minutes: 14,
      body: `
        Snowflake separates **storage**, **compute** and **services**. Each layer scales and bills
        on its own, and that separation is the answer to most "why" questions about it.

        ~~~text
        ┌──────────────── Cloud services ────────────────┐
        │ auth · metadata · optimizer · result cache     │
        └────────────────────────────────────────────────┘
          ┌── WH_ETL (L) ──┐   ┌── WH_BI (M, 1-4) ──┐
          │ local SSD cache│   │ local SSD cache    │      compute
          └────────────────┘   └────────────────────┘
        ┌──────── Storage: micro-partitions in S3, GCS or Azure ────────┐
        └───────────────────────────────────────────────────────────────┘
        ~~~

        ## Storage: micro-partitions

        Every table is split into **micro-partitions**: immutable columnar files of about 50 to
        500 MB of uncompressed data. Snowflake creates them as data arrives; you do not declare
        partitions. For each micro-partition the services layer keeps the **min and max of every
        column**, the distinct count and the null count.

        Two things follow:

        - A filter such as «WHERE event_date = '2026-11-01'» lets the optimizer skip every
          micro-partition whose range cannot match. This is **pruning**, and it is the main lever
          for speed.
        - An «UPDATE» or «DELETE» never edits a file. It writes new micro-partitions and retires
          the old ones. That is what makes time travel and cloning cheap, and frequent small
          updates expensive.

        ## Compute: virtual warehouses

        A **virtual warehouse** is a cluster of compute that runs queries. Warehouses share the
        same storage, so the ETL warehouse and the dashboard warehouse never fight for CPU.

        | Size | Credits per hour | Use for |
        |---|---|---|
        | X-Small | 1 | Small transforms, dev |
        | Small | 2 | Light BI |
        | Medium | 4 | Typical ETL |
        | Large | 8 | Heavy joins and sorts |
        | X-Large and up | 16, 32, 64 … | Large backfills |

        Each size doubles the compute and the credits. Billing is per second, with a **60-second
        minimum** each time a warehouse starts or resumes. A credit costs about 2 to 4 US dollars,
        by edition and region.

        - **Scale up** (a bigger size) when one query is slow: big joins, sorts, spilling.
        - **Scale out** (a multi-cluster warehouse, Enterprise edition) when many queries queue.
          Snowflake adds clusters up to «MAX_CLUSTER_COUNT» and removes them when the queue
          drains. The «STANDARD» policy starts clusters quickly; «ECONOMY» waits to fill them.

        ~~~sql
        CREATE WAREHOUSE wh_bi
          WAREHOUSE_SIZE = 'MEDIUM'
          MIN_CLUSTER_COUNT = 1
          MAX_CLUSTER_COUNT = 4
          SCALING_POLICY = 'STANDARD'
          AUTO_SUSPEND = 60
          AUTO_RESUME = TRUE;
        ~~~

        ## Cloud services

        The services layer handles login, metadata, query compilation and the result cache. It
        runs without a warehouse. Its credits are billed only above 10% of the day's warehouse
        credits, so a flood of tiny metadata queries can still show up on the bill.

        ## Access control in one paragraph

        Snowflake grants privileges to **roles**, and roles to users. «ACCOUNTADMIN» sits on top;
        «SECURITYADMIN» manages grants; «SYSADMIN» owns databases and warehouses. Build
        **functional roles** («ANALYST», «ETL») on top of **access roles** («SALES_READ»), and
        use «GRANT ... ON FUTURE TABLES» so new tables are not invisible by accident.

        > [!senior] Size from the query profile, not from a feeling
        > "The query is slow, so use a bigger warehouse" is a mid-level answer. A senior answer
        > reads the query profile first. Bytes spilled to remote storage means a bigger size helps.
        > A full scan means fix pruning. Queuing means scale out, not up.

        > [!trap] Auto-suspend set too low or too high
        > A 10-minute auto-suspend on a warehouse that runs one query an hour bills about 10
        > minutes every hour. A very short auto-suspend on a BI warehouse throws away its local
        > cache between queries. Set it from the query pattern: about 60 seconds for bursty ETL,
        > longer for interactive BI.
      `,
      checks: [
        {
          question: 'Dashboards queue at 09:00 while each query alone is fast. What helps most?',
          options: [
            'Resize the warehouse from Medium to 2X-Large',
            'Make it a multi-cluster warehouse so it scales out',
            'Add a clustering key to every table',
            'Turn off the result cache',
          ],
          answer: 1,
          why: 'Queuing is a concurrency problem. More clusters run more queries at once; a bigger size only makes each query faster.',
        },
        {
          question: 'Why is an UPDATE of a few rows in a huge table more costly than it looks?',
          options: [
            'Snowflake locks the whole account',
            'Micro-partitions are immutable, so each touched partition is rewritten',
            'Updates always need an X-Large warehouse',
            'Updates disable pruning for 24 hours',
          ],
          answer: 1,
          why: 'Snowflake writes new micro-partitions for every partition that holds a changed row, and keeps the old ones for time travel.',
        },
      ],
    },
    {
      slug: 'snowflake-loading-and-snowpipe',
      title: 'Loading: stages, COPY and Snowpipe',
      summary:
        'Load files with stages and COPY INTO, connect a bucket without keys, and run Snowpipe and Snowpipe Streaming safely.',
      minutes: 16,
      body: `
        Snowflake loads data from a **stage**: a named place that holds files.

        | Stage | Name in SQL | Holds |
        |---|---|---|
        | User stage | «@~» | Files for one user |
        | Table stage | «@%trips» | Files for one table |
        | Named internal | «@raw_stage» | Files that Snowflake stores |
        | Named external | «@s3_trips» | A path in your S3, GCS or Azure bucket |

        ## A storage integration: no keys

        An external stage needs access to your bucket. Do not paste an access key into the stage.
        Create a **storage integration** instead. Snowflake gives you an identity (an AWS IAM user
        ARN and an external id, or a GCP service account), and you trust that identity in your
        cloud account. Nothing secret is stored in SQL.

        ~~~sql
        CREATE STORAGE INTEGRATION s3_raw
          TYPE = EXTERNAL_STAGE
          STORAGE_PROVIDER = 'S3'
          ENABLED = TRUE
          STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::123456789012:role/snowflake-raw'
          STORAGE_ALLOWED_LOCATIONS = ('s3://acme-raw/trips/');

        -- Read STORAGE_AWS_IAM_USER_ARN and STORAGE_AWS_EXTERNAL_ID,
        -- then add them to the IAM role's trust policy.
        DESC INTEGRATION s3_raw;

        CREATE FILE FORMAT ff_json TYPE = JSON STRIP_OUTER_ARRAY = TRUE;

        CREATE STAGE s3_trips
          URL = 's3://acme-raw/trips/'
          STORAGE_INTEGRATION = s3_raw
          FILE_FORMAT = ff_json;
        ~~~

        ## COPY INTO

        ~~~sql
        COPY INTO raw.trips (payload, file_name, loaded_at)
        FROM (
          SELECT $1, METADATA$FILENAME, CURRENT_TIMESTAMP()
          FROM @s3_trips/2026/11/03/
        )
        ON_ERROR = 'SKIP_FILE';
        ~~~

        The facts interviewers check:

        - **Load metadata.** Snowflake remembers which files it loaded into each table for **64
          days**, by name and checksum. Running the same COPY again skips them. «FORCE = TRUE»
          reloads, and creates duplicates.
        - **Errors.** The default for COPY is «ON_ERROR = ABORT_STATEMENT». «SKIP_FILE» and
          «CONTINUE» trade completeness for progress. Dry-run with «VALIDATION_MODE =
          RETURN_ERRORS».
        - **File size.** Aim for about 100 to 250 MB compressed per file. Thousands of tiny files
          waste per-file overhead; one huge file cannot load in parallel.
        - **Parquet.** «MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE» maps columns by name instead of
          position.

        ## Snowpipe: continuous file loading

        **Snowpipe** runs a COPY statement for you when new files land. With auto-ingest, the
        bucket sends an event notification (S3 to an SQS queue that Snowflake owns, or GCS
        Pub/Sub) and Snowpipe loads the file within about a minute. It uses serverless compute,
        not your warehouse.

        ~~~sql
        CREATE PIPE raw.trips_pipe AUTO_INGEST = TRUE AS
          COPY INTO raw.trips (payload, file_name, loaded_at)
          FROM (SELECT $1, METADATA$FILENAME, CURRENT_TIMESTAMP() FROM @s3_trips);
        ~~~

        - Snowpipe keeps its own load history for **14 days**, and its default «ON_ERROR» is
          «SKIP_FILE».
        - Load order is not guaranteed. Never assume file A loads before file B.
        - A file that is rewritten under the same name with new content is loaded again.
        - Check health with «SYSTEM$PIPE_STATUS» and the «COPY_HISTORY» table function.

        ## Snowpipe Streaming: rows, not files

        **Snowpipe Streaming** writes rows straight into tables through an SDK or the Kafka
        connector. There are no files to stage, and latency drops to seconds. Each channel tracks
        an **offset token**, so a client that restarts asks Snowflake for the last committed
        offset and resumes from there. That is how you get exactly-once delivery from Kafka.

        > [!senior] Pick the loader by latency and by who owns the files
        > Batch COPY from an orchestrator for hourly or daily loads. Snowpipe when files arrive
        > all day and minutes are fine. Snowpipe Streaming when events come from Kafka and you
        > need seconds. Say how each one avoids duplicates.

        > [!trap] Duplicates after 64 days
        > A backfill that re-runs COPY over a folder of files older than 64 days cannot use load
        > metadata, so Snowflake may load them twice. Load into a table keyed by «file_name» and
        > deduplicate, or move processed files to an archive path.
      `,
      checks: [
        {
          question: 'Why use a storage integration for an external stage?',
          options: [
            'It loads files faster',
            'Snowflake gets a trusted identity, so no access key is stored in SQL',
            'It removes the need for a file format',
            'It turns on Snowpipe',
          ],
          answer: 1,
          why: 'The integration gives Snowflake an IAM identity that your cloud account trusts. No secret lives in the stage definition.',
        },
        {
          question:
            'You run the same COPY INTO twice, an hour apart, with no options. What happens?',
          options: [
            'Every file loads twice',
            'The second run fails',
            'Files already loaded are skipped by load metadata',
            'Snowflake truncates the table first',
          ],
          answer: 2,
          why: 'COPY keeps 64 days of load metadata per table and skips files it has already loaded, unless FORCE = TRUE.',
        },
      ],
    },
    {
      slug: 'snowflake-semi-structured',
      title: 'JSON and semi-structured data in Snowflake',
      summary:
        'Query VARIANT columns, flatten nested arrays, and decide what to keep as JSON and what to promote to columns.',
      minutes: 13,
      body: `
        Snowflake stores JSON, Avro, Parquet and XML in a **VARIANT** column. You load the raw
        document and query it with a path syntax, with no schema up front.

        ~~~sql
        -- payload is VARIANT:
        -- {"trip_id": "t1", "rider": {"id": "r9", "tier": "gold"},
        --  "stops": [{"seq": 1, "city": "SF"}, {"seq": 2, "city": "Oakland"}]}

        SELECT
          payload:trip_id::STRING    AS trip_id,
          payload:rider.tier::STRING AS rider_tier,
          payload:stops[0].city::STRING AS first_city
        FROM raw.trips;
        ~~~

        - A colon starts the path; dots and brackets go deeper.
        - The result of a path is still VARIANT. **Cast it** with «::STRING», «::NUMBER» or
          «::TIMESTAMP_NTZ», or comparisons and joins behave in surprising ways.
        - A missing key returns SQL «NULL». A JSON «null» value is a VARIANT null, which is not
          the same thing; «IS_NULL_VALUE» tells them apart.
        - Key names are case sensitive: «payload:Trip_ID» is not «payload:trip_id».

        ## FLATTEN: one row per array element

        ~~~sql
        SELECT
          t.payload:trip_id::STRING AS trip_id,
          s.index                   AS stop_position,
          s.value:city::STRING      AS city
        FROM raw.trips AS t,
          LATERAL FLATTEN(input => t.payload:stops, OUTER => TRUE) AS s;
        ~~~

        FLATTEN returns the columns «SEQ», «KEY», «PATH», «INDEX», «VALUE» and «THIS». Without
        «OUTER => TRUE», a trip with an empty or missing «stops» array disappears from the
        result, just like an inner join.

        To build JSON, use «OBJECT_CONSTRUCT», «ARRAY_AGG» and «TO_JSON». To parse a string, use
        «TRY_PARSE_JSON», which returns NULL for bad input instead of failing the whole query.

        ## How fast is VARIANT?

        When it loads a VARIANT, Snowflake extracts common paths into hidden columns with their
        own min and max metadata. So «WHERE payload:city::STRING = 'SF'» can still prune. The
        extraction stops working well when a path holds mixed types, or when documents vary a lot.

        One VARIANT value has a size cap: 16 MB for many years, raised to 128 MB in 2025. Check
        the limit on your account before you design around big documents.

        ## Keep it raw, then promote

        The pattern most teams use:

        1. Land the raw document in a VARIANT column, with the file name and load time.
        2. In staging, cast the fields that queries filter and join on into typed columns.
        3. Keep the VARIANT for rare fields and for replay when the parser changes.

        > [!senior] Schema on read is a choice with a cost
        > VARIANT absorbs new fields without a failed load. It also lets a producer rename a
        > field and silently turn your column into NULLs. A senior answer adds a test on the
        > promoted columns, such as the null rate per load, so drift is caught the same day.

        > [!trap] Comparing VARIANT without a cast
        > «payload:fare > 10» compares VARIANT values, and «payload:id = 123» against a string
        > id never matches. Cast both sides to the type you mean.
      `,
      checks: [
        {
          question: 'A LATERAL FLATTEN query drops trips that have no stops. What fixes it?',
          options: [
            'Cast the array to STRING',
            'Use OUTER => TRUE in FLATTEN',
            'Add a clustering key on stops',
            'Use PARSE_JSON on the column',
          ],
          answer: 1,
          why: 'OUTER => TRUE emits one row with NULL values when the array is empty or missing, so the parent row stays.',
        },
        {
          question: 'What type does payload:rider.tier return before a cast?',
          options: ['STRING', 'VARIANT', 'OBJECT', 'NUMBER'],
          answer: 1,
          why: 'A path into a VARIANT returns VARIANT. Cast it to get a typed value.',
        },
      ],
    },
    {
      slug: 'snowflake-performance',
      title: 'Clustering, caching and query performance',
      summary:
        'Read a query profile, decide when a clustering key pays off, and use the three caches on purpose.',
      minutes: 16,
      body: `
        A slow Snowflake query almost always has one of four causes. The **query profile** shows
        which one.

        | In the profile | Cause | Fix |
        |---|---|---|
        | Partitions scanned close to partitions total | No pruning | Filter on a well-clustered column, or add a clustering key |
        | Bytes spilled to local or remote storage | Not enough memory | A bigger warehouse, or less data per step |
        | A join outputs far more rows than it reads | An exploding join | Fix the join keys; deduplicate first |
        | Long queued time | Concurrency | Multi-cluster warehouse, or a separate warehouse |

        ## Natural clustering and clustering keys

        Micro-partitions follow **insert order**. A table loaded by day is already well clustered
        on the load date, so date filters prune well for free. Filters on another column, such as
        «city_id», scan everything, because every micro-partition holds every city.

        A **clustering key** asks Snowflake to keep rows with nearby key values together:

        ~~~sql
        ALTER TABLE analytics.trips CLUSTER BY (TO_DATE(started_at), city_id);

        SELECT SYSTEM$CLUSTERING_INFORMATION('analytics.trips', '(TO_DATE(started_at), city_id)');
        ~~~

        The function reports the **average depth**: how many micro-partitions overlap for a given
        value. Close to 1 is good. **Automatic Clustering** then reclusters in the background, on
        serverless compute that you pay for.

        A clustering key pays off when all of these hold:

        - The table is large: multiple terabytes, thousands of micro-partitions.
        - Queries filter or join on the key most of the time.
        - The table is queried far more often than it changes.

        Put the lowest-cardinality column first, and wrap high-cardinality timestamps in
        «TO_DATE». Two or three columns at most.

        ## Other accelerators

        - **Search Optimization Service**: point lookups on high-cardinality columns, such as
          «WHERE trip_id = 't-81'» or a substring search. It maintains a search access path, at a
          storage and compute cost. Enterprise edition.
        - **Query Acceleration Service**: offloads parts of large scans to shared compute when a
          few outlier queries scan far more than the rest.
        - **Materialized views**: precompute an aggregate on one table. Snowflake keeps them
          current. Enterprise edition.

        ## The three caches

        | Cache | Lives in | Lasts | Helps |
        |---|---|---|---|
        | Result cache | Cloud services | 24 hours, renewed on reuse, up to 31 days | The exact same query: no warehouse runs |
        | Local disk cache | Warehouse SSD | Until the warehouse suspends or resizes | Queries that read the same micro-partitions |
        | Metadata | Cloud services | Always | «COUNT(*)», «MIN», «MAX» with no warehouse |

        The result cache works only if the query text matches, the data has not changed, the
        query has no non-deterministic function such as «CURRENT_TIMESTAMP()», and the role can
        read the tables.

        > [!senior] Benchmark with the cache off
        > A query that ran in 200 ms the second time hit the result cache. Run
        > «ALTER SESSION SET USE_CACHED_RESULT = FALSE» before you compare two designs, or the
        > numbers lie.

        > [!trap] Clustering a table that churns
        > Automatic Clustering on a table that gets a big merge every 15 minutes reclusters all
        > day, and its serverless credits can cost more than the queries it speeds up. Check
        > «AUTOMATIC_CLUSTERING_HISTORY» a week after you add a key.
      `,
      checks: [
        {
          question:
            'The profile shows 48,000 of 48,200 partitions scanned for a filter on city_id. What is the first fix to consider?',
          options: [
            'A bigger warehouse',
            'A clustering key that leads with city_id or a date plus city_id',
            'Turning off the result cache',
            'Converting the table to transient',
          ],
          answer: 1,
          why: 'Almost no pruning means the data is not organised by the filter column. A bigger warehouse only scans the same partitions faster.',
        },
        {
          question: 'Which query can never use the result cache?',
          options: [
            'SELECT COUNT(*) FROM trips',
            'SELECT city_id, SUM(fare) FROM trips GROUP BY 1',
            'SELECT * FROM trips WHERE started_at > CURRENT_TIMESTAMP() - INTERVAL 1 HOUR',
            'SELECT MAX(started_at) FROM trips',
          ],
          answer: 2,
          why: 'CURRENT_TIMESTAMP() is not deterministic, so Snowflake cannot reuse a stored result.',
        },
      ],
    },
    {
      slug: 'snowflake-time-travel-and-tables',
      title: 'Time travel, cloning and table types',
      summary:
        'Recover data with time travel, explain fail-safe, clone without copying, and pick the right table type.',
      minutes: 14,
      body: `
        Because micro-partitions are immutable, Snowflake can keep the old ones for a while. That
        gives you **time travel**: query or restore a table as it was in the past.

        ~~~sql
        -- The table five minutes ago
        SELECT * FROM analytics.trips AT(OFFSET => -60 * 5);

        -- The table just before a bad statement ran
        SELECT * FROM analytics.trips BEFORE(STATEMENT => '01b2c3d4-0000-1111-0000-000000000000');

        -- Restore: clone the old state, check it, then swap
        CREATE TABLE analytics.trips_restored CLONE analytics.trips
          AT(TIMESTAMP => '2026-11-03 06:55:00'::TIMESTAMP_LTZ);
        ALTER TABLE analytics.trips SWAP WITH analytics.trips_restored;

        -- A dropped table comes back
        UNDROP TABLE analytics.drivers;
        ~~~

        ## Retention and fail-safe

        «DATA_RETENTION_TIME_IN_DAYS» sets the time travel window. The default is 1 day. On
        Enterprise edition and above, a permanent table can keep up to **90 days**.

        After time travel ends, a permanent table's old data enters **fail-safe** for **7
        days**. Only Snowflake support can recover from fail-safe, on a best-effort basis. It is
        disaster recovery for Snowflake, not a feature you can query.

        Both windows cost storage. A table that is rewritten every hour keeps every old version
        for the whole window. High-churn staging tables with 90-day retention are a classic
        surprise on the bill.

        ## Table types

        | Type | Time travel | Fail-safe | Use for |
        |---|---|---|---|
        | Permanent | 0 to 90 days (1 on Standard) | 7 days | Facts, dimensions, anything you cannot rebuild |
        | Transient | 0 or 1 day | None | Staging and intermediate tables you can rebuild |
        | Temporary | 0 or 1 day, ends with the session | None | Scratch work in one session |
        | External | None | None | Query files in a bucket that Snowflake does not manage |
        | Iceberg | Through the Iceberg snapshots | None | Open tables that Spark and Trino also read |
        | Dynamic | Like permanent | Like permanent | A table defined by a query, kept fresh to a target lag |
        | Hybrid | Limited | Limited | Row-level reads and writes for small apps |

        ## Zero-copy cloning

        «CLONE» copies metadata, not data. The clone points at the same micro-partitions, and only
        the rows that later change in either table take new storage. You can clone a table, a
        schema or a whole database, and combine it with «AT» to clone the past.

        Teams use it for:

        - A full-size dev or test database in seconds.
        - A safe restore point before a risky backfill.
        - Debugging a bad deploy against the exact data it saw.

        > [!senior] Restore by clone and swap, not by overwrite
        > When an UPDATE corrupts a table, a senior answer does not run another UPDATE. It clones
        > the table as of the moment before the bad statement, compares row counts and a few
        > aggregates, then swaps the two tables. The bad version stays for the postmortem.

        > [!trap] Transient by default in dbt
        > dbt creates Snowflake tables as transient unless you set «transient: false». That is fine
        > for marts you can rebuild. It is wrong for a snapshot table that holds history you
        > cannot recreate.
      `,
      checks: [
        {
          question: 'Who can recover data from fail-safe?',
          options: [
            'Any role with OWNERSHIP on the table',
            'ACCOUNTADMIN, with UNDROP',
            'Only Snowflake support',
            'Nobody: fail-safe is only for billing',
          ],
          answer: 2,
          why: 'Fail-safe is a 7-day disaster recovery window that only Snowflake support can restore from.',
        },
        {
          question: 'Which table type fits a staging table rebuilt every hour?',
          options: ['Permanent with 90-day retention', 'Transient', 'Hybrid', 'External'],
          answer: 1,
          why: 'A transient table has no fail-safe and at most 1 day of time travel, so you do not pay to keep every hourly version.',
        },
      ],
    },
    {
      slug: 'snowflake-streams-tasks-dynamic-tables',
      title: 'Pipelines in Snowflake: streams, tasks and dynamic tables',
      summary:
        'Build incremental pipelines inside Snowflake with streams and tasks, and know when a dynamic table replaces them.',
      minutes: 15,
      body: `
        Snowflake can run incremental pipelines without an outside engine. There are two ways:
        the imperative pair **streams and tasks**, and the declarative **dynamic tables**.

        ## Streams: change tracking

        A **stream** records the changes to a table since the stream was last consumed. It stores
        an offset, not a copy of the data.

        ~~~sql
        CREATE STREAM raw.trips_changes ON TABLE raw.trips;
        ~~~

        Selecting from the stream returns the changed rows plus three columns:

        - «METADATA$ACTION»: «INSERT» or «DELETE».
        - «METADATA$ISUPDATE»: TRUE when the row is half of an update (a delete plus an insert).
        - «METADATA$ROW_ID»: a stable id for the row.

        The offset moves only when a **DML statement** reads the stream and its transaction
        commits. A plain SELECT does not consume it. An «APPEND_ONLY» stream ignores updates and
        deletes, which is cheaper for insert-only sources.

        ## Tasks: scheduling

        ~~~sql
        CREATE TASK analytics.merge_trips
          WAREHOUSE = wh_etl
          SCHEDULE = '5 MINUTE'
          WHEN SYSTEM$STREAM_HAS_DATA('raw.trips_changes')
        AS
          MERGE INTO analytics.trips AS t
          USING (
            SELECT * FROM raw.trips_changes
            QUALIFY ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY updated_at DESC) = 1
          ) AS s
          ON t.trip_id = s.trip_id
          WHEN MATCHED AND s.METADATA$ACTION = 'DELETE' AND NOT s.METADATA$ISUPDATE THEN DELETE
          WHEN MATCHED AND s.METADATA$ACTION = 'INSERT' THEN UPDATE SET
            status = s.status, fare_usd = s.fare_usd, updated_at = s.updated_at
          WHEN NOT MATCHED AND s.METADATA$ACTION = 'INSERT' THEN INSERT
            (trip_id, status, fare_usd, updated_at)
            VALUES (s.trip_id, s.status, s.fare_usd, s.updated_at);

        ALTER TASK analytics.merge_trips RESUME;
        ~~~

        - A task is created **suspended**. Nothing runs until you resume it.
        - The «WHEN» condition is checked in cloud services, so an empty stream does not start the
          warehouse.
        - Omit «WAREHOUSE» to make the task serverless; Snowflake sizes the compute.
        - Chain tasks with «AFTER» to build a task graph. Only the root task has a schedule.

        A stream goes **stale** if nobody consumes it within the table's retention period.
        Snowflake extends retention for an unconsumed stream up to «MAX_DATA_EXTENSION_TIME_IN_DAYS»,
        14 days by default. After that, the changes are gone and you must rebuild the target.

        ## Dynamic tables: say what, not how

        A **dynamic table** is defined by a query and a **target lag**. Snowflake works out the
        refresh, incrementally when it can.

        ~~~sql
        CREATE DYNAMIC TABLE analytics.city_hourly_revenue
          TARGET_LAG = '10 minutes'
          WAREHOUSE = wh_etl
          REFRESH_MODE = AUTO
        AS
          SELECT city_id, DATE_TRUNC('hour', completed_at) AS hour, SUM(fare_usd) AS revenue
          FROM analytics.trips
          WHERE status = 'completed'
          GROUP BY 1, 2;
        ~~~

        - «TARGET_LAG = DOWNSTREAM» refreshes a table only when a table that reads it needs fresh
          data.
        - Some query shapes cannot refresh incrementally and fall back to full refresh. Check
          «refresh_mode» in «SHOW DYNAMIC TABLES» to see what Snowflake chose.

        ## Which one?

        | Need | Choose |
        |---|---|
        | A chain of SQL transforms with a freshness goal | Dynamic tables |
        | Custom logic: calls to procedures, external functions, notifications | Streams and tasks |
        | Hard ordering, retries and cross-system steps | An orchestrator such as Airflow |

        > [!senior] Name the delivery guarantee
        > Streams plus a MERGE in one transaction give exactly-once processing inside Snowflake:
        > if the MERGE fails, the offset does not move. Say this, and also say what you monitor:
        > task failures in «TASK_HISTORY» and how close each stream is to going stale.

        > [!trap] Two consumers on one stream
        > A stream has one offset. If two tasks read the same stream, the first one to commit
        > consumes the changes and the second sees nothing. Create one stream per consumer.
      `,
      checks: [
        {
          question: 'When does a stream offset move forward?',
          options: [
            'Whenever someone runs SELECT on the stream',
            'When a DML statement that reads the stream commits',
            'Every five minutes',
            'When the source table is clustered',
          ],
          answer: 1,
          why: 'Only a committed DML transaction that reads the stream consumes it. That is what makes stream plus MERGE safe to retry.',
        },
        {
          question: 'Why is WHEN SYSTEM$STREAM_HAS_DATA useful on a task?',
          options: [
            'It makes the task serverless',
            'It skips the run without starting a warehouse when there are no changes',
            'It stops the stream going stale',
            'It runs the task more often',
          ],
          answer: 1,
          why: 'The check runs in cloud services, so an idle five-minute task does not bill a 60-second warehouse minimum every time.',
        },
      ],
    },
    {
      slug: 'databricks-platform',
      title: 'The Databricks platform',
      summary:
        'Explain the control and compute planes, pick the right compute, and build ingestion with Auto Loader and declarative pipelines.',
      minutes: 16,
      body: `
        Databricks runs Apache Spark, Delta Lake and SQL on your cloud storage. The lakehouse
        track covers Delta itself. This lesson covers the platform around it.

        ## Control plane and compute plane

        - The **control plane** lives in the Databricks account: the web app, notebooks, the job
          scheduler, cluster management and Unity Catalog metadata.
        - The **compute plane** is where data is processed. **Classic** compute runs as VMs in
          your own cloud account and network. **Serverless** compute runs in Databricks' account,
          starts in seconds and is billed only while it runs.

        Your data stays in your bucket either way. Interviewers ask this to see if you know where
        data and credentials flow.

        ## Compute types

        | Compute | For | Note |
        |---|---|---|
        | All-purpose cluster | Notebooks, exploration | The highest DBU rate; easy to leave running |
        | Jobs compute | Scheduled jobs | Created for one run, then removed; cheaper per DBU |
        | SQL warehouse | BI and SQL | Classic, pro or serverless; uses Photon |
        | Serverless jobs and notebooks | Jobs without cluster tuning | No VM to size; pay per use |

        Billing is in **DBUs** (Databricks units) per hour, plus the cloud VM cost for classic
        compute. **Photon** is a vectorized engine written in C++ that runs Spark SQL and
        DataFrame work faster, at a higher DBU rate. It helps scans, joins and aggregations, and
        does nothing for Python UDFs.

        > [!trap] Production jobs on an all-purpose cluster
        > Pointing a nightly job at the team's shared interactive cluster costs more per DBU, keeps
        > the cluster alive, and lets one user's notebook starve the job. Run jobs on jobs compute
        > or serverless.

        ## Jobs

        **Lakeflow Jobs** (formerly Workflows) is the built-in scheduler. A job is a graph of
        tasks: notebooks, Python wheels, SQL, dbt, or a pipeline. It supports retries, task
        values passed between tasks, triggers on a schedule, on file arrival or on a table update,
        and **repair run**, which reruns only the failed tasks. Define jobs as code with
        **Databricks Asset Bundles**, YAML files deployed from CI.

        ## Auto Loader

        **Auto Loader** ingests new files from cloud storage incrementally, with exactly-once
        tracking of which files it has seen.

        ~~~python
        (spark.readStream.format("cloudFiles")
            .option("cloudFiles.format", "json")
            .option("cloudFiles.schemaLocation", "/Volumes/raw/trips/_schemas")
            .option("cloudFiles.schemaEvolutionMode", "addNewColumns")
            .load("s3://acme-raw/trips/")
            .writeStream
            .option("checkpointLocation", "/Volumes/raw/trips/_checkpoints/bronze")
            .trigger(availableNow=True)
            .toTable("raw.trips.bronze"))
        ~~~

        - The **checkpoint** records every file processed, so a restart never loads a file twice.
        - **Directory listing** mode finds files by listing the path. **File notification** mode
          subscribes to bucket events, which scales to millions of files.
        - Schema inference stores the schema at «schemaLocation». A new column stops the stream
          once, then the restart picks up the evolved schema. Values that do not fit the schema
          go to the «_rescued_data» column instead of being lost.
        - «trigger(availableNow=True)» processes everything new and stops, so a streaming reader
          runs as a cheap scheduled batch.

        ## Lakeflow Declarative Pipelines

        **Lakeflow Declarative Pipelines** (formerly Delta Live Tables) let you declare tables and
        their quality rules; Databricks runs the graph, retries and scaling.

        ~~~sql
        CREATE OR REFRESH STREAMING TABLE trips_bronze
        AS SELECT * FROM STREAM read_files('s3://acme-raw/trips/', format => 'json');

        CREATE OR REFRESH STREAMING TABLE trips_silver (
          CONSTRAINT valid_fare EXPECT (fare_usd >= 0) ON VIOLATION DROP ROW,
          CONSTRAINT has_id EXPECT (trip_id IS NOT NULL) ON VIOLATION FAIL UPDATE
        )
        AS SELECT trip_id, city_id, CAST(fare_usd AS DECIMAL(10, 2)) AS fare_usd, updated_at
        FROM STREAM(trips_bronze);
        ~~~

        - A **streaming table** processes each input row once. A **materialized view** recomputes
          its result, incrementally when it can.
        - **Expectations** keep the row, drop it or fail the update, and the pipeline records how
          many rows broke each rule.
        - «AUTO CDC» (formerly «APPLY CHANGES INTO») turns a change feed into an SCD type 1 or
          type 2 table, and handles out-of-order events with a sequence column.

        > [!senior] Classic or serverless is a cost and control trade-off
        > Serverless removes cluster tuning and idle time, which wins for spiky and small jobs.
        > Classic compute gives you control of instance types, spot capacity and network
        > placement, which can win for large, steady jobs. Say which workload goes where.
      `,
      checks: [
        {
          question: 'Where does classic Databricks compute run?',
          options: [
            'In the Databricks control plane',
            'As VMs in your own cloud account',
            'Inside Unity Catalog',
            'On the SQL warehouse only',
          ],
          answer: 1,
          why: 'Classic compute is created in your cloud account and network. Serverless compute runs in the Databricks account.',
        },
        {
          question: 'Auto Loader restarts after a crash. How does it avoid loading files twice?',
          options: [
            'It deletes files after loading them',
            'It records processed files in the stream checkpoint',
            'It compares row counts with the source',
            'It cannot avoid it',
          ],
          answer: 1,
          why: 'The checkpoint keeps the set of files already ingested, which gives exactly-once file processing.',
        },
      ],
    },
    {
      slug: 'unity-catalog',
      title: 'Unity Catalog and governance',
      summary:
        'Explain the three-level namespace, managed and external tables, grants, row filters and column masks, lineage and system tables.',
      minutes: 15,
      body: `
        **Unity Catalog** is the governance layer of Databricks. It holds the metadata, the
        permissions, the lineage and the audit log for tables, views, volumes, functions and ML
        models, across every workspace that is attached to it.

        ## The object model

        ~~~text
        metastore (one per cloud region)
        └── catalog            prod, dev, raw
            └── schema         trips
                ├── table      prod.trips.fct_trips
                ├── view
                ├── volume     /Volumes/prod/trips/landing/   (files)
                ├── function   (also row filters and masks)
                └── model
        ~~~

        Every object has a three-part name: «catalog.schema.object». Workspaces attach to the
        regional metastore, and a catalog can be bound to only some workspaces, for example to
        keep «prod» out of the dev workspace.

        The old per-workspace Hive metastore still shows up as the «hive_metastore» catalog until
        you migrate.

        ## Managed and external tables

        | | Managed table | External table |
        |---|---|---|
        | Files live in | Storage that Unity Catalog manages | A path you choose |
        | DROP TABLE | Deletes the data (UNDROP works for 7 days) | Deletes only the metadata |
        | Maintenance | Predictive optimization runs OPTIMIZE and VACUUM for you | You schedule it |
        | Use for | The default for new tables | Data that other systems also write to |

        To reach your own bucket, an admin creates a **storage credential** (a cloud IAM role or a
        managed identity) and an **external location** (a path plus that credential). Users get
        grants on the external location, never the cloud keys.

        ## Grants

        Privileges inherit downward, and a user needs a privilege at every level to reach a table.

        ~~~sql
        GRANT USE CATALOG ON CATALOG prod TO analysts;
        GRANT USE SCHEMA ON SCHEMA prod.trips TO analysts;
        GRANT SELECT ON SCHEMA prod.trips TO analysts;
        ~~~

        «SELECT» on the schema covers every current and future table in it. Grant to **groups**,
        never to people, and give each catalog an owner group.

        ## Row filters and column masks

        A row filter or a mask is a SQL function that Unity Catalog applies on every read, for
        every engine.

        ~~~sql
        CREATE FUNCTION prod.gov.mask_email(email STRING)
        RETURN CASE WHEN is_account_group_member('pii_readers') THEN email ELSE '***' END;

        ALTER TABLE prod.trips.riders ALTER COLUMN email SET MASK prod.gov.mask_email;

        CREATE FUNCTION prod.gov.city_filter(city_id INT)
        RETURN is_account_group_member('global_ops')
          OR city_id IN (SELECT city_id FROM prod.gov.analyst_cities WHERE user = current_user());

        ALTER TABLE prod.trips.fct_trips SET ROW FILTER prod.gov.city_filter ON (city_id);
        ~~~

        At scale, attach policies to **tags** instead of to each table, so a new column tagged
        «pii» is masked the day it lands. Databricks calls this attribute-based access control.

        ## Lineage, audit and system tables

        Unity Catalog captures **column-level lineage** for queries that run on Databricks
        compute, without extra code. The **system tables** in the «system» catalog expose the rest
        as data you can query:

        - «system.access.audit»: who read or changed what.
        - «system.billing.usage»: DBUs per job, warehouse and tag.
        - «system.query.history»: SQL warehouse queries and their run time.

        **Delta Sharing** shares live tables with another account or company without copying
        them, through an open protocol. Unity Catalog itself was open-sourced in 2024, and it
        serves Delta and Iceberg tables to outside engines.

        > [!senior] Migrating from the Hive metastore is a project, not a command
        > Inventory tables and jobs first; Databricks provides the UCX tool for this. Map old
        > databases to catalogs and schemas, move or upgrade tables (SYNC for external tables,
        > CTAS or DEEP CLONE for managed ones), rewrite two-part names in code, then switch jobs
        > to compute that enforces Unity Catalog. Plan a period where both catalogs are live.

        > [!trap] Granting on the bucket instead of in the catalog
        > If analysts still have direct read access to the S3 bucket, they can bypass every row
        > filter and mask. Remove direct bucket access once tables are governed by Unity Catalog.
      `,
      checks: [
        {
          question:
            'An analyst has SELECT on prod.trips.fct_trips but gets a permission error. What is missing?',
          options: [
            'MODIFY on the table',
            'USE CATALOG on prod and USE SCHEMA on prod.trips',
            'A storage credential',
            'Ownership of the metastore',
          ],
          answer: 1,
          why: 'Unity Catalog needs USE CATALOG and USE SCHEMA on the parents before SELECT on the table is usable.',
        },
        {
          question: 'What happens to the files when you DROP an external table?',
          options: [
            'They are deleted at once',
            'They are deleted after 7 days',
            'They stay; only the metadata is removed',
            'They move to the managed location',
          ],
          answer: 2,
          why: 'Unity Catalog does not own the files of an external table, so DROP removes only the table definition.',
        },
      ],
    },
    {
      slug: 'choosing-a-platform',
      title: 'Snowflake, Databricks or BigQuery?',
      summary:
        'Compare the platforms on the axes interviewers care about, and give a recommendation with its trade-offs.',
      minutes: 12,
      body: `
        "Why Snowflake and not Databricks?" is a common senior question. There is no right
        platform. There is a right **reason**, tied to the workload and the team.

        ## The axes that matter

        | Axis | Snowflake | Databricks | BigQuery |
        |---|---|---|---|
        | Core strength | Managed SQL warehouse | Spark, ML and streaming on open tables | Serverless SQL warehouse |
        | Compute model | Warehouses you size; per-second credits | Clusters or serverless; DBUs plus VMs | Slots, or pay per TB scanned |
        | Storage | Managed micro-partitions, or Iceberg | Delta or Iceberg in your bucket | Managed Capacitor, or BigLake Iceberg |
        | Tuning effort | Low | Medium to high | Low |
        | Languages | SQL first; Python through Snowpark | Python, Scala, SQL | SQL first; Python through BigFrames |
        | Streaming | Snowpipe Streaming, dynamic tables | Structured Streaming | Storage Write API, continuous queries |
        | Governance | RBAC, masking and row policies, Horizon | Unity Catalog | IAM, policy tags, Dataplex |
        | Sharing | Secure data sharing, Marketplace | Delta Sharing | Analytics Hub |

        ## The gap is closing

        Each platform now copies the others' strengths:

        - Snowflake reads and writes **Apache Iceberg** tables, runs Python with **Snowpark**, and
          offers LLM functions through **Cortex**.
        - Databricks runs serverless **SQL warehouses** for BI and competes on warehouse price.
        - Both can expose tables through an Iceberg REST catalog, so one copy of the data can serve
          several engines.

        So the decision rests less on features and more on cost model, skills and lock-in.

        ## A structure for the answer

        1. **Workloads.** BI and SQL only, or heavy Spark, ML and streaming too?
        2. **Team.** Do the people write SQL or Python? Who will tune clusters?
        3. **Cloud and data gravity.** Where does the data already live? Egress is real money.
        4. **Cost model.** Can finance predict it? Per-second credits, DBUs plus VMs, and per-TB
           scans fail in different ways.
        5. **Openness.** Do other engines need the same tables? Then store them as Iceberg or
           Delta in your own bucket.
        6. **Governance.** One catalog for every engine, or one per platform?

        > [!example] A sample recommendation
        > "A 40-person analytics team that writes SQL, loads data from SaaS tools and runs
        > dashboards: Snowflake. Little to tune, and good concurrency for BI. A team that trains
        > models on clickstream and runs Structured Streaming: Databricks. If both teams exist,
        > keep shared tables in Iceberg so either engine can read them, and pick one catalog as the
        > source of truth."

        > [!senior] Talk about cost controls, not list prices
        > List prices change every year. Controls do not: auto-suspend and resource monitors in
        > Snowflake, cluster policies and budgets in Databricks, quotas and reservations in
        > BigQuery. Name the control you would set up on day one.

        > [!trap] Comparing a benchmark instead of your workload
        > Vendor benchmarks run tuned queries on clean data. Run your ten most expensive real
        > queries on each platform for a week before you decide.
      `,
      checks: [
        {
          question: 'Several engines must read the same tables. What keeps that open?',
          options: [
            'Store the data in each warehouse twice',
            'Store tables in an open format such as Iceberg in your own bucket, with one catalog',
            'Export CSV files nightly',
            'Use only result caching',
          ],
          answer: 1,
          why: 'An open table format plus a shared catalog lets Snowflake, Databricks, Spark and Trino read one copy of the data.',
        },
      ],
    },
    {
      slug: 'lab-databricks-medallion',
      title: 'Hands-on: build a medallion pipeline on Databricks',
      summary:
        'Build bronze, silver and gold tables on Databricks Free Edition with Auto Loader, a MERGE and a scheduled job, then break it with duplicate files and prove it holds.',
      minutes: 18,
      body: `
        This lab builds a small but real pipeline: raw JSON files land in a volume, Auto Loader
        ingests them into bronze, a «MERGE» builds a deduplicated silver table, and a gold table
        serves a dashboard. A job runs the three steps in order. It takes about 45 minutes.

        ## Before you start

        - Sign up for **Databricks Free Edition** (free, no cloud account needed). It runs on
          serverless compute with usage limits, which is plenty for this lab.
        - The lab uses the default catalog «workspace». If your workspace has a different default,
          replace «workspace» everywhere.
        - Create a notebook named «00_setup» and run each step in its own cell.

        ## Step 1: a schema, two volumes and raw files

        ~~~sql
        CREATE SCHEMA IF NOT EXISTS workspace.taxi_lab;
        CREATE VOLUME IF NOT EXISTS workspace.taxi_lab.raw;
        CREATE VOLUME IF NOT EXISTS workspace.taxi_lab.chk;
        ~~~

        Now pretend to be the source system. Write two batches of trips from the built-in sample
        table as JSON files:

        ~~~python
        from pyspark.sql import functions as F

        trips = spark.table("samples.nyctaxi.trips")
        RAW = "/Volumes/workspace/taxi_lab/raw/trips"

        day1 = trips.filter(F.to_date("tpep_pickup_datetime") == "2016-02-14")
        day1.write.mode("append").json(f"{RAW}/batch=1")
        ~~~

        **Predict:** how many files did Spark write, and why more than one? Open the volume in
        Catalog Explorer to check.

        ## Step 2: bronze with Auto Loader

        Create a notebook «01_bronze»:

        ~~~python
        from pyspark.sql import functions as F

        RAW = "/Volumes/workspace/taxi_lab/raw/trips"
        CHK = "/Volumes/workspace/taxi_lab/chk/bronze_trips"

        (
            spark.readStream.format("cloudFiles")
            .option("cloudFiles.format", "json")
            .option("cloudFiles.schemaLocation", CHK)
            .option("cloudFiles.inferColumnTypes", "true")
            .load(RAW)
            .withColumn("_ingested_at", F.current_timestamp())
            .withColumn("_source_file", F.col("_metadata.file_path"))
            .writeStream.option("checkpointLocation", CHK)
            .trigger(availableNow=True)
            .toTable("workspace.taxi_lab.bronze_trips")
        )
        ~~~

        - «cloudFiles» is Auto Loader. It remembers which files it has ingested in the checkpoint,
          so a rerun reads only new files.
        - «availableNow» processes everything new, then stops. That makes a stream behave like an
          incremental batch, which suits a scheduled job and serverless compute.
        - Bronze keeps the data as received, plus where and when it came from.

        Run it twice. **Predict:** what does the second run add? (Nothing: no new files.)

        ## Step 3: silver with a MERGE

        The source has no trip id, so build one from the fields that identify a trip. Create a SQL
        notebook «02_silver»:

        ~~~sql
        CREATE TABLE IF NOT EXISTS workspace.taxi_lab.silver_trips (
          trip_id STRING,
          pickup_ts TIMESTAMP,
          dropoff_ts TIMESTAMP,
          pickup_zip INT,
          dropoff_zip INT,
          trip_distance DOUBLE,
          fare_amount DOUBLE,
          _ingested_at TIMESTAMP
        );

        MERGE INTO workspace.taxi_lab.silver_trips AS s
        USING (
          SELECT * FROM (
            SELECT
              sha2(to_json(struct(tpep_pickup_datetime, tpep_dropoff_datetime,
                                  pickup_zip, dropoff_zip, trip_distance, fare_amount)), 256) AS trip_id,
              to_timestamp(tpep_pickup_datetime) AS pickup_ts,
              to_timestamp(tpep_dropoff_datetime) AS dropoff_ts,
              CAST(pickup_zip AS INT) AS pickup_zip,
              CAST(dropoff_zip AS INT) AS dropoff_zip,
              CAST(trip_distance AS DOUBLE) AS trip_distance,
              CAST(fare_amount AS DOUBLE) AS fare_amount,
              _ingested_at
            FROM workspace.taxi_lab.bronze_trips
            WHERE fare_amount > 0
          )
          QUALIFY row_number() OVER (PARTITION BY trip_id ORDER BY _ingested_at DESC) = 1
        ) AS b
        ON s.trip_id = b.trip_id
        WHEN MATCHED AND b._ingested_at > s._ingested_at THEN UPDATE SET *
        WHEN NOT MATCHED THEN INSERT *;
        ~~~

        - «QUALIFY» keeps one row per trip inside the batch; the «MERGE» keeps one row per trip
          across batches. Running it again changes nothing, so the step is **idempotent**.
        - For a large bronze table, filter the source to recent «_ingested_at» values instead of
          reading all of bronze each time.

        ## Step 4: gold

        Create «03_gold»:

        ~~~sql
        CREATE OR REPLACE TABLE workspace.taxi_lab.gold_daily_zip AS
        SELECT
          to_date(pickup_ts) AS trip_date,
          pickup_zip,
          count(*) AS trips,
          round(sum(fare_amount), 2) AS revenue,
          round(avg(trip_distance), 2) AS avg_miles
        FROM workspace.taxi_lab.silver_trips
        GROUP BY ALL;
        ~~~

        ## Step 5: a job

        1. Open **Jobs & Pipelines**, choose **Create**, then **Job**.
        2. Add three notebook tasks: «bronze» (01_bronze), «silver» (02_silver, depends on bronze)
           and «gold» (03_gold, depends on silver). Use serverless compute.
        3. Run the job now and watch each task turn green. Then add a daily schedule if you like.

        ## Step 6: break it

        A partner re-sends yesterday's data under a new folder name. Simulate it:

        ~~~python
        day1.write.mode("append").json(f"{RAW}/batch=1-resent")
        ~~~

        **Predict** before you run the job: will bronze grow? Will silver? Will gold change?

        Run the job, then check:

        ~~~sql
        SELECT
          (SELECT count(*) FROM workspace.taxi_lab.bronze_trips) AS bronze_rows,
          (SELECT count(*) FROM workspace.taxi_lab.silver_trips) AS silver_rows,
          (SELECT sum(trips) FROM workspace.taxi_lab.gold_daily_zip) AS gold_trips;
        ~~~

        Bronze doubles, because Auto Loader tracks files by path and these are new files. Silver and
        gold do not change, because the «MERGE» deduplicates by trip id. This is why bronze keeps
        everything and silver enforces the business key.

        ## Clean up

        ~~~sql
        DROP SCHEMA workspace.taxi_lab CASCADE;
        ~~~

        > [!senior] What to say about this pipeline
        > "Auto Loader with availableNow gives incremental, exactly-once file ingestion into bronze.
        > Silver is an idempotent MERGE on a business key, so replays and re-sent files are safe.
        > Gold is rebuilt from silver. A job orders the steps, and each step can be rerun alone."
      `,
      checks: [
        {
          question:
            'Why does bronze double after the partner re-sends files, while silver does not?',
          options: [
            'Auto Loader is broken',
            'Auto Loader tracks files by path, so new paths are new input; the MERGE on trip_id removes the duplicates',
            'Silver is a view',
            'Gold deletes duplicates',
          ],
          answer: 1,
          why: 'File-level exactly-once is not record-level deduplication. The business key in silver is what makes replays safe.',
        },
        {
          question: 'What does trigger(availableNow=True) do?',
          options: [
            'Runs forever with a 1 second trigger',
            'Processes all data available now in one or more batches, then stops',
            'Processes only the newest file',
            'Disables checkpoints',
          ],
          answer: 1,
          why: 'It gives a stream incremental batch behaviour, so a scheduled job can run it and stop.',
        },
      ],
    },
    {
      slug: 'lab-databricks-declarative-pipeline',
      title: 'Hands-on: the same pipeline as a declarative pipeline',
      summary:
        'Rebuild the medallion lab with Lakeflow Declarative Pipelines: streaming tables, expectations, AUTO CDC and a materialized view, and read the data quality metrics.',
      minutes: 15,
      body: `
        The first lab wired every step by hand: checkpoints, «MERGE» logic and task order. A
        **declarative pipeline** lets you state the tables you want. The platform works out the
        order, the checkpoints, retries and incremental refresh. On Databricks this is **Lakeflow
        Declarative Pipelines**, formerly called Delta Live Tables (DLT). The same model is now part
        of open source Spark as Spark Declarative Pipelines.

        Do the first lab's Step 1 first, so the raw files exist.

        ## Step 1: create the pipeline

        1. Open **Jobs & Pipelines**, choose **Create**, then **ETL pipeline**.
        2. Name it «taxi_declarative». Set the default catalog to «workspace» and the schema to
           «taxi_dlp» (create it if needed).
        3. Add a SQL file to the pipeline and paste the steps below into it.

        ## Step 2: bronze as a streaming table

        ~~~sql
        CREATE OR REFRESH STREAMING TABLE bronze_trips
        COMMENT 'Raw taxi trips as received'
        AS SELECT *, _metadata.file_path AS source_file, current_timestamp() AS ingested_at
        FROM STREAM read_files('/Volumes/workspace/taxi_lab/raw/trips', format => 'json');
        ~~~

        A **streaming table** reads each new input once. «read_files» in a stream uses Auto Loader
        underneath.

        ## Step 3: clean rows with expectations

        ~~~sql
        CREATE OR REFRESH STREAMING TABLE trips_clean (
          CONSTRAINT positive_fare EXPECT (fare_amount > 0) ON VIOLATION DROP ROW,
          CONSTRAINT ends_after_start EXPECT (dropoff_ts > pickup_ts) ON VIOLATION DROP ROW,
          CONSTRAINT has_zip EXPECT (pickup_zip IS NOT NULL)
        )
        AS SELECT
          sha2(to_json(struct(tpep_pickup_datetime, tpep_dropoff_datetime,
                              pickup_zip, dropoff_zip, trip_distance, fare_amount)), 256) AS trip_id,
          to_timestamp(tpep_pickup_datetime) AS pickup_ts,
          to_timestamp(tpep_dropoff_datetime) AS dropoff_ts,
          CAST(pickup_zip AS INT) AS pickup_zip,
          CAST(trip_distance AS DOUBLE) AS trip_distance,
          CAST(fare_amount AS DOUBLE) AS fare_amount,
          ingested_at
        FROM STREAM(bronze_trips);
        ~~~

        | Expectation action | Effect |
        |---|---|
        | No action (warn) | Keep the row, count the violation |
        | «ON VIOLATION DROP ROW» | Drop the row, count it |
        | «ON VIOLATION FAIL UPDATE» | Stop the update; nothing bad is published |

        ## Step 4: silver with AUTO CDC

        Deduplicate by key with **AUTO CDC** (older documentation calls it «APPLY CHANGES»):

        ~~~sql
        CREATE OR REFRESH STREAMING TABLE silver_trips;

        CREATE FLOW silver_trips_upsert AS AUTO CDC INTO silver_trips
        FROM STREAM(trips_clean)
        KEYS (trip_id)
        SEQUENCE BY ingested_at
        STORED AS SCD TYPE 1;
        ~~~

        «SCD TYPE 1» keeps the latest row per key. «SCD TYPE 2» would keep history with start and
        end columns, which is a one-word change compared with a hand-written type 2 «MERGE».

        ## Step 5: gold as a materialized view

        ~~~sql
        CREATE OR REFRESH MATERIALIZED VIEW gold_daily_zip AS
        SELECT to_date(pickup_ts) AS trip_date, pickup_zip,
               count(*) AS trips, round(sum(fare_amount), 2) AS revenue
        FROM silver_trips
        GROUP BY ALL;
        ~~~

        A **materialized view** is recomputed on each update, incrementally when the engine can.

        ## Step 6: run, read and break

        1. Click **Run pipeline**. The graph shows the four tables and the rows that flowed.
        2. Select «trips_clean» and open its data quality metrics: how many rows did each
           expectation drop?
        3. Re-send the files as in the first lab and run again. **Predict**, then check: bronze grows,
           silver does not.
        4. Change «positive_fare» to «ON VIOLATION FAIL UPDATE», add a file with a negative fare,
           and run. The update fails and gold keeps its last good state.

        ## Hand-built or declarative?

        | | Hand-built (lab 1) | Declarative (this lab) |
        |---|---|---|
        | Control | Full: any Spark code | Within the framework's model |
        | Boilerplate | Checkpoints, MERGE, task order | Little |
        | Data quality | Your own checks | Expectations with metrics built in |
        | Portability | Plain Spark and Delta | Tied to the platform (with a growing open source core) |

        ## Clean up

        Delete the pipeline in Jobs & Pipelines, then run «DROP SCHEMA workspace.taxi_dlp CASCADE».

        > [!senior] When to choose declarative
        > "For standard ingest, clean, dedupe and aggregate flows, declarative pipelines remove most
        > of the plumbing and give quality metrics for free. For unusual logic, cross-system
        > coordination or engine portability, I keep hand-built jobs." Interviewers want the trade-off,
        > not loyalty to a feature.
      `,
      checks: [
        {
          question: 'What does ON VIOLATION FAIL UPDATE do when a row breaks the expectation?',
          options: [
            'Drops the row and continues',
            'Keeps the row and logs a warning',
            'Stops the update, so the bad data is not published',
            'Moves the row to gold',
          ],
          answer: 2,
          why: 'FAIL UPDATE treats the violation as fatal for this update. Tables keep their last good state until the data is fixed.',
        },
        {
          question: 'Which clause deduplicates silver_trips by trip_id in this pipeline?',
          options: [
            'CONSTRAINT ... EXPECT',
            'AUTO CDC INTO ... KEYS (trip_id) SEQUENCE BY ingested_at',
            'CREATE MATERIALIZED VIEW',
            'read_files',
          ],
          answer: 1,
          why: 'AUTO CDC applies changes by key, keeping the latest row by the sequence column (SCD type 1).',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'sf-snowpipe-duplicate-rows',
    title: 'Snowpipe loaded the same trips twice',
    track: 'snowflake-databricks',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      Trip files land in «s3://acme-raw/trips/» and a Snowpipe with auto-ingest loads them into
      «raw.trips». After an upstream team reran a failed export, the daily trip count doubled for
      one day. Some of the duplicate files had the same names as the originals, and some had new
      names. Explain what happened and design the fix.
    `,
    hints: [
      'What does Snowpipe use to decide a file was already loaded, and for how long?',
      'A rerun can write the same name with new bytes, or the same rows under a new name.',
      'Deduplication by file is not deduplication by row.',
    ],
    answer: `
      **What happened.** Snowpipe skips a file only if its load history (14 days) has the same
      path and the same content. The rerun produced two kinds of duplicates:

      - Same name, new content (new checksum, new ETag): Snowpipe treats it as a new file.
      - New name, same rows: a different file, so it loads.

      File-level deduplication can never catch rows that arrive twice in different files.

      **Fix in three layers.**

      1. **Make the raw layer append-only and traceable.** Keep «file_name» and «loaded_at» on
         every row (from «METADATA$FILENAME»), so you can see which files carried duplicates and
         delete them by file if needed.
      2. **Deduplicate on a business key downstream.** The staging model keeps the latest row
         per «trip_id»:

      ~~~sql
      SELECT *
      FROM raw.trips_flat
      QUALIFY ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY updated_at DESC, loaded_at DESC) = 1;
      ~~~

      3. **Agree a contract with the producer.** Reruns write to a new, versioned prefix and
         publish a manifest; the consumer loads only the manifest's files.

      **Detect it next time.** A daily check that compares row counts and distinct «trip_id»
      counts per day, and alerts when they diverge.

      **Repair today.** Find the duplicate files with «COPY_HISTORY», delete their rows from
      raw by «file_name», or let the deduplicating staging model absorb them, then rebuild the
      affected day downstream.
    `,
    signals: [
      'Knows Snowpipe deduplicates by file path and content, for 14 days',
      'Separates file-level and row-level duplicates',
      'Keeps file name and load time in raw for traceability',
      'Deduplicates on a business key downstream, not only at ingestion',
      'Adds a count reconciliation check',
    ],
    followUps: ['How would this change with Snowpipe Streaming from Kafka?'],
  },
  {
    slug: 'sf-slow-dashboard-query',
    title: 'A Snowflake dashboard query takes 4 minutes',
    track: 'snowflake-databricks',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      An operations dashboard filters a 60 TB «analytics.trips» table by «city_id» and the last 7
      days. It runs on a Medium warehouse and takes about 4 minutes. The team wants to move it to
      an X-Large. The query profile shows:

      ~~~text
      Partitions scanned:   410,000 of 452,000
      Bytes spilled local:  0
      Bytes spilled remote: 0
      Queued time:          2 s
      ~~~

      The table is loaded by a MERGE every 15 minutes. What do you recommend?
    `,
    hints: [
      'Which line of the profile is the problem? Which lines rule out other causes?',
      'Why would a 7-day filter scan 90% of the partitions?',
      'A clustering key on a table merged every 15 minutes has a cost.',
    ],
    answer: `
      **Diagnosis.** No spilling and almost no queuing, so neither a bigger warehouse nor more
      clusters will help much. An X-Large would scan the same 410,000 partitions about four times
      faster, at four times the credits per hour. The problem is **pruning**: 91% of partitions
      are scanned for a 7-day filter.

      The likely cause is the MERGE. Updates to old trips (ratings, refunds, fare adjustments)
      rewrite micro-partitions, and new micro-partitions mix old and new dates. Over time every
      partition covers a wide date range, so the date filter cannot prune.

      **Options, cheapest first.**

      1. **Filter on the right column.** If the dashboard filters on «completed_at» but the
         table is organised by «created_at», align them.
      2. **Clustering key** «CLUSTER BY (TO_DATE(completed_at), city_id)». Check the average
         depth before and after with «SYSTEM$CLUSTERING_INFORMATION». Then watch
         «AUTOMATIC_CLUSTERING_HISTORY»: with a MERGE every 15 minutes, reclustering credits can
         be large. Reduce churn by merging only rows that really changed.
      3. **Serve the dashboard from a smaller table.** A dynamic table or a dbt incremental
         model with the last 30 days aggregated by city and hour. The dashboard reads megabytes
         instead of terabytes.
      4. **Result cache.** Make the dashboard query text stable (no «CURRENT_TIMESTAMP()» in it;
         use «CURRENT_DATE()» bounds), so repeated loads cost nothing.

      **Recommendation.** Option 3 for the dashboard, option 2 if many other queries filter the
      big table by date. Do not resize the warehouse: the profile does not justify it.

      **Prove it.** Compare partitions scanned, run time and credits per day for one week before
      and after.
    `,
    signals: [
      'Reads the profile and rules out spilling and queuing before choosing a fix',
      'Explains how frequent merges destroy natural clustering',
      'Weighs the Automatic Clustering cost against the query savings',
      'Offers a pre-aggregated serving table for the dashboard',
      'Defines how to measure success in credits and partitions scanned',
    ],
    followUps: [
      'The dashboard also looks up single trips by trip_id. What would you add?',
      'How do you stop the clustering cost from growing as the table grows?',
    ],
  },
  {
    slug: 'sf-flatten-order-items',
    title: 'Top SKUs from nested order JSON',
    track: 'snowflake-databricks',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      «raw.orders» has one VARIANT column «payload» per Eats order:

      ~~~text
      {"order_id": "o1", "city": "SF", "status": "delivered",
       "items": [{"sku": "burger", "qty": 2, "price": 8.5},
                 {"sku": "fries",  "qty": 1, "price": 3.0}]}
      ~~~

      Some orders have no «items» key, and the same order can appear more than once with a newer
      «status». For each city, return the top 3 SKUs by revenue («qty × price») over delivered
      orders, using only the latest version of each order. Keep ties.
    `,
    hints: [
      'Deduplicate orders first, then flatten. In which order do the steps go, and why?',
      'Cast every path you use. What does a missing items key do to an inner FLATTEN?',
      'RANK keeps ties; ROW_NUMBER does not.',
    ],
    answer: `
      Deduplicate before you flatten, or one order's items get counted once per version.

      ~~~sql
      WITH latest AS (
        SELECT payload
        FROM raw.orders
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY payload:order_id::STRING
          ORDER BY payload:updated_at::TIMESTAMP_NTZ DESC
        ) = 1
      ),
      items AS (
        SELECT
          l.payload:city::STRING AS city,
          i.value:sku::STRING AS sku,
          i.value:qty::NUMBER * i.value:price::NUMBER(10, 2) AS revenue
        FROM latest AS l,
          LATERAL FLATTEN(input => l.payload:items) AS i
        WHERE l.payload:status::STRING = 'delivered'
      ),
      by_sku AS (
        SELECT city, sku, SUM(revenue) AS revenue
        FROM items
        GROUP BY city, sku
      )
      SELECT city, sku, revenue
      FROM by_sku
      QUALIFY RANK() OVER (PARTITION BY city ORDER BY revenue DESC) <= 3
      ORDER BY city, revenue DESC;
      ~~~

      Notes a senior candidate says out loud:

      - The inner FLATTEN drops orders with no items, which is right here: they have no revenue.
        If the question asked for orders per city, use «OUTER => TRUE».
      - Without the casts, «qty * price» multiplies VARIANT values and the GROUP BY on «sku»
        compares VARIANT, not strings.
      - «QUALIFY» filters on a window result without another subquery.
      - For a big table, promote «order_id», «city», «status» and «updated_at» into typed
        columns in staging, so the deduplication can prune.
    `,
    signals: [
      'Deduplicates to the latest order version before flattening',
      'Casts VARIANT paths before arithmetic and grouping',
      'Explains inner versus OUTER FLATTEN for missing arrays',
      'Uses RANK so ties are kept',
      'Suggests promoting hot paths to typed columns',
    ],
    followUps: [
      'Items can now nest modifiers, such as extra cheese with its own price. How does the query change?',
    ],
  },
  {
    slug: 'sf-recover-bad-update',
    title: 'An UPDATE without a WHERE hit production',
    track: 'snowflake-databricks',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'google'],
    prompt: `
      At 09:12 an engineer ran «UPDATE analytics.drivers SET status = 'inactive';» in production.
      It was meant for one driver. Dashboards now show zero active drivers. The table is a
      permanent table with 1-day retention, and new driver sign-ups keep arriving through a task
      every 5 minutes. Walk through the recovery.
    `,
    hints: [
      'Time travel can show the table before one specific statement.',
      'Do not overwrite production until you have checked the restored data.',
      'Rows written after 09:12 by the task must not be lost.',
    ],
    answer: `
      1. **Stop the bleeding.** Suspend the task that writes to the table, so the state stops
         moving: «ALTER TASK ... SUSPEND».
      2. **Find the statement.** Get its query id from «QUERY_HISTORY» (filter on the user and
         the text).
      3. **Clone the state before it.**

      ~~~sql
      CREATE TABLE analytics.drivers_before CLONE analytics.drivers
        BEFORE(STATEMENT => '<query id of the bad UPDATE>');
      ~~~

      4. **Check.** Compare row counts and the count of active drivers with yesterday's numbers.
      5. **Bring back the new rows.** Sign-ups written by the task after 09:12 exist only in the
         current table. Insert them into the clone, matching on «driver_id»:

      ~~~sql
      INSERT INTO analytics.drivers_before
      SELECT c.* FROM analytics.drivers AS c
      LEFT JOIN analytics.drivers_before AS b USING (driver_id)
      WHERE b.driver_id IS NULL;
      ~~~

      6. **Swap and resume.** «ALTER TABLE analytics.drivers SWAP WITH analytics.drivers_before»,
         then resume the task. Keep the bad copy for a day for the postmortem.

      **Prevent it.** Raise retention on important tables (up to 90 days on Enterprise), take
      write access in production away from people and give it to pipelines, and require a
      reviewed script for manual fixes.
    `,
    signals: [
      'Pauses writers before restoring',
      'Uses BEFORE(STATEMENT) or a timestamp, and restores by clone and swap',
      'Keeps rows written after the incident',
      'Validates before switching production',
      'Proposes retention and access changes to prevent a repeat',
    ],
    followUps: ['The mistake is found 3 days later. What can you still do?'],
  },
  {
    slug: 'sf-credit-spike',
    title: 'Snowflake spend doubled in a month',
    track: 'snowflake-databricks',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      Finance reports that Snowflake credits went from about 40,000 to 80,000 a month. Nobody
      launched a big new project. You own the platform. How do you find the cause, fix it, and
      stop it from happening again?
    `,
    hints: [
      'Credits come from several sources, not only warehouses.',
      'ACCOUNT_USAGE has a view for each source of credits.',
      'Controls must act before the bill, not after it.',
    ],
    answer: `
      **1. Split the bill by source.** «SNOWFLAKE.ACCOUNT_USAGE.METERING_DAILY_HISTORY» shows
      credits by service type: warehouses, cloud services, Automatic Clustering, Snowpipe,
      materialized views, Search Optimization, serverless tasks, replication.

      **2. Drill into the source that grew.**

      - **Warehouses:** «WAREHOUSE_METERING_HISTORY» by warehouse and day. Look for a warehouse
        that never suspends (a BI tool polling every minute), a resized warehouse, or a raised
        multi-cluster maximum.
      - **Queries:** attribute cost by joining «QUERY_HISTORY» to warehouse time, or use
        «QUERY_ATTRIBUTION_HISTORY». Rank by query hash to find one repeated expensive query.
      - **Serverless features:** a new clustering key on a high-churn table, or a stream task
        that now runs every minute.
      - **Storage:** not credits, but check time travel bytes on high-churn tables.

      **3. Fix the top causes.** Typical fixes: auto-suspend 60 seconds on ETL warehouses, a
      dashboard served from an aggregate table, a full rebuild turned incremental, a clustering
      key removed, a task with «WHEN SYSTEM$STREAM_HAS_DATA».

      **4. Guardrails.**

      - **Resource monitors** on each warehouse and the account: notify at 80%, suspend at 110%
        of the monthly quota for non-critical warehouses.
      - One warehouse per workload and team, so cost has an owner.
      - «QUERY_TAG» set by dbt and Airflow, so every query names its pipeline.
      - «STATEMENT_TIMEOUT_IN_SECONDS» on ad hoc warehouses.
      - A weekly cost report per team, and a cost review for new clustering keys and
        multi-cluster settings.
    `,
    signals: [
      'Splits credits by service type before guessing',
      'Uses ACCOUNT_USAGE views to attribute cost to warehouses and queries',
      'Checks serverless features such as Automatic Clustering and tasks',
      'Sets resource monitors and per-workload warehouses',
      'Tags queries so cost has an owner',
    ],
    followUps: [
      'A team says resource monitors suspended their production job. How do you design the monitors so this does not happen?',
    ],
  },
  {
    slug: 'sf-cdc-streams-or-dynamic',
    title: 'Keep a trips mart fresh inside Snowflake',
    track: 'snowflake-databricks',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      A CDC tool writes every change of the payments database into «raw.trips_cdc» (one row per
      change, with an «op» column of I, U or D and a «lsn» sequence). Analysts want
      «analytics.trips» to show the current state of each trip within 10 minutes, and a daily
      revenue table on top of it. Design it inside Snowflake, and compare streams and tasks with
      dynamic tables.
    `,
    hints: [
      'Changes for the same trip can arrive in one batch, out of order.',
      'Which part is custom logic, and which part is a plain query?',
      'What happens if the pipeline is paused for three weeks?',
    ],
    answer: `
      **Current-state table: stream plus task.**

      ~~~sql
      CREATE STREAM raw.trips_cdc_s ON TABLE raw.trips_cdc APPEND_ONLY = TRUE;

      CREATE TASK analytics.apply_trips
        SCHEDULE = '5 MINUTE'
        WHEN SYSTEM$STREAM_HAS_DATA('raw.trips_cdc_s')
      AS
        MERGE INTO analytics.trips AS t
        USING (
          SELECT * FROM raw.trips_cdc_s
          QUALIFY ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY lsn DESC) = 1
        ) AS s
        ON t.trip_id = s.trip_id
        WHEN MATCHED AND s.lsn > t.lsn AND s.op = 'D' THEN DELETE
        WHEN MATCHED AND s.lsn > t.lsn THEN UPDATE SET
          status = s.status, fare_usd = s.fare_usd, lsn = s.lsn
        WHEN NOT MATCHED AND s.op <> 'D' THEN INSERT (trip_id, status, fare_usd, lsn)
          VALUES (s.trip_id, s.status, s.fare_usd, s.lsn);
      ~~~

      - The append-only stream reads only new CDC rows; the raw table is never updated.
      - Keep the **latest change per trip** in the batch by «lsn», and only apply a change that is
        newer than the stored one. That makes the merge correct with out-of-order data and safe
        to rerun.
      - The task is serverless (no «WAREHOUSE»), and skips empty runs.

      **Daily revenue: a dynamic table** with «TARGET_LAG = '10 minutes'» on top of
      «analytics.trips». It is a plain aggregate, so a declarative refresh fits.

      **Why not one dynamic table for both?** A dynamic table can express "latest row per trip"
      with «QUALIFY», but deletes and the «lsn» guard are clearer in an explicit MERGE, and the
      raw CDC table grows forever, so a full refresh fallback would be expensive.

      **Operations.**

      - Alert on task failures from «TASK_HISTORY».
      - Alert when the stream's «stale_after» time is close. If the task stops for longer than
        the extended retention (14 days by default), the stream goes stale and you must rebuild
        «analytics.trips» from «raw.trips_cdc».
      - Keep the raw CDC table permanent, so the current state can always be rebuilt.
    `,
    signals: [
      'Deduplicates each batch to the latest change per key by sequence number',
      'Guards against applying an older change over a newer one',
      'Uses an append-only stream and a serverless task with a WHEN guard',
      'Uses a dynamic table where the logic is a plain query',
      'Plans for stale streams and a full rebuild from raw',
    ],
    followUps: [
      'The CDC tool sometimes replays the last hour after a restart. Is your design still correct?',
    ],
  },
  {
    slug: 'dbx-autoloader-ingestion',
    title: 'Ingest 2 million JSON files a day on Databricks',
    track: 'snowflake-databricks',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      Mobile app events land in S3 as small gzipped JSON files: about 2 million files and 1.5 TB
      a day. Producers add fields every few weeks. Design the ingestion into a bronze and a silver
      Delta table on Databricks. Analysts need data within 15 minutes.
    `,
    hints: [
      'How does the reader find new files among millions?',
      'What happens to a record when a new field appears, or a field changes type?',
      'Small input files should not become small output files.',
    ],
    answer: `
      **Reader: Auto Loader in file notification mode.** Listing a prefix with millions of files
      every few minutes is slow and costs S3 list calls. File notification mode subscribes to
      bucket events through a queue, and the checkpoint records every file, so each file is read
      exactly once.

      **Bronze: keep everything.**

      - «cloudFiles.schemaLocation» stores the inferred schema;
        «cloudFiles.schemaEvolutionMode = addNewColumns» adds new fields. The stream stops once
        on a new field and picks it up on restart, so run it as a job with retries.
      - Values that do not match the schema (a string in a numeric field) go to
        «_rescued_data», so nothing is lost.
      - Add «_metadata.file_path» and the ingest time to every row.

      **Silver: typed, deduplicated, tested.** A declarative pipeline or a «foreachBatch»
      MERGE on «event_id» with a watermark, and expectations on required fields. Bad rows are
      dropped and counted, or quarantined to a separate table.

      **Freshness and cost.** A trigger every 5 to 10 minutes on jobs compute or serverless
      meets the 15-minute goal. A continuous stream would also work, but costs more for little
      gain here.

      **Files.** Write Delta with optimized writes and auto compaction, or use predictive
      optimization on Unity Catalog managed tables, so 2 million small inputs do not become
      millions of small Delta files. Use liquid clustering on «event_date» and «event_name».

      **Governance.** Store checkpoints and schemas in a Unity Catalog volume, and read S3
      through an external location, not instance keys.
    `,
    signals: [
      'Chooses file notification mode for millions of files',
      'Handles schema evolution and keeps bad values in a rescued column',
      'Deduplicates on an event id in silver, with expectations',
      'Sizes the trigger to the freshness goal and cost',
      'Prevents small files in the Delta output',
    ],
    followUps: [
      'A bug wrote wrong values into silver for two days. How do you reprocess from bronze?',
    ],
  },
  {
    slug: 'dbx-unity-catalog-pii',
    title: 'Govern rider PII with Unity Catalog',
    track: 'snowflake-databricks',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      A company runs 30 Databricks workspaces on the legacy Hive metastore. Rider emails and phone
      numbers sit in many tables. Analysts in each country may see only their country's riders,
      and only the privacy team may see raw PII. Security also found that some clusters read S3
      with an instance profile that can read every bucket. Design the target state on Unity
      Catalog and the migration.
    `,
    hints: [
      'Start with the object model: metastore, catalogs, schemas, and which workspaces see them.',
      'Masks and row filters work only if nobody can go around the catalog.',
      'A migration of 30 workspaces needs an inventory and a period where both systems run.',
    ],
    answer: `
      **Target state.**

      - One Unity Catalog metastore per region, all 30 workspaces attached.
      - Catalogs per environment and domain («prod_rides», «dev_rides»), bound so that dev
        workspaces cannot see prod catalogs.
      - Managed tables by default, so Unity Catalog owns the files and predictive optimization
        maintains them.
      - S3 access only through **storage credentials** and **external locations**. Remove the
        broad instance profiles, so nobody can read the bucket directly and bypass policies.

      **PII controls.**

      - Tag PII columns («pii = email», «pii = phone»). Attach a **column mask** policy to the
        tag, so every tagged column returns a masked value unless the reader is in the
        «privacy» group. New tables get masked on the day they are tagged.
      - A **row filter** on «country_code» that looks up the reader's groups in a mapping table,
        so a Brazil analyst sees only Brazil rows.
      - Grants only to groups synced from the identity provider, never to people.

      **Proof.** «system.access.audit» shows who read PII tables; lineage shows where PII columns
      flow, which catches a copy into an unmasked table.

      **Migration.**

      1. Inventory tables, jobs and grants with the UCX tool.
      2. Create catalogs, external locations and groups.
      3. Upgrade tables: SYNC for external tables; DEEP CLONE or CTAS for managed tables in the
         Hive metastore's DBFS root.
      4. Rewrite code from two-part to three-part names, and move jobs to Unity Catalog-enabled
         compute.
      5. Migrate one domain at a time; keep Hive read-only, then retire it.

      **Risks to name.** Jobs that use RDD APIs or init scripts that the new access modes block;
      tools that read files by path; a period where PII is protected in Unity Catalog but still
      open in Hive.
    `,
    signals: [
      'Designs catalogs by environment and domain with workspace binding',
      'Removes direct bucket access so policies cannot be bypassed',
      'Uses tag-based masks and row filters with group membership',
      'Uses audit and lineage system tables to prove control',
      'Plans an incremental migration with an inventory and named risks',
    ],
    followUps: [
      'A data scientist needs raw emails for one week for a fraud model. How do you grant it?',
    ],
  },
  {
    slug: 'choose-snowflake-or-databricks',
    title: 'Snowflake or Databricks for a new data platform?',
    track: 'snowflake-databricks',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      A 300-person delivery start-up is moving off Postgres replicas. It has 15 analysts who
      write SQL, 4 data scientists building ETA models in Python, Kafka for app events, and
      everything on AWS. The CTO asks you: Snowflake or Databricks? Give a recommendation.
    `,
    hints: [
      'List the workloads first, then the people who will run the platform.',
      'Openness: will more than one engine need the same tables?',
      'A recommendation names what you give up.',
    ],
    answer: `
      **Workloads.** BI and SQL for 15 analysts (the largest group), ML feature pipelines and
      training for 4 data scientists, and streaming app events from Kafka.

      **Recommendation (one reasonable answer).** Start with **Snowflake** as the warehouse
      for analytics, if the team has little platform engineering capacity:

      - Analysts are the biggest group, and Snowflake gives them a low-tuning SQL warehouse with
        good concurrency.
      - Snowpipe Streaming or the Kafka connector lands events within seconds.
      - Data scientists can use Snowpark for feature pipelines, and train where they like.

      **The alternative.** If ML and streaming will dominate, or the team has strong Spark
      skills, choose **Databricks**: Structured Streaming, ML tooling and Unity Catalog on open
      Delta or Iceberg tables, with SQL warehouses for the analysts.

      **Keep the exit open either way.** Land raw events in S3 in an open table format, and keep
      transformations in dbt, which runs on both platforms. Then a second engine can read the
      same tables later without a migration.

      **Day-one cost controls.** Resource monitors and auto-suspend in Snowflake, or cluster
      policies and budgets in Databricks, plus query tags for attribution.

      **What I would check before deciding.** Run the ten most expensive real queries and one
      feature pipeline on both for two weeks, and compare cost, speed and how much tuning each
      needed.
    `,
    signals: [
      'Starts from workloads and team skills, not features',
      'Makes a clear recommendation and names what it gives up',
      'Keeps data in open formats to avoid lock-in',
      'Names day-one cost controls',
      'Proposes a proof of concept on real queries',
    ],
    followUps: [
      'Two years later the ML team wants Databricks while analysts stay on Snowflake. How do you avoid two copies of the data?',
    ],
  },
  {
    slug: 'databricks-resent-files-double-counts',
    title: 'Gold revenue doubled after a partner re-sent files',
    track: 'snowflake-databricks',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      A Databricks pipeline ingests partner order files with Auto Loader into bronze, appends
      bronze to silver with a plain «INSERT INTO silver SELECT * FROM bronze_new», and rebuilds a
      gold revenue table nightly. The partner re-sent last Tuesday's files under new names.
      Tuesday's revenue in gold doubled and finance noticed. Fix today's data and redesign the
      pipeline so this cannot happen again.
    `,
    hints: [
      'What does Auto Loader deduplicate, and what does it not?',
      'Where should the business key be enforced?',
      'How do you repair silver safely?',
    ],
    answer: `
      **Why it happened:** Auto Loader is exactly-once per **file path**. New names are new files,
      so bronze holds the orders twice, which is correct for bronze. The bug is in silver: an
      append has no business key, so the duplicates flowed into gold.

      **Fix today's data:**

      1. Pause the job. Note the current silver table version («DESCRIBE HISTORY»).
      2. Rebuild silver for the affected dates from bronze, keeping one row per «order_id» (the
         latest by «updated_at», then «_ingested_at»), and replace those dates with
         «INSERT OVERWRITE ... REPLACE WHERE order_date BETWEEN ...» or a «MERGE».
      3. Rebuild gold for those dates, compare totals with the partner's control file, and tell
         finance which numbers changed.

      **Redesign:**

      - Silver becomes an **idempotent MERGE** (or AUTO CDC in a declarative pipeline) on
        «order_id», sequenced by «updated_at». Replays and re-sends change nothing.
      - Add a **uniqueness test** on silver's key and a **reconciliation** check of daily totals
        against the partner's control totals, which blocks the gold publish on failure.
      - Optionally detect re-sent files early by a content hash in bronze, to alert the partner.
    `,
    signals: [
      'Explains that Auto Loader deduplicates files, not records',
      'Moves deduplication to silver on the business key',
      'Repairs only the affected dates with a recorded table version',
      'Adds uniqueness and reconciliation checks that block publishing',
      'Communicates the corrected numbers to finance',
    ],
    followUps: [
      'The partner sometimes sends a corrected file for the same orders. How does your MERGE handle it?',
    ],
  },
];
