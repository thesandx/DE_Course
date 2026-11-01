import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'spark',
  title: 'Spark and distributed processing',
  summary:
    'How Spark runs your code, why shuffles and skew dominate cost, and how to debug a slow or failing job.',
  tone: 'soda',
  why: 'Senior candidates are expected to explain why a job is slow, not just write one. Shuffles, skew, memory and file layout come up in coding, design and "tell me about a hard problem" questions alike.',
  lessons: [
    {
      slug: 'execution-model',
      title: 'How Spark runs your code',
      summary:
        'Drivers, executors, jobs, stages and tasks, and why nothing happens until an action.',
      minutes: 13,
      body: `
        Spark turns your DataFrame code into a plan, splits it into stages at every shuffle, and
        runs each stage as parallel tasks, one per partition. Explaining this chain clearly is the
        foundation for every performance question.

        ~~~text
        action (write, count, collect)
          └─ job
               ├─ stage 1: read + filter + map         (narrow, one task per input partition)
               │      shuffle (exchange) by key
               └─ stage 2: aggregate / join            (one task per shuffle partition)
        ~~~

        | Term | Meaning |
        |---|---|
        | Driver | Plans the work and schedules tasks. Holds results of «collect()». |
        | Executor | A JVM process on a worker that runs tasks and caches data. |
        | Job | Triggered by one action. |
        | Stage | A set of tasks with no shuffle between them. |
        | Task | One unit of work on one partition. |

        ## Lazy evaluation

        Transformations («filter», «select», «join») only build a plan. An action runs it. That lets
        the Catalyst optimizer push filters down to the file reader, prune columns and reorder work.

        ## Narrow versus wide

        - **Narrow** transformations need only their own partition: «filter», «select», «withColumn».
        - **Wide** transformations need data from many partitions, so Spark shuffles: «groupBy»,
          «join» (unless broadcast), «distinct», «orderBy», window functions.

        A shuffle writes data to local disk, sends it across the network and reads it back. It is
        usually the most expensive thing in a job.

        > [!tip] Read the plan
        > «df.explain("formatted")» shows «Exchange» nodes (shuffles), «BroadcastHashJoin» versus
        > «SortMergeJoin», and «PushedFilters» on the scan. The Spark UI's SQL tab shows the same plan
        > with real row counts and time per node.

        > [!senior] Count the shuffles
        > When asked to optimise, start with: "How many shuffles does this plan have, and can I
        > remove one?" Pre-partitioned inputs, broadcast joins and combining aggregations are the
        > usual ways.
      `,
      checks: [
        {
          question: 'Which operation does NOT cause a shuffle on its own?',
          options: ['groupBy().agg()', 'filter()', 'distinct()', 'orderBy()'],
          answer: 1,
          why: 'filter is narrow: each partition is processed independently. The others need rows with the same key or a global order in one place.',
        },
      ],
    },
    {
      slug: 'joins-and-skew',
      title: 'Joins, skew and how to fix them',
      summary: 'Pick broadcast or sort-merge joins, and fix a skewed key with AQE or salting.',
      minutes: 16,
      body: `
        Skew is the classic senior Spark question: the job is 95 percent done in two minutes and the
        last task runs for an hour. One key (a huge city, a bot user, a NULL) holds a big share of
        the rows, so one task gets all of them.

        ## Join strategies

        | Strategy | When | Cost |
        |---|---|---|
        | Broadcast hash join | One side is small (default threshold 10 MB, often raised) | No shuffle of the big side |
        | Sort-merge join | Both sides large | Shuffle both sides, sort, merge |
        | Shuffle hash join | Both large, one side's partitions fit in memory | Shuffle, no sort |

        ~~~python
        from pyspark.sql import functions as F

        trips.join(F.broadcast(cities), "city_id")   # force a broadcast of the small side
        ~~~

        ## Spotting skew

        In the Spark UI stage view, compare the median and max task duration and shuffle read size.
        A max that is ten or more times the median is skew. Then find the key:

        ~~~python
        trips.groupBy("rider_id").count().orderBy(F.desc("count")).show(10)
        ~~~

        ## Fixes, in the order to try them

        1. **Filter or handle the hot key separately.** NULL keys and test accounts are often the
           cause and should not be joined at all.
        2. **Adaptive Query Execution (AQE).** On by default since Spark 3.2. With
           «spark.sql.adaptive.skewJoin.enabled», Spark splits oversized partitions at runtime.
        3. **Broadcast** the other side if it fits.
        4. **Salting.** Add a random suffix to the hot key on the big side and replicate the small
           side once per suffix.

        ~~~python
        SALTS = 16
        big = trips.withColumn("salt", (F.rand() * SALTS).cast("int"))
        small = drivers.crossJoin(spark.range(SALTS).withColumnRenamed("id", "salt"))
        joined = big.join(small, ["driver_id", "salt"]).drop("salt")
        ~~~

        > [!trap] Salting everything is wasteful
        > Replicating the small side 16 times costs memory and network. Salt only the hot keys if
        > you can identify them, and leave the rest on the normal path.

        > [!senior] Skew in aggregations too
        > «groupBy» on a skewed key has the same problem. Spark's partial aggregation (map-side
        > combine) helps for sums and counts, but not for «collect_list». A two-stage aggregation
        > with a salt is the general fix.
      `,
      checks: [
        {
          question:
            'Stage view: median task 20 s, max task 45 min, max shuffle read 80 GB. What is the likely cause?',
          options: [
            'Too few executors',
            'Skew on the join or group key',
            'Slow disks',
            'Python UDF overhead',
          ],
          answer: 1,
          why: 'One task reading far more shuffle data than the others is the signature of a skewed key.',
        },
      ],
    },
    {
      slug: 'partitions-and-files',
      title: 'Partitions, files and the small files problem',
      summary: 'Size shuffle partitions and output files so jobs and their readers stay fast.',
      minutes: 13,
      body: `
        Partitions decide parallelism. Too few and executors sit idle or run out of memory. Too many
        and scheduling overhead dominates and the job writes thousands of tiny files.

        ## Shuffle partitions

        «spark.sql.shuffle.partitions» defaults to 200 whatever the data size. Aim for shuffle
        partitions of roughly 100 to 200 MB. With AQE on, Spark coalesces small shuffle partitions
        automatically, which removes most of the tuning.

        ## repartition versus coalesce

        | | «repartition(n)» or «repartition(n, col)» | «coalesce(n)» |
        |---|---|---|
        | Shuffle | Yes, full | No, merges existing partitions |
        | Can increase partitions | Yes | No |
        | Balance | Even | Can be uneven |
        | Use for | Changing parallelism, partitioning by a key before a write | Reducing output file count cheaply |

        > [!trap] coalesce(1) before a write
        > It makes one task do the whole final stage, often the entire job upstream too. Use it only
        > for tiny outputs.

        ## The small files problem

        Writing with «partitionBy("date", "city")» from 400 tasks can create 400 files per
        partition directory. Readers then pay a fixed cost per file (listing, opening, footers).

        ~~~python
        (trips
          .repartition("trip_date")           # one shuffle so each date lands in few tasks
          .write
          .partitionBy("trip_date")
          .option("maxRecordsPerFile", 5_000_000)
          .mode("overwrite")
          .parquet("s3://lake/trips"))
        ~~~

        Target files of 128 MB to 1 GB. Table formats such as Delta, Iceberg and Hudi add compaction
        jobs that merge small files after the fact.

        > [!senior] Dynamic partition overwrite
        > With «spark.sql.sources.partitionOverwriteMode=dynamic», an overwrite replaces only the
        > partitions present in the new data. That makes a daily rerun idempotent without deleting
        > the rest of the table. Mention it whenever you talk about backfills.
      `,
      checks: [
        {
          question: 'You need fewer output files and do not want a full shuffle. Which call?',
          options: ['repartition(10)', 'coalesce(10)', 'distinct()', 'cache()'],
          answer: 1,
          why: 'coalesce merges existing partitions without a shuffle. It cannot increase the count and can be uneven, which is acceptable for reducing files.',
        },
      ],
    },
    {
      slug: 'memory-and-udfs',
      title: 'Memory, caching and UDFs',
      summary: 'Explain out-of-memory errors, when caching helps, and why Python UDFs are slow.',
      minutes: 12,
      body: `
        ## Where memory goes

        Executor memory is split between **execution** (shuffles, joins, sorts, aggregations) and
        **storage** (cached data), which borrow from each other. When execution memory runs out,
        Spark spills to disk, which is slow but survives. Out-of-memory errors usually come from:

        - One huge partition (skew), or a few very wide rows.
        - «collect()» or «toPandas()» pulling a large result into the driver.
        - A broadcast that is bigger than expected.
        - Python workers using memory outside the JVM's accounting (overhead memory).

        ## Caching

        «cache()» helps only when the same DataFrame is used by more than one action. Caching
        something used once just adds cost. Unpersist when done.

        ## UDFs

        | Kind | Speed | Why |
        |---|---|---|
        | Built-in functions («F.when», «F.regexp_extract») | Fastest | Run in the JVM, optimised by Catalyst |
        | Pandas (vectorised) UDF | Good | Batches via Apache Arrow |
        | Row-by-row Python UDF | Slowest | Serialises each row to a Python process and back |

        ~~~python
        import pandas as pd
        from pyspark.sql.functions import pandas_udf

        @pandas_udf("double")
        def to_usd(amount: pd.Series, rate: pd.Series) -> pd.Series:
            return amount * rate
        ~~~

        > [!senior] Prefer expressions, then vectorise
        > "First I would rewrite it with built-in functions. If logic needs Python, a pandas UDF.
        > A plain UDF only for something tiny." That order is what reviewers want to hear.
      `,
      checks: [
        {
          question: 'A DataFrame is computed once and written once. Should you cache it?',
          options: [
            'Yes, always cache before writing',
            'No, caching helps only when the data is reused by several actions',
            'Yes, to avoid shuffles',
            'Only on the driver',
          ],
          answer: 1,
          why: 'Caching stores results for reuse. With a single action there is nothing to reuse, so it only adds memory pressure.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'spark-repartition-vs-coalesce',
    title: 'Repartition or coalesce?',
    track: 'spark',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber'],
    prompt: `
      A job filters 2 TB of events down to 5 GB and writes it out. The output has 4,000 small
      files. A teammate proposes «coalesce(1)». What do you suggest and why?
    `,
    hints: ['How big should files be?', 'What does coalesce(1) do to parallelism upstream?'],
    answer: `
      Aim for files of about 128 MB to 1 GB: 5 GB / 256 MB ≈ 20 files. Use «coalesce(20)» if the
      partitions are roughly even, or «repartition(20)» if they are skewed (one extra shuffle of
      only 5 GB is cheap).

      «coalesce(1)» forces the final stage into one task and can collapse the upstream filter
      stage into one task too, because coalesce does not add a stage boundary. The job would read
      2 TB with one core. If you need exactly one file, add «repartition(1)» after the filter so
      the heavy read stays parallel.
    `,
    signals: [
      'Computes a target file count from data size',
      'Knows coalesce can reduce upstream parallelism',
      'Chooses repartition when partitions are uneven',
    ],
    followUps: ['How does AQE change this?'],
  },
  {
    slug: 'spark-skewed-join',
    title: 'Fix a skewed join',
    track: 'spark',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      A daily job joins 3 billion trip events to a 40 GB driver table on «driver_id». It used to
      take 20 minutes and now takes 3 hours. The Spark UI shows one task reading 120 GB of shuffle
      data while the median task reads 400 MB.

      Walk through how you diagnose and fix it.
    `,
    hints: [
      'Find the key first.',
      'Is the hot key real data or junk?',
      'Then: AQE, broadcast, salting.',
    ],
    answer: `
      1. **Confirm and find the key.** «groupBy("driver_id").count()» on the events, sorted
         descending. Often the culprit is NULL or a sentinel such as 0 or "unknown", or a test or
         fleet account.
      2. **If it is junk** (NULL, test), filter it out or route it separately. Joining NULLs is
         pointless anyway because NULL never equals NULL.
      3. **If it is real**, turn on AQE skew handling («spark.sql.adaptive.enabled» and
         «spark.sql.adaptive.skewJoin.enabled»), which splits the oversized partition at runtime.
      4. **Broadcast** is not an option at 40 GB, but you can split the join: broadcast-join the
         hot keys against a small slice of the driver table, sort-merge join the rest, and union.
      5. **Salting** as a fallback: add a 0 to N salt on the events for hot keys only, replicate
         those driver rows N times, join on (driver_id, salt).

      Then explain why it changed: something upstream started emitting a default driver id. Add a
      data quality check on the share of NULL or default keys so it alerts next time.
    `,
    signals: [
      'Starts from evidence in the UI and finds the key',
      'Checks whether the hot key is junk before optimising',
      'Knows AQE skew join and when it is enough',
      'Salts only hot keys and explains the cost',
      'Adds a monitor so the regression is caught upstream',
    ],
    followUps: ['The same skew appears in a groupBy with collect_list. What now?'],
  },
  {
    slug: 'spark-dedupe-latest',
    title: 'Keep the latest record per key in PySpark',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      A DataFrame «updates(order_id, status, updated_at, offset)» has many versions per order.
      Write PySpark that keeps the latest version per «order_id», deterministically. Then give a
      second approach that avoids a full sort.
    `,
    hints: [
      'A window with row_number is the readable approach.',
      'max_by or a struct max avoids sorting each partition fully.',
    ],
    answer: `
      ~~~python
      from pyspark.sql import Window, functions as F

      w = Window.partitionBy("order_id").orderBy(F.desc("updated_at"), F.desc("offset"))
      latest = (updates
                .withColumn("rn", F.row_number().over(w))
                .filter("rn = 1")
                .drop("rn"))
      ~~~

      Without the window's sort, aggregate the max of a struct whose first fields are the
      ordering columns. Structs compare field by field:

      ~~~python
      latest = (updates
                .groupBy("order_id")
                .agg(F.max(F.struct("updated_at", "offset", "status")).alias("s"))
                .select("order_id", "s.status", "s.updated_at", "s.offset"))
      ~~~

      The second version allows map-side partial aggregation, so less data is shuffled. Spark 3.3
      also has «max_by(status, struct(updated_at, offset))».
    `,
    signals: [
      'Adds a tie-breaker for determinism',
      'Knows the struct max or max_by trick',
      'Explains why partial aggregation reduces shuffle',
    ],
    followUps: [
      'Updates arrive every 10 minutes. How would you maintain the latest table incrementally?',
    ],
  },
  {
    slug: 'spark-slow-job-checklist',
    title: 'A job got slow: your checklist',
    track: 'spark',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'uber'],
    prompt: `
      An hourly Spark job's runtime grew from 15 to 50 minutes over a month. Nobody changed the
      code. What do you check, in order?
    `,
    hints: [
      'Input changed, cluster changed, or layout changed.',
      'Use the UI to find the slow stage.',
    ],
    answer: `
      1. **Input size and shape.** Did volume grow? Did a new source add a hot key? Compare input
         bytes per run.
      2. **The slow stage in the UI.** Which stage grew? Is it skewed (max far above median),
         spilling (spill columns), or waiting on resources (scheduler delay)?
      3. **File layout.** Has the input table accumulated small files or lost compaction? Count
         files and average file size per partition.
      4. **Plan changes.** Did a join flip from broadcast to sort-merge because a dimension grew
         past the threshold? Compare «explain» output between an old and a new run.
      5. **Cluster.** Fewer executors because of autoscaling limits or noisy neighbours?

      Fix the cause, not the symptom, and add a runtime and input-size metric with an alert so
      the next drift is noticed in days, not a month.
    `,
    signals: [
      'Checks input growth and data shape before tuning',
      'Uses stage metrics to localise the problem',
      'Knows a broadcast can silently flip to sort-merge',
      'Adds monitoring on runtime and input size',
    ],
    followUps: ['How do you make the job’s runtime predictable as data grows 10 times?'],
  },
  {
    slug: 'spark-driver-oom',
    title: 'Driver out of memory',
    track: 'spark',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber'],
    prompt: `
      A notebook job fails with «java.lang.OutOfMemoryError» on the driver right after
      «df.toPandas()». The DataFrame has 300 million rows. What happened and what do you do?
    `,
    hints: ['Where does toPandas put the data?'],
    answer: `
      «toPandas()» (like «collect()») pulls every row into the driver process. 300 million rows do
      not fit, so the driver dies, whatever the executors' size.

      Options: aggregate or sample in Spark first and pull only the small result; write the result
      to storage (Parquet) and read it in pieces; or use the pandas API on Spark so the work stays
      distributed. Raising driver memory only hides the problem until the data grows again.
    `,
    signals: [
      'Knows collect and toPandas run through the driver',
      'Reduces data in Spark before moving it',
      'Rejects "just add memory" as the fix',
    ],
    followUps: ['A broadcast join also fails on the driver. Why can that happen?'],
  },
  {
    slug: 'spark-sessionize-events',
    title: 'Sessionize events in PySpark',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      «events(user_id, ts)», with «ts» as a timestamp. A session ends after 30 minutes of
      inactivity. Add a «session_id» column that is unique across users.
    `,
    hints: [
      'lag over a window per user.',
      'A running sum of new-session flags.',
      'Combine user id and the session number.',
    ],
    answer: `
      ~~~python
      from pyspark.sql import Window, functions as F

      w = Window.partitionBy("user_id").orderBy("ts")
      gap_s = F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")

      sessions = (events
        .withColumn("new_session", F.when(gap_s.isNull() | (gap_s > 1800), 1).otherwise(0))
        .withColumn("session_no", F.sum("new_session").over(
            w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
        .withColumn("session_id", F.concat_ws("-", "user_id", "session_no")))
      ~~~

      The window partitions by user, so one heavy user (a bot) lands on one task. Filter bots
      first. Spark 3.2 also offers «session_window(ts, "30 minutes")» in «groupBy», which is the
      same idea for aggregation and works in Structured Streaming.
    `,
    signals: [
      'Uses lag and a running sum with an explicit row frame',
      'Builds a globally unique session id',
      'Mentions skew from heavy users',
      'Knows session_window',
    ],
    followUps: ['How do you sessionize incrementally each hour without reprocessing all history?'],
  },
];
