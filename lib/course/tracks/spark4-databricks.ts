import type { Lesson } from '@/types/course';

/**
 * Two lessons on what changed recently: Spark 4 for the Spark track, and
 * Databricks tables (managed or external, deletion vectors, change data feed,
 * predictive optimization) for the Snowflake and Databricks track. They join
 * their tracks in `spark.ts` and `snowflake-databricks.ts`.
 */

export const spark4Lessons: readonly Lesson[] = [
  {
    slug: 'spark-4-changes',
    title: 'What changed in Spark 4',
    summary:
      'ANSI mode on by default, try_ functions, the VARIANT type, Spark Connect and pipe syntax: what breaks in an upgrade and what to say about it.',
    minutes: 14,
    body: `
      ## Start with the problem

      Your team upgrades a job from Spark 3.5 to Spark 4.0. Nothing in the code changed. The first
      run fails with «[CAST_INVALID_INPUT] The value 'N/A' of the type "STRING" cannot be cast to
      "INT"». On Spark 3.5 the same row became NULL and nobody noticed.

      The job was always wrong: it hid bad data as NULL. Spark 4 stops hiding it. Interviewers ask
      about Spark 4 to see if you follow the platform, and the ANSI change is the part that breaks
      real jobs.

      ## Idea 1: ANSI mode is on by default

      Spark 4.0 sets «spark.sql.ansi.enabled» to true. SQL and DataFrame code now follow the SQL
      standard for errors:

      | Expression | Spark 3.5 default | Spark 4.0 default |
      |---|---|---|
      | «CAST('N/A' AS INT)» | NULL | Error |
      | «1 / 0» | NULL | Error |
      | An INT sum that overflows | Wraps to a negative number | Error |

      An error is better than a wrong number, but a pipeline that fails at 03:00 is also a problem.
      Fix each place on purpose:

      ~~~sql
      SELECT try_cast(raw_fare AS DECIMAL(10, 2)) AS fare,   -- NULL when it does not parse
             try_divide(revenue, trips) AS revenue_per_trip  -- NULL when trips = 0
      FROM raw_trips;
      ~~~

      The «try_» functions («try_cast», «try_divide», «try_add», «try_to_timestamp»,
      «try_element_at» and others) return NULL instead of an error. Use them where bad input is
      expected, and count the NULLs they produce, so the bad rows are visible.

      > [!trap] Turning ANSI off is not a fix
      > «spark.sql.ansi.enabled=false» brings back the old behaviour for the whole job. It also
      > brings back the silent NULLs and the wrapped sums. Use it only as a short step in a
      > migration, with a date to remove it.

      ## Idea 2: VARIANT for semi-structured data

      Before Spark 4, JSON lived in a STRING column. Every query parsed the whole string again, and
      a schema change meant a new struct type.

      Spark 4.0 adds the **VARIANT** type. «parse_json» stores the JSON once in a binary format, and
      reads take only the field they need:

      ~~~sql
      CREATE TABLE events (event_id BIGINT, payload VARIANT);

      INSERT INTO events SELECT event_id, parse_json(raw) FROM raw_events;

      SELECT variant_get(payload, '$.rider.city', 'string') AS city,
             try_variant_get(payload, '$.fare', 'decimal(10,2)') AS fare
      FROM events;
      ~~~

      VARIANT is the middle ground. It is faster than a JSON string and more flexible than a
      struct. Promote a field to its own column when most queries filter on it, because a
      column gets statistics and data skipping.

      ## Idea 3: Spark Connect, the client and the server are separate

      Classic PySpark runs the driver inside your Python process. **Spark Connect** puts a thin
      client in your process and sends logical plans to a Spark server over gRPC.

      ~~~python
      from pyspark.sql import SparkSession

      spark = SparkSession.builder.remote("sc://spark-server:15002").getOrCreate()
      spark.table("trips").groupBy("city").count().show()
      ~~~

      What this gives you:

      - A small client. Spark 4.0 ships a Python package with only the Connect client.
      - Many users share one server, and a crash in a notebook does not kill the driver.
      - You can upgrade the server and the client at different times.

      What it takes away: the RDD API and «SparkContext» are not available through Connect. Code
      that calls «df.rdd» or «sc.parallelize» must move to the DataFrame API first. Databricks
      serverless compute and shared clusters work this way, so the same rule applies there.

      ## Idea 4: smaller changes worth naming

      - **SQL pipe syntax.** «FROM trips |> WHERE status = 'done' |> AGGREGATE COUNT(*) GROUP BY
        city». Each step reads top to bottom, like a DataFrame chain.
      - **Collations.** «COLLATE UTF8_LCASE» compares strings without case, without «LOWER()» on
        both sides.
      - **Python data sources.** You can write a reader for a custom source in Python.
      - **Platform.** Java 17 is the default, Scala 2.13 is the only Scala version, and Python 3.9 is
        the minimum.
      - **Spark 4.1** adds Spark Declarative Pipelines: the declarative model of Lakeflow
        Declarative Pipelines, as part of open source Spark.

      ## Now say it like a senior engineer

      > [!senior] An upgrade plan, not a version number
      > "For Spark 4, ANSI mode is the main risk. I run the jobs on 4.0 against a copy of last
      > week's data and compare outputs. Every new error is either bad input, which gets a «try_»
      > function and a NULL count, or a bug that ANSI found. I also search for «.rdd» and
      > «SparkContext», because they stop working on Spark Connect and on serverless."

      ## In one breath

      Spark 4 turns on ANSI mode, so bad casts, division by zero and overflow are errors, and the
      «try_» functions are the deliberate way back to NULL. It adds VARIANT for JSON and makes Spark
      Connect, where the RDD API is not available, the normal way to connect.
    `,
    checks: [
      {
        question: "On Spark 4.0 with default settings, what does CAST('abc' AS INT) do?",
        options: [
          'Returns NULL',
          'Returns 0',
          'Fails with an error',
          'Returns the string unchanged',
        ],
        answer: 2,
        why: 'ANSI mode is on by default in Spark 4.0, so an invalid cast is an error. try_cast returns NULL instead.',
      },
      {
        question: 'A notebook on Spark Connect calls df.rdd.map(...). What happens?',
        options: [
          'It runs, but more slowly',
          'It fails, because the RDD API is not available through Spark Connect',
          'Spark converts it to a DataFrame plan',
          'It runs on the client only',
        ],
        answer: 1,
        why: 'Spark Connect sends DataFrame and SQL plans to the server. The RDD API and SparkContext are not part of it.',
      },
    ],
  },
];

