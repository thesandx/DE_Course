import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the PySpark coding problems of the Spark track. The code
 * runs on the PySpark API in the browser (`pyspark_shim.py` on DuckDB). Each
 * test reads the answer through `answer()` or `shaped()`: the named columns,
 * in a fixed order, and no others. Rows compare in any order.
 */

/** Test helpers every Spark spec shares. They run before the learner's code. */
export const SPARK_HELPERS = `import pyspark_shim as _shim


def shaped(frame, *names, what="result"):
    """The answer with only the named columns, in the order the tests compare."""
    if isinstance(frame, Verdict):
        return frame
    if frame is None:
        return verdict(False, "%s is None. Make it a DataFrame." % what)
    if not hasattr(frame, "collect") or not hasattr(frame, "columns"):
        return verdict(False, "%s should be a DataFrame, not %s." % (what, type(frame).__name__))
    have = list(frame.columns)
    twice = sorted({name for name in have if have.count(name) > 1})
    if twice:
        return verdict(False, "%s has two columns named %s. Drop or rename one." % (what, twice[0]))
    missing = [name for name in names if name not in have]
    if missing:
        return verdict(False, "%s has no column %s. Its columns: %s." % (what, ", ".join(missing), ", ".join(have) or "none"))
    extra = [name for name in have if name not in names]
    if extra:
        return verdict(False, "Keep only the columns %s in %s. Drop %s." % (", ".join(names), what, ", ".join(extra)))
    return frame.select(*names)


def answer(*names, name="result"):
    """The DataFrame the code assigned to name, shaped for the tests."""
    if name not in globals():
        return verdict(False, "Assign your answer to %s." % name)
    return shaped(globals()[name], *names, what=name)`;

const ORDERS_COLUMNS = [
  { name: 'order_id', type: 'string' },
  { name: 'ordered_at', type: 'timestamp' },
  { name: 'customer', type: 'struct<id:string,city:string>' },
  { name: 'items', type: 'array<struct<sku:string,qty:int,price:double>>' },
] as const;

const PRODUCTS_COLUMNS = [
  { name: 'sku', type: 'string' },
  { name: 'category', type: 'string' },
] as const;

const DIM_COLUMNS = [
  { name: 'customer_id', type: 'int' },
  { name: 'city', type: 'string' },
  { name: 'valid_from', type: 'timestamp' },
  { name: 'valid_to', type: 'timestamp' },
  { name: 'is_current', type: 'boolean' },
] as const;

const UPDATES_COLUMNS = [
  { name: 'customer_id', type: 'int' },
  { name: 'city', type: 'string' },
  { name: 'updated_at', type: 'timestamp' },
] as const;

const TXN_COLUMNS = [
  { name: 'txn_id', type: 'int' },
  { name: 'amount', type: 'double' },
  { name: 'status', type: 'string' },
] as const;

