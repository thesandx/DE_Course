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
      title: 'The standard streaming pipeline on Google Cloud',
      scenario:
        'Cymbal has 50,000 delivery vans. Each van sends its position every second. The business wants live dashboards, fast lookups per van, and the raw data kept for later.',
      steps: [
        {
          n: 1,
          icon: 'device',
          label: 'Vans and apps',
          note: 'Send small events all day. Sometimes many at once.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'pubsub',
          label: 'Pub/Sub',
          note: 'Takes every event at once and holds it until it is read.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'dataflow',
          label: 'Dataflow',
          note: 'Reads the events, cleans them and groups them by time.',
          tone: 'brand',
        },
      ],
      edges: ['publish', 'read'],
      fork: {
        label: 'step 4: Dataflow writes each result where it is used',
        boxes: [
          {
            icon: 'bigquery',
            label: 'BigQuery',
            note: 'For SQL analysis and dashboards.',
            tone: 'sky',
          },
          {
            icon: 'bigtable',
            label: 'Bigtable',
            note: 'For "where is van 42 now?" in milliseconds.',
            tone: 'teal',
          },
          {
            icon: 'cloud-storage',
            label: 'Cloud Storage',
            note: 'The raw events, kept unchanged, so you can process them again.',
            tone: 'gold',
          },
        ],
      },
      walk: [
        'The vans produce events. They do not wait for anyone downstream.',
        'Pub/Sub is the buffer. If the pipeline is slow or down, events wait here and nothing is lost.',
        'Dataflow is the processing engine. One programming model (Apache Beam) covers streams and batches.',
        'Each destination serves one need: analysis, fast lookups, or the raw archive.',
      ],
      caption:
        'Never write devices straight into BigQuery or a database: put Pub/Sub in between. For changes in a database, the standard path is database → Datastream → BigQuery.',
    },
    {
      concept: 1,
      kind: 'compare',
      title: 'ETL or ELT: where does the transform happen?',
      scenario:
        'Cymbal loads order files every night. Should the data be cleaned before it reaches the warehouse, or after?',
      columns: [
        {
          icon: 'dataflow',
          label: 'ETL: Extract, Transform, Load',
          note: 'Clean it on the way in.',
          tone: 'iris',
          points: [
            'A pipeline (Dataflow, Data Fusion or Spark) changes the data before the warehouse.',
            'Use it for streams, for heavy logic, or to remove PII before it lands.',
            'If the logic had a bug, the raw data is gone unless you also archived it.',
          ],
        },
        {
          icon: 'bigquery',
          label: 'ELT: Extract, Load, Transform',
          note: 'Load it raw, clean it with SQL.',
          tone: 'teal',
          points: [
            'Load the raw data into BigQuery first, unchanged.',
            'Build clean tables from it with SQL (Dataform).',
            'A bug is easy to fix: the raw data is still there, so run the SQL again.',
          ],
        },
      ],
      walk: [
        'In ETL, a separate engine transforms the data before it is stored for analysis.',
        'In ELT, BigQuery stores the raw data and BigQuery itself does the transform.',
      ],
      caption:
        'ELT is the default for analytics on Google Cloud: it is cheaper to build and you keep the raw data. Always land raw data unchanged first.',
    },
    {
      concept: 2,
      kind: 'hub',
      title: 'What private pipeline workers need from the network',
      scenario:
        'Security at Cymbal says: Dataflow and Dataproc workers get no public IP address. The job then hangs. Each thing a worker must reach needs its own network piece.',
      center: {
        icon: 'dataflow',
        label: 'Workers with no public IP',
        note: 'They run in one subnet of your VPC, in one region.',
      },
      spokes: [
        {
          n: 1,
          icon: 'private-access',
          label: 'To Google APIs',
          note: 'Turn on Private Google Access on the subnet. Now workers reach BigQuery and Cloud Storage.',
          tone: 'teal',
        },
        {
          n: 2,
          icon: 'nat',
          label: 'To the internet',
          note: 'Add Cloud NAT, for example to download Python packages.',
          tone: 'gold',
        },
        {
          n: 3,
          icon: 'firewall',
          label: 'To each other',
          note: 'A firewall rule must allow TCP 12345 (streaming) and 12346 (batch) between workers.',
          tone: 'hard',
        },
        {
          n: 4,
          icon: 'vpn',
          label: 'To your data centre',
          note: 'Cloud VPN for modest traffic, Interconnect for heavy traffic.',
          tone: 'iris',
        },
        {
          n: 5,
          icon: 'cloud-sql',
          label: 'To Cloud SQL',
          note: 'Use the private IP, or the Cloud SQL Auth Proxy.',
          tone: 'sky',
        },
        {
          n: 6,
          icon: 'vpc',
          label: 'Shared VPC',
          note: 'A central host project owns the network. Give the job the full subnet URL.',
          tone: 'plain',
        },
      ],
      walk: [
        'Without a public IP, a worker cannot reach Google APIs. Private Google Access fixes that.',
        'For anything on the public internet, the worker goes out through Cloud NAT.',
        'Workers exchange data with each other. If the firewall blocks ports 12345 and 12346, the job hangs.',
        'On-premises sources are reached over Cloud VPN or Interconnect.',
        'Cloud SQL is reached on its private IP.',
        'In a Shared VPC, the network belongs to another project, so name the subnet in full.',
      ],
      caption:
        'A Dataflow job stuck with "workers cannot communicate" is missing the firewall rule for 12345 and 12346. A VPC is global; a subnet is regional.',
    },
    {
      concept: 3,
      kind: 'flow',
      title: 'Where encryption happens along a pipeline',
      scenario:
        'Cymbal must use its own keys everywhere, and analysts must never see a raw card number. Follow one record and see what protects it at each stop.',
      steps: [
        {
          n: 1,
          icon: 'server',
          label: 'Source system',
          note: 'Sends the record.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'pubsub',
          label: 'Pub/Sub topic',
          note: 'Messages at rest are encrypted with your key.',
          tone: 'iris',
          chips: ['CMEK'],
        },
        {
          n: 3,
          icon: 'dataflow',
          label: 'Dataflow',
          note: 'Your key protects its working state. A DLP step replaces the card number with a token.',
          tone: 'brand',
          chips: ['--dataflowKmsKey'],
        },
        {
          n: 4,
          icon: 'bigquery',
          label: 'BigQuery table',
          note: 'Stored with your key. It holds tokens, not card numbers.',
          tone: 'teal',
          chips: ['CMEK'],
        },
      ],
      edges: ['TLS', 'TLS', 'TLS'],
      walk: [
        'Between every two stops, the data travels inside TLS. That is automatic.',
        'At rest in Pub/Sub, the topic uses your customer-managed key (CMEK).',
        'Dataflow keeps temporary data while it works. One flag puts that under your key too. Sensitive Data Protection tokenises the card field here.',
        'The table uses your key, and the sensitive value never arrived.',
      ],
      caption:
        'In transit is automatic. At rest, you must name your key at every stop. To hide PII from downstream users, tokenise it inside the pipeline, before the sink.',
    },
  ],
  'building-pipelines': [
    {
      concept: 1,
      kind: 'flow',
      title: 'Pub/Sub: one topic, a full copy for every subscription',
      scenario:
        'Cymbal publishes each new order once. Four teams need it: fraud checks, a web service, the warehouse and an archive. Nobody should have to share or wait.',
      steps: [
        {
          n: 1,
          icon: 'server',
          label: 'Order service',
          note: 'Publishes each order once.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'pubsub',
          label: 'Topic: orders',
          note: 'Stores the message and hands a copy to every subscription.',
          tone: 'iris',
        },
      ],
      edges: ['publish'],
      fork: {
        label: 'step 3: every subscription gets every message',
        boxes: [
          {
            icon: 'dataflow',
            label: 'Pull subscription',
            note: 'The reader asks for messages. Fastest. Dataflow uses this.',
            tone: 'brand',
          },
          {
            icon: 'cloud-run',
            label: 'Push subscription',
            note: 'Pub/Sub calls your HTTPS service. A 2xx answer means "got it".',
            tone: 'gold',
          },
          {
            icon: 'bigquery',
            label: 'BigQuery subscription',
            note: 'Writes each message into a table. No code and no Dataflow.',
            tone: 'sky',
          },
          {
            icon: 'cloud-storage',
            label: 'Cloud Storage subscription',
            note: 'Collects messages into files in a bucket.',
            tone: 'teal',
          },
        ],
      },
      walk: [
        'The publisher sends to a topic and knows nothing about the readers.',
        'The topic keeps the message until each subscription has confirmed it (acknowledged it).',
        'Each subscription is an independent queue with its own copy. A slow reader does not slow the others.',
      ],
      caption:
        'To copy messages unchanged into BigQuery, use a BigQuery subscription, not Dataflow. Order is kept only with ordering keys. After several failed deliveries, a dead-letter topic takes the message.',
    },
    {
      concept: 1,
      kind: 'timeline',
      title: 'Why you get duplicate messages',
      scenario:
        'A push endpoint at Cymbal starts to see every order twice. Nothing is wrong with the topic. The endpoint is slow, and the clock below explains the rest.',
      axis: { start: 'delivered at 0 s', end: '25 s' },
      marks: [{ at: 40, label: 'ack deadline: 10 s' }],
      lanes: [
        {
          label: '1. Fast reader',
          spans: [{ start: 2, end: 30, label: 'acked', tone: 'easy' }],
          dots: [{ at: 2, tone: 'iris' }],
        },
        {
          label: '2. Slow reader',
          spans: [
            { start: 2, end: 40, label: 'still working…', tone: 'medium' },
            { start: 44, end: 84, label: 'sent again', tone: 'hard' },
          ],
          dots: [
            { at: 2, tone: 'iris' },
            { at: 44, tone: 'hard' },
          ],
        },
      ],
      walk: [
        'The fast reader finishes and acknowledges before the deadline. Pub/Sub deletes the message. Done.',
        'The slow reader is still working when the deadline passes. Pub/Sub thinks the message was lost and sends it again. Now the reader has it twice.',
      ],
      caption:
        'Pub/Sub delivers at least once. Duplicates come from missed ack deadlines, not from message size or volume. Extend the deadline, make the reader faster, or turn on exactly-once delivery on a pull subscription.',
    },
    {
      concept: 2,
      kind: 'flow',
      title: 'An Apache Beam pipeline, part by part',
      scenario:
        'Cymbal counts sales per store from a stream of JSON events. Some events are broken. The pipeline must keep running and keep the broken ones for inspection.',
      steps: [
        {
          n: 1,
          icon: 'pubsub',
          label: 'Read',
          note: 'A source gives a PCollection: the stream of events.',
          tone: 'iris',
          chips: ['ReadFromPubSub'],
        },
        {
          n: 2,
          icon: 'dataflow',
          label: 'ParDo with a DoFn',
          note: 'Your function runs on each event: parse it, and look up the store name.',
          tone: 'brand',
          chips: ['side input: store list'],
        },
      ],
      edges: ['PCollection'],
      fork: {
        label: 'step 3: the DoFn sends each event to one of two outputs',
        boxes: [
          {
            icon: 'bigquery',
            label: 'Good events: Combine per store, then write',
            note: '«Combine.perKey» adds up the sales per store. «BigQueryIO» writes the totals.',
            tone: 'easy',
          },
          {
            icon: 'warning',
            label: 'Broken events: dead-letter table',
            note: 'A second, tagged output. The pipeline does not fail.',
            tone: 'hard',
          },
        ],
      },
      walk: [
        'A pipeline starts with a read. The data it produces is called a PCollection, and it can be endless.',
        'ParDo applies your function (a DoFn) to every element. A side input gives it a small lookup table.',
        'A DoFn can have several outputs. Good events go to the aggregation, and broken ones go to a dead-letter table.',
      ],
      caption:
        'Use Combine, not GroupByKey followed by your own sum: Combine adds up partly on each worker and scales better. A side input must fit in memory; for a big lookup use CoGroupByKey.',
    },
    {
      concept: 3,
      kind: 'timeline',
      title: 'The four window types, on one hour of events',
      scenario:
        'A stream never ends, so "total sales" has no answer. You cut the stream into windows of time and total each window. The four window types cut the same hour differently.',
      axis: { start: 'event time 0 min', end: '60 min' },
      lanes: [
        {
          label: '1. Fixed',
          spans: [
            { start: 0, end: 25, label: '0–15', tone: 'sky' },
            { start: 25, end: 50, label: '15–30', tone: 'teal' },
            { start: 50, end: 75, label: '30–45', tone: 'sky' },
            { start: 75, end: 100, label: '45–60', tone: 'teal' },
          ],
        },
        {
          label: '2. Sliding',
          spans: [
            { start: 0, end: 50, label: '0–30', tone: 'iris', row: 0 },
            { start: 25, end: 75, label: '15–45', tone: 'brand', row: 1 },
            { start: 50, end: 100, label: '30–60', tone: 'iris', row: 0 },
          ],
        },
        {
          label: '3. Session',
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
        {
          label: '4. Global',
          spans: [{ start: 0, end: 100, label: 'one window for everything', tone: 'plain' }],
        },
      ],
      walk: [
        '**Fixed** windows have the same size and do not overlap. Example: sales for each 15 minutes.',
        '**Sliding** windows overlap. Here each window is 30 minutes long and a new one starts every 15. Example: "average of the last 30 minutes, updated every 15".',
        '**Session** windows follow one user. The dots are clicks. A window closes when the user is quiet for longer than the gap.',
        '**Global** is a single endless window. It gives results only if you add your own trigger.',
      ],
      caption:
        '"No activity for 60 minutes" describes a session window with a 60-minute gap, not a fixed window. Windows use event time (when it happened), not the time it arrived.',
    },
    {
      concept: 3,
      kind: 'timeline',
      title: 'Watermark, late data and triggers',
      scenario:
        'A van drives through a tunnel and sends its 12:03 reading at 12:09. The 12:00–12:05 window has already been totalled. What happens to the late reading?',
      axis: { start: 'time passes', end: 'later' },
      marks: [{ at: 55, label: 'watermark passes 12:05' }],
      lanes: [
        {
          label: 'Data for 12:00–12:05',
          spans: [
            { start: 5, end: 55, label: '1. on time', tone: 'easy' },
            { start: 55, end: 80, label: '3. late ok', tone: 'medium' },
            { start: 80, end: 100, label: '4. drop', tone: 'hard' },
          ],
        },
        {
          label: 'Results emitted',
          dots: [
            { at: 20, tone: 'plain' },
            { at: 38, tone: 'plain' },
            { at: 55, tone: 'brand' },
            { at: 70, tone: 'gold' },
          ],
        },
      ],
      walk: [
        'Data that arrives before the watermark is on time. Grey dots are early results, if you ask for them with an early trigger.',
        'The **watermark** is the system saying "I believe I have all data up to 12:05". At that moment it emits the main result (pink dot).',
        'Data that arrives after the watermark is late. Within the **allowed lateness** it is still accepted, and a late trigger emits a corrected result (gold dot).',
        'After the allowed lateness, late data for this window is thrown away.',
      ],
      caption:
        'When devices buffer and send late, use event time with allowed lateness and a late trigger. Accumulating mode replaces the earlier result; discarding mode sends only the new part.',
    },
    {
      concept: 4,
      kind: 'decision',
      title: 'How to change or stop a running streaming job',
      scenario:
        'A Dataflow streaming job at Cymbal has run for months. You have a new version of the code. Events are flowing right now, and you may not lose any.',
      questions: [
        {
          ask: 'Is the new pipeline compatible with the old one (same steps, or a mapping of renamed steps)?',
          yes: {
            icon: 'refresh',
            label: 'Update in place',
            note: 'Launch with «--update» and the same job name. The job keeps its state and loses nothing.',
            tone: 'easy',
          },
        },
        {
          ask: 'Not compatible. Must everything already read be finished?',
          yes: {
            icon: 'dataflow',
            label: 'Drain, then start the new job',
            note: 'Drain stops reading new input and finishes what is in flight. No data is lost.',
            tone: 'sky',
          },
        },
      ],
      otherwise: {
        icon: 'warning',
        label: 'Cancel',
        note: 'Stops at once. Whatever was in flight is lost.',
        tone: 'hard',
      },
      walk: [
        'Try Update first. It swaps the code under a running job.',
        'If the change is too big for Update, Drain the old job so it finishes cleanly, then start the new one.',
        'Cancel only when losing in-flight data does not matter.',
      ],
      caption:
        'Never Cancel to deploy when no data may be lost. A snapshot saves the job state so a new job can start from it. Flex templates are preferred over classic templates.',
    },
    {
      concept: 5,
      kind: 'flow',
      title: 'Dataproc: a cluster that lives only as long as the job',
      scenario:
        'Cymbal runs one Spark job each night for 40 minutes. A cluster that stays on all day is paid for 24 hours and used for less than one.',
      steps: [
        {
          n: 1,
          icon: 'dataproc',
          label: 'Create the cluster',
          note: 'Ready in about 90 seconds.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'cloud-storage',
          label: 'Run the job',
          note: 'Spark reads and writes Cloud Storage, not cluster disks. Table definitions live in Dataproc Metastore.',
          tone: 'brand',
          chips: ['gs://', 'Spot secondary workers'],
        },
        {
          n: 3,
          icon: 'dollar',
          label: 'Delete the cluster',
          note: 'The bill stops. The data is safe in Cloud Storage.',
          tone: 'easy',
        },
      ],
      walk: [
        'Start a cluster sized for this one job.',
        'The job keeps its data in Cloud Storage. Cheap Spot workers can add compute, because they hold no data.',
        'When the job ends, delete the cluster. You pay per second of use.',
      ],
      caption:
        'One big always-on cluster for nightly jobs is the trap. A workflow template does all three steps for you. Dataproc Serverless runs Spark with no cluster to manage.',
    },
    {
      concept: 6,
      kind: 'decision',
      title: 'Which way to load data into BigQuery?',
      scenario:
        'Data has to get into BigQuery. The right method depends on where it is now and how fresh it must be.',
      questions: [
        {
          ask: 'Is it files in Cloud Storage, and a delay of minutes is fine?',
          yes: {
            icon: 'cloud-storage',
            label: 'Batch load job',
            note: 'Free. All rows appear together or none do. Avro is the best format.',
            tone: 'easy',
          },
        },
        {
          ask: 'Is it Pub/Sub messages that need no change?',
          yes: {
            icon: 'pubsub',
            label: 'BigQuery subscription',
            note: 'Pub/Sub writes into the table itself. No code.',
            tone: 'iris',
          },
        },
        {
          ask: 'Does an app or a pipeline write rows that must be visible in seconds, exactly once?',
          yes: {
            icon: 'bigquery',
            label: 'Storage Write API',
            note: 'Streaming with exactly-once. Cheaper than the old streaming inserts.',
            tone: 'brand',
          },
        },
        {
          ask: 'Is it ongoing changes from an operational database?',
          yes: {
            icon: 'datastream',
            label: 'Datastream',
            note: 'Captures every insert, update and delete, and keeps a copy in BigQuery.',
            tone: 'sky',
          },
        },
      ],
      otherwise: {
        icon: 'table',
        label: 'External or BigLake table',
        note: 'Do not load. Query the files where they are. Slower.',
        tone: 'plain',
      },
      walk: [
        'Files that can wait: a load job, which costs nothing.',
        'Messages that need no transform: a BigQuery subscription.',
        'Rows that must be fresh and never doubled: the Storage Write API.',
        'A database to mirror: Datastream.',
      ],
      caption:
        'Gzip does not make a CSV load faster: a gzip file cannot be read in parallel. Rows from old streaming inserts sit in a buffer first and cannot be updated right away.',
    },
    {
      concept: 7,
      kind: 'decision',
      title: 'A new source appears: what do you reach for?',
      scenario:
        'A team at Cymbal asks you to bring a new data source into the platform. Before you write any code, ask these questions.',
      questions: [
        {
          ask: 'Do the producing apps already speak the Kafka protocol?',
          yes: {
            icon: 'stream',
            label: 'Managed Service for Apache Kafka',
            note: 'Keep Kafka, but Google runs the brokers. Dataflow reads it with KafkaIO.',
            tone: 'gold',
          },
        },
        {
          ask: 'Is the team standardised on Spark?',
          yes: {
            icon: 'dataproc',
            label: 'Spark Structured Streaming on Dataproc',
            note: 'They keep their skills and their code.',
            tone: 'iris',
          },
        },
        {
          ask: 'Does a ready-made connector exist for this source?',
          yes: {
            icon: 'datastream',
            label: 'Use the connector',
            note: 'Datastream, BigQuery Data Transfer Service, a Data Fusion plugin, or a Google Dataflow template.',
            tone: 'easy',
          },
        },
      ],
      otherwise: {
        icon: 'pubsub',
        label: 'Pub/Sub + Dataflow',
        note: 'The serverless default when nothing above applies.',
        tone: 'brand',
      },
      walk: [
        'Apps built for Kafka stay on Kafka, as a managed service.',
        'A Spark team stays on Spark.',
        'Otherwise look for a managed connector before you build anything.',
      ],
      caption:
        'Custom code is the last choice. Check for a managed connector or a Google template first.',
    },
    {
      concept: 8,
      kind: 'flow',
      title: 'Four places to remove duplicates',
      scenario:
        'The same order reaches Cymbal twice because a sender retried. If nothing removes the copy, revenue is counted twice. You can stop it at four points.',
      steps: [
        {
          n: 1,
          icon: 'pubsub',
          label: 'At publish',
          note: 'Give each message a stable id attribute.',
          tone: 'iris',
        },
        {
          n: 2,
          icon: 'dataflow',
          label: 'In the pipeline',
          note: 'Dataflow drops a message whose id it has seen.',
          tone: 'brand',
          chips: ['Deduplicate'],
        },
        {
          n: 3,
          icon: 'bigquery',
          label: 'At write',
          note: '«MERGE» on the order id updates the row and does not add a second one.',
          tone: 'sky',
        },
        {
          n: 4,
          icon: 'search',
          label: 'At query',
          note: 'Keep only the newest row per order id.',
          tone: 'teal',
          chips: ['ROW_NUMBER() = 1', 'QUALIFY'],
        },
      ],
      walk: [
        'The sender puts the real order id on the message, so a retry carries the same id.',
        'The pipeline remembers recent ids and drops repeats.',
        'The write uses MERGE on the business key, so a repeat overwrites.',
        'As a last defence, the query picks one row per id.',
      ],
      caption:
        'SUM over duplicated rows doubles the total. Never give each received record a new random id: the copy then looks unique. For resent payloads, store a hash of each record and compare.',
    },
    {
      concept: 9,
      kind: 'spectrum',
      title: 'Add AI to a pipeline: start with the least work',
      scenario:
        'Cymbal wants a sentiment label on every customer review. There are three ways to get it, and they differ in how much you must build.',
      from: 'Least work',
      to: 'Most control',
      stops: [
        {
          n: 1,
          icon: 'natural-language',
          label: 'A pre-trained API',
          note: 'Call the Natural Language, Vision, Speech or Document AI API. Nothing to train.',
          tone: 'easy',
        },
        {
          n: 2,
          icon: 'bigquery',
          label: 'Gemini from SQL',
          note: 'A remote model in BigQuery labels a text column with one query.',
          tone: 'sky',
          chips: ['AI.GENERATE', 'ML.GENERATE_EMBEDDING'],
        },
        {
          n: 3,
          icon: 'dataflow',
          label: 'Your model inside Dataflow',
          note: 'RunInference applies your own model to each event in the stream.',
          tone: 'brand',
          chips: ['RunInference'],
        },
      ],
      walk: [
        'A pre-trained API already knows sentiment. You send text and get a score.',
        'If the reviews are in BigQuery, call Gemini from SQL and stay in the warehouse.',
        'Only when you have your own model, or need it in the live stream, use RunInference.',
      ],
      caption:
        'Do not train a custom model when a pre-trained API or a Gemini call meets the need. Vertex AI is now named Gemini Enterprise Agent Platform; older questions say Vertex AI.',
    },
  ],
  'operationalizing-pipelines': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which tool should run the schedule?',
      scenario:
        'Cymbal has jobs that must run at the right time and in the right order. Google Cloud has five tools for this. Pick the smallest one that does the job.',
      questions: [
        {
          ask: 'Is it one job that fires on a timer?',
          yes: {
            icon: 'scheduler',
            label: 'Cloud Scheduler',
            note: 'Managed cron. It calls a URL or publishes a message.',
            tone: 'plain',
          },
        },
        {
          ask: 'Is it only SQL inside BigQuery?',
          yes: {
            icon: 'bigquery',
            label: 'Scheduled queries or Dataform',
            note: 'Scheduling is built in. No other tool is needed.',
            tone: 'teal',
          },
        },
        {
          ask: 'Must something happen when a file lands in a bucket?',
          yes: {
            icon: 'eventarc',
            label: 'Eventarc + Cloud Run functions',
            note: 'The event starts your code.',
            tone: 'gold',
          },
        },
        {
          ask: 'Is it a short chain of calls to Google APIs?',
          yes: {
            icon: 'workflows',
            label: 'Workflows',
            note: 'Serverless steps written in YAML. Cheap, and no Airflow.',
            tone: 'sky',
          },
        },
      ],
      otherwise: {
        icon: 'composer',
        label: 'Cloud Composer (Airflow)',
        note: 'Many steps across many services, with dependencies, retries, sensors and backfills.',
        tone: 'brand',
      },
      walk: [
        'A single timed job needs only Cloud Scheduler.',
        'SQL-only work is scheduled inside BigQuery.',
        'A reaction to an event uses Eventarc.',
        'A few API calls in a row fit Workflows.',
      ],
      caption:
        'Composer for one nightly query is too much. Airflow only orchestrates: the heavy work runs in Dataflow, BigQuery or Dataproc, never inside the Airflow workers.',
    },
    {
      concept: 2,
      kind: 'flow',
      title: 'CI/CD: how a pipeline change reaches production',
      scenario:
        'An engineer at Cymbal fixes a bug in a Dataflow pipeline. The fix must be tested and must reach production the same way every time, with no manual edits.',
      steps: [
        {
          n: 1,
          icon: 'code',
          label: 'Git',
          note: 'Pipeline code, SQL, DAGs and Terraform live here.',
          tone: 'plain',
        },
        {
          n: 2,
          icon: 'cloud-build',
          label: 'Cloud Build',
          note: 'Runs the unit tests and builds the image.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'artifact-registry',
          label: 'Artifact Registry',
          note: 'Stores the tested image (a Dataflow flex template).',
          tone: 'sky',
        },
        {
          n: 4,
          icon: 'project',
          label: 'Test project',
          note: 'The pipeline runs on a small data set.',
          tone: 'gold',
        },
        {
          n: 5,
          icon: 'dataflow',
          label: 'Production project',
          note: 'The same image is deployed. Terraform makes the resources identical.',
          tone: 'brand',
        },
      ],
      edges: ['push', 'build', 'deploy', 'promote'],
      walk: [
        'Every change starts as a commit in Git.',
        'Cloud Build tests it automatically.',
        'The built image is stored once in Artifact Registry.',
        'It runs first in a test project, with test data.',
        'The same image, not a rebuild, goes to production.',
      ],
      caption:
        'Never edit a DAG or SQL directly in production. Terraform keeps dev, test and prod the same, so a test result means something.',
    },
  ],
};
