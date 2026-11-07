import type { CompanyGuide } from '@/types/course';

/**
 * Loop guides for the target companies. Loops change by team and by year, so
 * each guide says what is typical and tells the learner to confirm the exact
 * rounds with their recruiter.
 */
export const COMPANIES: readonly CompanyGuide[] = [
  {
    slug: 'uber',
    name: 'Uber',
    summary:
      'Real-time marketplace data at huge scale: trips, pricing, payments and maps, fed by Kafka and a Hudi lakehouse.',
    highlights: ['Streaming', 'Modeling'],
    overview: `
      Uber's data platform serves a two-sided marketplace that changes every second. Interviewers
      care about freshness, correctness of money, and systems that keep working while thousands of
      engineers publish events into them. Expect your design answers to be judged on how they
      behave at Uber scale: trillions of Kafka messages a day, petabytes landing in the lake, and
      dashboards that city operations teams act on in minutes.

      ## What the senior bar looks like

      - You drive the design conversation. You ask about freshness, scale and consumers before you draw.
      - You know the stack Uber built in the open: **Kafka** for events, **Apache Hudi** for incremental
        upserts on the lake (Uber created it), **Apache Pinot** for real-time OLAP, **Presto/Trino** and
        **Spark** for batch, **Flink** for streaming. You can say why each exists.
      - You reason about late and duplicate events, because mobile phones go offline and retry.
      - Your stories show ownership across teams: you set a data contract, led a migration, or cut cost.

      ## Uber-flavoured topics to rehearse

      - Trip lifecycle modeling: requested, accepted, picked up, completed, cancelled, with surge and fare facts.
      - Real-time features: driver supply per hexagon (H3 cells), surge multipliers, ETA quality.
      - Incremental processing: upserts and change capture into the lake instead of daily full rebuilds.
      - Money correctness: idempotent payment events, reconciliation, exactly-once claims and their limits.

      > [!tip] Confirm the loop
      > Rounds differ by org (Mobility, Delivery, Freight, Platform). Ask your recruiter for the round
      > list and the language options, then weight your plan with the readiness score on this page.
    `,
    rounds: [
      {
        name: 'Recruiter and hiring manager screen',
        minutes: 30,
        focus:
          'Your scope, your biggest data system and why you want Uber. Have a two-minute version of your best project.',
        tracks: ['behavioral', 'playbook'],
      },
      {
        name: 'Technical screen: SQL and coding',
        minutes: 60,
        focus:
          'One or two SQL problems with window functions or sessionization, then a Python data-manipulation task. Talk while you type.',
        tracks: ['sql', 'python'],
      },
      {
        name: 'Onsite: data modeling',
        minutes: 60,
        focus:
          'Model a marketplace domain such as trips, deliveries or payments. Grain, facts, dimensions, slowly changing attributes and the queries the model must serve.',
        tracks: ['modeling', 'dbt', 'lakehouse'],
      },
      {
        name: 'Onsite: data system design',
        minutes: 60,
        focus:
          'Design a pipeline end to end, often real-time: surge signals, trip analytics or event ingestion. Scale numbers, failure modes and trade-offs.',
        tracks: ['system-design', 'databases', 'streaming', 'spark', 'quality', 'ai'],
      },
      {
        name: 'Onsite: coding',
        minutes: 60,
        focus:
          'A practical problem in Python or another language: parsing, aggregation, intervals or a small streaming algorithm. Clean code and tests matter.',
        tracks: ['python'],
      },
      {
        name: 'Onsite: behavioral and leadership',
        minutes: 45,
        focus:
          'Ownership, conflict, ambiguity and impact at senior scope. Expect follow-ups that test whether you led the work or watched it.',
        tracks: ['behavioral'],
      },
    ],
    weights: {
      playbook: 0.5,
      databases: 0.7,
      sql: 1,
      python: 1,
      modeling: 1,
      spark: 0.8,
      orchestration: 0.5,
      dbt: 0.5,
      streaming: 1,
      lakehouse: 0.8,
      'snowflake-databricks': 0.4,
      cloud: 0.5,
      quality: 0.6,
      architecture: 0.7,
      'system-design': 1.2,
      ai: 0.4,
      behavioral: 1,
      staff: 0.8,
    },
  },
  {
    slug: 'google',
    name: 'Google',
    summary:
      'Planet-scale analytics on BigQuery, Dataflow and Pub/Sub, with a structured loop and a hiring committee.',
    highlights: ['BigQuery', 'SQL'],
    overview: `
      Google's loop is structured. Each interviewer scores you against fixed attributes, writes
      detailed feedback, and a hiring committee decides from those notes. That means every round
      has to produce clear evidence. Say your reasoning out loud, state trade-offs explicitly, and
      close each answer with a summary an interviewer can write down.

      ## What the senior bar looks like

      - Coding is real coding. Expect data structures and algorithms at a practical level, in Python or
        another language, with complexity analysis and tests.
      - SQL is fluent: window functions, deduplication and correctness on edge cases, with no autocomplete.
      - Design answers are grounded in Google's own model of data processing: the ideas from **MapReduce**,
        **FlumeJava**, **MillWheel** and the **Dataflow model** (event time, watermarks, triggers), which
        became **Apache Beam** and Cloud Dataflow. **BigQuery** comes from **Dremel**: columnar storage and a
        tree of query servers.
      - Googleyness and leadership: you show humility, you raise problems early, you make the team better.

      ## Google-flavoured topics to rehearse

      - Ads and YouTube-style metrics: impressions, clicks, views, deduplication and fraud filtering.
      - Batch versus streaming with the same logic, and how a watermark decides when a window is complete.
      - BigQuery design: partitioning, clustering, nested and repeated fields, and slot cost.
      - Privacy: retention, deletion requests and access controls on user-level data.

      > [!tip] Confirm the loop
      > Google hires data engineers into several job families, such as Data Engineer and Software
      > Engineer, Data. The coding bar differs between them. Ask your recruiter which family and
      > level you are interviewing for.
    `,
    rounds: [
      {
        name: 'Recruiter screen',
        minutes: 30,
        focus:
          'Level, job family, timeline and a quick check of your background. Ask which rounds you will get.',
        tracks: ['playbook'],
      },
      {
        name: 'Technical phone screen',
        minutes: 45,
        focus:
          'A coding problem in a shared doc with no autocomplete, sometimes plus SQL. Explain complexity and test with examples.',
        tracks: ['python', 'sql'],
      },
      {
        name: 'Onsite: coding',
        minutes: 45,
        focus:
          'Data structures and algorithms with a data flavour: hashing, heaps, intervals, streams. Usually two coding rounds.',
        tracks: ['python'],
      },
      {
        name: 'Onsite: SQL and data modeling',
        minutes: 45,
        focus:
          'Design a schema for a product such as ads or YouTube, then query it. Grain, keys and BigQuery-friendly layouts.',
        tracks: ['sql', 'modeling', 'dbt', 'lakehouse'],
      },
      {
        name: 'Onsite: data system design',
        minutes: 45,
        focus:
          'An end-to-end pipeline with batch and streaming paths. Watermarks, exactly-once claims, backfills and cost.',
        tracks: [
          'system-design',
          'databases',
          'streaming',
          'spark',
          'orchestration',
          'quality',
          'ai',
        ],
      },
      {
        name: 'Onsite: Googleyness and leadership',
        minutes: 45,
        focus:
          'Collaboration, handling ambiguity, doing the right thing and leading without authority. Specific stories, not principles.',
        tracks: ['behavioral'],
      },
    ],
    weights: {
      playbook: 0.5,
      databases: 0.8,
      sql: 1,
      python: 1.3,
      modeling: 1,
      spark: 0.6,
      orchestration: 0.5,
      dbt: 0.4,
      streaming: 0.8,
      lakehouse: 0.7,
      'snowflake-databricks': 0.2,
      cloud: 0.4,
      quality: 0.6,
      architecture: 0.7,
      'system-design': 1.2,
      ai: 0.4,
      behavioral: 1,
      staff: 0.8,
    },
  },
];
