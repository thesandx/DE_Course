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
      minutes: 16,
      body: `
        ## Start with the problem

        The ops team wants a live dashboard of trips per city, fresh to the minute. Finance wants exact
        daily revenue that never changes after it is reported. A streaming job gives fresh numbers, but
        it can miss late events and has bugs that are hard to fix in the past. A nightly batch job gives
        exact numbers, but they are a day old.

        Every data platform answers one question: **how do fresh results and correct results live
        together?** Lambda and Kappa are the two classic answers. Most modern platforms run a third one, a
        unified engine, but the interview still uses the old names.

        ## Idea 1: Lambda, two paths merged at read

        Think of a newspaper with a live website. Reporters post quick updates all day (fast, sometimes
        wrong). Each night editors write the checked print edition (slow, correct). The print edition
        replaces the day's updates.

        **Lambda architecture** runs a batch layer and a speed layer side by side.

        - The **batch layer** recomputes views from the full, immutable master dataset, often daily.
        - The **speed layer** covers only the gap since the last batch run, with approximate,
          incremental results.
        - The **serving layer** merges both at query time.

        ~~~text
        Batch path:
        events → lake
          → batch layer
          → batch views

        Speed path:
        events → stream job
          → realtime views

        Serving layer:
        batch views
          + realtime views
          → one merged answer
        ~~~

        - **What it buys:** the batch path heals every mistake of the speed path. A bug in the stream job
          lives only until the next batch run.
        - **What it costs:** the same logic is written twice, in two engines, by two teams. The two
          versions drift, and the merged number disagrees with itself at the boundary.

        ## Idea 2: Kappa, the log is the source of truth

        **Kappa architecture** removes the batch layer. Every result comes from one stream job that reads
        an append-only log.

        To fix a bug or change logic, you start a second copy of the job from offset 0 (or from the lake
        copy of the log), let it catch up, then switch readers to its output and stop the old job. Like
        re-reading a diary from the first page with new glasses.

        - **What it buys:** one codebase, one set of semantics.
        - **What it costs:** you must keep the log long enough to replay, and a replay must be fast.
          Reprocessing a year of events through a stream job at 3x real time still takes four months.
        - **Kafka tiered storage** (GA in Kafka 3.9) makes long retention cheaper, because old segments
          live in object storage. It does not make the replay faster.

        ## Idea 3: the modern answer, one engine, two modes

        Engines such as Flink, Spark Structured Streaming and Beam on Dataflow run the same code in batch
        and stream mode. A table format such as Iceberg or Delta lets the stream job write the same tables
        that a backfill rewrites. So most teams now run:

        - **Seconds-fresh, approximate:** a stream job into a serving store.
        - **Hourly or daily, exact:** the same logic as a batch job over the lake.
        - **Fix history:** re-run the batch mode for the bad partitions.

        This is Lambda in shape, with one codebase. Name it that way in the interview: "one logic, two
        schedules".

        ## Idea 4: micro-batch is often enough

        A job that runs every 5 minutes on new files is a valid design. It has no state store to manage,
        no watermarks, and retries are a re-run.

        Ask what the consumer does with a fresher number. If nobody acts within 5 minutes, streaming buys
        cost and on-call pages, not value.

        ## Now say it like a senior engineer

        Lambda pairs a correcting batch layer with a fast speed layer, at the cost of two codebases. Kappa
        uses one stream job and replays the log, at the cost of retention and slow replays. Today one
        engine runs the same logic as a stream for freshness and as a batch for exact history, and
        micro-batch covers most "near real time" needs.

        > [!trap] Streaming because it sounds senior
        > Proposing Flink for a daily finance report is a red flag. Seniors choose the slowest
        > freshness the consumer accepts, then add a fast path only where someone acts on it.

        > [!senior] What a senior answer says
        > "The dashboard needs one-minute freshness, finance needs exact daily numbers. I run one
        > Flink job for the dashboard and the same transformation as a batch job over the lake for
        > finance. A bug fix is a batch re-run of the affected days, not a log replay. That keeps
        > the Lambda benefit, self-healing history, without two codebases."

        ## In one breath

        Lambda is a fast path corrected by a slow path, Kappa is one stream you replay to fix, and the
        modern answer is one piece of logic run both ways. Pick the slowest freshness the consumer
        accepts, and stream only where someone acts on the fresher number.
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
      minutes: 15,
      body: `
        ## Start with the problem

        A team copies every source into the lake three times: «raw/», «clean/» and «final/». It costs
        three times the storage. Then a silver job uses the wrong timezone for 9 days, and they discover
        the raw copy was parsed too, and rows that failed parsing were dropped. The data is gone. They
        must ask the source for 9 days again, and the source only keeps 7.

        The **medallion architecture** splits a lakehouse into three layers by how much the data has been
        refined. Databricks popularised the names, but the idea is older: raw, cleaned, and modelled
        zones. The value is not the three names. It is **a clear contract at each layer**.

        ## Idea 1: three layers, three promises

        Think of a water plant. The intake tank holds water exactly as it came from the river. The filter
        tank holds clean water. The taps give water shaped for each use: drinking, the garden, the fire
        hose.

        **Bronze: exactly what the source sent, plus load metadata.**

        - Append only.
        - No parsing that can fail.
        - Keep «_ingested_at», «_source_file» and «_batch_id».

        **Silver: one clean, conformed row per business entity or event.**

        - Typed, deduplicated, keys enforced.
        - PII tagged or masked.
        - Late data merged.

        **Gold: answers for a consumer.**

        - Facts and dimensions, aggregates, feature tables.
        - Named for the business, not the source.

        ## Idea 2: why bronze must be dumb

        Bronze exists so you can rebuild everything downstream. If bronze parses JSON and drops rows that
        fail, a parser bug loses data for good. That is the story above.

        So bronze stores the payload as text or a variant type. The parse happens in silver, where a
        failed row goes to a **quarantine** table with the reason.

        ## Idea 3: where the work goes

        - **Deduplication** goes in silver, on a natural or event id, with a deterministic winner: the
          latest «updated_at», then the highest offset.
        - **Joins across sources** go in silver when they conform one entity (customer from CRM plus
          customer from billing), and in gold when they serve one question.
        - **Business logic** (what counts as an active user) goes in gold, in one place, under a named
          owner. If two gold tables compute it, they will disagree.

        ## Idea 4: how it goes wrong

        - **Layers as folders, not contracts.** Teams copy data three times and gain nothing. Each layer
          must promise something the previous one did not.
        - **Gold sprawl.** Every dashboard gets its own gold table. Set a rule: a new gold table needs an
          owner and a consumer, and unused ones are retired after 90 days.
        - **Cost.** Three full copies of a large table cost real money. Silver can be a view for small
          sources, and bronze can expire after the retention you need for rebuilds.
        - **Streaming and medallion.** Each hop adds latency. A stream path often reads bronze and writes
          a gold serving table directly, with silver built in parallel.

        ## Now say it like a senior engineer

        Bronze is an append-only replay buffer that never fails a row. Silver enforces types, keys,
        deduplication and quarantine. Gold holds business definitions once, under a consumer's ownership.
        Each layer can be rebuilt from the one below, and that is tested in drills.

        > [!example] A rebuild after a bug
        > A silver job used the wrong timezone for 9 days. Because bronze is complete and
        > append only, you fix the code, overwrite the 9 affected silver partitions from bronze,
        > then rebuild the gold partitions that read them. Nobody re-pulls from the source.

        > [!senior] What a senior answer says
        > "Bronze is the replay buffer, so it is append only and never fails a row. Silver is
        > where correctness lives: types, dedup, keys and quarantine. Gold is owned by a consumer
        > and holds the business definitions once. I can rebuild any layer from the one below it,
        > and I measure that by actually doing it in a drill."

        ## In one breath

        Bronze keeps exactly what arrived, silver makes it correct, and gold answers a consumer's
        question. The point is the promise at each layer, above all a dumb, complete bronze you can always
        rebuild from.
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
      minutes: 17,
      body: `
        ## Start with the problem

        An «accounts» table holds one row per account with the current balance. Finance asks: "What was
        account 7's balance on 1 March, and why did it change on 3 March?" The table cannot say. Every
        update overwrote the last one.

        In a normal service, a table holds the current state and an update overwrites it. With **event
        sourcing**, the service stores every change as an immutable event, and the current state is a fold
        over those events. For data engineers this matters twice: you often consume such a log, and you
        are often asked to design one.

        ## Idea 1: a bank passbook, not a whiteboard

        A whiteboard shows only today's balance; you wipe it and write the new number. A bank passbook
        lists every deposit and withdrawal. You can work out the balance on any day by adding up the lines
        until that day.

        ~~~text
        AccountOpened
          id=7, owner=ana
        MoneyDeposited
          id=7, amount=100
        MoneyWithdrawn
          id=7, amount=30
        ──────────────────
        state(7) = fold(events)
         = owner ana,
           balance 70
        ~~~

        - The **event store** is append only, ordered per aggregate (here, per account), and the source of
          truth.
        - A **projection** reads the events and builds a read model: a balance table, a search index, a
          daily ledger in the warehouse.
        - **Snapshots** store the folded state every N events, so a read does not replay 10 years.

        ## Idea 2: CQRS, separate the writing desk from the reading room

        **Command Query Responsibility Segregation** separates:

        - the **write model**: validate a command, append events;
        - the **read models**: projections shaped for each query.

        Event sourcing and CQRS are often used together, but either works alone. Read models are
        eventually consistent: a projection may lag the event store by seconds.

        ## Idea 3: why data teams like it

        - **Full history for free.** Point-in-time questions ("what was the balance on 1 March?") are a
          fold up to a timestamp.
        - **New read models without migration.** A new projection replays from the start.
        - **Audit.** Nothing is overwritten. Finance and compliance love this.

        ## Idea 4: what it costs

        - **Schema evolution is permanent.** Old events never go away, so every projection must read every
          version. Use a schema registry, additive changes, and upcasters that convert old versions on
          read.
        - **Deletion conflicts with immutability.** For GDPR erasure, keep personal data out of events, or
          encrypt it per person and delete the key (crypto-shredding).
        - **Replays are slow at scale.** Plan snapshots and parallel replay per aggregate.

        ## Idea 5: the outbox, so no event is lost

        A service that writes its database and then publishes to Kafka can fail between the two. The
        database says "withdrawn", but Kafka never hears about it. That is the **dual-write problem**.

        The **transactional outbox** fixes it. Write the business row and an «outbox» row in one database
        transaction. Like writing the letter and putting it in your own out-tray in one move: either both
        happen or neither does. A relay, often Debezium reading the database log, publishes outbox rows to
        Kafka.

        ~~~sql
        BEGIN;
        UPDATE accounts SET balance = balance - 30 WHERE id = 7;
        INSERT INTO outbox (event_id, aggregate_id, type, payload)
        VALUES ('e-91', 7, 'MoneyWithdrawn', '{"amount": 30}');
        COMMIT;
        ~~~

        Delivery is at least once, so consumers dedupe on the event id.

        ## Now say it like a senior engineer

        Event sourcing stores immutable per-aggregate events and derives state by folding, with snapshots
        and rebuildable projections. CQRS separates writes from read models. The costs are permanent schema
        versions, erasure via crypto-shredding, and slow replays. The outbox removes the dual-write gap.

        > [!trap] CDC is not event sourcing
        > A CDC stream of row changes tells you a column changed. It does not say why. An event
        > such as «RefundIssued» carries intent. If the analytics need intent, ask the service to
        > publish domain events through an outbox, not to rely on table diffs.

        > [!senior] What a senior answer says
        > "I would event-source the ledger, where history and audit are the product, and not the
        > user profile, where they are not. Projections are rebuildable, events are versioned with
        > upcasters, personal data is crypto-shredded, and publishing uses an outbox so no event is
        > lost between the database and Kafka."

        ## In one breath

        Event sourcing keeps a passbook of every change instead of a whiteboard of the current state, so
        history, audit and new read models come free. Pay for it with permanent event versions and careful
        deletion, and publish through an outbox so no event is lost.
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
      minutes: 16,
      body: `
        ## Start with the problem

        A company has one central data team of 12 people and 30 product teams. Every new dataset is a
        ticket in the central team's queue, with a six-week wait. When the payments pipeline breaks, the
        central team gets paged at 3 AM for data they do not understand, broken by a change they did not
        make.

        **Data mesh** is an organisational pattern, not a technology. Zhamak Dehghani described it in 2019
        as an answer to exactly this failure: a central data team that becomes the bottleneck for every
        domain, owns data it does not understand, and fixes pipelines it did not break.

        ## Idea 1: four principles

        Think of a food market instead of one big restaurant kitchen. Each stall cooks what it knows best
        and is responsible for it. The market provides the building, power, water and hygiene rules, and
        an inspector checks everyone by the same rules.

        - **Domain ownership.** The team that runs the business process owns its analytical data. So
          payments owns payments data end to end, including on-call.
        - **Data as a product.** Shared data has users, an owner, docs, SLOs and versioning. A table is
          published on purpose, not leaked from a pipeline.
        - **Self-serve platform.** A platform team builds paved roads, not pipelines. Domains create a
          product in a day without filing a ticket.
        - **Federated computational governance.** Global rules are agreed together and enforced by code.
          PII tagging, naming and retention are checks in CI, not reviews.

        ## Idea 2: what a data product is

        A data product is the unit of sharing. It is more than a table:

        - **Output ports:** the tables, topics or APIs consumers read, with a schema contract.
        - **An owner and an SLO:** freshness, completeness, and who gets paged.
        - **Metadata:** description, lineage, classification and sample queries, in the catalog.
        - **Versioning:** a breaking change ships as v2 next to v1, with a deprecation window.
        - **Input ports and code:** how it is built, kept in the domain's repo.

        ## Idea 3: the platform under a mesh

        The platform team owns the tools that make the right thing easy:

        - templates that create a product with storage, CI, tests and a catalog entry;
        - a policy engine;
        - cost reports per domain;
        - a shared query layer.

        Without this platform, a mesh becomes 30 teams building 30 incompatible pipelines. A market
        without a building is just people cooking in a field.

        ## Idea 4: when it is the wrong answer

        - **Small companies.** Under about 10 data-producing domains, or with one data team of 15, a
          central team is faster. A mesh adds coordination before it removes any.
        - **Domains with no data skills.** Ownership without people is a ticket queue with extra steps.
        - **Heavily cross-domain metrics.** Revenue, active users and margin still need a central owner.
          Mesh leaves room for that: a "consumer-aligned" product owned by a central team.

        ## Now say it like a senior engineer

        Data mesh moves ownership of analytical data to domains, treats shared data as versioned products
        with SLOs, provides a self-serve platform, and enforces global policy as code. It fixes a people
        bottleneck, so adopt it gradually and measure lead time and incidents.

        > [!trap] Renaming the data lake
        > Putting team names on folders in one bucket is not a mesh. The test: can a consumer find
        > a product, read its contract and SLO, and know who gets paged when it breaks?

        > [!senior] What a senior answer says
        > "Mesh is a fix for a scaling bottleneck in people, not in compute. I would start with the
        > two domains that hurt most, give them a platform template and computational policies,
        > measure lead time for a new dataset and incidents per product, and expand only if those
        > numbers improve."

        ## In one breath

        Data mesh turns one overloaded central kitchen into a market of stalls: each domain owns its data
        as a product, on a shared platform, under rules enforced by code. It solves a people bottleneck,
        so it is wrong for small companies and domains without data skills.
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
      minutes: 13,
      body: `
        ## Start with the problem

        A vendor deck says: "Our data fabric connects all your data, everywhere, with AI." The interviewer
        asks: "What is a data fabric, and how is it different from a mesh?" If you repeat the deck, you
        lose. If you find the engineering inside the marketing, you win.

        **Data fabric** is a term used mostly by analysts and vendors. The real idea underneath: an
        integration layer driven by metadata, which connects data where it lives and automates discovery,
        access and governance across many systems.

        ## Idea 1: the parts of a fabric

        Think of a city's road network plus its map app. The buildings (your data) stay where they are.
        The roads connect them, the map tells you what is where, and traffic rules apply on every road.

        - **A unified catalog** that harvests metadata from every source: schemas, lineage, usage. The
          map.
        - **Active metadata.** The catalog does more than describe. It recommends joins, flags stale
          tables, classifies PII and drives policies. The map that warns you about traffic.
        - **Virtualisation or federation.** A query engine such as Trino or BigQuery Omni reads sources in
          place, so not every dataset is copied into one store. The roads.
        - **One policy layer.** Access rules are defined once and enforced in every engine. The traffic
          rules.

        ## Idea 2: fabric and mesh are not rivals

        They answer different questions.

        **Data mesh.**

        - What it is: an ownership and operating model.
        - Main lever: people and accountability.
        - Data location: each domain publishes products.
        - Main risk: uneven quality across domains.

        **Data fabric.**

        - What it is: a technical integration layer.
        - Main lever: metadata and automation.
        - Data location: data stays in sources, connected virtually.
        - Main risk: a vendor platform that promises everything.

        A company can run a mesh **on top of** a fabric. Domains own data products, and the fabric
        catalog, policy engine and federated query layer are the self-serve platform.

        ## Idea 3: where federation breaks

        Federated queries are great for discovery and low-volume joins. They are poor for heavy, repeated
        work:

        - every query hits operational databases;
        - network cost repeats on every run;
        - the slowest source sets the latency.

        Like driving across the city every time you need milk, instead of keeping some in the fridge.
        Materialise what is read often, and federate the long tail.

        ## Now say it like a senior engineer

        A fabric is a metadata-driven layer: a unified, active catalog, federated query, and one policy
        layer. Mesh decides ownership; fabric provides discovery, governance and access, and can serve as
        the mesh's platform. Federate the long tail and materialise hot, heavy paths.

        > [!trap] Fabric as a product you buy
        > "We will buy a fabric" skips the hard parts: metadata quality, ownership and
        > classification. A catalog full of undocumented tables automates confusion.

        > [!senior] What a senior answer says
        > "Mesh answers who owns data, fabric answers how we find, govern and reach it. I would
        > treat the fabric parts, catalog, lineage, policy and federation, as the self-serve
        > platform for domain-owned products, and copy data only when federation cannot meet the
        > latency or cost target."

        ## In one breath

        A data fabric is a map, roads and traffic rules over data that stays where it is: an active
        catalog, federated queries and one policy layer. Mesh says who owns the data, fabric says how you
        reach and govern it, and heavy repeated queries still need a materialised copy.
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
      minutes: 15,
      body: `
        ## Start with the problem

        The data team builds a great lead score in the warehouse, from product usage, payments and support
        tickets. Sales never looks at it. They live in the CRM, and the score lives in a dashboard they
        never open.

        So someone writes a script that pushes all 2 million scores to the CRM every hour. Within a week
        it hits the CRM's daily API limit, creates duplicate contacts on retries, and overwrites notes that
        sales reps typed by hand.

        **Reverse ETL** syncs the warehouse's view back into operational tools such as a CRM, an ad
        platform or a support desk, so a sales rep sees the lead score where they work. Tools such as
        Hightouch and Census do this as a service. You should still know how to build one, because the
        hard parts are the same.

        ## Idea 1: the sync loop, send only what changed

        Think of updating a friend about your week. You do not retell your whole life every time. You tell
        them what is new since you last spoke.

        1. A **model** in the warehouse defines the rows to sync, with a stable primary key.
        2. The sync computes a **diff** against the last successful run: new, changed and removed rows.
        3. Only the diff goes to the destination API, in batches that respect its limits.
        4. Each row's result is recorded. Failed rows retry; the last good snapshot is updated only for
           rows that succeeded.

        ~~~sql
        -- Rows to send this run: new or changed since the last good snapshot
        SELECT cur.*
        FROM lead_scores AS cur
        LEFT JOIN sync_snapshot AS prev
          ON prev.lead_id = cur.lead_id
        WHERE prev.lead_id IS NULL
           OR prev.row_hash <> cur.row_hash;
        ~~~

        A row is sent if it is new (no previous row) or if its hash changed. Unchanged rows cost nothing.

        ## Idea 2: the hard parts

        - **API limits.** SaaS APIs cap calls per day and per second, and the caps vary by plan. Use bulk
          endpoints, send only diffs, and plan sync frequency from the budget.
        - **Identity.** The destination has its own ids. Map warehouse keys to destination ids (email, an
          external id field) and store the mapping; never match on a name.
        - **Idempotency.** Upsert on an external id field, so a retried batch does not create duplicates.
        - **Ownership of fields.** Decide which fields the warehouse owns. If sales reps also edit a
          field, the sync will overwrite their work. Write to fields the warehouse owns only.
        - **Deletes.** Removing a row from the model should unset or tag the record, not delete a CRM
          account. Make delete behaviour explicit per sync.

        Each of these fixes one problem from the story.

        ## Idea 3: operating it

        Treat each sync as a production pipeline with an owner. Alert on:

        - the failed row rate;
        - a diff that is suddenly 50 times larger than normal, which is often an upstream bug;
        - stale syncs.

        A **circuit breaker** that stops a sync with a huge diff saves you from overwriting 2 million CRM
        records with nulls.

        ## Now say it like a senior engineer

        Reverse ETL syncs a keyed warehouse model to operational tools by diffing against the last good
        snapshot, upserting on an external id within the API budget, writing only warehouse-owned fields,
        recording per-row results, and tripping a circuit breaker on abnormal diffs.

        > [!trap] Syncing the whole table every hour
        > A full sync burns the API budget, hits rate limits and makes every record look recently
        > modified, which can trigger the destination's own workflows. Always diff.

        > [!senior] What a senior answer says
        > "The warehouse is the source for the fields it owns. I sync diffs by a stable key, upsert
        > on an external id, respect the API budget, record per-row results, and stop the sync when
        > the diff is abnormally large. Business users get freshness the API budget can pay for."

        ## In one breath

        Reverse ETL puts warehouse insights where people work, by sending only changed rows, upserting on
        a stable id and touching only the fields the warehouse owns. Run it like a production pipeline,
        with a circuit breaker for a suspiciously large diff.
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
    {
      slug: 'batch-streaming-etl-elt',
      title: 'Batch versus streaming, ETL versus ELT',
      summary:
        'Place a pipeline on the latency spectrum, choose where transformations run, and defend the choice with cost, complexity and correctness.',
      minutes: 16,
      body: `
        ## Start with the problem

        A new pipeline brings payments data into the company. Two questions come first, before any tool is
        chosen:

        - **How often** does data move: once a day, every 5 minutes, or every second?
        - **Where** is it transformed: before it lands, or after?

        Get them wrong and you build a 24/7 streaming system for a report someone reads on Monday mornings,
        or you load raw card numbers into a warehouse that 500 people can query. Interviewers ask both to
        see if you choose by need or by fashion.

        ## Idea 1: the latency spectrum

        Think of post, a phone call and a live video call. Each is right for some messages and silly for
        others.

        **Daily or hourly batch.**

        - Freshness: hours.
        - Tools: Airflow plus Spark, dbt, warehouse SQL.
        - Cost and complexity: the lowest. Easy to rerun and backfill.

        **Micro-batch.**

        - Freshness: 1 to 15 minutes.
        - Tools: Spark Structured Streaming, Snowpipe, scheduled incremental models.
        - Cost and complexity: medium. Small files, more runs.

        **Streaming.**

        - Freshness: seconds or less.
        - Tools: Kafka plus Flink, Kafka Streams, Dataflow.
        - Cost and complexity: the highest. State, late data, 24/7 on-call.

        Ask "**what decision is made with this data, and how fast?**" A fraud block needs seconds. A
        finance close needs correctness by morning. A dashboard that a human checks twice a day does not
        need streaming, even if it would look modern.

        ## Idea 2: when streaming earns its cost

        - The value of the data decays in seconds or minutes: fraud, surge pricing, ETAs, alerts.
        - The result feeds a machine, not a person: a feature store, a pricing service.
        - The source is already a stream, and batching it adds delay without saving work.

        Otherwise, start with batch or micro-batch. Design so the same logic could later run in a stream:
        event-time logic, idempotent writes, keys on every record.

        ## Idea 3: ETL, ELT and EtLT, where the cooking happens

        Do you cook before you put food in the fridge, or store the raw ingredients and cook later?

        - **ETL:** transform in a separate engine **before** loading (Spark, a Python service). Fits heavy
          parsing, privacy rules before data lands, and cutting huge volumes first.
        - **ELT:** transform **inside** the warehouse or lakehouse after loading (SQL, dbt). Fits most
          analytics today: cheap storage, elastic compute, SQL that analysts can read.
        - **EtLT:** light clean-up in flight (types, PII masking, dedup), business logic after load. The
          practical default for many teams.

        ELT became the default because warehouse compute became elastic and cheap enough, and because
        keeping raw data lets you re-run logic when it changes. dbt made the "T" testable and versioned.

        ## Idea 4: when ETL is still right

        - **Personal data** must be masked or tokenised before it lands where many people can read it.
        - **Volume reduction:** 1 million IoT readings a second, aggregated to one row per device per
          minute before loading.
        - **Unstructured input** (PDFs, images, binary protocols) that SQL cannot parse.
        - **Warehouse compute cost:** a transformation that is far cheaper on Spark over files.

        ## Now say it like a senior engineer

        Choose latency from the decision the data drives: batch by default, micro-batch for minutes,
        streaming only when value decays in seconds or a machine consumes it. Choose ELT by default, keep
        a small "t" in flight for PII and volume, and use full ETL for unstructured input or cost.

        > [!trap] Streaming everything "for the future"
        > A streaming pipeline needs state management, replay plans and people on call at night.
        > Building it for a daily report is cost without value. Say what latency the consumer needs.

        > [!senior] Choose per data set
        > "Payments events stream into a fraud feature pipeline. The same events land in the lake,
        > and finance reporting is a daily dbt job over them. PII is tokenised in flight, so the
        > analytics copy never holds raw card data." One source, two latencies, EtLT, said in one
        > breath.

        ## In one breath

        Pick how often data moves from how fast someone acts on it, and stream only when seconds matter.
        Transform after loading by default, but mask personal data and shrink huge volumes on the way in.
      `,
      checks: [
        {
          question:
            'A dashboard is reviewed by managers each morning. What freshness should drive the design?',
          options: [
            'Sub-second streaming',
            'Daily or hourly batch is enough, because the decision is made once a day',
            'Micro-batch every 30 seconds',
            'Real time, because it is cheaper',
          ],
          answer: 1,
          why: 'Freshness should follow the decision it supports. Streaming here adds cost and on-call work without value.',
        },
        {
          question: 'When is ETL (transform before load) still the better choice?',
          options: [
            'When analysts write SQL',
            'When personal data must be masked before it lands in a widely readable store',
            'When the warehouse is elastic',
            'When you want to keep raw data',
          ],
          answer: 1,
          why: 'If raw PII must never reach the analytics store, the transformation has to run before loading.',
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
    companies: ['uber', 'google', 'flipkart', 'walmart'],
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
    companies: ['uber', 'google', 'flipkart', 'walmart'],
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
    companies: ['uber', 'flipkart', 'walmart'],
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
    companies: ['google', 'uber', 'flipkart', 'walmart'],
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
    companies: ['google', 'uber', 'flipkart', 'walmart'],
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
  {
    slug: 'architecture-batch-or-stream',
    title: 'Batch or streaming for four requests',
    track: 'architecture',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'google', 'flipkart', 'walmart'],
    prompt: `
      Product teams send four requests. For each, choose batch, micro-batch or streaming, and ETL,
      ELT or EtLT, in one or two sentences:

      1. Block a card within 2 seconds when spending looks like fraud.
      2. A daily revenue report for finance, which must match the ledger to the cent.
      3. A city operations dashboard that managers watch during peak hours.
      4. Load support chat transcripts, which contain phone numbers, for topic analysis.
    `,
    hints: [
      'Who or what acts on each result, and how fast?',
      'Which data must be changed before it lands?',
    ],
    answer: `
      1. **Streaming, ETL-style in flight.** A machine acts in seconds. Kafka plus Flink compute
         features and score in the stream; the events also land in the lake for training.
      2. **Daily batch, ELT.** Correctness beats speed. Load the ledger and payments raw, transform
         in dbt with reconciliation tests, publish once the checks pass.
      3. **Micro-batch (1 to 5 minutes), ELT.** Humans watch it, so minute-level freshness is
         enough and far cheaper than per-event processing. Incremental models or a real-time OLAP
         store fed from Kafka.
      4. **Batch, EtLT.** Mask or tokenise phone numbers before the transcripts land in the
         analytics store, then run topic analysis after load.
    `,
    signals: [
      'Chooses latency by who acts on the data',
      'Puts correctness first for financial reporting',
      'Uses micro-batch where minutes are enough',
      'Removes PII before load',
    ],
    followUps: [
      'Finance now wants an intraday revenue estimate. What do you add without breaking the daily report?',
    ],
  },
];
