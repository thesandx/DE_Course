import { pysparkLessons, pysparkProblems } from '@/lib/course/tracks/spark-pyspark';
import { spark4Lessons } from '@/lib/course/tracks/spark4-databricks';
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
      minutes: 14,
      body: `
        ## Start with the problem

        You write five lines of PySpark: read, filter, group, join, write. You run it on 2 TB. It takes
        40 minutes, and a colleague's version of the same logic takes 6. Neither of you wrote anything
        "slow" in the code. The difference is in what Spark **did** with the code.

        Every Spark performance question starts here: how Spark turns your code into work spread over
        many machines. Learn this chain once, and every later lesson makes sense.

        ## Idea 1: a head chef and many cooks (driver and executors)

        Picture a big restaurant kitchen. The **head chef** reads the order, plans it, and hands out
        tasks. Many **cooks** do the actual chopping and cooking, each at their own station.

        - The **driver** is the head chef. It plans the work and schedules tasks. It also holds the
          results of «collect()», so collecting a huge result floods one person.
        - An **executor** is a cook: a JVM process on a worker machine that runs tasks and can cache
          data.

        ## Idea 2: nothing happens until you ask for the result (lazy evaluation)

        «filter», «select» and «join» do not touch any data. They only add steps to a plan, like
        writing a recipe. An **action** («write», «count», «collect») says "now cook it".

        Why wait? Because with the whole recipe in hand, the **Catalyst optimizer** can improve it
        first: push filters down to the file reader so less data is read, drop columns nobody uses, and
        reorder the work.

        ## Idea 3: jobs, stages and tasks

        When an action runs, Spark breaks the plan into pieces.

        - A **job** is one action.
        - A **stage** is a run of steps that need no data from other machines.
        - A **task** is one stage's work on one **partition** (one slice of the data). Tasks run in
          parallel, one per partition.

        ~~~text
        action (write)
         └ job
           ├ stage 1
           │  read + filter + map
           │  one task per partition
           │
           │  shuffle by key
           │
           └ stage 2
              aggregate / join
              one task per partition
        ~~~

        ## Idea 4: narrow and wide, and why the shuffle is expensive

        - **Narrow** steps need only their own partition: «filter», «select», «withColumn». Each cook
          works on their own tray.
        - **Wide** steps need rows from many partitions: «groupBy», «join» (unless broadcast),
          «distinct», «orderBy», window functions. All the rows for one key must meet in one place.

        To make rows meet, Spark **shuffles**: each task writes its rows to local disk, sorted into
        buckets by key, then sends them over the network, and the next stage reads them back. Every
        cook passes ingredients to every other cook. A shuffle is usually the most expensive thing in
        a job, and every shuffle starts a new stage.

        > [!tip] Read the plan
        > «df.explain("formatted")» shows «Exchange» nodes (shuffles), «BroadcastHashJoin» versus
        > «SortMergeJoin», and «PushedFilters» on the scan. The Spark UI's SQL tab shows the same plan
        > with real row counts and time per node.

        ## Now say it like a senior engineer

        > [!senior] Count the shuffles
        > When asked to optimise, start with: "How many shuffles does this plan have, and can I remove
        > one?" Pre-partitioned inputs, broadcast joins and combining aggregations are the usual ways.

        ## In one breath

        The driver plans, executors run one task per partition, and nothing runs until an action.
        Every wide step shuffles data across the network and starts a new stage, so performance work
        starts by counting and removing shuffles.
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
      minutes: 17,
      body: `
        ## Start with the problem

        Your Spark job is 95 percent done in two minutes. Then the progress bar stops. One task runs
        for an hour while the other 199 sit finished and idle.

        That is **skew**, the classic senior Spark question. Remember: in a join or group, all the rows
        with the same key go to the same task. If one key (a huge city, a bot user, a NULL) holds a big
        share of the rows, one task gets all of them. One cook gets 40 crates of onions; everyone else
        gets one.

        ## Idea 1: three ways to join

        - **Broadcast hash join.** One side is small, so copy it whole to every executor. The big side
          never moves: **no shuffle** of the big side. The default size threshold is 10 MB, often
          raised.
        - **Sort-merge join.** Both sides are large. Shuffle both by key, sort, then merge. Robust,
          but costs two shuffles and a sort.
        - **Shuffle hash join.** Both large, but one side's partitions fit in memory. Shuffle, build a
          hash table, no sort.

        ~~~python
        from pyspark.sql import functions as F

        trips.join(F.broadcast(cities), "city_id")   # force a broadcast of the small side
        ~~~

        ## Idea 2: how to spot skew

        In the Spark UI stage view, compare the **median** and **max** task duration, and the shuffle
        read size. A max that is ten or more times the median is skew. Then find the guilty key:

        ~~~python
        trips.groupBy("rider_id").count().orderBy(F.desc("count")).show(10)
        ~~~

        ## Idea 3: fixes, in the order to try them

        1. **Filter or handle the hot key separately.** NULL keys and test accounts are often the
           cause, and should not be joined at all.
        2. **Adaptive Query Execution (AQE).** On by default since Spark 3.2. With
           «spark.sql.adaptive.skewJoin.enabled», Spark splits oversized partitions while the job
           runs.
        3. **Broadcast** the other side, if it fits. No shuffle means no hot task.
        4. **Salting.** Split the hot key into many smaller keys.

        Salting, step by step. Add a random number from 0 to 15 (the **salt**) to each row on the big
        side, so "driver 7" becomes 16 different keys spread over 16 tasks. Then copy each row of the
        small side 16 times, once per salt, so every salted key still finds its match. Join on the key
        plus the salt.

        ~~~python
        SALTS = 16
        big = trips.withColumn("salt", (F.rand() * SALTS).cast("int"))
        small = drivers.crossJoin(spark.range(SALTS).withColumnRenamed("id", "salt"))
        joined = big.join(small, ["driver_id", "salt"]).drop("salt")
        ~~~

        > [!trap] Salting everything is wasteful
        > Copying the small side 16 times costs memory and network. Salt only the hot keys if you can
        > identify them, and leave the rest on the normal path.

        ## Now say it like a senior engineer

        > [!senior] Skew in aggregations too
        > «groupBy» on a skewed key has the same problem. Spark's partial aggregation (map-side
        > combine) helps for sums and counts, but not for «collect_list». A two-stage aggregation with
        > a salt is the general fix.

        ## In one breath

        Skew is one key holding a big share of the rows, so one task does most of the work. Drop junk
        keys, let AQE split big partitions, broadcast the small side, and salt the hot key when nothing
        else works.
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
      minutes: 14,
      body: `
        ## Start with the problem

        A job writes a table. The next morning, a dashboard query on that table takes 3 minutes. You
        look at the storage: 480,000 files, most of them 200 KB. The query spends almost all its time
        opening files, not reading data.

        Partitions decide how work is split. Too few, and executors sit idle or run out of memory. Too
        many, and scheduling overhead dominates and the job writes thousands of tiny files. Getting the
        size right fixes both the job and everyone who reads its output.

        ## Idea 1: size the slices (shuffle partitions)

        After a shuffle, Spark splits the data into «spark.sql.shuffle.partitions» pieces. The default
        is 200, **whatever the data size**. 200 pieces of 10 TB is 50 GB each: too big. 200 pieces of
        100 MB is 500 KB each: too small.

        Aim for shuffle partitions of roughly 100 to 200 MB. AQE fixes only half of this. It **merges**
        small shuffle partitions, so 200 tiny pieces become a few right-sized ones. It never splits a
        big piece, except a skewed one in a join. It merges down from
        «spark.sql.adaptive.coalescePartitions.initialPartitionNum», which defaults to
        «spark.sql.shuffle.partitions». So for 10 TB, start high, for example 20,000, and let AQE
        merge down.

        ## Idea 2: repartition or coalesce

        Both change the number of partitions. They do it very differently.

        - «repartition(n)» or «repartition(n, col)»: a **full shuffle**. Can increase or decrease the
          count, and gives even partitions. Use it to change parallelism, or to group rows by a key
          before a write.
        - «coalesce(n)»: **no shuffle**; it just glues existing partitions together. Can only
          decrease the count, and partitions can be uneven. Use it to reduce output file count cheaply.

        > [!trap] coalesce(1) before a write
        > It makes one task do the whole final stage, and often the entire job upstream too, because
        > Spark folds the earlier steps into that one task. Use it only for tiny outputs.

        ## Idea 3: the small files problem

        Each task writes its own file into each partition directory it touches. Write with
        «partitionBy("date", "city")» from 400 tasks, and each directory can get 400 small files.
        Readers then pay a fixed cost per file: listing, opening, reading footers.

        The fix: shuffle once by the partition column first, so each date lands in only a few tasks.

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

        ## Now say it like a senior engineer

        > [!senior] Dynamic partition overwrite
        > With «spark.sql.sources.partitionOverwriteMode=dynamic», an overwrite replaces only the
        > partitions present in the new data. That makes a daily rerun idempotent without deleting the
        > rest of the table. Mention it whenever you talk about backfills.

        ## In one breath

        Aim for shuffle partitions of 100 to 200 MB and output files of 128 MB to 1 GB. Use
        «repartition» to reshape and «coalesce» only to shrink, and repartition by the partition column
        before a write so each directory gets a few big files.
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
      minutes: 13,
      body: `
        ## Start with the problem

        A Spark job dies with "OutOfMemoryError" after an hour. Someone doubles the executor memory,
        and it dies again, only later. Someone else adds «cache()» everywhere "to make it faster", and
        it gets slower. A third person writes a small Python function to clean a column, and the job
        time triples.

        All three problems come from not knowing where Spark's memory goes, and what crossing from the
        JVM into Python costs.

        ## Idea 1: where the memory goes

        Executor memory is shared between two jobs, which borrow from each other:

        - **Execution** memory: the working space for shuffles, joins, sorts and aggregations. A desk
          where you lay out the papers you are working on.
        - **Storage** memory: cached data. A shelf for things you want to keep handy.

        When execution memory runs out, Spark **spills** to disk: slow, but it survives. So an
        out-of-memory error usually means something could not spill, or something was far bigger than
        expected:

        - One huge partition (skew), or a few very wide rows.
        - «collect()» or «toPandas()» pulling a large result into the driver.
        - A broadcast that is bigger than expected.
        - Python workers using memory outside the JVM's accounting (overhead memory).

        ## Idea 2: caching only pays when you reuse

        «cache()» keeps a DataFrame in memory after it is computed once. That helps **only** when the
        same DataFrame is used by more than one action. Caching something used once just adds the cost
        of storing it. Unpersist when you are done.

        ## Idea 3: why Python functions are slow (UDFs)

        Spark runs in the JVM. Your Python function runs in a separate Python process. A row-by-row
        Python **UDF** (user-defined function) must send each row across that border, convert it, run
        your code, and send the answer back. Picture passing a million letters one at a time through a
        small window.

        - **Built-in functions** («F.when», «F.regexp_extract»): fastest. They run inside the JVM,
          and Catalyst can optimise them.
        - **Pandas (vectorised) UDF:** good. Rows cross in large batches through Apache Arrow, so
          the window opens once per batch, not once per row.
        - **Row-by-row Python UDF:** slowest. Every row crosses the border twice.

        ~~~python
        import pandas as pd
        from pyspark.sql.functions import pandas_udf

        @pandas_udf("double")
        def to_usd(amount: pd.Series, rate: pd.Series) -> pd.Series:
            return amount * rate
        ~~~

        ## Now say it like a senior engineer

        > [!senior] Prefer expressions, then vectorise
        > "First I would rewrite it with built-in functions. If the logic needs Python, a pandas UDF. A
        > plain UDF only for something tiny." That order is what reviewers want to hear.

        ## In one breath

        Executor memory is a desk for work and a shelf for cache, and out-of-memory usually means one
        partition or one result was far too big. Cache only what you reuse, and keep logic in built-in
        functions so rows never cross into Python one by one.
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
    {
      slug: 'catalyst-aqe-join-selection',
      title: 'Catalyst, AQE and how Spark picks a join',
      summary:
        'Walk a query through Catalyst, explain how Spark chooses a join strategy, what AQE changes at runtime, and what blocks the optimiser.',
      minutes: 17,
      body: `
        ## Start with the problem

        You write a join. Spark could run it as a broadcast join in 2 minutes or a sort-merge join in
        40. You did not choose; Spark did. "How does Spark decide?" is a standard senior question.

        The answer has two halves. **Catalyst** plans before the job runs, using estimates. **Adaptive
        Query Execution (AQE)** re-plans while it runs, using real numbers. Think of a satnav that
        picks a route before you leave, then reroutes when it sees the actual traffic.

        ## Idea 1: Catalyst, from your code to a plan

        ~~~text
        DataFrame / SQL
         → unresolved plan
         → analysis
           (names, types)
         → logical optimisation
           (rule rewrites)
         → physical planning
           (pick joins, operators)
         → code generation
        ~~~

        Logical rules you should be able to name:

        - **Predicate pushdown:** filters move below joins and into the file scan, so less is read.
        - **Column pruning:** read only the columns used.
        - **Constant folding** and **boolean simplification:** work out fixed parts once.
        - **Combining** adjacent filters and projections.

        **Whole-stage code generation** fuses a chain of narrow operators into one function, working
        on Spark's compact binary row format (the Tungsten project) instead of Java objects. In
        «explain» output, operators inside a codegen stage carry a «*(n)» prefix.

        ## Idea 2: how Spark picks a join

        For an equi-join, Spark checks, in this order:

        1. A **hint**: «BROADCAST», «MERGE», «SHUFFLE_HASH» or «SHUFFLE_REPLICATE_NL». You told it.
        2. **Broadcast hash join** if one side's estimated size is under
           «spark.sql.autoBroadcastJoinThreshold» (10 MB by default).
        3. **Sort-merge join** otherwise («spark.sql.join.preferSortMergeJoin» is true by default).
        4. Shuffle hash join, when sort-merge is not preferred and one side's partitions fit in memory.

        ~~~sql
        SELECT /*+ BROADCAST(z) */ t.*, z.zone_name
        FROM trips t JOIN zones z ON t.zone_id = z.zone_id;
        ~~~

        The weak point is step 2's "estimated size". By default it comes from **file sizes**, not from
        the size after your filter. The cost-based optimiser («spark.sql.cbo.enabled») is **off by
        default**. With «ANALYZE TABLE t COMPUTE STATISTICS FOR COLUMNS a, b» and CBO on, Spark can
        also reorder joins using row counts and distinct values.

        ## Idea 3: AQE, rerouting with real numbers

        AQE is on by default since Spark 3.2. After each shuffle stage, Spark knows the **real** sizes,
        and can change the rest of the plan.

        - **Coalesce shuffle partitions:** merges many tiny post-shuffle partitions, so 200 tasks of
          1 MB become 4 tasks.
        - **Switch join strategy:** turns a planned sort-merge join into a broadcast join, when a side
          turns out small after filtering.
        - **Skew join:** splits oversized partitions, and replicates the matching side.

        **Dynamic partition pruning** (Spark 3.0) is related: a filter on a small dimension prunes the
        partitions of a large fact table at runtime.

        ## Idea 4: what blinds the optimiser

        - **Python UDFs** are a black box. Catalyst cannot push a filter through one or know its
          output size, and every row crosses to a Python worker. Prefer built-in functions; if you
          must, use a vectorised pandas UDF.
        - **Casting or wrapping a filter column** («CAST(dt AS STRING) = '2026-11-01'») can stop
          partition pruning and pushdown.
        - **Dropping to RDDs** («df.rdd.map(...)») leaves Catalyst entirely.
        - **Caching too early** freezes a plan, and can hide pushdown from later filters.

        > [!tip] Confirm in the plan
        > Look for «PushedFilters» and «PartitionFilters» on the scan node, «BroadcastHashJoin» versus
        > «SortMergeJoin», and «AdaptiveSparkPlan isFinalPlan=true» after the job ran.

        ## Now say it like a senior engineer

        > [!senior] Statistics drive everything
        > "Spark chose sort-merge because it estimated the filtered dimension from its full file size.
        > AQE switched it to broadcast at runtime. I would also add a broadcast hint, since the
        > dimension is always small after this filter." That shows you know both planning halves.

        ## In one breath

        Catalyst plans before the run from estimates: push filters down, prune columns, pick a join by
        estimated size. AQE re-plans after each shuffle with real sizes, and UDFs, casts on filter
        columns and RDDs blind both.
      `,
      checks: [
        {
          question:
            "Is Spark's cost-based optimiser (join reordering by statistics) on by default?",
          options: [
            'Yes, always',
            'No; spark.sql.cbo.enabled is false by default and needs column statistics',
            'Only in Structured Streaming',
            'Only for Python',
          ],
          answer: 1,
          why: 'Rule-based optimisation always runs. CBO join reordering must be enabled and needs ANALYZE TABLE statistics. AQE, which is on by default, covers many of the same cases at runtime.',
        },
        {
          question: 'Why does a Python UDF in a filter often make a scan read more data?',
          options: [
            'Python is single-threaded',
            'Catalyst cannot see inside the UDF, so it cannot push the filter into the scan',
            'UDFs disable caching',
            'UDFs force a broadcast join',
          ],
          answer: 1,
          why: 'The UDF is a black box to the optimiser. Express the filter with built-in functions so it becomes a pushed or partition filter.',
        },
      ],
    },
    {
      slug: 'duckdb-spark-trino',
      title: 'DuckDB, Spark or Trino',
      summary:
        'Compare an in-process engine, a distributed batch engine and an MPP SQL engine, and choose one for a workload by data size, latency and failure tolerance.',
      minutes: 15,
      body: `
        ## Start with the problem

        You have a 2 GB Parquet file to aggregate. A colleague spins up a Spark cluster: 4 minutes to
        start, 3 minutes to run. You run DuckDB on your laptop: 6 seconds. Next week, the job is 40 TB
        and runs for six hours. Now DuckDB is hopeless, and Spark is the obvious answer. Then an
        analyst wants to join lake data with Postgres, interactively. Neither fits well.

        Three engines cover most analytical work on a lake. They are built on different ideas, so
        "which one?" is a frequent design question.

        ## Idea 1: three shapes

        Think of three ways to cook for a crowd.

        - **DuckDB** is a great home kitchen. A library inside your own process: no servers, starts
          in milliseconds, uses every core of one machine.
        - **Spark** is a catering company. It sets up a crew (driver plus executors) for each big
          job. Slow to start, but it can cook anything, at any size, and replaces a cook who falls ill.
        - **Trino** is a restaurant that is always open. A coordinator plus workers, always running,
          serving many small orders fast.

        ## Idea 2: how each one behaves

        **DuckDB**
        - Execution: vectorised, multi-core, one machine.
        - Scale: one machine, up to hundreds of GB with spilling.
        - Start-up: milliseconds.
        - Failure: if the process dies, the query dies.
        - Languages: SQL, Python and others.
        - Best at: local analysis, tests, small pipelines, notebooks.

        **Spark**
        - Execution: stages split at shuffles; data written to disk between stages.
        - Scale: petabytes.
        - Start-up: seconds to minutes for a cluster.
        - Failure: retries failed tasks and stages.
        - Languages: SQL, Python, Scala, Java.
        - Best at: long ETL, heavy joins, ML preprocessing, streaming.

        **Trino**
        - Execution: pipelined stages that stream data in memory between workers.
        - Scale: petabytes of scans; joins are limited by memory.
        - Start-up: already running; sub-second queries.
        - Failure: a worker failure fails the query by default; fault-tolerant mode spools exchanges.
        - Languages: SQL.
        - Best at: interactive SQL across many sources (federation).

        ## Idea 3: choosing

        - **Data under about 100 GB, one job, one machine:** DuckDB (or Polars). No cluster, no
          scheduler. A laptop or one large VM often beats a small Spark cluster, because there is no
          shuffle over a network.
        - **Hours-long transformations of terabytes, Python logic, retries needed:** Spark. A task
          failure at hour three costs one task, not the whole job.
        - **Analysts running ad hoc SQL over the lake, joined with Postgres or Kafka:** Trino. Low
          latency, many connectors, one SQL dialect.

        ## Idea 4: they work together

        A common lake stack: Spark writes Iceberg tables in nightly and streaming jobs. Trino serves
        analysts on the same tables. DuckDB runs unit tests in CI, and lets engineers explore a sample
        on a laptop with «read_parquet('s3://...')».

        ~~~python
        import duckdb

        con = duckdb.connect()
        top = con.sql(
            """
            SELECT pickup_zone, count(*) AS trips
            FROM read_parquet('trips/*.parquet')
            GROUP BY pickup_zone
            ORDER BY trips DESC
            LIMIT 10
            """
        ).fetchall()
        ~~~

        > [!trap] Spark for a 2 GB file
        > Starting a cluster, shuffling over the network and paying for idle executors to process
        > 2 GB is slower and costlier than one process. Interviewers like to hear that you would not
        > use Spark.

        ## Now say it like a senior engineer

        > [!senior] Decide on three axes
        > Say the data size, the latency target and what happens on failure. "Interactive, under 10
        > seconds, read-only: Trino. Six-hour ETL that must survive a lost node: Spark. CI tests and
        > 50 GB exploration: DuckDB."

        ## In one breath

        DuckDB is a fast home kitchen on one machine, Spark is a fault-tolerant crew for huge batch
        jobs, and Trino is an always-open SQL service across many sources. Choose by data size, latency
        and what must survive a failure.
      `,
      checks: [
        {
          question:
            'A nightly job transforms 30 TB with heavy joins and must survive a lost node. Which engine fits best?',
          options: ['DuckDB', 'Spark', 'Trino in default mode', 'A Python script with pandas'],
          answer: 1,
          why: 'Spark writes shuffle output between stages and retries failed tasks, so a lost node costs a few tasks, not the whole job.',
        },
        {
          question: 'Why can DuckDB on one large VM beat a small Spark cluster on 50 GB?',
          options: [
            'DuckDB caches the internet',
            'It runs vectorised in one process with no cluster start-up and no network shuffle',
            'Spark cannot read Parquet',
            'DuckDB uses GPUs',
          ],
          answer: 1,
          why: 'At this size, cluster overhead and network shuffles cost more than they save.',
        },
      ],
    },
    ...pysparkLessons,
    ...spark4Lessons,
  ],
};