export const PYSPARK_RUNNABLES: Record<string, RunnableSpec> = {
  'spark-nested-orders-revenue': {
    language: 'pyspark',
    task: `«orders» has «order_id», «ordered_at» (a timestamp), «customer» (a struct) and «items», an array of structs with «sku», «qty» and «price». «products» has «sku» and «category», one row for each SKU. Build «result» with one row for each category and order date: «category», «order_date» (a date), «revenue» (the sum of «qty × price», rounded to 2 decimals) and «orders» (the number of distinct orders). A SKU with no product row, or with no category, counts under «UNKNOWN». An order with no items adds nothing.`,
    tables: [
      {
        name: 'orders',
        columns: ORDERS_COLUMNS,
        rows: [
          [
            'o-1',
            '2026-11-01 09:30:00',
            { id: 'c-1', city: 'Bengaluru' },
            [
              { sku: 'MILK-1L', qty: 2, price: 54.5 },
              { sku: 'BREAD', qty: 1, price: 40 },
            ],
          ],
          [
            'o-2',
            '2026-11-01 13:05:00',
            { id: 'c-2', city: 'Delhi' },
            [{ sku: 'PHONE-X', qty: 1, price: 15999 }],
          ],
          [
            'o-3',
            '2026-11-01 23:40:00',
            { id: 'c-1', city: 'Bengaluru' },
            [
              { sku: 'MILK-1L', qty: 1, price: 54.5 },
              { sku: 'TOY-CAR', qty: 3, price: 199 },
            ],
          ],
          [
            'o-4',
            '2026-11-02 08:10:00',
            { id: 'c-3', city: 'Pune' },
            [
              { sku: 'BREAD', qty: 4, price: 40 },
              { sku: 'MILK-1L', qty: 1, price: 54.5 },
            ],
          ],
          ['o-5', '2026-11-02 10:00:00', { id: 'c-2', city: 'Delhi' }, []],
        ],
      },
      {
        name: 'products',
        columns: PRODUCTS_COLUMNS,
        rows: [
          ['MILK-1L', 'grocery'],
          ['BREAD', 'grocery'],
          ['PHONE-X', 'electronics'],
        ],
      },
    ],
    helpers: SPARK_HELPERS,
    starter: `from pyspark.sql import functions as F

# orders: order_id, ordered_at, customer (struct), items (array of sku, qty, price)
# products: sku, category
result = orders  # category, order_date, revenue, orders

result.show()
`,
    solution: `from pyspark.sql import functions as F

lines = (orders
         .withColumn("order_date", F.to_date("ordered_at"))
         .select("order_id", "order_date", F.explode("items").alias("item"))
         .select("order_id", "order_date", "item.sku",
                 (F.col("item.qty") * F.col("item.price")).alias("line_amount")))

result = (lines
          .join(F.broadcast(products), "sku", "left")
          .withColumn("category", F.coalesce("category", F.lit("UNKNOWN")))
          .groupBy("category", "order_date")
          .agg(F.round(F.sum("line_amount"), 2).alias("revenue"),
               F.countDistinct("order_id").alias("orders")))
`,
    cases: [
      {
        name: 'Sample',
        note: 'o-1 has two grocery lines but is one order. TOY-CAR has no product row, so it counts under UNKNOWN. o-5 has no items.',
        check: 'answer("category", "order_date", "revenue", "orders")',
      },
      {
        name: 'A product with no category',
        note: 'TOY-CAR has a product row, but its category is null: it still counts under UNKNOWN.',
        tables: [
          {
            name: 'products',
            columns: PRODUCTS_COLUMNS,
            rows: [
              ['MILK-1L', 'grocery'],
              ['BREAD', 'grocery'],
              ['PHONE-X', 'electronics'],
              ['TOY-CAR', null],
            ],
          },
        ],
        check: 'answer("category", "order_date", "revenue", "orders")',
      },
      {
        name: 'Orders near midnight',
        hidden: true,
        note: 'Each order counts on the date of its own timestamp.',
        tables: [
          {
            name: 'orders',
            columns: ORDERS_COLUMNS,
            rows: [
              [
                'o-7',
                '2026-11-30 23:59:59',
                { id: 'c-4', city: 'Goa' },
                [{ sku: 'BREAD', qty: 1, price: 40 }],
              ],
              [
                'o-8',
                '2026-12-01 00:00:01',
                { id: 'c-4', city: 'Goa' },
                [{ sku: 'BREAD', qty: 2, price: 40 }],
              ],
            ],
          },
        ],
        check: 'answer("category", "order_date", "revenue", "orders")',
      },
      {
        name: 'Two thousand orders',
        hidden: true,
        setup: `import random
rng = random.Random(21)
skus = ["SKU-%02d" % n for n in range(30)]
rows = []
for n in range(2000):
    items = [{"sku": rng.choice(skus), "qty": rng.randint(1, 4), "price": rng.randint(100, 99900) / 100}
             for _ in range(rng.randint(0, 4))]
    when = datetime(2026, 11, 1) + timedelta(minutes=rng.randint(0, 7 * 24 * 60))
    rows.append(("o-%d" % n, when, {"id": "c-%d" % rng.randint(1, 300), "city": "x"}, items))
orders = spark.createDataFrame(rows, "order_id string, ordered_at timestamp, customer struct<id:string,city:string>, items array<struct<sku:string,qty:int,price:double>>")
products = spark.createDataFrame([(sku, rng.choice(["grocery", "fashion", None])) for sku in skus[:24]], "sku string, category string")`,
        check: 'answer("category", "order_date", "revenue", "orders")',
      },
    ],
  },

  'spark-top-n-per-group': {
    language: 'pyspark',
    task: `«sales» has «category», «sku» and «amount», one row for each sale. Build «result» with the top 3 products of each category by total amount: «category», «sku» and «total». When totals tie, the smaller «sku» wins, so a category never has more than 3 rows.`,
    tables: [
      {
        name: 'sales',
        columns: [
          { name: 'category', type: 'string' },
          { name: 'sku', type: 'string' },
          { name: 'amount', type: 'double' },
        ],
        rows: [
          ['toys', 'C', 400],
          ['toys', 'D', 300],
          ['toys', 'A', 700],
          ['toys', 'C', 500],
          ['toys', 'B', 700],
          ['toys', 'D', 400],
          ['toys', 'E', 100],
          ['books', 'X', 20],
          ['books', 'Y', 20],
          ['books', 'X', 30],
          ['garden', 'G', 15],
        ],
      },
    ],
    helpers: SPARK_HELPERS,
    starter: `from pyspark.sql import Window, functions as F

# sales: category, sku, amount (one row for each sale)
result = sales  # category, sku, total: the top 3 products of each category

result.show()
`,
    solution: `from pyspark.sql import Window, functions as F

totals = sales.groupBy("category", "sku").agg(F.sum("amount").alias("total"))
by_category = Window.partitionBy("category").orderBy(F.desc("total"), "sku")
result = (totals
          .withColumn("position", F.row_number().over(by_category))
          .filter(F.col("position") <= 3)
          .drop("position"))
`,
    cases: [
      {
        name: 'Sample',
        note: 'In toys, C totals 900. A, B and D all total 700, so A and B win on the smaller sku, and D is out.',
        check: 'answer("category", "sku", "total")',
      },
      {
        name: 'Fewer than three products',
        note: 'books has two products and garden one: they keep all of them.',
        tables: [
          {
            name: 'sales',
            columns: [
              { name: 'category', type: 'string' },
              { name: 'sku', type: 'string' },
              { name: 'amount', type: 'double' },
            ],
            rows: [
              ['books', 'X', 20],
              ['books', 'Y', 50],
              ['garden', 'G', 15],
            ],
          },
        ],
        check: 'answer("category", "sku", "total")',
      },
      {
        name: 'Many ties',
        hidden: true,
        setup: `import random
rng = random.Random(4)
rows = [("cat-%d" % rng.randint(1, 120), "sku-%03d" % rng.randint(1, 400), rng.randint(1, 6) * 50.0)
        for _ in range(4000)]
sales = spark.createDataFrame(rows, "category string, sku string, amount double")`,
        check: 'answer("category", "sku", "total")',
      },
    ],
  },

  'spark-rolling-seven-day': {
    language: 'pyspark',
    task: `«daily» has «restaurant_id», «order_date» (a date) and «orders»: one row for each restaurant and day with orders. Days with no orders are missing. Build «result»: every row of «daily» and «avg_7d», the average daily orders over the 7 calendar days that end on «order_date». A missing day counts as 0 orders, so divide by 7. Round «avg_7d» to 2 decimals.`,
    tables: [
      {
        name: 'daily',
        columns: [
          { name: 'restaurant_id', type: 'string' },
          { name: 'order_date', type: 'date' },
          { name: 'orders', type: 'int' },
        ],
        rows: [
          ['r-1', '2026-11-01', 10],
          ['r-1', '2026-11-02', 20],
          ['r-1', '2026-11-03', 30],
          ['r-1', '2026-11-09', 5],
          ['r-1', '2026-11-10', 6],
          ['r-2', '2026-11-01', 7],
          ['r-2', '2026-11-08', 14],
          ['r-3', '2026-11-05', 3],
        ],
      },
    ],
    helpers: SPARK_HELPERS,
    starter: `from pyspark.sql import Window, functions as F

# daily: restaurant_id, order_date, orders (days with no orders are missing)
result = daily  # add avg_7d

result.show()
`,
    solution: `from pyspark.sql import Window, functions as F

last_7_days = (Window.partitionBy("restaurant_id")
               .orderBy(F.datediff("order_date", F.lit("1970-01-01")))
               .rangeBetween(-6, 0))
result = daily.withColumn("avg_7d", F.round(F.sum("orders").over(last_7_days) / 7, 2))
`,
    cases: [
      {
        name: 'Sample',
        note: 'r-1 on 11-09: the 7 days from 11-03 to 11-09 hold 30 + 5 orders, so 35 / 7 = 5.0. r-2 on 11-08: 11-01 is 7 days back, outside the window.',
        check: 'answer("restaurant_id", "order_date", "orders", "avg_7d")',
      },
      {
        name: 'A month boundary',
        tables: [
          {
            name: 'daily',
            columns: [
              { name: 'restaurant_id', type: 'string' },
              { name: 'order_date', type: 'date' },
              { name: 'orders', type: 'int' },
            ],
            rows: [
              ['r-9', '2026-10-29', 70],
              ['r-9', '2026-10-31', 7],
              ['r-9', '2026-11-04', 14],
              ['r-9', '2026-11-05', 21],
            ],
          },
        ],
        check: 'answer("restaurant_id", "order_date", "orders", "avg_7d")',
      },
      {
        name: 'Sixty restaurants with gaps',
        hidden: true,
        setup: `import random
rng = random.Random(9)
rows = []
for r in range(60):
    for d in range(60):
        if rng.random() < 0.6:
            rows.append(("r-%d" % r, date(2026, 9, 1) + timedelta(days=d), rng.randint(1, 80)))
daily = spark.createDataFrame(rows, "restaurant_id string, order_date date, orders int")`,
        check: 'answer("restaurant_id", "order_date", "orders", "avg_7d")',
      },
    ],
  },

  'spark-login-streaks': {
    language: 'pyspark',
    task: `«logins» has «user_id» and «login_at» (a timestamp), one row for each login. Build «result» with «user_id» and «longest_streak»: the longest run of consecutive calendar days on which the user logged in at least once.`,
    tables: [
      {
        name: 'logins',
        columns: [
          { name: 'user_id', type: 'string' },
          { name: 'login_at', type: 'timestamp' },
        ],
        rows: [
          ['u-1', '2026-11-01 09:00:00'],
          ['u-1', '2026-11-02 08:00:00'],
          ['u-1', '2026-11-02 21:00:00'],
          ['u-1', '2026-11-03 23:59:00'],
          ['u-1', '2026-11-05 10:00:00'],
          ['u-1', '2026-11-06 10:00:00'],
          ['u-2', '2026-11-10 10:00:00'],
          ['u-3', '2026-11-01 07:00:00'],
          ['u-3', '2026-11-03 07:00:00'],
          ['u-4', '2026-10-30 12:00:00'],
          ['u-4', '2026-10-31 12:00:00'],
          ['u-4', '2026-11-01 12:00:00'],
          ['u-4', '2026-11-02 12:00:00'],
        ],
      },
    ],
    helpers: SPARK_HELPERS,
    starter: `from pyspark.sql import Window, functions as F

# logins: user_id, login_at (one row for each login)
result = logins  # user_id, longest_streak

result.show()
`,
    solution: `from pyspark.sql import Window, functions as F

days = logins.select("user_id", F.to_date("login_at").alias("day")).distinct()
by_user = Window.partitionBy("user_id").orderBy("day")
streaks = (days
           .withColumn("island", F.date_sub("day", F.row_number().over(by_user)))
           .groupBy("user_id", "island")
           .agg(F.count("*").alias("streak")))
result = streaks.groupBy("user_id").agg(F.max("streak").alias("longest_streak"))
`,
    cases: [
      {
        name: 'Sample',
        note: 'u-1 logs in twice on 11-02: still one day. 11-01 to 11-03 is a run of 3. u-4 runs over the month end.',
        check: 'answer("user_id", "longest_streak")',
      },
      {
        name: 'Ninety days of random logins',
        hidden: true,
        setup: `import random
rng = random.Random(12)
rows = []
for u in range(50):
    for d in range(90):
        if rng.random() < 0.55:
            for _ in range(rng.randint(1, 3)):
                rows.append(("u-%d" % u, datetime(2026, 8, 1) + timedelta(days=d, minutes=rng.randint(0, 1439))))
logins = spark.createDataFrame(rows, "user_id string, login_at timestamp")`,
        check: 'answer("user_id", "longest_streak")',
      },
    ],
  },

  'spark-reconcile-two-tables': {
    language: 'pyspark',
    task: `«source» and «target» both have «txn_id», «amount» and «status». «amount» and «status» can be null, and two nulls count as equal. Build «result» with one row for each «txn_id» that differs: «txn_id», «issue» («MISSING_IN_TARGET», «MISSING_IN_SOURCE» or «MISMATCH»), «source_amount» and «target_amount». A transaction that is the same on both sides is not in «result».`,
    tables: [
      {
        name: 'source',
        columns: TXN_COLUMNS,
        rows: [
          [1, 100, 'SETTLED'],
          [2, 250, null],
          [3, 75.5, 'SETTLED'],
          [4, null, 'FAILED'],
          [5, 10, 'PENDING'],
          [7, 60, 'SETTLED'],
        ],
      },
      {
        name: 'target',
        columns: TXN_COLUMNS,
        rows: [
          [1, 100, 'SETTLED'],
          [2, 250, null],
          [3, 75.5, 'REFUNDED'],
          [4, null, 'FAILED'],
          [5, null, 'PENDING'],
          [6, 20, 'SETTLED'],
        ],
      },
    ],
    helpers: SPARK_HELPERS,
    starter: `from pyspark.sql import functions as F

# source, target: txn_id, amount, status
result = source  # txn_id, issue, source_amount, target_amount

result.show()
`,
    solution: `from pyspark.sql import functions as F

s, t = source.alias("s"), target.alias("t")
same = (F.col("s.amount").eqNullSafe(F.col("t.amount"))
        & F.col("s.status").eqNullSafe(F.col("t.status")))
result = (s.join(t, F.col("s.txn_id") == F.col("t.txn_id"), "full")
          .withColumn("issue",
                      F.when(F.col("t.txn_id").isNull(), "MISSING_IN_TARGET")
                       .when(F.col("s.txn_id").isNull(), "MISSING_IN_SOURCE")
                       .when(~same, "MISMATCH"))
          .filter(F.col("issue").isNotNull())
          .select(F.coalesce("s.txn_id", "t.txn_id").alias("txn_id"), "issue",
                  F.col("s.amount").alias("source_amount"),
                  F.col("t.amount").alias("target_amount")))
`,
    cases: [
      {
        name: 'Sample',
        note: 'Transactions 2 and 4 have nulls on both sides, so they match. 5 has 10.0 against null: a mismatch.',
        check: 'answer("txn_id", "issue", "source_amount", "target_amount")',
      },
      {
        name: 'Two thousand transactions',
        hidden: true,
        setup: `import random
rng = random.Random(5)
left, right = [], []
for n in range(2000):
    amount = rng.choice([None, round(rng.uniform(1, 500), 2)])
    status = rng.choice([None, "SETTLED", "PENDING", "FAILED"])
    side = rng.random()
    if side < 0.9:
        left.append((n, amount, status))
    if side > 0.05:
        if rng.random() < 0.1:
            amount = rng.choice([None, round(rng.uniform(1, 500), 2)])
        if rng.random() < 0.1:
            status = rng.choice([None, "SETTLED", "REFUNDED"])
        right.append((n, amount, status))
source = spark.createDataFrame(left, "txn_id int, amount double, status string")
target = spark.createDataFrame(right, "txn_id int, amount double, status string")`,
        check: 'answer("txn_id", "issue", "source_amount", "target_amount")',
      },
    ],
  },

  'spark-pivot-status-counts': {
    language: 'pyspark',
    task: `«orders» has «order_id», «order_date» and «status». Build «result» with one row for each «order_date» in «orders» and the columns «order_date», «PLACED», «DELIVERED» and «CANCELLED»: the number of orders with that status on that date, 0 when there are none. Other statuses get no column.`,
    tables: [
      {
        name: 'orders',
        columns: [
          { name: 'order_id', type: 'int' },
          { name: 'order_date', type: 'date' },
          { name: 'status', type: 'string' },
        ],
        rows: [
          [1, '2026-11-01', 'PLACED'],
          [2, '2026-11-01', 'DELIVERED'],
          [3, '2026-11-01', 'PLACED'],
          [4, '2026-11-01', 'RETURNED'],
          [5, '2026-11-02', 'CANCELLED'],
          [6, '2026-11-02', 'DELIVERED'],
          [7, '2026-11-02', 'DELIVERED'],
          [8, '2026-11-03', 'RETURNED'],
        ],
      },
    ],
    helpers: SPARK_HELPERS,
    starter: `from pyspark.sql import functions as F

statuses = ["PLACED", "DELIVERED", "CANCELLED"]

# orders: order_id, order_date, status
result = orders  # order_date, PLACED, DELIVERED, CANCELLED

result.show()
`,
    solution: `statuses = ["PLACED", "DELIVERED", "CANCELLED"]

result = (orders
          .groupBy("order_date")
          .pivot("status", statuses)
          .count()
          .na.fill(0, statuses))
`,
    cases: [
      {
        name: 'Sample',
        note: '11-03 has only a RETURNED order, so it gets a row of zeros. RETURNED gets no column.',
        check: 'answer("order_date", "PLACED", "DELIVERED", "CANCELLED")',
      },
      {
        name: 'Three thousand orders',
        hidden: true,
        setup: `import random
rng = random.Random(31)
rows = [(n, date(2026, 10, 1) + timedelta(days=rng.randint(0, 29)),
         rng.choice(["PLACED", "DELIVERED", "CANCELLED", "RETURNED", "LOST"])) for n in range(3000)]
orders = spark.createDataFrame(rows, "order_id int, order_date date, status string")`,
        check: 'answer("order_date", "PLACED", "DELIVERED", "CANCELLED")',
      },
    ],
  },

  'spark-status-changes': {
    language: 'pyspark',
    task: `«heartbeats» has «device_id», «event_at» (a timestamp) and «status», which can be null. Build «result» with the rows whose status differs from the previous row of the same device, by «event_at». Keep the first row of each device. A change to or from null counts as a change. Keep the three columns.`,
    tables: [
      {
        name: 'heartbeats',
        columns: [
          { name: 'device_id', type: 'string' },
          { name: 'event_at', type: 'timestamp' },
          { name: 'status', type: 'string' },
        ],
        rows: [
          ['d-1', '2026-11-01 09:06:00', 'UP'],
          ['d-1', '2026-11-01 09:00:00', 'UP'],
          ['d-1', '2026-11-01 09:01:00', 'UP'],
          ['d-1', '2026-11-01 09:02:00', 'DOWN'],
          ['d-1', '2026-11-01 09:03:00', 'DOWN'],
          ['d-1', '2026-11-01 09:04:00', null],
          ['d-1', '2026-11-01 09:05:00', null],
          ['d-2', '2026-11-01 09:00:00', 'UP'],
          ['d-2', '2026-11-01 09:01:00', 'UP'],
          ['d-3', '2026-11-01 09:00:00', null],
          ['d-3', '2026-11-01 09:01:00', null],
          ['d-3', '2026-11-01 09:02:00', 'UP'],
        ],
      },
    ],
    helpers: SPARK_HELPERS,
    starter: `from pyspark.sql import Window, functions as F

# heartbeats: device_id, event_at, status (status can be null)
result = heartbeats  # only the rows where the status changed

result.show()
`,
    solution: `from pyspark.sql import Window, functions as F

by_device = Window.partitionBy("device_id").orderBy("event_at")
result = (heartbeats
          .withColumn("previous", F.lag("status").over(by_device))
          .withColumn("position", F.row_number().over(by_device))
          .filter((F.col("position") == 1) | ~F.col("status").eqNullSafe(F.col("previous")))
          .drop("previous", "position"))
`,
    cases: [
      {
        name: 'Sample',
        note: 'd-1: UP at 09:00, DOWN at 09:02, null at 09:04 and UP at 09:06. d-3 starts with a null status: the first row stays.',
        check: 'answer("device_id", "event_at", "status")',
      },
      {
        name: 'Fifty devices',
        hidden: true,
        setup: `import random
rng = random.Random(77)
rows = []
for d in range(50):
    status = "UP"
    for m in range(200):
        if rng.random() < 0.08:
            status = rng.choice(["UP", "DOWN", None, "DEGRADED"])
        rows.append(("d-%d" % d, datetime(2026, 11, 1) + timedelta(minutes=m), status))
rng.shuffle(rows)
heartbeats = spark.createDataFrame(rows, "device_id string, event_at timestamp, status string")`,
        check: 'answer("device_id", "event_at", "status")',
      },
    ],
  },

  'spark-replace-python-udf': {
    language: 'pyspark',
    task: `«users» has «user_id» and «email». Build «result»: «users» with «email_masked», the same value as the «mask_email» UDF in the starter code, but with built-in functions only. It is null when the email is null or has no «@». Otherwise it is the first character, then «***@», then the domain (everything after the first «@») in lower case. Keep the three columns.`,
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'user_id', type: 'int' },
          { name: 'email', type: 'string' },
        ],
        rows: [
          [1, 'Asha.K@Gmail.COM'],
          [2, null],
          [3, 'no-at-sign'],
          [4, 'ravi@Corp.Example.IN'],
          [5, 'b@x@Y.com'],
          [6, 'z@'],
        ],
      },
    ],
    helpers: `${SPARK_HELPERS}


def check_no_udf():
    """The answer must not call a Python UDF anywhere."""
    frame = answer("user_id", "email", "email_masked")
    if isinstance(frame, Verdict):
        return frame
    if _shim._uses_udf(frame):
        return verdict(False, "result still calls a Python UDF, so every row would travel to a Python worker and back. Use built-in functions such as F.when, F.substring, F.lower and F.regexp_extract.")
    return verdict(True)`,
    starter: `from pyspark.sql import functions as F


@F.udf("string")
def mask_email(email):
    if email is None or "@" not in email:
        return None
    name, domain = email.split("@", 1)
    return name[0] + "***@" + domain.lower()


# Right answer, slow way: rewrite it without the UDF.
result = users.withColumn("email_masked", mask_email("email"))

result.show(truncate=False)
`,
    solution: `from pyspark.sql import functions as F

result = users.withColumn(
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
`,
    cases: [
      {
        name: 'Sample',
        note: 'b@x@Y.com keeps everything after the first @. z@ has an empty domain: z***@.',
        check: 'answer("user_id", "email", "email_masked")',
      },
      {
        name: 'No Python UDF',
        check: 'check_no_udf()',
      },
      {
        name: 'Two thousand emails',
        hidden: true,
        setup: `import random
rng = random.Random(8)
names = ["Asha", "ravi.k", "J", "x_y", "Meera.Iyer"]
domains = ["Gmail.com", "CORP.in", "mail.Example.org", "y.CO"]
rows = []
for n in range(2000):
    kind = rng.random()
    if kind < 0.1:
        email = None
    elif kind < 0.2:
        email = rng.choice(names)
    else:
        email = rng.choice(names) + "@" + rng.choice(domains)
    rows.append((n, email))
users = spark.createDataFrame(rows, "user_id int, email string")`,
        check: 'answer("user_id", "email", "email_masked")',
      },
    ],
  },

  'spark-scd2-dataframes': {
    language: 'pyspark',
    task: `«dim» is a type 2 dimension: «customer_id», «city», «valid_from», «valid_to», «is_current». «updates» has «customer_id», «city» and «updated_at», at most one row for each customer. Write «apply_changes(dim, updates)» that returns the new dimension. When a customer's city changed, close the current row («valid_to» = «updated_at», «is_current» false) and add the new version («valid_from» = «updated_at», «valid_to» null, «is_current» true). A new customer gets a current row the same way. An update with the same city changes nothing; a change to or from a null city is a change. Every other row stays as it is. Return the five columns of «dim».`,
    tables: [
      {
        name: 'dim',
        columns: DIM_COLUMNS,
        rows: [
          [1, 'Pune', '2025-01-01 00:00:00', '2026-03-01 00:00:00', false],
          [1, 'Delhi', '2026-03-01 00:00:00', null, true],
          [2, 'Goa', '2025-06-01 00:00:00', null, true],
          [3, 'Agra', '2025-06-01 00:00:00', null, true],
        ],
      },
      {
        name: 'updates',
        columns: UPDATES_COLUMNS,
        rows: [
          [1, 'Mumbai', '2026-11-01 00:00:00'],
          [2, 'Goa', '2026-11-01 00:00:00'],
          [4, 'Kochi', '2026-11-01 00:00:00'],
        ],
      },
    ],
    helpers: `${SPARK_HELPERS}

COLUMNS = ("customer_id", "city", "valid_from", "valid_to", "is_current")


def new_dim(frame_dim, frame_updates):
    """apply_changes(dim, updates), shaped for the tests."""
    function = globals().get("apply_changes")
    if not callable(function):
        return verdict(False, "Define apply_changes(dim, updates).")
    return shaped(function(frame_dim, frame_updates), *COLUMNS, what="apply_changes(dim, updates)")


def check_rerun():
    """Applying the same updates twice gives the same dimension as once."""
    once = new_dim(dim, updates)
    if isinstance(once, Verdict):
        return once
    twice = new_dim(once, updates)
    if isinstance(twice, Verdict):
        return twice
    first = sorted((tuple(row) for row in once.collect()), key=repr)
    second = sorted((tuple(row) for row in twice.collect()), key=repr)
    if first != second:
        return verdict(False, "Applying the same updates a second time changed the dimension: %d rows after one run, %d after two. A rerun finds no real change, so it must change nothing." % (len(first), len(second)))
    return verdict(True)`,
    starter: `from pyspark.sql import functions as F


def apply_changes(dim, updates):
    # dim: customer_id, city, valid_from, valid_to, is_current
    # updates: customer_id, city, updated_at
    return dim


apply_changes(dim, updates).orderBy("customer_id", "valid_from").show()
`,
    solution: `from pyspark.sql import functions as F


def apply_changes(dim, updates):
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

    return (history.unionByName(unchanged)
            .unionByName(closed)
            .unionByName(added))
`,
    cases: [
      {
        name: 'Sample',
        note: 'Customer 1 moves to Mumbai: the Delhi row closes on 2026-11-01. Customer 2 stays in Goa: no change. Customer 4 is new.',
        check: 'new_dim(dim, updates)',
      },
      {
        name: 'Same city changes nothing',
        tables: [
          {
            name: 'updates',
            columns: UPDATES_COLUMNS,
            rows: [
              [2, 'Goa', '2026-11-01 00:00:00'],
              [3, 'Agra', '2026-11-01 00:00:00'],
            ],
          },
        ],
        check: 'new_dim(dim, updates)',
      },
      {
        name: 'From an unknown city',
        hidden: true,
        note: 'Customer 5 had a null city. Surat is a change, and the null row closes.',
        tables: [
          {
            name: 'dim',
            columns: DIM_COLUMNS,
            rows: [
              [2, 'Goa', '2025-06-01 00:00:00', null, true],
              [5, null, '2025-07-01 00:00:00', null, true],
            ],
          },
          {
            name: 'updates',
            columns: UPDATES_COLUMNS,
            rows: [
              [5, 'Surat', '2026-11-01 00:00:00'],
              [2, null, '2026-11-01 00:00:00'],
            ],
          },
        ],
        check: 'new_dim(dim, updates)',
      },
      {
        name: 'A rerun changes nothing',
        hidden: true,
        check: 'check_rerun()',
      },
      {
        name: 'Five hundred customers',
        hidden: true,
        setup: `import random
rng = random.Random(15)
cities = ["Pune", "Goa", "Agra", "Delhi", None]
dim_rows, update_rows = [], []
for c in range(500):
    start = datetime(2024, 1, 1) + timedelta(days=rng.randint(0, 300))
    city = rng.choice(cities)
    for _ in range(rng.randint(0, 2)):
        end = start + timedelta(days=rng.randint(10, 100))
        dim_rows.append((c, city, start, end, False))
        start, city = end, rng.choice(cities)
    dim_rows.append((c, city, start, None, True))
    if rng.random() < 0.5:
        update_rows.append((c, rng.choice(cities), datetime(2026, 11, 1)))
for c in range(500, 540):
    update_rows.append((c, rng.choice(cities), datetime(2026, 11, 1)))
dim = spark.createDataFrame(dim_rows, "customer_id int, city string, valid_from timestamp, valid_to timestamp, is_current boolean")
updates = spark.createDataFrame(update_rows, "customer_id int, city string, updated_at timestamp")`,
        check: 'new_dim(dim, updates)',
      },
    ],
  },

  'spark-idempotent-partition-load': {
    language: 'pyspark',
    task: `Write «load_day(batch, path)». It writes «batch» («event_id», «event_date», «amount») to the Parquet table at «path», partitioned by «event_date», so that running it twice with the same batch gives the same table. The batch holds every row of each date it covers: a late event comes with its whole day, read again. Dates that are not in the batch must stay as they are. The table may not exist yet.`,
    tables: [
      {
        name: 'batch',
        columns: [
          { name: 'event_id', type: 'long' },
          { name: 'event_date', type: 'string' },
          { name: 'amount', type: 'int' },
        ],
        rows: [
          [5, '2026-11-03', 99],
          [6, '2026-11-03', 15],
        ],
      },
    ],
    helpers: `${SPARK_HELPERS}

_PATH = "/lake/events"
_SCHEMA = "event_id long, event_date string, amount int"
_DAY1 = [(1, "2026-11-01", 120), (2, "2026-11-01", 80)]
_DAY2 = [(3, "2026-11-02", 45), (4, "2026-11-02", 300)]
_OLD_DAY3 = [(5, "2026-11-03", 90)]
_NEW_DAY3 = [(5, "2026-11-03", 99), (6, "2026-11-03", 15)]


def _load_day():
    function = globals().get("load_day")
    if not callable(function):
        return verdict(False, "Define load_day(batch, path).")
    return function


def _seed(rows):
    spark.conf.set("spark.sql.sources.partitionOverwriteMode", "static")
    spark.createDataFrame(rows, _SCHEMA).write.mode("overwrite").partitionBy("event_date").parquet(_PATH)
    spark.conf.unset("spark.sql.sources.partitionOverwriteMode")


def _by_day(rows):
    days = {}
    for event_id, day, amount in rows:
        days.setdefault(day, []).append((event_id, amount))
    return {day: sorted(items) for day, items in days.items()}


def _table():
    rows = spark.read.parquet(_PATH).select("event_id", "event_date", "amount").collect()
    return _by_day([tuple(row) for row in rows])


def _problem(got, want, when):
    lost = sorted(day for day in want if day not in got)
    if lost:
        return "%s, the table lost %s, which the batch did not touch. A plain overwrite replaces the whole table: set spark.sql.sources.partitionOverwriteMode to dynamic, so it replaces only the dates in the batch." % (when, " and ".join(lost))
    for day in sorted(want):
        if len(got[day]) > len(want[day]) and set(got[day]) == set(want[day]):
            return "%s, %s holds %d rows instead of %d: the day was written twice. Overwrite the dates in the batch instead of appending." % (when, day, len(got[day]), len(want[day]))
        if got[day] != want[day]:
            return "%s, %s holds %s as (event_id, amount); it should hold %s." % (when, day, got[day], want[day])
    extra = sorted(day for day in got if day not in want)
    if extra:
        return "%s, the table has dates that should not be there: %s." % (when, ", ".join(extra))
    return None


def check_rerun():
    load = _load_day()
    if isinstance(load, Verdict):
        return load
    _seed(_DAY1 + _DAY2 + _OLD_DAY3)
    batch = spark.createDataFrame(_NEW_DAY3, _SCHEMA)
    load(batch, _PATH)
    load(batch, _PATH)
    problem = _problem(_table(), _by_day(_DAY1 + _DAY2 + _NEW_DAY3), "After two runs for 2026-11-03")
    return verdict(problem is None, problem or "")


def check_late_events():
    load = _load_day()
    if isinstance(load, Verdict):
        return load
    _seed(_DAY1 + _DAY2 + _OLD_DAY3)
    whole_day2 = _DAY2 + [(7, "2026-11-02", 61)]
    day4 = [(8, "2026-11-04", 10)]
    load(spark.createDataFrame(whole_day2 + day4, _SCHEMA), _PATH)
    problem = _problem(_table(), _by_day(_DAY1 + whole_day2 + _OLD_DAY3 + day4), "After a batch with all of 2026-11-02 and 2026-11-04")
    return verdict(problem is None, problem or "")


def check_first_load():
    load = _load_day()
    if isinstance(load, Verdict):
        return load
    load(spark.createDataFrame(_DAY1, _SCHEMA), "/lake/new_table")
    scans = spark.read.parquet("/lake/new_table")._plan.scans()
    columns = scans[0].partition_cols if scans else []
    if [name.lower() for name in columns] != ["event_date"]:
        return verdict(False, "The table is partitioned by %s. Write with partitionBy(\\"event_date\\"), so each day is its own partition." % (columns or "nothing"))
    rows = sorted(tuple(row) for row in spark.read.parquet("/lake/new_table").select("event_id", "event_date", "amount").collect())
    if rows != sorted(_DAY1):
        return verdict(False, "A first load into an empty path should write the batch as it is. The table holds %s." % rows)
    return verdict(True)`,
    starter: `def load_day(batch, path):
    # Appends the batch: a retry of the same day loads it twice.
    batch.write.mode("append").partitionBy("event_date").parquet(path)


load_day(batch, "/lake/events")
load_day(batch, "/lake/events")  # the scheduler retries the job
spark.read.parquet("/lake/events").orderBy("event_id").show()
`,
    solution: `def load_day(batch, path):
    spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")
    (batch
     .repartition("event_date")
     .write
     .mode("overwrite")
     .partitionBy("event_date")
     .parquet(path))
`,
    cases: [
      {
        name: 'A rerun gives the same table',
        note: 'The table holds 2026-11-01 to 2026-11-03. The batch for 2026-11-03 runs twice: 11-03 is replaced once, and the other days stay.',
        check: 'check_rerun()',
      },
      {
        name: 'Late events rewrite their whole day',
        hidden: true,
        check: 'check_late_events()',
      },
      {
        name: 'A first load into an empty path',
        hidden: true,
        check: 'check_first_load()',
      },
    ],
  },
};
