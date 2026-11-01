import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'lakehouse',
  title: 'Storage, lakehouse and BigQuery',
  summary:
    'File formats, table formats, layout, compaction and warehouse cost, explained from the bytes up.',
  tone: 'peach',
  why: 'Uber created Apache Hudi to make its lake incremental, and Google interviewers expect you to know how BigQuery stores and prices data. Storage choices decide the cost and speed of everything above them.',
  lessons: [
    {
      slug: 'file-formats',
      title: 'Columnar files from the inside',
      summary: 'Explain how Parquet stores data and why that makes analytic scans cheap.',
      minutes: 14,
      body: `
        Analytic queries read a few columns from many rows. A **row format** (CSV, JSON, Avro)
        stores each record together, so reading two columns still reads every byte. A **columnar
        format** (Parquet, ORC) stores each column together, so a query reads only the columns it
        names. That is the first and largest saving.

        ## Parquet's layout

        - A file holds one or more **row groups** (typically 128 MB to 1 GB of rows).
        - Inside a row group, each column is a **column chunk**, split into **pages**.
        - The **footer** holds the schema plus statistics for each column chunk: min, max and null count.
        - Readers fetch the footer first, then skip whole row groups whose stats cannot match the filter.

        | Technique | What it skips | Needs |
        |---|---|---|
        | Projection pruning | Columns the query does not name | Columnar layout |
        | Predicate pushdown | Row groups whose min/max cannot match | Data sorted or clustered on the filter column |
        | Partition pruning | Whole files or folders | A partition column in the filter |
        | Bloom filters | Row groups that cannot hold a value | Bloom filter written for that column |

        ## Encodings and compression

        Values in one column look alike, so they compress well. **Dictionary encoding** replaces
        repeated strings (city names, status codes) with small integers. **Run-length encoding**
        stores "the next 4,000 values are 'completed'" once. A general codec (Snappy for speed,
        ZSTD for a better ratio) runs on top.

        > [!trap] Min/max stats only help sorted data
        > If «city_id» is spread randomly across every row group, every row group's range covers
        > almost every city, and pushdown skips nothing. Sorting or clustering on the filter column
        > is what makes the stats useful.

        ## Where row formats still win

        Avro carries its schema with the data and handles schema evolution well, which is why it
        is common on Kafka. Writing one record at a time is cheap in a row format and awkward in a
        columnar one. A common pattern: Avro or Protobuf on the wire, Parquet at rest.

        > [!senior] Tie the format to the access pattern
        > Say which queries read the data, how often, and on which columns. "Parquet because it is
        > columnar" is a mid-level answer. "Parquet sorted by event time, because every dashboard
        > filters the last seven days, so the stats skip most row groups" is a senior one.
      `,
      checks: [
        {
          question:
            'A query filters on driver_id, but the files are written in arrival order. Why does predicate pushdown barely help?',
          options: [
            'Parquet does not store statistics for integer columns',
            'Every row group holds a wide range of driver ids, so no row group can be skipped',
            'Predicate pushdown only works with CSV files',
            'The query must name driver_id in the SELECT list',
          ],
          answer: 1,
          why: 'Min/max stats skip a row group only when its range excludes the value. Unsorted data gives every row group a near-full range.',
        },
        {
          question: 'Why do columnar files compress better than row files?',
          options: [
            'They always use a stronger codec',
            'They drop null values',
            'Values in one column are similar, so dictionary and run-length encoding work well',
            'They store fewer rows',
          ],
          answer: 2,
          why: 'Similar values next to each other is exactly what dictionary and run-length encoding exploit.',
        },
      ],
    },
    {
      slug: 'table-formats',
      title: 'Table formats: Iceberg, Delta and Hudi',
      summary:
        'Explain how a table format adds transactions, snapshots and time travel on object storage.',
      minutes: 16,
      body: `
        A folder of Parquet files is not a table. Two writers can collide, a reader can see half a
        write, and nobody knows which files make up "the table right now". A **table format** adds
        a metadata layer that answers that question atomically.

        ## The shared idea

        Every table format keeps a log or tree of metadata that lists exactly which data files form
        each **snapshot**. A commit writes new data files first, then publishes new metadata in one
        atomic step. Readers use the latest published snapshot and never see a partial write.

        | Format | Where the commit lives | Known for |
        |---|---|---|
        | Apache Iceberg | A catalog pointer to a metadata file, which points to manifest lists and manifests | Hidden partitioning, partition evolution, wide engine support |
        | Delta Lake | Numbered JSON commits in «_delta_log», with periodic Parquet checkpoints | Tight Spark integration, deletion vectors |
        | Apache Hudi | A timeline of actions in «.hoodie» | Record-level upserts and incremental pulls, built at Uber |

        ## Copy-on-write and merge-on-read

        An update or delete must change rows that already live in immutable files. There are two ways.

        - **Copy-on-write (CoW):** rewrite every file that holds a changed row. Reads stay fast;
          writes are expensive when changes are spread out.
        - **Merge-on-read (MoR):** write the change separately (a delete file, a deletion vector or a
          log file) and merge it at read time. Writes are cheap; reads slow down until compaction
          folds the changes back in.

        > [!example] Choosing between them
        > A daily batch that rewrites a few partitions: copy-on-write. A stream of CDC upserts from
        > an operational database every minute: merge-on-read, with compaction on a schedule.

        ## Concurrency

        Writers use optimistic concurrency. Each writer reads snapshot N, does its work, and tries
        to commit N+1. If another writer committed first, the format checks whether the two changes
        conflict. Non-overlapping appends usually retry cleanly; two updates to the same files fail
        and must be redone.

        ## Time travel

        Old snapshots stay readable until you expire them, so you can query the table "as of"
        yesterday, or roll back a bad write by pointing the table at an earlier snapshot.

        > [!trap] Time travel is not a backup
        > Snapshot expiry and file cleanup delete old data on a schedule (Delta's «VACUUM» keeps
        > 7 days by default). Once files are gone, so is the history. Keep real backups for data
        > you must restore after weeks.
      `,
      checks: [
        {
          question: 'What makes a commit atomic in a table format on object storage?',
          options: [
            'Object storage supports multi-file transactions',
            'Data files are written first, then one atomic metadata update publishes the new snapshot',
            'Readers lock the table while a writer runs',
            'Each row is written in its own file',
          ],
          answer: 1,
          why: 'Data files are invisible until the metadata that lists them is published in a single atomic step.',
        },
        {
          question: 'A CDC feed upserts rows every minute. Which write mode fits best?',
          options: [
            'Copy-on-write, so reads stay fast',
            'Merge-on-read, with scheduled compaction',
            'Full table overwrite every minute',
            'Append only, and dedupe in every query',
          ],
          answer: 1,
          why: 'Frequent small updates make copy-on-write rewrite many files. Merge-on-read keeps writes cheap and compaction restores read speed.',
        },
      ],
    },
    {
      slug: 'layout-and-maintenance',
      title: 'Layout, small files and compaction',
      summary: 'Choose a partition scheme and keep a lakehouse table healthy over time.',
      minutes: 14,
      body: `
        A table's physical layout decides how much data every query reads. Get it right once and
        maintain it, or the table slowly gets slower and more expensive.

        ## Partitioning

        Partition on a column that almost every query filters on and that has modest cardinality.
        Event date is the classic choice.

        | Partition column | Verdict |
        |---|---|
        | «event_date» | Good: most queries filter by date, about 365 partitions a year |
        | «event_hour» | Good only for very large tables queried by hour |
        | «user_id» | Bad: millions of tiny partitions, and most queries do not filter on it |
        | «country» plus «event_date» | Fine if many queries filter by country, but watch skew from big countries |

        Iceberg's **hidden partitioning** stores a transform such as «day(event_ts)», so queries
        filter on «event_ts» and still prune. You can also change the partition scheme later
        (partition evolution) without rewriting old data.

        ## The small files problem

        Streaming and frequent micro-batches write many small files. Every file costs a metadata
        entry, an open call and a footer read. Ten thousand 1 MB files are far slower to scan than
        ten 1 GB files holding the same data.

        - **Compaction** rewrites small files into larger ones (Iceberg «rewrite_data_files»,
          Delta «OPTIMIZE», Hudi compaction and clustering).
        - **Clustering** (sorting or Z-ordering inside the rewrite) puts similar values together
          so file and row-group stats skip more.
        - Target file sizes of roughly 256 MB to 1 GB for analytic tables.

        ## Housekeeping

        - **Expire snapshots** so metadata stays small and old files can be deleted.
        - **Remove orphan files** left by failed writes.
        - **Rewrite manifests** when planning a query becomes slow because of many manifests.

        > [!senior] Make maintenance part of the design
        > When you design a streaming sink into a lake, name the compaction job, its schedule, and
        > who owns it. An answer that writes files every 30 seconds and stops there will be asked
        > "what does this table look like after a month?"
      `,
      checks: [
        {
          question: 'Why is partitioning a clickstream table by user_id usually a mistake?',
          options: [
            'user_id is not a string',
            'It creates millions of tiny partitions and most queries do not filter on it',
            'Table formats do not allow integer partition columns',
            'It prevents compaction',
          ],
          answer: 1,
          why: 'High cardinality explodes the partition count and file count, and pruning only helps if queries filter on the column.',
        },
        {
          question: 'What does clustering add on top of plain compaction?',
          options: [
            'It deletes old snapshots',
            'It sorts data so similar values share files, which makes min/max skipping effective',
            'It converts Parquet to Avro',
            'It adds more partitions',
          ],
          answer: 1,
          why: 'Compaction fixes file size. Clustering also orders the data, so statistics can skip files and row groups.',
        },
      ],
    },
    {
      slug: 'bigquery',
      title: 'BigQuery: storage, slots and cost',
      summary: 'Explain how BigQuery runs a query and design tables that scan less.',
      minutes: 15,
      body: `
        BigQuery separates storage from compute. Tables live in a columnar format (Capacitor) on
        Google's distributed file system (Colossus). Queries run on **slots**, units of compute
        that a scheduler hands out. A shuffle tier between stages lets thousands of workers
        exchange data. Because storage and compute scale separately, the bill has two parts.

        ## How you pay

        - **On-demand:** pay per byte scanned (list price is about $6.25 per TiB in the US, with
          the first 1 TiB each month free). Every column you read counts, even if the result is small.
        - **Capacity (editions):** pay for slots over time, with autoscaling. Cost then depends on
          how long queries hold slots, not on bytes.
        - **Storage:** active storage, and cheaper long-term storage for partitions untouched for
          90 days.

        > [!trap] LIMIT does not cut the scan
        > «SELECT * FROM events LIMIT 10» on a non-clustered table still reads every column of every
        > row in scope. Name the columns and filter on the partition column instead.

        ## Partitioning and clustering

        - **Partitioning** splits a table by a date, timestamp or integer-range column (or by
          ingestion time). A filter on that column prunes partitions before the scan, and the dry
          run shows the reduced byte count.
        - **Clustering** sorts data inside partitions by up to four columns. Filters on those
          columns skip blocks. The dry-run estimate is an upper bound; the real scan is often smaller.
        - Set «require_partition_filter» on large tables so nobody scans all history by accident.

        ~~~sql
        CREATE TABLE analytics.trip_events
        (
          event_ts TIMESTAMP,
          city_id INT64,
          trip_id STRING,
          event_type STRING,
          fare_usd NUMERIC
        )
        PARTITION BY DATE(event_ts)
        CLUSTER BY city_id, event_type
        OPTIONS (require_partition_filter = TRUE);
        ~~~

        ## Other levers

        - **Materialized views** keep an aggregate up to date incrementally, and the optimizer can
          rewrite matching queries to use them.
        - **BI Engine** caches hot data in memory for dashboards.
        - **Search indexes** speed up point lookups on text columns.
        - **BigLake and external tables** let BigQuery read Iceberg or Parquet in Cloud Storage.

        > [!senior] Answer cost questions with numbers
        > "This dashboard query scans 3 TiB, runs 200 times a day, so it costs about 600 TiB a
        > day on demand. Partitioning to the last 7 days and clustering on «city_id» cuts each run
        > to roughly 60 GiB." Interviewers remember the candidate who did the arithmetic.
      `,
      checks: [
        {
          question:
            'On on-demand pricing, which change cuts the cost of a dashboard query the most?',
          options: [
            'Adding LIMIT 100',
            'Reading only the needed columns and filtering on the partition column',
            'Running it at night',
            'Ordering the result',
          ],
          answer: 1,
          why: 'On-demand cost follows bytes scanned. Fewer columns and pruned partitions both cut bytes; LIMIT does not.',
        },
        {
          question: 'How many clustering columns can a BigQuery table have?',
          options: ['One', 'Up to four', 'Up to sixteen', 'Unlimited'],
          answer: 1,
          why: 'BigQuery allows up to four clustering columns, and their order matters: the first column gives the most pruning.',
        },
      ],
    },
    {
      slug: 'incremental-processing',
      title: 'Incremental processing and upserts',
      summary: 'Move from daily full rebuilds to incremental merges without losing correctness.',
      minutes: 14,
      body: `
        A daily job that rebuilds a 50 TB table to apply 0.1% of changes wastes almost all of its
        compute. **Incremental processing** reads only what changed and merges it into the target.
        It is how Uber cut lake latency from a day to minutes, and it is a frequent design topic.

        ## The MERGE pattern

        Upserts take a batch of changes, keep the latest version of each key, and merge it.

        ~~~sql
        MERGE INTO lake.trips AS t
        USING (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              *,
              ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY updated_at DESC) AS rn
            FROM staging.trip_changes
          )
          WHERE rn = 1
        ) AS s
        ON t.trip_id = s.trip_id
        WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET
          status = s.status, fare_usd = s.fare_usd, updated_at = s.updated_at
        WHEN NOT MATCHED THEN INSERT ROW;
        ~~~

        Three details make this correct:

        - **Dedupe the source first.** Two changes for one key in a batch make MERGE fail or pick one arbitrarily.
        - **Guard on version.** «s.updated_at > t.updated_at» stops a late, older change from overwriting a newer row.
        - **Handle deletes.** CDC streams carry delete events; map them to «WHEN MATCHED AND s.op = 'd' THEN DELETE».

        ## Reading changes

        - **Change data capture (CDC)** from database logs (Debezium on MySQL binlog or Postgres WAL)
          gives every insert, update and delete in order.
        - **Incremental reads** from a table format return only rows changed since a snapshot:
          Hudi incremental queries, Delta change data feed, Iceberg incremental scans.
        - **Watermark columns** («updated_at > last_run») are the simplest option, but miss hard
          deletes and rows whose clock was wrong.

        > [!trap] Merge cost hides in the join
        > MERGE must find matching rows. If the target is not partitioned or clustered so the
        > changed keys land in a few files, every merge rewrites most of the table. Partition so
        > changes cluster, for example by trip date, and add the partition to the ON condition.

        > [!senior] Keep a full rebuild path
        > Incremental pipelines drift: a missed delete, a bug in one batch. Keep a tested way to
        > rebuild the table from source and reconcile counts on a schedule.
      `,
      checks: [
        {
          question: 'Why add "s.updated_at > t.updated_at" to the MATCHED branch?',
          options: [
            'It makes the MERGE run faster',
            'It stops a late, older change from overwriting a newer row',
            'BigQuery requires a condition on every branch',
            'It removes duplicates in the source',
          ],
          answer: 1,
          why: 'Changes can arrive out of order. The version guard keeps the newest state.',
        },
        {
          question: 'What does a simple updated_at watermark miss?',
          options: [
            'Inserts',
            'Hard deletes in the source table',
            'Updates to string columns',
            'Rows in the current day',
          ],
          answer: 1,
          why: 'A deleted row has no row to carry a new updated_at. Log-based CDC captures deletes.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'lakehouse-partition-choice',
    title: 'Pick partition columns for a clickstream table',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'google'],
    prompt: `
      A clickstream table gets 5 billion events a day. Analysts usually query the last 1 to 30
      days, often for one app platform (iOS, Android, web), and sometimes look up one user.
      An engineer proposes partitioning by «user_id». What do you propose instead, and why?
    `,
    hints: [
      'Which filter appears in almost every query?',
      'How many partitions would user_id create?',
      'Partitioning and clustering solve different problems.',
    ],
    answer: `
      Partition by **event date** and cluster (or sort) by **platform** and then **user_id**.

      - Every query filters on a date range, so date partitions prune most data. About 365
        partitions a year is easy for any engine to manage.
      - «user_id» has hundreds of millions of values. As a partition column it creates a huge
        number of tiny files and directories, and the common date-range query cannot prune on it.
      - Platform has three values, too few to be worth a partition level, but a good first
        clustering key. User lookups then benefit from sorting by «user_id» within each date.

      On BigQuery: «PARTITION BY DATE(event_ts) CLUSTER BY platform, user_id» with
      «require_partition_filter». On Iceberg: «day(event_ts)» hidden partitioning and a sort order.
    `,
    signals: [
      'Starts from the query patterns, not the column list',
      'Explains the cost of high-cardinality partitions',
      'Separates partitioning (prune) from clustering (skip within)',
      'Names a guardrail such as require_partition_filter',
    ],
    followUps: [
      'Volume grows to 50 billion a day. Would you add an hour level?',
      'How would you serve the single-user lookup in under a second?',
    ],
  },
  {
    slug: 'bigquery-cost-spike',
    title: 'Cut a BigQuery bill that tripled',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google'],
    prompt: `
      Your team's on-demand BigQuery bill tripled in a month. Most of the spend is one dashboard
      that refreshes every 15 minutes and queries a 400 TiB unpartitioned events table with
      «SELECT * ... WHERE DATE(event_ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) LIMIT 1000».
      Walk through how you find the cause and fix it.
    `,
    hints: [
      'Where do you see bytes billed per query?',
      'What does the WHERE clause prune on an unpartitioned table?',
      'Think about how many times a day the query runs.',
    ],
    answer: `
      **Find it.** Query «INFORMATION_SCHEMA.JOBS» for the last 30 days, grouped by query hash or
      user, ordered by «total_bytes_billed». The dashboard query stands out: about 96 refreshes a
      day, each scanning the whole table.

      **Why it is expensive.** The table is unpartitioned, so the date filter prunes nothing.
      «SELECT *» reads every column. «LIMIT» does not reduce bytes scanned.

      **Fix, in order of impact:**

      - Partition by «DATE(event_ts)» and cluster by the dashboard's filter columns. A 7-day
        window then scans 7 partitions instead of all history.
      - Select only the columns the dashboard shows.
      - Pre-aggregate: a materialized view or a scheduled rollup table at the dashboard's grain,
        so each refresh reads megabytes.
      - Set «require_partition_filter» and a per-user or per-project maximum bytes billed quota.
      - Ask whether the dashboard needs 15-minute freshness at all.

      **Rough numbers.** If the table holds 2 years and the dashboard needs 4 of 60 columns, the
      7-day partitioned, projected scan is about (7 / 730) x (4 / 60) of the original, a cut of
      over 99%.
    `,
    signals: [
      'Uses INFORMATION_SCHEMA.JOBS to find the spend, not guesses',
      'Knows LIMIT does not reduce bytes scanned',
      'Fixes the table layout and the query, then adds guardrails',
      'Does the cost arithmetic',
      'Questions the freshness requirement',
    ],
    followUps: [
      'Would moving to capacity pricing fix this? When does it make sense?',
      'How do you stop the next team from repeating this?',
    ],
  },
  {
    slug: 'streaming-small-files',
    title: 'Fix a streaming sink that writes tiny files',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      A Spark Structured Streaming job writes trip events to an Iceberg table every 30 seconds
      across 200 partitions of «city_id». After three months, queries that took 20 seconds take
      6 minutes, and planning alone takes a minute. Explain what happened and how you fix it
      without stopping ingestion.
    `,
    hints: [
      'How many files does one trigger create?',
      'Where does query planning spend its time?',
      'Compaction and ingestion can run at the same time in a table format.',
    ],
    answer: `
      **Cause.** Each 30-second trigger writes up to one file per partition per task. That is
      thousands of small files per hour and millions after three months. Every file adds a
      manifest entry and a footer read, so planning and scanning slow down. Thousands of
      snapshots also bloat metadata.

      **Fix without stopping ingestion:**

      - Run compaction (Iceberg «rewrite_data_files») on a schedule, for example hourly on the
        partitions written in the last few hours, with a target file size near 512 MB. Iceberg's
        optimistic concurrency lets it commit alongside the streaming appends.
      - Sort or cluster during the rewrite on the main filter column (event time).
      - Expire old snapshots and remove orphan files daily.
      - Rewrite manifests so planning reads a few large manifests instead of many small ones.

      **Prevent it:**

      - Partition by event date (and maybe hour) instead of «city_id», which is skewed and multiplies files.
      - Lengthen the trigger interval if the freshness target allows it.
      - Repartition by the table's partition columns before writing, so each task writes to few partitions.
    `,
    signals: [
      'Explains why small files slow planning, not only scanning',
      'Compacts without stopping the stream and knows why that is safe',
      'Adds snapshot expiry and manifest rewrite',
      'Revisits the partition scheme as the root cause',
    ],
    followUps: [
      'Compaction commits keep failing because of conflicts with the stream. What do you change?',
      'How would this answer differ on Hudi merge-on-read?',
    ],
  },
  {
    slug: 'choose-table-format',
    title: 'Choose a table format for a new lake',
    track: 'lakehouse',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      Your company is moving a Hive-style Parquet lake to a table format. Workloads: daily Spark
      batch jobs, a CDC feed from 300 MySQL tables that must land within 15 minutes, Trino for
      analysts, and a plan to query some tables from BigQuery. Which format do you pick and how
      do you justify it?
    `,
    hints: [
      'List the engines that must read and write.',
      'Which workload is hardest: batch, CDC upserts or multi-engine reads?',
      'Is one format required for every table?',
    ],
    answer: `
      Start from requirements, then compare.

      | Need | Iceberg | Delta | Hudi |
      |---|---|---|---|
      | Spark batch | Strong | Strong | Strong |
      | Frequent CDC upserts | Good (merge-on-read, equality deletes) | Good (deletion vectors) | Strongest (record index, MoR) |
      | Trino reads | Strong | Good | Good |
      | BigQuery reads | Strong (BigLake Iceberg tables) | Possible via UniForm or manifests | Limited |
      | Partition evolution | Native | Limited | Limited |

      **A defensible pick: Iceberg** as the default, because multi-engine reads (Trino and
      BigQuery) and partition evolution are hard to add later, and its merge-on-read support
      handles a 15-minute CDC target. Run compaction on CDC tables on a schedule.

      **When to choose differently:** if CDC upserts dominate and latency must be a few
      minutes, Hudi's record-level index is built for that (it is why Uber built it). If the
      whole company runs on Databricks, Delta is the path of least friction.

      Name the migration: convert tables in place where possible (metadata-only migration of
      existing Parquet files), dual-run for a week, compare counts and checksums, then switch readers.
    `,
    signals: [
      'Derives the choice from engines and workloads',
      'Is honest that all three formats are capable',
      'Names when another format would win',
      'Plans the migration and validation, not only the pick',
    ],
    followUps: [
      'How do you keep the catalog consistent across Spark, Trino and BigQuery?',
      'What would make you regret this choice in two years?',
    ],
  },
  {
    slug: 'roll-back-bad-write',
    title: 'Recover a table after a bad overwrite',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber'],
    prompt: `
      At 09:00 a buggy job overwrote yesterday's partition of a Delta table with an empty result.
      Three downstream jobs have already read it. It is now 10:30. What do you do?
    `,
    hints: ['What does the transaction log still hold?', 'Fixing the table is half the job.'],
    answer: `
      **Stop the spread.** Pause the buggy job and the downstream jobs that have not run yet.

      **Restore.** Find the last good version with «DESCRIBE HISTORY», check it with a time
      travel query («SELECT COUNT(*) FROM t VERSION AS OF 41»), then «RESTORE TABLE t TO
      VERSION AS OF 41». The restore is a new commit, so it is itself auditable and reversible.
      This works only while the old files exist, inside the «VACUUM» retention window.

      **Repair downstream.** Re-run the three downstream jobs for that date. This is safe only if
      they are idempotent (overwrite their partition rather than append).

      **Prevent it.** Add a data check before publish (row count against yesterday, a minimum
      threshold) that fails the job instead of writing an empty partition, and alert the owner.
    `,
    signals: [
      'Contains the blast radius first',
      'Uses table history and verifies before restoring',
      'Knows restore depends on retention',
      'Re-runs downstream jobs and relies on idempotency',
      'Adds a pre-publish check',
    ],
    followUps: ['How would you do the same on Iceberg?', 'What if VACUUM ran at 10:00?'],
  },
  {
    slug: 'cdc-merge-latest',
    title: 'Write a MERGE that applies CDC changes',
    track: 'lakehouse',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['google', 'uber'],
    prompt: `
      «staging.driver_changes(driver_id, name, city_id, op, changed_at)» holds a batch of CDC
      events where «op» is 'c', 'u' or 'd'. A driver can appear several times in one batch.
      Write a MERGE into «core.drivers(driver_id, name, city_id, changed_at)» that keeps only the
      newest state of each driver, applies deletes, and never lets an older event overwrite a newer row.
    `,
    hints: [
      'Reduce the batch to one row per driver first.',
      'Each WHEN branch can have an extra condition.',
      'Compare changed_at on both sides.',
    ],
    answer: `
      ~~~sql
      MERGE INTO core.drivers AS t
      USING (
        SELECT driver_id, name, city_id, op, changed_at
        FROM staging.driver_changes
        QUALIFY ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY changed_at DESC) = 1
      ) AS s
      ON t.driver_id = s.driver_id
      WHEN MATCHED AND s.op = 'd' AND s.changed_at >= t.changed_at THEN
        DELETE
      WHEN MATCHED AND s.op IN ('c', 'u') AND s.changed_at > t.changed_at THEN
        UPDATE SET name = s.name, city_id = s.city_id, changed_at = s.changed_at
      WHEN NOT MATCHED AND s.op IN ('c', 'u') THEN
        INSERT (driver_id, name, city_id, changed_at)
        VALUES (s.driver_id, s.name, s.city_id, s.changed_at);
      ~~~

      - «QUALIFY» keeps the newest event per driver, so the source has one row per key and MERGE
        cannot hit "multiple source rows matched".
      - The «changed_at» guards make replays and out-of-order batches safe: running the same
        batch twice changes nothing.
      - A delete for an unknown driver is ignored rather than inserted.

      If two events can share the same «changed_at», add a tiebreaker such as the log sequence
      number to the ORDER BY.
    `,
    signals: [
      'Dedupes the source before merging',
      'Guards every branch on event order',
      'Handles deletes and ignores deletes for unknown keys',
      'Points out the tie on equal timestamps',
    ],
    followUps: [
      'Deleted drivers must stay queryable for audits. How do you change the model?',
      'The target is 2 TB and each batch touches 0.01%. How do you keep MERGE cheap?',
    ],
  },
];
