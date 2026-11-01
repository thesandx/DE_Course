/**
 * GCP course, line 5: Maintaining and automating data workloads.
 *
 * Generated from Sandeep's PDE Exam Lab module and kept as data. Edit the
 * text here; see lib/course/gcp/README.md for the rules.
 */

import type { GcpLine } from '@/types/gcp';

export const line: GcpLine = {
  slug: 'operations',
  number: 5,
  title: 'Maintaining and automating data workloads',
  short: 'Maintain & automate',
  weight: 18,
  hue: 6,
  intro:
    'Cost and capacity (BigQuery Editions, reservations, Dataproc cluster choices), scheduling, monitoring and alerting with Cloud Monitoring and Logging, quotas, and designing for failure with retries, replays and replicas.',
  boss: {
    title: 'The 3 a.m. Pager',
    story: "Something is failing. Find it, fix it, and keep the bill down while you're at it.",
  },
  stations: [
    {
      slug: 'resource-optimization',
      code: '5.1',
      title: 'Optimizing resources',
      mission:
        'The cloud bill doubled after launch. Cut costs without starving the nightly finance close, and explain the savings to the CFO.',
      concepts: [
        {
          title: 'BigQuery pricing and cost control',
          body: "### Compute\n\n- **On-demand**: pay per TiB scanned (first 1 TiB per month free); a shared per-project slot quota with burst. Good for spiky, small workloads.\n- **Capacity (Editions)**: buy **slots**. Standard: autoscaling only (no baseline, no commitments), up to 1,600 slots per reservation, no BI Engine or BigQuery ML. Enterprise: adds baseline slots, 1-year (~20% off) and 3-year (~40% off) commitments, BI Engine, BigQuery ML and the advanced security and governance features. Enterprise Plus: adds managed disaster recovery and the strictest compliance controls. Predictable cost for heavy, steady use.\n\n### Cost guardrails\n\n- **Custom quotas**: cap query bytes per day per project or per user.\n- «maximum_bytes_billed» on a query fails it before it runs if it would exceed the cap.\n- Partition filters («require_partition_filter»), clustering, column selection, dry runs, preview (free table browsing instead of «SELECT *»).\n- Table/partition expiration, long-term storage, physical storage billing for well-compressed data.\n- **Billing export to BigQuery** + budgets and alerts (budgets alert, they don't stop spend). Labels on jobs for chargeback.\n\n> [!trap] Exam traps\n> Assuming a budget alert caps spending.\n>\n> Using LIMIT to reduce on-demand cost.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'predictable monthly BigQuery cost' | Capacity pricing (Editions reservation, commitment) |\n| 'stop one user from running huge queries' | Custom per-user query quota |",
        },
        {
          title: 'Dataproc, Dataflow and storage cost choices',
          body: "- **Persistent vs job-based clusters**: default to **ephemeral, job-scoped** clusters with data in GCS. Keep a persistent cluster only for constant interactive use (and give it autoscaling).\n- Use **Spot/preemptible secondary workers** for extra compute; never rely on them for HDFS.\n- **Dataproc Serverless** removes idle cost entirely for batch Spark.\n- Dataflow: **FlexRS** for delay-tolerant batch, autoscaling with sensible max workers, Streaming Engine, right-sized machine types; stop idle streaming jobs.\n- Cloud Storage: lifecycle rules and Autoclass; Bigtable autoscaling.\n\n> [!trap] Exam traps\n> Long-running cluster sized for peak 24/7.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'migrated Hadoop, minimise cost, jobs run nightly' | Ephemeral Dataproc clusters + GCS + Spot secondary workers |",
        },
        {
          title: 'Guaranteeing resources for critical jobs',
          body: "- **Reservations** isolate capacity: e.g. one reservation for production ETL, another for BI, another for ad-hoc. **Assignments** attach projects, folders or the org to a reservation by job type (QUERY, PIPELINE for loads/exports, ML_EXTERNAL, BACKGROUND).\n- **Idle slot sharing** lets unused baseline slots flow to other reservations; set a baseline on critical ones so they always have capacity.\n- Dataflow/Dataproc: check regional CPU/IP quotas ahead of peak; request increases early.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'month-end finance ETL must not be slowed by analysts' | Separate reservation with baseline slots for ETL |",
        },
      ],
      keyPoints: [
        {
          point:
            'On-demand pricing pays per byte scanned; Editions pay for slots. Guardrails: quotas, maximum bytes billed, partition filters.',
          check: {
            type: 'choice',
            prompt:
              'A query should fail before running if it would scan more than 1 TB. What do you set?',
            options: [
              'maximum_bytes_billed on the query',
              'LIMIT 1000 on the outer query',
              'A billing budget alert set at 1 TB',
              'Batch priority for the query',
            ],
            answers: [0],
            why: "maximum_bytes_billed makes the job fail up front, at no cost, when the estimate exceeds the cap. LIMIT doesn't reduce bytes scanned, budgets only alert after the fact, and priority only changes scheduling.",
          },
        },
        {
          point:
            "Pay for compute only while it's working: ephemeral clusters, Spot secondary workers, serverless Spark, FlexRS for batch.",
          check: {
            type: 'choice',
            prompt:
              "A data scientist runs ad-hoc PySpark batch jobs a few times a week and doesn't want to size or manage clusters at all.",
            options: [
              'Serverless for Apache Spark (Dataproc Serverless) batches',
              'A persistent Dataproc cluster with autoscaling',
              'Dataflow with FlexRS for the PySpark code',
              'Compute Engine VMs with Spark installed by a script',
            ],
            answers: [0],
            why: 'Serverless Spark runs the batch, scales it, and bills only while it runs. A persistent cluster costs money while idle, FlexRS is for Beam pipelines, and VMs mean managing everything yourself.',
          },
        },
        {
          point:
            'Reservations fence off capacity, baselines guarantee it, and assignments decide which projects use which fence.',
          check: {
            type: 'choice',
            prompt:
              'How do you make sure the nightly ETL project always has at least 500 slots available?',
            options: [
              'A reservation with a 500-slot baseline, with the ETL project assigned to it',
              'A custom quota of 500 slots on the ETL project',
              'Running the ETL queries at batch priority every night so they get the slots',
              'A BI Engine reservation sized for the ETL tables',
            ],
            answers: [0],
            why: "Baseline slots are always allocated to that reservation, and the assignment routes the project's jobs there. Quotas cap usage rather than guarantee it, batch priority makes jobs wait, and BI Engine is for dashboards.",
          },
        },
      ],
    },
    {
      slug: 'automation',
      code: '5.2',
      title: 'Designing automation and repeatability',
      mission:
        'Forty pipelines run from cron on one VM, and when one fails, nobody knows. Turn them into repeatable, backfillable DAGs that tell you when they break.',
      concepts: [
        {
          title: 'DAGs and repeatable scheduling',
          body: "- A Composer **DAG** is Python: tasks (operators) plus dependencies («t1 >> t2»). Keep top-level code light (it's parsed constantly).\n- **Idempotent tasks**: rerunning a task for a date overwrites that date's partition («WRITE_TRUNCATE» on «table$20261002» or «MERGE») instead of appending duplicates.\n- Use **execution date templates** («{{ ds }}», «{{ data_interval_start }}») rather than \"now\", so **backfills** and «catchup» process historical intervals correctly.\n- Retries with delay, timeouts, SLAs/alerts on failure callbacks, task pools to limit concurrency against fragile systems.\n- Parameterise with Airflow Variables/Connections (secrets in Secret Manager).\n- Simple SQL-only chains → Dataform workflows or scheduled queries; serverless API chains → Workflows.\n\n> [!trap] Exam traps\n> Tasks that append on every retry, creating duplicates.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'rerun last week's failed loads safely' | Idempotent, date-templated tasks + backfill |",
        },
      ],
      keyPoints: [
        {
          point:
            'A good task can run twice and give the same answer: idempotent, date-templated, retried, and loud when it fails.',
          check: {
            type: 'choice',
            prompt:
              'After a bug fix, your DAG must reprocess the past 30 days. What makes this safe and easy?',
            options: [
              'Tasks keyed on {{ ds }} that overwrite their own date partition, then a backfill over the range',
              'Tasks that use CURRENT_DATE() and append their rows, with the DAG triggered 30 times in a tight loop',
              "Editing the DAG's start date and triggering it by hand once per day",
              'Turning off retries so that each date is processed exactly once',
            ],
            answers: [0],
            why: 'Date-templated, partition-overwriting tasks make every run reproducible, so a backfill simply replays the intervals. CURRENT_DATE() always processes today, and appending creates duplicates on reruns.',
          },
          more: "**Callbacks and alerts:** «on_failure_callback» runs when a task finally fails (after its retries), «on_retry_callback» on each retry, «sla_miss_callback» when it runs too long. To retry a BigQuery step and email only after the retries are used up, use «BigQueryInsertJobOperator» with «retries» set and «email_on_failure=True». BigQueryUpsertTableOperator only creates or updates table metadata; it doesn't run your SQL.",
        },
      ],
    },
    {
      slug: 'workload-organization',
      code: '5.3',
      title: 'Organizing workloads based on business requirements',
      mission:
        "Analysts' ad-hoc queries collide with the morning dashboard rush. Organise BigQuery capacity by what the business needs first.",
      concepts: [
        {
          title: 'Capacity management and query priority',
          body: "- **Editions + reservations** per workload class (see 5.1). Autoscaling covers bursts; baseline covers guaranteed needs.\n- **Interactive vs batch queries**: interactive (default) run as soon as possible and count towards concurrency limits. **Batch** priority queries queue until resources are free (started within 24 h), don't count against the interactive concurrent limit — use for non-urgent reports.\n- Separate projects or reservations for dev/test vs prod so experiments don't starve production.\n- Monitor slot utilisation in the admin resource charts and «INFORMATION_SCHEMA.JOBS_TIMELINE» to size reservations.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'large non-urgent reports shouldn't affect dashboards' | Batch priority queries or a separate reservation |",
        },
      ],
      keyPoints: [
        {
          point:
            'Interactive queries run now; batch queries wait their turn. Reservations and baselines decide who gets slots first.',
          check: {
            type: 'choice',
            prompt: 'Which statement about BigQuery batch-priority queries is true?',
            options: [
              "They wait for idle resources and don't count toward the interactive concurrency limit",
              'They run faster than interactive queries because they get dedicated slots',
              "They're free, because they use only otherwise idle capacity",
              "They can't run in a reservation and always use on-demand slots",
            ],
            answers: [0],
            why: "Batch priority trades start time for not crowding out interactive work. It doesn't change price or speed once running, and batch queries run in reservations like any other job.",
          },
        },
      ],
    },
    {
      slug: 'monitoring',
      code: '5.4',
      title: 'Monitoring and troubleshooting processes',
      mission:
        'Something broke at 3 a.m. and nobody noticed until 9. Build observability so the pipeline tells you first.',
      concepts: [
        {
          title: 'Observability stack',
          body: "- Pub/Sub: «subscription/oldest_unacked_message_age», «num_undelivered_messages» (backlog).\n- Dataflow: system lag, data freshness, watermark age, throughput, worker CPU; job state.\n- BigQuery: slots allocated/used, query execution times, bytes scanned.\n- Bigtable: CPU utilisation (keep below recommended thresholds), latency, storage.\n\n- **Cloud Logging**: logs explorer with filters; **log-based metrics** turn log entries into alertable metrics.\n- **Log sinks** route matching entries: to **BigQuery** (analysis), **Cloud Storage** (archive), **Pub/Sub** (real-time notification to another system), or another log bucket. Sinks can be at project, folder or org level (aggregated sinks with «includeChildren»).\n- **BigQuery admin**: resource charts, «INFORMATION_SCHEMA.JOBS*» for per-user cost, errors and slow queries.\n- **Error Reporting** groups exceptions; **Cloud Trace** for latency in services.\n\n> [!trap] Exam traps\n> Listing logs via API and filtering periodically when the requirement is an instant notification — use a sink to Pub/Sub.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'instant notification when rows are appended to one specific table' | Log sink with an advanced filter (that table, insert job) → Pub/Sub → monitoring tool |\n| 'alert when streaming pipeline falls behind' | Alert on Dataflow system lag / Pub/Sub oldest unacked age |",
        },
        {
          title: 'Errors, billing and quotas',
          body: "- **Quota errors** («quotaExceeded», «rateLimitExceeded»): e.g. too many table update operations, too many concurrent DML statements on a table, load jobs per table per day, API requests per second. Fix by batching (fewer, larger loads), using partitions, Storage Write API, or requesting quota increases; retry with exponential backoff for rate limits.\n- **Resources exceeded** in BigQuery: too much data in one worker (ORDER BY without LIMIT on huge results, skewed joins, huge arrays) — restructure the query.\n- **Permission denied**: check the job's identity (service account) has both data roles and «jobUser» in the project running the job.\n- **Billing surprises**: billing export + «INFORMATION_SCHEMA.JOBS» grouped by user/label; set custom quotas.\n- **Manage workloads**: cancel runaway jobs, move workloads between reservations, view running jobs in the admin panel.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'which user caused the cost spike last week?' | INFORMATION_SCHEMA.JOBS (total_bytes_billed by user_email) or billing export with labels |",
        },
      ],
      keyPoints: [
        {
          point:
            'Metrics to alert on, logs to explain, sinks to route, INFORMATION_SCHEMA to audit BigQuery.',
          check: {
            type: 'match',
            prompt: 'Match each monitoring need to the tool.',
            pairs: [
              [
                'Streaming pipeline falling behind',
                'Dataflow system lag / oldest unacked message age',
              ],
              ['Turn a log pattern into an alertable number', 'Log-based metric'],
              ['Send matching log entries to another system in real time', 'Log sink to Pub/Sub'],
              ['Find the most expensive queries by user', 'INFORMATION_SCHEMA.JOBS'],
            ],
            why: "Lag and backlog metrics show a falling-behind pipeline. Log-based metrics make logs alertable. Sinks route logs to Pub/Sub, BigQuery or Cloud Storage. INFORMATION_SCHEMA.JOBS holds every job's bytes, slots and user.",
          },
          more: "**Finding a Dataflow bottleneck when steps are fused:** Dataflow fuses steps into one stage, which hides where the time goes. Insert a «Reshuffle» between key steps to break fusion; the execution graph then shows each step's throughput and backlog.",
        },
        {
          point:
            "Quota errors mean batch or spread the work. 'Resources exceeded' means restructure the query. Permission errors mean check the job's identity.",
          check: {
            type: 'choice',
            prompt:
              "Composer 2 tasks fail with 'worker pod evicted' after memory-heavy tasks were added. Best fix?",
            options: [
              'Give workers more memory and lower worker concurrency, raising max workers if needed',
              'Increase the DAG file parsing interval so that the scheduler and workers use less memory',
              'Give the triggerer more memory so that deferred tasks stop failing',
              "Recreate the environment's bucket to clear out old task logs",
            ],
            answers: [0],
            why: "Evictions are memory pressure on worker pods, so more memory per worker and fewer concurrent tasks per worker addresses the cause. Parsing interval and triggerer memory don't affect task execution memory.",
          },
          more: '**Composer worker pod evictions** mean workers ran out of memory. Give workers more memory and lower worker concurrency (each worker runs fewer tasks at once), raising the maximum number of workers to keep throughput. Environment size scales the Airflow database and web server, not worker memory.',
        },
      ],
    },
    {
      slug: 'failure-mitigation',
      code: '5.5',
      title: 'Maintaining awareness of failures and mitigating impact',
      mission:
        "A region goes dark, a bad UPDATE wipes prices, a partner feed shows up late. Design Cymbal's platform so each of these is a non-event.",
      concepts: [
        {
          title: 'Fault tolerance and restarts',
          body: "- **Retries with exponential backoff and jitter**, capped, for transient failures — never tight retry loops that hammer a recovering service.\n- **Idempotent writes** (MERGE, overwrite partition, upserts by key) so retries don't duplicate.\n- **Checkpointing**: Dataflow checkpoints automatically; Spark Structured Streaming needs a checkpoint location in GCS; CDC/backfill jobs store their last processed position.\n- **Dead-letter queues** isolate poison messages without stopping the pipeline.\n- Pub/Sub retains unacked messages, so a crashed subscriber resumes where it left off.\n\n> [!trap] Exam traps\n> Retry every second until the DB is back (thundering herd).\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'frontend must handle database failure gracefully' | Retry with exponential backoff, capped |",
        },
        {
          title: 'Multi-zone and multi-region execution',
          body: "- Most managed services are **regional** and survive zone failure automatically (BigQuery, Dataflow with automatic zone placement, Pub/Sub, Cloud SQL HA, Spanner, regional Bigtable replication).\n- For a **regional outage**: replicate data cross-region (GCS dual/multi-region, BigQuery cross-region replication, Spanner multi-region, Bigtable multi-cluster, Cloud SQL cross-region replica) and be able to relaunch compute elsewhere (Dataflow job from template/snapshot; Composer environment from code; Dataproc cluster on demand).\n- **Dataproc HA mode** (3 masters) protects the cluster's control plane within a zone/region.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'Bigtable must keep serving if a zone fails' | Replication with multi-cluster routing app profile |",
        },
        {
          title: 'Data corruption, missing data and replication/failover',
          body: "### Corruption and mistakes\n\n- BigQuery **time travel**: «SELECT … FROM t FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)»; restore deleted tables within the window; **table snapshots** for longer retention.\n- GCS **object versioning** / soft delete; Pub/Sub **seek** to replay; keep immutable raw data to rebuild downstream tables.\n\n### Missing or late data\n\n- Streaming: watermarks, allowed lateness, late triggers.\n- Batch: data-arrival sensors before processing; completeness checks (row counts vs expected); **backfills** via Composer catchup or BigQuery DTS backfill runs.\n\n### Replication and failover\n\n- **Cloud SQL**: HA standby fails over automatically within the region (same IP); cross-region read replicas can be promoted for DR; replicas also offload reads.\n- **Memorystore for Redis** Standard tier: replica with automatic failover; **manual failover** to test resilience, with limited-data-loss mode (aborts if more than 30 MB is pending replication) or force-data-loss. Redis Cluster shards and replicates across zones.\n- Test failovers regularly; measure RPO/RTO achieved.\n\n> [!trap] Exam traps\n> Restoring last night's backup when time travel can recover a table to 10 minutes ago.\n\n### Keyword signals\n\n| When the question says | Think |\n|---|---|\n| 'someone ran a bad UPDATE an hour ago' | BigQuery time travel to before the change |\n| 'test how the app behaves when Redis fails over' | Memorystore manual failover |",
        },
      ],
      keyPoints: [
        {
          point:
            'Assume everything fails sometimes: retry with backoff, write idempotently, checkpoint progress, dead-letter poison data.',
          check: {
            type: 'choice',
            prompt:
              'A CDC backfill job crashes halfway through a 2-billion-row table. Which design lets it resume without duplicates?',
            options: [
              "Checkpoint the last committed key, and write with MERGE so reprocessed rows don't duplicate",
              'Restart from the beginning with append writes, then deduplicate the whole target table at the end',
              "Use bigger VMs with more memory so that the job doesn't crash",
              'Turn off retries so that the job never processes a row twice',
            ],
            answers: [0],
            why: "A checkpoint says where to resume, and idempotent MERGE writes make any overlap harmless. Restarting with appends duplicates the first half, and bigger machines don't prevent crashes.",
          },
        },
        {
          point:
            'Regional services ride out zone failures. Region failures need replicated data and a way to relaunch compute somewhere else.',
          check: {
            type: 'choice',
            prompt:
              "Your batch Dataflow job hard-codes «--zone=us-central1-a» and fails whenever that zone is out of capacity. What's the fix?",
            options: [
              'Remove --zone and pass only --region, so Dataflow picks the zone',
              'Retry the job every 5 minutes until the zone has capacity',
              'Run copies of the job in two zones and keep the first result',
              'Switch the job to FlexRS so that it waits for capacity',
            ],
            answers: [0],
            why: "With only a region, Dataflow's automatic zone placement chooses a zone with capacity when the job is submitted. Retries keep hitting the same zone, and duplicate jobs double cost and output.",
          },
          more: "**Zonal failures at submission:** give Dataflow only «--region» (no «--zone») so the service places workers in a healthy zone. **Regional failure for Cloud Storage:** a dual-region bucket with turbo replication gives a 15-minute RPO with no application changes; run compute in one of the bucket's two regions so reads stay local.",
        },
        {
          point:
            'Keep an undo button: time travel, snapshots, versioning, Pub/Sub seek, immutable raw data. Test failover before you need it.',
          check: {
            type: 'choice',
            prompt:
              'During a regional outage, a Cloud SQL for PostgreSQL database must keep serving from another region.',
            options: [
              'Promote a cross-region read replica',
              'Fail over to the HA standby',
              "Restore last night's backup in another region",
              'Add more CPUs to the primary',
            ],
            answers: [0],
            why: "A cross-region replica is already in another region and nearly current, so promoting it is the DR move. The HA standby is in the same region, a backup restore is slower and loses more data, and CPUs don't help when the region is down.",
          },
        },
      ],
    },
  ],
};
