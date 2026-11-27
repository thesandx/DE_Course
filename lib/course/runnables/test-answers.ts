/**
 * Other answers for the runnable problems, for the tests only. `pass` holds
 * correct answers that differ from the reference solution: the grader must
 * accept them. `fail` holds the usual mistakes: the hidden tests must catch
 * them. Together they show that the tests judge the contract, not one way
 * of writing it.
 */
export interface SpecAnswers {
  pass?: readonly string[];
  fail?: readonly string[];
}

export const TEST_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'driver-longest-streak': {
    pass: [
      `WITH days AS (
  SELECT DISTINCT driver_id, online_at::date AS day FROM driver_sessions
), g AS (
  SELECT driver_id, day, day - (ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY day))::int AS grp FROM days
), runs AS (
  SELECT driver_id, MIN(day) AS start_day, MAX(day) AS end_day, COUNT(*) AS length FROM g GROUP BY 1, grp
)
SELECT DISTINCT ON (driver_id) driver_id, start_day, end_day, length
FROM runs ORDER BY driver_id, length DESC, end_day DESC;`,
    ],
    fail: [
      // Counts sessions, not distinct days, so two sessions on one day break the run.
      `WITH g AS (
  SELECT driver_id, online_at::date AS day,
         online_at::date - (ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY online_at))::int AS grp
  FROM driver_sessions
), runs AS (
  SELECT driver_id, MIN(day) AS start_day, MAX(day) AS end_day, COUNT(*) AS length FROM g GROUP BY 1, grp
)
SELECT DISTINCT ON (driver_id) driver_id, start_day, end_day, length
FROM runs ORDER BY driver_id, length DESC, end_day DESC;`,
      // Breaks ties toward the earlier run.
      `WITH days AS (
  SELECT DISTINCT driver_id, online_at::date AS day FROM driver_sessions
), g AS (
  SELECT driver_id, day, day - (ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY day))::int AS grp FROM days
), runs AS (
  SELECT driver_id, MIN(day) AS start_day, MAX(day) AS end_day, COUNT(*) AS length FROM g GROUP BY 1, grp
)
SELECT DISTINCT ON (driver_id) driver_id, start_day, end_day, length
FROM runs ORDER BY driver_id, length DESC, end_day ASC;`,
    ],
  },
  'dsa-pair-with-target': {
    pass: [
      `def pair_with_target(amounts, target):
    order = sorted(range(len(amounts)), key=lambda k: amounts[k])
    lo, hi = 0, len(order) - 1
    while lo < hi:
        total = amounts[order[lo]] + amounts[order[hi]]
        if total == target:
            return order[lo], order[hi]
        if total < target:
            lo += 1
        else:
            hi -= 1
    return None
`,
    ],
    fail: [
      // Lets a payment pair with itself.
      `def pair_with_target(amounts, target):
    seen = {}
    for i, amount in enumerate(amounts):
        seen[amount] = i
        if target - amount in seen:
            return seen[target - amount], i
    return None
`,
      // Checks every pair: right, but too slow for the big list.
      `def pair_with_target(amounts, target):
    for i in range(len(amounts)):
        for j in range(i + 1, len(amounts)):
            if amounts[i] + amounts[j] == target:
                return i, j
    return None
`,
    ],
  },
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
