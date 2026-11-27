import { PYSPARK_RUNNABLES, SPARK_HELPERS } from '@/lib/course/runnables/spark-pyspark';
import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the Spark track. The code runs on the PySpark API in
 * the browser: `pyspark_shim.py` compiles DataFrame calls to DuckDB SQL. The
 * sample DataFrames exist before the learner's code runs; the code builds
 * `result`, and the tests compare its rows in any order. The PySpark problems
 * of the track are in `spark-pyspark.ts`.
 */

const EVENT_COLUMNS = [
  { name: 'user_id', type: 'string' },
  { name: 'ts', type: 'timestamp' },
] as const;

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

  'spark-sessionize-events': {
    language: 'pyspark',
    task: `«events» has «user_id» and «ts», a timestamp, in no order. A session ends after more than 30 minutes without an event: a gap of exactly 30 minutes stays in the session. Build «result»: «events» with «session_id». All events of one session have the same id, and two sessions never share an id, also across users. Keep the three columns «user_id, ts, session_id».`,
    tables: [
      {
        name: 'events',
        columns: EVENT_COLUMNS,
        rows: [
          ['u2', '2026-11-02 00:10:00'],
          ['u1', '2026-11-01 09:40:00'],
          ['u1', '2026-11-01 09:00:00'],
          ['u3', '2026-11-01 12:00:00'],
          ['u1', '2026-11-01 10:20:00'],
          ['u2', '2026-11-01 23:50:00'],
          ['u1', '2026-11-01 09:10:00'],
          ['u2', '2026-11-02 01:00:00'],
          ['u1', '2026-11-01 10:11:00'],
        ],
      },
    ],
    helpers: `${SPARK_HELPERS}


_GAP = timedelta(minutes=30)


def _when(ts):
    return ts.strftime("%Y-%m-%d %H:%M:%S")


def _gap_text(gap):
    minutes, seconds = divmod(int(gap.total_seconds()), 60)
    hours, minutes = divmod(minutes, 60)
    parts = ["%d h" % hours] if hours else []
    if minutes:
        parts.append("%d min" % minutes)
    if seconds or not parts:
        parts.append("%d s" % seconds)
    return " ".join(parts)


def check_sessions():
    """The ids group the events like the 30-minute rule, and no two sessions share one."""
    frame = answer("user_id", "ts", "session_id")
    if isinstance(frame, Verdict):
        return frame
    by_user = {}
    for user_id, ts, session_id in (tuple(row) for row in frame.collect()):
        if not isinstance(ts, datetime):
            return verdict(False, "Keep ts a timestamp. Yours holds %s values." % type(ts).__name__)
        if session_id is None:
            return verdict(False, "The event of %s at %s has no session_id. Every event needs one." % (user_id, _when(ts)))
        by_user.setdefault(user_id, []).append((ts, session_id))
    owner = {}
    expected = []
    for user_id in sorted(by_user, key=str):
        previous = start = None
        for ts, session_id in sorted(by_user[user_id], key=lambda item: item[0]):
            if previous is not None:
                gap = ts - previous[0]
                if gap > _GAP and session_id == previous[1]:
                    return verdict(False, "%s: the events at %s and %s are %s apart, so the second one starts a new session. Both have the session_id %s." % (user_id, _when(previous[0]), _when(ts), _gap_text(gap), session_id))
                if gap <= _GAP and session_id != previous[1]:
                    hint = " Only a gap of more than 30 minutes ends a session." if gap == _GAP else ""
                    return verdict(False, "%s: the events at %s and %s are %s apart, so they are in one session. Their session ids differ: %s and %s.%s" % (user_id, _when(previous[0]), _when(ts), _gap_text(gap), previous[1], session_id, hint))
            if previous is None or ts - previous[0] > _GAP:
                start = ts
                other = owner.setdefault(session_id, (user_id, ts))
                if other != (user_id, ts):
                    if other[0] == user_id:
                        return verdict(False, "%s has two sessions with the session_id %s: one from %s and one from %s." % (user_id, session_id, _when(other[1]), _when(ts)))
                    return verdict(False, 'Two sessions share the session_id %s: one of %s from %s, and one of %s from %s. Make the id unique across users, for example with F.concat_ws("-", ...), which keeps a separator between the user id and the number.' % (session_id, other[0], _when(other[1]), user_id, _when(ts)))
            expected.append((user_id, ts, start))
            previous = (ts, session_id)
    return spark.createDataFrame(expected, "user_id string, ts timestamp, session_start timestamp")`,
    starter: `from pyspark.sql import Window, functions as F

# events: user_id, ts (a timestamp), in no order
result = events  # add session_id: a new session after more than 30 minutes without an event

result.show()
`,
    solution: `from pyspark.sql import Window, functions as F

w = Window.partitionBy("user_id").orderBy("ts")
gap_s = F.col("ts").cast("long") - F.lag("ts").over(w).cast("long")

result = (events
          .withColumn("new_session", F.when(gap_s.isNull() | (gap_s > 1800), 1).otherwise(0))
          .withColumn("session_no", F.sum("new_session").over(
              w.rowsBetween(Window.unboundedPreceding, Window.currentRow)))
          .withColumn("session_id", F.concat_ws("-", "user_id", "session_no"))
          .drop("new_session", "session_no"))
`,
    cases: [
      {
        name: 'Sample',
        note: 'u1: 09:10 to 09:40 is exactly 30 minutes, so it is one session. 09:40 to 10:11 is 31 minutes: a new session. The first session of u2 goes past midnight.',
        check: 'check_sessions()',
      },
      {
        name: 'User ids that run together',
        hidden: true,
        note: 'u1 has 12 sessions and u11 has 2. Without a separator, u1 with session 12 and u11 with session 2 both give u112.',
        setup: `rows = [("u1", datetime(2026, 11, 1) + timedelta(hours=2 * n)) for n in range(12)]
rows += [("u11", datetime(2026, 11, 1) + timedelta(hours=3 * n)) for n in range(2)]
events = spark.createDataFrame(rows, "user_id string, ts timestamp")`,
        check: 'check_sessions()',
      },
      {
        name: 'Thirty minutes and one second',
        hidden: true,
        note: 'A gap of 30 minutes and 1 second ends the session. Compare seconds, not whole minutes.',
        setup: `start = datetime(2026, 11, 1, 8)
rows = []
for gap in [0, 1801, 899, 1800, 1830, 1799, 1801]:
    start = start + timedelta(seconds=gap)
    rows.append(("u5", start))
events = spark.createDataFrame(rows, "user_id string, ts timestamp")`,
        check: 'check_sessions()',
      },
      {
        name: 'Three thousand events',
        hidden: true,
        setup: `import random
rng = random.Random(3)
gaps = [60, 300, 900, 1740, 1800, 1801, 1860, 7200, 259200]
rows = []
for user in range(60):
    ts = datetime(2026, 11, 1) + timedelta(seconds=rng.randint(0, 86400))
    for n in range(50):
        ts = ts + timedelta(seconds=rng.choice(gaps))
        rows.append(("u%d" % user, ts))
rng.shuffle(rows)
events = spark.createDataFrame(rows, "user_id string, ts timestamp")`,
        check: 'check_sessions()',
      },
    ],
  },

  'spark-udf-blocks-pruning': {
    language: 'pyspark',
    task: `«lake.events» is a table partitioned by «event_date», a string such as «2026-11-01». The starter code keeps one day with a Python UDF, so its scan reads every partition. Rewrite it with no Python UDF, so that the scan reads only the partition of «2026-11-01». Keep «daily»: the events of that day joined to «cities» on «city_id», with the columns «city_id, event_id, amount, event_date, city». Call «daily.explain()» to see the scan's PartitionFilters and how many partitions it reads.`,
    tables: [
      {
        name: 'cities',
        columns: [
          { name: 'city_id', type: 'int' },
          { name: 'city', type: 'string' },
        ],
        rows: [
          [1, 'Pune'],
          [2, 'Delhi'],
          [3, 'Goa'],
          [4, 'Agra'],
          [5, 'Kochi'],
        ],
      },
    ],
    setup: `import random

# lake.events: 30 days of events, one partition for each event_date
rng = random.Random(7)
rows = []
for day in range(30):
    event_date = (date(2026, 10, 3) + timedelta(days=day)).isoformat()
    for n in range(20):
        rows.append((day * 100 + n, rng.randint(1, 5), round(rng.uniform(50, 900), 2), event_date))
(spark.createDataFrame(rows, "event_id long, city_id int, amount double, event_date string")
    .write.mode("overwrite").partitionBy("event_date").saveAsTable("lake.events"))`,
    helpers: `${SPARK_HELPERS}


def check_pruning():
    """daily calls no Python UDF and its scan reads one partition of lake.events."""
    frame = answer("city_id", "event_id", "amount", "event_date", "city", name="daily")
    if isinstance(frame, Verdict):
        return frame
    if _shim._uses_udf(frame):
        return verdict(False, 'daily still calls a Python UDF. Catalyst cannot see inside a UDF, so it cannot make it a partition filter. Compare the column with a built-in expression, such as F.col("event_date") == "2026-11-01".')
    scans = [scan for scan in frame._plan.scans() if scan.table == "lake.events"]
    if not scans:
        return verdict(False, 'The plan of daily has no scan of lake.events, so it shows no partition filter. Start from spark.table("lake.events") and use DataFrame methods: here the plan shows pruning for the DataFrame API, not for spark.sql.')
    scan = scans[0]
    if scan.partitions_read > 1:
        if not scan.partition_filters:
            return verdict(False, "The scan of lake.events reads all %d partitions: its PartitionFilters list is empty. Filter event_date with a column expression." % scan.all_partitions)
        return verdict(False, "The scan of lake.events reads %d of %d partitions. Keep only the event_date 2026-11-01." % (scan.partitions_read, scan.all_partitions))
    return frame`,
    starter: `from pyspark.sql import functions as F
from pyspark.sql.types import BooleanType


@F.udf(returnType=BooleanType())
def is_target_day(d):
    return d == "2026-11-01"


events = spark.table("lake.events")
daily = events.filter(is_target_day("event_date")).join(cities, "city_id")

daily.explain()
daily.show()
`,
    solution: `from pyspark.sql import functions as F

events = spark.table("lake.events")
daily = (events
         .filter(F.col("event_date") == "2026-11-01")
         .join(F.broadcast(cities), "city_id"))
`,
    cases: [
      {
        name: 'The events of 2026-11-01',
        note: 'Right rows. The starter code passes this one, but it reads all 30 partitions to find them.',
        check: 'answer("city_id", "event_id", "amount", "event_date", "city", name="daily")',
      },
      {
        name: 'Reads one partition',
        note: 'The scan must read 1 of the 30 partitions, with no Python UDF in the plan.',
        check: 'check_pruning()',
      },
      {
        name: 'Ninety days of data',
        hidden: true,
        note: 'With 90 partitions, the scan must still read only one. City 6 has no row in cities, so its events drop out of the inner join.',
        setup: `rng = random.Random(70)
rows = []
for day in range(90):
    event_date = (date(2026, 8, 4) + timedelta(days=day)).isoformat()
    for n in range(rng.randint(5, 40)):
        rows.append((day * 1000 + n, rng.randint(1, 6), round(rng.uniform(10, 2000), 2), event_date))
(spark.createDataFrame(rows, "event_id long, city_id int, amount double, event_date string")
    .write.mode("overwrite").partitionBy("event_date").saveAsTable("lake.events"))`,
        check: 'check_pruning()',
      },
    ],
  },

  ...PYSPARK_RUNNABLES,
};
