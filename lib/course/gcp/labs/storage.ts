/**
 * Hands-on labs for line 3, "Storing the data".
 * One lab per station. The shape and the rules are in `../README.md`.
 */

import type { GcpLab } from '@/types/gcp';

const LIFECYCLE = `{
  "rule": [
    { "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" },
      "condition": { "age": 30, "matchesStorageClass": ["STANDARD", "NEARLINE"] } },
    { "action": { "type": "Delete" },
      "condition": { "age": 365 } }
  ]
}`;

const RAW_EVENTS_DAY1 = `{"event_id":"a1","user_id":"u1","event_type":"view","event_ts":"2026-04-01T09:00:00Z","amount":null}
{"event_id":"a2","user_id":"u2","event_type":"view","event_ts":"2026-04-01T09:03:00Z","amount":null}
{"event_id":"a3","user_id":"u1","event_type":"purchase","event_ts":"2026-04-01T09:05:00Z","amount":42.0}
{"event_id":"a4","user_id":"u3","event_type":"view","event_ts":"2026-04-01T10:15:00Z","amount":null}
{"event_id":"a5","user_id":"u3","event_type":"purchase","event_ts":"2026-04-01T10:20:00Z","amount":15.5}`;

const RAW_EVENTS_DAY2 = `{"event_id":"b1","user_id":"u2","event_type":"view","event_ts":"2026-04-02T08:00:00Z","amount":null}
{"event_id":"b2","user_id":"u2","event_type":"purchase","event_ts":"2026-04-02T08:04:00Z","amount":99.0}
{"event_id":"b3","user_id":"u4","event_type":"view","event_ts":"2026-04-02T12:30:00Z","amount":null}
{"event_id":"b4","user_id":"u1","event_type":"purchase","event_ts":"2026-04-02T13:00:00Z","amount":7.25}`;

const CUSTOMERS = `customer_id,full_name,email,segment,country
C-01,Asha Rao,asha.rao@example.com,enterprise,GB
C-02,Lukas Becker,lukas.becker@example.com,smb,DE
C-03,Chloé Martin,chloe.martin@example.com,smb,FR
C-04,Priya Nair,priya.nair@example.com,enterprise,IN
C-05,Sam Carter,sam.carter@example.com,consumer,US
C-06,Mia Schmidt,mia.schmidt@example.com,consumer,DE`;