export const problems: Problem[] = [
  {
    slug: 'spark-repartition-vs-coalesce',
    title: 'Repartition or coalesce?',
    track: 'spark',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'microsoft', 'flipkart', 'walmart'],
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
    companies: ['uber', 'google', 'microsoft', 'flipkart', 'walmart'],
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
    companies: ['uber', 'google', 'microsoft', 'flipkart', 'walmart'],
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
      result = (updates
                .withColumn("rn", F.row_number().over(w))
                .filter("rn = 1")
                .drop("rn"))
      ~~~

      Without the window's sort, aggregate the max of a struct whose first fields are the
      ordering columns. Structs compare field by field:

      ~~~python
      result = (updates
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
    companies: ['google', 'uber', 'microsoft', 'flipkart', 'walmart'],
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
    companies: ['uber', 'microsoft', 'flipkart', 'walmart'],
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
    companies: ['uber', 'google', 'microsoft', 'flipkart', 'walmart'],
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

      result = (events
        .withColumn("new_session", F.when(gap_s.isNull() | (gap_s > 1800), 1).otherwise(0))
        .withColumn("session_no", F.sum("new_session").over(
            w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
        .withColumn("session_id", F.concat_ws("-", "user_id", "session_no"))
        .drop("new_session", "session_no"))
      ~~~

      «gap_s > 1800» keeps a gap of exactly 30 minutes in the session. The «-» in «concat_ws»
      matters: without a separator, user «u1» with session 12 and user «u11» with session 2
      both give «u112».

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
  {
    slug: 'spark-udf-blocks-pruning',
    title: 'A filter reads every partition',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber', 'google', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      This job should read one day of a table partitioned by «event_date» (a string column), but
      it reads all 900 days:

      ~~~python
      from pyspark.sql import functions as F
      from pyspark.sql.types import BooleanType

      @F.udf(returnType=BooleanType())
      def is_target_day(d):
          return d == "2026-11-01"

      events = spark.table("lake.events")
      daily = events.filter(is_target_day("event_date")).join(cities, "city_id")
      ~~~

      Explain why, show the fix, and say how you would confirm it.
    `,
    hints: [
      'Can Catalyst see inside a Python UDF?',
      'Where does a partition filter appear in the plan?',
    ],
    answer: `
      A Python UDF is opaque to Catalyst. It cannot turn «is_target_day(event_date)» into a
      partition filter, so the scan lists and reads every partition, ships each row to a Python
      worker, and only then filters.

      ~~~python
      from pyspark.sql import functions as F

      events = spark.table("lake.events")
      daily = (
          events.filter(F.col("event_date") == "2026-11-01")
          .join(F.broadcast(cities), "city_id")
      )
      daily.explain("formatted")
      ~~~

      Confirm: the scan node now shows «PartitionFilters: [isnotnull(event_date),
      (event_date = 2026-11-01)]», and the Spark UI shows the input size of one day. The broadcast
      hint is a bonus: «cities» is small, so the join needs no shuffle of «events».

      General rule: express filters with built-in column expressions; keep UDFs for logic that has
      no built-in form, and apply them after the data is reduced.
    `,
    signals: [
      'Explains that UDFs are opaque to the optimiser',
      'Replaces the UDF with a column expression',
      'Confirms with PartitionFilters in the plan',
      'Notices the chance to broadcast the small side',
    ],
    followUps: ['The logic truly needs Python. How do you limit the cost?'],
  },
  {
    slug: 'spark-choose-engine',
    title: 'DuckDB, Spark or Trino for four workloads',
    track: 'spark',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'uber', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      Choose an engine for each workload and justify it in one or two sentences:

      1. Unit tests for 300 SQL transformations in CI.
      2. Analysts exploring the Iceberg lake and joining it with a Postgres reference table, with
         answers in seconds.
      3. A nightly 40 TB sessionisation and join job that runs 4 hours.
      4. A daily 3 GB partner file that needs cleaning and loading into one table.
    `,
    hints: ['Size, latency, failure handling.', 'Who runs it, and how often?'],
    answer: `
      1. **DuckDB.** In-process, starts in milliseconds, runs SQL on small fixture files, no
         cluster to manage in CI.
      2. **Trino.** Always-on MPP SQL with low latency and connectors to both Iceberg and Postgres,
         so analysts join them in one query.
      3. **Spark.** Long, heavy, shuffle-bound work that must survive a lost executor; Spark retries
         tasks and stages instead of restarting four hours of work.
      4. **DuckDB or Polars in a container** (or the warehouse's own loader). 3 GB fits on one
         machine; a cluster adds start-up time and cost for no gain.

      The engines share the same Iceberg tables and catalog, so this is a toolbox, not a migration.
    `,
    signals: [
      'Matches engine to data size and latency',
      'Mentions failure handling for long jobs',
      'Uses Trino federation for cross-source SQL',
      'Avoids a cluster for small data',
      'Notes the engines share one catalog',
    ],
    followUps: ['The 40 TB job must now run hourly. Does the choice change?'],
  },
  ...pysparkProblems,
];
