import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the Spark track. The code runs on the PySpark API in
 * the browser: `pyspark_shim.py` compiles DataFrame calls to DuckDB SQL. The
 * sample DataFrames exist before the learner's code runs; the code builds
 * `result`, and the tests compare its rows in any order.
 */

const UPDATES_COLUMNS = [
  { name: 'order_id', type: 'string' },
  { name: 'status', type: 'string' },
  { name: 'updated_at', type: 'timestamp' },
  { name: 'offset', type: 'long' },
] as const;

export const SPARK_RUNNABLES: Record<string, RunnableSpec> = {
  'spark-dedupe-latest': {
    language: 'pyspark',
    task: `Build «result» from the DataFrame «updates»: one row per «order_id», the version with the latest «updated_at». When two versions share «updated_at», keep the one with the larger «offset». Keep the four columns «order_id, status, updated_at, offset».`,
    tables: [
      {
        name: 'updates',
        columns: UPDATES_COLUMNS,
        rows: [
          ['o-1', 'placed', '2024-05-01 10:00:00', 1],
          ['o-1', 'paid', '2024-05-01 10:05:00', 4],
          ['o-1', 'shipped', '2024-05-02 08:00:00', 9],
          ['o-2', 'placed', '2024-05-01 11:00:00', 2],
          ['o-2', 'cancelled', '2024-05-01 11:30:00', 6],
          ['o-3', 'placed', '2024-05-01 12:00:00', 3],
          ['o-3', 'paid', '2024-05-01 12:00:00', 5],
        ],
      },
    ],
    starter: `from pyspark.sql import Window, functions as F

# updates: order_id, status, updated_at, offset
result = updates  # keep the latest version of each order

result.show()
`,
    solution: `from pyspark.sql import Window, functions as F

w = Window.partitionBy("order_id").orderBy(F.desc("updated_at"), F.desc("offset"))
result = (updates
          .withColumn("rn", F.row_number().over(w))
          .filter("rn = 1")
          .drop("rn"))
`,
    cases: [
      { name: 'Sample', note: 'o-3 has two versions at 12:00. The larger offset wins.' },
      {
        name: 'Late arrival',
        note: 'A version can arrive after a newer one. Order by «updated_at», not by arrival.',
        tables: [
          {
            name: 'updates',
            columns: UPDATES_COLUMNS,
            rows: [
              ['o-9', 'delivered', '2024-05-03 18:00:00', 20],
              ['o-9', 'shipped', '2024-05-02 09:00:00', 31],
              ['o-9', 'placed', '2024-05-01 09:00:00', 32],
            ],
          },
        ],
      },
      {
        name: 'Exact duplicates',
        hidden: true,
        note: 'The same event delivered twice must still give one row.',
        tables: [
          {
            name: 'updates',
            columns: UPDATES_COLUMNS,
            rows: [
              ['o-5', 'paid', '2024-05-01 10:00:00', 7],
              ['o-5', 'paid', '2024-05-01 10:00:00', 7],
              ['o-6', 'placed', '2024-05-01 10:00:00', 8],
            ],
          },
        ],
      },
      {
        name: 'Two thousand orders',
        hidden: true,
        setup: `import random
rng = random.Random(11)
rows = []
for n in range(2000):
    base = datetime(2024, 5, 1) + timedelta(minutes=rng.randint(0, 5000))
    for v in range(rng.randint(1, 4)):
        rows.append((f"o-{n}", rng.choice(["placed", "paid", "shipped", "delivered"]),
                     base + timedelta(minutes=rng.choice([0, 0, 15, 30, 45]) * v), rng.randint(0, 10**6)))
updates = spark.createDataFrame(rows, "order_id string, status string, updated_at timestamp, offset long")`,
      },
    ],
  },
};