export const LABS: readonly GcpLab[] = [
  {
    station: 'storage-selection',
    title: 'Pick, protect and design storage',
    scenario:
      'Five teams ask you where their data should live. You answer each one, then build two of the answers for real: a bucket that ages data into cheaper classes and refuses early deletes, and a Bigtable row key design you test on the free emulator.',
    minutes: 45,
    apis: ['storage.googleapis.com'],
    vars: { BUCKET: '$PROJECT_ID-lab31' },
    creates: [
      'Cloud Storage bucket «PROJECT_ID-lab31» with a lifecycle and a short retention policy',
      'A local Bigtable emulator in Cloud Shell (no cloud resource)',
    ],
    cost: 'Free in practice. The bucket holds a few bytes. The Bigtable emulator runs inside Cloud Shell; a real Bigtable node would cost about $0.65 an hour, so this lab never creates one.',
    freeTier: [
      'Never lock a retention policy in a lab: a locked policy cannot be removed, and the bucket cannot be deleted until every object is old enough.',
      'Cloud Storage gives 5 GB-months of Standard storage in «us-central1», «us-east1» and «us-west1».',
    ],
    files: [
      {
        name: 'lifecycle.json',
        about: 'A lifecycle: move to Coldline after 30 days, delete after 365.',
        content: LIFECYCLE,
      },
    ],
    steps: [
      {
        title: 'Answer the five teams',
        body: 'Use the storage decision tree. For each need, name the store: (a) 2 PB of clickstream for SQL analytics; (b) 10 TB of IoT readings, 500,000 writes a second, read by device and time range; (c) a global ledger that needs strong consistency across continents; (d) a regional Postgres app with 200 GB of data; (e) a mobile app that syncs user documents offline.',
        concepts: [1, 3],
        check:
          '(a) BigQuery. (b) Bigtable, with a row key such as «device#reverse_ts». (c) Spanner. (d) Cloud SQL for PostgreSQL, or AlloyDB if it needs more read and analytic speed. (e) Firestore. Add Memorystore when the app needs a sub-millisecond cache in front of any of them.',
      },
      {
        title: 'Create a bucket and set object classes',
        body: 'The storage class is set per object. Nearline, Coldline and Archive cost less to store but charge for reads and have a minimum storage time (30, 90 and 365 days). An early delete is billed as if the object stayed for the minimum.',
        concepts: [4],
        console:
          '1. Create the bucket «PROJECT_ID-lab31» in «us-central1», default class **Standard**.\n2. Upload two small files. Open the second one, click **Edit storage class**, and pick **Nearline**.\n3. Compare the **Storage class** column of the two objects.',
        shell: `gcloud storage buckets create gs://$BUCKET --location=us-central1 --uniform-bucket-level-access
echo "hot data" > hot.txt
echo "cold data" > cold.txt
gcloud storage cp hot.txt gs://$BUCKET/
gcloud storage cp cold.txt gs://$BUCKET/ --storage-class=NEARLINE
gcloud storage ls -L gs://$BUCKET/** | grep -E "gs://|Storage class"`,
        check: '«hot.txt» is STANDARD and «cold.txt» is NEARLINE, in the same bucket.',
      },
      {
        title: 'Add a lifecycle that ages data',
        body: 'Lifecycle rules move or delete objects by age, class, prefix or version count, with no job to run. They are the cheapest cost control you can set.',
        concepts: [4, 5],
        console:
          '1. Open the bucket > **Lifecycle** > **Add a rule**. Action **Set storage class to Coldline**, condition **Age 30 days**. Create.\n2. Add a second rule: action **Delete object**, condition **Age 365 days**.',
        shell: `gcloud storage buckets update gs://$BUCKET --lifecycle-file=lifecycle.json
gcloud storage buckets describe gs://$BUCKET --format="json(lifecycle_config)"`,
        check:
          'The bucket shows two rules: SetStorageClass COLDLINE at 30 days, and Delete at 365 days.',
      },
      {
        title: 'Refuse early deletes with a retention policy',
        body: 'A retention policy makes every object undeletable until it reaches an age. Regulators ask for it (write once, read many). You set a 60-second policy, try to delete, then remove the policy. Soft delete is the other guard: deleted objects stay restorable for 7 days by default.',
        concepts: [4],
        console:
          '1. Open the bucket > **Protection** > **Retention policy** > **Set retention policy**. 60 seconds. Save. Do not lock it.\n2. Try to delete «hot.txt»: the console refuses.\n3. Wait one minute and delete it again: it works.\n4. Remove the retention policy.',
        shell: `gcloud storage buckets update gs://$BUCKET --retention-period=60s
gcloud storage rm gs://$BUCKET/hot.txt
sleep 65
gcloud storage rm gs://$BUCKET/hot.txt
gcloud storage buckets update gs://$BUCKET --clear-retention-period
gcloud storage buckets describe gs://$BUCKET --format="json(soft_delete_policy)"`,
        check:
          'The first delete fails with an error about the retention policy. The second, after 65 seconds, succeeds. The soft delete policy shows a 7-day duration.',
      },
      {
        title: 'Start the Bigtable emulator',
        body: 'The emulator runs Bigtable in memory in Cloud Shell. It has the real API, so «cbt» and client libraries work against it, and it costs nothing.',
        concepts: [2],
        shell: `which cbt || echo "cbt is missing"
# If cbt or the emulator is missing:
# sudo apt-get install -y google-cloud-cli-cbt google-cloud-cli-bigtable-emulator
gcloud beta emulators bigtable start --host-port=localhost:8086 > /tmp/bt.log 2>&1 &
sleep 5
export BIGTABLE_EMULATOR_HOST=localhost:8086
printf 'project = lab\\ninstance = lab\\n' > ~/.cbtrc
cbt createtable trips
cbt createfamily trips loc
cbt setgcpolicy trips loc maxversions=1
cbt ls`,
        check: '«cbt ls» prints «trips».',
      },
      {
        title: 'Design a row key and read by prefix',
        body: 'Bigtable sorts rows by key and serves a key range fast. A key that starts with a timestamp sends every new write to the same node: a hotspot. Start the key with the entity, then a reversed timestamp, so writes spread across devices and the newest reading of each device sorts first.',
        concepts: [2],
        shell: `for t in 1772352000 1772352060 1772352120; do
  for d in dev-07 dev-42; do
    cbt set trips "$d#$((9999999999 - t))" loc:lat=37.7 loc:ts=$t
  done
done
cbt read trips prefix=dev-42# count=1
cbt count trips`,
        check:
          '«cbt count» is 6. The prefix read returns one row for «dev-42» with «ts=1772352120», the newest one, because its reversed timestamp is the smallest. Promote no field you never filter on into the key; keep the key short.',
      },
      {
        title: 'Price the choice',
        body: 'Work it out before you check: 10 TB kept for one year, read once a quarter in full. Use these rough «us-central1» prices per GB a month: Standard $0.020, Nearline $0.010, Coldline $0.004, Archive $0.0012. Retrieval per GB: Nearline $0.01, Coldline $0.02, Archive $0.05. Prices change; check the pricing page for real numbers.',
        concepts: [5],
        check:
          'Storage for a year: Standard about $2,400, Nearline about $1,200, Coldline about $480, Archive about $144. Four full reads of 10 TB: Nearline about $400, Coldline about $800, Archive about $2,000. Coldline wins at about $1,300 a year. Read rarely and never early: Archive. Read daily: Standard.',
      },
    ],
    cleanup: [
      {
        title: 'Stop the emulator',
        body: 'The emulator holds data in memory only; stopping it deletes the table.',
        concepts: [],
        shell: `pkill -f cbtemulator || pkill -f "emulators bigtable"
unset BIGTABLE_EMULATOR_HOST
rm -f ~/.cbtrc`,
      },
      {
        title: 'Delete the bucket',
        body: 'Make sure the retention policy is gone first, or the delete fails.',
        concepts: [],
        console:
          '1. Check that the bucket has no retention policy.\n2. Delete the bucket «PROJECT_ID-lab31».',
        shell: `gcloud storage buckets update gs://$BUCKET --clear-retention-period
gcloud storage rm --recursive gs://$BUCKET
rm -f hot.txt cold.txt lifecycle.json`,
      },
    ],
    verify: `gcloud storage ls | grep lab31 || echo "No lab31 bucket left"
pgrep -f cbtemulator || echo "Emulator stopped"`,
  },
  {
    station: 'data-warehouse',
    title: 'Partition, cluster and pre-aggregate two million trips',
    scenario:
      'The trips table is slow and the finance team’s dashboard reads the whole table on every refresh. You model it as a star, then partition, cluster and pre-aggregate it, and measure every change in bytes and seconds.',
    minutes: 45,
    apis: ['bigquery.googleapis.com'],
    creates: ['BigQuery dataset «lab32» with about 200 MB of generated tables'],
    cost: 'Free in practice. Generating rows reads no table, and the queries read under 1 GB in all.',
    freeTier: [
      'BigQuery gives 1 TiB of queries and 10 GiB of storage each month.',
      'Use a dry run to see bytes before you run a query. A dry run is free.',
    ],
    files: [],
    steps: [
      {
        title: 'Generate a star schema',
        body: 'A fact table of trips points at a small city dimension. In BigQuery the other common shape is one wide table with nested and repeated fields; you build both and compare them later.',
        concepts: [1],
        sql: `CREATE SCHEMA IF NOT EXISTS lab32 OPTIONS (location = 'us-central1');

CREATE OR REPLACE TABLE lab32.dim_city AS
SELECT * FROM UNNEST([
  STRUCT(1 AS city_id, 'San Francisco' AS city, 'US' AS country),
  (2, 'New York', 'US'), (3, 'London', 'GB'), (4, 'Bengaluru', 'IN'), (5, 'São Paulo', 'BR')
]);

CREATE OR REPLACE TABLE lab32.trips_flat AS
SELECT
  a * 10000 + b AS trip_id,
  MOD(a + b, 5) + 1 AS city_id,
  TIMESTAMP_ADD(TIMESTAMP '2026-01-01', INTERVAL CAST(FLOOR(RAND() * 90 * 24 * 60) AS INT64) MINUTE) AS pickup_ts,
  ROUND(5 + RAND() * 45, 2) AS fare,
  ROUND(0.5 + RAND() * 20, 1) AS distance_km
FROM UNNEST(GENERATE_ARRAY(1, 1000)) AS a, UNNEST(GENERATE_ARRAY(1, 2000)) AS b;

SELECT COUNT(*) AS trips FROM lab32.trips_flat;`,
        check: '2,000,000 trips spread over 90 days of 2026 and five cities.',
      },
      {
        title: 'Partition by day and cluster by city',
        body: 'Partitioning splits the table by day, so a date filter reads only those days. Clustering sorts the data inside each partition by city, so a city filter reads fewer blocks. Partition on the column every query filters by; cluster on the next most selective ones.',
        concepts: [2],
        sql: `CREATE OR REPLACE TABLE lab32.trips_part
PARTITION BY DATE(pickup_ts)
CLUSTER BY city_id
AS SELECT * FROM lab32.trips_flat;

SELECT partition_id, total_rows
FROM lab32.INFORMATION_SCHEMA.PARTITIONS
WHERE table_name = 'trips_part'
ORDER BY partition_id
LIMIT 5;`,
        check: 'About 90 partitions such as «20260101», each with roughly 22,000 rows.',
      },
      {
        title: 'Measure the bytes with dry runs',
        body: 'A dry run returns the bytes a query would bill, for free. Compare the same query on both tables. Clustering savings do not show in a dry run, only in the job details after a real run.',
        concepts: [2],
        shell: `for t in trips_flat trips_part; do
  echo "$t:"
  bq query --use_legacy_sql=false --dry_run \\
    "SELECT SUM(fare) FROM lab32.$t WHERE DATE(pickup_ts) = '2026-02-01'"
done
bq query --use_legacy_sql=false --format=prettyjson \\
  "SELECT SUM(fare) AS revenue FROM lab32.trips_part WHERE DATE(pickup_ts) = '2026-02-01' AND city_id = 3"`,
        console:
          '1. Paste each query into the editor and read the estimate in the top right before you run it.\n2. Run the last query, open **Job information**, and read **Bytes billed**.',
        check:
          'The flat table reads about 31 MB for one day; the partitioned table about 0.3 MB. With the city filter too, the bytes billed drop again (BigQuery bills at least 10 MB per table, so the floor may hide it on a table this small).',
      },
      {
        title: 'Force a partition filter',
        body: 'Require a partition filter on a big table, and a query without one fails before it reads a byte. It is the simplest guard against a $1,000 «SELECT *».',
        concepts: [2],
        sql: `ALTER TABLE lab32.trips_part SET OPTIONS (require_partition_filter = TRUE);

SELECT COUNT(*) FROM lab32.trips_part;  -- fails

SELECT COUNT(*) FROM lab32.trips_part
WHERE pickup_ts >= TIMESTAMP '2026-03-01';  -- works

ALTER TABLE lab32.trips_part SET OPTIONS (require_partition_filter = FALSE);`,
        check:
          'The first count fails with «Cannot query over table … without a filter over column(s) pickup_ts». The second returns about 700,000.',
      },
      {
        title: 'Pre-aggregate with a materialized view',
        body: 'A dashboard asks the same aggregate again and again. A materialized view keeps it up to date in the background, and BigQuery can answer a matching query on the base table from the view instead.',
        concepts: [3],
        sql: `CREATE MATERIALIZED VIEW lab32.daily_city_mv
PARTITION BY day
CLUSTER BY city_id
AS SELECT DATE(pickup_ts) AS day, city_id, COUNT(*) AS trips, SUM(fare) AS revenue
FROM lab32.trips_part
GROUP BY day, city_id;

SELECT d.city, SUM(m.revenue) AS revenue
FROM lab32.daily_city_mv AS m
JOIN lab32.dim_city AS d USING (city_id)
WHERE m.day BETWEEN '2026-02-01' AND '2026-02-28'
GROUP BY d.city
ORDER BY revenue DESC;`,
        check:
          'The view holds about 450 rows (90 days × 5 cities), and the February query reads a few kilobytes instead of tens of megabytes.',
      },
      {
        title: 'Change the schema without breaking readers',
        body: 'Adding a nullable column, relaxing REQUIRED to NULLABLE and adding descriptions are safe changes. Renaming or retyping a column breaks readers, so put a logical view in front of tables you expect to change.',
        concepts: [3],
        sql: `ALTER TABLE lab32.trips_part ADD COLUMN tip NUMERIC OPTIONS (description = 'Tip in USD');

CREATE OR REPLACE VIEW lab32.trips_v AS
SELECT trip_id, city_id, pickup_ts, fare, COALESCE(tip, 0) AS tip
FROM lab32.trips_part;

SELECT COUNT(*) AS rows_without_tip FROM lab32.trips_v
WHERE tip = 0 AND pickup_ts >= '2026-03-01';`,
        check:
          'The column is added in seconds with no rewrite. Old rows read NULL, and the view shows 0. The materialized view keeps working because it does not use the new column.',
      },
      {
        title: 'Compare a nested table with the join',
        body: 'Denormalising with a STRUCT removes the join at read time. That is the BigQuery default for read-heavy analytics; keep a separate dimension when it changes often or is shared by many facts.',
        concepts: [1],
        sql: `CREATE OR REPLACE TABLE lab32.trips_nested
PARTITION BY DATE(pickup_ts) AS
SELECT t.trip_id, t.pickup_ts, t.fare, STRUCT(d.city, d.country) AS city
FROM lab32.trips_part AS t
JOIN lab32.dim_city AS d USING (city_id);

SELECT city.country, ROUND(SUM(fare)) AS revenue
FROM lab32.trips_nested
WHERE DATE(pickup_ts) = '2026-02-01'
GROUP BY city.country;`,
        check:
          'Four countries with revenue (US has two cities), and no join in the query. The result matches the star-schema query for the same day.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the dataset',
        body: 'This deletes the tables, the view and the materialized view. The materialized view stops refreshing at once.',
        concepts: [],
        console: '1. Delete the dataset «lab32» in BigQuery.',
        shell: 'bq rm -r -f -d lab32',
      },
    ],
    verify: 'bq ls | grep lab32 || echo "No lab32 dataset left"',
  },
  {
    station: 'data-lake',
    title: 'Build a raw and curated lake with BigLake',
    scenario:
      'Event files land daily as JSON. Analysts want SQL over them today, the platform team wants an open, columnar curated zone, and finance wants raw files gone after 30 days. You build all three on one bucket.',
    minutes: 40,
    apis: [
      'bigquery.googleapis.com',
      'bigqueryconnection.googleapis.com',
      'storage.googleapis.com',
    ],
    vars: { BUCKET: '$PROJECT_ID-lab33' },
    creates: [
      'Cloud Storage bucket «PROJECT_ID-lab33» with «raw/» and «curated/» zones',
      'BigQuery connection «lab33_conn» in «us-central1»',
      'BigQuery dataset «lab33» with BigLake tables',
    ],
    cost: 'Free in practice: a few kilobytes of files, and queries far under the free tier.',
    freeTier: [
      'A BigQuery connection costs nothing by itself.',
      'Lifecycle rules cost nothing to run.',
    ],
    files: [
      {
        name: 'events-2026-04-01.jsonl',
        about: 'Five raw app events from 1 April.',
        content: RAW_EVENTS_DAY1,
      },
      {
        name: 'events-2026-04-02.jsonl',
        about: 'Four raw app events from 2 April.',
        content: RAW_EVENTS_DAY2,
      },
    ],
    steps: [
      {
        title: 'Lay out the zones and land the raw files',
        body: 'One bucket, one prefix per zone: «raw/» exactly as received, «curated/» cleaned and columnar. Raw is never edited, so you can always rebuild curated from it.',
        concepts: [1],
        shell: `gcloud storage buckets create gs://$BUCKET --location=us-central1 --uniform-bucket-level-access
gcloud storage cp events-2026-04-01.jsonl "gs://$BUCKET/raw/events/dt=2026-04-01/"
gcloud storage cp events-2026-04-02.jsonl "gs://$BUCKET/raw/events/dt=2026-04-02/"
gcloud storage ls -r gs://$BUCKET/raw/`,
        check:
          'Two folders under «raw/events/», «dt=2026-04-01» and «dt=2026-04-02», each with one file.',
      },
      {
        title: 'Create a connection for BigLake',
        body: 'A BigLake table reads files through a connection’s service account, not the user’s own access. Users then need access to the table only, never to the bucket, and row and column security work on lake files too.',
        concepts: [1],
        console:
          '1. In BigQuery Explorer, click **Add** > **Connections to external data sources**. Type **Vertex AI remote models, remote functions and BigLake (Cloud Resource)**, ID «lab33_conn», location «us-central1». Create.\n2. Open the connection and copy its **Service account ID**.\n3. In Cloud Storage, open the bucket > **Permissions** > **Grant access**: that service account, role **Storage Object Viewer**.',
        shell: `bq mk --connection --location=us-central1 --connection_type=CLOUD_RESOURCE lab33_conn
export CONN_SA=$(bq show --connection --format=json $PROJECT_ID.us-central1.lab33_conn | jq -r .cloudResource.serviceAccountId)
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \\
  --member=serviceAccount:$CONN_SA --role=roles/storage.objectViewer
bq mk --dataset --location=us-central1 lab33`,
        check:
          'The connection shows a service account such as «bqcx-…@gcp-sa-bigquery-condel.iam.gserviceaccount.com», and the bucket grants it Storage Object Viewer.',
      },
      {
        title: 'Query the raw zone in place',
        body: 'The table reads both days and turns «dt=…» into a column. Replace «YOUR_BUCKET» twice. If the query says the connection has no access, wait a minute for the role to apply.',
        concepts: [1],
        sql: `CREATE OR REPLACE EXTERNAL TABLE lab33.events_raw (
  event_id STRING, user_id STRING, event_type STRING, event_ts TIMESTAMP, amount FLOAT64
)
WITH PARTITION COLUMNS (dt DATE)
WITH CONNECTION \`us-central1.lab33_conn\`
OPTIONS (
  format = 'NEWLINE_DELIMITED_JSON',
  uris = ['gs://YOUR_BUCKET/raw/events/*'],
  hive_partition_uri_prefix = 'gs://YOUR_BUCKET/raw/events'
);

SELECT dt, event_type, COUNT(*) AS events, SUM(amount) AS revenue
FROM lab33.events_raw
GROUP BY dt, event_type
ORDER BY dt, event_type;`,
        check:
          'Four rows: 2026-04-01 has 2 purchases (57.5) and 3 views; 2026-04-02 has 2 purchases (106.25) and 2 views.',
      },
      {
        title: 'Write the curated zone as Parquet',
        body: 'Curated data is typed, filtered and columnar, partitioned the way readers filter. Here only purchases go to curated, one folder per day.',
        concepts: [1],
        shell: `for d in 2026-04-01 2026-04-02; do
  bq query --use_legacy_sql=false "EXPORT DATA OPTIONS (
    uri = 'gs://$BUCKET/curated/purchases/dt=$d/part-*.parquet', format = 'PARQUET', overwrite = true)
    AS SELECT event_id, user_id, event_ts, amount FROM lab33.events_raw
    WHERE dt = '$d' AND event_type = 'purchase'"
done
gcloud storage ls -r gs://$BUCKET/curated/`,
        check: 'Two Parquet files, one under each «dt=» folder of «curated/purchases/».',
      },
      {
        title: 'Expire the raw zone automatically',
        body: 'A lifecycle rule with a prefix condition deletes raw files after 30 days and leaves curated data alone. Because raw is the source of truth, decide the period with the owners first; here it is a lab.',
        concepts: [1],
        shell: `cat > raw-lifecycle.json <<'EOF'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 30, "matchesPrefix": ["raw/"]}}]}
EOF
gcloud storage buckets update gs://$BUCKET --lifecycle-file=raw-lifecycle.json
gcloud storage buckets describe gs://$BUCKET --format="json(lifecycle_config)"`,
        check: 'One rule: Delete at age 30, matching the prefix «raw/».',
      },
    ],
    cleanup: [
      {
        title: 'Delete the dataset and the connection',
        body: 'Delete the tables first, then the connection they use.',
        concepts: [],
        console:
          '1. Delete the dataset «lab33».\n2. In the Explorer, open **Connections** > «us-central1.lab33_conn» and delete it.',
        shell: `bq rm -r -f -d lab33
bq rm --connection $PROJECT_ID.us-central1.lab33_conn`,
      },
      {
        title: 'Delete the bucket and the local files',
        body: 'This removes both zones.',
        concepts: [],
        console: '1. Delete the bucket «PROJECT_ID-lab33».',
        shell: `gcloud storage rm --recursive gs://$BUCKET
rm -f events-2026-04-0*.jsonl raw-lifecycle.json`,
      },
    ],
    verify: `bq ls | grep lab33 || echo "No lab33 dataset left"
bq ls --connection --location=us-central1 | grep lab33 || echo "No lab33 connection left"
gcloud storage ls | grep lab33 || echo "No lab33 bucket left"`,
  },
  {
    station: 'data-platform',
    title: 'Run a small governed data platform',
    scenario:
      'Two domain teams publish data on a shared platform. Each team owns its datasets, the platform team owns the guardrails, and an email column must stay hidden from anyone without a reason to see it.',
    minutes: 40,
    apis: ['bigquery.googleapis.com', 'datacatalog.googleapis.com'],
    creates: [
      'BigQuery datasets «lab34_sales» and «lab34_marketing»',
      'A policy tag taxonomy «lab34_pii» with the tag «email»',
    ],
    cost: 'Free in practice. Policy tags and taxonomies have no charge, and the tables are tiny.',
    freeTier: ['BigQuery gives 1 TiB of queries and 10 GiB of storage each month.'],
    files: [
      {
        name: 'customers.csv',
        about: 'Six made-up customers, with an email column to protect.',
        content: CUSTOMERS,
      },
    ],
    steps: [
      {
        title: 'Create one dataset per domain, with labels',
        body: 'In a federated platform each domain owns its datasets, and labels make ownership machine-readable. The platform can then find every dataset by domain, owner or tier without a spreadsheet.',
        concepts: [1],
        shell: `bq mk --dataset --location=us-central1 --label=domain:sales --label=tier:gold \\
  --description="Sales domain. Owner: sales-data team." lab34_sales
bq mk --dataset --location=us-central1 --label=domain:marketing --label=tier:silver \\
  --description="Marketing domain. Owner: growth team." lab34_marketing
bq load --source_format=CSV --skip_leading_rows=1 --autodetect lab34_sales.customers customers.csv
bq query --use_legacy_sql=false \\
  'CREATE TABLE lab34_marketing.campaigns AS SELECT "spring-26" AS campaign, "C-02" AS customer_id UNION ALL SELECT "spring-26", "C-05"'`,
        sql: `SELECT schema_name, option_value AS labels
FROM \`region-us-central1\`.INFORMATION_SCHEMA.SCHEMATA_OPTIONS
WHERE option_name = 'labels' AND schema_name LIKE 'lab34%';`,
        check:
          'Two rows: «lab34_marketing» with domain marketing, and «lab34_sales» with domain sales.',
      },
      {
        title: 'Create a policy tag for personal data',
        body: 'A policy tag is a central label for a kind of data, such as «email». You attach it to columns in any domain’s tables; the platform team controls who may read every column with that tag, in one place.',
        concepts: [1],
        console: `1. Open **BigQuery** > **Policy tags** (under **Governance**) > **Create taxonomy**.
2. Name «lab34_pii», location «us-central1». Add one policy tag: «email». Create.
3. Open the taxonomy and turn on **Enforce access control**.`,
        shell: `gcloud data-catalog taxonomies create --location=us-central1 \\
  --display-name=lab34_pii --activated-policy-types=FINE_GRAINED_ACCESS_CONTROL
export TAXONOMY=$(gcloud data-catalog taxonomies list --location=us-central1 \\
  --filter="displayName=lab34_pii" --format="value(name)")
gcloud data-catalog taxonomies policy-tags create --taxonomy=$TAXONOMY \\
  --location=us-central1 --display-name=email
export TAG=$(gcloud data-catalog taxonomies policy-tags list --taxonomy=$TAXONOMY \\
  --location=us-central1 --format="value(name)")
echo $TAG`,
        check: 'A taxonomy «lab34_pii» with one tag «email», and access control enforced.',
      },
      {
        title: 'Tag the email column',
        body: 'Attach the tag in the table schema. From now on, reading «email» needs the Fine-Grained Reader role on the tag, and project Owner does not include it.',
        concepts: [1],
        console:
          '1. Open «lab34_sales.customers» > **Schema** > **Edit schema**.\n2. Tick «email», click **Add policy tag**, and pick «lab34_pii» > «email». Save.',
        shell: `bq show --schema --format=prettyjson lab34_sales.customers > schema.json
jq --arg tag "$TAG" 'map(if .name == "email" then . + {policyTags: {names: [$tag]}} else . end)' \\
  schema.json > tagged.json
bq update lab34_sales.customers tagged.json`,
        check: 'The schema shows a policy tag on «email» only.',
      },
      {
        title: 'Prove the column is protected',
        body: 'Run both queries. BigQuery refuses the first without returning any row. The second leaves the column out, so it works.',
        concepts: [1],
        sql: `SELECT * FROM lab34_sales.customers;

SELECT * EXCEPT (email) FROM lab34_sales.customers;`,
        check:
          'The first query fails with an access denied error that names the policy tag. The second returns six customers without emails.',
      },
      {
        title: 'Grant yourself the reason to see it',
        body: 'Grant Fine-Grained Reader on the tag to the people who need the column, ideally a group. Here you grant it to yourself, wait a minute, and read the column.',
        concepts: [1],
        console:
          '1. Open **Policy tags** > «lab34_pii». Tick «email», open the info panel, and click **Add principal**.\n2. Add your account with the role **Fine-Grained Reader**. Save, then run «SELECT * FROM lab34_sales.customers» again.',
        shell: `curl -s -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
  -H "x-goog-user-project: $PROJECT_ID" -H "Content-Type: application/json" \\
  "https://datacatalog.googleapis.com/v1/$TAG:setIamPolicy" \\
  -d "$(jq -n --arg m "user:$(gcloud config get-value account)" '{policy: {bindings: [{role: "roles/datacatalog.categoryFineGrainedReader", members: [$m]}]}}')"
sleep 60
bq query --use_legacy_sql=false 'SELECT full_name, email FROM lab34_sales.customers LIMIT 2'`,
        check:
          'The query now returns emails. The same grant would open «email» columns in every domain that uses the tag.',
      },
      {
        title: 'Join across domains through the platform',
        body: 'Domains publish, the platform joins. Marketing reads the sales customers it needs, without a copy and without the email column.',
        concepts: [1],
        sql: `SELECT m.campaign, c.full_name, c.segment
FROM lab34_marketing.campaigns AS m
JOIN lab34_sales.customers AS c USING (customer_id);`,
        check: 'Two rows: Lukas Becker (smb) and Sam Carter (consumer) in campaign spring-26.',
      },
    ],
    cleanup: [
      {
        title: 'Delete the datasets',
        body: 'This deletes both domains’ tables.',
        concepts: [],
        console: '1. Delete the datasets «lab34_sales» and «lab34_marketing».',
        shell: `bq rm -r -f -d lab34_sales
bq rm -r -f -d lab34_marketing
rm -f customers.csv schema.json tagged.json`,
      },
      {
        title: 'Delete the taxonomy',
        body: 'Deleting the taxonomy deletes its tags and their access grants.',
        concepts: [],
        console: '1. Open **Policy tags**, tick «lab34_pii» and click **Delete**.',
        shell: 'gcloud data-catalog taxonomies delete $TAXONOMY --location=us-central1 --quiet',
      },
    ],
    verify: `bq ls | grep lab34 || echo "No lab34 dataset left"
gcloud data-catalog taxonomies list --location=us-central1 --format="value(displayName)" | grep lab34 || echo "No lab34 taxonomy left"`,
  },
];
