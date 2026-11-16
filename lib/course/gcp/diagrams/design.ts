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
      title: 'How an analyst gets access with IAM',
      scenario:
        'Priya is a new analyst at Cymbal. She must query the sales dataset, and nothing else. Where do you grant the access, and which roles?',
      rail: 'A grant made at one level flows down to everything inside it',
      nested: true,
      layers: [
        {
          n: 1,
          icon: 'org',
          label: 'Organization: cymbal.com',
          note: 'Org policies set guardrails for everyone: which regions are allowed, CMEK only, no service account keys.',
          tone: 'iris',
          chips: ['gcp.resourceLocations'],
        },
        {
          n: 2,
          icon: 'layers',
          label: 'Folder: Analytics department',
          note: 'A grant here reaches every project of the department. Too wide for Priya.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'project',
          label: 'Project: cymbal-analytics',
          note: 'Give the analysts group the right to run queries here. This role gives no data.',
          tone: 'teal',
          chips: ['bigquery.jobUser'],
        },
        {
          n: 4,
          icon: 'bigquery',
          label: 'Dataset: sales',
          note: 'Give the analysts group read access to this one dataset. Priya joins the group.',
          tone: 'brand',
          chips: ['bigquery.dataViewer'],
        },
      ],
      walk: [
        'The organization is the top. Org policies here are guardrails that apply whatever IAM says.',
        'A folder groups projects. A role granted on the folder is inherited by every project in it.',
        'On the project, the group gets «bigquery.jobUser». That role lets Priya run a query, but she can read no table yet.',
        'On the dataset, the group gets «bigquery.dataViewer». Now Priya can read the sales tables and only those.',
      ],
      caption:
        'Access is the sum of every grant above a resource, and a lower level cannot take a higher grant away. So grant small predefined roles, to groups, as low as possible. Basic roles (Owner, Editor, Viewer) are almost always the wrong answer.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'Five ways to limit what a user sees in BigQuery',
      scenario:
        'One orders table holds every region and a card number column. Different teams must see different parts of it. You do not copy the table: you pick the right level of control.',
      from: 'Coarse: try this first',
      to: 'Fine: only when you need it',
      stops: [
        {
          n: 1,
          icon: 'bigquery',
          label: 'Dataset IAM',
          note: 'The whole dataset or nothing. Use one dataset per client.',
          tone: 'teal',
        },
        {
          n: 2,
          icon: 'table',
          label: 'Table IAM',
          note: 'Access to one table or one view only.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'search',
          label: 'Authorized view',
          note: 'Users query a view. They never get the source tables.',
          tone: 'iris',
        },
        {
          n: 4,
          icon: 'users',
          label: 'Row access policy',
          note: 'Same table, but the APAC team sees only APAC rows.',
          tone: 'gold',
          chips: ['FILTER USING'],
        },
        {
          n: 5,
          icon: 'lock',
          label: 'Policy tag + masking',
          note: 'The card column is hidden or shown as a hash.',
          tone: 'brand',
          chips: ['Fine-Grained Reader'],
        },
      ],
      walk: [
        'Dataset IAM is the normal unit. Start here: can you solve it by putting the data in separate datasets?',
        'Table IAM narrows the grant to one table or one view.',
        'An authorized view lives in another dataset. The view may read the source, and users may read only the view.',
        'A row access policy filters rows by who asks. One table serves every region.',
        'A policy tag marks a sensitive column. Only users with Fine-Grained Reader see it. Others get an error, or a masked value if you add dynamic masking.',
      ],
      caption:
        'Pick the coarsest level that meets the requirement. Never copy data into many filtered tables to restrict access.',
    },
    {
      concept: 3,
      kind: 'spectrum',
      title: 'Encryption: who holds the key?',
      scenario:
        'Google encrypts all data at rest. The exam question is always the same: who must control the key? Read the requirement and stop at the first option that meets it.',
      from: 'Google controls the key',
      to: 'You control the key, outside Google',
      stops: [
        {
          n: 1,
          icon: 'lock',
          label: 'Google default',
          note: 'Nothing to do. Right when no key requirement is stated.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'kms',
          label: 'CMEK in Cloud KMS',
          note: 'Your key in Cloud KMS. You rotate, disable and destroy it.',
          tone: 'teal',
        },
        {
          n: 3,
          icon: 'hsm',
          label: 'CMEK in Cloud HSM',
          note: 'The same, but the key lives in certified hardware (FIPS 140-2 Level 3).',
          tone: 'sky',
        },
        {
          n: 4,
          icon: 'ekm',
          label: 'Cloud EKM',
          note: 'The key stays in your own key manager, outside Google Cloud.',
          tone: 'iris',
        },
        {
          n: 5,
          icon: 'key',
          label: 'CSEK',
          note: 'You send the raw key with each request. Cloud Storage and Compute Engine only.',
          tone: 'hard',
        },
      ],
      walk: [
        'No requirement about keys? The Google default is the answer.',
        '"We must control rotation" or "we must be able to revoke the key" means CMEK in Cloud KMS.',
        '"The regulator requires an HSM" means the CMEK key is made in Cloud HSM.',
        '"Keys must never be stored in Google Cloud" means Cloud EKM.',
        'CSEK is rare, and BigQuery does not support it.',
      ],
      caption:
        'CMEK is enough for "we must control the key". Do not pick client-side encryption or CSEK for that. The key must be in a location that matches the data: an EU dataset needs an EU key.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'Envelope encryption: a key that locks a key',
      scenario:
        'A 10 TB table is encrypted with your CMEK key. You rotate the key every 90 days. Does Google encrypt 10 TB again each time? No, and this is why.',
      steps: [
        {
          n: 1,
          icon: 'table',
          label: 'Your data',
          note: 'Split into chunks.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'key',
          label: 'Data key (DEK)',
          note: 'Encrypts the chunk. It is stored next to the data, but locked.',
          tone: 'gold',
        },
        {
          n: 3,
          icon: 'kms',
          label: 'Your key in Cloud KMS (KEK)',
          note: 'Locks the data key. It never leaves KMS.',
          tone: 'brand',
          chips: ['CMEK'],
        },
      ],
      edges: ['encrypted by', 'locked by'],
      walk: [
        'The service splits your data into chunks.',
        'Each chunk is encrypted with a data encryption key (DEK). The DEK is saved beside the chunk, in locked form.',
        'The DEK is locked ("wrapped") by your key in Cloud KMS, the key encryption key (KEK). To read data, the service asks KMS to unlock the DEK.',
      ],
      caption:
        'Rotation makes a new KEK version for new data. Old versions stay, so no data is encrypted again. Destroy the KEK and every DEK is useless: the data is gone for good (crypto-shredding).',
    },
    {
      concept: 4,
      kind: 'flow',
      title: 'Find PII, then make it safe to share',
      scenario:
        'An outside consultant must analyse Cymbal customer data. The tables hold emails and card numbers. Sensitive Data Protection (Cloud DLP) finds them and changes them before the consultant sees anything.',
      steps: [
        {
          n: 1,
          icon: 'dlp',
          label: 'Discover',
          note: 'Profile every BigQuery table, Cloud SQL table and bucket in the org.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'search',
          label: 'Inspect',
          note: 'Match values to 150+ infoTypes, plus your own patterns.',
          tone: 'iris',
          chips: ['EMAIL_ADDRESS', 'CREDIT_CARD_NUMBER'],
        },
        {
          n: 3,
          icon: 'shield',
          label: 'De-identify',
          note: 'Replace each sensitive value. Which transform depends on what must still work.',
          tone: 'brand',
        },
      ],
      fork: {
        label: 'step 4: choose the transform by what the business needs',
        boxes: [
          {
            label: 'Mask or redact',
            note: 'Shows ****. For display only. You cannot join or go back.',
            tone: 'plain',
          },
          {
            label: 'Hash (HMAC)',
            note: 'Same input, same token: joins still work. You cannot go back.',
            tone: 'teal',
          },
          {
            label: 'Deterministic encryption',
            note: 'Joins work, and a team with the key can get the original back.',
            tone: 'easy',
          },
          {
            label: 'Format-preserving encryption',
            note: 'Like above, and a 16-digit card stays 16 digits.',
            tone: 'gold',
          },
        ],
      },
      walk: [
        'Discovery scans the whole organization and tells you where sensitive data lives.',
        'Inspection looks inside a table or bucket and labels each finding with an infoType.',
        'De-identification rewrites the values. It can run on stored data, or inside Dataflow before the data lands.',
        'Choose the transform. Ask two questions: must analysts still join on the value, and must anyone get the original back?',
      ],
      caption:
        'If the business needs the original value later, hashing is wrong: use deterministic encryption or format-preserving encryption. The consultant gets a de-identified copy in a separate project, never production.',
    },
    {
      concept: 5,
      kind: 'boundary',
      title: 'VPC Service Controls: a wall around your data',
      scenario:
        'An engineer at Cymbal has valid IAM access to the customers table. Nothing in IAM stops them from copying it to a personal project. A service perimeter does.',
      inside: {
        label: 'Service perimeter',
        boxes: [
          {
            icon: 'bigquery',
            label: 'Project prod-data',
            note: 'BigQuery, Cloud Storage and Pub/Sub are protected services.',
            tone: 'teal',
          },
          {
            icon: 'dataflow',
            label: 'Project prod-etl',
            note: 'Dataflow workers with no public IP. They reach Google APIs by Private Google Access.',
            tone: 'sky',
          },
        ],
      },
      outside: [
        {
          icon: 'warning',
          label: 'Copy a table to a personal project',
          note: 'The user has the IAM role, but the copy would cross the perimeter. The API refuses it.',
          tone: 'hard',
          verdict: 'blocked',
        },
        {
          icon: 'user',
          label: 'An analyst on the office network',
          note: 'An access level (office IP range, managed device) lets this request in.',
          tone: 'easy',
          verdict: 'allowed',
        },
        {
          icon: 'project',
          label: 'A partner team in another perimeter',
          note: 'A perimeter bridge joins the two perimeters on purpose.',
          tone: 'easy',
          verdict: 'allowed',
        },
      ],
      walk: [
        'You draw a perimeter around the projects that hold sensitive data. Inside it, services talk to each other freely.',
        'A call that would move data out of the perimeter is refused, even when IAM allows the user.',
        'You open the wall on purpose with access levels (who, from where) and bridges (which other perimeter).',
      ],
      caption:
        'IAM answers "who may call this API". The perimeter answers "where may the data go". A question about data exfiltration wants VPC Service Controls, not more IAM. A dataset location can never be changed: copy the dataset instead.',
    },
    {
      concept: 6,
      kind: 'hub',
      title: 'One project stores the data, other projects query it',
      scenario:
        'Three teams at Cymbal use the same warehouse. Finance asks: who spent what? Security asks: who can break production? The project layout answers both.',
      center: {
        icon: 'bigquery',
        label: 'Storage project',
        note: 'Holds the datasets. A dataset is the security boundary: one per client or per audience.',
      },
      spokes: [
        {
          n: 1,
          icon: 'project',
          label: 'Marketing project',
          note: 'Marketing runs its queries here, so the cost lands on Marketing.',
          tone: 'sky',
        },
        {
          n: 1,
          icon: 'looker',
          label: 'BI project',
          note: 'Dashboards run here, with their own slots and their own bill.',
          tone: 'iris',
        },
        {
          n: 2,
          icon: 'code',
          label: 'dev and test projects',
          note: 'Their own IAM and quotas. A mistake here cannot touch production.',
          tone: 'gold',
        },
        {
          n: 3,
          icon: 'audit-logs',
          label: 'Cloud Audit Logs',
          note: 'Data Access logs show who reads which table.',
          tone: 'teal',
        },
      ],
      walk: [
        'Queries are billed to the project that runs them. So each team gets a project, and reads the shared datasets from it.',
        'Each environment (dev, test, prod) is its own project. You promote code between them, never data.',
        'Before you lock a warehouse down, read the Data Access audit logs to learn who uses what.',
      ],
      caption:
        'One project for dev and prod "to save cost" is a trap. Tenants that need isolation get separate datasets with their own IAM, not separate partitions or tables.',
    },
  ],
  'reliability-fidelity': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which tool should clean and prepare the data?',
      scenario:
        'Raw data arrives at Cymbal and must be cleaned before analysis. Six tools can do it. Answer these questions from the top and stop at the first "yes".',
      questions: [
        {
          ask: 'Is it a stream, or does it need complex logic at very large scale?',
          yes: {
            icon: 'dataflow',
            label: 'Dataflow',
            note: 'Apache Beam code. Handles batch and streaming, and sends bad records to a dead-letter output.',
            tone: 'brand',
          },
        },
        {
          ask: 'Is the data already in BigQuery, and does the team write SQL?',
          yes: {
            icon: 'bigquery',
            label: 'Dataform',
            note: 'SQL files in Git, with dependencies, tests (assertions) and schedules.',
            tone: 'teal',
          },
        },
        {
          ask: 'Does the team want no code: drag-and-drop pipelines with ready connectors?',
          yes: {
            icon: 'data-fusion',
            label: 'Cloud Data Fusion',
            note: 'Visual ETL with 150+ connectors. It runs the work on Dataproc.',
            tone: 'iris',
          },
        },
        {
          ask: 'Does the team already have Spark or Hadoop jobs?',
          yes: {
            icon: 'dataproc',
            label: 'Dataproc',
            note: 'Run the existing jobs with almost no change.',
            tone: 'gold',
          },
        },
      ],
      otherwise: {
        icon: 'dataprep',
        label: 'Dataprep, or Gemini in BigQuery',
        note: 'A business user who explores and cleans a file by hand, or asks for SQL in plain English.',
        tone: 'plain',
      },
      walk: [
        'First check for streaming or heavy custom logic. Only Dataflow fits that.',
        'If the data is in BigQuery and the team knows SQL, transform it in place with Dataform.',
        'If nobody wants to write code, Data Fusion gives visual pipelines.',
        'If Spark jobs exist already, keep them and run them on Dataproc.',
      ],
      caption:
        'Data Fusion and Dataprep are wrong for a high-volume, low-latency stream. Dataflow is too much for a SQL team whose data is already in BigQuery.',
    },
    {
      concept: 2,
      kind: 'spectrum',
      title: 'Disaster recovery: buy only the protection you need',
      scenario:
        'The business gives two numbers. RPO: how many minutes of data may we lose? RTO: how long may we be down? Go from left to right and stop at the first design that meets both.',
      from: 'Hours of loss are fine: cheap',
      to: 'No loss, no downtime: expensive',
      stops: [
        {
          n: 1,
          icon: 'refresh',
          label: 'Backups and snapshots',
          note: 'BigQuery time travel (7 days) and table snapshots. Cloud SQL backups with point-in-time recovery.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'cloud-sql',
          label: 'A replica in another region',
          note: 'Cloud SQL cross-region replica. A person promotes it when the region fails.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'cloud-storage',
          label: 'Dual-region with turbo replication',
          note: 'Cloud Storage copies each object to a second region within 15 minutes.',
          tone: 'teal',
        },
        {
          n: 4,
          icon: 'spanner',
          label: 'Multi-region, synchronous',
          note: 'Spanner multi-region (99.999%), or Bigtable with multi-cluster routing. Failover is automatic.',
          tone: 'brand',
        },
      ],
      walk: [
        'Backups are the cheapest. You lose what happened since the last backup, and restoring takes time.',
        'A replica in another region loses seconds of data, but someone must promote it.',
        'Dual-region storage with turbo replication promises an RPO of 15 minutes for objects.',
        'Synchronous multi-region writes lose nothing and fail over alone. It costs the most.',
      ],
      caption:
        'Do not pay for Spanner multi-region when the stated RPO and RTO are hours. A Cloud SQL read replica does not fail over by itself: the HA standby does.',
    },
    {
      concept: 3,
      kind: 'spectrum',
      title: 'How strong a guarantee does each database give?',
      scenario:
        'Cymbal Bank moves money from account A to account B. Both rows must change together, or neither. Which databases can promise that?',
      from: 'Weaker promise: fast and cheap',
      to: 'Stronger promise: costs latency and money',
      stops: [
        {
          n: 1,
          icon: 'bigtable',
          label: 'Bigtable',
          note: 'A change is atomic inside one row only. Copies in other clusters catch up later.',
          tone: 'hard',
        },
        {
          n: 2,
          icon: 'bigquery',
          label: 'BigQuery',
          note: 'Transactions exist, but it is built for analytics, not for many small updates.',
          tone: 'medium',
        },
        {
          n: 3,
          icon: 'firestore',
          label: 'Firestore',
          note: 'Full ACID transactions on documents. Serverless.',
          tone: 'teal',
        },
        {
          n: 4,
          icon: 'cloud-sql',
          label: 'Cloud SQL and AlloyDB',
          note: 'Full ACID on one primary instance, in one region.',
          tone: 'sky',
        },
        {
          n: 5,
          icon: 'spanner',
          label: 'Spanner',
          note: 'Full ACID across rows, tables and continents.',
          tone: 'easy',
        },
      ],
      walk: [
        'Bigtable cannot change two rows as one unit. The money transfer is impossible here.',
        'BigQuery is for reading large data. Do not run a bank ledger on it.',
        'Firestore gives real transactions for an app backend.',
        'Cloud SQL and AlloyDB give classic relational transactions, in one region.',
        'Spanner gives the same promise worldwide, and scales writes.',
      ],
      caption:
        'Choose the weakest guarantee that the requirement allows. A requirement with multi-row transactions rules out Bigtable.',
    },
    {
      concept: 4,
      kind: 'flow',
      title: 'Check every record, and keep the bad ones',
      scenario:
        'A nightly file at Cymbal has a few broken rows: a missing id, a date in the future. The job must not fail, and the bad rows must not vanish, because someone has to fix the source.',
      steps: [
        {
          n: 1,
          icon: 'dataplex',
          label: 'Profile the data',
          note: 'Dataplex profiling shows nulls, ranges and top values, so you learn what "valid" means.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'shield',
          label: 'Write the rules',
          note: 'Not null, in range, matches a pattern, unique.',
          tone: 'iris',
          chips: ['Dataplex AutoDQ', 'Dataform assertions'],
        },
        {
          n: 3,
          icon: 'dataflow',
          label: 'Test each record',
          note: 'A step in the pipeline applies the rules to every record.',
          tone: 'brand',
        },
      ],
      fork: {
        label: 'step 4: each record takes one of two paths',
        boxes: [
          {
            icon: 'bigquery',
            label: 'Valid: the main table',
            note: 'Analysts see only clean rows.',
            tone: 'easy',
          },
          {
            icon: 'warning',
            label: 'Invalid: the dead-letter table',
            note: 'The row is saved with the reason. You can study it and load it again later.',
            tone: 'hard',
          },
        ],
      },
      walk: [
        'Profile first. You cannot write a rule before you know the normal shape of the data.',
        'Declare the rules once, as Dataplex data quality scans or Dataform assertions.',
        'In the pipeline, test each record against the rules.',
        'Good records go on. Bad records go to a dead-letter table with the error, and the job keeps running.',
      ],
      caption:
        'A high «max_bad_records» throws bad rows away silently. When the question says "analyse the bad records", the answer is a dead-letter output. After a migration, the Data Validation Tool compares source and target.',
    },
  ],
  'flexibility-portability': [
    {
      concept: 1,
      kind: 'layers',
      title: 'Open formats: change the engine, keep the data',
      scenario:
        'Cymbal has data in Cloud Storage and in Amazon S3. Some teams use BigQuery and others use Spark. The company wants one copy of the data that every engine can read, in every cloud.',
      rail: 'Each layer can be swapped without touching the others',
      layers: [
        {
          n: 3,
          icon: 'bigquery',
          label: 'Engines: pick any',
          note: 'BigQuery, Spark on Dataproc, Trino and Beam all read the same tables.',
          tone: 'brand',
          chips: ['BigQuery', 'Dataproc', 'Dataflow'],
        },
        {
          n: 2,
          icon: 'table',
          label: 'Table format and security',
          note: 'An open table format turns files into tables. BigLake adds row and column security.',
          tone: 'iris',
          chips: ['Iceberg', 'Delta', 'Hudi', 'BigLake'],
        },
        {
          n: 1,
          icon: 'cloud-storage',
          label: 'Files in object storage',
          note: 'Parquet files in Cloud Storage, Amazon S3 or Azure Blob.',
          tone: 'teal',
          chips: ['Cloud Storage', 'S3', 'Azure Blob'],
        },
      ],
      walk: [
        'At the bottom, the data is plain open files in object storage, in any cloud.',
        'An open table format such as Iceberg describes those files as tables. BigLake puts fine-grained security on top.',
        'Any engine reads the tables. You can change the engine and the data stays where it is.',
      ],
      caption:
        'When the data must stay in AWS, do not copy it to Cloud Storage. BigQuery Omni queries it in place. Beam code is portable too: the same pipeline runs on Dataflow, Flink or Spark.',
    },
    {
      concept: 2,
      kind: 'layers',
      title: 'How Dataplex organises data that it does not move',
      scenario:
        'Cymbal Sales has files in three buckets and tables in two BigQuery datasets, across projects. Dataplex puts one logical map over them, and nothing is copied.',
      rail: 'Each level contains the next one',
      nested: true,
      layers: [
        {
          n: 1,
          icon: 'dataplex',
          label: 'Lake: Sales',
          note: 'One lake per business domain.',
          tone: 'iris',
        },
        {
          n: 2,
          icon: 'layers',
          label: 'Zone: raw or curated',
          note: 'Raw holds data as it arrived. Curated holds clean, columnar data.',
          tone: 'sky',
        },
        {
          n: 3,
          icon: 'cloud-storage',
          label: 'Asset: a bucket or a dataset',
          note: 'A real Cloud Storage bucket or BigQuery dataset. It can be in another project.',
          tone: 'teal',
        },
        {
          n: 4,
          icon: 'table',
          label: 'Entity: a table Dataplex found',
          note: 'Discovery reads the files and registers a table you can query.',
          tone: 'brand',
        },
      ],
      walk: [
        'A lake is a domain, such as Sales.',
        'Inside a lake, zones separate raw data from curated data.',
        'You attach assets to a zone: existing buckets and datasets. They stay where they are.',
        'Dataplex discovers the files in each asset and registers them as tables for BigQuery and Spark.',
      ],
      caption:
        'Knowledge Catalog (the new name of Data Catalog) is the search layer over everything: metadata, lineage and a business glossary. Do not build your own metadata database.',
    },
  ],
  'data-migrations': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which tool moves the data to Google Cloud?',
      scenario:
        'Cymbal must move data into Google Cloud. The right tool depends on what the data is, how much there is, and how fast the network is. Rule of thumb: 1 TB over 100 Mbps takes about one day.',
      questions: [
        {
          ask: 'Is it a small, one-time copy from one machine (under about 1 TB)?',
          yes: {
            icon: 'cloud-storage',
            label: '«gcloud storage cp»',
            note: 'One command from your laptop or server.',
            tone: 'plain',
          },
        },
        {
          ask: 'Would the network need more than about a week?',
          yes: {
            icon: 'transfer-appliance',
            label: 'Transfer Appliance',
            note: 'Google ships you a storage device. You fill it and ship it back.',
            tone: 'gold',
          },
        },
        {
          ask: 'Is it a running database that cannot stop for long?',
          yes: {
            icon: 'dms',
            label: 'Database Migration Service',
            note: 'Copies, then keeps replicating until you switch over. Datastream does the same into BigQuery.',
            tone: 'iris',
          },
        },
        {
          ask: 'Must it load into BigQuery tables on a schedule (SaaS apps, Redshift, Teradata)?',
          yes: {
            icon: 'bq-transfer',
            label: 'BigQuery Data Transfer Service',
            note: 'Managed, scheduled loads straight into tables.',
            tone: 'brand',
          },
        },
      ],
      otherwise: {
        icon: 'storage-transfer',
        label: 'Storage Transfer Service',
        note: 'Large or repeated copies of files into buckets: from S3, Azure, HDFS or another bucket.',
        tone: 'teal',
      },
      walk: [
        'A small one-off copy needs no service: use the command line.',
        'Do the math. 500 TB over 100 Mbps is more than a year, so ship a Transfer Appliance.',
        'A live database needs continuous replication so the downtime is minutes.',
        'Data that must land in BigQuery tables uses the BigQuery Data Transfer Service.',
      ],
      caption:
        'Storage Transfer Service moves files into buckets. It does not load rows into BigQuery tables. For steady high-volume links, use Dedicated or Partner Interconnect; Cloud VPN is for modest needs.',
    },
    {
      concept: 2,
      kind: 'flow',
      title: 'A migration in five phases',
      scenario:
        'Cymbal moves its on-premises warehouse to BigQuery. Reports must stay correct during the move, and the old system must stay usable until the new one is proven.',
      steps: [
        {
          n: 1,
          icon: 'search',
          label: 'Assess',
          note: 'List jobs, data sizes, deadlines and who uses what.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'layers',
          label: 'Plan',
          note: 'Choose target services, network, security and the switch-over.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'refresh',
          label: 'Migrate in waves',
          note: 'Move one group at a time. Old and new run side by side.',
          tone: 'gold',
        },
        {
          n: 4,
          icon: 'shield',
          label: 'Validate',
          note: 'Compare row counts, totals and row hashes.',
          tone: 'brand',
          chips: ['Data Validation Tool'],
        },
        {
          n: 5,
          icon: 'chart',
          label: 'Optimise',
          note: 'Tune partitions, slots and autoscaling.',
          tone: 'teal',
        },
      ],
      walk: [
        'Assess what exists. You cannot plan a move of jobs you do not know about.',
        'Plan the target and how users will switch.',
        'Migrate in small waves and keep the old system running in parallel.',
        'Validate that the numbers match before any consumer switches.',
        'Optimise only after the new system is stable.',
      ],
      caption:
        'Two traps: moving everything at once, and skipping the validation phase. Consumers switch only after source and target agree.',
    },
    {
      concept: 2,
      kind: 'pairs',
      title: 'Each Hadoop part and where it goes',
      scenario:
        'Cymbal runs a Hadoop cluster in its own data centre. Each part of that cluster has a matching home in Google Cloud.',
      left: 'On premises',
      right: 'Google Cloud',
      pairs: [
        [
          'HDFS (files on cluster disks)',
          'Cloud Storage: paths change to «gs://»',
          'cloud-storage',
        ],
        [
          'Spark, MapReduce and Hive jobs',
          'Dataproc first, later Serverless Spark or BigQuery',
          'dataproc',
        ],
        ['Hive warehouse', 'BigQuery, or Dataproc Metastore', 'bigquery'],
        ['HBase', 'Bigtable (it speaks the HBase API)', 'bigtable'],
        ['Kafka', 'Pub/Sub, or Managed Service for Apache Kafka', 'pubsub'],
        ['Oozie or cron', 'Cloud Composer (Airflow)', 'composer'],
      ],
      walk: [
        'The key move is HDFS to Cloud Storage. Storage and compute are now separate.',
        'Because the data no longer lives on the cluster, you can delete a cluster after each job and pay nothing while idle.',
        'Jobs move first with little change (lift and shift). You modernise them later.',
      ],
      caption:
        'Do not keep data in HDFS on Dataproc disks: it is expensive, and the data is deleted with the cluster.',
    },
  ],
};
