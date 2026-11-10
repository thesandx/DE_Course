import type { CompanyGuide } from '@/types/course';

/**
 * Loop guides for Amazon, Microsoft and Meta. The rounds are what candidates
 * typically report, not an official list, so each guide tells the learner to
 * confirm the rounds with their recruiter.
 */
export const BIG_TECH_COMPANIES: readonly CompanyGuide[] = [
  {
    slug: 'amazon',
    name: 'Amazon',
    summary:
      'A SQL and data modeling loop where every round also scores the Leadership Principles, and a Bar Raiser holds a veto.',
    highlights: ['Leadership Principles', 'SQL'],
    overview: `
      Amazon is one of the largest hirers of data engineers in the 35 to 50 LPA band in India. Its loop
      differs from every other loop in one way: **half of every round is behavioral**. Each
      interviewer owns two or three **Leadership Principles** and asks story questions about
      them before or after the technical part. A strong technical loop with weak stories is a
      rejection.

      ## What the senior bar looks like

      - **SQL is the core skill.** Expect four to six queries in a round: joins, window
        functions, deduplication, running totals and date logic. Speed and correctness both count.
      - **Data modeling is practical.** You model a business process such as orders, returns or
        Prime Video viewing, then write the queries that prove the model works.
      - **ETL design is concrete.** You name the AWS services: **S3**, **Glue**, **EMR**,
        **Redshift**, **Kinesis**, **Lambda** and **Step Functions**. You say why you chose each one.
      - **Stories have numbers.** Every story follows STAR and ends with a measured result.
        The interviewer digs for two or three levels of detail, so a story you did not live
        falls apart.

      ## The Bar Raiser

      One interviewer comes from another organization and is trained to protect the hiring bar.
      The Bar Raiser can veto the hire, even when the team wants you. This round is mostly
      behavioral. Treat it as the most important hour of the loop.

      ## Amazon-flavoured topics to rehearse

      - Order and fulfilment modeling: order, order item, shipment, return, refund.
      - Slowly changing dimensions, and how a late-arriving fact finds the right dimension row.
      - Redshift design: distribution keys, sort keys and why a query scans every block.
      - Two stories for each of the principles most asked of engineers: **Customer Obsession**,
        **Ownership**, **Dive Deep**, **Deliver Results**, **Have Backbone; Disagree and Commit**
        and **Earn Trust**.

      > [!tip] Confirm the loop
      > The title is Data Engineer II for mid-senior and Senior Data Engineer for senior. Some
      > teams add a coding round with data structures. Ask your recruiter which rounds you get,
      > then prepare the story bank on this site before anything else.
    `,
    rounds: [
      {
        name: 'Online assessment or phone screen',
        minutes: 60,
        focus:
          'SQL queries and one Python task, plus two Leadership Principle questions. The screen already scores stories.',
        tracks: ['sql', 'python', 'behavioral'],
      },
      {
        name: 'Onsite: SQL',
        minutes: 60,
        focus:
          'Four to six queries of rising difficulty on one schema. Window functions, self joins and edge cases with NULL. Then two story questions.',
        tracks: ['sql', 'behavioral'],
      },
      {
        name: 'Onsite: data modeling',
        minutes: 60,
        focus:
          'Model a retail or media process. Grain, facts, dimensions, history. Then query your own model. Then two story questions.',
        tracks: ['modeling', 'databases', 'behavioral'],
      },
      {
        name: 'Onsite: ETL and system design',
        minutes: 60,
        focus:
          'Design a batch or streaming pipeline on AWS. Idempotency, backfills, data quality and cost. Then two story questions.',
        tracks: ['system-design', 'cloud', 'orchestration', 'quality', 'spark'],
      },
      {
        name: 'Onsite: coding',
        minutes: 60,
        focus:
          'A Python problem on strings, hash maps or intervals. Some teams ask a classic data structures question at medium level.',
        tracks: ['python', 'dsa'],
      },
      {
        name: 'Onsite: Bar Raiser',
        minutes: 60,
        focus:
          'Mostly Leadership Principles, with deep follow-ups. Sometimes a design discussion. The Bar Raiser can veto the hire.',
        tracks: ['behavioral', 'staff'],
      },
    ],
    weights: {
      playbook: 0.5,
      databases: 0.7,
      sql: 1.4,
      python: 0.9,
      dsa: 0.6,
      modeling: 1.2,
      spark: 0.7,
      orchestration: 0.6,
      dbt: 0.3,
      streaming: 0.6,
      lakehouse: 0.6,
      'snowflake-databricks': 0.2,
      cloud: 0.9,
      quality: 0.6,
      architecture: 0.6,
      'system-design': 1,
      ai: 0.3,
      behavioral: 1.5,
      staff: 0.7,
    },
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    summary:
      'A coding-first loop with a Spark and Azure design round, closed by a senior leader in the "as appropriate" round.',
    highlights: ['Coding', 'Spark on Azure'],
    overview: `
      Microsoft India hires data engineers in Hyderabad, Bengaluru and Noida, mostly with the
      title Software Engineer or Data Engineer inside product groups such as Azure Data, Bing,
      Office and Dynamics. Most teams run a **software engineer style loop**: the coding rounds
      use data structures and algorithms, and the design round is about data.

      ## What the senior bar looks like

      - **Coding is classic.** Arrays, strings, hash maps, trees, graphs and simple dynamic
        programming at medium level. You write code that compiles, and you test it out loud.
      - **Spark depth.** Many teams run on Spark through **Azure Databricks**, **Synapse** or
        **Microsoft Fabric**. Expect shuffle, skew, partitioning and join strategy questions.
      - **Azure fluency helps.** **ADLS Gen2**, **Data Factory**, **Event Hubs**, **Synapse**,
        **Fabric** and **Cosmos DB**. Map each one to the open-source tool it replaces.
      - **Growth mindset.** The behavioral bar asks how you learn, how you take feedback and how
        you help other people succeed.

      ## The "as appropriate" round

      If the earlier rounds go well, a senior leader holds a final round, known as the
      **AA round**. It mixes design judgement, your career story and culture. This interviewer
      often makes the final call, and can set your level.

      ## Microsoft-flavoured topics to rehearse

      - Delta Lake on ADLS: merge, compaction, Z-order and time travel.
      - Multi-tenant platform design: isolation, quotas and cost attribution per tenant.
      - Telemetry pipelines at scale: client events, privacy scrubbing and compliance boundaries.
      - A project story told at three depths: two minutes, ten minutes and a whiteboard hour.

      > [!tip] Confirm the loop
      > Levels 63 and 64 are senior. Level 65 and above is principal. Ask your recruiter which
      > level and which team, because the amount of classic coding differs by team.
    `,
    rounds: [
      {
        name: 'Recruiter screen and online assessment',
        minutes: 75,
        focus:
          'Two coding problems on a test platform for many teams, then a call about level, team and location.',
        tracks: ['dsa', 'python', 'playbook'],
      },
      {
        name: 'Onsite: coding 1',
        minutes: 60,
        focus:
          'A data structures problem at medium level. State the brute force, improve it, give complexity, then test with edge cases.',
        tracks: ['dsa', 'python'],
      },
      {
        name: 'Onsite: coding 2 with SQL',
        minutes: 60,
        focus:
          'A second coding problem, often with a SQL or PySpark part: top N per group, sessions or a running total.',
        tracks: ['dsa', 'sql', 'spark'],
      },
      {
        name: 'Onsite: data system design',
        minutes: 60,
        focus:
          'An end-to-end pipeline or a platform component on Azure. Spark tuning, lake layout, schema evolution and cost.',
        tracks: [
          'system-design',
          'spark',
          'lakehouse',
          'snowflake-databricks',
          'cloud',
          'streaming',
        ],
      },
      {
        name: 'Onsite: as appropriate (AA)',
        minutes: 60,
        focus:
          'A senior leader checks design judgement, growth mindset and scope. Bring one deep project and one failure story.',
        tracks: ['behavioral', 'staff', 'architecture'],
      },
    ],
    weights: {
      playbook: 0.5,
      databases: 0.7,
      sql: 0.9,
      python: 1,
      dsa: 1.4,
      modeling: 0.7,
      spark: 1.1,
      orchestration: 0.5,
      dbt: 0.2,
      streaming: 0.7,
      lakehouse: 0.9,
      'snowflake-databricks': 0.8,
      cloud: 0.8,
      quality: 0.5,
      architecture: 0.7,
      'system-design': 1.1,
      ai: 0.4,
      behavioral: 0.9,
      staff: 0.8,
    },
  },
  {
    slug: 'meta',
    name: 'Meta',
    summary:
      'A fast SQL and Python screen, then onsite rounds that mix product sense, data modeling and ETL in one hour.',
    highlights: ['Product sense', 'Speed'],
    overview: `
      Meta hires data engineers into product teams, and the loop shows it. A Meta data engineer
      sits next to data scientists and product managers and owns the datasets and metrics they
      trust. So the loop tests **speed in SQL and Python** and **product sense**, and it tests
      distributed systems internals less than Uber or Google do. Meta has far fewer data
      engineering roles in India than Amazon or Microsoft, so many candidates from India
      interview for London or Singapore.

      ## What the senior bar looks like

      - **Speed.** The screen has about five SQL questions and five Python questions in an
        hour. Each one is easy to medium. You pass by finishing most of them correctly.
      - **Product sense.** You get a product such as Reels or Marketplace. You choose the
        metrics that show its health, and you say what you do when a metric drops.
      - **Modeling follows the metric.** You design the fact and dimension tables that serve
        those metrics, and you state the grain first.
      - **One problem, three skills.** An onsite round moves from metric to model to SQL to a
        Python transform on the same scenario. Keep each part consistent with the last.

      ## Meta-flavoured topics to rehearse

      - Daily, weekly and monthly active users, and the rolling-window tables that make them cheap.
      - Engagement and retention metrics, and one counter-metric for each.
      - A metric dropped 10 percent overnight: data bug, product change or real behaviour?
      - Python without libraries: dictionaries, sets, string parsing and nested lists.

      > [!tip] Confirm the loop
      > Senior is IC5 and staff is IC6. Ask your recruiter how many "full stack" data
      > engineering rounds you get, and practise complete rounds against a 45 minute clock.
    `,
    rounds: [
      {
        name: 'Recruiter screen',
        minutes: 30,
        focus: 'Your background, level and timeline. Ask for the preparation guide Meta sends.',
        tracks: ['playbook'],
      },
      {
        name: 'Technical screen: SQL and Python',
        minutes: 60,
        focus:
          'About five SQL and five Python questions in a shared editor that does not run code. Accuracy at speed.',
        tracks: ['sql', 'python'],
      },
      {
        name: 'Onsite: product sense and data modeling',
        minutes: 60,
        focus:
          'Pick metrics for a product, design the tables that serve them, and write the SQL for one metric.',
        tracks: ['playbook', 'modeling', 'sql'],
      },
      {
        name: 'Onsite: ETL round 1',
        minutes: 60,
        focus:
          'One scenario from model to SQL to a Python transform. Incremental loads, late data and data quality checks.',
        tracks: ['modeling', 'sql', 'python', 'quality'],
      },
      {
        name: 'Onsite: ETL round 2',
        minutes: 60,
        focus:
          'A second scenario, usually harder: streaming aggregates, sessions or a recommendation dataset.',
        tracks: ['sql', 'python', 'streaming', 'orchestration'],
      },
      {
        name: 'Onsite: behavioral (ownership)',
        minutes: 45,
        focus:
          'Conflict, feedback, cross-functional influence and impact. Meta scores how you work with partners who are not engineers.',
        tracks: ['behavioral', 'staff'],
      },
    ],
    weights: {
      playbook: 0.9,
      databases: 0.5,
      sql: 1.5,
      python: 1.3,
      dsa: 0.5,
      modeling: 1.3,
      spark: 0.4,
      orchestration: 0.5,
      dbt: 0.3,
      streaming: 0.6,
      lakehouse: 0.4,
      'snowflake-databricks': 0.1,
      cloud: 0.2,
      quality: 0.8,
      architecture: 0.5,
      'system-design': 0.7,
      ai: 0.3,
      behavioral: 1.1,
      staff: 0.7,
    },
  },
];
