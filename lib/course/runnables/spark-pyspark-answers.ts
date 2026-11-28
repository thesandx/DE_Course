import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/**
 * Other answers for the Spark track's PySpark problems. See `test-answers.ts`.
 * A pass answer is a different correct way: the tests must accept it. A fail
 * answer is a usual mistake: a hidden or visible test must catch it.
 */
export const SPARK_PYSPARK_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'spark-sessionize-events': {
    pass: [
      // A range frame and a separator other than "-".
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("user_id").orderBy("ts")
result = (events
          .withColumn("prev", F.lag("ts").over(w))
          .withColumn("starts", (F.col("prev").isNull()
                                 | (F.unix_timestamp("ts") - F.unix_timestamp("prev") > 30 * 60)).cast("int"))
          .withColumn("n", F.sum("starts").over(w))
          .select("user_id", "ts", F.concat_ws("#", "user_id", F.col("n").cast("string")).alias("session_id")))
`,
      // The id is the user and the start of the session.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("user_id").orderBy("ts")
gap = F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")
result = (events
          .withColumn("start", F.when(gap.isNull() | (gap > 1800), F.col("ts")))
          .withColumn("start", F.last("start", ignorenulls=True).over(
              w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
          .select("user_id", "ts",
                  F.concat_ws("@", "user_id", F.date_format("start", "yyyy-MM-dd HH:mm:ss")).alias("session_id")))
`,
      // A number that is unique across users.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("user_id").orderBy("ts")
gap = F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")
numbered = (events
            .withColumn("flag", F.when(gap.isNull() | (gap > 1800), 1).otherwise(0))
            .withColumn("n", F.sum("flag").over(w.rowsBetween(Window.unboundedPreceding, 0))))
result = (numbered
          .withColumn("session_id", F.dense_rank().over(Window.orderBy("user_id", "n")))
          .select("user_id", "ts", "session_id"))
`,
    ],
    fail: [
      // No separator: u1 with session 12 and u11 with session 2 both give u112.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("user_id").orderBy("ts")
gap_s = F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")
result = (events
          .withColumn("new_session", F.when(gap_s.isNull() | (gap_s > 1800), 1).otherwise(0))
          .withColumn("session_no", F.sum("new_session").over(
              w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
          .withColumn("session_id", F.concat("user_id", F.col("session_no").cast("string")))
          .drop("new_session", "session_no"))
`,
      // A gap of exactly 30 minutes ends the session.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("user_id").orderBy("ts")
gap_s = F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")
result = (events
          .withColumn("new_session", F.when(gap_s.isNull() | (gap_s >= 1800), 1).otherwise(0))
          .withColumn("session_no", F.sum("new_session").over(
              w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
          .withColumn("session_id", F.concat_ws("-", "user_id", "session_no"))
          .drop("new_session", "session_no"))
`,
      // The session number alone is not unique across users.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("user_id").orderBy("ts")
gap_s = F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")
result = (events
          .withColumn("new_session", F.when(gap_s.isNull() | (gap_s > 1800), 1).otherwise(0))
          .withColumn("session_id", F.sum("new_session").over(
              w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
          .drop("new_session"))
`,
      // Whole minutes: a gap of 30 minutes and 1 second becomes 30.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("user_id").orderBy("ts")
gap_min = ((F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")) / 60).cast("int")
result = (events
          .withColumn("new_session", F.when(gap_min.isNull() | (gap_min > 30), 1).otherwise(0))
          .withColumn("session_no", F.sum("new_session").over(
              w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
          .withColumn("session_id", F.concat_ws("-", "user_id", "session_no"))
          .drop("new_session", "session_no"))
`,
      // lag without partitionBy compares events of different users.
      `from pyspark.sql import Window, functions as F

w = Window.orderBy("ts")
gap_s = F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")
result = (events
          .withColumn("new_session", F.when(gap_s.isNull() | (gap_s > 1800), 1).otherwise(0))
          .withColumn("session_no", F.sum("new_session").over(
              w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
          .withColumn("session_id", F.concat_ws("-", "user_id", "session_no"))
          .drop("new_session", "session_no"))
`,
    ],
  },

  'spark-udf-blocks-pruning': {
    pass: [
      `daily = spark.table("lake.events").where("event_date = '2026-11-01'").join(cities, "city_id")
`,
      // Join first, filter after: the filter still reaches the scan.
      `from pyspark.sql import functions as F

daily = (spark.table("lake.events")
         .join(cities, "city_id")
         .filter(F.col("event_date") == F.lit("2026-11-01")))
`,
      `from pyspark.sql import functions as F

daily = (spark.table("lake.events")
         .filter(F.col("event_date").isin(["2026-11-01"]))
         .join(F.broadcast(cities), "city_id")
         .select("event_id", "city_id", "amount", "event_date", "city"))
`,
    ],
    fail: [
      // The starter: the UDF hides the filter from Catalyst.
      `from pyspark.sql import functions as F
from pyspark.sql.types import BooleanType


@F.udf(returnType=BooleanType())
def is_target_day(d):
    return d == "2026-11-01"


daily = spark.table("lake.events").filter(is_target_day("event_date")).join(cities, "city_id")
`,
      // The UDF moved into a column: still no partition filter.
      `from pyspark.sql import functions as F
from pyspark.sql.types import BooleanType

is_target_day = F.udf(lambda d: d == "2026-11-01", BooleanType())
daily = (spark.table("lake.events")
         .withColumn("keep", is_target_day("event_date"))
         .filter("keep")
         .drop("keep")
         .join(cities, "city_id"))
`,
      // The UDF after the join.
      `from pyspark.sql import functions as F
from pyspark.sql.types import BooleanType

is_target_day = F.udf(lambda d: d == "2026-11-01", BooleanType())
daily = spark.table("lake.events").join(cities, "city_id").filter(is_target_day("event_date"))
`,
    ],
  },

  'spark-nested-orders-revenue': {
    pass: [
      `from pyspark.sql import functions as F

items = (orders
         .select("order_id", F.to_date("ordered_at").alias("order_date"), F.explode("items").alias("item"))
         .select("order_id", "order_date", "item.*"))
result = (items.join(products, "sku", "left")
          .na.fill({"category": "UNKNOWN"})
          .groupBy("category", "order_date")
          .agg(F.round(F.sum(F.col("qty") * F.col("price")), 2).alias("revenue"),
               F.countDistinct("order_id").alias("orders")))
`,
      // Spark SQL with LATERAL VIEW.
      `orders.createOrReplaceTempView("orders_v")
products.createOrReplaceTempView("products_v")
result = spark.sql("""
    SELECT COALESCE(p.category, 'UNKNOWN') AS category,
           to_date(o.ordered_at) AS order_date,
           ROUND(SUM(item.qty * item.price), 2) AS revenue,
           COUNT(DISTINCT o.order_id) AS orders
    FROM orders_v o
    LATERAL VIEW explode(o.items) t AS item
    LEFT JOIN products_v p ON p.sku = item.sku
    GROUP BY COALESCE(p.category, 'UNKNOWN'), to_date(o.ordered_at)
""")
`,
    ],
    fail: [
      // An inner join drops TOY-CAR, which has no product row.
      `from pyspark.sql import functions as F

lines = orders.select("order_id", F.to_date("ordered_at").alias("order_date"), F.explode("items").alias("item"))
result = (lines.select("order_id", "order_date", "item.sku", (F.col("item.qty") * F.col("item.price")).alias("amount"))
          .join(products, "sku")
          .groupBy("category", "order_date")
          .agg(F.round(F.sum("amount"), 2).alias("revenue"), F.countDistinct("order_id").alias("orders")))
`,
      // count counts lines, not orders: o-1 has two grocery lines.
      `from pyspark.sql import functions as F

lines = orders.select("order_id", F.to_date("ordered_at").alias("order_date"), F.explode("items").alias("item"))
result = (lines.select("order_id", "order_date", "item.sku", (F.col("item.qty") * F.col("item.price")).alias("amount"))
          .join(products, "sku", "left")
          .withColumn("category", F.coalesce("category", F.lit("UNKNOWN")))
          .groupBy("category", "order_date")
          .agg(F.round(F.sum("amount"), 2).alias("revenue"), F.count("order_id").alias("orders")))
`,
      // UNKNOWN only when the product row is missing: a null category stays null.
      `from pyspark.sql import functions as F

lines = orders.select("order_id", F.to_date("ordered_at").alias("order_date"), F.explode("items").alias("item"))
joined = (lines.select("order_id", "order_date", F.col("item.sku").alias("sku"), (F.col("item.qty") * F.col("item.price")).alias("amount"))
          .join(products.withColumnRenamed("sku", "p_sku"), F.col("sku") == F.col("p_sku"), "left"))
result = (joined
          .withColumn("category", F.when(F.col("p_sku").isNull(), "UNKNOWN").otherwise(F.col("category")))
          .groupBy("category", "order_date")
          .agg(F.round(F.sum("amount"), 2).alias("revenue"), F.countDistinct("order_id").alias("orders")))
`,
      // explode_outer keeps o-5, which has no items, as an UNKNOWN order.
      `from pyspark.sql import functions as F

lines = orders.select("order_id", F.to_date("ordered_at").alias("order_date"), F.explode_outer("items").alias("item"))
result = (lines.select("order_id", "order_date", "item.sku", (F.col("item.qty") * F.col("item.price")).alias("amount"))
          .join(products, "sku", "left")
          .withColumn("category", F.coalesce("category", F.lit("UNKNOWN")))
          .groupBy("category", "order_date")
          .agg(F.round(F.sum("amount"), 2).alias("revenue"), F.countDistinct("order_id").alias("orders")))
`,
    ],
  },

  'spark-top-n-per-group': {
    pass: [
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("category").orderBy(F.col("total").desc(), F.col("sku").asc())
result = (sales.groupBy("category", "sku").agg(F.sum("amount").alias("total"))
          .withColumn("rn", F.row_number().over(w))
          .where("rn <= 3")
          .select("category", "sku", "total"))
`,
      `sales.createOrReplaceTempView("sales_v")
result = spark.sql("""
    SELECT category, sku, total
    FROM (
        SELECT category, sku, total,
               ROW_NUMBER() OVER (PARTITION BY category ORDER BY total DESC, sku) AS rn
        FROM (SELECT category, sku, SUM(amount) AS total FROM sales_v GROUP BY category, sku) t
    ) ranked
    WHERE rn <= 3
""")
`,
    ],
    fail: [
      // rank keeps every tie: toys gets four rows.
      `from pyspark.sql import Window, functions as F

totals = sales.groupBy("category", "sku").agg(F.sum("amount").alias("total"))
w = Window.partitionBy("category").orderBy(F.desc("total"))
result = totals.withColumn("r", F.rank().over(w)).filter("r <= 3").drop("r")
`,
      // dense_rank keeps even more: three totals, five products.
      `from pyspark.sql import Window, functions as F

totals = sales.groupBy("category", "sku").agg(F.sum("amount").alias("total"))
w = Window.partitionBy("category").orderBy(F.desc("total"))
result = totals.withColumn("r", F.dense_rank().over(w)).filter("r <= 3").drop("r")
`,
      // Ranks single sales, not totals: C's two sales count apart.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("category").orderBy(F.desc("amount"), "sku")
result = (sales.withColumn("rn", F.row_number().over(w))
          .filter("rn <= 3")
          .select("category", "sku", F.col("amount").alias("total")))
`,
    ],
  },

  'spark-rolling-seven-day': {
    pass: [
      // A range in seconds over the date as a timestamp.
      `from pyspark.sql import Window, functions as F

w = (Window.partitionBy("restaurant_id")
     .orderBy(F.col("order_date").cast("timestamp").cast("long"))
     .rangeBetween(-6 * 86400, 0))
result = daily.withColumn("avg_7d", F.round(F.sum("orders").over(w) / F.lit(7), 2))
`,
      // A self-join on the 7-day range.
      `from pyspark.sql import functions as F

a, b = daily.alias("a"), daily.alias("b")
window_rows = a.join(
    b,
    (F.col("a.restaurant_id") == F.col("b.restaurant_id"))
    & F.col("b.order_date").between(F.date_sub(F.col("a.order_date"), 6), F.col("a.order_date")))
result = (window_rows
          .groupBy(F.col("a.restaurant_id").alias("restaurant_id"),
                   F.col("a.order_date").alias("order_date"),
                   F.col("a.orders").alias("orders"))
          .agg(F.round(F.sum("b.orders") / 7, 2).alias("avg_7d")))
`,
    ],
    fail: [
      // The last 7 rows, not the last 7 days: missing days break it.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("restaurant_id").orderBy("order_date").rowsBetween(-6, 0)
result = daily.withColumn("avg_7d", F.round(F.sum("orders").over(w) / 7, 2))
`,
      // avg divides by the days that have rows, not by 7.
      `from pyspark.sql import Window, functions as F

w = (Window.partitionBy("restaurant_id")
     .orderBy(F.datediff("order_date", F.lit("1970-01-01")))
     .rangeBetween(-6, 0))
result = daily.withColumn("avg_7d", F.round(F.avg("orders").over(w), 2))
`,
      // -7 to 0 is 8 days.
      `from pyspark.sql import Window, functions as F

w = (Window.partitionBy("restaurant_id")
     .orderBy(F.datediff("order_date", F.lit("1970-01-01")))
     .rangeBetween(-7, 0))
result = daily.withColumn("avg_7d", F.round(F.sum("orders").over(w) / 7, 2))
`,
    ],
  },

  'spark-login-streaks': {
    pass: [
      // lag finds where a run breaks; a running sum numbers the runs.
      `from pyspark.sql import Window, functions as F

days = logins.select("user_id", F.to_date("login_at").alias("day")).dropDuplicates()
w = Window.partitionBy("user_id").orderBy("day")
runs = (days
        .withColumn("breaks", F.when(F.datediff("day", F.lag("day").over(w)) == 1, 0).otherwise(1))
        .withColumn("run", F.sum("breaks").over(w.rowsBetween(Window.unboundedPreceding, 0))))
result = (runs.groupBy("user_id", "run").count()
          .groupBy("user_id").agg(F.max("count").alias("longest_streak")))
`,
      `logins.createOrReplaceTempView("logins_v")
result = spark.sql("""
    WITH days AS (SELECT DISTINCT user_id, to_date(login_at) AS day FROM logins_v),
    islands AS (
        SELECT user_id, date_sub(day, CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day) AS INT)) AS island
        FROM days
    )
    SELECT user_id, MAX(n) AS longest_streak
    FROM (SELECT user_id, island, COUNT(*) AS n FROM islands GROUP BY user_id, island) runs
    GROUP BY user_id
""")
`,
    ],
    fail: [
      // Two logins on one day break the islands.
      `from pyspark.sql import Window, functions as F

days = logins.select("user_id", F.to_date("login_at").alias("day"))
w = Window.partitionBy("user_id").orderBy("day")
result = (days.withColumn("island", F.date_sub("day", F.row_number().over(w)))
          .groupBy("user_id", "island").agg(F.count("*").alias("streak"))
          .groupBy("user_id").agg(F.max("streak").alias("longest_streak")))
`,
      // Counts the days, not the longest run.
      `from pyspark.sql import functions as F

result = logins.groupBy("user_id").agg(F.countDistinct(F.to_date("login_at")).alias("longest_streak"))
`,
    ],
  },

  'spark-reconcile-two-tables': {
    pass: [
      // <=> in a SQL expression.
      `from pyspark.sql import functions as F

joined = source.alias("s").join(target.alias("t"), F.col("s.txn_id") == F.col("t.txn_id"), "full_outer")
result = (joined
          .select(F.coalesce("s.txn_id", "t.txn_id").alias("txn_id"),
                  F.expr("""CASE WHEN t.txn_id IS NULL THEN 'MISSING_IN_TARGET'
                                 WHEN s.txn_id IS NULL THEN 'MISSING_IN_SOURCE'
                                 WHEN NOT (s.amount <=> t.amount AND s.status <=> t.status) THEN 'MISMATCH'
                            END""").alias("issue"),
                  F.col("s.amount").alias("source_amount"),
                  F.col("t.amount").alias("target_amount"))
          .where("issue IS NOT NULL"))
`,
      // Three parts and a union.
      `from pyspark.sql import functions as F

no_amount = F.lit(None).cast("double")
missing_t = (source.join(target, "txn_id", "left_anti")
             .select("txn_id", F.lit("MISSING_IN_TARGET").alias("issue"),
                     F.col("amount").alias("source_amount"), no_amount.alias("target_amount")))
missing_s = (target.join(source, "txn_id", "left_anti")
             .select("txn_id", F.lit("MISSING_IN_SOURCE").alias("issue"),
                     no_amount.alias("source_amount"), F.col("amount").alias("target_amount")))
both = source.alias("s").join(target.alias("t"), "txn_id")
mismatch = (both
            .filter(~(F.col("s.amount").eqNullSafe(F.col("t.amount"))
                      & F.col("s.status").eqNullSafe(F.col("t.status"))))
            .select("txn_id", F.lit("MISMATCH").alias("issue"),
                    F.col("s.amount").alias("source_amount"), F.col("t.amount").alias("target_amount")))
result = missing_t.unionByName(missing_s).unionByName(mismatch)
`,
    ],
    fail: [
      // == with a null gives null, so 10.0 against null is not a mismatch.
      `from pyspark.sql import functions as F

s, t = source.alias("s"), target.alias("t")
same = (F.col("s.amount") == F.col("t.amount")) & (F.col("s.status") == F.col("t.status"))
result = (s.join(t, F.col("s.txn_id") == F.col("t.txn_id"), "full")
          .withColumn("issue",
                      F.when(F.col("t.txn_id").isNull(), "MISSING_IN_TARGET")
                       .when(F.col("s.txn_id").isNull(), "MISSING_IN_SOURCE")
                       .when(~same, "MISMATCH"))
          .filter(F.col("issue").isNotNull())
          .select(F.coalesce("s.txn_id", "t.txn_id").alias("txn_id"), "issue",
                  F.col("s.amount").alias("source_amount"), F.col("t.amount").alias("target_amount")))
`,
      // A left join never sees a row that is only in target.
      `from pyspark.sql import functions as F

s, t = source.alias("s"), target.alias("t")
same = (F.col("s.amount").eqNullSafe(F.col("t.amount"))
        & F.col("s.status").eqNullSafe(F.col("t.status")))
result = (s.join(t, F.col("s.txn_id") == F.col("t.txn_id"), "left")
          .withColumn("issue",
                      F.when(F.col("t.txn_id").isNull(), "MISSING_IN_TARGET")
                       .when(~same, "MISMATCH"))
          .filter(F.col("issue").isNotNull())
          .select(F.col("s.txn_id").alias("txn_id"), "issue",
                  F.col("s.amount").alias("source_amount"), F.col("t.amount").alias("target_amount")))
`,
    ],
  },

  'spark-pivot-status-counts': {
    pass: [
      `from pyspark.sql import functions as F

statuses = ["PLACED", "DELIVERED", "CANCELLED"]
result = orders.groupBy("order_date").agg(
    *[F.sum(F.when(F.col("status") == s, 1).otherwise(0)).alias(s) for s in statuses])
`,
      `from pyspark.sql import functions as F

result = orders.groupBy("order_date").agg(
    F.count(F.when(F.col("status") == "PLACED", True)).alias("PLACED"),
    F.count(F.when(F.col("status") == "DELIVERED", True)).alias("DELIVERED"),
    F.count(F.when(F.col("status") == "CANCELLED", True)).alias("CANCELLED"))
`,
    ],
    fail: [
      // No list of values: RETURNED gets a column too.
      `result = orders.groupBy("order_date").pivot("status").count().na.fill(0)
`,
      // No fill: a status with no orders is null, not 0.
      `statuses = ["PLACED", "DELIVERED", "CANCELLED"]
result = orders.groupBy("order_date").pivot("status", statuses).count()
`,
      // Filtering first drops 11-03, which has only a RETURNED order.
      `from pyspark.sql import functions as F

statuses = ["PLACED", "DELIVERED", "CANCELLED"]
result = (orders.filter(F.col("status").isin(statuses))
          .groupBy("order_date").pivot("status", statuses).count()
          .na.fill(0, statuses))
`,
    ],
  },

  'spark-status-changes': {
    pass: [
      // A stand-in value for null, and lag of event_at for the first row.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("device_id").orderBy("event_at")
now = F.coalesce(F.col("status"), F.lit("<none>"))
before = F.coalesce(F.lag("status").over(w), F.lit("<none>"))
result = (heartbeats
          .withColumn("first", F.lag("event_at").over(w).isNull())
          .withColumn("changed", now != before)
          .filter(F.col("first") | F.col("changed"))
          .select("device_id", "event_at", "status"))
`,
      `heartbeats.createOrReplaceTempView("hb")
result = spark.sql("""
    SELECT device_id, event_at, status
    FROM (
        SELECT *,
               LAG(status) OVER (PARTITION BY device_id ORDER BY event_at) AS prev,
               ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY event_at) AS rn
        FROM hb
    ) t
    WHERE rn = 1 OR NOT (status <=> prev)
""")
`,
    ],
    fail: [
      // != with a null is null: changes to or from null and the first rows drop out.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("device_id").orderBy("event_at")
result = (heartbeats
          .withColumn("previous", F.lag("status").over(w))
          .filter(F.col("status") != F.col("previous"))
          .drop("previous"))
`,
      // eqNullSafe alone drops a first row whose status is null.
      `from pyspark.sql import Window, functions as F

w = Window.partitionBy("device_id").orderBy("event_at")
result = (heartbeats
          .withColumn("previous", F.lag("status").over(w))
          .filter(~F.col("status").eqNullSafe(F.col("previous")))
          .drop("previous"))
`,
    ],
  },

  'spark-replace-python-udf': {
    pass: [
      `from pyspark.sql import functions as F

at = F.instr("email", "@")
result = users.withColumn(
    "email_masked",
    F.when(at > 0, F.concat(F.col("email").substr(1, 1), F.lit("***@"),
                            F.lower(F.expr("substring(email, instr(email, '@') + 1)")))))
`,
      `from pyspark.sql import functions as F

result = users.withColumn("email_masked", F.expr("""
    CASE WHEN instr(email, '@') > 0
         THEN concat(substring(email, 1, 1), '***@', lower(regexp_extract(email, '@(.*)$', 1)))
    END"""))
`,
    ],
    fail: [
      // The starter: right values, but a Python UDF.
      `from pyspark.sql import functions as F


@F.udf("string")
def mask_email(email):
    if email is None or "@" not in email:
        return None
    name, domain = email.split("@", 1)
    return name[0] + "***@" + domain.lower()


result = users.withColumn("email_masked", mask_email("email"))
`,
      // substring_index with -1 keeps what follows the last @.
      `from pyspark.sql import functions as F

result = users.withColumn(
    "email_masked",
    F.when(F.col("email").contains("@"),
           F.concat(F.substring("email", 1, 1), F.lit("***@"),
                    F.lower(F.substring_index("email", "@", -1)))))
`,
      // No check for a missing @: no-at-sign becomes n***@.
      `from pyspark.sql import functions as F

result = users.withColumn(
    "email_masked",
    F.concat(F.substring("email", 1, 1), F.lit("***@"), F.lower(F.regexp_extract("email", "@(.*)$", 1))))
`,
      // lower on everything also lowers the first character.
      `from pyspark.sql import functions as F

result = users.withColumn(
    "email_masked",
    F.when(F.col("email").contains("@"),
           F.lower(F.concat(F.substring("email", 1, 1), F.lit("***@"),
                            F.regexp_extract("email", "@(.*)$", 1)))))
`,
    ],
  },

  'spark-scd2-dataframes': {
    pass: [
      // Close rows in place with when, then add the new versions.
      `from pyspark.sql import functions as F


def apply_changes(dim, updates):
    current = dim.filter("is_current").alias("d")
    changes = (updates.alias("u")
               .join(current, F.col("u.customer_id") == F.col("d.customer_id"), "left")
               .where(F.col("d.customer_id").isNull() | ~F.col("u.city").eqNullSafe(F.col("d.city")))
               .select(F.col("u.customer_id").alias("customer_id"), F.col("u.city").alias("city"),
                       F.col("u.updated_at").alias("updated_at")))
    ends = changes.select("customer_id", F.col("updated_at").alias("ends_at"))
    kept = (dim.join(ends, "customer_id", "left")
            .withColumn("valid_to", F.when(F.col("is_current") & F.col("ends_at").isNotNull(), F.col("ends_at"))
                        .otherwise(F.col("valid_to")))
            .withColumn("is_current", F.col("is_current") & F.col("ends_at").isNull())
            .drop("ends_at"))
    added = changes.select("customer_id", "city", F.col("updated_at").alias("valid_from"),
                           F.lit(None).cast("timestamp").alias("valid_to"), F.lit(True).alias("is_current"))
    return kept.unionByName(added)
`,
    ],
    fail: [
      // != misses a change to or from a null city.
      `from pyspark.sql import functions as F


def apply_changes(dim, updates):
    current = dim.filter(F.col("is_current"))
    history = dim.filter(~F.col("is_current"))
    changed = (updates.alias("u")
               .join(current.alias("d"), "customer_id", "left")
               .filter(F.col("d.valid_from").isNull() | (F.col("u.city") != F.col("d.city")))
               .select("customer_id", F.col("u.city").alias("city"), "updated_at"))
    closed = (current.join(changed.select("customer_id", "updated_at"), "customer_id")
              .withColumn("valid_to", F.col("updated_at")).withColumn("is_current", F.lit(False))
              .drop("updated_at"))
    unchanged = current.join(changed, "customer_id", "left_anti")
    added = changed.select("customer_id", "city", F.col("updated_at").alias("valid_from"),
                           F.lit(None).cast("timestamp").alias("valid_to"), F.lit(True).alias("is_current"))
    return history.unionByName(unchanged).unionByName(closed).unionByName(added)
`,
      // Every update closes the current row, even with the same city.
      `from pyspark.sql import functions as F


def apply_changes(dim, updates):
    current = dim.filter(F.col("is_current"))
    history = dim.filter(~F.col("is_current"))
    closed = (current.join(updates.select("customer_id", "updated_at"), "customer_id")
              .withColumn("valid_to", F.col("updated_at")).withColumn("is_current", F.lit(False))
              .drop("updated_at"))
    unchanged = current.join(updates, "customer_id", "left_anti")
    added = updates.select("customer_id", "city", F.col("updated_at").alias("valid_from"),
                           F.lit(None).cast("timestamp").alias("valid_to"), F.lit(True).alias("is_current"))
    return history.unionByName(unchanged).unionByName(closed).unionByName(added)
`,
      // Works on the current rows only: the history is lost.
      `from pyspark.sql import functions as F


def apply_changes(dim, updates):
    current = dim.filter(F.col("is_current"))
    changed = (updates.alias("u")
               .join(current.alias("d"), "customer_id", "left")
               .filter(F.col("d.valid_from").isNull() | ~F.col("u.city").eqNullSafe(F.col("d.city")))
               .select("customer_id", F.col("u.city").alias("city"), "updated_at"))
    closed = (current.join(changed.select("customer_id", "updated_at"), "customer_id")
              .withColumn("valid_to", F.col("updated_at")).withColumn("is_current", F.lit(False))
              .drop("updated_at"))
    unchanged = current.join(changed, "customer_id", "left_anti")
    added = changed.select("customer_id", "city", F.col("updated_at").alias("valid_from"),
                           F.lit(None).cast("timestamp").alias("valid_to"), F.lit(True).alias("is_current"))
    return unchanged.unionByName(closed).unionByName(added)
`,
      // An inner join with the current rows never sees a new customer.
      `from pyspark.sql import functions as F


def apply_changes(dim, updates):
    current = dim.filter(F.col("is_current"))
    history = dim.filter(~F.col("is_current"))
    changed = (updates.alias("u")
               .join(current.alias("d"), "customer_id")
               .filter(~F.col("u.city").eqNullSafe(F.col("d.city")))
               .select("customer_id", F.col("u.city").alias("city"), "updated_at"))
    closed = (current.join(changed.select("customer_id", "updated_at"), "customer_id")
              .withColumn("valid_to", F.col("updated_at")).withColumn("is_current", F.lit(False))
              .drop("updated_at"))
    unchanged = current.join(changed, "customer_id", "left_anti")
    added = changed.select("customer_id", "city", F.col("updated_at").alias("valid_from"),
                           F.lit(None).cast("timestamp").alias("valid_to"), F.lit(True).alias("is_current"))
    return history.unionByName(unchanged).unionByName(closed).unionByName(added)
`,
    ],
  },

  'spark-idempotent-partition-load': {
    pass: [
      // The writer option instead of the session setting.
      `def load_day(batch, path):
    (batch.write
     .option("partitionOverwriteMode", "dynamic")
     .mode("overwrite")
     .partitionBy("event_date")
     .parquet(path))
`,
    ],
    fail: [
      // The starter: append loads a retried day twice.
      `def load_day(batch, path):
    batch.write.mode("append").partitionBy("event_date").parquet(path)
`,
      // A static overwrite replaces the whole table.
      `def load_day(batch, path):
    batch.write.mode("overwrite").partitionBy("event_date").parquet(path)
`,
      // No partitionBy: even a dynamic overwrite replaces everything.
      `def load_day(batch, path):
    spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")
    batch.write.mode("overwrite").parquet(path)
`,
      // ignore skips the write once the table exists, so late events never land.
      `def load_day(batch, path):
    batch.write.mode("ignore").partitionBy("event_date").parquet(path)
`,
    ],
  },
};
