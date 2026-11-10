import { designQuestions } from '@/lib/course/tracks/system-design-questions';
import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'system-design',
  title: 'Data system design',
  summary:
    'A repeatable framework, the building blocks, correctness at scale, and full designs for Uber and Google style prompts.',
  tone: 'butter',
  why: 'The design round carries the most weight in both loops and decides the level you are offered. It is where a senior engineer shows judgment, not recall.',
  lessons: [
    {
      slug: 'design-framework',
      title: 'A framework for the 45-minute design round',
      summary: 'Run a data design interview from vague prompt to defended architecture.',
      minutes: 15,
      body: `
        A design prompt is deliberately vague: "Design analytics for trips." The interviewer wants
        to see how you turn ambiguity into a system and defend its trade-offs. A steady structure
        keeps you from drawing boxes too early or running out of time before the deep dive.

        ## The six steps

        | Step | Minutes | What you produce |
        |---|---|---|
        | 1. Clarify | 5 to 7 | Consumers, the questions they ask, freshness, correctness, scale |
        | 2. Estimate | 3 to 5 | Events per second, bytes per day, storage per year, query load |
        | 3. Data model | 5 | Events and the core tables at their grain |
        | 4. Architecture | 10 | Ingest, process, store, serve, with the reason for each box |
        | 5. Deep dive | 10 to 15 | The hardest part: late data, dedup, skew, exactly-once, backfill |
        | 6. Operate and evolve | 5 | Monitoring, SLOs, failure modes, cost, what changes at 10x |

        ## Questions that change the design

        - **Who consumes it?** A city ops dashboard, a pricing model and finance want different things.
        - **How fresh?** Seconds, minutes, hours or daily. Each step down halves the complexity.
        - **How correct?** Approximate is fine for a trending chart; money must reconcile exactly.
        - **How much?** Events per second at peak, not average. Peak is often 3x to 5x average.
        - **How far back?** Retention and backfill needs decide storage and replay design.

        > [!example] Turning a prompt into requirements
        > "Design trip analytics" becomes: city ops need trips, cancellations and wait times per
        > city per minute with under 1 minute of delay; finance needs daily revenue that matches
        > payments exactly; analysts need 3 years of history in SQL. Now you have three paths with
        > different freshness and correctness, which is the real design.

        ## Drawing the architecture

        Draw left to right: sources, ingestion, processing, storage, serving, consumers. Label each
        arrow with what flows and how fast. Name a technology only after you name the need it fills.

        > [!trap] The tour of every tool
        > Listing Kafka, Flink, Spark, Airflow, Pinot and dbt in the first two minutes sounds
        > impressive and signals nothing. Every box must answer a requirement you wrote down.

        > [!senior] Lead the deep dive yourself
        > After the high-level design, say "The hardest part here is late and duplicate events
        > from phones. Let me go deep on that unless you'd prefer another area." Seniors pick the
        > risk; mid-level candidates wait to be asked.
      `,
      checks: [
        {
          question: 'What should you do in the first five minutes of a design round?',
          options: [
            'Draw the full architecture to show speed',
            'Clarify consumers, freshness, correctness and scale',
            'List every technology you know',
            'Write the SQL for the main dashboard',
          ],
          answer: 1,
          why: 'Requirements decide the design. Drawing before clarifying leads to a system that answers the wrong question.',
        },
        {
          question: 'Why size for peak rather than average traffic?',
          options: [
            'Interviewers prefer large numbers',
            'Systems fail at peak; peak can be several times the average',
            'Average traffic is hard to compute',
            'Storage is priced on peak',
          ],
          answer: 1,
          why: 'Friday evening or a big match drives the load that breaks consumers and lag. Design for it.',
        },
      ],
    },
    {
      slug: 'building-blocks',
      title: 'Building blocks and serving stores',
      summary: 'Match each layer of a data system to the right kind of store or engine.',
      minutes: 15,
      body: `
        Most data designs use the same layers. The skill is picking the right component per layer
        from the access pattern, and saying why.

        ## Ingestion

        - **Event bus** (Kafka, Pub/Sub): decouples producers from consumers, buffers spikes, allows replay.
        - **Change data capture** (Debezium, Datastream): streams database changes without load on the primary.
        - **Batch extract**: fine for daily third-party files or small reference tables.

        ## Processing

        - **Stream processors** (Flink, Dataflow, Spark Structured Streaming): windows, joins, state, seconds of latency.
        - **Batch engines** (Spark, BigQuery, Trino): large scans, backfills, complex joins.
        - **Orchestrators** (Airflow, Prefect, Dagster): schedule and order batch work.

        ## Storage and serving

        Choose the serving store from the query pattern.

        | Query pattern | Good fit | Why |
        |---|---|---|
        | Ad hoc SQL over years of data | BigQuery, Trino on Iceberg | Columnar scans, separate compute |
        | Sub-second aggregates over fresh events, many concurrent users | Apache Pinot, Apache Druid, ClickHouse | Pre-indexed segments, real-time ingestion |
        | Point lookups by key at high QPS | Bigtable, Cassandra, Redis | Key-value access in milliseconds |
        | Features for online models | A feature store with an online KV and offline lake | Same feature definitions for training and serving |
        | Search over text or logs | Elasticsearch, OpenSearch | Inverted indexes |

        > [!example] Uber's public stack as a reference
        > Kafka for events, Flink for streaming, Hudi on HDFS and cloud storage for the lake, Spark
        > and Presto for batch and SQL, Pinot for real-time OLAP behind ops dashboards. Each has a
        > clear job.

        ## Common shapes

        - **Streaming plus lake:** stream processing for fresh aggregates into an OLAP store; the
          same events land raw in the lake for batch correctness and history.
        - **Kappa:** one streaming codebase; reprocess history by replaying the log.
        - **Batch only:** perfectly fine when the freshness need is hours. Say so when it is.

        > [!senior] Know when not to stream
        > If the consumer is a daily report, a streaming design adds cost and on-call load for no
        > benefit. Choosing the simpler design, with a reason, is a strong senior signal.
      `,
      checks: [
        {
          question:
            'City ops want sub-second dashboards over the last hour of trips, with hundreds of users. Which store fits best?',
          options: [
            'A daily partitioned BigQuery table',
            'A real-time OLAP store such as Pinot or Druid',
            'Redis with one key per trip',
            'Parquet files on object storage',
          ],
          answer: 1,
          why: 'Real-time OLAP stores ingest from streams and answer aggregate queries in sub-second time at high concurrency.',
        },
        {
          question: 'When is a batch-only design the right answer?',
          options: [
            'Never at Uber or Google scale',
            'When consumers only need data hourly or daily',
            'When data volume is very large',
            'When data arrives from Kafka',
          ],
          answer: 1,
          why: 'Freshness drives the need for streaming. Volume alone does not.',
        },
      ],
    },
    {
      slug: 'correctness-at-scale',
      title: 'Correctness at scale',
      summary: 'Handle duplicates, late data, replays and reconciliation end to end.',
      minutes: 16,
      body: `
        At scale, every unlikely event happens every day. Phones retry, consumers restart,
        networks partition, and clocks drift. A senior design states how the numbers stay right.

        ## Duplicates

        Assume at-least-once delivery everywhere. Give every event a stable **event id** created at
        the source (not at ingestion), and dedupe on it:

        - In the stream, keep seen ids in keyed state with a TTL longer than the maximum retry delay.
        - In the lake, dedupe with «ROW_NUMBER() OVER (PARTITION BY event_id ...)» or a MERGE on the id.

        ## Late and out-of-order events

        Use **event time** for business metrics. Pick a watermark from the measured lateness
        distribution, and decide what happens to events after it: drop, send to a side output, or
        apply as a correction to an already-emitted result.

        ## Idempotent sinks

        Exactly-once inside a processor means nothing if the sink duplicates writes. Make sinks
        idempotent: upsert by key, overwrite whole partitions, or commit output and offsets in one
        transaction.

        ## Replays and backfills

        - Keep raw events long enough to replay (log retention or the raw lake layer).
        - Make every job a function of its input range, so re-running a range gives the same output.
        - Version outputs during a large backfill and switch readers when the new version is verified.

        ## Reconciliation

        For money and other critical numbers, compare the fast path with a source of truth on a
        schedule. Streaming gives a quick estimate; the daily batch from the ledger is the number
        finance signs.

        > [!trap] "Exactly-once" in one sentence
        > Saying "Kafka has exactly-once, so we're fine" will get a follow-up that breaks it. Say
        > where duplicates can enter (client retries, producer retries, consumer restarts, sink
        > writes) and how each is handled.

        > [!senior] Two paths, one definition
        > When you have a streaming and a batch path, define each metric once (shared code or a
        > semantic layer). Different logic in two paths guarantees the numbers disagree.
      `,
      checks: [
        {
          question: 'Where should the event id used for dedup be created?',
          options: [
            'At the source, when the event first happens',
            'In the Kafka broker',
            'In the stream processor',
            'In the warehouse at load time',
          ],
          answer: 0,
          why: 'Only an id created at the source stays the same across client and producer retries.',
        },
        {
          question: 'The stream processor is exactly-once. Why can the sink still double count?',
          options: [
            'Exactly-once only applies to reads',
            'A non-idempotent sink can apply the same write twice after a restart',
            'Kafka loses offsets',
            'Watermarks reorder events',
          ],
          answer: 1,
          why: 'After a failure the processor replays from its last checkpoint. Unless the sink is idempotent or transactional, replayed writes repeat.',
        },
      ],
    },
    {
      slug: 'worked-trip-analytics',
      title: 'Worked design: Uber trip analytics',
      summary: 'Follow a complete design for trip analytics, from requirements to failure modes.',
      minutes: 18,
      body: `
        This walk-through shows the framework on a real-sized prompt: "Design the data system
        behind trip analytics for a ride-hailing company."

        ## 1. Requirements

        - City ops: trips, cancellations, wait times and active drivers per city every minute, under 1 minute delay.
        - Finance: daily gross bookings and revenue per city that reconcile with payments exactly.
        - Analysts: 3 years of trip history in SQL.
        - Scale assumption: 30 million trips a day, about 25 events per trip, peaks at 4x average.

        ## 2. Estimates

        - Events: 30M x 25 = 750M a day, about 8,700 per second on average, about 35,000 per second at peak.
        - At 1 KB per event: 750 GB a day raw, about 270 TB a year before compression; Parquet
          brings that down several times.

        ## 3. Data model

        - «trip_events»: one row per state change (requested, accepted, arrived, started, completed, cancelled).
        - «fct_trips»: one row per trip, an accumulating snapshot with a timestamp per milestone.
        - Dimensions: city, driver (SCD Type 2 for city and vehicle), rider, product.

        ## 4. Architecture

        ~~~text
        rider and driver apps
              |  events: event_id, event_ts
              v
        Kafka trip-events (key: trip_id)
              |------------------------|
              v                        v
        Flink: 1-min city windows   Raw sink to lake
              |                        |
              v                        v
        Pinot (real-time OLAP)      Spark: fct_trips
              |                        |
              v                        v
        ops dashboards              BigQuery or Trino
        ~~~

        ## 5. Deep dive: late and duplicate events

        - Phones go offline and send events minutes later. Flink uses event time with a watermark
          from measured lateness (say 2 minutes), and late updates upsert corrected counts into Pinot.
        - Duplicates from retries are removed by «event_id» in Flink state (TTL 1 day) and again
          in the batch layer.
        - «fct_trips» is built incrementally: changed trips are merged by «trip_id», with a version
          guard on the latest event time.

        ## 6. Operate

        - SLOs: dashboard delay under 1 minute 99% of the time; finance table by 06:00 UTC.
        - Reconciliation: daily revenue from «fct_trips» against the payments ledger, alert above 0.1%.
        - Failure modes: Kafka consumer lag (alert, autoscale Flink), a bad deploy (replay from
          Kafka retention), hot partitions on big cities (keyed by trip, not city).
        - At 10x: more partitions, tiered storage on Kafka, pre-aggregated Pinot star-tree indexes.

        > [!senior] What made this answer senior
        > Three consumers, three freshness levels; numbers that justify the components; a deep
        > dive on the real risk; and a reconciliation path for money.
      `,
      checks: [
        {
          question: 'Why is trip_events keyed by trip_id rather than city_id?',
          options: [
            'City ids are strings',
            'Per-trip ordering is required, and keying by city creates hot partitions for big cities',
            'Pinot requires it',
            'It reduces storage',
          ],
          answer: 1,
          why: 'Trip ids keep each trip ordered and spread load. City aggregation happens in Flink with a keyed window.',
        },
        {
          question: 'Why does the design have both Flink and a Spark batch layer?',
          options: [
            'Flink cannot write to Kafka',
            'Fresh, approximate ops metrics and exact, reconciled finance numbers have different needs',
            'Spark is required for Parquet',
            'To use more technologies',
          ],
          answer: 1,
          why: 'Each path serves a consumer with a different freshness and correctness requirement.',
        },
      ],
    },
    {
      slug: 'staff-level-design',
      title: 'Thinking at staff level',
      summary: 'Add platform thinking, migration plans and cost to your designs.',
      minutes: 13,
      body: `
        A senior design solves the problem well. A staff design also considers the organization:
        many teams, years of change, money, and the path from today's system to the new one.

        ## Platform, not pipeline

        If ten teams need the same thing, build a paved road: a self-serve way to publish a
        dataset with a contract, tests, lineage and SLOs by default. Measure adoption, not only
        uptime.

        ## Migrations

        Large designs usually replace something. A credible plan has:

        - **Dual running:** old and new produce the same outputs; compare automatically.
        - **Incremental cut-over:** one consumer or one domain at a time, with a rollback path.
        - **A finish line:** a date the old system is switched off, and someone who owns it.

        ## Cost as a design dimension

        Estimate the bill. Storage at petabyte scale, streaming compute running all day, and
        warehouse scans by hundreds of analysts all add up. Show the lever that cuts cost the most
        (tiered storage, pre-aggregation, partition pruning, retention) and its trade-off.

        ## Multi-tenancy and isolation

        Shared clusters need quotas, priorities and isolation, so one team's backfill cannot
        delay another team's SLO. Mention workload isolation when a design serves many teams.

        ## Build or buy

        Compare a managed service with building: the team you need to run it, how core it is to
        the business, lock-in, and cost at your scale. Uber built Hudi and contributes to open
        source because its scale and needs were unusual; most companies should buy.

        > [!senior] Say what you would not build
        > "We don't need a feature store yet; two models share three features. Revisit at five
        > models." Scoping down with a trigger to revisit is a staff behaviour.

        The **Staff-level judgement** track goes further: ambiguity, strategy, design reviews,
        influence and the business case, with problems that practise each one.
      `,
      checks: [
        {
          question: 'Which element most separates a staff-level migration plan?',
          options: [
            'Using the newest technology',
            'Dual running with automated comparison, incremental cut-over and a switch-off date',
            'Migrating everything in one weekend',
            'Rewriting all jobs from scratch first',
          ],
          answer: 1,
          why: 'It lowers risk, proves correctness and actually finishes, which is where most migrations fail.',
        },
      ],
    },
  ],
};

