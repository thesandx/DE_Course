import type { Company, Lesson, Problem } from '@/types/course';

/**
 * The hands-on half of the Spark track: PySpark for a live coding round, and
 * the internals that Flipkart, Walmart and Microsoft rounds go into. The
 * lessons and problems join the Spark track in `spark.ts`.
 *
 * Every snippet here ran on Spark 4.0 in local mode.
 */

export const pysparkLessons: readonly Lesson[] = [
  {
    slug: 'pyspark-live-coding',
    title: 'PySpark for the live coding round',
    summary:
      'Write the DataFrame code that live rounds ask for, from memory: joins, aggregates, windows and null handling.',
    minutes: 16,
    body: `
      Flipkart, Walmart, Swiggy and Microsoft rounds often say "share your screen and write
      it in PySpark". The questions are SQL questions, and the test is whether you know the
      DataFrame API without documentation. This lesson is the part to know by heart.

      ## The imports and the shape

      ~~~python
      from pyspark.sql import SparkSession, Window, functions as F

      spark = SparkSession.builder.appName("round").getOrCreate()

      result = (orders
                .filter(F.col("status") == "DELIVERED")
                .withColumn("order_date", F.to_date("ordered_at"))
                .groupBy("city", "order_date")
                .agg(F.count("*").alias("orders"),
                     F.sum("amount").alias("revenue"),
                     F.countDistinct("customer_id").alias("customers")))
      ~~~

      Write one transformation on each line, inside one pair of brackets. It reads like a SQL
      query from top to bottom, and you can comment out one line to debug.

      ## Joins

      | Join type | Keeps | Use for |
      |---|---|---|
      | «inner» | Matching rows | The default |
      | «left» | All left rows | Enrich without losing rows |
      | «left_semi» | Left rows that have a match, left columns only | "Customers who ordered" |
      | «left_anti» | Left rows with no match | "Customers who never ordered", missing rows |
      | «full» | Everything | Reconcile two tables |

      ~~~python
      never_ordered = customers.join(orders, "customer_id", "left_anti")

      enriched = (orders.alias("o")
                  .join(F.broadcast(customers.alias("c")), "customer_id", "left")
                  .select("o.order_id", "c.segment", "o.amount"))
      ~~~

      Join on a **column name** and Spark keeps one copy of the key. Join on an expression
      such as «o.customer_id == c.customer_id» and both copies stay, so the next «select» fails
      with an "ambiguous reference" error. Use aliases when two tables share other column names.

      ## Windows

      ~~~python
      by_customer = Window.partitionBy("customer_id").orderBy("ordered_at")

      ranked = (orders
                .withColumn("order_number", F.row_number().over(by_customer))
                .withColumn("previous_amount", F.lag("amount").over(by_customer))
                .withColumn("running_total", F.sum("amount").over(
                    by_customer.rowsBetween(Window.unboundedPreceding, Window.currentRow))))
      ~~~

      - «row_number» gives 1, 2, 3. «rank» leaves gaps after ties. «dense_rank» does not.
      - «lag» and «lead» read the row before or after.
      - «rowsBetween» counts rows. «rangeBetween» counts **values** of the order column, which
        is what "the last 7 days" needs.

      ## Nulls and conditions

      ~~~python
      cleaned = (orders
                 .withColumn("amount", F.coalesce("amount", F.lit(0)))
                 .withColumn("size", F.when(F.col("amount") >= 1000, "large")
                                      .when(F.col("amount") >= 200, "medium")
                                      .otherwise("small"))
                 .dropDuplicates(["order_id"]))
      ~~~

      «==» with a null gives null, and a filter drops the row. Use «eqNullSafe» to compare
      two columns that may both be null. «dropDuplicates» keeps an arbitrary row for each key;
      when you need the latest one, use «row_number» with an order.

      ## SQL is allowed

      ~~~python
      orders.createOrReplaceTempView("orders")
      top_cities = spark.sql("""
          SELECT city, SUM(amount) AS revenue
          FROM orders
          GROUP BY city
          ORDER BY revenue DESC
          LIMIT 3
      """)
      ~~~

      Both forms compile to the same plan. Ask the interviewer which one they prefer. Most
      want the DataFrame API, because it shows you can write a pipeline.

      > [!senior] What a senior answer adds
      > Say what the cluster does as you type: "This groupBy is a shuffle. The join after it
      > is a broadcast, because the customer table is small." Then name the check you would
      > run: a row count before and after the join, to catch a fan-out.

      > [!trap] Actions inside a loop
      > «count()», «collect()» and «show()» each run the whole plan again. Calling one inside
      > a Python loop over 500 dates runs 500 jobs. Group by the date in one job.
    `,
    checks: [
      {
        question: 'Which join returns the customers that have no order?',
        options: ['inner', 'left_semi', 'left_anti', 'cross'],
        answer: 2,
        why: 'left_anti keeps the left rows that find no match on the right. It is the DataFrame form of NOT EXISTS.',
      },
      {
        question:
          'You need the sum over the last 7 days for each row, and some days have no rows. Which frame?',
        options: [
          'rowsBetween(-6, 0)',
          'rangeBetween on a numeric day column',
          'unboundedPreceding to currentRow',
          'No frame',
        ],
        answer: 1,
        why: 'rowsBetween counts rows, so missing days make the window longer than 7 days. rangeBetween counts the values of the order column.',
      },
    ],
  },
  {
    slug: 'nested-data-and-json',
    title: 'Nested data: structs, arrays and JSON',
    summary:
      'Parse JSON with a schema, flatten arrays with explode, and keep the grain correct after you flatten.',
    minutes: 14,
    body: `
      Real event data is nested: an order holds an array of items, and each item is a struct.
      A reported Flipkart round hands you several nested JSON files and asks for a joined
      result. Four functions do most of the work.

      ## Read with a schema

      ~~~python
      from pyspark.sql import functions as F
      from pyspark.sql import types as T

      item = T.StructType([
          T.StructField("sku", T.StringType()),
          T.StructField("qty", T.IntegerType()),
          T.StructField("price", T.DoubleType()),
      ])
      order_schema = T.StructType([
          T.StructField("order_id", T.StringType()),
          T.StructField("customer", T.StructType([
              T.StructField("id", T.StringType()),
              T.StructField("city", T.StringType()),
          ])),
          T.StructField("items", T.ArrayType(item)),
      ])

      orders = spark.read.schema(order_schema).json(path)
      ~~~

      Without a schema, Spark reads the files twice: once to infer types and once to load.
      Inference also changes a type when one day's data looks different. In production, always
      give the schema.

      ## Structs: dot into them

      ~~~python
      flat = orders.select("order_id",
                           F.col("customer.id").alias("customer_id"),
                           F.col("customer.city").alias("city"))
      ~~~

      ## Arrays: explode makes one row for each element

      ~~~python
      lines = (orders
               .select("order_id", F.explode("items").alias("item"))
               .select("order_id", "item.sku", "item.qty",
                       (F.col("item.qty") * F.col("item.price")).alias("line_amount")))
      ~~~

      «explode» drops an order whose array is empty or null. «explode_outer» keeps it with a
      null item. «posexplode» also returns the position.

      After the explode, the **grain changed** from one row for each order to one row for each
      order line. A «count("*")» now counts lines. Count orders with «countDistinct("order_id")».

      ## A JSON string inside a column

      Kafka gives you the payload as a string. Parse it with the same kind of schema.

      ~~~python
      parsed = (raw
                .withColumn("event", F.from_json("payload", order_schema))
                .select("event.*"))
      ~~~

      A record that does not match becomes null in every field. Count those rows and send
      them to a quarantine table; do not drop them silently.

      ## Work on an array without exploding

      | Need | Function |
      |---|---|
      | Number of elements | «F.size("items")» |
      | Is a value present | «F.array_contains("tags", "gift")» |
      | Change each element | «F.transform("items", lambda i: i.qty * i.price)» |
      | Keep some elements | «F.filter("items", lambda i: i.qty > 1)» |
      | Sum the elements | «F.aggregate(...)» |
      | Back to an array | «F.collect_list("sku")» after a groupBy |

      ~~~python
      totals = orders.select(
          "order_id",
          F.aggregate(
              F.transform("items", lambda i: i.qty * i.price),
              F.lit(0.0),
              lambda acc, x: acc + x,
          ).alias("order_amount"))
      ~~~

      Higher-order functions keep one row for each order and need no shuffle. An explode
      followed by a groupBy shuffles.

      > [!senior] What a senior answer adds
      > Talk about the grain: "After the explode I have one row for each line. I aggregate
      > back to the order before I join to payments, or the payment amount repeats on every
      > line and the revenue doubles."
    `,
    checks: [
      {
        question: 'An order has an empty items array. What does explode("items") return for it?',
        options: ['One row with a null item', 'No row', 'An error', 'One row for each column'],
        answer: 1,
        why: 'explode drops rows whose array is empty or null. explode_outer keeps one row with a null element.',
      },
      {
        question: 'Why give a schema when you read JSON in production?',
        options: [
          'JSON cannot be read without one',
          'It avoids a second pass over the files and stops types from changing between runs',
          'It compresses the files',
          'It makes the output Parquet',
        ],
        answer: 1,
        why: 'Schema inference reads the data an extra time, and the inferred types depend on the sample it saw.',
      },
    ],
  },
  {
    slug: 'shuffle-internals-and-sizing',
    title: 'Inside a shuffle, and how to size a job',
    summary:
      'Explain what a shuffle writes and reads, then size partitions and executors for a 1 TB job with numbers.',
    minutes: 16,
    body: `
      "What happens in a shuffle?" is the most common Spark internals question in Indian
      product company loops, and "how would you size this job?" is the usual follow-up. A
      senior answer gives the mechanism and then the arithmetic.

      ## Jobs, stages and tasks

      - An **action** starts a **job**.
      - Spark cuts the job into **stages** at each shuffle boundary.
      - A stage runs one **task** for each partition.

      A query with a join and a groupBy has three or four stages: scan each input, join,
      aggregate. A stage that reads 800 partitions runs 800 tasks.

      ## What the shuffle does

      1. **Map side.** Each task computes the target partition of every row, by a hash of the
         key modulo the number of shuffle partitions. It sorts the rows by target partition in
         memory, and **spills** to disk when memory runs out. At the end it writes **one data
         file and one index file** to the executor's local disk.
      2. **Fetch.** Each reduce task asks every executor for the blocks of its partition, and
         pulls them over the network.
      3. **Reduce side.** The task merges the blocks. A sort-merge join sorts both sides by the
         key and walks them together. An aggregation merges the partial results.

      So a shuffle costs **serialisation, disk writes, network transfer and often a sort**.
      A narrow operation such as «filter» costs none of these.

      ~~~text
      map task 1 ──► [p0|p1|p2] file ─┐
      map task 2 ──► [p0|p1|p2] file ─┼──► reduce task p0, p1, p2
      map task 3 ──► [p0|p1|p2] file ─┘
      ~~~

      ## The settings that matter

      | Setting | Default | Meaning |
      |---|---|---|
      | «spark.sql.shuffle.partitions» | 200 | Partitions after a shuffle |
      | «spark.sql.files.maxPartitionBytes» | 128 MB | Size of an input split |
      | «spark.sql.adaptive.enabled» | true since Spark 3.2 | Adaptive query execution |
      | «spark.sql.adaptive.advisoryPartitionSizeInBytes» | 64 MB | Target size when AQE merges partitions |
      | «spark.sql.autoBroadcastJoinThreshold» | 10 MB | Largest table that is broadcast |

      With adaptive execution, Spark merges small shuffle partitions after the map stage. So
      set the partition count **high enough** and let it merge down. It cannot split a count
      that is too low, except for skewed joins.

      ## Size a 1 TB job

      Say the job joins and aggregates 1 TB of shuffle data.

      1. **Partitions.** Aim for 100 to 200 MB each. 1 TB ÷ 200 MB = about **5,000 partitions**.
         The default of 200 gives 5 GB a partition, which spills and fails.
      2. **Executor shape.** About 5 cores for each executor keeps garbage collection and disk
         throughput healthy. Give each core 4 to 8 GB: an executor of **5 cores and 32 GB**.
      3. **Executor count.** 50 executors give 250 cores. 5,000 tasks ÷ 250 = 20 waves of
         tasks for each stage. At about 1 minute a task, a stage takes about 20 minutes.
      4. **Check memory per task.** 32 GB × 0.6 unified memory ÷ 5 tasks is about 3.8 GB for a
         200 MB compressed partition. Data grows 3 to 5 times when it is deserialised, so
         this fits without a spill.
      5. **Local disk.** Shuffle files need space on each node: about 1 TB over the cluster,
         plus room for spills.

      State the assumptions and say what you would measure after the first run.

      ## Dynamic allocation

      «spark.dynamicAllocation.enabled» adds executors when tasks wait and removes idle ones.
      An executor that leaves takes its shuffle files with it, so Spark needs the **external
      shuffle service** on YARN, or **shuffle tracking** on Kubernetes, to keep them
      reachable.

      > [!senior] What a senior answer adds
      > Lead with avoiding the shuffle: filter and select early, broadcast the small side,
      > aggregate before the join, and bucket tables that are joined on the same key every
      > day. Then tune the shuffle that remains.

      > [!trap] "More partitions is always safer"
      > 100,000 tiny partitions make 100,000 tasks, and the driver spends its time scheduling
      > and tracking them. Small output files follow. Size from the data volume.
    `,
    checks: [
      {
        question: 'A stage shuffles 1 TB with the default 200 partitions. What happens?',
        options: [
          'Nothing; 200 is always right',
          'Each partition is about 5 GB, so tasks spill to disk or fail',
          'Spark refuses to start',
          'The driver runs out of memory at once',
        ],
        answer: 1,
        why: '1 TB ÷ 200 is 5 GB a partition, far above the 100 to 200 MB target. Tasks sort on disk, run slowly and can fail.',
      },
      {
        question:
          'Why does dynamic allocation need an external shuffle service or shuffle tracking?',
        options: [
          'To compress shuffle files',
          'So shuffle files stay reachable after an executor is removed',
          'To make joins broadcast',
          'To raise the partition count',
        ],
        answer: 1,
        why: 'Shuffle output lives on the local disk of the executor that wrote it. If that executor is removed, later stages still need its files.',
      },
    ],
  },
  {
    slug: 'memory-model-and-oom',
    title: 'The executor memory model and out of memory errors',
    summary:
      'Read an out of memory message, say which memory region failed, and choose the fix that matches the cause.',
    minutes: 14,
    body: `
      "How do you handle an out of memory error in Spark?" has a weak answer and a strong one.
      The weak answer is "increase executor memory". The strong answer names **which memory**
      ran out, **why**, and the cheapest fix.

      ## Where an executor's memory goes

      A container holds more than the Java heap.

      ~~~text
      container = spark.executor.memory (heap) + spark.executor.memoryOverhead

      heap
      ├── reserved               300 MB
      ├── unified memory         60% of the rest   (spark.memory.fraction)
      │   ├── execution          shuffles, sorts, joins, aggregations
      │   └── storage            cached data, broadcast variables
      └── user memory            40% of the rest   (your objects, UDF data)

      overhead                   max(384 MB, 10% of the heap)
                                 Python workers, Arrow buffers, network buffers
      ~~~

      Execution and storage borrow from each other. Execution can evict cached blocks, and
      it **spills to disk** when it still needs more. A spill is slow, not fatal.

      ## Three different errors

      | Message | What ran out | Usual cause |
      |---|---|---|
      | «java.lang.OutOfMemoryError: Java heap space» on an executor | The heap | A huge partition, a wide row, a large «collect_list», a hash table too big to spill |
      | "Container killed by YARN for exceeding memory limits", or «OOMKilled» on Kubernetes | The overhead | Python UDF workers, pandas UDF batches, off-heap buffers |
      | Out of memory on the **driver** | The driver heap | «collect()», «toPandas()», a large broadcast, too many tasks or files to track |

      ## Fix the cause, in this order

      1. **Find the big partition.** In the Spark UI, compare the maximum task input with the
         median. A 20 GB task next to 100 MB tasks is **skew**. Fix the skew; more memory
         does not help.
      2. **Raise the partition count.** Smaller partitions need less memory for each task.
      3. **Lower the cores for each executor.** Fewer tasks share the same heap.
      4. **Check the driver's work.** Replace «collect()» with a write. Lower the broadcast
         threshold if a table is larger than its statistics say.
      5. **For container kills, raise the overhead**, not the heap, and shrink the pandas
         batch size with «spark.sql.execution.arrow.maxRecordsPerBatch».
      6. **Only then add memory.**

      ## Memory for each task

      A quick estimate tells you whether a setup can work:

      ~~~text
      memory per task ≈ (heap − 300 MB) × 0.6 ÷ cores per executor

      16 GB heap, 4 cores  →  about 2.4 GB for each task
      16 GB heap, 8 cores  →  about 1.2 GB for each task
      ~~~

      A 1 GB Parquet partition can be 3 to 5 GB as Java objects. This is why partition size is
      the first control.

      ## Caching and memory

      Cached data lives in storage memory. «MEMORY_AND_DISK» is the default for DataFrames,
      so blocks that do not fit go to disk. A cache that fills memory makes every later stage
      spill. Unpersist when you are done.

      > [!senior] What a senior answer adds
      > Describe the evidence you collect before you change a setting: the exact message, the
      > stage, the task with the largest input, its spill and its garbage collection time.
      > "I change one thing and run again" beats a list of flags.

      > [!trap] The same job passes on retry
      > A task that fails and then passes on another executor still shows a problem, often a
      > skewed key or memory pressure from a neighbour task. Speculation and retries hide it
      > until the data grows.
    `,
    checks: [
      {
        question:
          'An executor is "killed by YARN for exceeding memory limits" in a job with a pandas UDF. What do you raise first?',
        options: [
          'spark.executor.memory',
          'spark.executor.memoryOverhead',
          'spark.driver.memory',
          'spark.sql.shuffle.partitions',
        ],
        answer: 1,
        why: 'Python workers and Arrow buffers live outside the Java heap, in the overhead part of the container. A bigger heap does not give them room.',
      },
      {
        question: 'One task reads 20 GB and the median task reads 100 MB. What is the real fix?',
        options: [
          'Double the executor memory',
          'Fix the skew: salt the key, split the hot key, or let AQE split the partition',
          'Cache the DataFrame',
          'Add more driver memory',
        ],
        answer: 1,
        why: 'The data is skewed. More memory postpones the failure until the hot key grows again.',
      },
    ],
  },
  {
    slug: 'reading-the-spark-ui',
    title: 'Debug a slow job from the Spark UI',
    summary:
      'Walk the Spark UI in a fixed order and tell skew, spill, small files and a bad join apart from the numbers.',
    minutes: 13,
    body: `
      Interviewers ask "a job that took 20 minutes now takes 3 hours; what do you do?" to see
      whether you have operated Spark. The answer is a walk through the **Spark UI** in a
      fixed order, with a named symptom at each stop.

      ## The order of the walk

      1. **Jobs tab.** Which job is slow? Did the number of jobs change? Hundreds of small
         jobs mean an action inside a loop.
      2. **Stages tab.** Sort by duration. One stage usually holds most of the time.
      3. **Stage detail.** Read the **summary metrics** table: minimum, median and maximum
         for duration, input size, shuffle read, spill and garbage collection time.
      4. **SQL tab.** Open the query plan. Read the join types and the row counts on each node.
      5. **Executors tab.** Failed tasks, lost executors and garbage collection for each one.

      ## Symptoms and causes

      | What you see | Cause | Fix |
      |---|---|---|
      | Max task time is 50 times the median, and so is its shuffle read | **Skew** | Salting, AQE skew join, split the hot key |
      | Every task has "spill (disk)" | Partitions too large | More shuffle partitions |
      | 50,000 tasks of 100 ms each | **Small files** or too many partitions | Compact the input, lower the partition count |
      | Garbage collection time above 10% of task time | Memory pressure | Smaller partitions, fewer cores for each executor |
      | A «BroadcastNestedLoopJoin» or «CartesianProduct» node | A join with no equality condition | Fix the join condition |
      | A «SortMergeJoin» where one side is small | Missing or stale statistics | Broadcast hint, refresh statistics |
      | Scan reads all partitions | No partition pruning | Filter on the raw partition column |
      | Rows grow a lot after a join | Duplicate keys, a **fan-out** | Deduplicate or aggregate before the join |
      | Executors lost, tasks retried | Memory kills or spot node loss | See the memory lesson; check the cluster events |

      ## Read the plan

      «df.explain("formatted")» prints the physical plan. Read it from the bottom up.

      - «Exchange» is a shuffle. Count them.
      - «PartitionFilters» and «PushedFilters» on a scan show what the reader skips. An empty
        list on a large table is a finding.
      - «BroadcastHashJoin» against «SortMergeJoin» shows the join strategy Spark chose.
      - «AdaptiveSparkPlan isFinalPlan=true» means you see the plan after runtime changes.

      ## What changed?

      A job that was fast last week did not get slow on its own. Check, in order:

      - **Data volume.** Compare the input size and row count with the last good run.
      - **Data shape.** A new hot key, a burst of nulls in the join key, or many more small files.
      - **Code and configuration.** A new UDF, a changed join, a library or runtime upgrade.
      - **Cluster.** Fewer nodes, a noisy neighbour, slower disks, lost spot instances.

      > [!senior] What a senior answer adds
      > End with prevention: record the input size, the shuffle size and the duration of every
      > run, and alert on the trend. Add a row-count check after the join. Then the next
      > regression is found by a monitor, not by a late report.

      > [!example] Null keys
      > A join key that is null in 30 percent of rows sends all those rows to one partition.
      > They can never match. Filter them out before the join and union them back after it.
    `,
    checks: [
      {
        question:
          'A stage has 60,000 tasks and each one runs for about 100 ms. What is the likely cause?',
        options: [
          'Data skew',
          'Too many small files or partitions',
          'A broadcast that is too large',
          'Driver out of memory',
        ],
        answer: 1,
        why: 'Task start-up cost dominates when each task has almost no data. Compact the files or lower the partition count.',
      },
      {
        question: 'In a physical plan, what does an Exchange node mean?',
        options: ['A cache', 'A shuffle', 'A file scan', 'A broadcast variable'],
        answer: 1,
        why: 'Exchange moves rows between partitions, which is a shuffle. The number of Exchange nodes is the number of shuffles in the query.',
      },
    ],
  },
];

