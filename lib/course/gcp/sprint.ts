/**
 * Service Sprint rounds: a scenario, the right service and three distractors.
 *
 * Generated from Sandeep's PDE Exam Lab module and kept as data. Edit the
 * text here; see lib/course/gcp/README.md for the rules.
 */

import type { SprintRound } from '@/types/gcp';

export const SPRINT: readonly SprintRound[] = [
  {
    scenario: 'Petabyte SQL analytics for BI',
    answer: 'BigQuery',
    distractors: ['Bigtable', 'Cloud SQL', 'Spanner'],
  },
  {
    scenario: 'IoT time series: millions of writes/sec, ms reads by device',
    answer: 'Bigtable',
    distractors: ['BigQuery', 'Cloud SQL', 'Firestore'],
  },
  {
    scenario: 'Global relational OLTP with strong consistency',
    answer: 'Spanner',
    distractors: ['Cloud SQL', 'Bigtable', 'AlloyDB'],
  },
  {
    scenario: 'Regional MySQL app database, lift and shift',
    answer: 'Cloud SQL',
    distractors: ['Spanner', 'Bigtable', 'Firestore'],
  },
  {
    scenario: 'Sub-millisecond session cache',
    answer: 'Memorystore',
    distractors: ['Firestore', 'Bigtable', 'Cloud SQL'],
  },
  {
    scenario: 'Serverless document database for a mobile app',
    answer: 'Firestore',
    distractors: ['Bigtable', 'Cloud SQL', 'Memorystore'],
  },
  {
    scenario: "PostgreSQL that's also fast at analytics on live data",
    answer: 'AlloyDB',
    distractors: ['Cloud SQL', 'Spanner', 'BigQuery'],
  },
  {
    scenario: 'Buffer events from a million devices',
    answer: 'Pub/Sub',
    distractors: ['Cloud Storage', 'BigQuery', 'Memorystore'],
  },
  {
    scenario: 'Streaming with windows and exactly-once processing',
    answer: 'Dataflow',
    distractors: ['Dataproc', 'Cloud Run functions', 'Cloud Composer'],
  },
  {
    scenario: 'Run existing Spark jobs with minimal changes',
    answer: 'Dataproc',
    distractors: ['Dataflow', 'BigQuery', 'Cloud Data Fusion'],
  },
  {
    scenario: 'Spark batches without managing any cluster',
    answer: 'Serverless for Apache Spark',
    distractors: ['Dataproc clusters', 'Dataflow', 'Compute Engine'],
  },
  {
    scenario: 'SQL transformations in BigQuery with Git and tests',
    answer: 'Dataform',
    distractors: ['Cloud Composer', 'Dataflow', 'Cloud Data Fusion'],
  },
  {
    scenario: 'No-code ETL with 150+ connectors',
    answer: 'Cloud Data Fusion',
    distractors: ['Dataform', 'Dataflow', 'Pub/Sub'],
  },
  {
    scenario: 'DAGs across Dataproc, BigQuery and APIs, with backfills',
    answer: 'Cloud Composer',
    distractors: ['Workflows', 'Cloud Scheduler', 'Pub/Sub'],
  },
  {
    scenario: 'Chain a few API calls, serverless',
    answer: 'Workflows',
    distractors: ['Cloud Composer', 'Dataproc', 'Dataflow'],
  },
  {
    scenario: 'Fire one job on a cron schedule',
    answer: 'Cloud Scheduler',
    distractors: ['Cloud Composer', 'Workflows', 'Eventarc'],
  },
  {
    scenario: 'CDC from MySQL into BigQuery',
    answer: 'Datastream',
    distractors: ['Database Migration Service', 'Storage Transfer Service', 'Transfer Appliance'],
  },
  {
    scenario: 'Move MySQL to Cloud SQL with minimal downtime',
    answer: 'Database Migration Service',
    distractors: ['Datastream', 'BigQuery Data Transfer Service', 'Transfer Appliance'],
  },
  {
    scenario: '500 TB from on-prem over a slow link',
    answer: 'Transfer Appliance',
    distractors: ['Storage Transfer Service', 'gcloud storage cp', 'Datastream'],
  },
  {
    scenario: 'Daily sync of an S3 bucket to Cloud Storage',
    answer: 'Storage Transfer Service',
    distractors: ['Transfer Appliance', 'BigQuery Data Transfer Service', 'Datastream'],
  },
  {
    scenario: 'Scheduled Google Ads data into BigQuery',
    answer: 'BigQuery Data Transfer Service',
    distractors: ['Storage Transfer Service', 'Datastream', 'Pub/Sub'],
  },
  {
    scenario: 'Translate Teradata SQL to GoogleSQL',
    answer: 'BigQuery Migration Service',
    distractors: ['Database Migration Service', 'Dataform', 'Datastream'],
  },
  {
    scenario: 'Stop data exfiltration through Google APIs',
    answer: 'VPC Service Controls',
    distractors: ['IAM roles', 'Cloud Armor', 'Firewall rules'],
  },
  {
    scenario: 'Find PII across thousands of tables',
    answer: 'Sensitive Data Protection',
    distractors: ['Cloud KMS', 'VPC Service Controls', 'Cloud Audit Logs'],
  },
  {
    scenario: 'Keys must stay in your own external HSM',
    answer: 'Cloud EKM',
    distractors: ['Cloud HSM', 'Cloud KMS software key', 'CSEK'],
  },
  {
    scenario: 'You control rotation of your own keys in Google Cloud',
    answer: 'CMEK in Cloud KMS',
    distractors: ['Cloud EKM', 'CSEK', 'Default encryption'],
  },
  {
    scenario: 'A column hidden or masked for most analysts',
    answer: 'Policy tag + data masking',
    distractors: ['Row access policy', 'Authorized view', 'VPC Service Controls'],
  },
  {
    scenario: 'Each region sees only its own rows',
    answer: 'Row access policy',
    distractors: ['Policy tags', 'CMEK', 'Analytics Hub'],
  },
  {
    scenario: 'Share query results without exposing the source tables',
    answer: 'Authorized view',
    distractors: ['Row access policy', 'Materialized view', 'Table snapshot'],
  },
  {
    scenario: 'Share live datasets with partners, zero copies',
    answer: 'Analytics Hub',
    distractors: ['BigQuery Data Transfer Service', 'Authorized view', 'Cloud Storage export'],
  },
  {
    scenario: 'Joint analysis without exposing raw rows',
    answer: 'Data clean room',
    distractors: ['Authorized view', 'Dataform', 'Table clone'],
  },
  {
    scenario: 'Lakes, zones, discovery and data quality across projects',
    answer: 'Dataplex',
    distractors: ['Dataform', 'Cloud Data Fusion', 'Looker'],
  },
  {
    scenario: 'Fine-grained security on Parquet in Cloud Storage',
    answer: 'BigLake table',
    distractors: ['External table', 'Signed URL', 'Object versioning'],
  },
  {
    scenario: 'Query data in S3 without moving it',
    answer: 'BigQuery Omni',
    distractors: ['Storage Transfer Service', 'Datastream', 'Transfer Appliance'],
  },
  {
    scenario: 'Sub-second dashboards on BigQuery',
    answer: 'BI Engine',
    distractors: ['Cloud SQL', 'Dataflow', 'Dataproc'],
  },
  {
    scenario: 'A repeated aggregation that refreshes itself',
    answer: 'Materialized view',
    distractors: ['Authorized view', 'Logical view', 'Table snapshot'],
  },
  {
    scenario: 'One governed metrics layer for BI',
    answer: 'Looker',
    distractors: ['Looker Studio', 'Connected Sheets', 'Dataprep'],
  },
  {
    scenario: 'Analyse billions of rows from a spreadsheet',
    answer: 'Connected Sheets',
    distractors: ['Looker Studio', 'Dataprep', 'BI Engine'],
  },
  {
    scenario: 'Train a churn model in SQL',
    answer: 'BigQuery ML',
    distractors: ['Dataproc', 'Dataflow', 'Cloud Composer'],
  },
  {
    scenario: 'Restore a table as it was an hour ago',
    answer: 'Time travel',
    distractors: ['Table clone', 'Pub/Sub seek', 'Object versioning'],
  },
  {
    scenario: 'Replay Pub/Sub messages after a bug',
    answer: 'Seek to a snapshot',
    distractors: ['Dead-letter topic', 'Ordering keys', 'Longer ack deadline'],
  },
  {
    scenario: 'WORM retention for 7 years',
    answer: 'Bucket Lock',
    distractors: ['Object versioning', 'Autoclass', 'Soft delete'],
  },
  {
    scenario: 'Unknown access patterns, tier storage automatically',
    answer: 'Autoclass',
    distractors: ['Lifecycle rules', 'Bucket Lock', 'Turbo replication'],
  },
  {
    scenario: '15-minute RPO for a dual-region bucket',
    answer: 'Turbo replication',
    distractors: ['Autoclass', 'Multi-region bucket', 'Object versioning'],
  },
  {
    scenario: 'Cheap, non-urgent Dataflow batch',
    answer: 'FlexRS',
    distractors: ['Streaming Engine', 'Flex Template', 'Larger workers'],
  },
  {
    scenario: 'Stop a streaming job without losing in-flight data',
    answer: 'Drain',
    distractors: ['Cancel', 'Delete the subscription', 'Reshuffle'],
  },
  {
    scenario: 'Break fusion to see per-step metrics',
    answer: 'Reshuffle',
    distractors: ['Side input', 'CoGroupByKey', 'Flatten'],
  },
  {
    scenario: 'Isolate ETL capacity from ad-hoc queries',
    answer: 'Reservations',
    distractors: ['Custom quotas', 'Batch priority', 'BI Engine'],
  },
  {
    scenario: "Cap one user's bytes scanned per day",
    answer: 'Custom quota',
    distractors: ['Reservation', 'Budget alert', 'Table expiration'],
  },
  {
    scenario: 'Alert when a streaming pipeline lags',
    answer: 'Cloud Monitoring alert',
    distractors: ['Log sink to BigQuery', 'Billing export', 'Dataplex scan'],
  },
  {
    scenario: 'Notify another system the moment a log event appears',
    answer: 'Log sink to Pub/Sub',
    distractors: ['Log sink to Cloud Storage', 'Billing export', 'Error Reporting'],
  },
  {
    scenario: 'Semantic search over documents in BigQuery',
    answer: 'VECTOR_SEARCH',
    distractors: ['Search index', 'LIKE filter', 'Wildcard table'],
  },
];
