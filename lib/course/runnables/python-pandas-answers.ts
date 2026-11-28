import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/**
 * Other correct answers and the usual mistakes for the pandas problems, for
 * `python-specs.test.ts`.
 */
export const PANDAS_ANSWERS: Record<string, SpecAnswers> = {
  'pandas-sql-to-pandas': {
    pass: [
      // The segment stays the index: a named index counts as a column.
      `merged = orders.merge(customers, on="customer_id")
merged = merged[merged["status"] == "DELIVERED"]
grouped = merged.groupby("segment").agg(
    orders=("order_id", "size"),
    customers=("customer_id", "nunique"),
    revenue=("amount", "sum"),
)
result = grouped[grouped["revenue"] > 1000].sort_values("revenue", ascending=False)
`,
      `import pandas as pd

joined = pd.merge(orders.loc[orders.status == "DELIVERED"], customers, how="left", on="customer_id")
summary = joined.groupby("segment").agg(
    orders=("order_id", "count"), customers=("customer_id", "nunique"), revenue=("amount", "sum")
).reset_index()
result = summary.loc[summary.revenue > 1000].sort_values(by="revenue", ascending=False).reset_index(drop=True)
`,
    ],
    fail: [
      // No WHERE.
      `result = (orders
          .merge(customers, on="customer_id")
          .groupby("segment", as_index=False)
          .agg(orders=("order_id", "count"), customers=("customer_id", "nunique"), revenue=("amount", "sum"))
          .query("revenue > 1000")
          .sort_values("revenue", ascending=False))
`,
      // HAVING with >=.
      `delivered = orders[orders["status"] == "DELIVERED"]
result = (delivered
          .merge(customers, on="customer_id")
          .groupby("segment", as_index=False)
          .agg(orders=("order_id", "count"), customers=("customer_id", "nunique"), revenue=("amount", "sum"))
          .query("revenue >= 1000")
          .sort_values("revenue", ascending=False))
`,
      // Counts amounts, which skips a missing one.
      `delivered = orders[orders["status"] == "DELIVERED"]
result = (delivered
          .merge(customers, on="customer_id")
          .groupby("segment", as_index=False)
          .agg(orders=("amount", "count"), customers=("customer_id", "nunique"), revenue=("amount", "sum"))
          .query("revenue > 1000")
          .sort_values("revenue", ascending=False))
`,
      // COUNT instead of COUNT(DISTINCT).
      `delivered = orders[orders["status"] == "DELIVERED"]
result = (delivered
          .merge(customers, on="customer_id")
          .groupby("segment", as_index=False)
          .agg(orders=("order_id", "count"), customers=("customer_id", "count"), revenue=("amount", "sum"))
          .query("revenue > 1000")
          .sort_values("revenue", ascending=False))
`,
      // No ORDER BY.
      `delivered = orders[orders["status"] == "DELIVERED"]
result = (delivered
          .merge(customers, on="customer_id")
          .groupby("segment", as_index=False)
          .agg(orders=("order_id", "count"), customers=("customer_id", "nunique"), revenue=("amount", "sum"))
          .query("revenue > 1000"))
`,
    ],
  },

  'pandas-top-n-per-group': {
    pass: [
      `by_id = orders.sort_values("order_id")
position = by_id.groupby("city")["amount"].rank(method="first", ascending=False)
top2 = by_id[position <= 2]

dense = orders.groupby("city")["amount"].rank(method="dense", ascending=False)
top2_with_ties = orders[dense <= 2]
`,
      `ordered = orders.sort_values(["amount", "order_id"], ascending=[False, True])
top2 = ordered.groupby("city").head(2)

distinct = orders.drop_duplicates(["city", "amount"]).sort_values("amount", ascending=False)
cutoff = distinct.groupby("city").head(2).groupby("city")["amount"].min().rename("cutoff")
joined = orders.join(cutoff, on="city")
top2_with_ties = joined[joined["amount"] >= joined["cutoff"]].drop(columns="cutoff")
`,
    ],
    fail: [
      // A Python call for each city, and nlargest keeps the first rows it meets.
      `columns = ["order_id", "city", "amount"]
top2 = orders.groupby("city", group_keys=False)[columns].apply(lambda group: group.nlargest(2, "amount"))
top2_with_ties = orders.groupby("city", group_keys=False)[columns].apply(
    lambda group: group[group["amount"] >= sorted(set(group["amount"]), reverse=True)[:2][-1]])
`,
      // RANK() instead of DENSE_RANK().
      `top2 = (orders
        .sort_values(["city", "amount", "order_id"], ascending=[True, False, True])
        .groupby("city")
        .head(2))
ranked = orders.assign(position=orders.groupby("city")["amount"].rank(method="min", ascending=False))
top2_with_ties = ranked[ranked["position"] <= 2].drop(columns="position")
`,
      // ROW_NUMBER() for the ties, so ties are cut.
      `top2 = (orders
        .sort_values(["city", "amount", "order_id"], ascending=[True, False, True])
        .groupby("city")
        .head(2))
ranked = orders.assign(position=orders.groupby("city")["amount"].rank(method="first", ascending=False))
top2_with_ties = ranked[ranked["position"] <= 2].drop(columns="position")
`,
      // No tie-breaker, so equal amounts keep the order of the rows.
      `top2 = orders.sort_values(["city", "amount"], ascending=[True, False]).groupby("city").head(2)
ranked = orders.assign(position=orders.groupby("city")["amount"].rank(method="dense", ascending=False))
top2_with_ties = ranked[ranked["position"] <= 2].drop(columns="position")
`,
    ],
  },

  'pandas-running-total-and-gap': {
    pass: [
      `ordered = orders.sort_values(["customer_id", "ordered_at"]).reset_index(drop=True)
group = ordered.groupby("customer_id")
ordered["order_number"] = group.cumcount() + 1
ordered["running_spend"] = group["amount"].transform("cumsum")
ordered["days_since_previous"] = group["ordered_at"].diff().dt.days
result = ordered
`,
      `import pandas as pd

result = orders.sort_values(["customer_id", "ordered_at"])
grouped = result.groupby("customer_id")
gap = result["ordered_at"] - grouped["ordered_at"].shift()
result = result.assign(
    order_number=grouped["ordered_at"].rank(method="first").astype(int),
    running_spend=grouped["amount"].cumsum(),
    days_since_previous=gap // pd.Timedelta(days=1),
)
`,
    ],
    fail: [
      // No sort.
      `by_customer = orders.groupby("customer_id")
result = orders.assign(
    order_number=by_customer.cumcount() + 1,
    running_spend=by_customer["amount"].cumsum(),
    days_since_previous=(orders["ordered_at"] - by_customer["ordered_at"].shift(1)).dt.days,
)
`,
      // The running total runs across customers.
      `ordered = orders.sort_values(["customer_id", "ordered_at"])
by_customer = ordered.groupby("customer_id")
result = ordered.assign(
    order_number=by_customer.cumcount() + 1,
    running_spend=ordered["amount"].cumsum(),
    days_since_previous=(ordered["ordered_at"] - by_customer["ordered_at"].shift(1)).dt.days,
)
`,
      // Fractions of a day.
      `ordered = orders.sort_values(["customer_id", "ordered_at"])
by_customer = ordered.groupby("customer_id")
result = ordered.assign(
    order_number=by_customer.cumcount() + 1,
    running_spend=by_customer["amount"].cumsum(),
    days_since_previous=(ordered["ordered_at"] - by_customer["ordered_at"].shift(1)).dt.total_seconds() / 86400,
)
`,
      // shift() outside the group reaches into the previous customer.
      `ordered = orders.sort_values(["customer_id", "ordered_at"])
by_customer = ordered.groupby("customer_id")
result = ordered.assign(
    order_number=by_customer.cumcount() + 1,
    running_spend=by_customer["amount"].cumsum(),
    days_since_previous=(ordered["ordered_at"] - ordered["ordered_at"].shift(1)).dt.days,
)
`,
      // A timedelta is not a number of days.
      `ordered = orders.sort_values(["customer_id", "ordered_at"])
by_customer = ordered.groupby("customer_id")
result = ordered.assign(
    order_number=by_customer.cumcount() + 1,
    running_spend=by_customer["amount"].cumsum(),
    days_since_previous=ordered["ordered_at"] - by_customer["ordered_at"].shift(1),
)
`,
    ],
  },

  'pandas-vectorise-apply': {
    pass: [
      `import numpy as np


def add_fees(payments):
    method = payments["method"]
    return payments.assign(fee=np.where(method == "CARD", payments["amount"] * 0.02,
                                        np.where(method == "UPI", 0.0, 5.0)))
`,
      `def add_fees(payments):
    out = payments.copy()
    out["fee"] = 5.0
    out.loc[out["method"] == "UPI", "fee"] = 0.0
    card = out["method"] == "CARD"
    out.loc[card, "fee"] = out.loc[card, "amount"] * 0.02
    return out
`,
    ],
    fail: [
      // A list comprehension over the columns: no apply, but still one Python call per row.
      `import pandas as pd


def add_fees(payments):
    out = payments.copy()
    out["fee"] = [a * 0.02 if m == "CARD" else (0.0 if m == "UPI" else 5.0)
                  for a, m in zip(out["amount"], out["method"])]
    return out
`,
      // A Python loop over rows.
      `def add_fees(payments):
    payments = payments.copy()
    fees = []
    for _, row in payments.iterrows():
        if row["method"] == "CARD":
            fees.append(row["amount"] * 0.02)
        elif row["method"] == "UPI":
            fees.append(0.0)
        else:
            fees.append(5.0)
    payments["fee"] = fees
    return payments
`,
      // np.select without a default gives 0.0 to every other method.
      `import numpy as np


def add_fees(payments):
    payments = payments.copy()
    payments["fee"] = np.select(
        [payments["method"] == "CARD", payments["method"] == "UPI"],
        [payments["amount"] * 0.02, 0.0],
    )
    return payments
`,
    ],
  },

  'pandas-file-too-big': {
    pass: [
      `from collections import defaultdict

import pandas as pd


def totals_by_customer(source):
    totals, counts = defaultdict(float), defaultdict(int)
    for chunk in pd.read_csv(source, usecols=["customer_id", "amount"], chunksize=100_000):
        for customer, amount in zip(chunk["customer_id"], chunk["amount"]):
            totals[customer] += amount
            counts[customer] += 1
    return pd.DataFrame({
        "customer_id": list(totals),
        "total_amount": list(totals.values()),
        "payments": [counts[customer] for customer in totals],
    })
`,
      `import pandas as pd


def totals_by_customer(source):
    parts = []
    with pd.read_csv(source, usecols=["customer_id", "amount"], chunksize=1_000_000) as reader:
        for chunk in reader:
            parts.append(chunk.groupby("customer_id", as_index=False).agg(
                total_amount=("amount", "sum"), payments=("amount", "size")))
    return pd.concat(parts).groupby("customer_id", as_index=False).sum()
`,
    ],
    fail: [
      // Reads the whole file at once.
      `import pandas as pd


def totals_by_customer(source):
    payments = pd.read_csv(source)
    return payments.groupby("customer_id", as_index=False).agg(
        total_amount=("amount", "sum"), payments=("amount", "count"))
`,
      // Chunks, but every column of each chunk.
      `import pandas as pd


def totals_by_customer(source):
    parts = [chunk.groupby("customer_id")["amount"].agg(["sum", "count"])
             for chunk in pd.read_csv(source, chunksize=100_000)]
    return pd.concat(parts).groupby(level=0).sum().rename(columns={"sum": "total_amount", "count": "payments"})
`,
      // A customer in two chunks gets two rows.
      `import pandas as pd


def totals_by_customer(source):
    parts = [chunk.groupby("customer_id", as_index=False).agg(total_amount=("amount", "sum"), payments=("amount", "count"))
             for chunk in pd.read_csv(source, usecols=["customer_id", "amount"], chunksize=100_000)]
    return pd.concat(parts)
`,
      // Counts the chunks, not the payments.
      `import pandas as pd


def totals_by_customer(source):
    parts = [chunk.groupby("customer_id")["amount"].agg(["sum", "count"])
             for chunk in pd.read_csv(source, usecols=["customer_id", "amount"], chunksize=100_000)]
    combined = pd.concat(parts).groupby(level=0).agg({"sum": "sum", "count": "count"})
    return combined.rename(columns={"sum": "total_amount", "count": "payments"})
`,
    ],
  },
};
