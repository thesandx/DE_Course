/**
 * The GCP question bank: scenario questions for boss rounds and the mock exam. Each names its station.
 *
 * Generated from Sandeep's PDE Exam Lab module and kept as data. Edit the
 * text here; see lib/course/gcp/README.md for the rules.
 */

import type { BankQuestion } from '@/types/gcp';

export const QUESTIONS: readonly BankQuestion[] = [
  {
    station: 'security-compliance',
    prompt:
      'A marketing analyst needs to run queries against the «campaigns» dataset in project mktg-data, billing the queries to project mktg-analytics. She must not see any other dataset. What is the least-privilege grant?',
    options: [
      'BigQuery Data Viewer on project mktg-data and BigQuery User on mktg-analytics',
      'BigQuery Job User on mktg-analytics and BigQuery Data Viewer on the campaigns dataset',
      'Project Viewer on both projects',
      'BigQuery Admin on the campaigns dataset only, so she can manage and query that one dataset',
    ],
    answers: [1],
    why: 'Job User lets her run (and be billed for) jobs in mktg-analytics without data access; Data Viewer on just the dataset gives read access to that dataset only. A project-level Data Viewer exposes every dataset; basic Viewer is too broad; Admin is far beyond read.',
  },
  {
    station: 'security-compliance',
    prompt:
      'Regional sales managers query one shared «orders» table. Each manager must see only rows for their own region, and you want to avoid maintaining copies of the data. What should you do?',
    options: [
      "Create row access policies on the orders table that filter by region, granted to each region's group",
      'Create one table per region with a scheduled query, and grant each regional group its own table',
      'Create a policy tag on the region column and grant each regional group Fine-Grained Reader on its own region',
      "Create an authorized view per manager that filters on that manager's hard-coded email address",
    ],
    answers: [0],
    why: "Row-level security filters rows inside one table per group. Per-region tables duplicate data and pipelines; policy tags control columns, not rows; per-user views don't scale and still need maintenance.",
  },
  {
    station: 'visualization',
    prompt:
      'Data scientists must be able to query a customer table, but the «national_id» column must appear masked to them while the fraud team sees the real values. What is the most maintainable approach?',
    options: [
      'Put a policy tag with a masking rule on national_id; grant the fraud team Fine-Grained Reader and the data scientists Masked Reader',
      'Create a copy of the table without national_id for the data scientists, refreshed by a scheduled query every hour',
      "Encrypt national_id with AEAD functions during the load and share the keyset only with the fraud team's service account",
      'Run a nightly Sensitive Data Protection job that redacts national_id in place, and keep a raw backup for the fraud team',
    ],
    answers: [0],
    why: 'Policy tags + dynamic data masking show masked values to some principals and clear values to Fine-Grained Readers, on one table, with no copies. AEAD works but requires every query to handle keys; redaction destroys values the fraud team needs; a separate table duplicates data.',
  },
  {
    station: 'security-compliance',
    prompt:
      "Your security team requires that encryption keys for BigQuery and Cloud Storage be rotated every 90 days under the company's control, and that the company can render data unreadable by disabling the key. Keys may live in Google Cloud. What should you use?",
    options: [
      'Customer-managed encryption keys (CMEK) in Cloud KMS with a 90-day rotation period',
      'Default Google-managed encryption, with Google rotating the keys on its own schedule',
      'Customer-supplied encryption keys (CSEK) passed with every BigQuery and Cloud Storage request',
      'Cloud External Key Manager, with the keys held in a third-party manager outside Google Cloud',
    ],
    answers: [0],
    why: "CMEK gives you control of rotation, IAM and disable/destroy, and keys may live in Cloud KMS. CSEK isn't supported for BigQuery; EKM is for keys that must stay outside Google; default encryption gives no customer control.",
  },
  {
    station: 'security-compliance',
    prompt:
      "Auditors found that an employee with valid BigQuery access copied a sensitive table into a personal project. You need to prevent data from leaving your organisation's projects through Google APIs, even by authorised users. What should you implement?",
    options: [
      'Create a VPC Service Controls perimeter around the projects that hold the data',
      'Remove BigQuery Data Viewer from all employees and grant access only on request',
      'Enable Data Access audit logs and alert the security team whenever a table is copied',
      'Enforce CMEK on every dataset and rotate the keys every 30 days',
    ],
    answers: [0],
    why: "VPC Service Controls blocks API calls that move data across the perimeter, which is exactly exfiltration prevention. Audit logs only detect; removing access breaks legitimate work; CMEK doesn't stop a copy by someone who can read.",
  },
  {
    station: 'security-compliance',
    prompt:
      'You must give an external contractor data to develop a Dataflow transformation. The source contains customer PII, and the contractor should not see real personal data. What should you do?',
    options: [
      'Create a de-identified (anonymised) sample of the data in a separate project for the contractor',
      'Grant the contractor the Dataflow Developer role in the production project, with audit logging on',
      'Create a dedicated service account for the contractor and share its JSON key over a secure channel',
      'Grant the contractor Viewer on the production project for the length of the engagement only',
    ],
    answers: [0],
    why: 'An anonymised sample in an isolated project lets them build and test without touching PII. Any production role exposes the data; sharing service account keys is an anti-pattern.',
  },
  {
    station: 'security-compliance',
    prompt:
      'A company must keep payment card numbers usable for joins across tables and must be able to recover the original numbers for chargebacks. Card numbers in the output must still look like 16-digit numbers for a legacy system. Which Sensitive Data Protection transformation fits?',
    options: [
      'Format-preserving encryption (FPE-FFX)',
      'Redaction with an infoType placeholder',
      'Cryptographic hashing (HMAC-SHA-256)',
      'Bucketing card numbers into ranges',
    ],
    answers: [0],
    why: 'FPE is reversible with the key, deterministic (joinable), and preserves the format. Hashing is one-way; redaction and bucketing lose the value.',
  },
  {
    station: 'security-compliance',
    prompt:
      'Your startup gave everyone access to all BigQuery datasets. Before tightening security, you need to learn which teams use which data. What should you do first?',
    options: [
      'Review Cloud Audit Logs (data access) for BigQuery',
      'Revoke all access and wait for teams to request it back',
      "Check each project's slot usage in Cloud Monitoring",
      'Export the billing report and group the costs by project',
    ],
    answers: [0],
    why: "BigQuery data access audit logs record who read which tables, giving the usage picture before you change policies. Slot metrics and billing don't show who accessed what.",
  },
  {
    station: 'flexibility-portability',
    prompt:
      'A dataset was created in «US» multi-region. A new regulation requires it to be stored in «europe-west3». What should you do?',
    options: [
      'Create a new dataset in europe-west3, copy the tables into it, switch consumers over, then delete the old dataset',
      "Edit the dataset's location in the console; BigQuery moves the data to the new region in the background",
      'Set the gcp.resourceLocations org policy to europe-west3, which migrates the existing datasets for you',
      'Create views in a new europe-west3 dataset that point at the US tables, and grant all users access to those views only',
    ],
    answers: [0],
    why: "Dataset location can't be changed; you copy to a new dataset in the target region. Org policies only restrict new resources; cross-location views don't work.",
  },
  {
    station: 'security-compliance',
    prompt:
      'Your company wants dev, test and prod environments for its data platform with independent permissions, quotas and costs, and the least risk that a dev mistake affects production. What should you do?',
    options: [
      'Use separate projects for dev, test and prod, provisioned with the same Terraform code',
      'Use one project with datasets prefixed dev_, test_ and prod_, and IAM grants per dataset',
      'Use one project and separate the environments with labels and per-label budget alerts',
      'Use one project with separate BigQuery reservations for dev, test and prod workloads',
    ],
    answers: [0],
    why: 'Projects are the boundary for IAM, quotas and billing. Datasets or labels within one project share quotas and admin roles, so a dev mistake can hit prod.',
  },
  {
    station: 'data-migrations',
    prompt:
      'You need to copy 300 TB of archived data from an on-premises data centre to Cloud Storage. The available uplink is 200 Mbps and shared with business traffic. The data must be in Cloud Storage within 6 weeks. What should you use?',
    options: [
      'gcloud storage cp in parallel from several servers',
      'Storage Transfer Service with on-premises agents',
      'Transfer Appliance',
      'Cloud VPN',
    ],
    answers: [2],
    why: '300 TB over 200 Mbps is roughly 4–5 months even at full utilisation. Transfer Appliance gets it there in weeks without using the link. Agents and VPN still depend on the slow network.',
  },
  {
    station: 'data-migrations',
    prompt:
      'An on-premises MySQL database serves an e-commerce site. You want near real-time analytics in BigQuery while adding minimal load to the source and without writing custom code. What should you use?',
    options: [
      'Nightly mysqldump to Cloud Storage and load jobs',
      'Datastream CDC from MySQL to BigQuery',
      'Database Migration Service to Cloud SQL, then federated queries',
      'A Dataflow JDBC pipeline polling every minute',
    ],
    answers: [1],
    why: "Datastream reads the binlog (low source impact), is serverless and lands changes in BigQuery with low latency. Dumps aren't near real-time; polling adds load; DMS is for moving the OLTP database itself.",
  },
  {
    station: 'data-migrations',
    prompt:
      'You are migrating a 40-node on-prem Hadoop cluster. Requirements: reuse existing Spark and Hive jobs, minimise cluster management, keep data available after clusters are deleted, and reduce cost. What design should you choose?',
    options: [
      'Dataproc job-scoped clusters using Cloud Storage through the GCS connector, with Hive metadata in Dataproc Metastore',
      'Dataproc clusters running 24/7 with HDFS on persistent SSD disks, sized for the peak nightly workload plus 20% headroom',
      'Hadoop installed on Compute Engine VMs with local SSDs, managed with the same tooling as on-prem',
      'Rewrite every Spark and Hive job as a Dataflow pipeline and move all the data into BigQuery',
    ],
    answers: [0],
    why: "Ephemeral Dataproc clusters + GCS decouple storage from compute, run jobs unchanged, and persist data and metadata beyond the cluster. HDFS on disks dies with the cluster; self-managed VMs add ops; a full rewrite isn't 'reuse'.",
  },
  {
    station: 'data-migrations',
    prompt:
      'After migrating tables from Teradata to BigQuery, you must prove to auditors that the data matches the source before decommissioning Teradata. What should you do?',
    options: [
      'Use the Data Validation Tool to compare row counts, column aggregates and row hashes between source and target',
      'Compare a few hundred random rows by hand and record the results in a spreadsheet for the auditors',
      'Rely on the BigQuery Data Transfer Service run history showing that every transfer finished successfully',
      'Run Dataplex data profiling on the BigQuery tables and check that no column has unexpected null values',
    ],
    answers: [0],
    why: "DVT is designed for source-vs-target validation. A successful transfer job or profiling the target alone doesn't prove equality; spot checks aren't evidence.",
  },
  {
    station: 'security-compliance',
    prompt: 'Which TWO statements about BigQuery fine-grained access are correct? (Choose two.)',
    options: [
      'Authorized views let users query a view without access to the underlying tables',
      'Policy tags restrict access to specific rows',
      'IAM granted at the folder level can be removed for one project by granting a narrower role in that project',
      'Row access policies can filter rows per user group on a single table',
    ],
    answers: [0, 3],
    why: "Authorized views and row access policies are both correct. Policy tags are column-level. IAM grants are additive: a narrower project-level role doesn't remove broader inherited access (only deny policies subtract).",
  },
  {
    station: 'security-compliance',
    prompt:
      'A healthcare analytics team wants the strongest guarantee that patient data stored in Google Cloud is protected by keys in hardware security modules certified at FIPS 140-2 Level 3, while still letting BigQuery manage the data. What should you use?',
    options: [
      'CMEK with a Cloud HSM protection level key',
      'CMEK with a software protection level key in Cloud KMS',
      'Default encryption',
      'Client-side encryption before loading',
    ],
    answers: [0],
    why: 'Cloud HSM keys are generated and used in FIPS 140-2 Level 3 HSMs and work as CMEK with BigQuery. Software keys are Level 1; client-side encryption prevents BigQuery from working with the data normally.',
  },
  {
    station: 'visualization',
    prompt:
      'Executives use a Looker Studio dashboard on a BigQuery table that is updated every 10 minutes. They report that the latest numbers are often an hour or more old. What should you do?',
    options: [
      'Change the data freshness setting of the BigQuery data source in Looker Studio, or refresh its cache',
      'Turn on table-level result caching in BigQuery so the dashboard always reads the newest rows as they arrive',
      'Ask the executives to clear their browser cache and reload the dashboard each morning',
      'Switch the table to ingestion-time partitioning so new rows become visible sooner',
    ],
    answers: [0],
    why: "Looker Studio caches BigQuery results according to the data source's data freshness setting. BigQuery has no table-level caching switch, and browser cache isn't the cause.",
  },
  {
    station: 'visualization',
    prompt:
      "An analyst's query «SELECT * FROM events LIMIT 100» on a 20 TB unpartitioned table costs too much under on-demand pricing. Which change reduces cost the most?",
    options: [
      'Partition the table by event date, then select only the needed columns and filter on the partition column',
      'Reduce the LIMIT from 100 rows to 10 rows so BigQuery reads less of the table',
      'Add ORDER BY on the event timestamp so BigQuery can stop reading the table early',
      'Run the query with batch priority, which is billed at a lower on-demand rate',
    ],
    answers: [0],
    why: "On-demand cost is bytes scanned: fewer columns and partition pruning cut it. LIMIT and batch priority don't change bytes scanned; ORDER BY adds work.",
  },
  {
    station: 'visualization',
    prompt:
      'A query that joins clickstream events to users runs slowly. The execution details show one stage where the maximum worker time is far larger than the average. What is the most likely cause and fix?',
    options: [
      'Data skew on the join key, such as many events with a NULL user_id; handle that key before the join',
      'Not enough slots for the project; buy a larger reservation so every worker finishes faster',
      'The query cache is disabled for the project, so BigQuery recomputes the whole join from scratch on every run',
      'The tables are stored in Capacitor format; exporting them to Parquet would speed up the join',
    ],
    answers: [0],
    why: "A big max-vs-average gap is the signature of skew: one key with far more rows. Fix the hot key (filter NULLs, pre-aggregate, salt). More slots don't help one overloaded worker.",
  },
  {
    station: 'ai-ml',
    prompt:
      'Your SQL-proficient analysts want to predict whether a subscriber will churn next month using data in BigQuery, with minimal data movement and no new infrastructure. What should they use?',
    options: [
      'BigQuery ML with a classification model such as LOGISTIC_REG or BOOSTED_TREE_CLASSIFIER',
      'Export the data to Cloud Storage and train a custom TensorFlow model on a GPU VM',
      "BigQuery ML with an ARIMA_PLUS model trained on each subscriber's monthly history",
      'BigQuery ML with a KMEANS model, treating the cluster with most cancellations as churners',
    ],
    answers: [0],
    why: 'Churn is binary classification, and BigQuery ML keeps the data in place with SQL. ARIMA_PLUS is forecasting, KMEANS is unsupervised clustering, and custom training adds work.',
  },
  {
    station: 'ai-ml',
    prompt:
      'You trained a BigQuery ML model with bucketised and scaled features computed in a subquery. At prediction time, applications send raw values and accuracy drops. How do you fix this with the least effort?',
    options: [
      "Move the preprocessing into the model's TRANSFORM clause and retrain",
      'Ask each application team to reimplement the preprocessing in their own code',
      'Train a deeper model so it learns to handle the raw values directly',
      'Retrain on twice as much data so the model generalises to raw inputs',
    ],
    answers: [0],
    why: 'TRANSFORM stores the preprocessing with the model and applies it automatically at prediction, eliminating training/serving skew.',
  },
  {
    station: 'ai-ml',
    prompt:
      'A deep neural network achieves 99% accuracy on training data but 70% on validation data. Which TWO actions are most likely to help? (Choose two.)',
    options: [
      'Add dropout layers',
      'Add more layers and neurons',
      'Apply L2 regularisation',
      'Train for many more epochs',
    ],
    answers: [0, 2],
    why: 'The model overfits. Dropout and regularisation reduce overfitting. More capacity and more epochs typically make it worse.',
  },
  {
    station: 'ai-ml',
    prompt:
      'You want to detect fraudulent transactions. Fraud is very rare, you have few reliable labels, and fraud patterns change constantly. Which approach is best supported?',
    options: [
      'Supervised classification trained on historical labels',
      'Unsupervised anomaly detection',
      'Reinforcement learning',
      'Linear regression on transaction amount',
    ],
    answers: [1],
    why: 'Rare events, few labels and novel future patterns favour unsupervised anomaly detection (e.g. ML.DETECT_ANOMALIES with KMEANS or an autoencoder).',
  },
  {
    station: 'ai-ml',
    prompt:
      'Your company stores 2 million PDF manuals in Cloud Storage and wants a semantic search feature that SQL developers can maintain in BigQuery. What is the right data preparation flow?',
    options: [
      'Create an object table, parse and chunk the PDFs, embed them with ML.GENERATE_EMBEDDING, build a vector index and use VECTOR_SEARCH',
      'Load each PDF as BYTES into a native BigQuery table, extract the text with a JavaScript UDF, and search it with LIKE and regular expressions',
      'Export the PDFs to Bigtable keyed by product and manual number, and scan by key prefix for each question',
      'Build an inverted keyword index with Spark on Dataproc, store it in HDFS, and query it from a notebook',
    ],
    answers: [0],
    why: 'Object tables → parse/chunk → embeddings → vector index → VECTOR_SEARCH is the native BigQuery RAG/semantic search path. LIKE is lexical, not semantic.',
  },
  {
    station: 'sharing-data',
    prompt:
      'A data provider wants to give 40 partner companies live, read-only access to curated BigQuery datasets without copying data, and wants usage metrics per listing. What should they use?',
    options: [
      'An Analytics Hub (BigQuery sharing) exchange with listings that partners subscribe to as linked datasets',
      "Scheduled exports to each partner's Cloud Storage bucket, with usage reports built from access logs",
      "Data Viewer on the provider's project for each partner, with usage tracked in INFORMATION_SCHEMA",
      "Nightly dataset copies into each partner's project with the BigQuery Data Transfer Service",
    ],
    answers: [0],
    why: 'Analytics Hub listings give zero-copy, always-current linked datasets plus publisher usage metrics. Exports and copies go stale and cost storage; project-wide IAM exposes too much.',
  },
  {
    station: 'sharing-data',
    prompt:
      "Two retailers want to measure how many customers they share for a joint campaign without either seeing the other's customer lists. What should they use?",
    options: [
      'An authorized view shared both ways',
      'A BigQuery data clean room with analysis rules',
      'Export both lists to a shared bucket',
      'A Dataflow job that joins both lists and emails the results',
    ],
    answers: [1],
    why: 'Clean rooms allow joint queries under privacy rules (aggregation thresholds, list overlap) while hiding raw rows. Views and shared buckets expose the data.',
  },
  {
    station: 'visualization',
    prompt:
      'Hundreds of users open the same BigQuery-backed dashboard each morning; queries take 5–10 s and cost is rising. The aggregation logic is stable. Which TWO changes best improve latency and cost? (Choose two.)',
    options: [
      'Create a materialized view for the dashboard aggregation',
      'Add a BI Engine reservation',
      'Switch all dashboard queries to batch priority',
      'Export the table to CSV in Cloud Storage',
    ],
    answers: [0, 1],
    why: 'Materialized views precompute the aggregation incrementally, and BI Engine serves dashboard queries from memory. Batch priority delays queries; CSV exports are slower and stale.',
  },
  {
    station: 'building-pipelines',
    prompt:
      'An e-commerce site wants to email users who added more than $30 of products to their basket, made no purchase, and had no site interaction for 1 hour. Events stream through Pub/Sub into Dataflow. How should you window the data?',
    options: [
      'Fixed windows of 60 minutes',
      'Sliding windows of 60 minutes every 5 minutes',
      'Session windows per user with a 60-minute gap',
      'A global window with a 60-minute processing-time trigger',
    ],
    answers: [2],
    why: "'No interaction for an hour' is a per-user inactivity gap, which is exactly what session windows model. Fixed/sliding windows cut sessions at arbitrary boundaries.",
  },
  {
    station: 'building-pipelines',
    prompt:
      'A Pub/Sub push subscription delivers sensor alerts to a Cloud Run service that sometimes takes 40 seconds to process each message. The service receives many duplicates. What is the most likely cause?',
    options: [
      'The service responds after the acknowledgement deadline has expired, so Pub/Sub redelivers',
      'The topic has too many publishers, so Pub/Sub fans each message out more than once',
      'The messages exceed the maximum size, so Pub/Sub splits them and resends the parts',
      "Ordering keys aren't enabled on the subscription, so Pub/Sub retries each message until it arrives in order",
    ],
    answers: [0],
    why: 'Push messages are acknowledged by a success response; if that comes after the ack deadline (default 10 s), Pub/Sub treats it as failed and redelivers. Raise the deadline or acknowledge faster.',
  },
  {
    station: 'failure-mitigation',
    prompt:
      'A bug in a subscriber corrupted 6 hours of processed output. The subscription has message retention enabled. How do you reprocess those messages?',
    options: [
      'Seek the subscription to a timestamp before the bug was deployed and let the fixed subscriber consume again',
      'Ask every publisher to republish the last six hours of messages from their own application logs',
      "Create a new subscription on the topic; new subscriptions start by receiving all of the topic's retained history",
      "Increase the subscription's ack deadline so the fixed subscriber can reprocess the old messages",
    ],
    answers: [0],
    why: 'Seek to a timestamp (or a snapshot) marks retained messages as unacknowledged so they are redelivered. A new subscription only gets messages published after it was created (unless seeking a topic with retention).',
  },
  {
    station: 'building-pipelines',
    prompt:
      'You need a dashboard metric showing the average order value over the last 30 minutes, refreshed every minute. Which Beam windowing should you use?',
    options: [
      'Sliding windows of 30 minutes with a 1-minute period',
      'Fixed 1-minute windows, averaged in the dashboard',
      'Session windows with a 30-minute gap between orders',
      'Fixed 30-minute windows with an early trigger',
    ],
    answers: [0],
    why: 'A rolling 30-minute aggregate recomputed every minute is a sliding window (size 30 min, period 1 min).',
  },
  {
    station: 'building-pipelines',
    prompt:
      'Mobile devices buffer events while offline and can send them up to 2 days late. Hourly aggregates must include late events and be updated when they arrive. What should you configure?',
    options: [
      'Event-time fixed windows with 2 days of allowed lateness and a trigger with late firings',
      'Processing-time windows, so late events are counted in the hour they arrive',
      'Discard late data in the streaming pipeline and run a nightly batch job to correct the hourly totals',
      "Session windows with a 2-day gap so each device's late events join its session",
    ],
    answers: [0],
    why: 'Event time places events in the right hour; allowed lateness keeps windows open; late firings emit updated (accumulated) results.',
  },
  {
    station: 'operationalizing-pipelines',
    prompt:
      'You must deploy a new version of a streaming Dataflow pipeline. The change renames two transforms but keeps the graph compatible. No data may be lost and state should be preserved. What should you do?',
    options: [
      'Cancel the job and start the new one',
      'Launch the new job with --update, the same job name, and a transform name mapping',
      'Drain the job, then start a new job with the new code reading from the beginning of the topic',
      'Stop the Pub/Sub topic, then restart',
    ],
    answers: [1],
    why: 'Update replaces the job in place, keeping state; renamed steps need a transform mapping. Cancel loses in-flight data; drain + new job loses window state.',
  },
  {
    station: 'resource-optimization',
    prompt:
      'A nightly Dataflow batch job processes 5 TB and must finish within 12 hours of starting. You want to minimise cost. What should you use?',
    options: [
      'Streaming Engine',
      'FlexRS (Flexible Resource Scheduling)',
      'Larger machine types',
      'A Dataproc cluster with only primary workers',
    ],
    answers: [1],
    why: "FlexRS uses preemptible capacity and delayed scheduling for discounted batch processing — ideal when the job isn't time-critical.",
  },
  {
    station: 'building-pipelines',
    prompt:
      'A Dataflow pipeline parses JSON from Pub/Sub. About 0.1% of messages are malformed. Business wants the pipeline to keep running and to analyse bad messages later. What should you implement?',
    options: [
      'A dead-letter pattern: send failed elements to a tagged side output and write them to an error table',
      'Catch parsing exceptions in the DoFn, log them, and drop the bad messages so the pipeline keeps up',
      'Let the pipeline fail on bad input so malformed messages are noticed and fixed at the source',
      'Set max_bad_records on the BigQueryIO write so BigQuery skips the malformed rows for you',
    ],
    answers: [0],
    why: 'Dead-letter outputs keep the pipeline healthy and preserve bad records for inspection. Dropping loses data; failing stops everything.',
  },
  {
    station: 'building-pipelines',
    prompt:
      'Each streaming event needs a country name looked up from a 50,000-row reference table that changes weekly. What is the most efficient Beam approach?',
    options: [
      'Call Cloud SQL for every element',
      'Load the reference table as a side input (refreshed periodically)',
      'CoGroupByKey the stream with the reference table each time',
      'Write events to BigQuery and join them with the reference table later, in every dashboard query',
    ],
    answers: [1],
    why: 'A small lookup table fits in memory as a side input, broadcast to all workers; a slowly-updating side input pattern handles weekly changes. Per-element DB calls are slow and fragile.',
  },
  {
    station: 'building-pipelines',
    prompt: 'Which TWO data formats let BigQuery load compressed data in parallel? (Choose two.)',
    options: ['Avro', 'gzip-compressed CSV', 'Parquet', 'gzip-compressed newline-delimited JSON'],
    answers: [0, 2],
    why: "Avro and Parquet compress internally by block/column chunk and can be read in parallel. A gzip'd CSV/JSON file must be read sequentially.",
  },
  {
    station: 'reliability-fidelity',
    prompt:
      'A partner drops CSV files daily into Cloud Storage. Some rows are malformed. You need the good rows in BigQuery and the bad rows kept for investigation. What should you build?',
    options: [
      'A Dataflow batch pipeline that validates rows, writing valid rows to BigQuery and invalid ones to a dead-letter table',
      'A BigQuery load job with max_bad_records=0, so that any malformed row stops the whole load',
      'An external table over the files, with the bad rows fixed later in SQL views',
      'A BigQuery load job with a high max_bad_records value, plus a Cloud Monitoring alert whenever a load reports skipped rows',
    ],
    answers: [0],
    why: 'Only the Dataflow approach both loads valid rows and preserves invalid ones. max_bad_records=0 fails the load; higher values silently skip rows.',
  },
  {
    station: 'building-pipelines',
    prompt:
      'An application streams 50,000 rows per second into BigQuery. Downstream reports require that each row appears exactly once even when the client retries. What ingestion method should you use?',
    options: [
      'Legacy tabledata.insertAll with insertId',
      'Storage Write API using committed-type streams with offsets',
      'Load jobs every second',
      'A Pub/Sub push subscription to a Cloud Run service that runs INSERT DML',
    ],
    answers: [1],
    why: "The Storage Write API offers exactly-once semantics via stream offsets, at lower cost. insertId dedup is best effort; per-second load jobs hit quotas; DML per row doesn't scale.",
  },
  {
    station: 'resource-optimization',
    prompt:
      'Your company runs dozens of nightly Spark jobs on a permanent 50-node Dataproc cluster that sits idle 16 hours a day. Data already lives in Cloud Storage. What change reduces cost the most while keeping the jobs unchanged?',
    options: [
      'Run each workflow on an ephemeral, job-scoped cluster (for example via workflow templates) with Spot secondary workers',
      'Keep the cluster, but switch its persistent disks from SSD to standard HDD to cut storage cost',
      'Keep the cluster running, but downsize it from 50 to 10 nodes and accept longer job times',
      'Rewrite every Spark job in BigQuery SQL and schedule the queries with Cloud Scheduler',
    ],
    answers: [0],
    why: "Ephemeral clusters bill only while jobs run, and Spot secondary workers cut compute cost further. Downsizing may miss SLAs; rewriting isn't 'unchanged'.",
  },
  {
    station: 'building-pipelines',
    prompt:
      'A Dataproc cluster uses an autoscaling policy. During scale-down, running Spark tasks fail and must be retried. What should you configure?',
    options: [
      'A graceful decommissioning timeout in the autoscaling policy',
      'More primary workers so that scale-down never happens',
      'Initialization actions that checkpoint running tasks to Cloud Storage on shutdown',
      'High availability mode with three master nodes',
    ],
    answers: [0],
    why: 'Graceful decommissioning lets nodes finish in-progress work before they are removed.',
  },
  {
    station: 'operationalizing-pipelines',
    prompt:
      'A data pipeline must: wait for a file in Cloud Storage, run a Dataproc job, load results into BigQuery, call an external REST API, and retry failed steps, with daily backfills when needed. Which service should orchestrate it?',
    options: ['Cloud Scheduler', 'BigQuery scheduled queries', 'Cloud Composer', 'Pub/Sub'],
    answers: [2],
    why: "Multi-service dependencies, sensors, retries and backfills are Airflow's strengths. Scheduler only fires one target; scheduled queries only run SQL.",
  },
  {
    station: 'operationalizing-pipelines',
    prompt:
      'A team wants three Cloud Run services called in sequence each hour, with simple error handling, at the lowest cost and without managing an Airflow environment. What should they use?',
    options: [
      'Workflows triggered by Cloud Scheduler',
      'A small Cloud Composer environment',
      'A Dataflow streaming job that polls hourly',
      'A Compute Engine VM running cron',
    ],
    answers: [0],
    why: 'Workflows is serverless, cheap orchestration for API/HTTP steps; Cloud Scheduler triggers it hourly. Composer is heavier than needed.',
  },
  {
    station: 'pipeline-planning',
    prompt:
      'Dataflow workers in a Shared VPC subnet must not have external IP addresses but must write to BigQuery and Cloud Storage. What is required?',
    options: [
      'Enable Private Google Access on the subnet and launch with no public IPs',
      'Add Cloud NAT to the subnet so the workers can reach Google APIs without public IPs',
      "Create a Cloud VPN tunnel from the VPC to Google's API endpoints",
      'Open TCP port 443 inbound on the firewall for the worker VMs',
    ],
    answers: [0],
    why: 'Private Google Access lets internal-only VMs reach Google APIs. Cloud NAT is for internet egress (e.g. downloading packages), not required for Google APIs.',
  },
  {
    station: 'reliability-fidelity',
    prompt:
      'Your SQL-only analytics team loads raw data into BigQuery and wants to manage 200 dependent transformation tables with version control, tests and scheduling, without new compute services. What should they use?',
    options: ['Dataflow', 'Cloud Data Fusion', 'Dataform', 'Dataproc Serverless'],
    answers: [2],
    why: 'Dataform manages SQLX transformations in BigQuery with dependencies, assertions, Git and schedules. The others add compute and require non-SQL skills or a visual tool.',
  },
  {
    station: 'storage-selection',
    prompt:
      'A factory streams readings from 20,000 sensors into Bigtable. Real-time dashboards query recent readings per sensor, and write throughput is uneven: one node is overloaded. The current row key is «timestamp#sensorId». What row key should you use?',
    options: [
      'sensorId#timestamp',
      'Keep timestamp#sensorId and add more nodes',
      'sensorId on its own',
      'A random UUID for every reading',
    ],
    answers: [0],
    why: "Leading with the timestamp sends every new write to the same tablet, and adding nodes doesn't help because a single append point can't be split. sensorId first spreads writes across the key space, and the timestamp suffix keeps each sensor's readings in a scannable range. sensorId alone makes one ever-growing row, and a random UUID spreads writes but makes per-sensor time-range scans impossible.",
  },
  {
    station: 'storage-selection',
    prompt:
      'A global gaming company needs a relational database for player inventories with strong consistency across regions, horizontal write scaling and 99.999% availability. What should they use?',
    options: [
      'Cloud SQL with cross-region read replicas',
      'Spanner multi-region instance',
      'Bigtable with replication',
      'Firestore',
    ],
    answers: [1],
    why: 'Only Spanner combines relational SQL, external consistency across regions, horizontal scaling and a 99.999% SLA. Cloud SQL replicas are async and read-only; Bigtable is not relational and replication is eventual.',
  },
  {
    station: 'storage-selection',
    prompt:
      "A startup's point-of-sale backend stores transactions as documents. Traffic may grow rapidly, the team wants no capacity management, and it needs ACID transactions. What should they use?",
    options: ['Cloud SQL', 'Bigtable', 'Firestore', 'BigQuery'],
    answers: [2],
    why: "Firestore is serverless, scales automatically and supports ACID transactions — the modern answer older questions call Datastore. BigQuery isn't transactional OLTP; Cloud SQL and Bigtable require capacity decisions.",
  },
  {
    station: 'storage-selection',
    prompt:
      'Logs are written to Cloud Storage, read heavily for 30 days, occasionally for 1 year, and must then be kept for 7 years for compliance without the possibility of deletion. Which TWO configurations meet this at low cost? (Choose two.)',
    options: [
      'Lifecycle rules: Standard → Nearline at 30 days → Archive at 365 days',
      'Keep everything in Standard',
      'A retention policy of 7 years locked with Bucket Lock',
      'Object versioning only',
    ],
    answers: [0, 2],
    why: "Lifecycle transitions match the access pattern, and a locked retention policy enforces WORM retention. Versioning doesn't stop deletion of all versions.",
  },
  {
    station: 'data-warehouse',
    prompt:
      'A 30 TB BigQuery table of events is queried mostly with filters on «event_date» and frequently on «customer_id» (millions of distinct values). How should you organise it?',
    options: [
      'Partition by event_date and cluster by customer_id',
      'Partition by customer_id using integer ranges',
      'Cluster by event_date only, with no partitions',
      'Create one table per customer with a common prefix',
    ],
    answers: [0],
    why: 'Date partitioning prunes by time; clustering suits the high-cardinality customer_id filter. Partitioning by customer_id would create too many tiny partitions.',
  },
  {
    station: 'data-warehouse',
    prompt:
      'An orders table and an order_lines table are always queried together in BigQuery, and the join is the slowest part of every report. What schema change follows BigQuery best practice?',
    options: [
      'Store order lines as a nested, repeated field (ARRAY<STRUCT>) inside each order row',
      'Buy more slots so the join between orders and order lines gets more parallelism',
      'Normalise further into a snowflake schema with separate product and price tables',
      'Move both tables to Cloud SQL, where joins on indexed keys are faster',
    ],
    answers: [0],
    why: 'Nested repeated fields co-locate children with the parent and remove the join, the standard BigQuery denormalisation pattern.',
  },
  {
    station: 'data-warehouse',
    prompt:
      'A legacy design uses daily tables «sales_20260101», «sales_20260102», … Which query correctly reads January 2026?',
    options: [
      "SELECT * FROM project.dataset.sales_* WHERE date LIKE '202601%'",
      "SELECT * FROM 'project.dataset.sales_*' WHERE _TABLE_SUFFIX BETWEEN '20260101' AND '20260131'",
      "SELECT * FROM 'project.dataset.sales_'* WHERE _PARTITIONTIME BETWEEN '2026-01-01' AND '2026-01-31'",
      "SELECT * FROM 'project.dataset.sales_*' WHERE _TABLE_SUFFIX > 202601",
    ],
    answers: [1],
    why: 'Wildcard tables need the full name including * inside backticks and filter on _TABLE_SUFFIX (a string). Single quotes make a string literal, not a table.',
  },
  {
    station: 'data-warehouse',
    prompt:
      'A column «ts_str» stores epoch seconds as STRING in a 10 TB table. You need it as TIMESTAMP for many future queries with minimal ongoing cost. What should you do?',
    options: [
      'CREATE TABLE … AS SELECT with TIMESTAMP_SECONDS(CAST(ts_str AS INT64)) into a new table, and use that table from now on',
      "Create a view that applies TIMESTAMP_SECONDS(CAST(ts_str AS INT64)) every time it's queried",
      'Add a new TIMESTAMP column, then reload all of the existing data in append mode with a flag column that marks the new rows',
      'Run ALTER TABLE … ALTER COLUMN ts_str SET DATA TYPE TIMESTAMP on the existing table',
    ],
    answers: [0],
    why: "A one-time CTAS converts the data so future queries read a native TIMESTAMP. A view repeats the cast every query; the append trick doubles storage; STRING → TIMESTAMP isn't a supported in-place type change.",
  },
  {
    station: 'data-lake',
    prompt:
      "Analysts run interactive SQL on Parquet files in Cloud Storage from both BigQuery and Spark. Some must not see the «salary» column, and you don't want to grant direct bucket access. What should you use?",
    options: [
      "BigLake tables with column-level security (policy tags), using a connection's service account",
      'External tables over the bucket, with the analysts granted Storage Object Viewer on it',
      'Copy the Parquet data into native BigQuery tables, one per team, each with different columns',
      'Signed URLs for each analyst to the Parquet files, expiring after one working day',
    ],
    answers: [0],
    why: 'BigLake tables delegate file access to a connection service account and enforce row/column security for BigQuery and Spark readers, without bucket permissions for users.',
  },
  {
    station: 'data-platform',
    prompt:
      'Several business domains own their data in separate projects, but the company needs consistent discovery, data quality and security standards across all of them without moving data. What should you use?',
    options: [
      'Dataplex lakes per domain, with zones and assets, plus the central catalog for search, lineage and quality',
      "Copy all of the domain data into one central BigQuery project that's owned and governed by the platform team",
      'A shared spreadsheet where each domain lists its tables, owners, quality checks and contacts',
      'A separate Cloud Data Fusion instance per domain, each with its own lineage view',
    ],
    answers: [0],
    why: 'Dataplex organises distributed data into lakes/zones/assets across projects and applies central governance; the catalog adds discovery and lineage — a federated governance model.',
  },
  {
    station: 'storage-selection',
    prompt:
      'Your Bigtable cluster serves a user-facing API, and a nightly batch analytics job reading the same table causes latency spikes. What should you do?',
    options: [
      'Add a replicated cluster and route the batch job to it with its own single-cluster app profile',
      "Switch the cluster's storage from SSD to HDD so that the batch scans don't compete with the API for disk",
      'Lengthen the row keys so that batch scans touch fewer rows per request',
      'Move the user-facing API to BigQuery and keep Bigtable for the batch job',
    ],
    answers: [0],
    why: 'Replication plus app profiles isolates workloads: serving traffic stays on one cluster, batch on another.',
  },
  {
    station: 'storage-selection',
    prompt:
      'A Spanner table uses an auto-incrementing integer as primary key, and writes concentrate on one split. What should you change?',
    options: [
      'Use a UUIDv4 or a bit-reversed sequence as the key',
      'Use the commit timestamp as the primary key',
      'Add secondary indexes on the order number',
      'Interleave every table under the orders table',
    ],
    answers: [0],
    why: 'Monotonically increasing keys hit the last split; UUIDv4 or bit-reversed sequences distribute writes. A timestamp has the same problem.',
  },
  {
    station: 'storage-selection',
    prompt:
      'A 5 TB BigQuery table receives new data daily, but rows older than 90 days are never modified. Finance asks how to reduce storage cost without changing queries. What is true?',
    options: [
      "If it's partitioned by date, partitions untouched for 90 days get long-term pricing automatically",
      'Old rows must first be exported to Coldline storage in Cloud Storage before any long-term pricing applies',
      'Long-term pricing applies only to tables covered by a slot reservation commitment',
      'Long-term pricing applies only once the table is clustered on its date column',
    ],
    answers: [0],
    why: "Long-term pricing applies per partition when it hasn't been modified for 90 consecutive days. An unpartitioned table that changes daily never qualifies.",
  },
  {
    station: 'storage-selection',
    prompt: 'Which use case is the best fit for Bigtable?',
    options: [
      'Storing 50 TB of ad-impression events with millisecond lookups by user and time',
      'A 200 GB product catalogue that analysts query with ad-hoc SQL joins',
      'A financial ledger that needs multi-row transactions across accounts and branches',
      'Monthly BI reports that aggregate several years of historical sales',
    ],
    answers: [0],
    why: "Bigtable excels at very large, high-throughput key/time lookups. It lacks joins and multi-row transactions, and small datasets don't benefit.",
  },
  {
    station: 'storage-selection',
    prompt:
      'An application team uses PostgreSQL and needs high transactional throughput plus fast analytical queries on the same live data, without building an ETL to a warehouse. What should they choose?',
    options: [
      'AlloyDB for PostgreSQL with the columnar engine',
      'Cloud SQL for PostgreSQL with a read replica',
      'Bigtable accessed through the HBase client',
      'Memorystore in front of Cloud SQL for PostgreSQL',
    ],
    answers: [0],
    why: "AlloyDB's columnar engine accelerates analytics on operational data in a PostgreSQL-compatible database (HTAP).",
  },
  {
    station: 'resource-optimization',
    prompt:
      "The finance team's month-end BigQuery ETL slows down because analysts run large ad-hoc queries at the same time. Both use the same organisation. How do you guarantee capacity for finance?",
    options: [
      'Separate reservations: the finance ETL project in one with baseline slots, the analyst projects in another',
      'Ask the analysts to add LIMIT clauses so that their ad-hoc queries use fewer slots',
      'Give the finance service account BigQuery Admin so its jobs are scheduled first',
      "Run the finance ETL queries at batch priority so they're scheduled ahead of others",
    ],
    answers: [0],
    why: "Reservations with assignments isolate workloads, and baseline slots guarantee capacity. IAM roles have no effect on scheduling, batch priority would make finance wait for idle capacity, and LIMIT doesn't reduce the work a query does.",
  },
  {
    station: 'resource-optimization',
    prompt:
      'A single analyst accidentally ran queries that scanned 400 TB in a day. You want to prevent any one user from exceeding 10 TB per day on on-demand pricing. What should you configure?',
    options: [
      'A custom quota for query usage per day, per user',
      'A billing budget alert at the cost of scanning 10 TB',
      'A reservation of 100 slots for the project',
      'Table expiration on the largest tables',
    ],
    answers: [0],
    why: "Custom per-user daily query quotas stop queries once the limit is reached. Budgets only alert; they don't block spend.",
  },
  {
    station: 'monitoring',
    prompt:
      'Your monitoring tool must be notified immediately whenever an insert job appends data to the table «finance.ledger», but not for other tables. What should you do?',
    options: [
      'A log sink with an advanced filter for insert jobs on finance.ledger, exporting to a Pub/Sub topic the tool subscribes to',
      'A Cloud Run job that polls the Logging API every minute, filters the entries for that table, and calls the monitoring tool',
      'A sink that exports all BigQuery logs to a BigQuery dataset, queried hourly by the monitoring tool',
      'Turn on BigQuery Data Access audit logs and point the monitoring tool at Logs Explorer',
    ],
    answers: [0],
    why: 'A sink with a precise filter routes only matching entries to Pub/Sub in near real time. Polling and periodic queries are delayed; enabling logs alone notifies no one.',
  },
  {
    station: 'monitoring',
    prompt:
      'A streaming Dataflow pipeline reads from Pub/Sub. You want an alert when processing falls behind incoming data. Which metrics should you alert on? (Choose two.)',
    options: [
      'Dataflow system lag (or data freshness)',
      'Pub/Sub subscription oldest_unacked_message_age',
      'BigQuery storage bytes',
      'Cloud Storage request count',
    ],
    answers: [0, 1],
    why: "Rising system lag and an ageing unacked backlog both indicate the pipeline isn't keeping up.",
  },
  {
    station: 'failure-mitigation',
    prompt:
      "A weather app's backend queries a database every 15 minutes for millions of users. The database sometimes becomes unavailable for a few minutes. How should the backend respond?",
    options: [
      'Retry with exponential backoff and jitter, up to a cap, serving the last cached value meanwhile',
      'Retry every second until the database responds, so data is never more than a second stale',
      'Restart the database servers automatically whenever a query fails',
      'Stop querying and show an error until an operator confirms the database is back',
    ],
    answers: [0],
    why: 'Exponential backoff avoids overwhelming a recovering service; serving cached data limits user impact. Tight retry loops cause a thundering herd.',
  },
  {
    station: 'failure-mitigation',
    prompt:
      'An engineer ran an UPDATE that overwrote a column in a BigQuery table 45 minutes ago. How can you recover the previous values most quickly?',
    options: [
      'Query the table FOR SYSTEM_TIME AS OF a time before the update, and write that result back',
      "Restore the table from last night's export in Cloud Storage, then replay today's loads on top of it",
      "Open a support ticket to recover the table from BigQuery's fail-safe storage",
      'Re-run the entire ingestion pipeline from the source systems into a new table',
    ],
    answers: [0],
    why: 'Time travel lets you read the table as of any point in the window (up to 7 days) and restore it immediately. Fail-safe is only after the time travel window.',
  },
  {
    station: 'automation',
    prompt:
      "A Composer DAG appends yesterday's data to a BigQuery table. When a task is retried, rows get duplicated. What design fixes this?",
    options: [
      "Make it idempotent: overwrite the run's date partition (table$YYYYMMDD from {{ ds }}) or MERGE on a key",
      'Disable retries on the task so that each run can append its rows at most once',
      'Add a second DAG that runs every night and deletes any duplicate rows from the reporting table afterwards',
      'Increase the task timeout so that retries are needed less often',
    ],
    answers: [0],
    why: 'Idempotent, partition-scoped overwrites make retries and backfills safe. Disabling retries trades duplicates for failures.',
  },
  {
    station: 'failure-mitigation',
    prompt:
      'You need to recover a Cloud SQL for MySQL database to the state it had at 10:42 this morning, before a bad deployment. What feature should you use?',
    options: [
      'Point-in-time recovery using automated backups and binary logs',
      'Promote a read replica, which holds a copy of the database from this morning',
      'Restore the most recent automated backup, taken at 02:00 last night',
      'Trigger a high availability failover to the standby instance',
    ],
    answers: [0],
    why: 'PITR replays binary logs from a backup to a precise time. A replica or failover would contain the same bad changes.',
  },
  {
    station: 'failure-mitigation',
    prompt:
      'A Cloud SQL instance must survive a zone outage with automatic failover and no change of connection IP. What should you configure?',
    options: [
      'High availability (regional) configuration',
      'A read replica in another zone of the region',
      'A cross-region read replica in another region',
      'Automated daily backups with point-in-time recovery',
    ],
    answers: [0],
    why: 'HA keeps a synchronous standby in another zone and fails over automatically behind the same IP. Read replicas require manual promotion.',
  },
  {
    station: 'failure-mitigation',
    prompt:
      'You want to test how your application behaves when the Memorystore for Redis Standard tier primary fails, while losing as little data as possible. What should you do?',
    options: [
      'Initiate a manual failover with the limited-data-loss data protection mode',
      'Delete the instance and recreate it from the last RDB snapshot',
      'Initiate a manual failover with the force-data-loss protection mode',
      'Scale the instance down a tier so the replica takes over',
    ],
    answers: [0],
    why: 'Manual failover tests resilience; limited-data-loss aborts if more than 30 MB is pending replication, minimising loss.',
  },
  {
    station: 'workload-organization',
    prompt:
      'A non-urgent weekly report runs dozens of heavy BigQuery queries and causes interactive dashboard queries to queue. Without buying more capacity, what is the simplest change?',
    options: [
      'Run the report queries with batch priority',
      'Convert the report into a materialized view',
      'Export the data to Cloud SQL',
      'Increase max_bytes_billed',
    ],
    answers: [0],
    why: "Batch priority queries wait for idle resources and don't count against interactive concurrency, so dashboards keep priority.",
  },
  {
    station: 'monitoring',
    prompt:
      "A load pipeline fails with 'Exceeded rate limits: too many table update operations for this table'. It runs a load job for every small file as it arrives. What should you do?",
    options: [
      'Batch files into fewer, larger load jobs, or stream with the Storage Write API',
      'Buy a slot reservation so the load jobs get dedicated capacity',
      'Retry the failed load jobs immediately in a tight loop',
      'Split the table into more columns so that each load job touches less of the data',
    ],
    answers: [0],
    why: 'Table update operations have per-table quotas; batching or switching to the Storage Write API reduces operations. Tight retries make it worse.',
  },
  {
    station: 'monitoring',
    prompt:
      "Leadership wants to know which team caused last month's BigQuery cost spike. Jobs are labelled with a team label. Which TWO sources can answer this? (Choose two.)",
    options: [
      'INFORMATION_SCHEMA.JOBS grouped by labels and user_email with total_bytes_billed',
      'Cloud Billing export to BigQuery, grouped by labels',
      'Cloud Storage access logs',
      'Dataplex data profiling',
    ],
    answers: [0, 1],
    why: "Job metadata and the billing export both carry labels and costs, so you can attribute spend by team. The other options don't record query cost.",
  },
  {
    station: 'security-compliance',
    prompt:
      "A Cloud KMS key that protects a bucket's objects (CMEK) may have been exposed. You must re-encrypt every object with a new key, destroy the old key, and make sure future uploads are CMEK-protected even when clients don't name a key. What should you do?",
    options: [
      'Create a new key and a new bucket with the new key as its default CMEK, copy the objects without specifying a key, then destroy the old key',
      'Rotate the existing key to a new version, keep using the same bucket, and disable the previous key version afterwards',
      'Create a new key, set it as the default key on the existing bucket, and destroy the old key once the default is in place',
      'Create a new key and a new bucket with no default key, and copy the objects specifying the new key on each copy',
    ],
    answers: [0],
    why: "Copying into a bucket whose default is the new key re-encrypts every object, and the default also covers future uploads that don't name a key. Rotating, or changing the default on the old bucket, leaves existing objects encrypted with the exposed key, so destroying it would make them unreadable. Naming the key on each copy works once, but future uploads to a bucket with no default fall back to Google-managed keys.",
  },
  {
    station: 'security-compliance',
    prompt:
      'Regulators require that BigQuery data be encrypted with key material that is generated and stored only in your own HSM, outside Google Cloud, and you want to rely on managed Google services. What should you do?',
    options: [
      'Link a key in your external key manager to a Cloud EKM key, and use it as the CMEK for BigQuery',
      'Generate the key in your HSM and import it into a Cloud HSM key used as the CMEK',
      'Generate the key in your HSM and import it into a Cloud KMS software key, then use that as the CMEK',
      'Encrypt each row in the application with your HSM before loading it into BigQuery',
    ],
    answers: [0],
    why: 'With Cloud EKM the key material never leaves your external key manager; Google calls it for every wrap and unwrap. Importing into Cloud HSM or Cloud KMS places the material inside Google, and client-side encryption stops BigQuery from working with the data normally.',
  },
  {
    station: 'security-compliance',
    prompt:
      "Analysts should read the team's shared tables but never modify them, and each analyst needs a private place in the same project to create tables that other analysts can't see. What should you configure?",
    options: [
      'Data Viewer on the shared dataset; one dataset per analyst, with Data Editor granted on that dataset only',
      'Data Viewer at project level; one shared sandbox dataset with Data Editor for all analysts',
      'Data Editor at project level for every analyst',
      'Data Viewer on the shared dataset; one dataset per analyst, with Data Editor for each analyst granted at project level',
    ],
    answers: [0],
    why: "Dataset-level grants keep each sandbox private and the shared data read-only. A shared sandbox lets analysts see each other's tables, and any project-level Data Editor grant exposes every dataset, including the shared one, to changes.",
  },
  {
    station: 'reliability-fidelity',
    prompt:
      'Transfers between customer wallets must be recorded atomically. Expected load is 2,000 writes per second in one region, 3 TB of data growing about 20% a year. Which database meets this at the lowest cost?',
    options: [
      'Cloud SQL for PostgreSQL with high availability',
      'Bigtable with one row per wallet and a replicated cluster',
      'A Spanner multi-region configuration with five nodes',
      'BigQuery tables updated with multi-statement DML',
    ],
    answers: [0],
    why: "A regional, single-primary relational database with ACID transactions is enough for this size and rate, and HA covers zonal failures. Bigtable has no multi-row transactions, Spanner multi-region works but costs far more than one region needs, and BigQuery isn't an OLTP store.",
  },
  {
    station: 'reliability-fidelity',
    prompt:
      'Several teams own BigQuery tables. You need continuous checks that price is never negative and that SKUs match a pattern, with results visible in the data catalog and alerts on failure, without anyone writing a pipeline. What should you use?',
    options: [
      'Dataplex data quality scans with rules on those tables',
      "Dataform assertions added to each team's repository",
      'Cloud Monitoring uptime checks',
      'BigQuery row access policies',
    ],
    answers: [0],
    why: 'Dataplex data quality scans are declarative rules on tables; results publish to the catalog and can trigger alerts. Dataform assertions only cover tables built by Dataform workflows, uptime checks test endpoints, and row policies control access.',
  },
  {
    station: 'reliability-fidelity',
    prompt:
      'Analysts use Gemini in BigQuery to turn questions into SQL. Some generated queries use the wrong columns, and some scan entire multi-terabyte tables. What best improves accuracy and cost safety?',
    options: [
      'Add table and column descriptions, review the generated SQL, and dry-run it with a maximum bytes billed cap',
      'Let the model execute its queries directly using a service account with BigQuery Admin',
      "Turn off require_partition_filter on all the large tables so that the model's generated queries never fail to run",
      "Train a custom language model on the warehouse's query history before using it",
    ],
    answers: [0],
    why: 'Models generate better SQL from good metadata, and dry runs plus a bytes cap stop expensive mistakes before they run. Broad permissions and removing guardrails increase risk, and training a custom model is far more work than better context.',
  },
  {
    station: 'reliability-fidelity',
    prompt:
      "A daily pipeline loads a partner file and then transforms it in BigQuery. The transform must not run if the file hasn't arrived by 6 a.m., failed steps must retry, and operators need a run history. What should you use?",
    options: [
      'A Cloud Composer DAG with a deferrable Cloud Storage sensor, retries, and a failure alert',
      'Cloud Scheduler triggering the BigQuery transform at 6 a.m. every day',
      'A cron job on a Compute Engine VM that checks for the file every minute, then runs the transform',
      'A BigQuery scheduled query at 6 a.m. with email notifications turned on',
    ],
    answers: [0],
    why: 'Composer handles the dependency (wait for the file), retries and run history in one place. Scheduler and scheduled queries fire whether or not the file exists, and a cron VM gives you none of the operational features.',
  },
  {
    station: 'reliability-fidelity',
    prompt: 'Which TWO statements about Bigtable replication are true? (Choose two.)',
    options: [
      'Replication between clusters is eventually consistent',
      'An app profile with multi-cluster routing gives automatic failover',
      'Replication adds multi-row transactions across clusters',
      'Replication requires a Spanner instance',
    ],
    answers: [0, 1],
    why: 'Bigtable replicates asynchronously (eventual consistency), and multi-cluster routing sends traffic to the nearest healthy cluster. Transactions remain single-row, and Spanner is unrelated.',
  },
  {
    station: 'flexibility-portability',
    prompt:
      'EU customer data must stay in the EU, but a global dashboard needs revenue figures from every region. What should you do?',
    options: [
      'Keep EU data in an EU dataset; aggregate it in the EU and copy only the non-personal results to the global dataset',
      'Replicate the EU tables to the US multi-region so the dashboards can query everything in one place',
      'Keep all data in one US dataset and use row-level security so that only EU staff see the EU rows',
      'Write one query that joins the EU and US datasets directly, and schedule it to refresh the dashboard',
    ],
    answers: [0],
    why: "Aggregating in place keeps personal data in the EU while still feeding global reporting. Copying EU tables to the US breaks residency, row security doesn't change where data is stored, and BigQuery can't join tables in different locations in one query.",
  },
  {
    station: 'flexibility-portability',
    prompt:
      'A team wants to write a pipeline once, run it on Dataflow today, and keep the option of running it on Apache Flink in another cloud later. What should they write it with?',
    options: [
      'Apache Beam',
      'BigQuery scripting',
      'Cloud Data Fusion plugins',
      'Dataproc workflow templates',
    ],
    answers: [0],
    why: 'Beam is a portable programming model with runners for Dataflow, Flink and Spark. The other options are tied to specific Google Cloud services.',
  },
  {
    station: 'flexibility-portability',
    prompt:
      'Data scientists work in Spark and analysts in BigQuery SQL. Both must read and write the same tables, stored in Cloud Storage in an open format, with fine-grained access control. What should you use?',
    options: [
      'BigLake Iceberg tables managed by BigQuery, readable and writable from Spark',
      'Native BigQuery tables, exported to Parquet in Cloud Storage every night for Spark',
      'CSV files in Cloud Storage, read through BigQuery external tables and by Spark',
      'A separate copy of the data for each team, kept in sync by a daily Dataflow job',
    ],
    answers: [0],
    why: "Iceberg is an open table format that both engines understand, and BigLake adds BigQuery's row and column security. Nightly exports and per-team copies create stale duplicates, and CSV external tables lack both transactions and fine-grained security.",
  },
  {
    station: 'flexibility-portability',
    prompt:
      'Sales data is 5 GB per day and feeds daily reports. Next year the business wants second-level freshness for fraud alerts. Which design keeps both paths simple?',
    options: [
      'Publish events to Pub/Sub and process them with Beam on Dataflow: batch now, streaming later',
      'Build a nightly SFTP export now, and redesign the pipeline when streaming is needed',
      'Use Cloud SQL as the analytics warehouse now, since it can handle both batch and streaming workloads later',
      "Keep the sales data only in Memorystore so it's always fast enough for real time",
    ],
    answers: [0],
    why: "Beam's unified model and a Pub/Sub entry point let you move from batch to streaming without redesigning the pipeline. A nightly export guarantees a rewrite later, and Cloud SQL and Memorystore aren't analytics stores.",
  },
  {
    station: 'flexibility-portability',
    prompt:
      "Users can't tell which of three 'customer' tables is the trusted one. What helps most?",
    options: [
      'Catalog entries with business metadata (owner, certification, freshness) and a searchable business glossary',
      'Delete the two untrusted tables and announce the change at the next all-hands meeting',
      'Rename the trusted table with a _final suffix so that users can tell it apart',
      'Give everyone Data Owner on all of the datasets so they can fix the table descriptions and labels themselves',
    ],
    answers: [0],
    why: "Business context in the catalog (aspects, glossary terms, owners) tells consumers what is trustworthy and why. Renaming and deleting don't explain anything, and broad ownership creates more drift.",
  },
  {
    station: 'flexibility-portability',
    prompt:
      'Before designing transformations for a new source table, you want null percentages, distinct counts, min and max values and top values for every column, without writing queries. What should you use?',
    options: [
      'A Dataplex data profiling scan',
      'The Data Validation Tool',
      'BI Engine',
      'Cloud Monitoring',
    ],
    answers: [0],
    why: 'Profiling scans compute column statistics automatically. DVT compares a source with a target, BI Engine accelerates queries, and Monitoring tracks metrics, not data contents.',
  },
  {
    station: 'data-migrations',
    prompt:
      'An Oracle database runs on Compute Engine inside your VPC with no public IP. You need 30 tables continuously replicated to BigQuery, with no infrastructure to manage. What should you do?',
    options: [
      'Datastream with a private connectivity configuration to the VPC, an Oracle source profile and a BigQuery destination',
      'Kafka with a Debezium Oracle connector running on GKE in the same VPC, plus the BigQuery sink connector for Kafka Connect',
      'Nightly Data Pump exports to Cloud Storage, loaded into BigQuery by a scheduled load job',
      'BigQuery federated queries against Oracle through a Cloud SQL connection',
    ],
    answers: [0],
    why: "Datastream is serverless CDC, and private connectivity reaches sources inside a VPC. Kafka and Debezium are infrastructure to run, nightly exports aren't continuous, and BigQuery federated queries don't support Oracle.",
  },
  {
    station: 'data-migrations',
    prompt:
      "You're moving a Teradata warehouse with 3,000 SQL scripts to BigQuery. How do you convert the SQL with the least manual effort?",
    options: [
      'BigQuery Migration Service batch SQL translation',
      'A team of engineers rewriting each script by hand',
      'Datastream with a Teradata source profile',
      'Database Migration Service in continuous mode',
    ],
    answers: [0],
    why: "The batch SQL translator converts Teradata SQL to GoogleSQL at scale and reports what it couldn't translate. Datastream and DMS move data, not SQL code.",
  },
  {
    station: 'data-migrations',
    prompt: 'You must move a 2 TB MySQL database to Cloud SQL with only a few minutes of downtime.',
    options: [
      'Database Migration Service continuous migration, then promote the destination',
      'mysqldump and import into Cloud SQL over a long weekend',
      'Datastream into BigQuery, then switch the application over to the BigQuery copy',
      'Transfer Appliance shipped with a copy of the database files',
    ],
    answers: [0],
    why: 'DMS does an initial copy and then replicates changes continuously, so cut-over is a short promotion. A dump means hours of downtime, Datastream targets analytics, and an appliance is for bulk files.',
  },
  {
    station: 'data-migrations',
    prompt:
      'Your on-prem platform runs Spark jobs on Hadoop with HDFS, orchestrated by 600 Airflow DAGs. You need to move to Google Cloud with minimal change to orchestration. What should you do?',
    options: [
      'Dataproc for the Spark jobs, Cloud Storage in place of HDFS, and Cloud Composer for the existing DAGs',
      'Dataproc and Cloud Storage, with the 600 DAGs rewritten as Dataflow pipelines',
      'Bigtable for the processing, with Cloud Composer running the existing DAGs',
      'Dataproc and Cloud Storage, with every pipeline redrawn in Cloud Data Fusion',
    ],
    answers: [0],
    why: "Composer is managed Airflow, so the DAGs move almost unchanged, while Dataproc and Cloud Storage cover the Hadoop side. Rewriting in Dataflow or Data Fusion isn't minimal change, and Bigtable isn't a processing engine.",
  },
  {
    station: 'pipeline-planning',
    prompt:
      "A Dataflow job must read from a Cloud SQL instance that has only a private IP. What's required?",
    options: [
      "Run the workers in a subnet that can reach the instance's private IP (same VPC, peered, or Shared VPC)",
      'Enable a public IP on the Cloud SQL instance and add 0.0.0.0/0 to its authorized networks for the workers',
      "Add Cloud NAT to the workers' subnet so that they can reach the instance",
      'Put both projects inside one VPC Service Controls perimeter',
    ],
    answers: [0],
    why: 'Private IP access is network reachability, so the workers must be in a network connected to the instance. Opening it to the internet is unsafe, Cloud NAT is for internet egress, and VPC-SC protects APIs rather than routing traffic.',
  },
  {
    station: 'pipeline-planning',
    prompt:
      'Clickstream events must be queryable in BigQuery within seconds and also archived raw, cheaply, for reprocessing. Which design fits?',
    options: [
      'Publish to Pub/Sub; deliver to BigQuery and archive raw events through a Cloud Storage subscription',
      'Write events directly into BigQuery and export the table to Cloud Storage once a year',
      'Write the events into Cloud SQL first, then export them to both BigQuery and Cloud Storage every night',
      'Write events into Memorystore and snapshot it to Cloud Storage every hour',
    ],
    answers: [0],
    why: "One topic can fan out to several subscriptions: one feeds BigQuery, another archives raw files to Cloud Storage. Writing only to BigQuery loses the cheap raw archive, and Cloud SQL and Memorystore aren't meant for this.",
  },
  {
    station: 'pipeline-planning',
    prompt:
      'Raw data must be kept unchanged for audits, transformations change often, and the analysts know SQL. Which pattern fits best?',
    options: [
      'ELT: load raw data into BigQuery, then transform with SQL (Dataform or scheduled queries)',
      'ETL in Dataflow, transforming before the load and discarding the raw files afterwards',
      'Transform in the source database with stored procedures before each export',
      'Export to spreadsheets and let the analysts apply the transformations there',
    ],
    answers: [0],
    why: 'ELT keeps the raw layer for audits and reprocessing, and SQL transformations are easy for analysts to change. Discarding raw data or transforming at the source makes changes hard to replay.',
  },
  {
    station: 'pipeline-planning',
    prompt:
      "A Dataflow batch job that doesn't use Dataflow Shuffle hangs because workers can't exchange data. The VPC denies all ingress except SSH. What should you add?",
    options: [
      'An ingress rule allowing TCP 12345–12346 between Dataflow worker VMs, by network tag',
      'Cloud NAT on the subnet so that the workers can reach each other through their external IPs',
      'An ingress rule opening TCP port 443 from the internet to the worker VMs',
      'An ingress exception for Dataflow in the VPC Service Controls perimeter',
    ],
    answers: [0],
    why: "Dataflow workers talk to each other on TCP 12345 (streaming) and 12346 (batch) unless the shuffle runs in the service. NAT handles internet egress, and opening ports to the internet or changing VPC-SC doesn't help workers reach each other.",
  },
  {
    station: 'pipeline-planning',
    prompt:
      'Policy requires that all data at rest in a pipeline (Pub/Sub topic, Dataflow state, Cloud Storage staging, BigQuery tables) use keys you control. What should you do?',
    options: [
      'Configure CMEK on the topic, the Dataflow job, the bucket and the BigQuery dataset',
      'Use customer-supplied encryption keys (CSEK) on every service that the pipeline touches',
      'Rely on TLS between the services, which also covers data written to disk',
      'Rely on default encryption, since Google rotates its keys automatically',
    ],
    answers: [0],
    why: 'Each service accepts a Cloud KMS key, and you must set it on every hop. CSEK only works with Cloud Storage and Compute Engine, TLS protects data in transit rather than at rest, and default keys are Google-controlled.',
  },
  {
    station: 'building-pipelines',
    prompt:
      'A food-delivery app shows a live heatmap of orders per zone over the last 60 seconds, refreshed every 5 seconds. Reads must take milliseconds. Which design?',
    options: [
      'Sliding (hopping) windows of 60 s every 5 s, with results in Memorystore',
      'Fixed 60-second windows, with the results written to BigQuery',
      'Session windows per zone, with the results written to Bigtable',
      'Sliding windows of 60 s every 5 s, with results written to BigQuery',
    ],
    answers: [0],
    why: "A rolling window that's recomputed every few seconds is a sliding (hopping) window, and millisecond reads call for an in-memory store. Fixed windows refresh only once a minute, sessions follow user inactivity, and BigQuery doesn't serve in milliseconds.",
  },
  {
    station: 'building-pipelines',
    prompt:
      'You must ingest Avro, JSON and CSV files from several sources into Cloud Storage using a visual tool, and the destination objects must be encrypted with your Cloud KMS key. What should you use?',
    options: [
      'A Cloud Data Fusion pipeline with a CMEK-configured Cloud Storage sink',
      'A Dataflow pipeline written in Java with a custom reader per file format',
      'BigQuery Data Transfer Service with a CMEK on the destination dataset',
      'A Pub/Sub Cloud Storage subscription that batches the files into objects',
    ],
    answers: [0],
    why: "Data Fusion is the graphical integration tool, supports many file formats, and lets you set a CMEK on its sinks. Dataflow needs code, BigQuery DTS loads into BigQuery rather than objects, and a Pub/Sub subscription doesn't ingest files.",
  },
  {
    station: 'building-pipelines',
    prompt:
      'Marketing runs about 200 queries a day joining BigQuery clickstream data with customer tables in Cloud SQL for PostgreSQL through federated queries. The Cloud SQL instance is struggling. What should you do?',
    options: [
      'Replicate the needed Cloud SQL tables into BigQuery with Datastream and query them there',
      'Keep the federated queries and add read replicas to each Cloud SQL instance',
      'Run Trino on a Dataproc cluster that queries Cloud SQL and BigQuery together',
      'Run the campaign queries as Spark jobs on Dataproc Serverless that read Cloud SQL over JDBC',
    ],
    answers: [0],
    why: 'Every federated query runs on the operational database. Replicating the tables moves analytical load into BigQuery entirely. Replicas, Trino and Spark all keep querying Cloud SQL for every campaign run.',
  },
  {
    station: 'operationalizing-pipelines',
    prompt:
      'A workflow in Workflows calls an API that returns 2 KB of JSON, must apply logic that needs Python libraries, and then starts a BigQuery load. You want it simple and fast. What should you do?',
    options: [
      'Call a Python Cloud Run function from the workflow for that step',
      'Create a small Dataproc cluster and run the logic as a PySpark job',
      'Create a Cloud Composer environment for the logic',
      'Write the logic only in Workflows expressions',
    ],
    answers: [0],
    why: "A small serverless function handles a small payload instantly and returns to the workflow. Dataproc and Composer are heavy for 2 KB, and Workflows' standard library can't express complex Python logic.",
  },
  {
    station: 'operationalizing-pipelines',
    prompt:
      "Every change to your Dataform SQL must be reviewed and tested before it reaches production. What's the right setup?",
    options: [
      'Git branches and pull requests for Dataform workspaces, CI that compiles and runs assertions, and production releases from main',
      'Develop directly in the production workspace and take a daily snapshot of every table in case of mistakes',
      'Copy reviewed SQL into BigQuery scheduled queries by hand after each change is approved',
      'Email the SQL files to a reviewer and apply the approved changes in the BigQuery console',
    ],
    answers: [0],
    why: 'Git-backed workspaces, reviewed pull requests and release configurations give you tested, repeatable deployments. Editing production directly or copying SQL by hand bypasses review and testing.',
  },
  {
    station: 'operationalizing-pipelines',
    prompt: 'How should DAG code reach a Cloud Composer environment in a CI/CD setup?',
    options: [
      "Cloud Build tests the DAGs and syncs them to the environment's dags/ folder in Cloud Storage",
      'Developers edit and save DAG code directly in the Airflow web UI',
      'A script uses SSH to copy the DAG files onto each Airflow worker and scheduler after every merge',
      'DAG definitions are stored in a BigQuery table that Airflow reads',
    ],
    answers: [0],
    why: "Composer reads DAGs from its bucket, so a pipeline that tests and then syncs files gives safe, repeatable deployments. The Airflow UI can't edit DAG files, and copying to workers is neither durable nor supported.",
  },
  {
    station: 'operationalizing-pipelines',
    prompt:
      "Analysts must launch a parameterized Dataflow pipeline from the console without building code, and some parameters change the pipeline's shape (for example, the number of outputs). What should you provide?",
    options: [
      'A Dataflow Flex Template',
      'A classic template',
      'A script run from Cloud Shell',
      'A Dataproc workflow template',
    ],
    answers: [0],
    why: "Flex Templates build the pipeline graph at launch time from a container image, so parameters can change its structure. Classic templates fix the graph when they're created, and the other options aren't Dataflow launch mechanisms.",
  },
  {
    station: 'data-warehouse',
    prompt:
      'Your BigQuery star schema joins a 10 TB fact table to a 5 GB product dimension that changes daily. Queries are already fast enough. Should you denormalize the product attributes into the fact table?',
    options: [
      'Not necessarily: joins to a small dimension are cheap, and keeping it separate avoids rewriting the fact table',
      'Yes: BigQuery best practice is to always denormalize every dimension into the fact table, whatever its size or rate of change',
      'No: normalize the fact table into third normal form to reduce storage',
      'No: move the dimension into Cloud SQL and query it with federated queries',
    ],
    answers: [0],
    why: 'Denormalization pays off for large joins and data read together. A small, frequently changing dimension is cheap to join and expensive to copy into every fact row. Full normalization or moving the dimension to Cloud SQL would make analytics slower.',
  },
  {
    station: 'data-warehouse',
    prompt: 'Which TWO statements about BigQuery materialized views are true? (Choose two.)',
    options: [
      'BigQuery can automatically rewrite queries on the base table to use a matching materialized view',
      'They refresh incrementally when new data is appended to the base table',
      'They are just saved SQL with no storage of their own',
      'They support any SQL, including non-deterministic functions',
    ],
    answers: [0, 1],
    why: 'Materialized views store precomputed results, refresh incrementally, and the optimizer can use them for queries on the base table. Plain views are the ones without storage, and materialized views restrict which SQL they allow.',
  },
  {
    station: 'data-warehouse',
    prompt:
      "Reports must show sales by the customer's region at the time of each sale, even after customers move. How should you model the customer dimension?",
    options: [
      'A Type 2 slowly changing dimension, with a new row and valid_from/valid_to dates per change',
      'A Type 1 dimension that overwrites the region whenever a customer moves',
      'Delete customers who move and insert them again with their new region',
      "Store only the customer's latest region, copied into every fact row",
    ],
    answers: [0],
    why: 'Type 2 keeps history, so each sale joins to the version of the customer that was valid at the time. Overwriting or deleting loses the historical region.',
  },
  {
    station: 'data-lake',
    prompt:
      'Teams drop Parquet and CSV files into Cloud Storage. You want them discovered automatically, queryable from BigQuery, and organised into raw and curated areas. What should you set up?',
    options: [
      'A Dataplex lake with raw and curated zones, the buckets added as assets, and discovery on',
      'External table DDL written by hand for each new folder, applied by a nightly Cloud Run script',
      'One native BigQuery table that every file is loaded into, whatever its format',
      'Datastream streaming from the bucket into BigQuery as new files arrive',
    ],
    answers: [0],
    why: "Dataplex zones express raw and curated stages, and discovery registers tables automatically. Hand-written DDL doesn't scale, one big table mixes unrelated data, and Datastream replicates databases.",
  },
  {
    station: 'data-lake',
    prompt:
      'Landing files are processed within a day and only re-read during rare backfills in the following month. After a year they must be deleted. Which lifecycle policy is most cost-effective?',
    options: [
      'Move objects to Coldline after 30 days and delete them after 365 days',
      'Keep everything in Standard forever so that backfills are always cheap',
      'Store new objects in Archive from day one and delete them after 365 days',
      'Delete objects right after processing; backfills can re-request the files',
    ],
    answers: [0],
    why: 'Keeping objects in Standard for the backfill month avoids retrieval fees, then Coldline is cheap for rarely-read data, and deletion at a year meets the requirement. Archive on day one charges retrieval fees on every backfill, and deleting right away breaks backfills.',
  },
  {
    station: 'data-lake',
    prompt:
      'A Spark job writes millions of tiny files to the lake every day, and both BigQuery external queries and Spark reads have become slow. What should you do?',
    options: [
      'Compact the files into larger Parquet files (hundreds of MB) in a periodic job',
      'Switch the Spark output format to CSV, which BigQuery reads faster',
      'Move the small files to the Archive storage class to cut their cost',
      'Add more Dataproc master nodes so the cluster can handle the extra file metadata',
    ],
    answers: [0],
    why: "Every file costs metadata and open overhead, so a few large columnar files read much faster than millions of small ones. CSV makes reads slower, storage class doesn't change read efficiency, and masters don't fix file layout.",
  },
  {
    station: 'data-lake',
    prompt:
      "You need an alert when a curated table hasn't been updated by 7 a.m., or when its null rate in «customer_id» goes above 1%. What should you use?",
    options: [
      'A Dataplex data quality scan with freshness and null-rate rules that alerts on failure',
      'Object lifecycle rules on the bucket that delete stale table files',
      'A BI Engine reservation that refreshes the table every morning',
      'A VPC Service Controls perimeter with an access level for the table',
    ],
    answers: [0],
    why: "Data quality scans support row, aggregate and SQL rules (including freshness checks) and integrate with alerting. The other options don't inspect data at all.",
  },
  {
    station: 'data-lake',
    prompt:
      'Data scientists need read access to every curated zone across five projects, but not to raw zones, and you want to manage it in one place. What should you do?',
    options: [
      'Grant access at the Dataplex lake or zone level and let Dataplex manage the underlying permissions',
      'Grant the data scientists Storage Admin on every bucket and BigQuery Admin on every dataset in all five projects',
      'Share a service account key that already has access to all the curated zones',
      'Copy all the curated data into one project and grant access to that project',
    ],
    answers: [0],
    why: 'Dataplex can propagate zone-level permissions to the assets it manages, giving you one place to grant curated-only access. Storage Admin is far too broad, shared keys are an anti-pattern, and copying creates stale duplicates.',
  },
  {
    station: 'data-platform',
    prompt:
      "A hospital's data is spread across Cloud Storage and BigQuery in many projects owned by different departments. You need discovery, lineage tracking and data quality validation, quickly and at low cost. What should you use?",
    options: [
      'Dataplex (Knowledge Catalog) for discovery, lineage and data quality',
      'A custom catalog and lineage application built on GKE',
      'BigLake, converting every source in the hospital into one big data lake',
      'Dataprep for data quality and BigQuery for lineage',
    ],
    answers: [0],
    why: "Dataplex provides all three as managed features, without moving data. Building your own is slow and costly, BigLake is a table type rather than a governance suite, and Dataprep isn't a governance tool.",
  },
  {
    station: 'data-platform',
    prompt:
      'Central governance wants every domain to label PII columns the same way, while each domain keeps managing its own tables. What should you do?',
    options: [
      'One central policy tag taxonomy and glossary, applied by each domain to its own columns',
      'Let each domain define its own tags and naming that fit its data best',
      'Copy all domain data into one central dataset so the central team can tag it',
      'Rely on column naming conventions such as a pii_ prefix in every domain',
    ],
    answers: [0],
    why: "A shared taxonomy gives consistent classification and access control, while domains keep ownership. Domain-specific tags drift, centralizing data defeats the federated model, and naming conventions don't enforce anything.",
  },
  {
    station: 'data-platform',
    prompt:
      "The supply-chain domain wants to publish 'daily inventory snapshot' as a product other domains can discover and subscribe to, with an owner, documentation and access controls. What should they do?",
    options: [
      'Describe it as a data product in the catalog and share it through an Analytics Hub listing',
      'Email the table name and a short description to the other domain teams',
      'Grant Editor on the supply-chain project to everyone who needs the data',
      'Export the snapshot to Google Sheets every day and share that sheet with everyone in the company',
    ],
    answers: [0],
    why: "A catalogued product with an owner and documentation can be discovered, and a listing gives controlled, zero-copy access. Emails and Sheets exports aren't governed, and Editor access is far too broad.",
  },
  {
    station: 'data-platform',
    prompt:
      'Two domains each hold a customer table in their own project. A third domain needs to join them without copies, and each owner must keep control over who has access. What should you do?',
    options: [
      'Owners publish Analytics Hub listings; the third domain subscribes and joins the linked datasets',
      'The two owners grant the third domain Data Viewer at the project level on both of their projects',
      "Nightly scheduled queries copy both tables into the third domain's project",
      'Both tables are exported to Cloud Storage and loaded into the third project',
    ],
    answers: [0],
    why: 'Listings keep each owner in control of subscribers, and linked datasets are zero-copy. Project-level grants expose everything in the project, and copies go stale and cost storage.',
  },
  {
    station: 'data-platform',
    prompt: 'Which TWO signs suggest a federated (data mesh) governance model? (Choose two.)',
    options: [
      'Many autonomous business domains produce and own data',
      'A central data team has become a bottleneck for every new dataset',
      'Only one small team uses data',
      'All data fits in one small database',
    ],
    answers: [0, 1],
    why: 'Data mesh fits organisations with many domains and a central bottleneck. A small, single-team setup gains nothing from federation.',
  },
  {
    station: 'visualization',
    prompt:
      'Finance users live in spreadsheets and want pivot tables and charts on a 3-billion-row BigQuery table, without SQL and without exporting. What should you give them?',
    options: [
      'Connected Sheets',
      'A CSV export opened in Google Sheets',
      'Looker Studio',
      'The bq command-line tool',
    ],
    answers: [0],
    why: "Connected Sheets runs spreadsheet operations as BigQuery queries, so billions of rows never land in the sheet. A CSV export hits sheet size limits, Looker Studio isn't a spreadsheet, and the CLI needs technical skills.",
  },
  {
    station: 'ai-ml',
    prompt:
      "You're training a churn model. One feature, «cancellation_reason», is filled in only after a customer has already churned. Validation accuracy looks suspiciously high. What should you do?",
    options: [
      'Remove the feature: it leaks the label',
      'Add more features that are filled in after churn',
      'Train for more epochs until accuracy stops rising',
      'Make the test split larger to confirm the score',
    ],
    answers: [0],
    why: "A feature that's only known after the outcome won't exist when you need a prediction, so the model learns the answer rather than the signal. Remove it and re-evaluate.",
  },
  {
    station: 'sharing-data',
    prompt:
      'Each regional team owns customer data in its own project and wants to keep full control while letting other teams query it, with minimal cost and administration. What should you do?',
    options: [
      'Each team publishes its data as listings in Analytics Hub, and other teams subscribe',
      "Scheduled queries copy each team's data into the other projects",
      'Each team creates authorized views and grants jobUser to every other team',
      'Each consuming team builds materialized views over the data it needs',
    ],
    answers: [0],
    why: 'Publishing and subscribing keeps owners in control, with zero copies and little admin. Copies cost storage and drift, authorized views still need per-consumer grants to manage, and materialized views need access to the source in the first place.',
  },
  {
    station: 'sharing-data',
    prompt:
      'A data provider shares a dataset through Analytics Hub and wants to stop subscribers from copying or exporting the shared data. What should they enable?',
    options: [
      'Data egress restrictions on the listing',
      'A customer-managed key (CMEK) on the dataset',
      'Sharing CSV exports instead of the dataset',
      'Row-level security on the shared tables',
    ],
    answers: [0],
    why: "Listings can restrict egress, blocking copy, export and similar operations for subscribers. CMEK, CSV and row policies don't stop a reader from exporting what they can read.",
  },
  {
    station: 'sharing-data',
    prompt:
      'Executives need a dashboard that updates daily, only the leadership Google Group may open it, and it must not give them access to raw tables. What should you do?',
    options: [
      "A Looker Studio report on an aggregated view with owner's credentials, shared with the leadership group",
      'Grant the executives Data Viewer on all the raw datasets so that the report loads using their own access',
      'Email the executives a CSV export of the aggregated numbers every morning',
      'Publish the report to anyone with the link, and send the link to leadership',
    ],
    answers: [0],
    why: "With owner's credentials, viewers see the report without needing BigQuery access, and sharing with the group limits who can open it. Granting dataset access exposes raw tables, and link sharing isn't restricted.",
  },
  {
    station: 'sharing-data',
    prompt:
      'Before sharing a dataset with an external partner, which TWO steps matter most? (Choose two.)',
    options: [
      'Classify and de-identify sensitive fields, for example with Sensitive Data Protection',
      'Share through a mechanism you can audit and revoke, such as an Analytics Hub listing',
      'Give the partner Owner on your project',
      'Turn off audit logs to save money',
    ],
    answers: [0, 1],
    why: "Remove or protect what the partner shouldn't see, and share in a way you control and can monitor. Owner access and disabling logs are the opposite of safe sharing.",
  },
  {
    station: 'resource-optimization',
    prompt:
      'Hundreds of BI queries a day aggregate a 40 TB on-demand table by week and region. You need lower cost and faster responses with minimal maintenance. What should you do?',
    options: [
      'Create materialized views at the week and region grain',
      'Create authorized views at the week and region grain',
      'Build aggregate tables with an hourly scheduled query job',
      'Export the table to Cloud SQL',
    ],
    answers: [0],
    why: "Materialized views precompute the aggregation, refresh themselves incrementally, and serve matching queries automatically, so far fewer bytes are scanned. Authorized views precompute nothing, scheduled aggregates need upkeep and go stale, and Cloud SQL can't handle 40 TB of analytics.",
  },
  {
    station: 'resource-optimization',
    prompt:
      'Your on-demand BigQuery bill is high and steady because hundreds of scheduled queries scan large tables all day. Finance wants predictable spend. What should you do?',
    options: [
      'Move to capacity pricing: an Editions reservation with a baseline for steady load and autoscaling for peaks',
      "Add a billing budget alert at last month's spend so that finance is warned early",
      'Add LIMIT to every scheduled query so each one scans fewer bytes',
      'Move the largest tables to Cloud SQL, which has no per-query charges',
    ],
    answers: [0],
    why: "Steady heavy usage is what slot reservations are for: a fixed baseline plus autoscaling gives a predictable bill, and commitments can lower it further. Budgets only alert, and LIMIT doesn't reduce bytes scanned.",
  },
  {
    station: 'resource-optimization',
    prompt:
      "A dataset's tables compress about 10 to 1. Which storage billing model is likely to lower its storage cost?",
    options: [
      'Physical (compressed) storage billing',
      'Logical (uncompressed) storage billing',
      'Long-term storage, which you must request',
      'Neither: they always cost the same',
    ],
    answers: [0],
    why: 'Physical billing charges a higher rate per byte but only for compressed bytes (including time-travel and fail-safe storage). With strong compression that usually works out cheaper. Long-term pricing applies automatically under either model.',
  },
  {
    station: 'automation',
    prompt:
      'A Composer task calls a flaky vendor API. You want a Slack message only when the task has finally failed, after all its retries. What should you do?',
    options: [
      'Set on_failure_callback on that operator to a function that posts to Slack',
      'Set on_retry_callback on that operator to a function that posts to Slack',
      'Set sla_miss_callback on that operator to a function that posts to Slack',
      "Create a Cloud Monitoring alert on the task's SLA miss metric that posts to Slack",
    ],
    answers: [0],
    why: 'on_failure_callback fires when the task ends in failure, after its retries are used up. on_retry_callback fires on every retry, and SLA callbacks or metrics are about tasks running late, not failing.',
  },
  {
    station: 'automation',
    prompt:
      'Every 3 hours an aggregation query must append its results to a reporting table, retry on errors, and email the team only after repeated failures. You already run Cloud Composer. What should you do?',
    options: [
      'Use BigQueryInsertJobOperator with retries set and email_on_failure=True',
      'Use BigQueryUpsertTableOperator with retries set',
      'Use a BigQuery scheduled query with Pub/Sub notifications and a Cloud Run function that counts failures',
      'Use Cloud Scheduler calling curl',
    ],
    answers: [0],
    why: 'InsertJob runs the query, retries handle transient errors, and the failure email goes out only once the retries are exhausted. UpsertTable just manages table metadata, the scheduled-query option means building failure counting yourself, and curl has no retry or alerting logic.',
  },
  {
    station: 'automation',
    prompt: 'You deploy a new DAG with a start_date six months ago and catchup=True. What happens?',
    options: [
      'Airflow schedules a run for every missed interval since the start date',
      "Only today's interval runs, because catchup applies only to paused DAGs",
      'Nothing runs until someone triggers the DAG by hand in the Airflow UI',
      'The DAG fails to load because its start date is in the past',
    ],
    answers: [0],
    why: "With catchup on, the scheduler backfills every interval between start_date and now. Make sure the tasks are idempotent and date-templated first, or set catchup=False if you don't want history processed.",
  },
  {
    station: 'automation',
    prompt:
      'A DAG waits up to 6 hours for a partner file, and these long waits are tying up worker slots. What should you change?',
    options: [
      'Use deferrable sensors (run by the triggerer) or reschedule mode',
      'Increase the maximum number of workers to 100 to absorb the waits',
      'Lower the DAG parsing interval so the sensors are checked more often',
      'Replace the sensor with a PythonOperator that calls time.sleep',
    ],
    answers: [0],
    why: 'Deferrable sensors free the worker while they wait, and reschedule mode releases the slot between checks. More workers just pay for idle waiting, and sleep holds a worker slot the whole time.',
  },
  {
    station: 'automation',
    prompt:
      "A single BigQuery transformation should run every 2 hours and append its results, and you want an email if a run fails. No retry logic is needed, and you don't want any orchestration infrastructure. What should you use?",
    options: [
      'A BigQuery scheduled query with email notifications',
      'A small Cloud Composer environment with a single DAG',
      "A cron job on a Dataproc cluster's master node",
      'Workflows calling a Composer DAG every 2 hours',
    ],
    answers: [0],
    why: 'With no dependencies or retry rules, a scheduled query does it all and can email on failure. Composer only becomes the better answer when you need retries, failure counting or multi-step dependencies.',
  },
  {
    station: 'automation',
    prompt:
      'The Composer scheduler is slow and DAG parsing takes minutes. The DAG files call an external API at import time to build their tasks. What should you do?',
    options: [
      'Move the API calls out of top-level DAG code into tasks, keeping DAG files light',
      'Give the Airflow workers more memory so that parsing finishes faster',
      'Split the DAGs into more files so that each one parses separately',
      "Turn off task retries to reduce the scheduler's workload",
    ],
    answers: [0],
    why: "The scheduler re-parses DAG files constantly, so top-level code must be fast and side-effect free. Worker memory doesn't affect parsing.",
  },
  {
    station: 'workload-organization',
    prompt:
      'You want ad-hoc analysts, BI dashboards and ETL never to starve each other, while still letting idle capacity be shared. What should you do?',
    options: [
      'A separate reservation per workload with its own baseline, with idle slot sharing on',
      'One large reservation shared by all three workloads, sized for their combined peak load',
      'On-demand pricing for all three workloads, with no reservations at all',
      'Run the BI dashboards at batch priority so that ETL always goes first',
    ],
    answers: [0],
    why: 'Separate reservations guarantee each workload its baseline, and idle sharing lends unused slots to the others. One shared pool lets one workload starve the rest, and batch priority would delay dashboards.',
  },
  {
    station: 'workload-organization',
    prompt:
      'A reservation has a 100-slot baseline and an autoscaling maximum of 500. A burst needs about 400 slots for 10 minutes. What happens?',
    options: [
      "BigQuery scales up toward 500 slots and bills the extra slots only while they're used",
      'Any query that needs more than the 100 baseline slots fails with a quota exceeded error',
      "You're billed for the full 500 slots for the rest of the month",
      'The extra demand is routed to on-demand pricing and billed per TiB',
    ],
    answers: [0],
    why: "Autoscaling adds slots above the baseline as demand rises and bills them only for the time they're allocated. Nothing fails, and the reservation doesn't fall back to on-demand.",
  },
  {
    station: 'workload-organization',
    prompt:
      "A data science team runs heavy exploratory queries that aren't time-sensitive, and they keep slowing the shared reservation during business hours. Which TWO changes help? (Choose two.)",
    options: [
      'Assign their project to its own reservation',
      'Run their queries at batch priority',
      'Give them BigQuery Admin',
      'Turn off the query cache',
    ],
    answers: [0, 1],
    why: 'A separate reservation isolates their usage, and batch priority makes their non-urgent jobs wait for idle capacity. Admin rights and turning off the cache make things worse.',
  },
  {
    station: 'workload-organization',
    prompt:
      'You expect steady use of about 1,000 slots for the next three years. What is usually the cheapest way to buy them?',
    options: [
      'A 3-year commitment covering the baseline',
      'Pay-as-you-go autoscaling with no baseline',
      'On-demand pricing with custom quotas',
      'Flex slots bought one day at a time',
    ],
    answers: [0],
    why: 'Commitments discount baseline slots, and 3-year terms give the largest discount. Pay-as-you-go is for variable load, and flex slots were retired when Editions launched.',
  },
  {
    station: 'workload-organization',
    prompt: 'Which TWO job types can be assigned to a reservation separately? (Choose two.)',
    options: ['QUERY', 'PIPELINE (load, export and copy jobs)', 'IAM', 'BILLING'],
    answers: [0, 1],
    why: "Assignments are made per job type: QUERY, PIPELINE, ML_EXTERNAL, BACKGROUND and so on. IAM and BILLING aren't job types.",
  },
  {
    station: 'monitoring',
    prompt:
      "A streaming Dataflow pipeline is slow. The execution graph shows all steps fused into one stage, so you can't tell which step is the bottleneck. What should you do?",
    options: [
      'Insert a Reshuffle between key steps to break fusion, then compare per-step metrics',
      'Log debug messages in every DoFn and compare their timestamps in Cloud Logging',
      'Add an output sink after each step and compare their write throughput',
      'Check that the service account has permission to write to every sink',
    ],
    answers: [0],
    why: 'Breaking fusion turns hidden sub-steps into separate stages with their own throughput and backlog. Logs and extra sinks add load without showing where time goes, and permission errors would cause failures, not slowness.',
  },
  {
    station: 'monitoring',
    prompt:
      'Composer 2 tasks are failing, and the monitoring dashboard shows worker memory rising and worker pod evictions. Which TWO actions help? (Choose two.)',
    options: [
      'Increase the memory available to the Airflow workers',
      'Increase the maximum number of workers and reduce worker concurrency',
      'Increase the DAG file parsing interval',
      'Increase the memory available to the triggerer',
    ],
    answers: [0, 1],
    why: "Evictions mean workers are out of memory, so give each worker more memory and run fewer tasks per worker, with more workers to keep throughput. Parsing interval and triggerer memory don't affect task memory.",
  },
  {
    station: 'failure-mitigation',
    prompt:
      'Applications read and write two Cloud Storage buckets (raw and processed). You need resilience to a regional failure with the smallest possible RPO and no changes to the applications. What should you do?',
    options: [
      'Use dual-region buckets with turbo replication',
      'Use multi-region buckets with default replication',
      'Use two regional buckets and change the applications to write to both',
      'Use two regional buckets and a daily copy job',
    ],
    answers: [0],
    why: "Dual-region with turbo replication gives a 15-minute RPO behind the same bucket names, so applications don't change. Default replication has no RPO guarantee, dual writes are an application change, and a daily copy can lose a day of data.",
  },
];
