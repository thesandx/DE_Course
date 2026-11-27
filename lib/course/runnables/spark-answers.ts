import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/** Other answers for the Spark track's runnable problems. See `test-answers.ts`. */
export const SPARK_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'spark-dedupe-latest': {
    pass: [
      `from pyspark.sql import functions as F

result = (updates
          .groupBy("order_id")
          .agg(F.max(F.struct("updated_at", "offset", "status")).alias("s"))
          .select("order_id", "s.status", "s.updated_at", "s.offset"))
`,
    ],
    fail: [
      // Ignores the offset tie-break, so o-3 keeps an arbitrary version.
      `from pyspark.sql import functions as F

latest = updates.groupBy("order_id").agg(F.max("updated_at").alias("updated_at"))
result = updates.join(latest, ["order_id", "updated_at"]).select("order_id", "status", "updated_at", "offset")
`,
    ],
  },
};
