import type { Company, Lesson, Problem } from '@/types/course';

/**
 * pandas, at the depth a data engineer interview needs. One lesson and five
 * problems that join the Python track in `python.ts`.
 *
 * Every snippet here ran on pandas 3.0.
 */

export const pandasLessons: readonly Lesson[] = [
  {
    slug: 'pandas-for-interviews',
    title: 'pandas for interviews: the small part you need',
    summary:
      'Write the six pandas operations that interviews ask for, translate SQL to pandas, and say when pandas is the wrong tool.',
    minutes: 15,
    body: `
      pandas is a small part of a senior data engineer loop. Most coding rounds want plain
      Python or PySpark. But some rounds let you choose pandas for a data task, and Spark
      rounds ask about pandas UDFs and «toPandas()». This lesson is the whole of what you
      need. If you can write one transformation in SQL, PySpark and pandas, you are covered.

      ## The mental model

      A **DataFrame** is a table held in memory on **one machine**. Each column is a
      **Series**: a typed array with an index. Operations on a whole column run in compiled
      code and are fast. A Python loop over the rows is slow.

      ## SQL to pandas

      Each SQL clause has one pandas form. The comment is the SQL.

      ~~~python
      # SELECT a, b
      df[["a", "b"]]

      # WHERE amount > 100 AND city = 'BLR'
      df[(df["amount"] > 100) & (df["city"] == "BLR")]

      # ORDER BY amount DESC
      df.sort_values("amount", ascending=False)

      # GROUP BY city, with aggregates
      df.groupby("city", as_index=False).agg(revenue=("amount", "sum"))

      # LEFT JOIN other ON key
      df.merge(other, on="key", how="left")

      # ROW_NUMBER() OVER (PARTITION BY city ORDER BY ...)
      df.groupby("city").cumcount() + 1

      # SUM(amount) OVER (PARTITION BY city ORDER BY ...)
      df.groupby("city")["amount"].cumsum()

      # LAG(amount) OVER (PARTITION BY city ORDER BY ...)
      df.groupby("city")["amount"].shift(1)

      # COALESCE(amount, 0)
      df["amount"].fillna(0)

      # CASE WHEN amount >= 1000 THEN 'large' ELSE 'small' END
      np.where(df["amount"] >= 1000, "large", "small")

      # SELECT DISTINCT *
      df.drop_duplicates()
      ~~~

      In a filter, use «&», «|» and «~», and put each condition in brackets. The Python
      words «and» and «or» raise an error on a Series.

      ## Read, filter, aggregate

      ~~~python
      import pandas as pd

      orders = pd.read_csv(orders_path, parse_dates=["ordered_at"])

      delivered = orders[orders["status"] == "DELIVERED"]

      by_city = (delivered
                 .groupby("city", as_index=False)
                 .agg(orders=("order_id", "count"),
                      revenue=("amount", "sum"),
                      customers=("customer_id", "nunique"))
                 .sort_values("revenue", ascending=False))
      ~~~

      The named form of «agg», «new_name=(column, function)», gives flat column names. It is
      the form to use in an interview. «as_index=False» keeps «city» as a normal column.

      ## Join

      ~~~python
      enriched = orders.merge(customers, on="customer_id", how="left", validate="many_to_one")

      never_ordered = (customers
                       .merge(orders[["customer_id"]].drop_duplicates(),
                              on="customer_id", how="left", indicator=True)
                       .query("_merge == 'left_only'")
                       .drop(columns="_merge"))
      ~~~

      «validate="many_to_one"» raises an error if «customers» has a duplicate key. It is the
      cheapest guard against a join that multiplies rows. «indicator=True» adds a «_merge»
      column, which gives you an anti join.

      ## Nulls and duplicates

      ~~~python
      clean = (orders
               .drop_duplicates(subset="order_id", keep="last")
               .assign(amount=lambda d: d["amount"].fillna(0))
               .dropna(subset=["customer_id"]))
      ~~~

      A missing value is «NaN» or «pd.NA». It never equals anything, itself included, so test
      with «isna()» and «notna()». «groupby» **drops rows whose key is null** unless you pass
      «dropna=False». That is a common source of a wrong total.

      ## Vectorise; do not loop

      ~~~python
      import numpy as np

      orders["size"] = np.where(orders["amount"] >= 1000, "large", "small")
      ~~~

      | Way | Speed on 1 million rows |
      |---|---|
      | A column expression, «np.where», «.str» and «.dt» methods | Milliseconds |
      | «df.apply(func, axis=1)» | Seconds: a Python call for each row |
      | «for i, row in df.iterrows()» | Slowest: it also builds a Series for each row |

      ## Windows inside a group

      ~~~python
      orders = orders.sort_values(["customer_id", "ordered_at"])
      by_customer = orders.groupby("customer_id")

      orders["order_number"] = by_customer.cumcount() + 1
      orders["running_total"] = by_customer["amount"].cumsum()
      orders["previous_amount"] = by_customer["amount"].shift(1)
      ~~~

      Sort first. «cumsum», «cumcount» and «shift» work in row order inside each group.
      «transform» returns a value for each row, such as a share of the group total:
      «orders["amount"] / by_customer["amount"].transform("sum")».

      ## When pandas is the wrong tool

      - **Memory.** pandas loads everything. A CSV often needs 2 to 5 times its file size in
        memory. A 10 GB file does not fit on a 16 GB machine.
      - **One core.** Most operations use a single core.
      - **What to say instead.** Read in chunks for a simple aggregate. Use **DuckDB** or
        **Polars** for tens of gigabytes on one machine. Use **Spark** when the data needs a
        cluster. Read only the columns you need, from Parquet, in every case.

      In Spark, «toPandas()» pulls the whole DataFrame into the driver's memory. Aggregate or
      limit first. A **pandas UDF** is different: Spark sends batches through Arrow to pandas
      on each executor, so the data stays distributed.

      > [!senior] What a senior answer adds
      > Check the join and the grain as you write: "I pass «validate» to the merge, and I
      > compare the row count before and after." Then state the limit: "This is fine for a
      > few gigabytes. Past that I would move it to DuckDB or Spark, with the same logic."

      > [!trap] pandas 3 changed two defaults
      > Text columns now use a real string type, not «object». And an edit of a filtered
      > copy never changes the original, so write «df.loc[mask, "col"] = value» or use
      > «assign». Chained assignment such as «df[mask]["col"] = value» does nothing.
    `,
    checks: [
      {
        question: 'Which line filters orders above 100 in the city BLR correctly?',
        options: [
          'df[df["amount"] > 100 and df["city"] == "BLR"]',
          'df[(df["amount"] > 100) & (df["city"] == "BLR")]',
          'df[df["amount"] > 100 & df["city"] == "BLR"]',
          'df.where("amount > 100 and city = BLR")',
        ],
        answer: 1,
        why: 'A Series needs the element-wise operator &, and each condition needs brackets because & binds tighter than a comparison.',
      },
      {
        question: 'Why is df.apply(func, axis=1) slow on a large DataFrame?',
        options: [
          'It writes to disk',
          'It calls a Python function once for each row instead of running on whole columns',
          'It sorts the DataFrame first',
          'It uses every core',
        ],
        answer: 1,
        why: 'Column operations run in compiled code over the whole array. A row-wise apply pays the cost of a Python call, and of building a row object, for every row.',
      },
      {
        question: 'A groupby total is lower than the sum of the column. What is a likely cause?',
        options: [
          'groupby drops rows whose key is null by default',
          'groupby rounds the values',
          'sum ignores negative numbers',
          'The DataFrame is not sorted',
        ],
        answer: 0,
        why: 'Rows with a null group key are left out unless you pass dropna=False, so their amounts are missing from the result.',
      },
    ],
  },
];

