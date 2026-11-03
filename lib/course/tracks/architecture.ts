import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'architecture',
  title: 'Architecture patterns',
  summary:
    'Lambda and Kappa, medallion layers, event sourcing, data mesh, data fabric and reverse ETL: what each one solves, what it costs, and when to say no.',
  tone: 'grape',
  why: 'Senior loops ask you to name a pattern and then defend it. A staff answer knows the problem each pattern was invented for, the failure it brings, and when the simpler choice wins.',
  lessons: [
    {
      slug: 'lambda-and-kappa',
      title: 'Lambda, Kappa and one engine for both',
      summary:
        'Choose between a dual batch and stream path, a log-only path, and a unified engine.',
      minutes: 14,
      body: `
        Every data platform answers one question: how do fresh results and correct results live
        together? Lambda and Kappa are the two classic answers. Most modern platforms run a third
        one, a unified engine, but the interview still uses the old names.

        ## Lambda: two paths, merged at read

        **Lambda architecture** runs a batch layer and a speed layer side by side. The batch layer
        recomputes views from the full, immutable master dataset, often daily. The speed layer
        covers only the gap since the last batch run, with approximate, incremental results. The
        serving layer merges both at query time.

        ~~~text
        events ──► master dataset (lake) ──► batch layer ──► batch views ──┐
           │                                                              ├─► serving (merge)
           └──────────────► speed layer (stream) ──► realtime views ──────┘
        ~~~

        - **What it buys:** the batch path heals every mistake of the speed path. A bug in the
          stream job lives only until the next batch run.
        - **What it costs:** the same logic is written twice, in two engines, by two teams. The two
          versions drift, and the merged number disagrees with itself at the boundary.

        ## Kappa: the log is the source of truth

        **Kappa architecture** removes the batch layer. Every result comes from one stream job
        that reads an append-only log. To fix a bug or change logic, you start a second copy of
        the job from offset 0 (or from the lake copy of the log), let it catch up, then switch
        readers to its output and stop the old job.

        - **What it buys:** one codebase, one set of semantics.
        - **What it costs:** you must keep the log long enough to replay, and a replay must be fast.
          Reprocessing a year of events through a stream job at 3x real time still takes four months.
        - **Kafka tiered storage** (GA in Kafka 3.9) makes long retention cheaper, because old
          segments live in object storage. It does not make the replay faster.

        ## The modern answer: one engine, two modes

        Engines such as Flink, Spark Structured Streaming and Beam on Dataflow run the same code in
        batch and stream mode. A table format such as Iceberg or Delta lets the stream job write
        the same tables that a backfill rewrites. So most teams now run:

        | Need | Path |
        |---|---|
        | Seconds-fresh, approximate | Stream job into a serving store |
        | Hourly or daily, exact | The same logic as a batch job over the lake |
        | Fix history | Re-run the batch mode for the bad partitions |

        This is Lambda in shape, with one codebase. Name it that way in the interview: "one logic,
        two schedules".

        ## Micro-batch is often enough

        A job that runs every 5 minutes on new files is a valid design. It has no state store to
        manage, no watermarks, and retries are a re-run. Ask what the consumer does with a fresher
        number. If nobody acts within 5 minutes, streaming buys cost and on-call pages, not value.

        > [!trap] Streaming because it sounds senior
        > Proposing Flink for a daily finance report is a red flag. Seniors choose the slowest
        > freshness the consumer accepts, then add a fast path only where someone acts on it.

        > [!senior] What a senior answer says
        > "The dashboard needs one-minute freshness, finance needs exact daily numbers. I run one
        > Flink job for the dashboard and the same transformation as a batch job over the lake for
        > finance. A bug fix is a batch re-run of the affected days, not a log replay. That keeps
        > the Lambda benefit, self-healing history, without two codebases."
      `,
      checks: [
        {
          question: 'What is the main operational cost of a classic Lambda architecture?',
          options: [
            'It cannot handle late data',
            'The same logic lives in two engines and drifts apart',
            'It needs Kafka with infinite retention',
            'It cannot serve low-latency reads',
          ],
          answer: 1,
          why: 'Two codebases for one metric diverge over time, and the merged result disagrees at the boundary between batch and speed views.',
        },
        {
          question: 'In Kappa, how do you change the logic for all of history?',
          options: [
            'Run a separate batch job over the warehouse',
            'Edit the old output tables in place',
            'Start a new copy of the stream job from the start of the log, then switch readers',
            'You cannot; Kappa only handles new data',
          ],
          answer: 2,
          why: 'Kappa reprocesses by replaying the log into a new job version and cutting readers over when it catches up.',
        },
      ],
    },
    {
      slug: 'medallion',
      title: 'Medallion layers: bronze, silver, gold',
      summary:
        'Give each lake layer a contract, so a rebuild is safe and a consumer knows what it can trust.',
      minutes: 13,
      body: `
        The **medallion architecture** splits a lakehouse into three layers by how much the data
        has been refined. Databricks popularised the names, but the idea is older: raw, cleaned,
        and modelled zones. The value is not the three names. It is a clear contract at each layer.

        ## The three contracts

        | Layer | Contract | Typical rules |
        |---|---|---|
        | **Bronze** | Exactly what the source sent, plus load metadata | Append only. No parsing that can fail. Keep «_ingested_at», «_source_file», «_batch_id». |
        | **Silver** | One clean, conformed row per business entity or event | Typed, deduplicated, keys enforced, PII tagged or masked, late data merged. |
        | **Gold** | Answers for a consumer | Facts and dimensions, aggregates, feature tables. Named for the business, not the source. |

        ## Why bronze must be dumb

        Bronze exists so you can rebuild everything downstream. If bronze parses JSON and drops rows
        that fail, a parser bug loses data for good. So bronze stores the payload as text or a
        variant type, and the parse happens in silver, where a failed row goes to a quarantine
        table with the reason.

        > [!example] A rebuild after a bug
        > A silver job used the wrong timezone for 9 days. Because bronze is complete and
        > append only, you fix the code, overwrite the 9 affected silver partitions from bronze,
        > then rebuild the gold partitions that read them. Nobody re-pulls from the source.

        ## Where the work goes

        - **Deduplication** goes in silver, on a natural or event id, with a deterministic winner
          (latest «updated_at», then the highest offset).
        - **Joins across sources** go in silver when they conform one entity (customer from CRM
          plus customer from billing), and in gold when they serve one question.
        - **Business logic** (what counts as an active user) goes in gold, in one place, under a
          named owner. If two gold tables compute it, they will disagree.

        ## How it goes wrong

        - **Layers as folders, not contracts.** Teams copy data three times and gain nothing. Each
          layer must promise something the previous one did not.
        - **Gold sprawl.** Every dashboard gets its own gold table. Set a rule: a new gold table
          needs an owner and a consumer, and unused ones are retired after 90 days.
        - **Cost.** Three full copies of a large table cost real money. Silver can be a view for
          small sources, and bronze can expire after the retention you need for rebuilds.
        - **Streaming and medallion.** Each hop adds latency. A stream path often reads bronze
          and writes a gold serving table directly, with silver built in parallel.

        > [!senior] What a senior answer says
        > "Bronze is the replay buffer, so it is append only and never fails a row. Silver is
        > where correctness lives: types, dedup, keys and quarantine. Gold is owned by a consumer
        > and holds the business definitions once. I can rebuild any layer from the one below it,
        > and I measure that by actually doing it in a drill."
      `,
      checks: [
        {
          question: 'A JSON field changes type at the source. Where should the failure surface?',
          options: [
            'In bronze, by rejecting the file',
            'In silver, by sending the bad rows to a quarantine table',
            'In gold, by showing nulls on the dashboard',
            'Nowhere; cast everything to string forever',
          ],
          answer: 1,
          why: 'Bronze keeps the raw payload so nothing is lost. Silver parses, and parse failures go to quarantine with a reason so they can be fixed and replayed.',
        },
        {
          question: 'What is the main reason bronze is append only and keeps raw payloads?',
          options: [
            'It is cheaper to store raw data',
            'Query engines read raw JSON faster',
            'It lets you rebuild silver and gold after a bug without the source',
            'Regulators require three copies',
          ],
          answer: 2,
          why: 'Bronze is the replay buffer. A complete, unaltered bronze makes every downstream bug recoverable.',
        },
      ],
    },
    {
      slug: 'event-sourcing',
      title: 'Event sourcing, CQRS and the outbox',
      summary: 'Store changes as events, build read models from them, and publish them reliably.',
      minutes: 15,
      body: `
        In a normal service, a table holds the current state and an update overwrites it. With
        **event sourcing**, the service stores every change as an immutable event, and the current
        state is a fold over those events. For data engineers this matters twice: you often
        consume such a log, and you are often asked to design one.

        ## The model

        ~~~text
        AccountOpened(id=7, owner=ana)
        MoneyDeposited(id=7, amount=100)
        MoneyWithdrawn(id=7, amount=30)
        ──────────────────────────────────
        state(id=7) = fold(events) = { owner: ana, balance: 70 }
        ~~~

        - The **event store** is append only, ordered per aggregate (here, per account), and the
          source of truth.
        - A **projection** reads the events and builds a read model: a balance table, a search
          index, a daily ledger in the warehouse.
        - **Snapshots** store the folded state every N events, so a read does not replay 10 years.

        ## CQRS

        **Command Query Responsibility Segregation** separates the write model (validate a command,
        append events) from the read models (projections shaped for each query). Event sourcing
        and CQRS are often used together, but either works alone. Read models are eventually
        consistent: a projection may lag the event store by seconds.

        ## Why data teams like it

        - **Full history for free.** Point-in-time questions ("what was the balance on 1 March?")
          are a fold up to a timestamp.
        - **New read models without migration.** A new projection replays from the start.
        - **Audit.** Nothing is overwritten. Finance and compliance love this.

        ## What it costs

        - **Schema evolution is permanent.** Old events never go away, so every projection must
          read every version. Use a schema registry, additive changes, and upcasters that convert
          old versions on read.
        - **Deletion conflicts with immutability.** For GDPR erasure, keep personal data out of
          events, or encrypt it per person and delete the key (crypto-shredding).
        - **Replays are slow at scale.** Plan snapshots and parallel replay per aggregate.

        ## The outbox pattern

        A service that writes its database and then publishes to Kafka can fail between the two.
        That is the **dual-write problem**. The **transactional outbox** fixes it: write the
        business row and an «outbox» row in one database transaction. A relay, often Debezium
        reading the database log, publishes outbox rows to Kafka. Delivery is at least once, so
        consumers dedupe on the event id.

        ~~~sql
        BEGIN;
        UPDATE accounts SET balance = balance - 30 WHERE id = 7;
        INSERT INTO outbox (event_id, aggregate_id, type, payload)
        VALUES ('e-91', 7, 'MoneyWithdrawn', '{"amount": 30}');
        COMMIT;
        ~~~

        > [!trap] CDC is not event sourcing
        > A CDC stream of row changes tells you a column changed. It does not say why. An event
        > such as «RefundIssued» carries intent. If the analytics need intent, ask the service to
        > publish domain events through an outbox, not to rely on table diffs.

        > [!senior] What a senior answer says
        > "I would event-source the ledger, where history and audit are the product, and not the
        > user profile, where they are not. Projections are rebuildable, events are versioned with
        > upcasters, personal data is crypto-shredded, and publishing uses an outbox so no event is
        > lost between the database and Kafka."
      `,
      checks: [
        {
          question:
            'A service updates Postgres and then publishes to Kafka. What does the outbox pattern fix?',
          options: [
            'Kafka consumer lag',
            'The service crashing between the database write and the publish',
            'Schema evolution of events',
            'Ordering across partitions',
          ],
          answer: 1,
          why: 'The outbox row commits in the same transaction as the business change, and a relay publishes it, so no change is lost between two systems.',
        },
        {
          question: 'How do you honour a GDPR erasure request in an immutable event store?',
          options: [
            'Delete the events for that person',
            'Rewrite the whole log without them',
            'Encrypt personal fields with a per-person key and delete the key',
            'You cannot; event sourcing is exempt',
          ],
          answer: 2,
          why: 'Crypto-shredding keeps the log immutable while making the personal data unreadable for good.',
        },
      ],
    },
    {
      slug: 'data-mesh',
      title: 'Data mesh: ownership, products and a platform',
      summary:
        'Explain the four principles, what a data product is, and when a mesh is the wrong answer.',
      minutes: 14,
      body: `
        **Data mesh** is an organisational pattern, not a technology. Zhamak Dehghani described it
        in 2019 as an answer to one failure: a central data team that becomes the bottleneck for
        every domain, owns data it does not understand, and fixes pipelines it did not break.

        ## The four principles

        | Principle | Meaning | What it changes |
        |---|---|---|
        | **Domain ownership** | The team that runs the business process owns its analytical data | Payments owns payments data end to end, including on-call |
        | **Data as a product** | Shared data has users, an owner, docs, SLOs and versioning | A table is published on purpose, not leaked from a pipeline |
        | **Self-serve platform** | A platform team builds paved roads, not pipelines | Domains create a product in a day without filing a ticket |
        | **Federated computational governance** | Global rules are agreed together and enforced by code | PII tagging, naming and retention are checks in CI, not reviews |

        ## What a data product is

        A data product is the unit of sharing. It is more than a table:

        - **Output ports:** the tables, topics or APIs consumers read, with a schema contract.
        - **An owner and an SLO:** freshness, completeness, and who gets paged.
        - **Metadata:** description, lineage, classification, sample queries, in the catalog.
        - **Versioning:** a breaking change ships as v2 next to v1, with a deprecation window.
        - **Input ports and code:** how it is built, kept in the domain's repo.

        ## The platform under a mesh

        The platform team owns the tools that make the right thing easy: templates that create a
        product with storage, CI, tests and catalog entry; a policy engine; cost reports per
        domain; and a shared query layer. Without this platform, a mesh becomes 30 teams building
        30 incompatible pipelines.

        ## When it is the wrong answer

        - **Small companies.** Under about 10 data-producing domains, or with one data team of 15,
          a central team is faster. A mesh adds coordination before it removes any.
        - **Domains with no data skills.** Ownership without people is a ticket queue with extra steps.
        - **Heavily cross-domain metrics.** Revenue, active users and margin still need a central
          owner. Mesh leaves room for that: a "consumer-aligned" product owned by a central team.

        > [!trap] Renaming the data lake
        > Putting team names on folders in one bucket is not a mesh. The test: can a consumer find
        > a product, read its contract and SLO, and know who gets paged when it breaks?

        > [!senior] What a senior answer says
        > "Mesh is a fix for a scaling bottleneck in people, not in compute. I would start with the
        > two domains that hurt most, give them a platform template and computational policies,
        > measure lead time for a new dataset and incidents per product, and expand only if those
        > numbers improve."
      `,
      checks: [
        {
          question: 'Which problem was data mesh designed to solve?',
          options: [
            'Slow queries on a large warehouse',
            'A central data team becoming the bottleneck for every domain',
            'The cost of object storage',
            'Late data in streaming jobs',
          ],
          answer: 1,
          why: 'Mesh is an organisational fix: it moves ownership to the domains that understand the data.',
        },
        {
          question: 'What does "federated computational governance" mean in practice?',
          options: [
            'Each domain writes its own rules',
            'A central committee reviews every table by hand',
            'Shared rules are agreed together and enforced automatically by the platform',
            'Governance is skipped to move faster',
          ],
          answer: 2,
          why: 'Rules such as PII tagging and retention are agreed across domains and run as code, for example as CI checks and policies.',
        },
      ],
    },
    {
      slug: 'data-fabric',
      title: 'Data fabric versus data mesh',
      summary:
        'Separate a metadata-driven integration layer from an ownership model, and combine them.',
      minutes: 11,
      body: `
        **Data fabric** is a term used mostly by analysts and vendors, so interviewers ask about it
        to see if you can find the engineering inside the marketing. The idea: an integration layer
        driven by metadata, which connects data where it lives and automates discovery, access and
        governance across many systems.

        ## The parts of a fabric

        - **A unified catalog** that harvests metadata from every source: schemas, lineage, usage.
        - **Active metadata:** the catalog does more than describe. It recommends joins, flags
          stale tables, classifies PII and drives policies.
        - **Virtualisation or federation:** a query engine such as Trino or BigQuery Omni reads
          sources in place, so not every dataset is copied into one store.
        - **One policy layer:** access rules defined once and enforced in every engine.

        ## Fabric and mesh are not rivals

        | Question | Data mesh | Data fabric |
        |---|---|---|
        | What is it? | An ownership and operating model | A technical integration layer |
        | Main lever | People and accountability | Metadata and automation |
        | Data location | Each domain publishes products | Data stays in sources, connected virtually |
        | Main risk | Uneven quality across domains | A vendor platform that promises everything |

        A company can run a mesh on top of a fabric: domains own data products, and the fabric
        catalog, policy engine and federated query layer are the self-serve platform.

        ## Where federation breaks

        Federated queries are great for discovery and low-volume joins. They are poor for heavy,
        repeated work: every query hits operational databases, network cost repeats, and the
        slowest source sets the latency. Materialise what is read often, and federate the long tail.

        > [!trap] Fabric as a product you buy
        > "We will buy a fabric" skips the hard parts: metadata quality, ownership and
        > classification. A catalog full of undocumented tables automates confusion.

        > [!senior] What a senior answer says
        > "Mesh answers who owns data, fabric answers how we find, govern and reach it. I would
        > treat the fabric parts, catalog, lineage, policy and federation, as the self-serve
        > platform for domain-owned products, and copy data only when federation cannot meet the
        > latency or cost target."
      `,
      checks: [
        {
          question: 'What is the best one-line difference between data mesh and data fabric?',
          options: [
            'Mesh is for streaming, fabric is for batch',
            'Mesh is an ownership model, fabric is a metadata-driven integration layer',
            'Mesh is cloud only, fabric is on-premises',
            'They are two names for the same thing',
          ],
          answer: 1,
          why: 'Mesh changes who owns and publishes data; fabric automates finding, governing and reaching data across systems. They can be combined.',
        },
        {
          question: 'When should you materialise data instead of reading it through federation?',
          options: [
            'When the data is small and rarely read',
            'When the query is heavy and repeated, or the source cannot take the load',
            'Never; federation is always cheaper',
            'Only for streaming data',
          ],
          answer: 1,
          why: 'Repeated heavy queries hit sources every time and inherit their latency. Materialise hot paths, federate the long tail.',
        },
      ],
    },
    {
      slug: 'reverse-etl',
      title: 'Reverse ETL and operational analytics',
      summary:
        'Push warehouse data back into the tools teams use, without breaking them or the API limits.',
      minutes: 13,
      body: `
        The warehouse holds the best view of a customer: product usage, payments, support tickets,
        model scores. **Reverse ETL** syncs that view back into operational tools such as a CRM,
        an ad platform or a support desk, so a sales rep sees the lead score where they work.
        Tools such as Hightouch and Census do this as a service. You should still know how to
        build one, because the hard parts are the same.

        ## The sync loop

        1. A **model** in the warehouse defines the rows to sync, with a stable primary key.
        2. The sync computes a **diff** against the last successful run: new, changed and removed rows.
        3. Only the diff goes to the destination API, in batches that respect its limits.
        4. Each row's result is recorded. Failed rows retry; the last good snapshot is updated
           only for rows that succeeded.

        ~~~sql
        -- Rows to send this run: new or changed since the last good snapshot
        SELECT cur.*
        FROM lead_scores AS cur
        LEFT JOIN sync_snapshot AS prev
          ON prev.lead_id = cur.lead_id
        WHERE prev.lead_id IS NULL
           OR prev.row_hash <> cur.row_hash;
        ~~~

        ## The hard parts

        - **API limits.** SaaS APIs cap calls per day and per second, and the caps vary by plan.
          Use bulk endpoints, send only diffs, and plan sync frequency from the budget.
        - **Identity.** The destination has its own ids. Map warehouse keys to destination ids
          (email, external id field) and store the mapping; never match on a name.
        - **Idempotency.** Use upsert on an external id field so a retried batch does not create
          duplicates.
        - **Ownership of fields.** Decide which fields the warehouse owns. If sales reps also edit
          a field, the sync will overwrite their work. Write to fields the warehouse owns only.
        - **Deletes.** Removing a row from the model should unset or tag the record, not delete a
          CRM account. Make delete behaviour explicit per sync.

        ## Operating it

        Treat each sync as a production pipeline with an owner: alert on failed row rate, on a diff
        that is suddenly 50 times larger than normal (often an upstream bug), and on stale syncs.
        A circuit breaker that stops a sync with a huge diff saves you from overwriting 2 million
        CRM records with nulls.

        > [!trap] Syncing the whole table every hour
        > A full sync burns the API budget, hits rate limits and makes every record look recently
        > modified, which can trigger the destination's own workflows. Always diff.

        > [!senior] What a senior answer says
        > "The warehouse is the source for the fields it owns. I sync diffs by a stable key, upsert
        > on an external id, respect the API budget, record per-row results, and stop the sync when
        > the diff is abnormally large. Business users get freshness the API budget can pay for."
      `,
      checks: [
        {
          question: 'Why compute a diff instead of sending the full model each run?',
          options: [
            'Diffs are easier to write in SQL',
            'Full syncs burn the API budget and touch every record in the destination',
            'Destinations reject full loads',
            'It makes the warehouse query faster',
          ],
          answer: 1,
          why: 'APIs have call limits, and touching every record can trigger downstream workflows. Sending only changes keeps the sync cheap and safe.',
        },
        {
          question: 'The diff for tonight is 40 times the usual size. What should the sync do?',
          options: [
            'Send it; the warehouse is the source of truth',
            'Stop and alert, because a sudden huge diff usually means an upstream bug',
            'Send half and wait a day',
            'Delete the destination records and reload',
          ],
          answer: 1,
          why: 'A circuit breaker on diff size prevents a bad model from overwriting millions of operational records.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'choose-lambda-or-kappa',
    title: 'Lambda, Kappa or neither for a payments platform',
    track: 'architecture',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      A payments team wants two things from the same events: a fraud operations dashboard that is
      fresh within 30 seconds, and daily settlement reports that must match the bank to the cent.
      One engineer proposes Lambda, another proposes Kappa. The events arrive in Kafka with 7
      days of retention. Which do you choose, and why?
    `,
    hints: [
      'The two consumers have very different correctness needs.',
      'How would Kappa fix a bug in last quarter’s settlement numbers with 7 days of retention?',
      'Can one codebase serve both schedules?',
    ],
    answer: `
      **Split by need first.** The dashboard needs freshness and tolerates small errors. Settlement
      needs exactness, reconciliation and the ability to restate history.

      **Pure Kappa does not fit.** With 7 days of retention, a bug found after a month cannot be
      fixed by replay. Extending retention to years in Kafka is possible with tiered storage, but
      replaying a quarter through a stream job is slow and puts finance on the critical path of a
      stream deploy.

      **Classic Lambda costs too much.** Two codebases for "settled amount" will drift, and the
      fraud team and finance will argue about whose number is right.

      **Recommendation: one logic, two schedules.**

      - Kafka lands every event in the lake (bronze) with exactly-once or idempotent writes.
      - A Flink or Spark Structured Streaming job computes fraud metrics into a serving store for
        the dashboard.
      - The settlement report is a batch job over the lake, using the same transformation library,
        run after the day closes, then reconciled against the bank file.
      - A bug fix is a batch re-run of the affected days. The stream path is never used for money.

      **Operate.** Reconcile stream totals against batch totals daily; a gap above a threshold
      pages the owner, because it means the two paths diverged.
    `,
    signals: [
      'Separates the two consumers by freshness and correctness',
      'Notices that 7-day retention rules out replay-based fixes',
      'Names the drift cost of two codebases in Lambda',
      'Proposes shared logic run in stream and batch modes',
      'Keeps money on the batch, reconciled path',
    ],
    followUps: [
      'Finance now wants intraday settlement estimates every hour. What changes?',
      'How do you prove the stream and batch code really compute the same thing?',
    ],
  },
  {
    slug: 'fix-medallion-contracts',
    title: 'Gold tables break every time a source changes',
    track: 'architecture',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      A lakehouse has bronze, silver and gold folders. Bronze parses JSON with a strict schema and
      drops rows that fail. Silver is a copy of bronze with renamed columns. Gold tables join raw
      silver tables directly, and three gold tables each compute "active driver" differently.
      Every source schema change breaks a dashboard, and last month a parser bug lost two days of
      data for good. Redesign the layers.
    `,
    hints: [
      'What must bronze guarantee so that nothing is ever lost?',
      'What does silver promise that bronze does not?',
      'Where should one business definition live?',
    ],
    answer: `
      **Bronze: land everything, fail nothing.** Store the raw payload (string or variant) with
      load metadata, append only. No strict parse here, so a schema change cannot drop rows. The
      lost two days happened because bronze did silver's job.

      **Silver: the correctness layer.**

      - Parse with an explicit, versioned schema. Rows that fail go to a quarantine table with the
        error, and an alert fires when the quarantine rate jumps.
      - Deduplicate on the event id, conform keys and types, mask or tag PII.
      - Publish a schema contract per silver table. Additive source changes flow through;
        breaking changes are mapped here, so gold sees a stable shape.

      **Gold: owned definitions.**

      - One owner defines «active_driver» once, in a shared dimension or metric layer, and the
        three gold tables read it.
      - Each gold table names its consumer and owner, and has freshness and row-count checks.

      **Prove it.** Run a rebuild drill: drop a silver partition and rebuild it from bronze, and
      time it. Add a data contract check in the source team's CI so breaking changes are caught
      before they ship.
    `,
    signals: [
      'Moves strict parsing out of bronze so nothing is lost',
      'Adds quarantine with alerting instead of silent drops',
      'Gives silver a real contract, not just renamed columns',
      'Defines each business metric once, with an owner',
      'Proposes a rebuild drill or source-side contract checks',
    ],
    followUps: [
      'Bronze costs 40% of the storage bill. How do you cut it without losing rebuilds?',
      'A streaming consumer needs data within 1 minute. Does it read bronze, silver or gold?',
    ],
  },
  {
    slug: 'design-event-sourced-wallet',
    title: 'Design an event-sourced wallet ledger and its analytics',
    track: 'architecture',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber'],
    prompt: `
      Design the ledger for a rider and driver wallet. 50 million wallets, about 3,000 balance
      changes per second at peak. The app must show the current balance instantly. Finance needs
      the balance of every wallet at the end of each day, a full audit trail, and the ability to
      add new reports over past data. Some users ask for their data to be erased.
    `,
    hints: [
      'What is the source of truth, and what is derived?',
      'How do you read a balance without replaying years of events?',
      'How do events reach analytics without a dual write?',
      'How does erasure work if events are immutable?',
    ],
    answer: `
      **Source of truth.** An append-only event store, partitioned by wallet id, with events such
      as «Credited», «Debited», «Reversed». Each event has a wallet sequence number; a write
      appends only if the expected sequence matches, which prevents lost updates (optimistic
      concurrency). Commands are validated against the current state before appending.

      **Read models (CQRS).**

      - Current balance: a projection keyed by wallet id in a low-latency store, updated in the
        same transaction as the append, or within milliseconds by a projector. The app reads this.
      - Snapshots every N events per wallet, so rebuilding one wallet is fast.

      **To analytics.** Events go to Kafka through a transactional outbox (or log-based CDC on the
      event table), so no event is lost between the database and Kafka. Consumers dedupe on the
      event id. The lake keeps every event forever in bronze.

      **End-of-day balances.** A batch job folds events up to midnight per wallet, starting from
      the previous day's closing balance, and writes a daily balance table. A reconciliation
      checks that the sum of closing balances equals the opening sum plus net flows.

      **Erasure.** Keep personal data out of events; reference a person id. Personal details live
      in a separate store, or are encrypted with a per-person key that is deleted on erasure.
      Amounts stay, as finance must keep them by law.

      **Evolution.** Version every event type in a schema registry. New reports replay the lake
      copy, not the production store.
    `,
    signals: [
      'Uses optimistic concurrency on a per-wallet sequence',
      'Separates the event store from read models and snapshots',
      'Publishes through an outbox or CDC, not a dual write',
      'Reconciles daily balances against flows',
      'Handles erasure with separation or crypto-shredding',
      'Versions events and replays from the lake for new reports',
    ],
    followUps: [
      'A bug credited 10,000 wallets twice. How do you correct it in an event-sourced system?',
      'How do you keep the balance projection consistent if the projector falls behind?',
    ],
  },
  {
    slug: 'design-reverse-etl-crm-sync',
    title: 'Design a reverse ETL sync of lead scores into a CRM',
    track: 'architecture',
    kind: 'design',
    difficulty: 'medium',
    companies: ['google', 'uber'],
    prompt: `
      A model in the warehouse scores 8 million business leads nightly. Sales wants the score and
      three usage fields on each lead in the CRM by 7 a.m. The CRM allows about 150,000 API calls
      a day and has a bulk API that takes 10,000 records per job. Reps also edit some fields by
      hand. Design the sync.
    `,
    hints: [
      'How many records change each night?',
      'How do you match a warehouse lead to a CRM record?',
      'Which fields may the sync overwrite?',
      'What protects the CRM from a bad model run?',
    ],
    answer: `
      **Scope the change set.** Scores move for only a fraction of leads each night, often 5 to 10
      percent. Compute a diff against the last good snapshot using a hash of the synced fields.
      At 10% that is 800,000 records, or 80 bulk jobs, well inside the call budget.

      **Identity.** Each CRM lead stores the warehouse lead id in an external id field. The sync
      upserts on that field, so retries never duplicate. New leads without a CRM record are created
      only if sales agreed to that; otherwise they wait for the CRM to create them.

      **Field ownership.** The sync writes only fields the warehouse owns: score, score date and
      the three usage fields. Fields reps edit are never in the payload. Document this in the sync
      config and the CRM field description.

      **Run.**

      - Schedule after the model's freshness and quality checks pass, with a deadline alert at 6 a.m.
      - Send bulk jobs in parallel up to the destination's concurrency limit; record per-record
        results; retry failures with backoff; update the snapshot only for successes.
      - **Circuit breaker:** stop if the diff exceeds, say, 3 times the 30-day median, or if more
        than 1% of scores are null. Alert the owner instead of sending.

      **Observe.** Track rows sent, failed and skipped per run, API calls used versus budget, and
      sync lag. A weekly audit samples CRM records and compares them to the warehouse.
    `,
    signals: [
      'Sizes the diff and checks it against the API budget',
      'Upserts on an external id for idempotency',
      'Restricts writes to warehouse-owned fields',
      'Adds a circuit breaker on diff size or null rate',
      'Records per-record results and retries only failures',
    ],
    followUps: [
      'Sales now wants scores updated within 15 minutes of a product event. What changes?',
      'A lead is deleted in the warehouse. What should happen in the CRM?',
    ],
  },
  {
    slug: 'advise-on-data-mesh',
    title: 'Should we adopt data mesh?',
    track: 'architecture',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['google', 'uber'],
    prompt: `
      Your company has 600 engineers, 12 product domains and a central data team of 25. The
      backlog of data requests is four months long, and the central team is on call for
      pipelines it does not understand. A director has read about data mesh and also a vendor's
      "data fabric" pitch, and asks you to recommend one in the next planning cycle. What do you
      say?
    `,
    hints: [
      'Which part of the problem is about people, and which part is about tooling?',
      'Do all 12 domains have the skills to own data?',
      'How would you prove it works before rolling it out everywhere?',
    ],
    answer: `
      **Diagnose.** The pain is a people bottleneck: one team owns data it does not understand.
      That is the problem mesh targets. Fabric targets discovery and integration, which is not the
      main complaint here. So the core of the answer is ownership, with fabric-style tooling as
      the platform.

      **Do not big-bang it.** Pick two domains with the most requests and real engineering
      capacity, for example marketplace and payments. Move ownership of their source-aligned
      datasets to them, with on-call.

      **Build the platform first, small.**

      - A template that creates a data product: storage, CI with tests, a contract, a catalog
        entry, freshness checks and cost tags.
      - Computational policies: PII classification required, naming, retention, all as CI checks.
      - A catalog with lineage, so consumers find products and owners.

      **Keep a centre.** Company-wide metrics (revenue, active users) stay with a central
      analytics engineering team as consumer-aligned products. The central data team becomes the
      platform team plus that group.

      **Measure.** Lead time for a new dataset, backlog size, incidents per product, percentage of
      products meeting their SLO, and domain satisfaction. Expand after two quarters if they improve.

      **On the vendor pitch.** Evaluate the catalog, lineage and policy features as platform
      components. Do not buy a "fabric" as a replacement for ownership.
    `,
    signals: [
      'Diagnoses the bottleneck as organisational before choosing',
      'Separates mesh (ownership) from fabric (integration tooling)',
      'Pilots with two capable domains instead of a big bang',
      'Builds a self-serve platform and policies as code first',
      'Keeps central ownership for cross-domain metrics',
      'Defines success metrics before expanding',
    ],
    followUps: [
      'Six months in, two domains publish products with no tests. What do you do?',
      'How do you fund the platform team when its value is spread across domains?',
    ],
  },
];
