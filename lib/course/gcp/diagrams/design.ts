/**
 * Diagrams for line 1: Designing data processing systems. Keyed by station
 * slug; each diagram names the concept it explains. See
 * lib/course/gcp/README.md > Diagrams.
 */

import type { GcpDiagram } from '@/types/gcp';

export const DIAGRAMS: Readonly<Record<string, readonly GcpDiagram[]>> = {
  'security-compliance': [
    {
      concept: 1,
      kind: 'layers',
      title: 'Where an IAM grant lands, and where it flows',
      rail: 'Grants inherit down. Only a deny policy subtracts.',
      nested: true,
      layers: [
        {
          label: 'Organization',
          note: 'Org policies set guardrails here, whatever IAM says.',
          tone: 'iris',
          chips: ['gcp.resourceLocations', 'domain-restricted sharing'],
        },
        { label: 'Folder', note: 'A business unit or an environment group.', tone: 'sky' },
        {
          label: 'Project',
          note: 'Billing, quotas and the right to run jobs.',
          tone: 'teal',
          chips: ['bigquery.jobUser'],
        },
        {
          label: 'Dataset or table',
          note: 'The data roles. The analyst group reads this dataset only.',
          tone: 'brand',
          chips: ['bigquery.dataViewer', 'to a group'],
        },
      ],
      caption:
        'The effective policy is the union of every grant above a resource. A narrow grant low down cannot take back a broad grant higher up, so grant small roles to groups, as low as you can. The analyst pattern is **jobUser on the project + dataViewer on the dataset**.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'Five levels of BigQuery access',
      from: 'Coarse: try this first',
      to: 'Fine: only when needed',
      stops: [
        {
          label: 'Dataset IAM',
          note: 'The usual unit. One dataset per tenant.',
          tone: 'teal',
        },
        { label: 'Table or view IAM', note: 'One object only.', tone: 'sky' },
        {
          label: 'Authorized view',
          note: 'Users read the view, never the source tables.',
          tone: 'iris',
        },
        {
          label: 'Row access policy',
          note: 'One table; each group sees its own rows.',
          tone: 'gold',
          chips: ['FILTER USING'],
        },
        {
          label: 'Policy tag + masking',
          note: 'A column is hidden or masked unless you hold Fine-Grained Reader.',
          tone: 'brand',
          chips: ['SHA-256', 'nullify'],
        },
      ],
      caption:
        'Pick the coarsest level that meets the requirement. Never copy data into many filtered tables to restrict access: a row policy or an authorized view does it on one copy.',
    },
    {
      concept: 3,
      kind: 'spectrum',
      title: 'Who holds the key',
      from: 'Google holds the key',
      to: 'You hold the key outside Google',
      stops: [
        { label: 'Google default', note: 'No requirement stated.', tone: 'plain' },
        {
          label: 'CMEK in Cloud KMS',
          note: 'You control rotation, IAM, disable and destroy.',
          tone: 'teal',
        },
        { label: 'CMEK + Cloud HSM', note: 'FIPS 140-2 Level 3 hardware.', tone: 'sky' },
        {
          label: 'Cloud EKM',
          note: 'The key never lives in Google Cloud.',
          tone: 'iris',
        },
        {
          label: 'CSEK',
          note: 'Raw key per request. Cloud Storage and Compute only.',
          tone: 'hard',
        },
      ],
      caption:
        'Data at rest is always encrypted; the exam asks who controls the key. "We must control rotation" means **CMEK** is enough. CSEK does not work with BigQuery.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'Envelope encryption',
      steps: [
        { label: 'Your data', tone: 'plain' },
        {
          label: 'Data key (DEK)',
          note: 'Encrypts the data, stored next to it.',
          tone: 'gold',
        },
        {
          label: 'Key encryption key (KEK)',
          note: 'Wraps the DEK. Lives in Cloud KMS.',
          tone: 'brand',
          chips: ['CMEK'],
        },
      ],
      edges: ['encrypted by', 'wrapped by'],
      caption:
        'Rotating the KEK does not re-encrypt the data: old key versions stay to decrypt. Destroy the key and the data is unreadable (crypto-shredding).',
    },
    {
      concept: 4,
      kind: 'flow',
      title: 'Find PII, then make it safe',
      steps: [
        {
          label: 'Discover',
          note: 'Profile BigQuery, Cloud SQL and buckets org-wide.',
          tone: 'sky',
          chips: ['data profiling'],
        },
        {
          label: 'Inspect',
          note: 'Match 150+ infoTypes, plus your dictionaries and regex.',
          tone: 'iris',
          chips: ['EMAIL_ADDRESS', 'CREDIT_CARD_NUMBER'],
        },
        {
          label: 'De-identify',
          note: 'Pick a transform by what the business needs back.',
          tone: 'brand',
        },
      ],
      fork: {
        label: 'choose the transform',
        boxes: [
          { label: 'Mask or redact', note: 'Display only. Not reversible.', tone: 'plain' },
          {
            label: 'Hash (HMAC)',
            note: 'Joins still work. Not reversible.',
            tone: 'teal',
          },
          {
            label: 'Deterministic encryption',
            note: 'Joins work, and a key holder can reverse it.',
            tone: 'easy',
          },
          {
            label: 'Format-preserving (FPE)',
            note: 'Reversible and keeps the length, such as 16 digits.',
            tone: 'gold',
          },
        ],
      },
      caption:
        'If the business later needs the original value, hashing is wrong: use deterministic encryption or FPE. An outside party gets a de-identified copy in a separate project.',
    },
    {
      concept: 5,
      kind: 'boundary',
      title: 'VPC Service Controls stops data leaving',
      inside: {
        label: 'Service perimeter',
        boxes: [
          { label: 'prod-data project', note: 'BigQuery, Cloud Storage, Pub/Sub', tone: 'teal' },
          { label: 'prod-etl project', note: 'Dataflow workers, no public IP', tone: 'sky' },
        ],
      },
      outside: [
        {
          label: 'Copy a table to a personal project',
          note: 'Valid IAM, but the API call crosses the perimeter.',
          tone: 'hard',
          verdict: 'blocked',
        },
        {
          label: 'Analyst from the corporate network',
          note: 'An access level (IP range, device) lets them in.',
          tone: 'easy',
          verdict: 'allowed',
        },
        {
          label: 'Partner perimeter',
          note: 'A perimeter bridge joins two perimeters on purpose.',
          tone: 'easy',
          verdict: 'allowed',
        },
      ],
      caption:
        'IAM says who may call an API; the perimeter says where data may go. Exfiltration questions need VPC-SC, not more IAM.',
    },
    {
      concept: 6,
      kind: 'hub',
      title: 'One storage project, many consumer projects',
      center: {
        label: 'Storage project',
        note: 'Datasets are the security boundary. One dataset per client.',
      },
      spokes: [
        { label: 'Team A compute project', note: 'Runs queries; pays for its slots.', tone: 'sky' },
        { label: 'BI project', note: 'Dashboards; its own cost line.', tone: 'iris' },
        { label: 'dev project', note: 'Own IAM, quotas and blast radius.', tone: 'gold' },
        { label: 'prod project', note: 'Code is promoted here, not data.', tone: 'brand' },
      ],
      caption:
        'Split by environment and by who pays. Labels give cost per team; Data Access audit logs show who reads what before you lock things down.',
    },
  ],
  'reliability-fidelity': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which tool cleans the data',
      questions: [
        {
          ask: 'Streaming, complex logic or very large scale?',
          yes: { label: 'Dataflow', note: 'Beam code, dead-letter outputs.', tone: 'brand' },
        },
        {
          ask: 'The data is in BigQuery and the team writes SQL?',
          yes: { label: 'Dataform', note: 'SQLX, assertions, Git.', tone: 'teal' },
        },
        {
          ask: 'No code, many connectors, visual pipelines?',
          yes: { label: 'Cloud Data Fusion', note: 'Runs on Dataproc.', tone: 'iris' },
        },
        {
          ask: 'Existing Spark or Hadoop jobs?',
          yes: { label: 'Dataproc', note: 'Lift and shift.', tone: 'gold' },
        },
      ],
      otherwise: {
        label: 'Dataprep or Gemini in BigQuery',
        note: 'Ad hoc wrangling by business users; SQL from plain English.',
        tone: 'plain',
      },
      caption:
        'Data Fusion and Dataprep are wrong for high-volume, low-latency streaming. Dataflow is overkill for a SQL team whose data is already in BigQuery.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'Disaster recovery: pay for the RPO and RTO you need',
      from: 'Hours of loss is fine: cheap',
      to: 'Near zero loss: expensive',
      stops: [
        {
          label: 'Backups and snapshots',
          note: 'Time travel, table snapshots, PITR backups.',
          tone: 'plain',
        },
        {
          label: 'Cross-region replica',
          note: 'Promote by hand on a regional failure.',
          tone: 'sky',
          chips: ['Cloud SQL', 'BigQuery'],
        },
        {
          label: 'Dual-region + turbo',
          note: 'Cloud Storage, RPO 15 minutes.',
          tone: 'teal',
        },
        {
          label: 'Multi-region, synchronous',
          note: 'Automatic failover, 99.999%.',
          tone: 'brand',
          chips: ['Spanner', 'Bigtable multi-cluster'],
        },
      ],
      caption:
        'RPO is how much data you can lose; RTO is how long you can be down. Pick the cheapest design that meets both, not the strongest one.',
    },
    {
      concept: 3,
      kind: 'spectrum',
      title: 'How strong is the guarantee',
      from: 'Weaker, faster, cheaper',
      to: 'Stronger, global, more latency',
      stops: [
        {
          label: 'Bigtable',
          note: 'Atomic per row only. Replicas are eventual.',
          tone: 'hard',
        },
        { label: 'BigQuery', note: 'Atomic DML, but an analytics engine.', tone: 'medium' },
        { label: 'Firestore', note: 'ACID, strongly consistent, serverless.', tone: 'teal' },
        { label: 'Cloud SQL / AlloyDB', note: 'ACID on one primary.', tone: 'sky' },
        {
          label: 'Spanner',
          note: 'ACID across rows, tables and regions. External consistency.',
          tone: 'easy',
        },
      ],
      caption:
        'Choose the weakest guarantee the requirement allows. Moving money between accounts needs multi-row transactions, so never Bigtable.',
    },
    {
      concept: 4,
      kind: 'flow',
      title: 'Validate without losing rows',
      steps: [
        {
          label: 'Profile',
          note: 'Learn what valid looks like.',
          tone: 'sky',
          chips: ['Dataplex profiling'],
        },
        {
          label: 'Declare rules',
          note: 'Non-null, range, regex, unique.',
          tone: 'iris',
          chips: ['AutoDQ', 'Dataform assertions'],
        },
        { label: 'Check each record', note: 'In a DoFn in the pipeline.', tone: 'brand' },
      ],
      fork: {
        label: 'each record goes one way',
        boxes: [
          { label: 'Valid → main table', tone: 'easy' },
          {
            label: 'Invalid → dead-letter table',
            note: 'Kept with the error, so you can analyse and replay it.',
            tone: 'hard',
          },
        ],
      },
      caption:
        'A high «max_bad_records» silently loses rows. When the requirement says "analyse the bad records", route them to a dead-letter sink. After a migration, the Data Validation Tool compares source and target.',
    },
  ],
  'flexibility-portability': [
    {
      concept: 1,
      kind: 'layers',
      title: 'Open formats keep the engines swappable',
      layers: [
        {
          label: 'Engines',
          note: 'Any engine reads the same tables.',
          tone: 'brand',
          chips: ['BigQuery', 'Spark on Dataproc', 'Trino', 'Beam runners'],
        },
        {
          label: 'Table format + security',
          note: 'BigLake adds row and column security over files.',
          tone: 'iris',
          chips: ['Iceberg', 'Delta', 'Hudi', 'BigLake'],
        },
        {
          label: 'Object storage, in any cloud',
          note: 'BigQuery Omni queries AWS and Azure data in place.',
          tone: 'teal',
          chips: ['Cloud Storage', 'S3', 'Azure Blob'],
        },
      ],
      caption:
        'When the data must stay in AWS, do not copy it to Cloud Storage: query it in place with BigQuery Omni or BigLake.',
    },
    {
      concept: 2,
      kind: 'layers',
      title: 'How Dataplex organises data without moving it',
      rail: 'Each level holds the next',
      nested: true,
      layers: [
        { label: 'Lake', note: 'A data domain, such as Sales.', tone: 'iris' },
        {
          label: 'Zone',
          note: 'Raw (any format) or curated (columnar, clean).',
          tone: 'sky',
          chips: ['raw', 'curated'],
        },
        {
          label: 'Asset',
          note: 'A bucket or a BigQuery dataset, even in another project.',
          tone: 'teal',
        },
        {
          label: 'Entity',
          note: 'A discovered table or fileset you can query.',
          tone: 'brand',
        },
      ],
      caption:
        'Knowledge Catalog sits over all of it: search, aspects (old name: tags), lineage and a glossary. Do not build your own metadata database.',
    },
  ],
  'data-migrations': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which transfer tool',
      questions: [
        {
          ask: 'Less than about 1 TB from one machine?',
          yes: { label: '«gcloud storage cp»', tone: 'plain' },
        },
        {
          ask: 'Would the network take more than a week? (1 TB at 100 Mbps ≈ 1 day)',
          yes: { label: 'Transfer Appliance', note: 'A device shipped to Google.', tone: 'gold' },
        },
        {
          ask: 'A live database, with little downtime?',
          yes: {
            label: 'Database Migration Service',
            note: 'Or Datastream for CDC into BigQuery.',
            tone: 'iris',
          },
        },
        {
          ask: 'Scheduled loads into BigQuery tables (SaaS, Redshift, Teradata)?',
          yes: { label: 'BigQuery Data Transfer Service', tone: 'brand' },
        },
      ],
      otherwise: {
        label: 'Storage Transfer Service',
        note: 'Large or recurring object copies: S3, Azure, HDFS, other buckets.',
        tone: 'teal',
      },
      caption:
        'Storage Transfer Service moves objects into buckets, not rows into tables. 500 TB over 100 Mbps takes over a year: ship a device.',
    },
    {
      concept: 2,
      kind: 'flow',
      title: 'The migration plan',
      steps: [
        { label: 'Assess', note: 'Jobs, SLAs, sizes, consumers.', tone: 'sky' },
        { label: 'Plan', note: 'Targets, network, security, cut-over.', tone: 'iris' },
        { label: 'Migrate in waves', note: 'Old and new run side by side.', tone: 'gold' },
        { label: 'Validate', note: 'Counts, aggregates, row hashes (DVT).', tone: 'brand' },
        { label: 'Optimise', note: 'Partitions, slots, autoscaling.', tone: 'teal' },
      ],
      caption:
        'Never move everything at once with no validation phase. Switch consumers only after the numbers match.',
    },
    {
      concept: 2,
      kind: 'pairs',
      title: 'Hadoop on Google Cloud',
      left: 'On premises',
      right: 'Google Cloud',
      pairs: [
        ['HDFS', 'Cloud Storage («gs://»)'],
        ['Spark, MapReduce, Hive jobs', 'Dataproc, then Serverless or BigQuery'],
        ['Hive warehouse', 'BigQuery or Dataproc Metastore'],
        ['HBase', 'Bigtable (HBase API)'],
        ['Kafka', 'Pub/Sub or Managed Kafka'],
        ['Oozie, cron', 'Cloud Composer'],
      ],
      caption:
        'Moving HDFS to Cloud Storage splits storage from compute, so a cluster can be deleted after each job. Data on cluster disks dies with the cluster.',
    },
  ],
};
