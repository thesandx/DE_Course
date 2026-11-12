/**
 * Diagrams for line 2: Ingesting and processing the data. Keyed by station
 * slug; each diagram names the concept it explains. See
 * lib/course/gcp/README.md > Diagrams.
 */

import type { GcpDiagram } from '@/types/gcp';

export const DIAGRAMS: Readonly<Record<string, readonly GcpDiagram[]>> = {
  'pipeline-planning': [
    {
      concept: 1,
      kind: 'flow',
      title: 'The canonical streaming path',
      steps: [
        { label: 'Producers', note: 'Apps, devices, services.', tone: 'plain' },
        { label: 'Pub/Sub', note: 'Buffers and fans out.', tone: 'iris' },
        { label: 'Dataflow', note: 'Parse, window, enrich.', tone: 'brand' },
      ],
      edges: ['publish', 'pull'],
      fork: {
        label: 'writes to',
        boxes: [
          { label: 'BigQuery', note: 'Analytics.', tone: 'sky' },
          { label: 'Bigtable', note: 'Millisecond serving.', tone: 'teal' },
          { label: 'Cloud Storage', note: 'Raw archive for backfills.', tone: 'gold' },
        ],
      },
      caption:
        'Never write devices straight into BigQuery: buffer through Pub/Sub. For a database, the CDC path is **database → Datastream → BigQuery**. ELT (load raw, then SQL) is the default for analytics.',
    },
    {
      concept: 1,
      kind: 'compare',
      title: 'ETL or ELT',
      columns: [
        {
          label: 'ETL',
          note: 'Transform, then load.',
          tone: 'iris',
          points: [
            'Clean in the pipeline before the warehouse.',
            'Fits streaming, PII removal in flight, heavy logic.',
            'The raw data is gone unless you archive it.',
          ],
          chips: ['Dataflow', 'Data Fusion', 'Spark'],
        },
        {
          label: 'ELT',
          note: 'Load raw, then transform with SQL.',
          tone: 'teal',
          points: [
            'Land raw data unchanged in BigQuery or a bucket.',
            'Build curated layers with SQL.',
            'Raw copies make backfills and bug fixes possible.',
          ],
          chips: ['BigQuery', 'Dataform'],
        },
      ],
      caption:
        'ELT is the default for analytics on Google Cloud: cheaper to build, and you keep the raw data.',
    },
    {
      concept: 2,
      kind: 'hub',
      title: 'How private workers reach everything',
      center: {
        label: 'Dataflow / Dataproc workers',
        note: 'In a regional subnet, with no external IP.',
      },
      spokes: [
        { label: 'Google APIs', note: 'Private Google Access on the subnet.', tone: 'teal' },
        { label: 'The internet', note: 'Cloud NAT, for pip installs.', tone: 'gold' },
        {
          label: 'Other workers',
          note: 'Firewall on TCP 12345 (stream) and 12346 (batch).',
          tone: 'hard',
        },
        { label: 'On-prem sources', note: 'Cloud VPN or Interconnect.', tone: 'iris' },
        { label: 'Cloud SQL', note: 'Private IP or the Auth Proxy.', tone: 'sky' },
        {
          label: 'Shared VPC host',
          note: 'Owns the network; pass the full subnet URL.',
          tone: 'plain',
        },
      ],
      caption:
        'A Dataflow job that hangs with "workers cannot communicate" is missing the firewall rule for 12345 and 12346. The VPC is global; subnets are regional.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'Keys along the pipeline',
      steps: [
        { label: 'Source', tone: 'plain' },
        { label: 'Pub/Sub topic', note: 'CMEK on the topic.', tone: 'iris', chips: ['CMEK'] },
        {
          label: 'Dataflow',
          note: 'CMEK on state and shuffle; tokenise PII with SDP.',
          tone: 'brand',
          chips: ['--dataflowKmsKey', 'SDP'],
        },
        { label: 'BigQuery / bucket', note: 'CMEK on the sink.', tone: 'teal', chips: ['CMEK'] },
      ],
      edges: ['TLS', 'TLS', 'TLS'],
      caption:
        'In transit is automatic (TLS). At rest, set a customer-managed key at every hop, and tokenise fields before the sink when readers must not see raw PII.',
    },
  ],
  'building-pipelines': [
    {
      concept: 1,
      kind: 'flow',
      title: 'One topic, a copy for every subscription',
      steps: [
        { label: 'Publishers', note: 'Ordering key optional.', tone: 'plain' },
        { label: 'Topic', note: 'Retention up to 31 days.', tone: 'iris' },
      ],
      edges: ['publish'],
      fork: {
        label: 'every subscription gets every message',
        boxes: [
          { label: 'Pull', note: 'Dataflow. Highest throughput.', tone: 'brand' },
          { label: 'Push', note: 'POST to Cloud Run; a 2xx is the ack.', tone: 'gold' },
          { label: 'BigQuery subscription', note: 'Straight into a table, no code.', tone: 'sky' },
          { label: 'Cloud Storage subscription', note: 'Batches into files.', tone: 'teal' },
        ],
      },
      caption:
        'Copying messages unchanged into BigQuery needs no Dataflow: use a BigQuery subscription. After N failed deliveries a dead-letter topic takes the message.',
    },
    {
      concept: 1,
      kind: 'timeline',
      title: 'Where duplicates come from',
      axis: { start: '0 s', end: '25 s' },
      marks: [{ at: 40, label: 'ack deadline 10 s' }],
      lanes: [
        {
          label: 'Acked in time',
          spans: [{ start: 2, end: 30, label: 'ack', tone: 'easy' }],
          dots: [{ at: 2, tone: 'iris' }],
        },
        {
          label: 'Too slow',
          spans: [
            { start: 2, end: 40, label: 'working', tone: 'medium' },
            { start: 44, end: 80, label: 'redelivered', tone: 'hard' },
          ],
          dots: [
            { at: 2, tone: 'iris' },
            { at: 44, tone: 'hard' },
          ],
        },
      ],
      caption:
        'Delivery is at-least-once. A subscriber that misses the ack deadline gets the message again, so slow push endpoints flood you with duplicates. Extend the deadline or enable exactly-once on a pull subscription.',
    },
    {
      concept: 2,
      kind: 'flow',
      title: 'A Beam pipeline with a dead-letter output',
      steps: [
        {
          label: 'Read',
          note: 'A PCollection, bounded or not.',
          tone: 'iris',
          chips: ['ReadFromPubSub'],
        },
        {
          label: 'ParDo (DoFn)',
          note: 'Parse each element. A small lookup comes in as a side input.',
          tone: 'brand',
          chips: ['side input'],
        },
      ],
      edges: ['PCollection'],
      fork: {
        label: 'tagged outputs',
        boxes: [
          {
            label: 'main → Combine.perKey → BigQueryIO',
            note: 'Combine pre-aggregates on each worker.',
            tone: 'easy',
          },
          {
            label: 'dead-letter → error table',
            note: 'Bad elements kept, job keeps running.',
            tone: 'hard',
          },
        ],
      },
      caption:
        'Prefer Combine to GroupByKey + sum: it pre-aggregates and scales. A side input must fit in worker memory; a big lookup needs CoGroupByKey or a key-value store.',
    },
    {
      concept: 3,
      kind: 'timeline',
      title: 'The four window types',
      axis: { start: 'event time 0', end: '60 min' },
      lanes: [
        {
          label: 'Fixed (tumbling)',
          spans: [
            { start: 0, end: 25, label: '0–15', tone: 'sky' },
            { start: 25, end: 50, label: '15–30', tone: 'teal' },
            { start: 50, end: 75, label: '30–45', tone: 'sky' },
            { start: 75, end: 100, label: '45–60', tone: 'teal' },
          ],
        },
        {
          label: 'Sliding (hopping)',
          spans: [
            { start: 0, end: 50, label: '30 min', tone: 'iris', row: 0 },
            { start: 25, end: 75, label: 'every 15', tone: 'brand', row: 1 },
            { start: 50, end: 100, label: '30 min', tone: 'iris', row: 0 },
          ],
        },
        {
          label: 'Session (per key)',
          spans: [
            { start: 2, end: 30, tone: 'gold' },
            { start: 55, end: 72, tone: 'gold' },
          ],
          dots: [
            { at: 5, tone: 'gold' },
            { at: 14, tone: 'gold' },
            { at: 27, tone: 'gold' },
            { at: 58, tone: 'gold' },
            { at: 69, tone: 'gold' },
          ],
        },
        { label: 'Global', spans: [{ start: 0, end: 100, label: 'one window', tone: 'plain' }] },
      ],
      caption:
        '"No activity for 60 minutes" is a **session** window with a 60-minute gap, not a fixed one. A global window needs a custom trigger to emit anything on a stream.',
    },
    {
      concept: 3,
      kind: 'timeline',
      title: 'Watermark, late data and triggers',
      axis: { start: 'processing time', end: 'later' },
      marks: [{ at: 55, label: 'watermark passes 12:05' }],
      lanes: [
        {
          label: 'Data for 12:00–12:05',
          spans: [
            { start: 5, end: 50, label: 'on time', tone: 'easy' },
            { start: 55, end: 80, label: 'late ok', tone: 'medium' },
            { start: 80, end: 100, label: 'dropped', tone: 'hard' },
          ],
        },
        {
          label: 'Firings',
          dots: [
            { at: 20, tone: 'plain' },
            { at: 35, tone: 'plain' },
            { at: 55, tone: 'brand' },
            { at: 70, tone: 'gold' },
          ],
        },
      ],
      caption:
        'Grey dots are early (speculative) firings, the pink dot is the on-time firing at the watermark, the gold dot is a late firing when late data arrives. After the allowed lateness, data is dropped.',
    },
    {
      concept: 4,
      kind: 'decision',
      title: 'Changing a running streaming job',
      questions: [
        {
          ask: 'Is the new pipeline graph compatible with the old one?',
          yes: {
            label: 'Update in place',
            note: '«--update», same job name. State is kept.',
            tone: 'easy',
          },
        },
        {
          ask: 'Must every in-flight record finish?',
          yes: {
            label: 'Drain, then launch the new job',
            note: 'Stops reading, finishes what it has. No loss.',
            tone: 'sky',
          },
        },
      ],
      otherwise: {
        label: 'Cancel',
        note: 'Stops now. In-flight data is lost.',
        tone: 'hard',
      },
      caption:
        'Never cancel to deploy when no data may be lost. A snapshot lets you start the new job from saved state.',
    },
    {
      concept: 5,
      kind: 'flow',
      title: 'The ephemeral cluster pattern',
      steps: [
        { label: 'Create cluster', note: 'Ready in about 90 s.', tone: 'sky' },
        {
          label: 'Run the job',
          note: 'Reads and writes Cloud Storage. Spot secondary workers add cheap compute.',
          tone: 'brand',
          chips: ['gs://', 'Metastore'],
        },
        { label: 'Delete cluster', note: 'Nothing idles; billed per second.', tone: 'easy' },
      ],
      caption:
        'Data lives in Cloud Storage and metadata in Dataproc Metastore, so the cluster is disposable. Workflow templates do all three steps for you; Dataproc Serverless skips the cluster.',
    },
    {
      concept: 6,
      kind: 'decision',
      title: 'How to load into BigQuery',
      questions: [
        {
          ask: 'Files in Cloud Storage, and minutes of delay is fine?',
          yes: {
            label: 'Batch load job',
            note: 'Free, atomic. Avro is the best format.',
            tone: 'easy',
          },
        },
        {
          ask: 'Messages in Pub/Sub that need no transform?',
          yes: { label: 'BigQuery subscription', note: 'No code at all.', tone: 'iris' },
        },
        {
          ask: 'An app writes rows and needs exactly-once in seconds?',
          yes: { label: 'Storage Write API', note: 'Committed streams + offsets.', tone: 'brand' },
        },
        {
          ask: 'Changes from an OLTP database?',
          yes: { label: 'Datastream', note: 'CDC with merge.', tone: 'sky' },
        },
      ],
      otherwise: {
        label: 'External or BigLake table',
        note: 'Query in place, no load. Slower.',
        tone: 'plain',
      },
      caption:
        'Compressing CSV does not speed up a load: gzip cannot be read in parallel. Legacy streaming rows sit in a buffer that DML cannot touch at once.',
    },
    {
      concept: 7,
      kind: 'decision',
      title: 'A new source: what to reach for first',
      questions: [
        {
          ask: 'Do the apps already speak the Kafka protocol?',
          yes: {
            label: 'Managed Service for Apache Kafka',
            note: 'Read it with KafkaIO in Dataflow.',
            tone: 'gold',
          },
        },
        {
          ask: 'Is the team standardised on Spark?',
          yes: { label: 'Spark Structured Streaming on Dataproc', tone: 'iris' },
        },
        {
          ask: 'Is there a ready connector?',
          yes: {
            label: 'Use it',
            note: 'Datastream, BigQuery DTS, a Data Fusion plugin or a Google template.',
            tone: 'easy',
          },
        },
      ],
      otherwise: {
        label: 'Pub/Sub + Dataflow',
        note: 'The serverless default.',
        tone: 'brand',
      },
      caption: 'Check for a managed connector before you write custom code.',
    },
    {
      concept: 8,
      kind: 'flow',
      title: 'Remove duplicates at every stage',
      steps: [
        {
          label: 'Publish',
          note: 'An id attribute per message.',
          tone: 'iris',
          chips: ['message id'],
        },
        { label: 'Pipeline', note: 'Deduplicate transform, keyed by id.', tone: 'brand' },
        { label: 'Write', note: '«MERGE» on the business key.', tone: 'sky' },
        {
          label: 'Query',
          note: 'Keep row 1 per id.',
          tone: 'teal',
          chips: ['ROW_NUMBER() = 1', 'QUALIFY'],
        },
      ],
      caption:
        'SUM over duplicated rows doubles the totals. Never give each received entry a new GUID: a duplicate then gets a different id. For re-sent payloads, store a hash of each entry and check against it.',
    },
    {
      concept: 9,
      kind: 'spectrum',
      title: 'Enrich with AI: least effort first',
      from: 'Least effort',
      to: 'Most control',
      stops: [
        {
          label: 'Pre-trained APIs',
          note: 'Sentiment, entities, vision, speech, translation.',
          tone: 'easy',
          chips: ['Natural Language', 'Document AI'],
        },
        {
          label: 'Gemini from SQL',
          note: 'Classify, extract, summarise text columns.',
          tone: 'sky',
          chips: ['AI.GENERATE', 'ML.GENERATE_EMBEDDING'],
        },
        {
          label: 'RunInference in Dataflow',
          note: 'Your model inside the stream.',
          tone: 'brand',
          chips: ['Beam ML'],
        },
      ],
      caption:
        'Do not train a custom sentiment model when a pre-trained API or a Gemini call meets the need. Sensitive Data Protection can tag or tokenise PII in the same step.',
    },
  ],
  'operationalizing-pipelines': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which orchestrator',
      questions: [
        {
          ask: 'One job on a schedule?',
          yes: { label: 'Cloud Scheduler', note: 'Managed cron.', tone: 'plain' },
        },
        {
          ask: 'Only SQL inside BigQuery?',
          yes: { label: 'Scheduled queries or Dataform', tone: 'teal' },
        },
        {
          ask: 'React when a file lands?',
          yes: { label: 'Eventarc + Cloud Run functions', tone: 'gold' },
        },
        {
          ask: 'A short chain of Google API calls, serverless?',
          yes: { label: 'Workflows', note: 'YAML, cheap, no Airflow.', tone: 'sky' },
        },
      ],
      otherwise: {
        label: 'Cloud Composer',
        note: 'Many steps across services: retries, sensors, backfills.',
        tone: 'brand',
      },
      caption:
        'Composer for one nightly query is overkill. Airflow orchestrates; Dataflow, BigQuery and Dataproc do the heavy work.',
    },
    {
      concept: 2,
      kind: 'flow',
      title: 'CI/CD for a data pipeline',
      steps: [
        { label: 'Git push', note: 'DAGs, SQL, Beam code, Terraform.', tone: 'plain' },
        { label: 'Cloud Build', note: 'Unit tests, DAG integrity, build.', tone: 'iris' },
        { label: 'Artifact Registry', note: 'Flex template images.', tone: 'sky' },
        { label: 'Test project', note: 'Integration test on small data.', tone: 'gold' },
        { label: 'Prod project', note: 'Same Terraform, promoted code.', tone: 'brand' },
      ],
      caption:
        'Never edit DAGs or SQL directly in production. Terraform keeps dev, test and prod identical.',
    },
  ],
};