/** The loops where a data-manipulation round may accept pandas. */
const PANDAS_LOOPS: readonly Company[] = ['amazon', 'walmart', 'swiggy', 'microsoft'];

export const pandasProblems: readonly Problem[] = [
  {
    slug: 'pandas-sql-to-pandas',
    title: 'Translate a SQL query to pandas',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: PANDAS_LOOPS,
    prompt: `
      Write this query in pandas. «orders» and «customers» are DataFrames with the same
      columns as the tables.

      ~~~sql
      SELECT c.segment,
             COUNT(*)                      AS orders,
             COUNT(DISTINCT o.customer_id) AS customers,
             SUM(o.amount)                 AS revenue
      FROM orders o
      JOIN customers c ON c.customer_id = o.customer_id
      WHERE o.status = 'DELIVERED'
      GROUP BY c.segment
      HAVING SUM(o.amount) > 1000
      ORDER BY revenue DESC;
      ~~~
    `,
    hints: [
      'Follow the order in which SQL runs: FROM and JOIN, WHERE, GROUP BY, HAVING, ORDER BY.',
      'Filter before the merge. It is the same result with less data.',
      'HAVING is a filter on the aggregated DataFrame.',
    ],
    answer: `
      ~~~python
      delivered = orders[orders["status"] == "DELIVERED"]

      result = (delivered
                .merge(customers, on="customer_id", how="inner", validate="many_to_one")
                .groupby("segment", as_index=False)
                .agg(orders=("order_id", "count"),
                     customers=("customer_id", "nunique"),
                     revenue=("amount", "sum"))
                .query("revenue > 1000")
                .sort_values("revenue", ascending=False))
      ~~~

      Each clause maps to one step:

      - **WHERE** is a boolean filter, done before the join so less data is merged.
      - **JOIN** is «merge». «validate="many_to_one"» fails loudly if a customer appears twice.
      - **GROUP BY** with named aggregates gives the three output columns.
      - **HAVING** is a filter after the aggregation; «query» keeps the chain readable.

      One difference from SQL: «COUNT(*)» counts rows, and pandas «count» on a column skips
      nulls. «order_id» is never null here, so the two agree. Use «"size"» when a column can
      be null.
    `,
    signals: [
      'Maps each SQL clause to a pandas step in execution order',
      'Uses named aggregation and nunique',
      'Guards the join with validate',
      'Knows that count skips nulls and size does not',
    ],
    followUps: ['Change the join to keep customers with no delivered order, with a revenue of 0.'],
  },
  {
    slug: 'pandas-top-n-per-group',
    title: 'Top 2 orders in each city with pandas',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: PANDAS_LOOPS,
    prompt: `
      «orders(order_id, city, amount)» is a DataFrame. Return the 2 largest orders of each
      city. Then say how you would return ties as well.
    `,
    hints: [
      'Sort, then take the first rows of each group.',
      'For ties you need a rank, not a row count.',
    ],
    answer: `
      Sort once, then take the head of each group.

      ~~~python
      top2 = (orders
              .sort_values(["city", "amount", "order_id"], ascending=[True, False, True])
              .groupby("city")
              .head(2))
      ~~~

      «order_id» in the sort makes the choice between equal amounts repeatable. This is
      «ROW_NUMBER() <= 2».

      To keep ties, rank inside the group and filter on the rank. This is «DENSE_RANK() <= 2».

      ~~~python
      ranked = orders.assign(
          position=orders.groupby("city")["amount"].rank(method="dense", ascending=False))
      top2_with_ties = ranked[ranked["position"] <= 2]
      ~~~

      Do not use «groupby("city").apply(lambda g: g.nlargest(2, "amount"))». It gives the same
      rows, but it calls Python once for each group and is slow with many groups.
    `,
    signals: [
      'Uses sort_values with groupby().head()',
      'Adds a tie-breaker to the sort',
      'Uses rank(method="dense") for ties',
      'Avoids groupby().apply() and says why',
    ],
    followUps: ['Return the top 10 percent of orders in each city.'],
  },
  {
    slug: 'pandas-running-total-and-gap',
    title: 'Running spend and days since the last order',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: PANDAS_LOOPS,
    prompt: `
      «orders(customer_id, ordered_at, amount)» has «ordered_at» as a datetime. Add three
      columns: the order number of each customer, the running spend of the customer, and the
      days since the customer's previous order.
    `,
    hints: [
      'Sort by customer and time first.',
      'cumcount, cumsum and shift all work inside a groupby.',
      'Subtracting two datetime columns gives a timedelta.',
    ],
    answer: `
      ~~~python
      orders = orders.sort_values(["customer_id", "ordered_at"])
      by_customer = orders.groupby("customer_id")

      orders = orders.assign(
          order_number=by_customer.cumcount() + 1,
          running_spend=by_customer["amount"].cumsum(),
          days_since_previous=(orders["ordered_at"]
                               - by_customer["ordered_at"].shift(1)).dt.days,
      )
      ~~~

      - The sort is required. The cumulative functions follow the row order inside each group.
      - «shift(1)» inside the group is «LAG». The first order of a customer gets a missing
        value, which is correct: it has no previous order.
      - «.dt.days» turns the timedelta into whole days. Use «.dt.total_seconds() / 86400» for
        a fraction.

      The SQL form is «ROW_NUMBER()», «SUM(amount) OVER (... ORDER BY ordered_at)» and
      «ordered_at - LAG(ordered_at) OVER (...)», all partitioned by «customer_id».
    `,
    signals: [
      'Sorts before the cumulative operations',
      'Uses cumcount, cumsum and shift inside a groupby',
      'Leaves the first row of a group as missing',
      'Gives the window function equivalents',
    ],
    followUps: ['Flag the customers whose longest gap between orders is above 30 days.'],
  },
  {
    slug: 'pandas-vectorise-apply',
    title: 'Speed up a row-by-row apply',
    track: 'python',
    kind: 'coding',
    difficulty: 'easy',
    companies: PANDAS_LOOPS,
    prompt: `
      This code takes 4 minutes on 20 million rows. Rewrite it so that it runs in about a
      second, and explain the difference.

      ~~~python
      def fee(row):
          if row["method"] == "CARD":
              return row["amount"] * 0.02
          if row["method"] == "UPI":
              return 0.0
          return 5.0

      payments["fee"] = payments.apply(fee, axis=1)
      ~~~
    `,
    hints: [
      'The function is a CASE WHEN. Which NumPy function takes a list of conditions?',
      'Each condition must be a boolean column.',
    ],
    answer: `
      Express the rule on whole columns.

      ~~~python
      import numpy as np

      payments["fee"] = np.select(
          [payments["method"] == "CARD", payments["method"] == "UPI"],
          [payments["amount"] * 0.02, 0.0],
          default=5.0,
      )
      ~~~

      «np.select» takes the conditions in order, the value for each one, and a default. It is
      a «CASE WHEN».

      Why it is faster: «apply(axis=1)» builds a row object and calls a Python function 20
      million times. The vectorised form runs three comparisons and one multiplication, each
      as one loop in compiled code over a contiguous array.

      A missing «method» gives 5.0 in both versions, because a comparison with a missing value
      is false. Ask whether that is the rule that the business wants.
    `,
    signals: [
      'Replaces apply with np.select or np.where',
      'Explains the per-row Python call cost',
      'Checks that the null behaviour is the same',
    ],
    followUps: ['The rule needs a lookup in a 500-row fee table. How do you keep it vectorised?'],
  },
  {
    slug: 'pandas-file-too-big',
    title: 'Aggregate a file that does not fit in memory',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: PANDAS_LOOPS,
    prompt: `
      A 40 GB CSV file «payments.csv» has the columns «customer_id», «amount» and 30 others.
      Your machine has 16 GB of memory. Compute the total amount and the number of payments
      for each customer with pandas. Then say what you would use in production.
    `,
    hints: [
      'read_csv can return an iterator of smaller DataFrames.',
      'Read only the two columns you need.',
      'Sums and counts can be added across chunks. Can an average?',
    ],
    answer: `
      Read the file in chunks, keep only two columns, aggregate each chunk, and combine the
      partial results.

      ~~~python
      import pandas as pd

      parts = []
      reader = pd.read_csv(payments_path,
                           usecols=["customer_id", "amount"],
                           dtype={"customer_id": "int64", "amount": "float64"},
                           chunksize=5_000_000)
      for chunk in reader:
          parts.append(chunk.groupby("customer_id")["amount"].agg(["sum", "count"]))

      totals = (pd.concat(parts)
                .groupby(level=0)
                .sum()
                .rename(columns={"sum": "total_amount", "count": "payments"}))
      ~~~

      - «usecols» and «dtype» cut the memory for each chunk to two numeric columns.
      - Each chunk is reduced to one row for each customer before the next one is read.
      - **Sum and count combine** across chunks by a second sum. An **average does not**:
        compute it at the end as total ÷ count. A distinct count and a median do not combine
        this way either.

      This works while the result, one row for each customer, fits in memory.

      **In production** I would not use pandas here. DuckDB runs
      «SELECT customer_id, SUM(amount), COUNT(*) FROM 'payments.csv' GROUP BY 1» on the same
      machine, in parallel, and spills to disk. I would also convert the file to Parquet once,
      so that later reads touch only the columns they need. Past a few hundred gigabytes, or
      with many such jobs, it belongs in Spark or the warehouse.
    `,
    signals: [
      'Uses chunksize with usecols and dtype',
      'Reduces each chunk before reading the next',
      'Knows which aggregates combine across chunks and which do not',
      'Names DuckDB, Parquet or Spark as the production choice, with a reason',
    ],
    followUps: ['The result itself has 2 billion customers and does not fit in memory. What now?'],
  },
];
