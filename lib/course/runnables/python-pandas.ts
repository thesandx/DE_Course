import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the pandas problems of the Python track. The tables
 * load as DataFrames of the same name, and the code puts its answer in a
 * new name such as `result`, or returns it from a function: a test reads
 * the inputs as the setup made them, so a change to `orders` itself is
 * not seen.
 *
 * A DataFrame compares by its columns in order and its rows. A named index,
 * such as the key of a groupby, counts as columns; an unnamed index is row
 * numbers and does not count. Column names do not need to match.
 */
export const PANDAS_RUNNABLES: Record<string, RunnableSpec> = {
  'pandas-sql-to-pandas': {
    language: 'python',
    task: `Translate the query to pandas and put the answer in «result»: a DataFrame with the columns «segment», «orders», «customers» and «revenue», in that order, one row for each segment whose delivered revenue is over 1000, sorted by «revenue» from high to low.`,
    tables: [
      {
        name: 'orders',
        columns: [
          { name: 'order_id', type: 'int' },
          { name: 'customer_id', type: 'int' },
          { name: 'status', type: 'str' },
          { name: 'amount', type: 'float' },
        ],
        rows: [
          [101, 1, 'DELIVERED', 400],
          [102, 1, 'DELIVERED', 350],
          [103, 3, 'DELIVERED', 500],
          [104, 3, 'CANCELLED', 900],
          [105, 2, 'DELIVERED', 900],
          [106, 5, 'DELIVERED', 200],
          [107, 5, 'RETURNED', 300],
          [108, 4, 'DELIVERED', 250],
          [109, 6, 'DELIVERED', 300],
          [110, 99, 'DELIVERED', 5000],
          [111, 2, 'DELIVERED', 150],
          [112, 1, 'DELIVERED', 100],
          [113, 7, 'DELIVERED', 50],
        ],
      },
      {
        name: 'customers',
        columns: [
          { name: 'customer_id', type: 'int' },
          { name: 'segment', type: 'str' },
        ],
        rows: [
          [1, 'SMB'],
          [2, 'ENTERPRISE'],
          [3, 'SMB'],
          [4, 'CONSUMER'],
          [5, 'ENTERPRISE'],
          [6, 'CONSUMER'],
          [7, 'SMB'],
        ],
      },
    ],
    starter: `import pandas as pd

# SELECT c.segment, COUNT(*) AS orders, COUNT(DISTINCT o.customer_id) AS customers,
#        SUM(o.amount) AS revenue
# FROM orders o JOIN customers c ON c.customer_id = o.customer_id
# WHERE o.status = 'DELIVERED'
# GROUP BY c.segment HAVING SUM(o.amount) > 1000
# ORDER BY revenue DESC;
result = None

print(result)
`,
    solution: `delivered = orders[orders["status"] == "DELIVERED"]

result = (delivered
          .merge(customers, on="customer_id", how="inner", validate="many_to_one")
          .groupby("segment", as_index=False)
          .agg(orders=("order_id", "count"),
               customers=("customer_id", "nunique"),
               revenue=("amount", "sum"))
          .query("revenue > 1000")
          .sort_values("revenue", ascending=False))
`,
    cases: [
      {
        name: 'Sample',
        note: 'Order 110 has no customer, so the join drops it. CONSUMER has 550 and fails the HAVING.',
      },
      {
        name: 'Exactly 1000 is not over 1000',
        tables: [
          {
            name: 'orders',
            columns: [
              { name: 'order_id', type: 'int' },
              { name: 'customer_id', type: 'int' },
              { name: 'status', type: 'str' },
              { name: 'amount', type: 'float' },
            ],
            rows: [
              [1, 4, 'DELIVERED', 600],
              [2, 6, 'DELIVERED', 400],
              [3, 1, 'DELIVERED', 1000.5],
              [4, 2, 'DELIVERED', 2000],
            ],
          },
        ],
      },
      {
        name: 'COUNT(*) counts a row with a missing amount',
        hidden: true,
        note: 'SUM skips the missing amount, and COUNT(*) still counts the order.',
        tables: [
          {
            name: 'orders',
            columns: [
              { name: 'order_id', type: 'int' },
              { name: 'customer_id', type: 'int' },
              { name: 'status', type: 'str' },
              { name: 'amount', type: 'float' },
            ],
            rows: [
              [1, 1, 'DELIVERED', 900],
              [2, 3, 'DELIVERED', null],
              [3, 7, 'DELIVERED', 300],
              [4, 2, 'DELIVERED', 1500],
            ],
          },
        ],
      },
      {
        name: 'Two thousand random orders',
        hidden: true,
        setup: `import numpy as np
rng = np.random.default_rng(12)
customers = pd.DataFrame({
    "customer_id": np.arange(1, 301),
    "segment": rng.choice(["SMB", "ENTERPRISE", "CONSUMER", "PUBLIC"], 300),
})
orders = pd.DataFrame({
    "order_id": np.arange(1, 2001),
    "customer_id": rng.integers(1, 321, 2000),
    "status": rng.choice(["DELIVERED", "DELIVERED", "CANCELLED", "RETURNED"], 2000),
    "amount": rng.integers(100, 100_000, 2000) / 100,
})`,
      },
    ],
  },

  'pandas-top-n-per-group': {
    language: 'python',
    task: `«orders» has the columns «order_id», «city» and «amount». Set «top2» to the 2 largest orders of each city; when amounts are equal, the smaller «order_id» wins. Set «top2_with_ties» to every order whose amount is one of the 2 largest distinct amounts of its city, like «DENSE_RANK() <= 2». Both keep the three columns of «orders», in any row order. Both must stay fast with thousands of cities.`,
    tables: [
      {
        name: 'orders',
        columns: [
          { name: 'order_id', type: 'int' },
          { name: 'city', type: 'str' },
          { name: 'amount', type: 'float' },
        ],
        rows: [
          [1, 'blr', 500],
          [2, 'blr', 900],
          [3, 'blr', 700],
          [4, 'del', 300],
          [9, 'del', 300],
          [5, 'del', 300],
          [6, 'del', 100],
          [7, 'bom', 800],
          [8, 'blr', 900],
        ],
      },
    ],
    starter: `import pandas as pd

# The 2 largest orders of each city. Equal amounts: the smaller order_id wins.
top2 = None

# Every order whose amount is one of the 2 largest distinct amounts of its city.
top2_with_ties = None

print(top2)
print(top2_with_ties)
`,
    solution: `top2 = (orders
        .sort_values(["city", "amount", "order_id"], ascending=[True, False, True])
        .groupby("city")
        .head(2))

ranked = orders.assign(
    position=orders.groupby("city")["amount"].rank(method="dense", ascending=False))
top2_with_ties = ranked[ranked["position"] <= 2].drop(columns="position")
`,
    cases: [
      {
        name: 'Sample',
        note: 'Delhi has three orders of 300. Orders 4 and 5 win, because their ids are smaller than 9.',
        check: 'top2',
        order: 'any',
      },
      {
        name: 'Ties keep the smaller order_id',
        tables: [
          {
            name: 'orders',
            columns: [
              { name: 'order_id', type: 'int' },
              { name: 'city', type: 'str' },
              { name: 'amount', type: 'float' },
            ],
            rows: [
              [30, 'pune', 50],
              [10, 'pune', 50],
              [20, 'pune', 50],
              [40, 'pune', 10],
            ],
          },
        ],
        check: 'top2',
        order: 'any',
      },
      {
        name: 'Every order in the top two amounts',
        note: 'Bengaluru: both orders of 900, then 700. Delhi: all three orders of 300, then 100.',
        check: 'top2_with_ties',
        order: 'any',
      },
      {
        name: 'A city with one order',
        hidden: true,
        tables: [
          {
            name: 'orders',
            columns: [
              { name: 'order_id', type: 'int' },
              { name: 'city', type: 'str' },
              { name: 'amount', type: 'float' },
            ],
            rows: [
              [1, 'goa', 70],
              [2, 'kochi', 20],
              [3, 'kochi', 90],
              [4, 'kochi', 50],
            ],
          },
        ],
        check: 'top2',
        order: 'any',
      },
      {
        name: 'Many ties',
        hidden: true,
        setup: `import numpy as np
rng = np.random.default_rng(3)
orders = pd.DataFrame({
    "order_id": rng.permutation(np.arange(1, 601)),
    "city": rng.choice(["blr", "del", "bom", "hyd", "pune"], 600),
    "amount": rng.integers(1, 6, 600) * 100.0,
})`,
        check: 'top2_with_ties',
        order: 'any',
      },
      {
        name: 'Five thousand cities',
        hidden: true,
        note: 'A Python call for each group takes seconds here; one sort takes milliseconds.',
        setup: `import numpy as np
rng = np.random.default_rng(5)
orders = pd.DataFrame({
    "order_id": rng.permutation(np.arange(1, 30_001)),
    "city": ["c%04d" % n for n in rng.integers(0, 5000, 30_000)],
    "amount": rng.integers(1, 2000, 30_000) * 1.0,
})`,
        check: 'top2',
        order: 'any',
        limitS: 1,
        slowHint:
          'Avoid groupby().apply(): it calls Python once for each city. Sort once, then use groupby().head(2).',
      },
    ],
  },

  'pandas-running-total-and-gap': {
    language: 'python',
    task: `«orders» has the columns «customer_id», «ordered_at» (a datetime) and «amount». Set «result» to the orders sorted by «customer_id» and then «ordered_at», with three more columns: «order_number» (1, 2, 3 for each customer by time), «running_spend» (the customer's total so far, this order included) and «days_since_previous» (whole days since the customer's previous order, rounded down; missing for a first order).`,
    tables: [
      {
        name: 'orders',
        columns: [
          { name: 'customer_id', type: 'int' },
          { name: 'ordered_at', type: 'datetime' },
          { name: 'amount', type: 'float' },
        ],
        rows: [
          [2, '2026-01-03 10:00', 40],
          [1, '2026-01-05 09:00', 100],
          [1, '2026-01-01 09:00', 50],
          [2, '2026-01-01 12:00', 25],
          [1, '2026-01-08 18:00', 20],
          [3, '2026-01-02 08:00', 70],
        ],
      },
    ],
    starter: `import pandas as pd

# Sort, then add order_number, running_spend and days_since_previous.
result = None

print(result)
`,
    solution: `ordered = orders.sort_values(["customer_id", "ordered_at"])
by_customer = ordered.groupby("customer_id")

result = ordered.assign(
    order_number=by_customer.cumcount() + 1,
    running_spend=by_customer["amount"].cumsum(),
    days_since_previous=(ordered["ordered_at"] - by_customer["ordered_at"].shift(1)).dt.days,
)
`,
    cases: [
      {
        name: 'Sample',
        note: 'Customer 1 waited 3 days and 9 hours before the third order: that is 3 whole days.',
      },
      {
        name: 'Two orders on the same day',
        tables: [
          {
            name: 'orders',
            columns: [
              { name: 'customer_id', type: 'int' },
              { name: 'ordered_at', type: 'datetime' },
              { name: 'amount', type: 'float' },
            ],
            rows: [
              [7, '2026-02-01 21:00', 15],
              [7, '2026-02-01 09:00', 10],
              [8, '2026-02-03 09:00', 5],
              [7, '2026-02-04 08:59', 30],
            ],
          },
        ],
      },
      {
        name: 'Two thousand random orders',
        hidden: true,
        setup: `import numpy as np
rng = np.random.default_rng(8)
orders = pd.DataFrame({
    "customer_id": rng.integers(1, 201, 2000),
    "ordered_at": pd.Timestamp("2026-01-01") + pd.to_timedelta(rng.permutation(np.arange(2000)) * 3607, unit="s"),
    "amount": rng.integers(100, 50_000, 2000) / 100,
})`,
      },
    ],
  },

  'pandas-vectorise-apply': {
    language: 'python',
    rules: [
      {
        kind: 'forbid',
        pattern:
          '\\.apply\\(|\\biterrows\\b|\\bitertuples\\b|\\bvectorize\\b|\\bfor\\b|\\bmap\\(\\s*lambda',
        message:
          'This rewrite must work on whole columns. A for loop, a comprehension, iterrows, itertuples, apply, map(lambda) or np.vectorize still calls Python once per row. Use np.select, np.where, or .loc with a mask.',
      },
    ],
    task: `Rewrite «add_fees(payments)» without «apply» or any other Python loop over the rows: no «for», comprehension, «iterrows» or «np.vectorize». It returns the payments with a «fee» column: 2% of «amount» for «CARD», 0.0 for «UPI» and 5.0 for any other method, a missing one included. It must handle 500,000 payments in well under a second.`,
    tables: [
      {
        name: 'payments',
        columns: [
          { name: 'payment_id', type: 'int' },
          { name: 'method', type: 'str' },
          { name: 'amount', type: 'float' },
        ],
        rows: [
          [1, 'CARD', 1000],
          [2, 'UPI', 250],
          [3, 'CASH', 80],
          [4, 'WALLET', 120],
          [5, null, 60],
          [6, 'CARD', 49.5],
        ],
      },
    ],
    helpers: `def fee_totals(fn, payments):
    out = fn(payments)
    fees = out["fee"]
    return {
        "rows": int(len(out)),
        "total fee": round(float(fees.sum()), 2),
        "card fees": round(float(fees[out["method"] == "CARD"].sum()), 2),
        "flat fees": int((fees == 5.0).sum()),
    }`,
    starter: `import numpy as np
import pandas as pd


def fee(row):
    if row["method"] == "CARD":
        return row["amount"] * 0.02
    if row["method"] == "UPI":
        return 0.0
    return 5.0


def add_fees(payments):
    # This works, but calls Python once for each row. Rewrite it on whole columns.
    payments = payments.copy()
    payments["fee"] = payments.apply(fee, axis=1)
    return payments


print(add_fees(payments))
`,
    solution: `import numpy as np
import pandas as pd


def add_fees(payments):
    payments = payments.copy()
    payments["fee"] = np.select(
        [payments["method"] == "CARD", payments["method"] == "UPI"],
        [payments["amount"] * 0.02, 0.0],
        default=5.0,
    )
    return payments
`,
    cases: [
      {
        name: 'Sample',
        note: 'Payment 5 has no method, so it pays the flat 5.0.',
        check: 'add_fees(payments)',
      },
      {
        name: 'Every payment by card',
        setup: `payments = pd.DataFrame({"payment_id": [1, 2, 3], "method": ["CARD"] * 3, "amount": [10.0, 0.0, 99.99]})`,
        check: 'add_fees(payments)',
      },
      {
        name: 'Five hundred thousand payments',
        hidden: true,
        note: 'A row-by-row apply takes seconds here; whole-column operations take milliseconds.',
        setup: `import numpy as np
rng = np.random.default_rng(7)
size = 500_000
big_payments = pd.DataFrame({
    "payment_id": np.arange(size),
    "method": rng.choice(np.array(["CARD", "UPI", "CASH", "WALLET", None], dtype=object), size),
    "amount": rng.integers(100, 500_000, size) / 100,
})`,
        check: 'fee_totals(add_fees, big_payments)',
        limitS: 1,
        slowHint:
          'apply(axis=1) calls Python for every row. Build the fee from whole columns with np.select or np.where.',
      },
    ],
  },

  'pandas-file-too-big': {
    language: 'python',
    task: `Write «totals_by_customer(source)». «source» is a CSV file, a path or an open file, with the columns «customer_id», «amount» and 30 others, and it is too big for memory. Read it with «pd.read_csv» in chunks («chunksize») and only the two columns you need («usecols»). Return a DataFrame with one row for each customer: «customer_id», «total_amount» and «payments» (the number of payments), in any row order. The tests read 7 rows per chunk, so a customer appears in more than one chunk.`,
    setup: `import io

columns = ["payment_id", "customer_id", "merchant", "amount"] + ["extra_%02d" % n for n in range(1, 29)]
rows = [
    (1, 101, "swiggy", 250.0), (2, 102, "zomato", 120.5), (3, 101, "uber", 310.0),
    (4, 103, "ola", 99.0), (5, 102, "swiggy", 80.0), (6, 104, "irctc", 1500.0),
    (7, 101, "zomato", 45.5), (8, 103, "uber", 220.0), (9, 101, "ola", 60.0),
    (10, 104, "swiggy", 330.0), (11, 102, "uber", 75.0), (12, 105, "irctc", 980.0),
]
payments_csv = ",".join(columns) + "\\n" + "".join(
    ",".join([str(pid), str(cid), merchant, str(amount)] + ["x"] * 28) + "\\n"
    for pid, cid, merchant, amount in rows
)`,
    helpers: `import io as _io_module

import pandas as _pd_module


def _read(fn, text):
    calls = []
    real = _pd_module.read_csv

    def spy(*args, **kwargs):
        calls.append(dict(kwargs))
        if kwargs.get("chunksize"):
            kwargs = dict(kwargs, chunksize=7)
        return real(*args, **kwargs)

    _pd_module.read_csv = spy
    try:
        return fn(_io_module.StringIO(text)), calls
    finally:
        _pd_module.read_csv = real


def run_totals(fn, text):
    return _read(fn, text)[0]


def check_chunked(fn, text):
    result, calls = _read(fn, text)
    if not calls:
        return verdict(False, "Read the file with pd.read_csv(source, ...), so the test can see how you read it.")
    settings = calls[0]
    if not settings.get("chunksize"):
        return verdict(False, "Pass chunksize to read_csv, so only one chunk of the 40 GB file is in memory at a time.")
    usecols = settings.get("usecols")
    if usecols is None:
        return verdict(False, "Pass usecols with the two columns you need. Reading all 32 columns of every chunk wastes memory and time.")
    header = text.split("\\n", 1)[0].split(",")
    try:
        if callable(usecols):
            chosen = {name for name in header if usecols(name)}
        else:
            chosen = {header[item] if isinstance(item, int) else item for item in usecols}
    except (IndexError, TypeError):
        chosen = set()
    if chosen != {"customer_id", "amount"}:
        return verdict(False, "usecols should name customer_id and amount only. Yours reads %s." % sorted(chosen))
    return verdict(True)`,
    starter: `import io

import pandas as pd


def totals_by_customer(source):
    # Read source in chunks with pd.read_csv and return one row for each customer:
    # customer_id, total_amount, payments.
    ...


print(totals_by_customer(io.StringIO(payments_csv)))
`,
    solution: `import pandas as pd


def totals_by_customer(source):
    parts = []
    reader = pd.read_csv(source,
                         usecols=["customer_id", "amount"],
                         dtype={"customer_id": "int64", "amount": "float64"},
                         chunksize=5_000_000)
    for chunk in reader:
        parts.append(chunk.groupby("customer_id")["amount"].agg(["sum", "count"]))

    return (pd.concat(parts)
            .groupby(level=0)
            .sum()
            .rename(columns={"sum": "total_amount", "count": "payments"}))
`,
    cases: [
      {
        name: 'Sample',
        note: 'Customer 101 has payments in both chunks of 7 rows: 250 + 310 + 45.5 + 60 = 665.5.',
        check: 'run_totals(totals_by_customer, payments_csv)',
        order: 'any',
      },
      {
        name: 'Reads two columns, in chunks',
        check: 'check_chunked(totals_by_customer, payments_csv)',
      },
      {
        name: 'Three thousand payments',
        hidden: true,
        setup: `import random
rng = random.Random(6)
payments_csv = ",".join(columns) + "\\n" + "".join(
    ",".join([str(n), str(rng.randrange(1, 300)), "m%d" % rng.randrange(9), "%.2f" % (rng.randrange(100, 900_000) / 100)] + ["y"] * 28) + "\\n"
    for n in range(3000)
)`,
        check: 'run_totals(totals_by_customer, payments_csv)',
        order: 'any',
      },
    ],
  },
};