export const databricksTableLessons: readonly Lesson[] = [
  {
    slug: 'databricks-tables',
    title: 'Databricks tables: managed, external and what Delta does underneath',
    summary:
      'Choose managed or external tables in Unity Catalog, and know what deletion vectors, change data feed and predictive optimization change.',
    minutes: 14,
    body: `
      ## Start with the problem

      An engineer cleans up old tables with «DROP TABLE bronze.clicks_2023». Two teams then report
      different things. Team A says the files are still in the bucket and the storage bill did not
      change. Team B says their table is gone, files and all.

      Both are right. Team A's table was **external**. Team B's table was **managed**. The same
      command does different things, and the interviewer wants to know that you know which one
      you made.

      ## Idea 1: managed or external

      | | Managed table | External table |
      |---|---|---|
      | Where the files live | The managed storage that Unity Catalog chooses for the catalog or schema | A path you name, in an external location |
      | «DROP TABLE» | Removes the table and, after a retention period, the files | Removes only the table definition. The files stay |
      | Recover a drop | «UNDROP TABLE» within 7 days | Create the table again on the same path |
      | Automatic maintenance | Predictive optimization can run «OPTIMIZE», «VACUUM» and «ANALYZE» | You schedule maintenance yourself |
      | Other engines write the files | No: all writes go through Unity Catalog | Possible, and risky |

      ~~~sql
      -- Managed: Unity Catalog chooses the location.
      CREATE TABLE main.silver.trips (trip_id BIGINT, city STRING, fare DECIMAL(10, 2));

      -- External: you choose the path, inside an external location you have rights on.
      CREATE TABLE main.bronze.clicks (click_id BIGINT, ts TIMESTAMP)
      LOCATION 's3://acme-raw/clicks/';
      ~~~

      **Default to managed.** Use external when files must outlive the table, or when another
      system writes or owns the path, such as a landing zone that a vendor fills.

      ## Idea 2: deletion vectors, cheap updates

      A Delta file is immutable. Before deletion vectors, a «DELETE» of one row rewrote the whole
      file that held it. A GDPR delete of a thousand users touched a thousand files.

      With **deletion vectors**, Delta writes a small file that marks the deleted rows, and readers
      skip them. «UPDATE» and «MERGE» use the same mechanism: mark the old row, write the new one. The
      files are rewritten later, when «OPTIMIZE» or a «REORG TABLE ... APPLY (PURGE)» runs.

      > [!trap] A delete is not gone until the purge
      > With deletion vectors, the deleted rows stay in the old data file until it is rewritten, and
      > in older versions until «VACUUM» removes those files. For an erasure request, run the purge
      > and the vacuum, and record when the data was really removed.

      ## Idea 3: change data feed

      Downstream jobs often need "what changed since my last run". Turn on the **change data feed**,
      and Delta records the row changes of each commit:

      ~~~sql
      ALTER TABLE main.silver.trips SET TBLPROPERTIES (delta.enableChangeDataFeed = true);

      SELECT trip_id, fare, _change_type, _commit_version
      FROM table_changes('main.silver.trips', 1520)
      WHERE _change_type IN ('insert', 'update_postimage', 'delete');
      ~~~

      Each consumer stores the last version it read. This is cheaper than comparing full snapshots,
      and it carries deletes, which a filter on «updated_at» never sees.

      ## Idea 4: time travel has a limit

      «SELECT * FROM trips VERSION AS OF 1520» reads an old version. It works only while the old
      files exist. «VACUUM» removes files older than the retention, 7 days by default. So time travel
      is a short undo, not a backup. For a long history, keep snapshots or an SCD table.

      ## Now say it like a senior engineer

      > [!senior] Say the ownership of the files
      > "Tables we own are managed, so Unity Catalog governs every write and predictive
      > optimization handles compaction and vacuum. Landing zones that vendors write are external,
      > and nobody drops them without the owner. Downstream jobs read the change data feed by
      > version. For deletes we purge deletion vectors and vacuum, and log the time."

      ## In one breath

      A managed table's files belong to Unity Catalog and go with a drop; an external table's
      files belong to you and stay. Deletion vectors make updates cheap but delay physical
      removal, the change data feed gives row changes by version, and «VACUUM» sets how far time
      travel reaches.
    `,
    checks: [
      {
        question: 'You run DROP TABLE on an external table. What happens to its files?',
        options: [
          'They are deleted at once',
          'They are deleted after 7 days',
          'They stay at their path',
          'They move to managed storage',
        ],
        answer: 2,
        why: 'Dropping an external table removes only its definition. The files stay where they are.',
      },
      {
        question:
          'A table uses deletion vectors. After DELETE FROM users WHERE id = 7, where is row 7?',
        options: [
          'Removed from every file at once',
          'Still in its data file, marked as deleted until the file is rewritten',
          'Moved to a separate deleted-rows table',
          'In the change data feed only',
        ],
        answer: 1,
        why: 'A deletion vector marks the row. The file is rewritten later by OPTIMIZE or a purge, and old files go with VACUUM.',
      },
    ],
  },
];
