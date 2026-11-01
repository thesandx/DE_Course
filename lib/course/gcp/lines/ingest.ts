/**
 * GCP course, line 2: Ingesting and processing the data.
 *
 * Generated from Sandeep's PDE Exam Lab module and kept as data. Edit the
 * text here; see lib/course/gcp/README.md for the rules.
 */

import type { GcpLine } from '@/types/gcp';

export const line: GcpLine = {
  slug: 'ingest',
  number: 2,
  title: 'Ingesting and processing the data',
  short: 'Ingest & process',
  weight: 25,
  hue: 5,
  intro:
    'The heaviest domain. Expect Pub/Sub delivery semantics, Beam windowing and triggers, Dataflow operations (drain, update, templates), Dataproc cluster design, BigQuery ingestion paths and Composer orchestration.',
  boss: {
    title: 'The Midnight Pipeline',
    story: "It's 00:00, a festive sale starts and every pipeline you built goes live at once.",
  },
  stations: [
    {
      slug: 'pipeline-planning',
      code: '2.1',
      title: 'Planning the data pipelines',
      mission:
        "Supplier feeds arrive over SFTP, clickstream pours out of the app, and orders live in MySQL. Before writing a line of code, draw Cymbal's pipeline map: sources, sinks, network paths and keys.",
      concepts: [
        {
          title: 'Sources, sinks and pipeline patterns',
          body: "- **Batch**: bounded data, scheduled (hourly/daily files, DB extracts). **Streaming**: unbounded events processed continuously. Beam/Dataflow uses one programming model for both.\n- **ETL** (transform before load: Dataflow, Data Fusion, Spark) vs **ELT** (load raw into BigQuery, transform with SQL/Dataform). ELT is the default for analytics on Google Cloud: cheaper to build, raw data is kept for reprocessing.\n- Canonical streaming path: **producers → Pub/Sub → Dataflow → BigQuery / Bigtable**, with GCS as a raw archive. Canonical CDC path: **database → Datastream → BigQuery**.\n- Land raw data unchanged first (GCS or a raw BigQuery dataset), then build curated layers. Raw copies make backfills and bug fixes possible.\n\n> [!trap] Exam traps\n> Writing IoT devices directly into BigQuery/Datastore instead of buffering through Pub/Sub.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| '10,000 devices, real-time processing and analysis' | Pub/Sub → Dataflow → BigQuery |\n| 'heavy load on OLTP DB, need analytics with minimal impact' | Replicate/ETL to BigQuery (Datastream or scheduled extract) |",
        },
        {
          title: 'Networking fundamentals for pipelines',
          body: "- **VPC** is global, subnets are regional. Dataflow and Dataproc workers live in a subnet you choose.\n- Workers without external IPs need **Private Google Access** to reach Google APIs, and **Cloud NAT** if they must reach the internet (e.g. pip installs).\n- Dataflow worker-to-worker traffic needs firewall rules on **TCP 12345 (streaming) and 12346 (batch)** — unless Streaming Engine / Dataflow Shuffle move that traffic to the service.\n- **Shared VPC**: a host project owns the network; service projects run Dataflow/Dataproc in it (pass the full subnetwork URL).\n- Reach on-prem sources via **Cloud VPN** or **Interconnect**; reach Cloud SQL privately via private IP or the Cloud SQL Auth Proxy.\n\n> [!trap] Exam traps\n> Dataflow job hangs with 'workers can't communicate' — missing firewall rule for 12345/12346 on the network tag.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'Dataflow workers must not have public IPs' | --no_use_public_ips + Private Google Access |",
        },
        {
          title: 'Encryption in pipelines',
          body: "In transit is automatic (TLS). At rest: specify a **CMEK** for Dataflow («--dataflowKmsKey»; protects pipeline state, shuffle and Streaming Engine data), Pub/Sub topics, Dataproc persistent disks and GCS/BigQuery sinks. Use Sensitive Data Protection inside the pipeline to tokenise fields before they reach the sink when downstream users must not see raw PII.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'pipeline state must be encrypted with our keys' | Dataflow with a CMEK |",
        },
      ],
      keyPoints: [
        {
          point:
            'Land raw data first, transform later. ELT into BigQuery is the default, and Pub/Sub buffers anything that streams.',
          check: {
            type: 'choice',
            prompt:
              '50,000 delivery scooters send a GPS ping every 5 seconds. What should receive the pings first?',
            options: [
              'Pub/Sub',
              'BigQuery streaming inserts sent directly from each scooter',
              'Cloud SQL',
              'Cloud Storage, one object per ping',
            ],
            answers: [0],
            why: 'Pub/Sub absorbs bursty, high-volume events from many producers and decouples them from processing. Devices writing straight into BigQuery or Cloud SQL couple you to sink limits, and one object per ping is a small-file disaster.',
          },
        },
        {
          point:
            'Private workers need Private Google Access. Databases need a private IP or the Auth Proxy, never 0.0.0.0/0.',
          check: {
            type: 'choice',
            prompt:
              'Several on-prem and partner applications with dynamic public IPs must reach a Cloud SQL instance over its public IP, securely. What should you do?',
            options: [
              'Leave authorized networks empty and connect through the Cloud SQL Auth Proxy',
              'Authorize 0.0.0.0/0 and rely on strong passwords',
              "Add each app's current IP to authorized networks and update the list weekly",
              'Disable SSL so the proxy is simpler',
            ],
            answers: [0],
            why: "The Auth Proxy authenticates with IAM and wraps the connection in TLS, so changing IPs don't matter and nothing is opened to the internet. A weekly allowlist breaks whenever an IP changes, and 0.0.0.0/0 or disabling SSL weakens security.",
          },
          more: '**Cloud SQL public IP with clients whose IPs change:** authorized networks only work with stable IP ranges. Leave authorized networks empty and connect through the **Cloud SQL Auth Proxy** (or a language connector), which authorizes with IAM and encrypts with TLS without any IP allowlist. Allowing 0.0.0.0/0 exposes the instance to the whole internet.',
        },
        {
          point:
            'TLS covers data in transit automatically. For data at rest, put your CMEK on every hop: topic, Dataflow state, bucket and table.',
          check: {
            type: 'choice',
            prompt:
              "A review requires that Dataflow's own temporary state (shuffle and Streaming Engine data) be protected by your keys. What do you do?",
            options: [
              'Launch the job with a Cloud KMS key (dataflowKmsKey)',
              'Encrypt every message in the publisher application before sending',
              'Use CSEK on the staging bucket only',
              "Nothing: Dataflow can't use CMEK",
            ],
            answers: [0],
            why: "Dataflow accepts a CMEK at launch and uses it for pipeline state, shuffle and Streaming Engine data. Publisher-side encryption doesn't cover Dataflow's internal state, and CSEK on a bucket says nothing about the job.",
          },
        },
      ],
    },
    {
      slug: 'building-pipelines',
      code: '2.2',
      title: 'Building the pipelines',
      mission:
        'Build it. Clicks stream through Pub/Sub, carts get sessionized, supplier CSVs get cleaned, and the catalog gets AI-generated attributes. Each choice here shows up on the exam.',
      concepts: [
        {
          title: 'Pub/Sub in depth',
          body: "Global, serverless messaging. A **topic** receives messages; each **subscription** gets its own copy of every message (fan-out). Latency is typically ~100 ms.\n\n### Subscription types\n\n- **Pull / StreamingPull**: subscriber asks for messages. Highest throughput, used by Dataflow. Supports flow control.\n- **Push**: Pub/Sub POSTs to an HTTPS endpoint (Cloud Run, functions). Endpoint acks with a 2xx response.\n- **BigQuery subscription**: writes messages straight to a table — no Dataflow needed when there's no transformation.\n- **Cloud Storage subscription**: batches messages into files in a bucket.\n\n### Delivery semantics\n\n- Default **at-least-once**: duplicates happen. If a subscriber doesn't ack within the **ack deadline** (default 10 s, max 600 s), the message is redelivered. Slow push endpoints are the #1 cause of floods of duplicates. Extend with «modifyAckDeadline» (client libraries do this automatically).\n- **Exactly-once delivery** can be enabled on pull subscriptions (regional guarantee).\n- **Ordering keys**: messages with the same key are delivered in publish order (enable on the subscription).\n- **Dead-letter topic**: after N failed deliveries (5–100), forward the message elsewhere.\n- Retention: unacked messages kept 7 days by default; topic retention up to 31 days. **Seek** to a timestamp or snapshot to **replay** messages (e.g. after a bad deploy).\n- Filters on attributes; schemas (Avro/Protobuf) to validate published messages.\n\n> [!trap] Exam traps\n> Blaming message size or topic volume for duplicates — duplicates come from missed ack deadlines.\n>\n> Assuming Pub/Sub preserves order without ordering keys.\n>\n> Using Dataflow just to copy messages into BigQuery unchanged (BigQuery subscription exists).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'push endpoint receives many duplicates' | Endpoint isn't acknowledging within the ack deadline |\n| 'reprocess the last 2 days of messages after a bug' | Seek subscription to a timestamp/snapshot |\n| 'messages that keep failing should be set aside' | Dead-letter topic |",
        },
        {
          title: 'Apache Beam model',
          body: "- **Pipeline**: the whole graph. **PCollection**: immutable distributed dataset, bounded (batch) or unbounded (stream). **PTransform**: a step.\n- **ParDo** with a **DoFn**: per-element processing (map, filter, flatMap). Can emit to multiple **tagged outputs** — the basis of the dead-letter pattern.\n- **GroupByKey**, **CoGroupByKey** (join two keyed PCollections), **Combine** (associative + commutative aggregation, pre-combined on workers — prefer it to GroupByKey + sum), **Flatten** (merge), **Partition** (split).\n- **Side inputs**: a small, read-only dataset broadcast to every worker (lookup tables, config). Good for enrichment when the lookup fits in memory; for large lookups use CoGroupByKey or a key-value store.\n- I/O connectors: «ReadFromPubSub», «BigQueryIO» (reading with a query or selected fields is faster than reading whole table rows), «TextIO», «KafkaIO», «JdbcIO», «BigtableIO».\n- Testing: «TestPipeline» + «PAssert» with the DirectRunner.\n\n> [!trap] Exam traps\n> GroupByKey followed by manual sum when Combine.perKey would pre-aggregate and scale better.\n>\n> Huge side input that doesn't fit in worker memory.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'enrich stream with a small reference table' | Side input |\n| 'join two large datasets by key' | CoGroupByKey |\n| 'read only a few fields from a big BigQuery table in Dataflow' | Read with a query / selected fields (Storage Read API) |",
        },
        {
          title: 'Windows, watermarks and triggers',
          body: "Aggregating an unbounded stream needs **windows**. Windows are based on **event time** (when it happened), not processing time (when it arrived).\n\n| Window | Shape | Example |\n|---|---|---|\n| **Fixed** (tumbling) | Non-overlapping, equal size | Sales per 5 minutes |\n| **Sliding** (hopping) | Fixed size, overlapping, every period | \"Average over the last 60 min, updated every 5 min\" |\n| **Session** | Per key, closes after a **gap** of inactivity | User activity bursts; basket abandonment after 1 h of no interaction |\n| **Global** | One window for everything | Needs a custom trigger to emit anything on unbounded data |\n\n- **Watermark**: the system's estimate that all data up to time T has arrived. Data arriving after the watermark passes the window end is **late**.\n- **Allowed lateness**: how long to keep a window open for late data; later data is dropped.\n- **Triggers** decide when to emit: «AfterWatermark» (default, at window end), with **early firings** (speculative results, e.g. every minute of processing time) and **late firings** (update when late data arrives); «AfterProcessingTime»; «AfterCount»; composites.\n- **Accumulation mode**: accumulating panes include all data so far (each firing replaces the last); discarding panes include only new data since the last firing (downstream must sum).\n\n> [!trap] Exam traps\n> Fixed window for 'no activity for 60 minutes' — that's a session window with a 60-minute gap.\n>\n> Using processing time when the question stresses devices that buffer and send late.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'moving average over last hour, refreshed every minute' | Sliding window (size 60m, period 1m) |\n| 'emit partial results before window closes' | Early firings trigger |\n| 'events can arrive up to 2 days late; include them' | Allowed lateness + late firings |",
        },
        {
          title: 'Dataflow operations',
          body: "- **Autoscaling** (horizontal) and **vertical autoscaling** (Dataflow Prime); cap with «maxNumWorkers».\n- **Streaming Engine** moves state/shuffle off workers (smaller workers, smoother scaling); **Dataflow Shuffle** does the same for batch.\n- **FlexRS**: cheaper batch using preemptible VMs with delayed scheduling (up to 6 h) — for jobs that aren't time-critical.\n- **Stopping a streaming job**: **Drain** stops reading new input and finishes in-flight data (no loss) — use for planned changes. **Cancel** stops immediately (in-flight data lost).\n- **Update** («--update» with the same job name): replace a running streaming job in place, keeping state, when the new graph is compatible (provide a transform name mapping if steps were renamed). Incompatible change → drain the old job and start a new one (or snapshot and start from it).\n- **Snapshots**: save streaming job state to restart or migrate.\n- **Templates**: Classic (graph fixed at build time) vs **Flex templates** (container image in Artifact Registry, graph built at launch, preferred). Google-provided templates: Pub/Sub → BigQuery, GCS Text → BigQuery, Datastream → BigQuery, JDBC → BigQuery, etc.\n- **Exactly-once processing** in Dataflow streaming (with deduplication of Pub/Sub messages by message ID; use an attribute ID for publisher-side dedup).\n- Performance: **hot keys** (one key with huge volume) slow GroupByKey — use «withHotKeyFanout»/combiner lifting; **fusion** can serialise a fan-out — insert a «Reshuffle».\n- Monitoring: **system lag**, **data freshness**, watermark age, backlog in Pub/Sub.\n\n> [!trap] Exam traps\n> Cancel to deploy a new version when no data may be lost (use update or drain).\n>\n> Classic template when parameters must change the pipeline graph at launch time (flex).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'update streaming pipeline code without losing data' | --update (compatible) or drain + relaunch |\n| 'non-urgent nightly batch, minimise cost' | FlexRS |\n| 'non-technical users launch standard pipelines' | Google-provided / flex templates |",
        },
        {
          title: 'Dataproc (Managed Service for Apache Spark)',
          body: "- Managed Spark, Hadoop, Hive, Pig, Presto/Trino, Flink. Clusters start in ~90 s, billed per second.\n- **Ephemeral (job-scoped) clusters**: create → run job → delete. Data on GCS, metadata in **Dataproc Metastore**. The default best practice.\n- Node types: master(s), primary workers (hold HDFS), **secondary workers** (preemptible/Spot by default, no HDFS, compute only) — cheap scale-out.\n- **Autoscaling policies** scale on YARN memory; don't autoscale clusters that rely on HDFS on primary workers. **Graceful decommissioning** lets workers finish tasks before removal.\n- **Initialization actions** install software at startup; **optional components** (Jupyter, Trino, Flink); **HA mode** = 3 masters.\n- **Workflow templates**: a reusable DAG of jobs on a managed (ephemeral) or existing cluster.\n- **Dataproc Serverless** (Serverless for Apache Spark): submit Spark batches with no cluster; pay for the run.\n- **Enhanced Flexibility Mode**: shuffle data on primary workers so losing preemptible workers doesn't fail jobs.\n- Connectors: GCS connector, Spark-BigQuery connector (Storage Read/Write API), Bigtable HBase.\n\n> [!trap] Exam traps\n> One big always-on cluster for nightly jobs.\n>\n> Preemptible primary workers holding HDFS data.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'existing Spark jobs, minimal change' | Dataproc |\n| 'run Spark without managing clusters' | Dataproc Serverless |\n| 'cut cost of batch Spark cluster' | Ephemeral clusters + Spot secondary workers + GCS |",
        },
        {
          title: 'Loading data into BigQuery',
          body: "| Path | Latency | Cost | Notes |\n|---|---|---|---|\n| **Batch load job** (GCS files) | Minutes | Free (shared pool) | Atomic; Avro/Parquet/ORC/CSV/JSON; quota of load jobs per table per day |\n| **Storage Write API** | Seconds | Cheaper than legacy streaming | **Exactly-once** with committed streams + offsets; pending streams for atomic batch commits |\n| Legacy streaming («insertAll») | Seconds | Per GB | Best-effort dedup via «insertId» (~1 min); recent rows sit in the streaming buffer and can't be updated by DML right away |\n| Pub/Sub BigQuery subscription | Seconds | Pub/Sub + write | No code; optional schema mapping |\n| Datastream | Seconds–minutes | Per GB | CDC replicas of OLTP tables, with merge |\n| External / BigLake tables | None (query in place) | Query cost | Slower; no consistency guarantees on changing files |\n\n### File formats\n\n- **Avro** is the preferred load format: self-describing schema, compressed blocks still load in parallel. Parquet and ORC are also fast and columnar.\n- **CSV/JSON**: no nested data in CSV; **gzipped CSV/JSON cannot be read in parallel** (slower loads; 4 GB max per gzip file). Uncompressed is faster to load.\n- «max_bad_records» allows N bad rows per load; to keep and analyse bad rows, use Dataflow with a dead-letter table.\n\n> [!trap] Exam traps\n> Running analytics immediately after legacy streaming inserts and expecting all rows — use Storage Write API or micro-batch loads when consistency matters.\n>\n> Compressing CSVs 'to speed up' loads.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'fastest, cheapest load format' | Avro (or Parquet) |\n| 'streaming with exactly-once into BigQuery' | Storage Write API |\n| 'corrupted rows must be analysed later' | Dataflow + dead-letter table |",
        },
        {
          title: 'Kafka, Spark streaming and other sources',
          body: "- **Managed Service for Apache Kafka**: run Kafka without managing brokers — choose it when apps already speak the Kafka protocol. Otherwise Pub/Sub is the serverless default.\n- Beam «KafkaIO» lets Dataflow consume Kafka on-prem or in cloud; MirrorMaker replicates clusters.\n- Spark Structured Streaming on Dataproc for teams standardised on Spark.\n- New sources: check for a Datastream source, BigQuery DTS connector, Data Fusion plugin or Google-provided Dataflow template before writing custom code.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'keep Kafka clients unchanged, stop managing ZooKeeper/brokers' | Managed Service for Apache Kafka |",
        },
        {
          title: 'Data cleansing and deduplication',
          body: "- At query time: «ROW_NUMBER() OVER (PARTITION BY id ORDER BY ts DESC) = 1» (or «QUALIFY»).\n- At write time: «MERGE» into the target on the business key.\n- In Dataflow: «Deduplicate» transform / stateful DoFn keyed by ID; Pub/Sub ID attribute.\n- Re-transmissions of the same payload: compute a **hash** of each entry and keep a table of hashes + metadata to check against (cheaper than comparing full history).\n\n- Standardise types early (timestamps in UTC, numeric types, trimmed strings); keep the raw value alongside the parsed one when cleaning is lossy.\n\n> [!trap] Exam traps\n> GROUP BY with SUM on duplicated rows — doubles the values.\n>\n> Assigning a new GUID per received entry (duplicates get different IDs).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'streaming rows may be duplicated; unique ID and timestamp per row' | ROW_NUMBER() partitioned by ID, keep row 1 |\n| 'source re-sends whole transmissions' | Hash each entry; store hashes + metadata for lookup |",
        },
        {
          title: 'AI data enrichment',
          body: "- **Dataflow RunInference** (Beam ML): run a model (TensorFlow, PyTorch, scikit-learn, or a remote endpoint) inside the pipeline; model refresh with side inputs.\n- **BigQuery ML remote models**: call Gemini or other hosted models from SQL — «AI.GENERATE» / «ML.GENERATE_TEXT» for classification, extraction, summarisation of text columns; «ML.GENERATE_EMBEDDING» for vectors.\n- Pre-trained APIs: Natural Language (sentiment, entities), Vision, Speech-to-Text, Translation, Document AI (parse PDFs/forms).\n- Sensitive Data Protection as an enrichment/cleansing step to tag or tokenise PII.\n\nVertex AI is now branded **Gemini Enterprise Agent Platform**; questions written earlier say Vertex AI.\n\n> [!trap] Exam traps\n> Training a custom model for sentiment when a pre-trained API or Gemini call meets the need.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'add sentiment to review text already in BigQuery, SQL team' | BigQuery ML remote model / AI functions |\n| 'score every streaming event with an ML model' | Dataflow RunInference |",
        },
      ],
      keyPoints: [
        {
          point:
            'Pub/Sub delivers at least once by default. Plan for duplicates, acknowledge in time, and keep a replay button (seek).',
          check: {
            type: 'choice',
            prompt:
              'Messages about the same order must be processed in the order they were published. What do you enable?',
            options: [
              'Ordering keys keyed by order ID, with message ordering on the subscription',
              'Exactly-once delivery on the subscription, keyed by order ID',
              'A dead-letter topic that collects any messages that arrive out of order for replay',
              'A longer acknowledgement deadline so messages arrive in sequence',
            ],
            answers: [0],
            why: 'Ordering keys guarantee publish order per key. Exactly-once delivery prevents redelivery but says nothing about order, dead-letter topics handle failures, and the ack deadline controls redelivery timing.',
          },
        },
        {
          point:
            'PCollections flow through PTransforms: ParDo for per-element work, Combine to aggregate, side inputs for small lookups.',
          check: {
            type: 'match',
            prompt: 'Match each Beam building block to its job.',
            pairs: [
              ['Run your function on every element', 'ParDo'],
              ['Join two keyed PCollections', 'CoGroupByKey'],
              ['Broadcast a small lookup table to every worker', 'Side input'],
              ['Pre-aggregate on workers before the shuffle', 'Combine'],
            ],
            why: 'ParDo is the general per-element transform. CoGroupByKey joins by key. Side inputs give every worker a read-only copy of small data. Combine aggregates associatively, so it pre-aggregates before shuffling.',
          },
        },
        {
          point:
            'Use event time, not arrival time. Fixed windows tile time, sliding windows overlap, and session windows follow gaps in activity. Watermarks and triggers decide when results come out.',
          check: {
            type: 'choice',
            prompt:
              "A trading screen shows each ticker's average price over the last 5 minutes, refreshed every 10 seconds, and needs sub-10 ms reads. Which design?",
            options: [
              'Sliding (hopping) windows of 5 min every 10 s, written to Memorystore',
              'Fixed 5-minute windows, with the results written to BigQuery',
              'Session windows per ticker, with the results written to Memorystore',
              'Sliding 5-minute windows every 10 s, written to Cloud Storage',
            ],
            answers: [0],
            why: 'Overlapping windows that are recomputed often are sliding (hopping) windows, and millisecond serving calls for an in-memory store. Fixed windows only update every 5 minutes, sessions follow user activity, and neither BigQuery nor Cloud Storage serves in milliseconds.',
          },
          more: '**Hopping = sliding.** "Aggregate the last 30 seconds, every 2 seconds" is a hopping window. When a live dashboard needs millisecond reads, write the window results to **Memorystore** (or Bigtable). BigQuery is for analysis, not millisecond serving.',
        },
        {
          point:
            'Drain to stop safely, update to change in place, FlexRS to save money on batch, templates to let others launch jobs.',
          check: {
            type: 'choice',
            prompt:
              'A streaming job is being retired. Everything it already read from Pub/Sub must still be processed and written. How do you stop it?',
            options: [
              'Drain',
              'Cancel',
              'Delete the Pub/Sub subscription first',
              'Relaunch with --update',
            ],
            answers: [0],
            why: 'Drain stops pulling new data and finishes everything in flight. Cancel stops immediately and drops in-flight work, deleting the subscription loses unacked messages, and --update replaces the job instead of stopping it.',
          },
        },
        {
          point:
            'Already have Spark? Use Dataproc: a cluster per job, data in Cloud Storage, cheap Spot secondary workers. Or go serverless.',
          check: {
            type: 'choice',
            prompt: 'Why are Dataproc secondary workers a good fit for Spot (preemptible) VMs?',
            options: [
              'They hold no HDFS data, so losing one only costs some re-run tasks',
              "They're billed at a discount because they never run YARN containers",
              'They run the YARN ResourceManager, which restarts itself on preemption',
              'Google guarantees that secondary workers are never preempted',
            ],
            answers: [0],
            why: "Secondary workers don't run HDFS DataNodes, so a preemption only costs some re-run tasks. They still run YARN containers (the ResourceManager lives on the masters), and Spot VMs can always be reclaimed.",
          },
        },
        {
          point:
            'Batch loads are free, the Storage Write API streams with exactly-once semantics, and Avro and Parquet load fastest.',
          check: {
            type: 'match',
            prompt: "Match each way of getting data into BigQuery to what it's best at.",
            pairs: [
              ['Free, atomic loads of files from Cloud Storage', 'Batch load job'],
              ['Streaming with exactly-once semantics', 'Storage Write API'],
              ['No-code: messages straight into a table', 'Pub/Sub BigQuery subscription'],
              ['Continuous CDC copy of an OLTP database', 'Datastream'],
            ],
            why: 'Load jobs use the free shared pool. The Storage Write API uses offsets for exactly-once. BigQuery subscriptions need no pipeline. Datastream replicates database changes continuously.',
          },
          more: '**Federated queries hit the source every time.** «EXTERNAL_QUERY» to Cloud SQL runs on the operational database whenever someone queries. If marketing runs it hundreds of times a day, replicate the tables into BigQuery with **Datastream** and query the copy.',
        },
        {
          point:
            'Keep Kafka if your apps already speak Kafka (use the managed service); otherwise use Pub/Sub. Beam can read both.',
          check: {
            type: 'choice',
            prompt:
              "Producers use Kafka client libraries you can't change, and the ops team is tired of running brokers. What fits?",
            options: [
              'Managed Service for Apache Kafka',
              'Pub/Sub, after rewriting the producers',
              'Bigtable',
              'Self-managed Kafka on GKE',
            ],
            answers: [0],
            why: 'The managed Kafka service keeps the Kafka protocol, so clients stay unchanged, and removes broker operations. Pub/Sub means rewriting producers, and self-managed Kafka keeps the ops burden.',
          },
        },
        {
          point:
            'Never drop bad data silently; route it to a dead letter. Deduplicate by key with ROW_NUMBER, MERGE or a stateful DoFn.',
          check: {
            type: 'choice',
            prompt:
              'Which query keeps only the latest version of each order from a table with duplicates?',
            options: [
              'SELECT * EXCEPT(rn) FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn FROM t) WHERE rn = 1',
              'SELECT DISTINCT order_id, updated_at FROM t ORDER BY updated_at DESC',
              'SELECT order_id, MAX(updated_at) AS updated_at, ANY_VALUE(status) AS status, SUM(amount) AS amount FROM t GROUP BY order_id',
              'SELECT * FROM t WHERE updated_at = (SELECT MAX(updated_at) FROM t)',
            ],
            answers: [0],
            why: 'ROW_NUMBER partitioned by the key and ordered newest-first keeps one full row per order. DISTINCT keeps every version that differs, SUM double-counts the duplicates, and the MAX subquery returns only the single most recent row in the whole table.',
          },
        },
        {
          point:
            'Bring the model to the data: Gemini from SQL in BigQuery, RunInference inside Dataflow, pre-trained APIs for common jobs.',
          check: {
            type: 'choice',
            prompt:
              "Product descriptions in a BigQuery table need a generated 'material' attribute (cotton, steel and so on). The team only writes SQL.",
            options: [
              'Create a remote model over Gemini and call ML.GENERATE_TEXT (or AI.GENERATE) on the column',
              "Train a custom attribute classifier on Dataproc with Spark MLlib, using last year's hand-labelled data",
              'Export to CSV and call the model API from a script on a laptop',
              'Have merchandisers tag each row by hand in a Dataprep recipe',
            ],
            answers: [0],
            why: 'Remote models let SQL users call Gemini row by row, in place, at warehouse scale. Training a custom model or running scripts adds work and moves data around.',
          },
        },
      ],
    },
    {
      slug: 'operationalizing-pipelines',
      code: '2.3',
      title: 'Deploying and operationalizing the pipelines',
      mission:
        'Your pipelines work on your laptop. Now make them run every night, retry on their own, alert when stuck, and ship safely from dev to test to prod.',
      concepts: [
        {
          title: 'Orchestration: Composer vs Workflows vs Scheduler',
          body: "| Tool | What it is | Choose when |\n|---|---|---|\n| **Cloud Composer** | Managed Apache Airflow; Python DAGs stored in the environment's GCS «dags/» folder | Complex multi-step, multi-service dependencies, retries, backfills, sensors, rich operator library |\n| **Workflows** | Serverless YAML/JSON orchestration of HTTP/API calls | Lightweight sequences of Google API calls, event-driven, low cost, no Airflow |\n| **Cloud Scheduler** | Managed cron (HTTP, Pub/Sub, App Engine targets) | Fire one job on a schedule |\n| **BigQuery scheduled queries** / **Dataform schedules** | Built-in scheduling | SQL-only transformations |\n| **Eventarc** / Cloud Run functions | Event triggers | React to \"file landed in bucket\" |\n\n### Composer details\n\n- Operators: «BigQueryInsertJobOperator», «DataflowStartFlexTemplateOperator», «DataprocCreateClusterOperator» / «SubmitJob» / «Delete», «GCSToBigQueryOperator».\n- **Sensors** wait for a condition («GCSObjectExistenceSensor»); prefer deferrable versions to free worker slots.\n- Event-driven DAG runs: a Cloud Run function triggered by the GCS event calls the Airflow REST API.\n- Keep tasks **idempotent**, use templated dates («{{ ds }}») so reruns and «catchup» backfills reprocess the right partition, set retries with delay.\n\n> [!trap] Exam traps\n> Composer for a single nightly query (overkill: scheduled query).\n>\n> Heavy data processing inside Airflow workers — Airflow orchestrates, Dataflow/BigQuery/Dataproc do the work.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'pipeline spans Dataproc, BigQuery and an external API with dependencies and retries' | Cloud Composer |\n| 'run a DAG as soon as a file arrives' | GCS event → Cloud Run function → Airflow REST API (or sensor) |",
        },
        {
          title: 'CI/CD for data pipelines',
          body: "- Code in Git; **Cloud Build** runs tests and builds artifacts; **Artifact Registry** stores container images (flex templates, Dataproc custom images) and packages.\n- **Terraform** for infrastructure (datasets, topics, buckets, IAM) so dev/test/prod are identical.\n- Dataflow: unit test DoFns, integration-test with a small dataset in a test project, deploy a **flex template**; streaming release = update in place or drain + launch.\n- Dataform: Git branches, workspaces, compilation checks, release configurations per environment.\n- Composer: sync DAG files from the repo to the environment bucket via Cloud Build; test DAG integrity (imports, no cycles) before deploy.\n\n> [!trap] Exam traps\n> Editing DAGs or SQL directly in production.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'promote the same pipeline through dev, test, prod reliably' | Git + Cloud Build + Terraform + separate projects |",
        },
      ],
      keyPoints: [
        {
          point:
            'Composer for big DAGs with retries and backfills, Workflows for light chains of API calls, Scheduler to fire one thing on a clock.',
          check: {
            type: 'match',
            prompt: 'Match each job to the scheduler or orchestrator that fits.',
            pairs: [
              ['Hundreds of Airflow DAGs with dependencies and backfills', 'Cloud Composer'],
              ['A few API calls in sequence, serverless', 'Workflows'],
              ['Fire one job every hour', 'Cloud Scheduler'],
              ['Run one SQL statement daily', 'BigQuery scheduled query'],
            ],
            why: 'Composer is managed Airflow for complex DAGs. Workflows is cheap, serverless orchestration of HTTP and API steps. Scheduler is managed cron. Scheduled queries are built into BigQuery.',
          },
          more: "**Workflows needs real Python for one step?** Workflows' standard library is limited. Call a **Cloud Run function** written in Python from the workflow for that step. Don't spin up Dataproc or Composer for a 1 KB JSON payload.",
        },
        {
          point:
            'Keep everything as code: Git for pipelines and DAGs, Cloud Build to test and deploy, Terraform for infrastructure, one project per environment.',
          check: {
            type: 'order',
            prompt: 'Order the steps of a CI/CD release for a Dataflow flex template.',
            steps: [
              'Commit pipeline code to Git',
              'Cloud Build runs the unit tests',
              'Build the template image into Artifact Registry',
              'Deploy to the test project and run integration tests',
              'Promote the same image to production',
            ],
            why: 'Test early and cheaply, build one immutable artifact, prove it in test, then promote exactly that artifact. Rebuilding for production would ship something you never tested.',
          },
        },
      ],
    },
  ],
};
