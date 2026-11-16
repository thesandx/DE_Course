/**
 * Diagrams for line 5: Maintaining and automating data workloads. Keyed by
 * station slug; each diagram names the concept it explains. See
 * lib/course/gcp/README.md > Diagrams.
 */

import type { GcpDiagram } from '@/types/gcp';

export const DIAGRAMS: Readonly<Record<string, readonly GcpDiagram[]>> = {
  'resource-optimization': [
    {
      concept: 1,
      kind: 'spectrum',
      title: 'Pick a BigQuery pricing model by workload',
      scenario:
        'Cymbal has two kinds of BigQuery users: analysts who run a few queries a day, and ETL jobs that run all night. One pricing model does not fit both. Move right as the workload grows and becomes steady.',
      from: 'Spiky, small workloads',
      to: 'Heavy, steady workloads',
      stops: [
        {
          n: 1,
          icon: 'dollar',
          label: 'On-demand',
          note: 'You pay per TiB that a query scans. The first 1 TiB each month is free.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'bigquery',
          label: 'Standard edition',
          note: 'You pay for slots that autoscale. No commitments.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'bigquery',
          label: 'Enterprise',
          note: 'Baseline slots, 1-year and 3-year commitments, BI Engine and BQML.',
          tone: 'iris',
        },
        {
          n: 4,
          icon: 'bigquery',
          label: 'Enterprise Plus',
          note: 'Adds managed disaster recovery across regions.',
          tone: 'brand',
        },
      ],
      walk: [
        'On-demand is best when queries are few and irregular. A careless SELECT * on a big table costs real money.',
        'Standard edition charges for compute time, not bytes. Slots scale up and down with the load.',
        'Enterprise lets you commit to slots for a discount and keep a baseline that is always ready.',
        'Enterprise Plus is for regulated workloads that need a managed failover to another region.',
      ],
      caption:
        'A budget only sends alerts; it never stops spend. Custom quotas and «maximum_bytes_billed» are the hard caps.',
    },
    {
      concept: 2,
      kind: 'timeline',
      title: 'What you pay for over one day',
      scenario:
        'Cymbal runs two Spark jobs a day: one in the morning and one in the afternoon. Compare three ways to run them. The coloured stretch is the time you are billed.',
      axis: { start: '00:00', end: '24:00' },
      lanes: [
        {
          label: '1. Always-on cluster',
          spans: [{ start: 0, end: 100, label: 'billed all day', tone: 'hard' }],
        },
        {
          label: '2. Ephemeral cluster',
          spans: [
            { start: 8, end: 20, label: 'job', tone: 'easy' },
            { start: 58, end: 68, label: 'job', tone: 'easy' },
          ],
        },
        {
          label: '3. Serverless',
          spans: [
            { start: 9, end: 18, tone: 'brand' },
            { start: 59, end: 66, tone: 'brand' },
          ],
        },
      ],
      walk: [
        'A cluster that stays on bills every hour, even when it is idle between the two jobs.',
        'An ephemeral cluster is created for the job and deleted after it. Data stays in Cloud Storage, so nothing is lost.',
        'Dataproc Serverless runs only the job itself. There is no cluster to create, tune or delete.',
      ],
      caption:
        'Default to job-scoped clusters with data in Cloud Storage. Keep a persistent cluster only for constant interactive use. Add Spot secondary workers for cheap compute, and FlexRS for Dataflow batch that can wait.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'Guarantee slots for the jobs that matter',
      scenario:
        'At Cymbal, an analyst runs a huge ad-hoc query at 2 AM and the nightly ETL misses its deadline. Reservations split the bought slots so that production always has capacity.',
      steps: [
        {
          n: 1,
          icon: 'dollar',
          label: 'Slot commitment',
          note: 'Slots that the organisation buys for 1 or 3 years.',
          tone: 'gold',
        },
      ],
      fork: {
        label: 'step 2: split into reservations, each assigned to projects',
        boxes: [
          {
            icon: 'workflows',
            label: 'prod-etl',
            note: 'High baseline. The nightly pipelines always have capacity.',
            tone: 'brand',
            chips: ['QUERY', 'PIPELINE'],
          },
          {
            icon: 'looker-studio',
            label: 'bi',
            note: 'Medium baseline for the dashboards.',
            tone: 'iris',
            chips: ['QUERY'],
          },
          {
            icon: 'users',
            label: 'ad-hoc',
            note: 'Zero baseline. It borrows slots that others leave idle.',
            tone: 'plain',
            chips: ['QUERY'],
          },
        ],
      },
      walk: [
        'The organisation buys a pool of slots with a commitment.',
        'An admin splits the pool into reservations and assigns projects to each one. A big ad-hoc query now cannot take the ETL slots.',
      ],
      caption:
        'Idle slot sharing lets unused baseline slots flow to other reservations. For Dataflow and Dataproc, check the regional CPU and IP quotas before the peak.',
    },
  ],
  automation: [
    {
      concept: 1,
      kind: 'flow',
      title: 'An idempotent daily DAG in Cloud Composer',
      scenario:
        'Every night a partner drops a sales file in Cloud Storage. A Cloud Composer DAG loads it into BigQuery. If a task fails and retries, or you backfill last week, the table must not get duplicate rows.',
      steps: [
        {
          n: 1,
          icon: 'cloud-storage',
          label: 'Wait for the file',
          note: 'A sensor waits until the file for the run date exists.',
          tone: 'plain',
          chips: ['GCSObjectExistenceSensor'],
        },
        {
          n: 2,
          icon: 'dataflow',
          label: 'Transform',
          note: 'A Dataflow template cleans the file for «{{ ds }}».',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'bigquery',
          label: 'Load the partition',
          note: 'Overwrite that one day only.',
          tone: 'brand',
          chips: ['WRITE_TRUNCATE', 'table$YYYYMMDD'],
        },
        {
          n: 4,
          icon: 'shield',
          label: 'Check quality',
          note: 'Row counts and assertions stop bad data.',
          tone: 'easy',
        },
      ],
      edges: ['then', 'then', 'then'],
      walk: [
        'The sensor waits for the file of the run date, not for "the newest file".',
        'Dataflow processes only that date, passed in by the template «{{ ds }}».',
        'The load replaces the partition of that date. A second run gives the same result, not twice the rows.',
        'A quality check fails the DAG run before bad numbers reach a dashboard.',
      ],
      caption:
        'Every task uses the run date, never "now". A retry or a catchup backfill then rewrites the same partition instead of appending duplicates.',
    },
  ],
  'workload-organization': [
    {
      concept: 1,
      kind: 'compare',
      title: 'Interactive or batch priority',
      scenario:
        'Cymbal analysts wait for answers on screen, while a monthly report job can finish any time before morning. BigQuery lets each query say how urgent it is.',
      columns: [
        {
          n: 1,
          icon: 'user',
          label: 'Interactive (default)',
          note: 'Someone is waiting.',
          tone: 'brand',
          points: [
            'Runs as soon as possible.',
            'Counts toward the concurrency limit.',
            'For people waiting on an answer.',
          ],
        },
        {
          n: 2,
          icon: 'clock',
          label: 'Batch',
          note: 'Nobody is waiting.',
          tone: 'sky',
          points: [
            'Queues until slots are free (starts within 24 h).',
            'Does not count toward the interactive limit.',
            'For reports nobody is waiting on.',
          ],
        },
      ],
      walk: [
        'Interactive queries start at once. Too many at the same time hit the concurrency limit and queue.',
        'Batch queries wait for idle slots, so they never push an analyst out of the way.',
      ],
      caption:
        'Put dev and prod in separate projects or reservations so experiments never starve production. Size reservations from «INFORMATION_SCHEMA.JOBS_TIMELINE».',
    },
  ],
  monitoring: [
    {
      concept: 1,
      kind: 'hub',
      title: 'The one metric to watch per service',
      scenario:
        'Cymbal has a streaming pipeline: Pub/Sub, then Dataflow, then BigQuery and Bigtable. When data arrives late, one metric per service tells you where it is stuck.',
      center: {
        icon: 'monitoring',
        label: 'Cloud Monitoring',
        note: 'Collects the metrics, draws dashboards and sends alerts.',
      },
      spokes: [
        {
          n: 1,
          icon: 'pubsub',
          label: 'Pub/Sub',
          note: 'The age of the oldest message nobody has acknowledged.',
          tone: 'iris',
          chips: ['oldest_unacked_message_age'],
        },
        {
          n: 2,
          icon: 'dataflow',
          label: 'Dataflow',
          note: 'System lag, data freshness and watermark age.',
          tone: 'brand',
        },
        {
          n: 3,
          icon: 'bigquery',
          label: 'BigQuery',
          note: 'Slots used, run time and bytes scanned.',
          tone: 'sky',
        },
        {
          n: 4,
          icon: 'bigtable',
          label: 'Bigtable',
          note: 'CPU use, kept below the recommended limit.',
          tone: 'teal',
        },
      ],
      walk: [
        'If the oldest unacked message gets older, the subscribers cannot keep up with the topic.',
        'If system lag grows, Dataflow itself is the slow part. Look at its workers and its hot keys.',
        'If BigQuery slot use is at the limit, queries queue. Look at the reservation.',
        'If Bigtable CPU is above the limit, latency rises. Add nodes or fix a hot row key.',
      ],
      caption:
        'A growing unacked age means the subscribers cannot keep up. A growing system lag means Dataflow cannot.',
    },
    {
      concept: 1,
      kind: 'flow',
      title: 'Route logs to where you need them with a sink',
      scenario:
        'Cymbal must keep audit logs for 5 years, analyse job errors in SQL, and page someone the moment a job fails. One log stream goes to several places.',
      steps: [
        {
          n: 1,
          icon: 'server',
          label: 'Services',
          note: 'Every project, folder or organisation writes logs.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'logging',
          label: 'Cloud Logging',
          note: 'Receives every entry. Log-based metrics turn entries into alerts.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'logging',
          label: 'Log sink',
          note: 'A filter picks the entries to copy.',
          tone: 'brand',
        },
      ],
      fork: {
        label: 'step 4: the destination',
        boxes: [
          { icon: 'bigquery', label: 'BigQuery', note: 'Analyse logs with SQL.', tone: 'sky' },
          {
            icon: 'cloud-storage',
            label: 'Cloud Storage',
            note: 'Cheap archive for years.',
            tone: 'gold',
          },
          {
            icon: 'pubsub',
            label: 'Pub/Sub',
            note: 'Notify another system at once.',
            tone: 'brand',
          },
          {
            icon: 'layers',
            label: 'Log bucket',
            note: 'A central log store for many projects.',
            tone: 'plain',
          },
        ],
      },
      walk: [
        'Each service writes logs to its own project.',
        'Cloud Logging receives the logs. A log-based metric can count errors and fire an alert.',
        'A sink copies only the entries that match its filter.',
        'Pick the destination by the job: SQL analysis, a long archive, an instant notification, or a central store.',
      ],
      caption:
        'For an instant notification, sink to Pub/Sub; do not poll the logs API. An aggregated sink with «includeChildren» covers a whole folder or organisation.',
    },
    {
      concept: 2,
      kind: 'decision',
      title: 'Read the error, pick the fix',
      scenario:
        'A Cymbal pipeline fails at night and the on-call engineer opens the error. The text of the error points straight at the fix. Read the questions in order.',
      questions: [
        {
          ask: 'Does it say «quotaExceeded» or «rateLimitExceeded»?',
          yes: {
            icon: 'quotas',
            label: 'Batch and back off',
            note: 'Fewer, larger loads; the Storage Write API; exponential backoff; or ask for more quota.',
            tone: 'gold',
          },
        },
        {
          ask: 'Does BigQuery say «Resources exceeded»?',
          yes: {
            icon: 'bigquery',
            label: 'Restructure the query',
            note: 'Too much work landed on one worker: ORDER BY with no LIMIT, skew, huge arrays.',
            tone: 'iris',
          },
        },
        {
          ask: 'Does a job say «Permission denied»?',
          yes: {
            icon: 'iam',
            label: 'Check the job identity',
            note: 'It needs data roles and «jobUser» in the project that runs the job.',
            tone: 'sky',
          },
        },
      ],
      otherwise: {
        icon: 'billing',
        label: 'A surprise on the bill?',
        note: 'Billing export and INFORMATION_SCHEMA.JOBS by user and label, then custom quotas.',
        tone: 'brand',
      },
      walk: [
        'A quota or rate error means too many small calls. Make fewer, larger ones and retry with backoff.',
        'Resources exceeded means one worker got too much. Change the query shape; more slots do not help.',
        'Permission denied on a job is about the identity that runs it, not about the person who wrote it.',
        'For cost, find who and what spent the money first, then put a cap on it.',
      ],
      caption: 'Cancel runaway jobs, or move them to another reservation, from the admin panel.',
    },
  ],
  'failure-mitigation': [
    {
      concept: 1,
      kind: 'timeline',
      title: 'Retry like this, not like that',
      scenario:
        'An API that a Cymbal pipeline calls goes down for a few seconds. Thousands of workers retry. How they retry decides whether the API can come back up.',
      axis: { start: 'failure', end: '30 s later' },
      lanes: [
        {
          label: '1. Tight loop',
          dots: [5, 12, 18, 25, 32, 38, 45, 52, 58, 65, 72, 78, 85, 92].map((at) => ({
            at,
            tone: 'hard' as const,
          })),
        },
        {
          label: '2. Backoff + jitter',
          dots: [
            { at: 4, tone: 'easy' },
            { at: 9, tone: 'easy' },
            { at: 19, tone: 'easy' },
            { at: 41, tone: 'easy' },
            { at: 86, tone: 'easy' },
          ],
        },
      ],
      walk: [
        'A tight loop retries again and again. Every worker does the same, and the flood keeps the API down.',
        'Exponential backoff doubles the wait after each failure. Jitter adds a random part, so workers do not retry at the same moment.',
      ],
      caption:
        'A tight loop hammers a service that is trying to recover (a thundering herd). Double the wait each time, add jitter and a cap, and make the write idempotent so a retry never duplicates.',
    },
    {
      concept: 2,
      kind: 'compare',
      title: 'A zone fails, or a region fails',
      scenario:
        'A region has three or more zones. Losing one zone happens; losing a whole region is rare but possible. Cymbal must know which failure is handled for it and which it must plan for.',
      columns: [
        {
          n: 1,
          icon: 'cloud',
          label: 'Zone outage',
          note: 'Regional services handle it for you.',
          tone: 'easy',
          points: [
            'BigQuery, Pub/Sub and Dataflow move work to healthy zones.',
            'A Cloud SQL HA standby takes over.',
            'Dataproc HA mode runs 3 masters.',
          ],
        },
        {
          n: 2,
          icon: 'globe',
          label: 'Region outage',
          note: 'You must plan for it.',
          tone: 'hard',
          points: [
            'Replicate data: dual-region or multi-region buckets, BigQuery replication, Spanner multi-region.',
            'Restart compute elsewhere: Dataflow from a template or a snapshot.',
            'Rebuild Composer and Dataproc from code.',
          ],
        },
      ],
      walk: [
        'In a zone outage, regional services keep running from the other zones. You do almost nothing.',
        'In a region outage, only data you copied to another region survives. You restart the compute there.',
      ],
      caption:
        'Most managed services survive a zone failure by themselves. A region failure needs cross-region data and a way to restart compute.',
    },
    {
      concept: 3,
      kind: 'decision',
      title: 'Something broke: how to get it back',
      scenario:
        'A bad deploy at Cymbal wrote wrong rows, deleted a file and processed messages wrongly. Each kind of damage has its own undo button. Read the questions in order.',
      questions: [
        {
          ask: 'A bad write or a dropped table in the last 7 days?',
          yes: {
            icon: 'bigquery',
            label: 'BigQuery time travel',
            note: 'Read the table as it was with «FOR SYSTEM_TIME AS OF».',
            tone: 'easy',
          },
        },
        {
          ask: 'You need a point older than that?',
          yes: {
            icon: 'clock',
            label: 'Table snapshots',
            note: 'Take them on a schedule, before you need them.',
            tone: 'sky',
          },
        },
        {
          ask: 'An object in a bucket deleted or overwritten?',
          yes: {
            icon: 'cloud-storage',
            label: 'Versioning or soft delete',
            note: 'Restore the older version of the object.',
            tone: 'gold',
          },
        },
        {
          ask: 'A bad deploy processed messages wrongly?',
          yes: {
            icon: 'pubsub',
            label: 'Pub/Sub seek',
            note: 'Replay from a snapshot or a time.',
            tone: 'iris',
          },
        },
      ],
      otherwise: {
        icon: 'refresh',
        label: 'Rebuild from immutable raw data',
        note: 'Or backfill with Composer catchup or a DTS backfill.',
        tone: 'brand',
      },
      walk: [
        'BigQuery keeps 7 days of history for every table. Query the old state and write it back.',
        'For older points, you need a table snapshot that you took earlier.',
        'Cloud Storage keeps old versions only when versioning or soft delete is on.',
        'Pub/Sub can rewind a subscription, so the fixed code reads the messages again.',
        'When nothing else helps, raw data that you never change lets you rebuild everything.',
      ],
      caption:
        'Test failovers on a schedule and measure the RPO and RTO you really get. Cloud SQL HA keeps the same IP; a cross-region replica is promoted by hand.',
    },
  ],
};
