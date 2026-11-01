/**
 * GCP flashcards, grouped by line.
 *
 * Generated from Sandeep's PDE Exam Lab module and kept as data. Edit the
 * text here; see lib/course/gcp/README.md for the rules.
 */

import type { Flashcard } from '@/types/gcp';

export const CARDS: readonly Flashcard[] = [
  {
    line: 'design',
    front: 'Least-privilege way to let an analyst query only dataset X',
    back: 'bigquery.jobUser on the project (to run jobs) + bigquery.dataViewer on dataset X, granted to a group.',
  },
  {
    line: 'design',
    front: 'Authorized view',
    back: "A view in one dataset allowed to read source tables in another. Users get access to the view's dataset only, never the source tables.",
  },
  {
    line: 'design',
    front: 'Row-level vs column-level security in BigQuery',
    back: 'Rows: CREATE ROW ACCESS POLICY … FILTER USING(...). Columns: policy tags from a taxonomy + Fine-Grained Reader, optionally with dynamic data masking.',
  },
  {
    line: 'design',
    front: 'CMEK vs CSEK vs EKM',
    back: 'CMEK: your key in Cloud KMS. CSEK: you pass the raw key per request (GCS/Compute only). EKM: key lives in an external key manager outside Google.',
  },
  {
    line: 'design',
    front: 'What does VPC Service Controls protect against?',
    back: 'Data exfiltration via Google APIs: copying data out of the perimeter even with valid IAM credentials.',
  },
  {
    line: 'design',
    front: 'DLP transform that is reversible and keeps the original format',
    back: 'Format-preserving encryption (FPE-FFX).',
  },
  {
    line: 'design',
    front: 'DLP transform for joinable, one-way pseudonyms',
    back: 'Cryptographic hash (HMAC-SHA256) tokenization.',
  },
  {
    line: 'design',
    front: "Can a BigQuery dataset's location be changed?",
    back: 'No. Create a new dataset in the target location and copy (DTS dataset copy) or export/load.',
  },
  {
    line: 'design',
    front: 'Which audit logs are always on?',
    back: 'Admin Activity (and System Event). Data Access logs are off by default except for BigQuery.',
  },
  {
    line: 'design',
    front: 'Turbo replication',
    back: 'Dual-region Cloud Storage feature: 100% of new objects replicated to both regions within 15 minutes (RPO 15 min).',
  },
  {
    line: 'design',
    front: 'BigQuery time travel window',
    back: '2 to 7 days (default 7), configurable per dataset; then a 7-day fail-safe recoverable only via support.',
  },
  {
    line: 'design',
    front: 'Transfer 2 PB from on-prem with 100 Mbps',
    back: 'Transfer Appliance. 1 TB at 100 Mbps ≈ 1 day, so 2 PB would take years online.',
  },
  {
    line: 'design',
    front: 'Database Migration Service vs Datastream',
    back: 'DMS: migrate a DB to Cloud SQL/AlloyDB with continuous replication and cutover. Datastream: CDC stream from OLTP into BigQuery/GCS for analytics.',
  },
  {
    line: 'design',
    front: 'Hadoop migration: where does HDFS data go?',
    back: 'Cloud Storage via the GCS connector, so clusters can be ephemeral and data persists independently.',
  },
  {
    line: 'design',
    front: 'Data Validation Tool',
    back: 'Open-source CLI to compare source and target after migration: counts, aggregates, row hashes.',
  },
  {
    line: 'ingest',
    front: 'Cause of many duplicate messages at a push endpoint',
    back: "The endpoint doesn't acknowledge (2xx) within the ack deadline, so Pub/Sub redelivers.",
  },
  {
    line: 'ingest',
    front: 'Default Pub/Sub delivery guarantee',
    back: 'At-least-once. Exactly-once delivery can be enabled on pull subscriptions; order needs ordering keys.',
  },
  {
    line: 'ingest',
    front: 'How to replay Pub/Sub messages after a bad deployment',
    back: 'Seek the subscription to a timestamp or a snapshot (requires message retention).',
  },
  {
    line: 'ingest',
    front: 'Pub/Sub → BigQuery with no transformation',
    back: 'BigQuery subscription (no Dataflow needed).',
  },
  {
    line: 'ingest',
    front: 'Session window',
    back: 'Per-key window that closes after a gap of inactivity. E.g. basket abandonment: gap = 60 minutes.',
  },
  {
    line: 'ingest',
    front: 'Sliding window',
    back: "Fixed size, overlapping, starts every period. 'Average of last hour, updated every 5 minutes'.",
  },
  {
    line: 'ingest',
    front: 'Watermark',
    back: "Dataflow's estimate that all events with event time ≤ T have arrived; data behind it is late.",
  },
  {
    line: 'ingest',
    front: 'Accumulating vs discarding panes',
    back: 'Accumulating: each firing contains all data so far. Discarding: only data since last firing.',
  },
  {
    line: 'ingest',
    front: 'Drain vs cancel a streaming job',
    back: 'Drain: stop reading, finish in-flight data, no loss. Cancel: stop immediately, in-flight data lost.',
  },
  {
    line: 'ingest',
    front: 'Update a running streaming Dataflow job in place',
    back: 'Launch with --update and the same job name (transform mapping if names changed). Incompatible → drain + new job.',
  },
  {
    line: 'ingest',
    front: 'FlexRS',
    back: 'Discounted Dataflow batch using preemptible VMs with delayed start (up to 6 h). For non-urgent batch.',
  },
  {
    line: 'ingest',
    front: 'Classic vs Flex template',
    back: 'Classic: graph fixed at build time. Flex: container image, graph built at launch, more flexible; preferred.',
  },
  {
    line: 'ingest',
    front: 'Dead-letter pattern in Beam',
    back: 'Catch errors in the DoFn, emit failed elements to a tagged side output, write them to a separate sink for inspection.',
  },
  {
    line: 'ingest',
    front: 'Side input',
    back: 'Small read-only dataset broadcast to all workers for lookups/enrichment.',
  },
  {
    line: 'ingest',
    front: 'Combine vs GroupByKey',
    back: 'Combine pre-aggregates on workers before shuffle (associative/commutative). Scales better than GroupByKey + manual reduce.',
  },
  {
    line: 'ingest',
    front: 'Best file format for BigQuery loads',
    back: 'Avro: self-describing schema, compressed blocks still parallel. Parquet/ORC also good.',
  },
  {
    line: 'ingest',
    front: 'Why avoid gzip CSV for BigQuery loads?',
    back: "BigQuery can't read gzip files in parallel, so loads are slower (and max 4 GB per file).",
  },
  {
    line: 'ingest',
    front: 'Exactly-once streaming into BigQuery',
    back: 'Storage Write API (committed stream with offsets).',
  },
  {
    line: 'ingest',
    front: 'Dataproc secondary workers',
    back: 'Preemptible/Spot by default, compute only, no HDFS. Cheap extra capacity.',
  },
  {
    line: 'ingest',
    front: 'Ephemeral Dataproc cluster pattern',
    back: 'Create cluster → run job → delete; data in GCS, metastore in Dataproc Metastore.',
  },
  {
    line: 'ingest',
    front: 'Dataproc graceful decommissioning',
    back: 'When downscaling, lets workers finish in-progress YARN work before removal.',
  },
  {
    line: 'ingest',
    front: 'Composer vs Workflows',
    back: 'Composer: Airflow, complex DAGs, retries, backfills, many operators. Workflows: serverless, lightweight sequences of API calls.',
  },
  {
    line: 'ingest',
    front: 'Trigger a Composer DAG when a file lands',
    back: 'GCS finalize event → Cloud Run function → Airflow REST API (or a sensor in the DAG).',
  },
  {
    line: 'ingest',
    front: 'Dataflow firewall ports',
    back: 'TCP 12345 (streaming) and 12346 (batch) between workers, unless Streaming Engine/Shuffle handle it.',
  },
  {
    line: 'ingest',
    front: 'Dedupe streaming rows with unique ID and timestamp',
    back: 'ROW_NUMBER() OVER (PARTITION BY id ORDER BY ts DESC) and keep row = 1.',
  },
  {
    line: 'storage',
    front: 'Bigtable row key for per-sensor time-series dashboards',
    back: 'sensorId#timestamp (high-cardinality prefix first, timestamp second). Never start with the timestamp.',
  },
  {
    line: 'storage',
    front: 'Bigtable tool to find hotspots',
    back: 'Key Visualizer.',
  },
  {
    line: 'storage',
    front: 'Bigtable transaction scope',
    back: 'Single-row atomicity only.',
  },
  {
    line: 'storage',
    front: 'When is Bigtable a poor fit?',
    back: 'Small data (< 1 TB), ad-hoc SQL with joins, multi-row transactions.',
  },
  {
    line: 'storage',
    front: 'Spanner primary key anti-pattern',
    back: 'Monotonically increasing keys (timestamps, sequences) → hotspots. Use UUIDv4 or bit-reversed sequence.',
  },
  {
    line: 'storage',
    front: 'Spanner interleaved tables',
    back: 'Store child rows physically with their parent row for efficient parent-child joins.',
  },
  {
    line: 'storage',
    front: 'Cloud Storage minimum storage durations',
    back: 'Nearline 30 d, Coldline 90 d, Archive 365 d. Same latency for all.',
  },
  {
    line: 'storage',
    front: 'WORM retention for compliance in GCS',
    back: "Retention policy + Bucket Lock (locked policy can't be removed or shortened).",
  },
  {
    line: 'storage',
    front: 'Autoclass',
    back: 'Automatically moves objects between storage classes by access; for unknown/mixed patterns.',
  },
  {
    line: 'storage',
    front: 'BigQuery long-term storage',
    back: 'Table/partition not modified for 90 days → ~50% lower storage price automatically.',
  },
  {
    line: 'storage',
    front: 'Partition vs cluster',
    back: 'Partition: coarse pruning, exact cost estimate, partition-level management. Cluster: up to 4 columns, high cardinality, block-level pruning.',
  },
  {
    line: 'storage',
    front: 'Max columns for BigQuery clustering',
    back: '4 (order matters).',
  },
  {
    line: 'storage',
    front: 'Query date-sharded tables',
    back: "Wildcard table in backticks: 'project.dataset.events_*' with WHERE _TABLE_SUFFIX BETWEEN …",
  },
  {
    line: 'storage',
    front: 'Nested & repeated fields',
    back: 'STRUCT/ARRAY columns that keep child records in the parent row, avoiding joins (BigQuery denormalisation).',
  },
  {
    line: 'storage',
    front: 'Change a column from STRING to TIMESTAMP in BigQuery',
    back: 'CREATE TABLE … AS SELECT CAST(...) (new table or replace), then load and query that table.',
  },
  {
    line: 'storage',
    front: 'Dataplex zone types',
    back: 'Raw (any format) and curated (cleaned, columnar: Parquet/Avro/ORC or BigQuery).',
  },
  {
    line: 'storage',
    front: 'Database for app backend that must auto-scale with no infra work',
    back: 'Firestore (formerly Datastore).',
  },
  {
    line: 'storage',
    front: 'AlloyDB in one line',
    back: 'PostgreSQL-compatible OLTP with a columnar engine for fast analytics on live data.',
  },
  {
    line: 'analysis',
    front: "Looker Studio report missing last hour's data",
    back: "Data freshness/caching: refresh or lower the data freshness interval in the report's data source.",
  },
  {
    line: 'analysis',
    front: 'BI Engine',
    back: 'In-memory BigQuery acceleration reservation for sub-second dashboard queries.',
  },
  {
    line: 'analysis',
    front: 'Does LIMIT reduce bytes billed?',
    back: 'No (on-demand pricing counts bytes scanned). Select fewer columns and filter partitions instead.',
  },
  {
    line: 'analysis',
    front: 'TRANSFORM clause in BigQuery ML',
    back: 'Feature preprocessing applied at training and automatically at prediction — avoids training/serving skew.',
  },
  {
    line: 'analysis',
    front: 'BigQuery ML model for forecasting',
    back: 'ARIMA_PLUS with ML.FORECAST (or AI.FORECAST).',
  },
  {
    line: 'analysis',
    front: 'Overfitting deep network fix',
    back: 'Dropout, L1/L2 regularisation, more data, early stopping, simpler model.',
  },
  {
    line: 'analysis',
    front: 'Unsupervised anomaly detection fits when…',
    back: 'Anomalies are rare and future anomalies may differ from past ones (no reliable labels).',
  },
  {
    line: 'analysis',
    front: 'Model must adapt to changing preferences',
    back: 'Continuously retrain on existing + new data.',
  },
  {
    line: 'analysis',
    front: 'Vector search in BigQuery',
    back: 'ML.GENERATE_EMBEDDING → CREATE VECTOR INDEX → VECTOR_SEARCH.',
  },
  {
    line: 'analysis',
    front: 'Analytics Hub linked dataset',
    back: "Read-only, zero-copy reference to a publisher's shared dataset in the subscriber's project.",
  },
  {
    line: 'analysis',
    front: 'Data clean room',
    back: "Shared analysis environment with rules (e.g. aggregation thresholds) so parties can't see each other's raw rows.",
  },
  {
    line: 'operations',
    front: 'BigQuery on-demand vs capacity',
    back: 'On-demand: per TiB scanned. Capacity (Editions): pay for slots (baseline + autoscaling), predictable.',
  },
  {
    line: 'operations',
    front: "Cap a single user's daily BigQuery spend",
    back: 'Custom quota: query usage per day per user.',
  },
  {
    line: 'operations',
    front: 'Batch query priority',
    back: 'Queued until resources free (start within 24 h); not counted against interactive concurrency.',
  },
  {
    line: 'operations',
    front: 'Real-time alert on a specific log event',
    back: 'Log sink with an advanced filter → Pub/Sub → subscriber/monitoring tool.',
  },
  {
    line: 'operations',
    front: 'Streaming pipeline falling behind — what to alert on?',
    back: 'Dataflow system lag / data freshness, Pub/Sub oldest_unacked_message_age.',
  },
  {
    line: 'operations',
    front: 'Find who ran the most expensive queries',
    back: 'INFORMATION_SCHEMA.JOBS_BY_PROJECT grouped by user_email, total_bytes_billed.',
  },
  {
    line: 'operations',
    front: 'Retry strategy for a failing dependency',
    back: 'Exponential backoff with jitter and a cap.',
  },
  {
    line: 'operations',
    front: 'Memorystore manual failover modes',
    back: 'limited-data-loss (default; aborts if > 30 MB pending replication) and force-data-loss.',
  },
  {
    line: 'operations',
    front: 'Cloud SQL HA vs read replica',
    back: 'HA: synchronous standby, automatic failover. Read replica: async, offloads reads, promote manually.',
  },
  {
    line: 'operations',
    front: 'Undo a bad UPDATE in BigQuery from an hour ago',
    back: 'Query/restore with FOR SYSTEM_TIME AS OF (time travel).',
  },
];