/** The loops that ask for PySpark or Spark internals. */
const SPARK_LOOPS: readonly Company[] = [
  'uber',
  'microsoft',
  'flipkart',
  'walmart',
  'phonepe',
  'swiggy',
];

export const pysparkProblems: readonly Problem[] = [
  {
    slug: 'spark-nested-orders-revenue',
    title: 'Revenue by category from nested order files',
    track: 'spark',
    kind: 'coding',
    difficulty: 'hard',
    companies: SPARK_LOOPS,
    prompt: `
      You get two DataFrames read from JSON files.

      - «orders(order_id, ordered_at, customer struct<id, city>, items array<struct<sku, qty, price>>)»
      - «products(sku, category)»

      Write PySpark that returns the revenue and the number of distinct orders for each
      category and order date. Then say how you make sure that the numbers are right.
    `,
    hints: [
      'The items array must become one row for each item.',
      'After the explode, what does a row mean? What does count(*) count now?',
      'Some SKUs may be missing from the products table. Which join keeps their revenue?',
    ],
    answer: `
      Explode the items, compute the line amount, join the small product table, then aggregate.

      ~~~python
      from pyspark.sql import functions as F

      lines = (orders
               .withColumn("order_date", F.to_date("ordered_at"))
               .select("order_id", "order_date", F.explode("items").alias("item"))
               .select("order_id", "order_date", "item.sku",
                       (F.col("item.qty") * F.col("item.price")).alias("line_amount")))

      revenue = (lines
                 .join(F.broadcast(products), "sku", "left")
                 .withColumn("category", F.coalesce("category", F.lit("UNKNOWN")))
                 .groupBy("category", "order_date")
                 .agg(F.round(F.sum("line_amount"), 2).alias("revenue"),
                      F.countDistinct("order_id").alias("orders")))
      ~~~

      Why each choice:

      - After the explode the grain is **one row for each order line**, so orders are counted
        with «countDistinct».
      - A **left** join keeps the revenue of a SKU that has no product row, under «UNKNOWN».
        An inner join loses it without a warning.
      - The product table is small, so a **broadcast** join avoids a shuffle of the lines.

      To check the result: the total revenue over all categories must equal the sum of
      «qty × price» over the raw items. Also check that «products» has one row for each
      «sku»; a duplicate SKU doubles its revenue.
    `,
    signals: [
      'States the grain after the explode',
      'Uses countDistinct for orders, not count',
      'Chooses a left join and labels the unmatched SKUs',
      'Broadcasts the small table and says why',
      'Proposes a reconciliation check on the total',
    ],
    followUps: [
      'The products table has two rows for one SKU. What happens, and how do you guard against it?',
      'Orders with an empty items array must appear with revenue 0. What changes?',
    ],
  },
  {
    slug: 'spark-top-n-per-group',
    title: 'Top 3 products in each category',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: SPARK_LOOPS,
    prompt: `
      «sales(category, sku, amount)» has one row for each sale. Return the top 3 products by
      total amount in each category. Say what happens with ties, and which rank function you
      chose.
    `,
    hints: [
      'Aggregate to one row for each product first.',
      'Then rank inside each category with a window.',
      'row_number, rank and dense_rank differ only on ties.',
    ],
    answer: `
      ~~~python
      from pyspark.sql import Window, functions as F

      totals = sales.groupBy("category", "sku").agg(F.sum("amount").alias("total"))

      by_category = Window.partitionBy("category").orderBy(F.desc("total"), "sku")

      top3 = (totals
              .withColumn("position", F.row_number().over(by_category))
              .filter(F.col("position") <= 3))
      ~~~

      - «row_number» returns **exactly 3 rows** for each category. The second order column,
        «sku», makes the choice between tied products repeatable from run to run.
      - «rank» or «dense_rank» returns **every tied product**, so a category can have more
        than 3 rows. Ask which behaviour the report needs.

      Aggregate before the window. The window then sorts one row for each product, not one
      row for each sale.
    `,
    signals: [
      'Aggregates before ranking',
      'Explains row_number against rank against dense_rank on ties',
      'Adds a tie-breaker for a deterministic result',
      'Filters on the rank in a separate step',
    ],
    followUps: ['One category holds 80 percent of the rows. What happens to the window stage?'],
  },
  {
    slug: 'spark-rolling-seven-day',
    title: 'Seven-day rolling average for each restaurant',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: SPARK_LOOPS,
    prompt: `
      «daily(restaurant_id, order_date, orders)» has one row for each restaurant and day, but
      **days with no orders are missing**. Add the average daily orders over the last 7
      calendar days, including the current day.
    `,
    hints: [
      'rowsBetween(-6, 0) takes the last 7 rows. Are they the last 7 days?',
      'rangeBetween works on the values of the order column, which must be numeric.',
      'Should a missing day count as zero orders?',
    ],
    answer: `
      Days are missing, so a frame of 7 **rows** can cover several weeks. Use a **range** frame
      over the day number.

      ~~~python
      from pyspark.sql import Window, functions as F

      last_7_days = (Window.partitionBy("restaurant_id")
                     .orderBy(F.datediff("order_date", F.lit("1970-01-01")))
                     .rangeBetween(-6, 0))

      rolling = (daily
                 .withColumn("orders_7d", F.sum("orders").over(last_7_days))
                 .withColumn("avg_7d", F.round(F.col("orders_7d") / 7, 2)))
      ~~~

      Divide the 7-day sum by 7, not by the number of rows in the frame. «F.avg» over the
      frame ignores the missing days and reports a figure that is too high for a restaurant
      that was closed for part of the week.

      If the report must also show a row for the days with no orders, generate a calendar
      with «F.sequence» and «F.explode», and left join the data to it.
    `,
    signals: [
      'Spots that missing days break a rows frame',
      'Uses rangeBetween on a numeric day column',
      'Divides by 7 and explains why avg is wrong here',
      'Knows how to build a calendar when the gaps must show',
    ],
    followUps: ['The first 6 days of a new restaurant have no full week. What do you report?'],
  },
  {
    slug: 'spark-login-streaks',
    title: 'Longest run of active days for each user',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: SPARK_LOOPS,
    prompt: `
      «logins(user_id, login_at)» has one row for each login. Return the longest run of
      consecutive calendar days on which each user logged in.
    `,
    hints: [
      'A user can log in many times a day. Get one row for each user and day first.',
      'In a run of consecutive days, date minus row number is constant.',
    ],
    answer: `
      Reduce to distinct days, then use the gaps and islands method: inside a run of
      consecutive days, the date minus the row number is the same value.

      ~~~python
      from pyspark.sql import Window, functions as F

      days = logins.select("user_id", F.to_date("login_at").alias("day")).distinct()

      by_user = Window.partitionBy("user_id").orderBy("day")

      streaks = (days
                 .withColumn("island", F.date_sub("day", F.row_number().over(by_user)))
                 .groupBy("user_id", "island")
                 .agg(F.count("*").alias("streak")))

      longest = streaks.groupBy("user_id").agg(F.max("streak").alias("longest_streak"))
      ~~~

      The «distinct» matters: two logins on one day would give two row numbers for one date
      and break the run. Also agree on the time zone before «to_date»; a login at 23:30 UTC
      is the next day in India.
    `,
    signals: [
      'Deduplicates to one row for each user and day',
      'Uses the date minus row_number island key',
      'Raises the time zone of the day boundary',
    ],
    followUps: ['Return the start and end date of the longest run too.'],
  },
  {
    slug: 'spark-reconcile-two-tables',
    title: 'Reconcile a source table with its copy',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: SPARK_LOOPS,
    prompt: `
      «source(txn_id, amount, status)» and «target(txn_id, amount, status)» should hold the
      same rows after a migration. Write PySpark that labels every difference as
      «MISSING_IN_TARGET», «MISSING_IN_SOURCE» or «MISMATCH». Values can be null.
    `,
    hints: [
      'Which join keeps rows from both sides?',
      'null == null is null, not true. How do you compare two nullable columns?',
    ],
    answer: `
      Use a full outer join on the key, and compare the columns with a null-safe equality.

      ~~~python
      from pyspark.sql import functions as F

      s, t = source.alias("s"), target.alias("t")

      same = (F.col("s.amount").eqNullSafe(F.col("t.amount"))
              & F.col("s.status").eqNullSafe(F.col("t.status")))

      diff = (s.join(t, F.col("s.txn_id") == F.col("t.txn_id"), "full")
              .withColumn("issue",
                          F.when(F.col("t.txn_id").isNull(), "MISSING_IN_TARGET")
                           .when(F.col("s.txn_id").isNull(), "MISSING_IN_SOURCE")
                           .when(~same, "MISMATCH"))
              .filter(F.col("issue").isNotNull())
              .select(F.coalesce("s.txn_id", "t.txn_id").alias("txn_id"), "issue",
                      F.col("s.amount").alias("source_amount"),
                      F.col("t.amount").alias("target_amount")))
      ~~~

      With plain «==», a row that has a null status on both sides compares as null and is
      reported wrongly or dropped. «eqNullSafe» treats two nulls as equal.

      Before the join, check that «txn_id» is unique on each side. A duplicate key multiplies
      rows and hides real differences. For very large tables, first compare a count and a
      checksum for each partition, and run this join only on the partitions that differ.
    `,
    signals: [
      'Uses a full outer join',
      'Compares with eqNullSafe and explains the null trap',
      'Checks key uniqueness before the join',
      'Proposes partition-level checksums to limit the work',
    ],
    followUps: ['The amounts are doubles and differ by 0.0000001. How do you compare them?'],
  },
  {
    slug: 'spark-pivot-status-counts',
    title: 'Pivot order counts by status',
    track: 'spark',
    kind: 'coding',
    difficulty: 'easy',
    companies: SPARK_LOOPS,
    prompt: `
      «orders(order_date, status)» has one row for each order. Return one row for each date
      with a column for each of «PLACED», «DELIVERED» and «CANCELLED» that holds the count.
      Why should you pass the list of values to «pivot»?
    `,
    hints: [
      'groupBy, then pivot, then an aggregate.',
      'Without the list, how does Spark learn the column names?',
    ],
    answer: `
      ~~~python
      statuses = ["PLACED", "DELIVERED", "CANCELLED"]

      by_status = (orders
                   .groupBy("order_date")
                   .pivot("status", statuses)
                   .count()
                   .na.fill(0, statuses))
      ~~~

      Pass the list for three reasons:

      1. Without it, Spark runs an **extra job** to find the distinct values.
      2. The output **schema is fixed**. A new status in the data does not add a column and
         break the table downstream.
      3. A date with no cancelled order still gets the column, filled with 0 by «na.fill».

      «F.count("*")» is not allowed inside a pivot; use «.count()» or count a column.

      The same result without «pivot» is a conditional aggregate:
      «F.sum(F.when(F.col("status") == "PLACED", 1).otherwise(0))» for each status.
    `,
    signals: [
      'Passes the explicit value list to pivot',
      'Explains the extra job and the schema stability',
      'Fills the missing combinations with 0',
      'Knows the conditional aggregate form',
    ],
    followUps: ['A new status, RETURNED, starts to appear. How should the pipeline react?'],
  },
  {
    slug: 'spark-status-changes',
    title: 'Keep only the rows where the status changed',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: SPARK_LOOPS,
    prompt: `
      A device sends «heartbeats(device_id, event_at, status)» every minute, and the status is
      nearly always the same as before. Return only the rows where the status differs from the
      previous row of the same device. Keep the first row of each device.
    `,
    hints: [
      'Read the previous status with lag.',
      'What is the previous status of the first row? How should the comparison treat it?',
    ],
    answer: `
      ~~~python
      from pyspark.sql import Window, functions as F

      by_device = Window.partitionBy("device_id").orderBy("event_at")

      changes = (heartbeats
                 .withColumn("previous", F.lag("status").over(by_device))
                 .filter(~F.col("status").eqNullSafe(F.col("previous")))
                 .drop("previous"))
      ~~~

      The first row of a device has a null «previous». With «status != previous» the
      comparison is null and the filter drops the row. The null-safe form treats "null
      against a value" as different, so the first row stays.

      This turns a stream of 1,440 rows a day for each device into a handful of rows. Add
      «F.lead("event_at")» over the same window to the result and you have the start and end
      of each state, which is the base of a type 2 history table.
    `,
    signals: [
      'Uses lag over a window by device',
      'Handles the first row with a null-safe comparison',
      'Sees the link to state intervals and SCD type 2',
    ],
    followUps: ['Two heartbeats share the same timestamp. What can go wrong?'],
  },
  {
    slug: 'spark-replace-python-udf',
    title: 'Replace a slow Python UDF',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: SPARK_LOOPS,
    prompt: `
      A job masks emails with this UDF and takes 3 hours on 2 billion rows:

      ~~~python
      @F.udf("string")
      def mask_email(email):
          if email is None or "@" not in email:
              return None
          name, domain = email.split("@", 1)
          return name[0] + "***@" + domain.lower()
      ~~~

      Rewrite it without a UDF, and explain why the new version is faster.
    `,
    hints: [
      'Which built-in functions split a string, take a substring and change case?',
      'A regular expression can capture the first letter and the domain.',
    ],
    answer: `
      Built-in column functions do the same work inside the JVM.

      ~~~python
      from pyspark.sql import functions as F

      masked = users.withColumn(
          "email_masked",
          F.when(
              F.col("email").contains("@"),
              F.concat(
                  F.substring("email", 1, 1),
                  F.lit("***@"),
                  F.lower(F.regexp_extract("email", "@(.*)$", 1)),
              ),
          ),
      )
      ~~~

      A null email gives null, because «contains» returns null and «when» has no «otherwise».

      Why it is faster:

      - A Python UDF sends **every row** from the JVM to a Python process and back. Each row
        is serialised twice.
      - Catalyst cannot see inside a UDF. It cannot push the filter below it, and it cannot
        generate code for it.
      - The built-in version runs as generated Java code on columnar batches.

      If the logic truly needs Python, use a **pandas UDF**, which moves data in Arrow
      batches. Expect built-ins to be several times faster than a row UDF; measure on a
      sample before you promise a number.
    `,
    signals: [
      'Rewrites with built-in functions and keeps the null behaviour',
      'Explains serialisation between the JVM and Python',
      'Explains that the optimiser cannot see into a UDF',
      'Offers a pandas UDF as the fallback',
    ],
    followUps: ['The email column is used in a filter after the mask. What does the UDF prevent?'],
  },
  {
    slug: 'spark-scd2-dataframes',
    title: 'Apply a type 2 change with DataFrames',
    track: 'spark',
    kind: 'coding',
    difficulty: 'hard',
    companies: SPARK_LOOPS,
    prompt: `
      «dim(customer_id, city, valid_from, valid_to, is_current)» is a type 2 dimension.
      «updates(customer_id, city, updated_at)» has at most one row for each customer. Write
      PySpark that returns the new dimension: close the current row of a customer whose city
      changed, add the new version, add new customers, and leave everything else alone.
    `,
    hints: [
      'Find the updates that are a real change, or a new customer.',
      'The result is four sets: history, unchanged current rows, closed rows and new rows.',
      'A left anti join gives the current rows that have no change.',
    ],
    answer: `
      Build the result from four sets and union them.

      ~~~python
      from pyspark.sql import functions as F

      current = dim.filter(F.col("is_current"))
      history = dim.filter(~F.col("is_current"))

      changed = (updates.alias("u")
                 .join(current.alias("d"), "customer_id", "left")
                 .filter(F.col("d.valid_from").isNull()
                         | ~F.col("u.city").eqNullSafe(F.col("d.city")))
                 .select("customer_id", F.col("u.city").alias("city"), "updated_at"))

      closed = (current
                .join(changed.select("customer_id", "updated_at"), "customer_id")
                .withColumn("valid_to", F.col("updated_at"))
                .withColumn("is_current", F.lit(False))
                .drop("updated_at"))

      unchanged = current.join(changed, "customer_id", "left_anti")

      added = changed.select(
          "customer_id", "city",
          F.col("updated_at").alias("valid_from"),
          F.lit(None).cast("timestamp").alias("valid_to"),
          F.lit(True).alias("is_current"))

      new_dim = (history.unionByName(unchanged)
                 .unionByName(closed)
                 .unionByName(added))
      ~~~

      - An update with the **same city** is not a change, so it creates no row.
      - A new customer has no current row. It passes the «isNull» test, joins to nothing in
        «closed», and appears once in «added».
      - «unionByName» matches columns by name, so a different column order cannot swap values.

      Write «new_dim» to a new location and swap, or use «MERGE INTO» on Delta or Iceberg,
      which does the close and the insert in one atomic commit. Running the job twice with the
      same updates changes nothing, because the second run finds no real change.
    `,
    signals: [
      'Filters out updates that change nothing',
      'Handles new customers in the same flow',
      'Uses left_anti for the unchanged rows and unionByName for the result',
      'Explains idempotency on a rerun',
      'Names MERGE on a table format as the production path',
    ],
    followUps: [
      'The updates hold three changes for one customer in one batch. What must you do first?',
      'An update arrives late, with an updated_at before the current valid_from. What now?',
    ],
  },
  {
    slug: 'spark-idempotent-partition-load',
    title: 'Make a daily load safe to rerun',
    track: 'spark',
    kind: 'coding',
    difficulty: 'medium',
    companies: SPARK_LOOPS,
    prompt: `
      A job appends each day's events to a Parquet table that is partitioned by «event_date».
      When the job is retried, the day is loaded twice. Change the write so that a rerun for
      the same day gives the same table. Late events for earlier days can be in the batch.
    `,
    hints: [
      'Append adds rows each time. Which mode replaces?',
      'Plain overwrite replaces the whole table. Which setting limits it to the partitions in the batch?',
    ],
    answer: `
      Overwrite only the partitions that the batch contains.

      ~~~python
      spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")

      (batch
       .repartition("event_date")
       .write
       .mode("overwrite")
       .partitionBy("event_date")
       .parquet(table_path))
      ~~~

      With the default «static» mode, «overwrite» deletes **every** partition of the table.
      With «dynamic», Spark replaces only the dates present in «batch».

      One rule makes this correct: the batch must hold **all** rows of each date it touches.
      So when late events arrive for an earlier day, read that whole day from the source again
      and rewrite its partition; do not write only the late rows.

      «repartition("event_date")» puts each date in one task, so each partition gets one file
      and not one file from each task.

      On Delta, Iceberg or Hudi, prefer «MERGE» on the event key, or «replaceWhere» on the
      date range. Those commits are atomic; a plain Parquet overwrite is not, and a reader can
      see a half-written partition.
    `,
    signals: [
      'Replaces append with partition-level overwrite',
      'Knows the dynamic partition overwrite setting and the static default',
      'States the "whole partition" rule for late data',
      'Controls the file count with repartition',
      'Notes that table formats make the swap atomic',
    ],
    followUps: ['Two runs for the same date overlap in time. What can a reader see?'],
  },
  {
    slug: 'spark-size-one-tb-job',
    title: 'Size a job for 1 TB a day in a 2 hour window',
    track: 'spark',
    kind: 'concept',
    difficulty: 'hard',
    companies: SPARK_LOOPS,
    prompt: `
      A daily job reads 1 TB of compressed Parquet, joins it to a 30 GB table and to a 50 MB
      table, aggregates, and writes Parquet. It must finish in 2 hours. Propose the partition
      count, the executor shape and the executor count. Show the arithmetic and say what you
      would check after the first run.
    `,
    hints: [
      'Start from the shuffle partition size you want.',
      'How many tasks is that, and how many run at once?',
      'Which of the two joins should be a broadcast?',
    ],
    answer: `
      **Plan the joins first.** The 50 MB table is a broadcast join, so it adds no shuffle. I
      raise «autoBroadcastJoinThreshold» above 50 MB or add a hint. The 30 GB table needs a
      sort-merge join: one shuffle of both sides. The aggregation is a second shuffle, unless
      it groups by the join key.

      **Partitions.** I select only the columns I need, which may cut the 1 TB by half. I
      assume about 600 GB is shuffled. At 150 MB for each partition that is
      600,000 MB ÷ 150 MB = **4,000 shuffle partitions**. Adaptive execution merges the small
      ones.

      **Executor shape.** 5 cores and 32 GB of heap, plus about 4 GB of overhead. Memory for
      each task is about (32 − 0.3) × 0.6 ÷ 5 = **3.8 GB**, which holds a 150 MB compressed
      partition after it grows 4 to 5 times in memory.

      **Executor count.** The scan has about 1 TB ÷ 128 MB = 8,000 tasks, and each shuffle
      stage has 4,000. That is about 16,000 tasks. At about 1 minute for each task, I need
      16,000 task-minutes. With **40 executors**, 200 cores do that in 80 minutes, which
      leaves margin inside the 2 hours. I enable dynamic allocation between 10 and 60
      executors.

      **Output.** I write files of about 256 MB to 1 GB. I repartition by the table's
      partition column before the write, so the job does not create thousands of small files.

      **After the first run** I check: the median and maximum task time of each stage, for
      skew; the spill, for partitions that are too large; the garbage collection share; and the
      real shuffle size against my 600 GB guess. Then I change one setting at a time.
    `,
    signals: [
      'Plans the join strategies before the sizing',
      'Derives the partition count from a target partition size',
      'Checks memory for each task against the partition size',
      'Estimates the run time from tasks and cores',
      'Lists what to measure after the first run',
    ],
    followUps: [
      'The volume doubles on a sale day. What changes without a new deployment?',
      'The cluster uses spot nodes. What does a lost node cost this job?',
    ],
  },
  {
    slug: 'spark-executor-oom-triage',
    title: 'Executors keep dying with memory errors',
    track: 'spark',
    kind: 'concept',
    difficulty: 'medium',
    companies: SPARK_LOOPS,
    prompt: `
      A PySpark job fails in a stage that does a groupBy with «collect_list» and then a pandas
      UDF. The log shows "Container killed by YARN for exceeding memory limits. 18.2 GB of 18
      GB physical memory used." A colleague wants to double «spark.executor.memory». What do
      you do?
    `,
    hints: [
      'Is this the Java heap, or the container?',
      'Where does a pandas UDF hold its data?',
      'What does collect_list do with a hot key?',
    ],
    answer: `
      The message says the **container** passed its limit. That is the heap plus the
      **overhead**, and Python memory lives in the overhead. A bigger heap alone does not give
      the Python worker more room.

      I look for the cause before I change a setting:

      1. **Skew in «collect_list».** I check the stage's task metrics. If one task reads far
         more than the median, one key has a huge list. That list is one row, and the whole
         row goes to the pandas UDF as one batch.
      2. **Arrow batch size.** A pandas UDF receives batches of 10,000 rows by default. With
         wide rows that is too much; I lower «spark.sql.execution.arrow.maxRecordsPerBatch».
      3. **Cores for each executor.** Each core runs its own Python worker. Five workers share
         the same overhead.

      Fixes, cheapest first:

      - Replace «collect_list» plus a UDF with built-in aggregates, or with a grouped
        «applyInPandas», if the logic allows it. Cap the list for the hot keys, or process
        them in a separate path.
      - Raise «spark.executor.memoryOverhead», for example from 10 percent to 4 GB, and lower
        the cores for each executor.
      - Raise the shuffle partition count so that each task holds fewer groups.

      Doubling the heap also raises the default overhead, so it can seem to work. It doubles
      the cost and fails again when the hot key grows.
    `,
    signals: [
      'Reads the message as a container limit, not a heap error',
      'Places Python and Arrow memory in the overhead',
      'Checks for a hot key behind collect_list',
      'Orders the fixes by cost',
      'Explains why doubling the heap is the wrong first step',
    ],
    followUps: ['The same error appears on Kubernetes. What does it look like there?'],
  },
];
