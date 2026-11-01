/**
 * GCP course, line 3: Storing the data.
 *
 * Generated from Sandeep's PDE Exam Lab module and kept as data. Edit the
 * text here; see lib/course/gcp/README.md for the rules.
 */

import type { GcpLine } from '@/types/gcp';

export const line: GcpLine = {
  slug: 'storage',
  number: 3,
  title: 'Storing the data',
  short: 'Storage',
  weight: 20,
  hue: 4,
  intro:
    'Choosing the right store for an access pattern is the single most-tested skill. Learn the decision tree cold, then the design details: Bigtable row keys, BigQuery partitioning/clustering, Cloud Storage classes and lifecycle.',
  boss: {
    title: 'The Storage Exchange',
    story: 'Every team arrives with data and an access pattern. Route each one to the right store.',
  },
  stations: [
    {
      slug: 'storage-selection',
      code: '3.1',
      title: 'Selecting storage systems',
      mission:
        "Every team at Cymbal wants 'a database'. Product catalog, carts, price history, sessions, product images: route each one to the right store for how it's actually read and written.",
      concepts: [
        {
          title: 'The storage decision tree',
          body: "| Need | Service | Key traits |\n|---|---|---|\n| Analytics / data warehouse, SQL over TB–PB | **BigQuery** | Serverless, columnar, separate storage & compute; not for OLTP |\n| Files, blobs, data lake, backups | **Cloud Storage** | Objects up to 5 TiB, classes by access frequency |\n| Relational OLTP, regional, ≤ ~64 TB | **Cloud SQL** | MySQL/PostgreSQL/SQL Server; vertical scaling; HA + read replicas |\n| High-performance PostgreSQL, HTAP | **AlloyDB** | PostgreSQL-compatible, columnar engine for analytics, 99.99% |\n| Relational, horizontal scale, global, strong consistency | **Spanner** | 99.999% multi-region, external consistency, SQL |\n| Huge key-value / wide-column, ms latency, very high write throughput (IoT, time series, ad-tech) | **Bigtable** | No SQL joins, one index (row key), HBase API, scales linearly with nodes |\n| Documents for web/mobile apps, serverless, transactions | **Firestore** | Formerly Datastore; auto-scaling, offline sync |\n| Sub-millisecond cache, sessions, leaderboards | **Memorystore** | Redis / Valkey / Memcached |\n| Open table formats over files with warehouse security | **BigLake** | Iceberg/Parquet in GCS/S3/Azure with row/column security |\n\nWalk the questions in order: **structured?** → **transactional or analytical?** → **scale and geography?** → **latency?** → **ops preference (serverless)?**\n\n> [!trap] Exam traps\n> BigQuery as an application database for point lookups/updates.\n>\n> Bigtable for < 1 TB or for ad-hoc SQL with joins.\n>\n> Cloud SQL when writes must scale globally.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'point-of-sale payments, user base may grow exponentially, no infra scaling' | Firestore (old: Datastore) or Spanner if relational+global |\n| 'sensor data, millions of writes/sec, ms reads by device and time' | Bigtable |\n| 'global inventory, strong consistency, SQL' | Spanner |",
        },
        {
          title: 'Bigtable design',
          body: "A sorted map: **row key → column families → columns → timestamped cells**. Rows are sorted lexicographically by key and split into tablets across nodes. The row key is the **only index**, so it decides performance.\n\n### Row key rules\n\n- Design keys around your most common query (point reads and prefix scans).\n- **Avoid hotspots**: never start the key with a monotonically increasing value (timestamp, sequence) — all writes hit one node. Put a high-cardinality identifier first: «sensorId#timestamp».\n- **Field promotion**: move fields you query by into the key («device#metric#ts»).\n- **Reverse timestamp** («MAX - ts») when you want newest rows first in a scan.\n- **Salting/hashing** a prefix spreads load but makes range scans harder — use only if no natural spreading field exists.\n- Keep rows reasonably small (cells ≤ 10 MB, row ≤ 100 MB); prefer **tall and narrow** tables for time series.\n\n### Operations\n\n- Throughput scales linearly with nodes; enable **autoscaling**. SSD for latency; HDD only for large, rarely read archives.\n- Performance needs data and time to settle: rebalancing after scaling, and tests with < 300 GB / a few minutes are misleading.\n- **Key Visualizer** heatmaps reveal hotspots. **App profiles** separate workloads (batch vs serving) and choose single-cluster vs multi-cluster routing.\n- **Garbage collection** per column family (max versions, max age). Atomicity only per row.\n\n> [!trap] Exam traps\n> Row key = timestamp or timestamp#sensor (hotspot).\n>\n> Row key = sensorId alone (each row grows forever, no time range scans).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'real-time dashboards per sensor, poor performance' | Row key sensorId#timestamp |\n| 'detect which keys are hot' | Key Visualizer |\n| 'isolate batch analytics from serving traffic' | Separate app profiles / clusters |",
        },
        {
          title: 'Spanner, Cloud SQL, AlloyDB, Firestore, Memorystore details',
          body: "### Spanner\n\n- Capacity in nodes or **processing units** (1,000 PU = 1 node). Regional (99.99%) or multi-region (99.999%) configs.\n- Primary key choice matters like Bigtable: avoid monotonically increasing keys → use UUIDv4 or bit-reversed sequences. **Interleaved tables** co-locate child rows with parents for fast joins.\n- Secondary indexes, change streams (to Dataflow/BigQuery), GoogleSQL and PostgreSQL dialects, graph and vector search.\n\n### Cloud SQL\n\n- Vertical scaling; storage up to 64 TB. **HA**: synchronous standby in another zone with automatic failover. **Read replicas** (async) offload reads; **cross-region replicas** for DR (promote manually).\n- Automated backups + binary logs → point-in-time recovery. Connect via private IP or the Cloud SQL Auth Proxy.\n\n### AlloyDB\n\nPostgreSQL-compatible, much faster transactions, built-in **columnar engine** accelerates analytical queries on live operational data, read pool instances, 99.99% SLA.\n\n### Firestore\n\nServerless document database (Native mode, or Datastore mode for older apps). ACID transactions, strongly consistent, automatic scaling — the answer to \"no infrastructure scaling for an app backend\".\n\n### Memorystore\n\nRedis (Standard tier = replica + automatic failover, up to 5 read replicas, 99.9%), Redis Cluster, Valkey, Memcached. Use for caching, session state, leaderboards (sorted sets), or as fast state for streaming jobs.\n\n> [!trap] Exam traps\n> Choosing Memorystore as the system of record (it's a cache).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'need PostgreSQL with fast analytical queries on operational data' | AlloyDB |\n| 'cache frequently read query results, sub-ms' | Memorystore for Redis |",
        },
        {
          title: 'Cloud Storage classes, lifecycle and protection',
          body: "| Class | Min storage duration | Access pattern |\n|---|---|---|\n| Standard | None | Hot data, frequent access |\n| Nearline | 30 days | About once a month |\n| Coldline | 90 days | About once a quarter |\n| Archive | 365 days | Less than once a year (still ms latency) |\n\nAll classes have the same latency and durability; colder classes trade lower storage price for **retrieval fees** and early-deletion charges.\n\n- **Lifecycle rules**: conditions (age, created before, storage class, number of newer versions, live/noncurrent) → actions («SetStorageClass», «Delete», abort incomplete uploads).\n- **Autoclass**: moves objects automatically (unaccessed 30 days → Nearline → colder; accessed → Standard). Best for unknown/mixed patterns; not if you know the pattern or services scan the bucket regularly.\n- **Object versioning** keeps noncurrent versions; **soft delete** (default 7 days) recovers deleted objects.\n- **Retention policy + Bucket Lock** = WORM compliance (objects can't be deleted until the period ends; a locked policy can't be removed). **Object holds** for legal hold.\n- Locations: region, dual-region (+ turbo replication), multi-region. Same location as BigQuery dataset for loads.\n- Access: uniform bucket-level access (IAM only), signed URLs for time-limited access without an account.\n\n> [!trap] Exam traps\n> Archive class for data that is read monthly (retrieval + early deletion costs).\n>\n> Thinking colder classes have higher latency.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'logs must be kept 7 years and can't be deleted' | Retention policy + Bucket Lock |\n| 'move objects to Coldline after 90 days, delete after 1 year' | Lifecycle rules |\n| 'unknown access patterns, minimise effort' | Autoclass |",
        },
        {
          title: 'Planning storage cost and performance',
          body: "- **BigQuery storage**: active vs **long-term** (table or partition not modified for 90 days → ~50% cheaper, automatically, same performance). Partitioning lets old partitions go long-term while new ones change. Choose **logical** or **physical (compressed)** storage billing per dataset.\n- **Table and partition expiration** automatically delete data you don't need to keep.\n- **Bigtable**: cost = nodes + storage; HDD only for cold, large data.\n- **Spanner**: start regional, add PUs as needed.\n- Right-size by access pattern: archive raw files in GCS cold classes, keep curated tables in BigQuery.\n\n> [!trap] Exam traps\n> Exporting old BigQuery data to GCS just to save money when long-term storage pricing already halves the cost.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'keep only 2 years of events automatically' | Partition expiration |",
        },
      ],
      keyPoints: [
        {
          point:
            'Ask four things in order: analytical or transactional? relational or not? how big and how global? how fast?',
          check: {
            type: 'match',
            prompt: 'Match each workload to its store.',
            pairs: [
              ['Petabyte SQL analytics', 'BigQuery'],
              ['Global relational OLTP with strong consistency', 'Spanner'],
              ['Millions of writes/sec, lookups by device and time', 'Bigtable'],
              ['Sub-millisecond session cache', 'Memorystore'],
            ],
            why: 'BigQuery is the warehouse, Spanner is horizontally scaled relational OLTP, Bigtable is the wide-column store for huge throughput, and Memorystore is the in-memory cache.',
          },
        },
        {
          point:
            'The row key is the only index. Spread writes with a high-cardinality prefix, and never lead with a timestamp.',
          check: {
            type: 'choice',
            prompt: "Which Bigtable row key returns a user's most recent events first in a scan?",
            options: [
              'userId#(MAX_TS − timestamp)',
              '(MAX_TS − timestamp)#userId',
              'userId on its own, one row each',
              'hash(timestamp)#userId',
            ],
            answers: [0],
            why: "Rows sort lexicographically, so a reversed timestamp after the user ID puts the newest rows first within that user's range. A leading timestamp hotspots, userId alone makes one ever-growing row, and a hashed timestamp scatters a user's events.",
          },
        },
        {
          point:
            "Relational and regional: Cloud SQL. PostgreSQL that's also fast at analytics: AlloyDB. Relational and global: Spanner. Documents: Firestore. Cache: Memorystore.",
          check: {
            type: 'choice',
            prompt:
              'In Spanner, «order_items» is almost always read together with its parent row in «orders». How do you make those reads efficient?',
            options: [
              'Interleave order_items in orders, with the parent key as the key prefix',
              'Add a secondary index on order_items keyed by order ID',
              'Move order_items to Bigtable and look them up by order ID',
              'Put orders and order_items in separate Spanner instances',
            ],
            answers: [0],
            why: "Interleaving stores child rows physically next to their parent, so parent-plus-children reads touch one place. An index doesn't co-locate the data, and the other options split data that is used together.",
          },
        },
        {
          point:
            'All classes have the same latency and durability. Colder classes trade cheaper storage for retrieval fees and minimum storage durations.',
          check: {
            type: 'match',
            prompt: 'Match each Cloud Storage class to its minimum storage duration.',
            pairs: [
              ['Standard', 'No minimum'],
              ['Nearline', '30 days'],
              ['Coldline', '90 days'],
              ['Archive', '365 days'],
            ],
            why: 'Deleting or moving an object before the minimum is billed as if it stayed the full period. Access latency is the same in every class.',
          },
        },
        {
          point:
            "Let time work for you: long-term storage pricing after 90 untouched days, and expiration for data you don't need to keep.",
          check: {
            type: 'choice',
            prompt:
              'A date-partitioned BigQuery table gets new rows every day. Which partitions get long-term storage pricing?',
            options: [
              "Each partition that hasn't been modified for 90 consecutive days",
              'None of them, because the table as a whole is still modified every day',
              "Only partitions covered by a slot reservation's commitment",
              'Only partitions that have been exported to Cloud Storage',
            ],
            answers: [0],
            why: "Long-term pricing is applied per partition. Old partitions qualify even while today's partition keeps changing. An unpartitioned table that changes daily would never qualify.",
          },
        },
      ],
    },
    {
      slug: 'data-warehouse',
      code: '3.2',
      title: 'Planning for using a data warehouse',
      mission:
        "Finance's 40 TB sales table costs a fortune to query. Model it so the monthly report scans gigabytes, not terabytes.",
      concepts: [
        {
          title: 'Data modelling and normalisation',
          body: "- **OLTP** databases favour **normalisation** (3NF): no duplication, cheap updates. A single huge table with self-joins should be split into entity tables (patients, visits).\n- **Data warehouses** favour a **star schema**: central fact tables (events, measures) + dimension tables (who/what/where). Snowflake = normalised dimensions.\n- **BigQuery prefers denormalisation**: storage is cheap, joins of huge tables cost shuffle. Use **nested and repeated fields** («STRUCT», «ARRAY») to keep child records (order lines) inside the parent row — no join needed, and data stays together.\n- Small, frequently changing dimensions can stay as separate tables (BigQuery handles small-table joins well).\n- **Slowly changing dimensions**: Type 1 overwrite; Type 2 add a new row with valid_from/valid_to (keeps history).\n\n> [!trap] Exam traps\n> Normalising a BigQuery fact table into many tables 'for best practice' — denormalise with nested fields instead.\n>\n> Applying BigQuery denormalisation advice to a Cloud SQL OLTP design.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'orders and their line items, query together often' | Nested repeated field (ARRAY<STRUCT>) in the order row |\n| 'single table with self-joins, reports failing at 100× scale (OLTP)' | Normalise into separate tables |",
        },
        {
          title: 'Partitioning and clustering',
          body: "### Partitioning\n\n- Types: **time-unit column** (DATE/TIMESTAMP/DATETIME; hourly, daily, monthly, yearly), **ingestion time** («_PARTITIONTIME»), **integer range**.\n- Queries that filter on the partition column **prune** partitions → fewer bytes scanned, lower cost, and an accurate cost estimate before running.\n- «require_partition_filter» forces users to filter. Partition expiration auto-deletes old data. Max 10,000 partitions per table.\n- Don't partition if partitions would be tiny (< ~10 GB each); cluster instead.\n\n### Clustering\n\n- Sorts storage blocks by up to **4 columns**; order matters (filter on the first column for best effect). Good for high-cardinality filters (customer_id) and tables > 64 MB.\n- BigQuery re-clusters automatically for free. Cost estimates are not exact (pruning happens at run time).\n\n**Combine**: partition by date, cluster by the most common filter columns.\n\n### Sharded tables vs partitions\n\nDate-named tables («events_20260101») are the legacy pattern; query them with a **wildcard table** and «_TABLE_SUFFIX»: «FROM 'project.dataset.events_*' WHERE _TABLE_SUFFIX BETWEEN '20260101' AND '20260131'» — the whole name with the asterisk must be in **backticks**. New designs should use one partitioned table.\n\n> [!trap] Exam traps\n> Partitioning on a high-cardinality ID column instead of clustering.\n>\n> Wildcard name not wrapped in backticks (error).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'queries always filter by event date, costs too high' | Partition by event date |\n| 'filter by customer_id and product within a date range' | Partition by date + cluster by customer_id, product |",
        },
        {
          title: 'Views, materialized views and schema changes',
          body: "- **Logical view**: saved query, runs each time; no storage. Good for abstraction and access control (authorized views).\n- **Materialized view**: precomputed, incrementally refreshed results; BigQuery can automatically rewrite queries against the base table to use it. Best for repeated aggregations. Restrictions on SQL (aggregations, limited joins); «max_staleness» trades freshness for cost.\n- **Schema changes**: you can add NULLABLE columns, relax REQUIRED → NULLABLE, and widen some types in place. To truly change a type (STRING → TIMESTAMP), run «CREATE OR REPLACE TABLE … AS SELECT CAST(...)» (or write to a new table) and point loads and queries at it. A view with CAST works but pays the cast on every query.\n- Table **snapshots** (read-only, cheap, point-in-time) and **clones** (writable copy, pay only for changes).\n\n> [!trap] Exam traps\n> Adding a duplicate column and reloading all data in append mode to change a type.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'convert a STRING epoch column to TIMESTAMP with minimal effort and cheap future queries' | CTAS into a new table with the cast, use it going forward |\n| 'dashboard repeats the same aggregation all day' | Materialized view (or BI Engine) |",
        },
      ],
      keyPoints: [
        {
          point:
            "OLTP normalizes. BigQuery denormalizes with nested and repeated fields, so data that's read together is stored together.",
          check: {
            type: 'choice',
            prompt: 'In BigQuery, an order with 12 line items is best stored as…',
            options: [
              'One row per order, with line items in an ARRAY of STRUCTs',
              '12 rows in a separate line-items table, joined on every query',
              'A JSON string column parsed in every query',
              'One table per order',
            ],
            answers: [0],
            why: 'Nested repeated fields keep the line items inside the order row: no join, and the data is co-located. A separate table forces a join every time, and JSON strings must be parsed on every read.',
          },
        },
        {
          point:
            'Partition on the date you filter by, to prune whole chunks. Cluster on high-cardinality filter columns, to skip blocks.',
          check: {
            type: 'choice',
            prompt:
              'Queries on a 20 TB table always filter on «event_date» and often on «store_id» (2,000 stores). How should you organise it?',
            options: [
              'Partition by event_date and cluster by store_id',
              'Integer-range partition by store_id',
              'Cluster by event_date, with no partitions',
              'Shard into one table per store, by name',
            ],
            answers: [0],
            why: 'Date partitioning prunes on the filter every query uses, and clustering skips blocks for the high-cardinality store filter. Partitioning by store ignores the date filter, and per-store tables are an old sharding anti-pattern.',
          },
        },
        {
          point:
            "Views save logic; materialized views save compute. To change a column's type, rebuild the table with CREATE TABLE AS SELECT.",
          check: {
            type: 'choice',
            prompt:
              'Which change can you make to an existing BigQuery table in place, without rewriting it?',
            options: [
              'Add a new NULLABLE column',
              'Change a STRING column to INT64',
              "Change the table's partitioning column",
              'Change a REPEATED column to NULLABLE',
            ],
            answers: [0],
            why: 'Adding NULLABLE columns (and relaxing REQUIRED to NULLABLE) works in place. Real type changes such as STRING to INT64, a new partitioning column, or a REPEATED mode change all need a rewrite, usually with CREATE TABLE AS SELECT.',
          },
        },
      ],
    },
    {
      slug: 'data-lake',
      code: '3.3',
      title: 'Using a data lake',
      mission:
        "Raw supplier files, product images and logs pile up in buckets. Turn Cymbal's data swamp into a lake people can find, trust and afford.",
      concepts: [
        {
          title: 'Managing and processing a data lake',
          body: "- **Cloud Storage is the lake**: zones as buckets/prefixes (raw → staged → curated), open formats (Parquet, Avro, Iceberg), Hive-style partition folders («dt=2026-10-02/»).\n- **Discovery**: Dataplex discovers files and registers tables; Knowledge Catalog makes them searchable.\n- **Access**: BigLake tables give row/column security over files without granting bucket access (access delegation through a connection service account). Dataplex can manage permissions centrally across assets.\n- **Cost controls**: lifecycle rules, Autoclass, deleting temporary data, avoiding small-file explosions (compact files).\n- **Processing**: BigQuery over BigLake/external tables, Dataproc/Serverless Spark, Dataflow.\n- **Monitoring**: Dataplex data quality and profiling scans, Cloud Monitoring on bucket metrics, audit logs for access.\n\n> [!trap] Exam traps\n> Granting analysts Storage Object Viewer on the whole lake bucket when they should only see some columns (BigLake).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'fine-grained security on Parquet files in GCS queried from BigQuery and Spark' | BigLake tables |",
        },
      ],
      keyPoints: [
        {
          point:
            'A lake is Cloud Storage plus discipline: zones, open formats, discovery, BigLake security and lifecycle rules.',
          check: {
            type: 'choice',
            prompt:
              'Thousands of Parquet folders land in Cloud Storage every day. You want them registered automatically as queryable tables, with schemas, without writing DDL.',
            options: [
              'Turn on Dataplex discovery for the zone that holds the bucket',
              'A Cloud Run job that issues CREATE EXTERNAL TABLE for every folder',
              'Load every file into one native BigQuery table',
              'Generate signed URLs for analysts',
            ],
            answers: [0],
            why: "Dataplex discovery scans assets, infers schemas and Hive partitions, and registers tables for BigQuery and Spark. A hand-written job is custom code to maintain, and signed URLs don't make anything queryable.",
          },
        },
      ],
    },
    {
      slug: 'data-platform',
      code: '3.4',
      title: 'Designing for a data platform',
      mission:
        'Marketing, supply chain and finance each own their data. Build a platform where every domain stays in charge, but governance is the same everywhere.',
      concepts: [
        {
          title: 'Platform building blocks and federated governance',
          body: "- Core stack: **Cloud Storage** (lake) + **BigQuery** (warehouse/lakehouse) + **Dataplex** (organise and govern) + **Knowledge Catalog** (metadata, lineage, glossary) + **Analytics Hub** (share).\n- **Data mesh / federated governance**: domain teams own and publish **data products** (their own projects, lakes, datasets); a central team sets global standards (naming, quality rules, security classes, policy tags) and provides the self-serve platform. Dataplex lakes map to domains; Analytics Hub publishes products across domains without copies.\n- **Lineage** (automatic for BigQuery, Dataflow, Composer, Dataproc jobs) supports impact analysis and audits.\n\n> [!trap] Exam traps\n> Centralising every dataset in one project managed by one team when the scenario describes autonomous domains.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'each business unit owns its data but org needs consistent governance' | Data mesh: Dataplex lakes per domain + central policies + catalog |",
        },
      ],
      keyPoints: [
        {
          point:
            'Domains own their data products; a central team owns the rules and the platform. Dataplex lakes map to domains.',
          check: {
            type: 'choice',
            prompt:
              "In a data mesh on Google Cloud, who owns a domain's data products and their quality rules?",
            options: [
              'The domain team, working within central standards and on a shared platform',
              'A central team that ingests and owns every dataset',
              'Each domain independently, with its own catalog, security model and standards',
              'Nobody: all domains share one dataset with table prefixes',
            ],
            answers: [0],
            why: 'Federated governance means domains own their products while a central team sets standards (classification, quality, naming) and runs the self-serve platform. A central owner becomes a bottleneck, and fully independent domains drift apart.',
          },
        },
      ],
    },
  ],
};
