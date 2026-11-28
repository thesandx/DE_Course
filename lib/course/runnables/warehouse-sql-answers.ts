import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/** Other answers for the SQL problems outside the SQL track. See `test-answers.ts`. */
export const WAREHOUSE_SQL_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'ai-hybrid-search-rrf': {
    pass: [
      `WITH k AS (
  SELECT query_id, chunk_id, ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY score DESC, chunk_id) AS r
  FROM keyword_hits
), v AS (
  SELECT query_id, chunk_id, ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY distance, chunk_id) AS r
  FROM vector_hits
), fused AS (
  SELECT COALESCE(k.query_id, v.query_id) AS query_id,
         COALESCE(k.chunk_id, v.chunk_id) AS chunk_id,
         COALESCE(1.0 / (60 + k.r), 0) + COALESCE(1.0 / (60 + v.r), 0) AS rrf_score,
         (k.r IS NOT NULL)::int + (v.r IS NOT NULL)::int AS lists_found_in
  FROM k FULL OUTER JOIN v ON v.query_id = k.query_id AND v.chunk_id = k.chunk_id
)
SELECT query_id, chunk_id, rrf_score, lists_found_in
FROM fused f
WHERE (SELECT COUNT(*) FROM fused g
       WHERE g.query_id = f.query_id
         AND (g.rrf_score > f.rrf_score OR (g.rrf_score = f.rrf_score AND g.chunk_id < f.chunk_id))) < 10;`,
    ],
    fail: [
      // UNION removes a chunk's second row when it has the same rank in both lists.
      `WITH ranked AS (
  SELECT query_id, chunk_id, ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY score DESC, chunk_id) AS rnk FROM keyword_hits
  UNION
  SELECT query_id, chunk_id, ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY distance, chunk_id) FROM vector_hits
), fused AS (
  SELECT query_id, chunk_id, SUM(1.0 / (60 + rnk)) AS rrf_score, COUNT(*) AS lists_found_in FROM ranked GROUP BY 1, 2
)
SELECT query_id, chunk_id, rrf_score, lists_found_in FROM (
  SELECT fused.*, ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY rrf_score DESC, chunk_id) AS pos FROM fused
) t WHERE pos <= 10;`,
      // RANK gives tied scores the same rank instead of breaking ties by chunk_id.
      `WITH ranked AS (
  SELECT query_id, chunk_id, RANK() OVER (PARTITION BY query_id ORDER BY score DESC) AS rnk FROM keyword_hits
  UNION ALL
  SELECT query_id, chunk_id, RANK() OVER (PARTITION BY query_id ORDER BY distance) FROM vector_hits
), fused AS (
  SELECT query_id, chunk_id, SUM(1.0 / (60 + rnk)) AS rrf_score, COUNT(*) AS lists_found_in FROM ranked GROUP BY 1, 2
)
SELECT query_id, chunk_id, rrf_score, lists_found_in FROM (
  SELECT fused.*, ROW_NUMBER() OVER (PARTITION BY query_id ORDER BY rrf_score DESC, chunk_id) AS pos FROM fused
) t WHERE pos <= 10;`,
    ],
  },
  'ai-point-in-time-training-set': {
    pass: [
      `SELECT l.order_id, l.user_id, l.ordered_at, f.orders_7d, f.avg_basket_usd, l.is_fraud
FROM labels l
LEFT JOIN LATERAL (
  SELECT orders_7d, avg_basket_usd
  FROM user_features uf
  WHERE uf.user_id = l.user_id
    AND uf._loaded_at < l.ordered_at
    AND uf._loaded_at >= l.ordered_at - INTERVAL '30 days'
  ORDER BY uf._loaded_at DESC
  LIMIT 1
) f ON TRUE;`,
    ],
    fail: [
      // Joins on feature_ts: a value that landed after the order leaks into training.
      `SELECT DISTINCT ON (l.order_id) l.order_id, l.user_id, l.ordered_at, f.orders_7d, f.avg_basket_usd, l.is_fraud
FROM labels l
LEFT JOIN user_features f
  ON f.user_id = l.user_id AND f.feature_ts < l.ordered_at AND f.feature_ts >= l.ordered_at - INTERVAL '30 days'
ORDER BY l.order_id, f.feature_ts DESC;`,
      // An inner join drops orders whose user has no usable features.
      `SELECT DISTINCT ON (l.order_id) l.order_id, l.user_id, l.ordered_at, f.orders_7d, f.avg_basket_usd, l.is_fraud
FROM labels l
JOIN user_features f
  ON f.user_id = l.user_id AND f._loaded_at < l.ordered_at AND f._loaded_at >= l.ordered_at - INTERVAL '30 days'
ORDER BY l.order_id, f._loaded_at DESC;`,
      // "<=" lets a value that lands at the order's instant through.
      `SELECT DISTINCT ON (l.order_id) l.order_id, l.user_id, l.ordered_at, f.orders_7d, f.avg_basket_usd, l.is_fraud
FROM labels l
LEFT JOIN user_features f
  ON f.user_id = l.user_id AND f._loaded_at <= l.ordered_at AND f._loaded_at >= l.ordered_at - INTERVAL '30 days'
ORDER BY l.order_id, f._loaded_at DESC;`,
    ],
  },
  'db-wallet-lost-update': {
    pass: [
      `WITH debit AS (
  UPDATE wallets w
  SET balance = w.balance - 80
  WHERE w.wallet_id = 42 AND w.balance - 80 >= 0
    AND 'w-1001' NOT IN (SELECT request_id FROM ledger)
  RETURNING w.wallet_id
)
INSERT INTO ledger (request_id, wallet_id, amount)
SELECT 'w-1001', 42, -80 FROM debit;`,
    ],
    fail: [
      // Conditional, but not idempotent: a retry with enough money debits again.
      `WITH debit AS (
  UPDATE wallets SET balance = balance - 80 WHERE wallet_id = 42 AND balance >= 80 RETURNING wallet_id
)
INSERT INTO ledger (request_id, wallet_id, amount)
SELECT 'w-1001-' || (SELECT COUNT(*) FROM ledger), wallet_id, -80 FROM debit;`,
      // Writes the ledger row even when the debit did not happen.
      `UPDATE wallets SET balance = balance - 80 WHERE wallet_id = 42 AND balance >= 80
  AND NOT EXISTS (SELECT 1 FROM ledger WHERE request_id = 'w-1001');
INSERT INTO ledger (request_id, wallet_id, amount) VALUES ('w-1001', 42, -80) ON CONFLICT DO NOTHING;`,
    ],
  },
  'dbt-daily-driver-earnings': {
    pass: [
      `BEGIN;
CREATE TEMP TABLE IF NOT EXISTS run_days (earning_date date);
TRUNCATE run_days;
INSERT INTO run_days
SELECT DISTINCT completed_at::date FROM stg_trips
WHERE _loaded_at > (SELECT MAX(last_loaded_at) FROM fct_driver_daily_earnings) - INTERVAL '6 hours';

MERGE INTO fct_driver_daily_earnings AS t
USING (
  SELECT driver_id, completed_at::date AS earning_date, COUNT(*) AS trips, SUM(fare_usd) AS fares_usd,
         SUM(COALESCE(tip_usd, 0)) AS tips_usd, MAX(_loaded_at) AS last_loaded_at
  FROM stg_trips
  WHERE status = 'completed' AND completed_at::date IN (SELECT earning_date FROM run_days)
  GROUP BY 1, 2
) AS s
ON t.driver_id = s.driver_id AND t.earning_date = s.earning_date
WHEN MATCHED THEN UPDATE SET trips = s.trips, fares_usd = s.fares_usd, tips_usd = s.tips_usd,
                             last_loaded_at = s.last_loaded_at
WHEN NOT MATCHED THEN INSERT VALUES (s.driver_id, s.earning_date, s.trips, s.fares_usd, s.tips_usd, s.last_loaded_at)
WHEN NOT MATCHED BY SOURCE AND t.earning_date IN (SELECT earning_date FROM run_days) THEN DELETE;
COMMIT;`,
    ],
    fail: [
      // A merge without the delete leaves the row of a driver whose only trip was refunded.
      `MERGE INTO fct_driver_daily_earnings AS t
USING (
  SELECT driver_id, completed_at::date AS earning_date, COUNT(*) AS trips, SUM(fare_usd) AS fares_usd,
         SUM(COALESCE(tip_usd, 0)) AS tips_usd, MAX(_loaded_at) AS last_loaded_at
  FROM stg_trips
  WHERE status = 'completed' AND completed_at::date IN (
    SELECT DISTINCT completed_at::date FROM stg_trips
    WHERE _loaded_at > (SELECT MAX(last_loaded_at) FROM fct_driver_daily_earnings) - INTERVAL '6 hours')
  GROUP BY 1, 2
) AS s
ON t.driver_id = s.driver_id AND t.earning_date = s.earning_date
WHEN MATCHED THEN UPDATE SET trips = s.trips, fares_usd = s.fares_usd, tips_usd = s.tips_usd,
                             last_loaded_at = s.last_loaded_at
WHEN NOT MATCHED THEN INSERT VALUES (s.driver_id, s.earning_date, s.trips, s.fares_usd, s.tips_usd, s.last_loaded_at);`,
      // A full rebuild from staging loses the days staging no longer keeps.
      `TRUNCATE fct_driver_daily_earnings;
INSERT INTO fct_driver_daily_earnings
SELECT driver_id, completed_at::date, COUNT(*), SUM(fare_usd), SUM(COALESCE(tip_usd, 0)), MAX(_loaded_at)
FROM stg_trips WHERE status = 'completed' GROUP BY 1, 2;`,
    ],
  },
  'cdc-merge-latest': {
    pass: [
      `WITH newest AS (
  SELECT DISTINCT ON (driver_id) * FROM staging.driver_changes ORDER BY driver_id, changed_at DESC
), deleted AS (
  DELETE FROM core.drivers t USING newest s
  WHERE t.driver_id = s.driver_id AND s.op = 'd' AND s.changed_at >= t.changed_at
)
INSERT INTO core.drivers (driver_id, name, city_id, changed_at)
SELECT driver_id, name, city_id, changed_at FROM newest WHERE op IN ('c', 'u')
ON CONFLICT (driver_id) DO UPDATE
SET name = EXCLUDED.name, city_id = EXCLUDED.city_id, changed_at = EXCLUDED.changed_at
WHERE EXCLUDED.changed_at > core.drivers.changed_at;`,
    ],
    fail: [
      // No changed_at guard: an old event overwrites a newer row.
      `MERGE INTO core.drivers AS t
USING (SELECT DISTINCT ON (driver_id) * FROM staging.driver_changes ORDER BY driver_id, changed_at DESC) AS s
ON t.driver_id = s.driver_id
WHEN MATCHED AND s.op = 'd' THEN DELETE
WHEN MATCHED THEN UPDATE SET name = s.name, city_id = s.city_id, changed_at = s.changed_at
WHEN NOT MATCHED AND s.op <> 'd' THEN INSERT VALUES (s.driver_id, s.name, s.city_id, s.changed_at);`,
      // Keeps the oldest event per driver instead of the newest.
      `MERGE INTO core.drivers AS t
USING (SELECT DISTINCT ON (driver_id) * FROM staging.driver_changes ORDER BY driver_id, changed_at) AS s
ON t.driver_id = s.driver_id
WHEN MATCHED AND s.op = 'd' AND s.changed_at >= t.changed_at THEN DELETE
WHEN MATCHED AND s.op <> 'd' AND s.changed_at > t.changed_at THEN
  UPDATE SET name = s.name, city_id = s.city_id, changed_at = s.changed_at
WHEN NOT MATCHED AND s.op <> 'd' THEN INSERT VALUES (s.driver_id, s.name, s.city_id, s.changed_at);`,
    ],
  },
  'scd2-driver-city': {
    pass: [
      `BEGIN;
CREATE TEMP TABLE IF NOT EXISTS moved (driver_id int, city_id int, updated_at timestamp);
TRUNCATE moved;
INSERT INTO moved
SELECT s.driver_id, s.city_id, s.updated_at
FROM stg_driver s
LEFT JOIN dim_driver d ON d.driver_id = s.driver_id AND d.is_current
WHERE d.driver_id IS NULL OR d.city_id IS DISTINCT FROM s.city_id;

UPDATE dim_driver d SET valid_to = m.updated_at, is_current = FALSE
FROM moved m WHERE d.driver_id = m.driver_id AND d.is_current;

INSERT INTO dim_driver
SELECT next_sk(), driver_id, city_id, updated_at, '9999-12-31', TRUE FROM moved;
COMMIT;`,
    ],
    fail: [
      // "<>" is never true against NULL, so a driver whose city was unknown never moves.
      `UPDATE dim_driver d SET valid_to = s.updated_at, is_current = FALSE
FROM stg_driver s
WHERE d.driver_id = s.driver_id AND d.is_current AND d.city_id <> s.city_id;
INSERT INTO dim_driver (driver_sk, driver_id, city_id, valid_from, valid_to, is_current)
SELECT next_sk(), s.driver_id, s.city_id, s.updated_at, '9999-12-31', TRUE
FROM stg_driver s LEFT JOIN dim_driver d ON d.driver_id = s.driver_id AND d.is_current
WHERE d.driver_id IS NULL;`,
      // Inserting first finds a current row for every moved driver, so they end with none.
      `INSERT INTO dim_driver (driver_sk, driver_id, city_id, valid_from, valid_to, is_current)
SELECT next_sk(), s.driver_id, s.city_id, s.updated_at, '9999-12-31', TRUE
FROM stg_driver s LEFT JOIN dim_driver d ON d.driver_id = s.driver_id AND d.is_current
WHERE d.driver_id IS NULL;
UPDATE dim_driver d SET valid_to = s.updated_at, is_current = FALSE
FROM stg_driver s
WHERE d.driver_id = s.driver_id AND d.is_current AND d.city_id IS DISTINCT FROM s.city_id;`,
    ],
  },
  'quality-checks-in-sql': {
    pass: [
      `SELECT check_name, failures FROM (
  SELECT 'duplicate_trip_id' AS check_name,
         (SELECT COUNT(*) FROM (SELECT trip_id FROM fct_trips WHERE trip_date = '2024-10-08'
                                GROUP BY trip_id HAVING COUNT(*) > 1) d) AS failures
  UNION ALL
  SELECT 'unknown_driver',
         (SELECT COUNT(*) FROM fct_trips t WHERE t.trip_date = '2024-10-08'
            AND NOT EXISTS (SELECT 1 FROM dim_driver d WHERE d.driver_id = t.driver_id))
  UNION ALL
  SELECT 'negative_fare',
         (SELECT COUNT(*) FROM fct_trips WHERE trip_date = '2024-10-08' AND status = 'completed' AND fare_usd < 0)
  UNION ALL
  SELECT 'low_volume',
         (SELECT (COUNT(*) FILTER (WHERE trip_date = '2024-10-08')
                  < 0.7 * COUNT(*) FILTER (WHERE trip_date = '2024-10-01'))::int FROM fct_trips)
) c
WHERE failures > 0;`,
    ],
    fail: [
      // Returns every check, including the ones that passed.
      `SELECT 'duplicate_trip_id' AS check_name,
       (SELECT COUNT(*) FROM (SELECT trip_id FROM fct_trips WHERE trip_date = '2024-10-08'
                              GROUP BY trip_id HAVING COUNT(*) > 1) d) AS failures
UNION ALL
SELECT 'unknown_driver', (SELECT COUNT(*) FROM fct_trips t LEFT JOIN dim_driver d ON d.driver_id = t.driver_id
                          WHERE t.trip_date = '2024-10-08' AND d.driver_id IS NULL)
UNION ALL
SELECT 'negative_fare', (SELECT COUNT(*) FROM fct_trips WHERE trip_date = '2024-10-08'
                         AND status = 'completed' AND fare_usd < 0)
UNION ALL
SELECT 'low_volume', CASE WHEN (SELECT COUNT(*) FROM fct_trips WHERE trip_date = '2024-10-08')
                             < 0.7 * (SELECT COUNT(*) FROM fct_trips WHERE trip_date = '2024-10-01') THEN 1 ELSE 0 END;`,
      // NOT IN against dim_driver misses rows whose driver_id is NULL.
      `WITH today AS (SELECT * FROM fct_trips WHERE trip_date = '2024-10-08'), checks AS (
  SELECT 'duplicate_trip_id' AS check_name,
         (SELECT COUNT(*) FROM (SELECT trip_id FROM today GROUP BY trip_id HAVING COUNT(*) > 1) d) AS failures
  UNION ALL
  SELECT 'unknown_driver', (SELECT COUNT(*) FROM today WHERE driver_id NOT IN (SELECT driver_id FROM dim_driver))
  UNION ALL
  SELECT 'negative_fare', (SELECT COUNT(*) FROM today WHERE status = 'completed' AND fare_usd < 0)
  UNION ALL
  SELECT 'low_volume', CASE WHEN (SELECT COUNT(*) FROM today)
                               < 0.7 * (SELECT COUNT(*) FROM fct_trips WHERE trip_date = '2024-10-01') THEN 1 ELSE 0 END
)
SELECT * FROM checks WHERE failures > 0;`,
    ],
  },
  'sf-flatten-order-items': {
    pass: [
      `WITH latest AS (
  SELECT DISTINCT ON (payload->>'order_id') payload
  FROM raw.orders
  ORDER BY payload->>'order_id', (payload->>'updated_at')::timestamp DESC
), by_sku AS (
  SELECT l.payload->>'city' AS city, i.value->>'sku' AS sku,
         SUM((i.value->>'qty')::numeric * (i.value->>'price')::numeric) AS revenue
  FROM latest l, jsonb_array_elements(COALESCE(l.payload->'items', '[]'::jsonb)) AS i
  WHERE l.payload->>'status' = 'delivered'
  GROUP BY 1, 2
)
SELECT city, sku, revenue FROM by_sku b
WHERE (SELECT COUNT(*) FROM by_sku o WHERE o.city = b.city AND o.revenue > b.revenue) < 3;`,
    ],
    fail: [
      // Flattens every version: an order's items count once per version.
      `WITH items AS (
  SELECT o.payload->>'city' AS city, i->>'sku' AS sku, (i->>'qty')::int * (i->>'price')::numeric AS revenue
  FROM raw.orders o CROSS JOIN LATERAL jsonb_array_elements(o.payload->'items') AS i
  WHERE o.payload->>'status' = 'delivered'
), by_sku AS (SELECT city, sku, SUM(revenue) AS revenue FROM items GROUP BY 1, 2)
SELECT city, sku, revenue FROM (
  SELECT by_sku.*, RANK() OVER (PARTITION BY city ORDER BY revenue DESC) AS r FROM by_sku
) t WHERE r <= 3;`,
      // Filters to delivered before taking the latest version, so o7's cancelled update is missed.
      `WITH latest AS (
  SELECT DISTINCT ON (payload->>'order_id') payload FROM raw.orders
  WHERE payload->>'status' = 'delivered'
  ORDER BY payload->>'order_id', (payload->>'updated_at')::timestamp DESC
), items AS (
  SELECT l.payload->>'city' AS city, i->>'sku' AS sku, (i->>'qty')::int * (i->>'price')::numeric AS revenue
  FROM latest l CROSS JOIN LATERAL jsonb_array_elements(l.payload->'items') AS i
), by_sku AS (SELECT city, sku, SUM(revenue) AS revenue FROM items GROUP BY 1, 2)
SELECT city, sku, revenue FROM (
  SELECT by_sku.*, RANK() OVER (PARTITION BY city ORDER BY revenue DESC) AS r FROM by_sku
) t WHERE r <= 3;`,
    ],
  },
};
