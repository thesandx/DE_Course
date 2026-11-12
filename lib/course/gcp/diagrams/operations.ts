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
      title: 'BigQuery compute pricing',
      from: 'Spiky, small workloads',
      to: 'Heavy, steady workloads',
      stops: [
        { label: 'On-demand', note: 'Per TiB scanned. First 1 TiB a month free.', tone: 'plain' },
        { label: 'Standard edition', note: 'Autoscaling slots only. No commitments.', tone: 'sky' },
        {
          label: 'Enterprise',
          note: 'Baseline slots, 1- and 3-year commitments, BI Engine, BQML.',
          tone: 'iris',
        },
        { label: 'Enterprise Plus', note: 'Adds managed disaster recovery.', tone: 'brand' },
      ],
      caption:
        'A budget alerts; it never stops spend. Custom quotas and «maximum_bytes_billed» are the hard caps.',
    },
    {
      concept: 2,
      kind: 'timeline',
      title: 'What you pay for over one day',
      axis: { start: '00:00', end: '24:00' },
      lanes: [
        {
          label: 'Always-on cluster',
          spans: [{ start: 0, end: 100, label: 'billed all day, mostly idle', tone: 'hard' }],
        },
        {
          label: 'Ephemeral cluster',
          spans: [
            { start: 8, end: 20, label: 'job', tone: 'easy' },
            { start: 58, end: 68, label: 'job', tone: 'easy' },
          ],
        },
        {
          label: 'Dataproc Serverless',
          spans: [
            { start: 9, end: 18, tone: 'brand' },
            { start: 59, end: 66, tone: 'brand' },
          ],
        },
      ],
      caption:
        'Default to job-scoped clusters with data in Cloud Storage; keep a persistent cluster only for constant interactive use. Add Spot secondary workers for cheap compute, and FlexRS for delay-tolerant Dataflow batch.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'Guarantee slots for the jobs that matter',
      steps: [{ label: 'Slot commitment', note: 'Bought for the organisation.', tone: 'gold' }],
      fork: {
        label: 'split into reservations, each with assignments',
        boxes: [
          {
            label: 'prod-etl',
            note: 'High baseline. Always has capacity.',
            tone: 'brand',
            chips: ['QUERY', 'PIPELINE'],
          },
          { label: 'bi', note: 'Dashboards. Medium baseline.', tone: 'iris', chips: ['QUERY'] },
          {
            label: 'ad-hoc',
            note: 'Zero baseline; borrows idle slots.',
            tone: 'plain',
            chips: ['QUERY'],
          },
        ],
      },
      caption:
        'Idle slot sharing lets unused baseline slots flow to other reservations. For Dataflow and Dataproc, check regional CPU and IP quotas before the peak.',
    },
  ],
  automation: [
    {
      concept: 1,
      kind: 'flow',
      title: 'An idempotent daily DAG',
      steps: [
        { label: 'Wait for the file', tone: 'plain', chips: ['GCSObjectExistenceSensor'] },
        { label: 'Transform', note: 'Dataflow template for «{{ ds }}».', tone: 'iris' },
        {
          label: 'Load the partition',
          note: 'Overwrite that day only.',
          tone: 'brand',
          chips: ['WRITE_TRUNCATE', 'table$YYYYMMDD'],
        },
        { label: 'Check quality', note: 'Row counts, assertions.', tone: 'easy' },
      ],
      edges: ['>>', '>>', '>>'],
      caption:
        'Every task uses the run date, never "now", so a retry or a catchup backfill rewrites the same partition instead of appending duplicates.',
    },
  ],
  'workload-organization': [
    {
      concept: 1,
      kind: 'compare',
      title: 'Interactive or batch priority',
      columns: [
        {
          label: 'Interactive (default)',
          tone: 'brand',
          points: [
            'Runs as soon as possible.',
            'Counts toward the concurrency limit.',
            'For people waiting on an answer.',
          ],
        },
        {
          label: 'Batch',
          tone: 'sky',
          points: [
            'Queues until slots are free (starts within 24 h).',
            'Does not count toward the interactive limit.',
            'For reports nobody is waiting on.',
          ],
        },
      ],
      caption:
        'Put dev and prod in separate projects or reservations so experiments never starve production. Size reservations from «INFORMATION_SCHEMA.JOBS_TIMELINE».',
    },
  ],
  monitoring: [
    {
      concept: 1,
      kind: 'hub',
      title: 'The metric to watch per service',
      center: { label: 'Cloud Monitoring', note: 'Dashboards and alerts.' },
      spokes: [
        {
          label: 'Pub/Sub',
          note: 'Backlog and its age.',
          tone: 'iris',
          chips: ['oldest_unacked_message_age'],
        },
        {
          label: 'Dataflow',
          note: 'System lag, data freshness, watermark age.',
          tone: 'brand',
        },
        { label: 'BigQuery', note: 'Slots used, run time, bytes scanned.', tone: 'sky' },
        { label: 'Bigtable', note: 'CPU below the recommended limit.', tone: 'teal' },
      ],
      caption:
        'A growing unacked age means subscribers cannot keep up; a growing system lag means Dataflow cannot.',
    },
    {
      concept: 1,
      kind: 'flow',
      title: 'Route logs with a sink',
      steps: [
        { label: 'Services', note: 'Project, folder or org.', tone: 'plain' },
        {
          label: 'Cloud Logging',
          note: 'Log-based metrics turn entries into alerts.',
          tone: 'iris',
        },
        { label: 'Log sink', note: 'A filter picks the entries.', tone: 'brand' },
      ],
      fork: {
        label: 'to a destination',
        boxes: [
          { label: 'BigQuery', note: 'Analyse.', tone: 'sky' },
          { label: 'Cloud Storage', note: 'Archive.', tone: 'gold' },
          { label: 'Pub/Sub', note: 'Notify another system now.', tone: 'brand' },
          { label: 'Log bucket', note: 'Central log store.', tone: 'plain' },
        ],
      },
      caption:
        'For an instant notification, sink to Pub/Sub; do not poll the logs API. An aggregated sink with «includeChildren» covers a whole folder or org.',
    },
    {
      concept: 2,
      kind: 'decision',
      title: 'Read the error, pick the fix',
      questions: [
        {
          ask: '«quotaExceeded» or «rateLimitExceeded»?',
          yes: {
            label: 'Batch and back off',
            note: 'Fewer, larger loads; Storage Write API; exponential backoff; ask for quota.',
            tone: 'gold',
          },
        },
        {
          ask: '«Resources exceeded» in BigQuery?',
          yes: {
            label: 'Restructure the query',
            note: 'Too much on one worker: ORDER BY with no LIMIT, skew, huge arrays.',
            tone: 'iris',
          },
        },
        {
          ask: '«Permission denied» on a job?',
          yes: {
            label: 'Check the job identity',
            note: 'It needs data roles and «jobUser» in the running project.',
            tone: 'sky',
          },
        },
      ],
      otherwise: {
        label: 'A surprise on the bill?',
        note: 'Billing export + INFORMATION_SCHEMA.JOBS by user and label, then custom quotas.',
        tone: 'brand',
      },
      caption: 'Cancel runaway jobs or move them to another reservation from the admin panel.',
    },
  ],
  'failure-mitigation': [
    {
      concept: 1,
      kind: 'timeline',
      title: 'Retry like this, not like that',
      axis: { start: 'failure', end: '30 s later' },
      lanes: [
        {
          label: 'Tight loop',
          dots: [5, 12, 18, 25, 32, 38, 45, 52, 58, 65, 72, 78, 85, 92].map((at) => ({
            at,
            tone: 'hard' as const,
          })),
        },
        {
          label: 'Backoff + jitter',
          dots: [
            { at: 4, tone: 'easy' },
            { at: 9, tone: 'easy' },
            { at: 19, tone: 'easy' },
            { at: 41, tone: 'easy' },
            { at: 86, tone: 'easy' },
          ],
        },
      ],
      caption:
        'A tight loop hammers a service that is trying to recover (a thundering herd). Double the wait each time, add jitter and a cap, and make the write idempotent so a retry never duplicates.',
    },
    {
      concept: 2,
      kind: 'compare',
      title: 'A zone fails, or a region fails',
      columns: [
        {
          label: 'Zone outage',
          note: 'Regional services handle it for you.',
          tone: 'easy',
          points: [
            'BigQuery, Pub/Sub, Dataflow placement.',
            'Cloud SQL HA standby fails over.',
            'Dataproc HA mode: 3 masters.',
          ],
        },
        {
          label: 'Region outage',
          note: 'You must plan for it.',
          tone: 'hard',
          points: [
            'Replicate data: dual/multi-region buckets, BigQuery replication, Spanner multi-region.',
            'Relaunch compute elsewhere: Dataflow from a template or snapshot.',
            'Composer and Dataproc rebuilt from code.',
          ],
        },
      ],
      caption:
        'Most managed services survive a zone failure by themselves. A region failure needs cross-region data and a way to restart compute.',
    },
    {
      concept: 3,
      kind: 'decision',
      title: 'Something broke: how to get it back',
      questions: [
        {
          ask: 'A bad write or a dropped table in the last 7 days?',
          yes: {
            label: 'BigQuery time travel',
            note: '«FOR SYSTEM_TIME AS OF»',
            tone: 'easy',
          },
        },
        {
          ask: 'You need a point older than that?',
          yes: { label: 'Table snapshots', note: 'Take them on a schedule.', tone: 'sky' },
        },
        {
          ask: 'An object deleted or overwritten?',
          yes: { label: 'Versioning or soft delete', tone: 'gold' },
        },
        {
          ask: 'A bad deploy processed messages wrong?',
          yes: { label: 'Pub/Sub seek', note: 'Replay from a snapshot or time.', tone: 'iris' },
        },
      ],
      otherwise: {
        label: 'Rebuild from immutable raw data',
        note: 'Or backfill with Composer catchup or a DTS backfill.',
        tone: 'brand',
      },
      caption:
        'Test failovers on a schedule and measure the RPO and RTO you really get. Cloud SQL HA keeps the same IP; a cross-region replica is promoted by hand.',
    },
  ],
};
