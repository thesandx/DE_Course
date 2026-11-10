import type { CompanyGuide } from '@/types/course';

/**
 * Loop guides for four Indian product companies that hire senior data
 * engineers in the 35 to 50 LPA band. The rounds come from what candidates
 * report, and they differ by team, so each guide says to confirm them.
 */
export const INDIA_COMPANIES: readonly CompanyGuide[] = [
  {
    slug: 'flipkart',
    name: 'Flipkart',
    summary:
      'A Spark-heavy loop: a hands-on Spark coding round, deep internals questions, then data design for e-commerce scale.',
    highlights: ['Spark internals', 'Kafka'],
    overview: `
      Flipkart runs one of the largest data platforms in India. Sale events such as Big Billion
      Days multiply normal traffic many times, so interviewers care about what your pipeline
      does at ten times the load. Candidates report three to five rounds, and say that strong
      SQL alone does not pass.

      ## What the senior bar looks like

      - **You write Spark, live.** A reported round gives several nested JSON files as tables
        and asks for a Spark program that joins them and produces a result. Know the DataFrame
        API without documentation: «explode», «from_json», joins, windows and aggregates.
      - **You explain what Spark does underneath.** Jobs, stages and tasks. Shuffle, caching,
        dynamic allocation, and the causes of an out of memory error on the driver and on an
        executor.
      - **You know Kafka consumption in depth.** Offsets, consumer groups, rebalances, lag and
        what exactly-once means from a topic to a table.
      - **You can still code.** Earlier reports include two array problems at medium level.

      ## Flipkart-flavoured topics to rehearse

      - Order, shipment and return modeling, with seller and product dimensions that change.
      - Sale-day traffic: backpressure, autoscaling, late data and replays.
      - NoSQL choices: when a wide-column store beats a relational database, and row key design.
      - A deep project discussion. Expect an hour of "why" on a design you built.

      > [!tip] Confirm the loop
      > Titles are Data Engineer II and III, or SDE on the data platform, which adds machine
      > coding and low-level design. Ask your recruiter which one you are interviewing for.
    `,
    rounds: [
      {
        name: 'Screening: coding',
        minutes: 60,
        focus:
          'Two problems on arrays, strings or hash maps at medium level, sometimes with a SQL question.',
        tracks: ['dsa', 'python', 'sql'],
      },
      {
        name: 'Spark coding',
        minutes: 90,
        focus:
          'Write a working Spark program on nested files: parse, join, aggregate. Then tuning, caching and out of memory questions.',
        tracks: ['spark', 'python'],
      },
      {
        name: 'Big data internals and streaming',
        minutes: 60,
        focus:
          'Spark execution, Kafka consumption, NoSQL stores and file formats. Each answer gets a "what happens underneath" follow-up.',
        tracks: ['spark', 'streaming', 'databases', 'lakehouse'],
      },
      {
        name: 'Data design',
        minutes: 60,
        focus:
          'Design a pipeline or a model for an e-commerce domain. Scale numbers, failure modes and how the design survives a sale day.',
        tracks: ['system-design', 'modeling', 'architecture', 'quality'],
      },
      {
        name: 'Hiring manager',
        minutes: 45,
        focus:
          'A deep dive into one project, then ownership, conflict and why you want to move. Know your numbers.',
        tracks: ['behavioral', 'staff'],
      },
    ],
    weights: {
      playbook: 0.5,
      databases: 0.9,
      sql: 0.9,
      python: 0.9,
      dsa: 1,
      modeling: 0.8,
      spark: 1.5,
      orchestration: 0.5,
      dbt: 0.1,
      streaming: 1.2,
      lakehouse: 0.8,
      'snowflake-databricks': 0.1,
      cloud: 0.4,
      quality: 0.6,
      architecture: 0.7,
      'system-design': 1.1,
      ai: 0.2,
      behavioral: 0.8,
      staff: 0.6,
    },
  },
  {
    slug: 'walmart',
    name: 'Walmart Global Tech',
    summary:
      'Medium-level coding and hard SQL first, then Spark architecture and a design round that expects you to lead.',
    highlights: ['Spark tuning', 'Coding'],
    overview: `
      Walmart Global Tech in Bengaluru and Chennai builds the data systems behind the largest
      retailer in the world: supply chain, pricing, store operations and e-commerce. It hires
      many data engineers at Data Engineer III and Senior Data Engineer, which sit in the 35 to
      50 LPA band. Candidates report three to five rounds.

      ## What the senior bar looks like

      - **Coding at medium level.** One or two problems of the kind a general software loop
        asks: arrays, strings, hash maps, two pointers, sometimes a tree or a graph.
      - **Hard SQL.** Self joins, window functions and multi-step queries on retail data.
      - **Spark is the most tested area.** How Spark works in detail, then optimisation: join
        strategy, partitioning, caching, skew and memory tuning. Some rounds ask a design
        question inside Spark, such as how to process a 1 TB daily feed in a fixed window.
      - **You lead the design round.** At senior level the interviewer expects you to set the
        scope, name the trade-offs and drive the discussion.

      ## Walmart-flavoured topics to rehearse

      - Inventory and sales modeling: store, item, day grain; snapshots against transactions.
      - Batch at retail scale on Hive and Spark tables, and the move to open table formats.
      - Orchestration with Airflow: backfills, dependencies across teams and service levels.
      - Multi-cloud facts: Walmart runs on its own cloud plus Google Cloud and Azure, so expect
        questions that are not tied to one vendor.

      > [!tip] Confirm the loop
      > Ask your recruiter whether the first round is coding or Spark. Teams differ, and the
      > answer changes what you revise the night before.
    `,
    rounds: [
      {
        name: 'Screening: coding and SQL',
        minutes: 60,
        focus:
          'One or two medium coding problems and a SQL question with a self join or a window function.',
        tracks: ['dsa', 'sql', 'python'],
      },
      {
        name: 'Big data round 1: Spark',
        minutes: 60,
        focus:
          'Spark fundamentals, then a PySpark or Scala exercise. Joins, caching, tuning and reading a slow job.',
        tracks: ['spark', 'lakehouse'],
      },
      {
        name: 'Big data round 2: architecture',
        minutes: 60,
        focus:
          'Spark architecture in depth and a Spark-centred design question. Kafka, Hive and Airflow follow-ups.',
        tracks: ['spark', 'streaming', 'orchestration', 'databases'],
      },
      {
        name: 'System design',
        minutes: 60,
        focus:
          'A retail pipeline end to end: ingestion, modeling, serving, quality and cost. You drive the conversation.',
        tracks: ['system-design', 'modeling', 'architecture', 'quality', 'cloud'],
      },
      {
        name: 'Hiring manager',
        minutes: 45,
        focus:
          'Your projects, how you handle disagreement and delivery pressure, and what you want from the role.',
        tracks: ['behavioral', 'staff'],
      },
    ],
    weights: {
      playbook: 0.5,
      databases: 0.7,
      sql: 1.2,
      python: 0.8,
      dsa: 1.1,
      modeling: 0.9,
      spark: 1.5,
      orchestration: 0.8,
      dbt: 0.2,
      streaming: 0.9,
      lakehouse: 0.8,
      'snowflake-databricks': 0.2,
      cloud: 0.6,
      quality: 0.6,
      architecture: 0.7,
      'system-design': 1.1,
      ai: 0.3,
      behavioral: 0.8,
      staff: 0.6,
    },
  },
  {
    slug: 'phonepe',
    name: 'PhonePe',
    summary:
      'An engineering-first loop: strong coding, then pipeline design where money must be correct at payment scale.',
    highlights: ['Coding', 'Correctness'],
    overview: `
      PhonePe processes a large share of UPI payments in India, so its data volume grows with
      every transaction in the country. Engineering runs the hiring, and candidates report a
      loop of about four rounds that looks like a software engineer loop with data pipelines,
      Spark and SQL added.

      ## What the senior bar looks like

      - **Coding is a real filter.** Expect a medium to hard problem. Clean, working code
        matters more than a clever idea you cannot finish.
      - **Correctness of money.** A payment event must count once. You explain idempotency
        keys, deduplication, reconciliation against the source of truth, and what you do when
        two systems disagree.
      - **Throughput and latency numbers.** You estimate events per second, storage per day and
        the cost of each stage before you choose a tool.
      - **Depth in what you claim.** The interviewer picks one technology from your resume and
        goes down until you stop.

      ## PhonePe-flavoured topics to rehearse

      - Transaction lifecycle modeling: initiated, pending, success, failed, reversed, refunded.
      - Exactly-once claims from a queue to a store, and where they break.
      - Fraud and risk features: counts per user and per merchant over sliding windows.
      - Reconciliation pipelines: compare two ledgers, report breaks, and fix them safely.

      > [!tip] Confirm the loop
      > Ask your recruiter whether there is a machine coding round. It needs different practice:
      > a small working program with clean classes in 90 minutes.
    `,
    rounds: [
      {
        name: 'Coding',
        minutes: 60,
        focus:
          'One or two data structures problems, medium to hard. Working code, tests and complexity.',
        tracks: ['dsa', 'python'],
      },
      {
        name: 'Data pipelines, Spark and SQL',
        minutes: 60,
        focus:
          'SQL on transaction data, a Spark exercise, and questions on how each one runs underneath.',
        tracks: ['sql', 'spark', 'streaming', 'databases'],
      },
      {
        name: 'Data system design',
        minutes: 60,
        focus:
          'A pipeline where correctness comes first: payments analytics, reconciliation or fraud signals. Numbers and failure modes.',
        tracks: ['system-design', 'streaming', 'quality', 'architecture'],
      },
      {
        name: 'Hiring manager',
        minutes: 45,
        focus:
          'Ownership of production systems, incidents you handled, and a deep dive into one project.',
        tracks: ['behavioral', 'staff'],
      },
    ],
    weights: {
      playbook: 0.5,
      databases: 1,
      sql: 1,
      python: 0.9,
      dsa: 1.4,
      modeling: 0.8,
      spark: 1,
      orchestration: 0.5,
      dbt: 0.1,
      streaming: 1.2,
      lakehouse: 0.6,
      'snowflake-databricks': 0.1,
      cloud: 0.3,
      quality: 0.9,
      architecture: 0.7,
      'system-design': 1.2,
      ai: 0.2,
      behavioral: 0.8,
      staff: 0.6,
    },
  },
  {
    slug: 'swiggy',
    name: 'Swiggy',
    summary:
      'A three to four round loop on SQL, data modeling and real-time design for a food and grocery delivery marketplace.',
    highlights: ['Real time', 'Modeling'],
    overview: `
      Swiggy runs food delivery, Instamart quick commerce and Dineout on one marketplace of
      customers, restaurants and delivery partners. Like Uber, the business moves in minutes,
      so the data questions are about freshness and events. Candidates report three to four
      rounds and a decision within two to three weeks.

      ## What the senior bar looks like

      - **Fluent SQL on marketplace data.** Order funnels, delivery times, cohort retention and
        ranking of restaurants, written without help.
      - **Models that answer business questions.** Orders, order items, delivery legs and
        partner shifts, with the grain stated and the slow-changing parts handled.
      - **Real-time design.** Reported questions include tracking delivery partners live and
        processing order events from Kafka at about 200,000 events a minute.
      - **Some coding.** A general problem at easy to medium level, and questions about the
        tools on your resume.

      ## Swiggy-flavoured topics to rehearse

      - Order lifecycle: placed, confirmed, prepared, picked up, delivered, cancelled, refunded.
      - Delivery time metrics: promised against actual, by city, zone and hour.
      - Demand and supply per zone in near real time, and what it costs to make it fresher.
      - Experiment data: assigning users to variants and computing metrics without double counts.

      > [!tip] Confirm the loop
      > The same loop shape fits Zomato, Zepto and other delivery companies. Ask each recruiter
      > for the round list, because small teams change it often.
    `,
    rounds: [
      {
        name: 'Recruiter screen',
        minutes: 30,
        focus: 'Background, current scope, expected level and notice period.',
        tracks: ['playbook'],
      },
      {
        name: 'Technical 1: SQL and coding',
        minutes: 60,
        focus:
          'Two or three SQL problems on order data, then one coding problem. Explain your approach before you write.',
        tracks: ['sql', 'python', 'dsa'],
      },
      {
        name: 'Technical 2: modeling and pipeline design',
        minutes: 60,
        focus:
          'Model a delivery domain, then design the batch and real-time pipelines that fill it. Spark, Kafka and orchestration follow-ups.',
        tracks: ['modeling', 'system-design', 'streaming', 'spark', 'orchestration', 'dbt'],
      },
      {
        name: 'Hiring manager',
        minutes: 45,
        focus:
          'Impact, ownership, working with analysts and product managers, and how you handle a data incident.',
        tracks: ['behavioral', 'quality', 'staff'],
      },
    ],
    weights: {
      playbook: 0.5,
      databases: 0.6,
      sql: 1.4,
      python: 0.8,
      dsa: 0.7,
      modeling: 1.2,
      spark: 1,
      orchestration: 0.8,
      dbt: 0.5,
      streaming: 1.1,
      lakehouse: 0.7,
      'snowflake-databricks': 0.4,
      cloud: 0.5,
      quality: 0.7,
      architecture: 0.6,
      'system-design': 1.1,
      ai: 0.3,
      behavioral: 0.8,
      staff: 0.5,
    },
  },
];