const coreProblems: Problem[] = [
  {
    slug: 'design-real-time-surge',
    title: 'Design the data pipeline for surge pricing',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      Design the data pipeline that feeds surge pricing. Every 30 seconds, the pricing service
      needs supply (available drivers) and demand (ride requests and app opens) for every
      hexagonal cell of every city. Drivers send a location ping every 4 seconds. Assume 5 million
      online drivers at peak and 20 million app sessions an hour.
    `,
    hints: [
      'Estimate the ping rate first.',
      'How do you map a latitude and longitude to a cell?',
      'What does the pricing service read, and how fast must that read be?',
      'What happens if the pipeline lags by two minutes?',
    ],
    answer: `
      **Requirements.** Output: per cell, supply and demand counts over a sliding window,
      refreshed every 30 seconds, read by pricing in milliseconds. Freshness beats perfect
      accuracy here; a stale price is worse than a slightly noisy one. History goes to the lake
      for model training and audits.

      **Estimates.** 5M drivers / 4 s = 1.25M pings per second at peak. At about 200 bytes each,
      roughly 250 MB per second into Kafka. Demand events are smaller in number but spikier.

      **Pipeline.**

      - Driver pings and demand events go to Kafka, keyed by driver id and session id.
      - A Flink job maps each event to an H3 cell at a fixed resolution and re-keys by cell.
      - Supply: keep each driver's latest cell and status in keyed state; count available drivers
        per cell (a driver counts once, in their latest cell). Demand: sliding windows of requests
        and app opens per cell, for example 5 minutes sliding every 30 seconds.
      - Output per cell per tick goes to a low-latency KV store (Redis or Cassandra) keyed by
        cell, which the pricing service reads; the same output goes to Kafka for the lake.

      **Deep dive: freshness and failure.**

      - Event time with a short watermark (a few seconds); late pings update the driver's
        position but are not worth reopening old windows.
      - Hot cells (airports, stadiums) concentrate load. Key by cell only after pre-aggregating by
        driver, and use finer cells or splitting for known hot spots.
      - If the job lags, pricing must know: publish a computed-at timestamp with each value, and
        let pricing fall back to a safe multiplier when data is older than a threshold.

      **Operate.** SLO on output age per city. Alert on Kafka lag and on cells with sudden
      zero supply (likely a pipeline bug, not reality). Replay from Kafka to rebuild state after a bad deploy.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Pings into Kafka | 250 MB/s | 1.25M/s × 200 B |
      | Kafka disk for 24 h | about 65 TB | 21.6 TB a day × 3 replicas |
      | Partitions | 256 | about 1 MB/s each, room to add consumers |
      | Driver state in Flink | about 0.5 GB | 5M drivers × about 100 B |
      | KV writes per tick | about 17,000/s | 500,000 active cells every 30 s |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Count raw pings per cell | A driver pings 7 times in 30 s, so supply is over-counted 7x and moves with ping rate |
      | Spark micro-batches every 30 s | It works, but "latest cell per driver" plus sliding windows is simpler in Flink keyed state |
      | Serve from the warehouse | Pricing reads in milliseconds at thousands of requests a second |
      | Geohash squares | Neighbours sit at uneven distances; H3 hexagons have six equal neighbours, which smoothing needs |

      **Failure walkthrough: the Flink job dies at peak.** The job restarts from its last
      checkpoint (every 10 s) and replays Kafka from the stored offsets. For about a minute no
      new values arrive. Each value carries «computed_at», so pricing sees data older than 90 s
      and switches those cities to a capped fallback multiplier. The job catches up at about 3x
      real-time, and pricing returns to live values on its own. Nobody is paged unless output age
      stays over the SLO for 5 minutes.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Estimates the ping rate and bandwidth',
      'Counts a driver once using latest-position state, not raw pings',
      'Uses a geospatial index such as H3 and re-keys by cell',
      'Serves from a low-latency KV store, not a warehouse',
      'Designs for staleness: timestamps and a safe fallback',
      'Handles hot cells',
    ],
    followUps: [
      'Pricing wants to predict demand 15 minutes ahead. What changes in the data path?',
      'How would you backtest a new surge formula on last month’s data?',
    ],
  },
  {
    slug: 'design-video-view-counts',
    title: 'Design view counts for a video platform',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      Design the system that counts video views. Creators see a near-real-time count on each
      video and detailed analytics (views by country, device and traffic source) in a dashboard.
      Views drive creator payouts. Assume 5 billion views a day, with some videos getting
      millions of views in their first hour. Invalid views (bots, repeated refreshes) must not count.
    `,
    hints: [
      'Payouts and the public counter have different correctness needs.',
      'A viral video is a hot key.',
      'Where does invalid traffic filtering fit?',
    ],
    answer: `
      **Requirements.**

      - Public counter: fresh within about a minute, approximate is fine, monotonic (it never goes down visibly).
      - Creator analytics: hourly to daily, sliced by dimensions, accurate.
      - Payouts: exact, auditable, after invalid-traffic filtering, daily or monthly.

      **Estimates.** 5B views a day is about 58,000 per second on average and over 200,000 at peak.

      **Architecture.**

      - Players send view events with a client-generated view id to an ingestion tier, then Pub/Sub or Kafka.
      - **Fast path:** a streaming job (Dataflow or Flink) dedupes by view id and applies cheap
        real-time filters (rate limits per user and IP), then aggregates per video per few seconds.
        For hot videos, pre-aggregate in many shards ("salting" the key) and combine shard sums.
        Counts go to a KV store (Bigtable) that serves the public counter.
      - **Accurate path:** raw events land in the lake and a warehouse partitioned by date. A
        batch invalid-traffic job uses heavier signals (behaviour patterns, models, later
        evidence) and produces validated views.
      - Creator analytics and payouts read only validated views, aggregated in BigQuery by video,
        day and dimension.

      **Deep dive: the counter versus the truth.** The public counter starts from the fast path
      and is periodically corrected to the validated count. To keep it monotonic, corrections
      that would reduce it are applied by slowing growth rather than jumping down, or the
      counter shows the validated count plus fresh unvalidated views.

      **Operate.** Reconcile fast and validated counts per day; a large gap signals a filter or
      pipeline problem. Keep raw events long enough to re-run filtering when models improve, and
      version payout calculations for audits.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Raw events | about 1.5 TB a day | 5B × 300 B |
      | One year of raw events | about 550 TB | before columnar compression |
      | Counter writes | about 300,000/s | 3M videos with a view in each 10 s window |
      | Bigtable nodes for counters | about 30 | at roughly 10,000 writes a second per node |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Increment a database row per view | A viral video puts 50,000 writes a second on one row |
      | Pay creators from the stream | Payout must use fraud signals that arrive days later, and be reproducible |
      | One exact path for everything | Exact and filtered means hours of delay; the public counter needs a minute |
      | Count unique viewers exactly | HyperLogLog gives about 1% error in 12 KB per video, which is enough for a dashboard |

      I accept two code paths because they serve different correctness needs. The reconciliation
      job is what keeps them honest.

      **Failure walkthrough: a bot farm sends 10M views to one video in an hour.** Cheap filters
      in the stream catch some, so the public counter rises too fast. The nightly batch flags the
      farm with device and account signals and removes those views from validated counts.
      Payouts never saw them. The counter does not drop; it grows slower until it meets the
      validated number. The reconciliation gap for that video triggers a review.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Separates public counter, analytics and payouts by correctness need',
      'Dedupes on a client-generated id',
      'Handles hot keys with sharded pre-aggregation',
      'Puts heavy invalid-traffic filtering in batch, cheap filters in stream',
      'Explains how the fast count is corrected toward the validated one',
    ],
    followUps: [
      'A new fraud model removes 3% of last month’s views. How do you restate payouts?',
      'How do you store per-video, per-country hourly counts for 10 years cheaply?',
    ],
  },
  {
    slug: 'design-ad-click-billing',
    title: 'Design an ad click aggregation and billing pipeline',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      Advertisers pay per click. Design the pipeline that aggregates clicks per ad per minute for
      advertiser dashboards and budget pacing, and produces the billable click counts used for
      invoices. Assume 1 billion clicks a day. Budget pacing must stop serving an ad within a
      few minutes of its daily budget running out.
    `,
    hints: [
      'Three consumers: dashboards, pacing and invoices.',
      'What does pacing need to read, and how fresh?',
      'Overspending and double billing both cost money. Which is worse?',
    ],
    answer: `
      **Requirements.** Dashboards: per ad per minute, a few minutes delay. Pacing: running spend
      per campaign, under 1 to 2 minutes delay, read by the ad server. Invoices: exact, deduped,
      filtered for invalid clicks, auditable, daily.

      **Estimates.** 1B clicks a day is about 12,000 per second on average and 50,000 at peak.

      **Architecture.**

      - Click events carry a click id from the ad server (joined to the impression id) and go to Kafka or Pub/Sub.
      - A streaming job dedupes by click id, joins to the ad's cost per click from a broadcast
        or cached dimension, and aggregates spend per campaign in 1-minute tumbling windows by event time.
      - Running spend per campaign goes to a KV store that the ad server reads for pacing. Over
        budget means stop serving, with a small buffer for in-flight clicks.
      - Minute aggregates go to an OLAP store for dashboards.
      - Raw clicks land in the lake. A daily batch applies invalid-click detection and produces
        billable clicks per campaign per day, which billing invoices.

      **Deep dive: money correctness.**

      - Pacing is allowed to be approximate, but should err toward under-delivery.
      - Invoices come only from the batch path, which is reproducible from raw data.
      - Idempotent writes everywhere: aggregates upsert by (campaign, window), invoices by (campaign, day).
      - Reconcile streaming spend with billable spend daily; the gap shows invalid-click rate or bugs.

      **Operate.** Alert if pacing data is older than 2 minutes (the ad server then slows
      delivery for affected campaigns). Retain raw clicks for the dispute window. Credits for
      invalid clicks found later are applied as adjustments, never by editing past invoices.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Raw clicks | about 500 GB a day | 1B × 500 B |
      | Minute aggregates | about 30,000 rows/s | 2M ads with clicks in a minute |
      | Pacing reads | high, but cached | the ad server caches spend for a few seconds |
      | Dedupe state | about 50 GB | 24 h of click ids at about 50 B each |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Bill from the streaming totals | Not reproducible when fraud rules change, and hard to audit |
      | One database transaction per click | Hot campaigns become hot rows, and the cost is high at 50,000/s |
      | Hourly batch for pacing | A popular campaign can overspend its whole budget in an hour |
      | Exactly-once end to end | Expensive; idempotent upserts by key give the same result |

      **Failure walkthrough: the streaming job is down for 20 minutes.** Pacing data ages past
      2 minutes. The ad server does not stop all ads: it throttles only campaigns already above
      80% of their budget, which limits overspend without losing most revenue. Dashboards show
      "data as of". Invoices are untouched, because they come from the batch path. After restart
      the job replays Kafka; upserts by (campaign, window) make the replay safe.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Separates pacing, dashboards and invoices by freshness and correctness',
      'Bills only from a reproducible batch path',
      'Dedupes on a click id and uses idempotent upserts',
      'Designs pacing to fail safe when data is stale',
      'Handles later fraud findings as adjustments',
    ],
    followUps: [
      'Clicks can arrive up to 24 hours late from offline devices. How does that affect invoices?',
      'How do you attribute a conversion to a click across devices?',
    ],
  },
  {
    slug: 'design-cdc-to-lake',
    title: 'Design CDC ingestion from 500 databases',
    track: 'system-design',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'microsoft', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      Product teams run 500 MySQL databases. Analysts want every table available in the lake
      within 15 minutes of a change, with history of how rows changed. Today a nightly dump runs
      «SELECT *» against replicas and takes 9 hours. Design the replacement.
    `,
    hints: [
      'How do you read changes without querying tables?',
      'What happens on a schema change upstream?',
      'You need both "current state" and "history".',
    ],
    answer: `
      **Capture.** Run Debezium (Kafka Connect) against each database's binlog, using a replica
      where possible. Each change event carries the operation, the before and after row, and the
      log position. One topic per table, keyed by primary key, so per-row order holds.

      **Initial load.** Debezium's incremental snapshot backfills existing rows in chunks while
      streaming continues, without locking tables.

      **Land.** Two tables per source table:

      - A **changelog** table, append-only, partitioned by change date: the full history.
      - A **current state** table, a merge-on-read upsert by primary key (Hudi or Iceberg), with
        a version guard on log position and deletes applied. Compaction runs on a schedule.

      **Schemas.** Use a schema registry with compatibility checks. Additive changes evolve the
      lake table automatically; breaking changes stop that table's pipeline and page the owning
      team instead of writing bad data.

      **Operate at 500 databases.** Generate connectors and table configs from a catalog, not by
      hand. Monitor per-table lag and per-connector health. Alert on binlog retention being close
      to the connector's position (falling behind it forces a re-snapshot). Reconcile row counts
      against sources weekly.

      **Result.** Freshness drops from about 24 hours to minutes, load on databases drops, and
      analysts get history the dumps never had.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Change events | about 500,000/s at peak | 500 databases × about 1,000 changes/s |
      | Bytes into Kafka | about 500 MB/s | before and after rows, about 1 KB per event |
      | Tables | about 25,000 | 50 tables per database |
      | Connect workers | 25 to 50 | 10 to 20 connectors per worker |

      25,000 tables with 1 to 3 partitions each is too many for one Kafka cluster to manage
      comfortably. I split by domain into a few clusters.

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Query-based incremental extract («updated_at > x») | Misses hard deletes, needs a reliable «updated_at» on every table, and loads the source |
      | Database triggers | Doubles writes on the source |
      | Dual writes from the applications | The database and the event can disagree |
      | Copy-on-write tables | Frequent small upserts rewrite whole files; merge-on-read with scheduled compaction is cheaper |

      **Failure walkthrough: one connector is down for 3 days.** Binlog retention is 2 days,
      so the connector's position no longer exists. It cannot resume, and the table set needs a
      re-snapshot. The fix is to prevent it: keep binlogs for 7 days and alert when a connector's
      lag passes 50% of retention. If it still happens, an incremental snapshot runs while
      streaming continues. The changelog table has a gap for those days, which I record in the
      catalog instead of hiding it.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Uses log-based CDC instead of queries',
      'Plans the initial snapshot without downtime',
      'Lands both changelog and current state',
      'Handles schema changes with a registry and a fail-safe',
      'Operates 500 sources through automation and lag monitoring',
    ],
    followUps: [
      'One table has 2 billion rows and 50,000 updates per second. What changes?',
      'Some columns hold personal data. Where do you mask them?',
    ],
  },
  {
    slug: 'design-experiment-metrics',
    title: 'Design an experimentation metrics platform',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: [
      'google',
      'uber',
      'amazon',
      'microsoft',
      'flipkart',
      'walmart',
      'phonepe',
      'swiggy',
    ],
    prompt: `
      Hundreds of A/B experiments run at once. Each experiment owner picks metrics (trips per
      user, revenue per user, cancellation rate) and wants daily results with confidence
      intervals per variant. Design the data side of the platform.
    `,
    hints: [
      'What is the unit of analysis, and how do you know which variant a user saw?',
      'Metrics need one definition across hundreds of experiments.',
      'Computing every metric for every experiment from raw events is too expensive.',
    ],
    answer: `
      **Inputs.**

      - **Exposure log:** one event when a user is first exposed to an experiment variant
        (user, experiment, variant, first exposure time). Assignment alone is not enough; analyse
        users who were actually exposed.
      - **Metric sources:** fact tables (trips, payments, sessions) at their natural grain.

      **Metric layer.** Each metric is defined once in a registry: source table, numerator,
      denominator, filters and the unit (user). This stops hundreds of hand-written queries from
      drifting apart.

      **Computation.**

      - Daily, compute **per-user per-day metric values** once for all metrics (a wide table keyed by user and date).
      - Join exposures to per-user values for days on or after first exposure.
      - Aggregate per experiment and variant to sufficient statistics: count, sum and sum of
        squares. Confidence intervals and tests use only those, so results are cheap to recompute.
      - Ratio metrics (cancellations per trip) need the delta method or bootstrap, because the
        unit of randomization is the user, not the trip.

      **Correctness checks.**

      - **Sample ratio mismatch:** if a 50/50 test has 52/48 exposure, flag the result as untrustworthy.
      - Pre-period checks (CUPED or comparing the pre-exposure period) to reduce variance and catch imbalance.

      **Scale.** The per-user daily table is computed once and shared, so cost grows with users
      and metrics, not with experiments times metrics. Partition by date, cluster by user.

      **Capacity.**

      | Item | Number | How |
      |---|---|---|
      | Daily active users | 30M | assumed |
      | Per-user daily table | 30M rows × 200 metric columns | one wide row per user per day |
      | Exposure rows | about 600M | each user in about 20 experiments |
      | Output | small | experiments × variants × metrics × days of sufficient statistics |

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | One query per experiment per metric | 300 experiments × 20 metrics scan the same facts 6,000 times a day |
      | Real-time results | Teams would peek and stop early, which inflates false positives; daily is enough |
      | Analyse everyone assigned | Users never exposed dilute the effect toward zero |
      | Raw values per user in the result table | Sufficient statistics make every interval a cheap recomputation |

      **Failure walkthrough: Android stops logging exposures for variant B.** Variant B now has
      fewer users than planned. The sample ratio check sees a 53/47 split instead of 50/50 and marks the
      experiment untrustworthy. The results page hides the numbers and says why, so nobody ships
      a decision on bad data. After the fix, the platform recomputes from the first good day, and
      the metric registry records the incident window.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Uses exposure, not assignment, as the analysis population',
      'Defines metrics once in a shared layer',
      'Computes sufficient statistics instead of rescanning raw data',
      'Knows ratio metrics need special variance treatment',
      'Adds sample ratio mismatch detection',
    ],
    followUps: [
      'Uber is a two-sided market. Why can user-level randomization give biased results for pricing tests?',
      'An owner wants hourly results. What changes?',
    ],
  },
  {
    slug: 'plan-lake-migration',
    title: 'Plan a migration of 2,000 batch jobs',
    track: 'system-design',
    kind: 'design',
    difficulty: 'hard',
    companies: [
      'uber',
      'google',
      'amazon',
      'microsoft',
      'flipkart',
      'walmart',
      'phonepe',
      'swiggy',
    ],
    prompt: `
      Your company runs 2,000 Hive SQL jobs on an on-premises Hadoop cluster that reaches end of
      support in 18 months. Leadership wants them on a cloud lakehouse with Spark and a modern
      orchestrator. You lead the effort. Present your plan.
    `,
    hints: [
      'Not all 2,000 jobs matter equally, and some are unused.',
      'How do you prove a migrated job produces the same output?',
      'Who does the work: your team or the job owners?',
    ],
    answer: `
      **Inventory first.** Pull every job, its inputs, outputs, owner, runtime and last read of
      its outputs (from lineage and query logs). Expect 20% to 40% to be dead: outputs nobody
      read in 90 days. Turn those off first, with notice.

      **Prioritize.** Rank the rest by business criticality and dependency depth. Migrate in
      dependency order (sources and shared dimensions first) so migrated jobs read migrated data.

      **Make it cheap per job.**

      - Automate SQL translation (Hive to Spark SQL) with a tool plus a list of known differences.
      - Generate orchestrator definitions from the old scheduler's metadata.
      - Provide a template with tests, data checks and lineage built in.

      **Prove correctness.** Dual-run each job for a week: old and new write to separate tables,
      and an automated comparison checks row counts, key sets and column checksums. A job is
      migrated only when the comparison is clean or the differences are explained.

      **Cut over by domain.** Switch readers one domain at a time, keep the old output available
      for rollback for two weeks, then turn the old job off.

      **People.** A central team builds the tooling and migrates the critical shared jobs. Owning
      teams migrate the rest with office hours and a migration tracker that shows progress per team.

      **Risk and timeline.** Leave a 3-month buffer before end of support. Track jobs migrated,
      jobs turned off, and compute cost per job. Report weekly to leadership.

      **Capacity and timeline.**

      | Item | Number | How |
      |---|---|---|
      | Jobs after cleanup | about 1,400 | 2,000 minus 30% dead |
      | Migration window | 12 months | 18 months minus 3 for setup and 3 for buffer |
      | Rate needed | about 30 jobs a week | 1,400 over about 50 weeks |
      | Extra compute while dual-running | about 15% | one week of overlap per job |

      At 30 jobs a week the plan fails without automation. That is why translation and DAG
      generation come first.

      **Options I rejected.**

      | Option | Why not |
      |---|---|
      | Lift and shift Hadoop onto cloud VMs | Keeps the debt and the operations cost, and only moves the end-of-support problem |
      | Big-bang cut-over | One bad weekend breaks every report at once, with no rollback |
      | Redesign each job while moving it | Doubles the risk per job and will not finish in 18 months |
      | Each team migrates alone | No shared tooling, inconsistent quality, and the slowest team sets the date |

      **Failure walkthrough: a finance job differs by 0.3% in dual-run.** The comparison blocks
      cut-over. The usual causes are known Hive-to-Spark differences: time zone handling of
      timestamps, implicit casts and null ordering. The team finds the cause, adds it to the
      known-differences list and to the translation rules, and re-runs. If month-end is close,
      the job stays on Hadoop for one more cycle. The tracker shows it as at risk, not as done.
    `,
    signals: [
      'Names the options rejected and why, then walks through one failure end to end',
      'Starts by turning off unused jobs',
      'Migrates in dependency order',
      'Automates translation and validation instead of hand-porting',
      'Dual-runs with automated comparison before cut-over',
      'Plans ownership across teams and a buffer before the deadline',
    ],
    followUps: [
      'Halfway through, migrated jobs cost 40% more than planned. What do you do?',
      'A team refuses to migrate their jobs on time. How do you handle it?',
    ],
  },
];

export const problems: Problem[] = [...coreProblems, ...designQuestions];
