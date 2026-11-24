import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'streaming',
  title: 'Streaming: Kafka and Flink',
  summary:
    'Partitions, delivery guarantees, event time, watermarks and stateful processing, at marketplace scale.',
  tone: 'grape',
  why: 'Uber runs one of the largest Kafka deployments anywhere, and Google wrote the Dataflow model that modern stream processors follow. Expect at least one deep streaming question in either loop.',
  lessons: [
    {
      slug: 'kafka-internals',
      title: 'Kafka internals that interviews probe',
      summary: 'Topics, partitions, offsets, replication and keys, and what each one guarantees.',
      minutes: 18,
      body: `
        ## Start with the problem

        Every few seconds, every phone in a ride app sends a small message. "Driver 42 is at this
        corner." "Rider 7 asked for a trip." At Uber's size that is millions of messages a minute.

        Many teams want those messages. Pricing wants them now. Fraud wants them now. The data lake
        wants all of them, later, in bulk.

        Try the simple design first: each phone calls each team's service directly. Three things
        break at once.

        1. Pricing is down for five minutes. Every message sent in those five minutes is gone.
        2. A new team wants the data. Every sender must change its code to call one more service.
        3. Fraud is slow today. Now the phone waits for fraud, so the app feels slow.

        We need something in the middle. It must **take messages fast, keep them safely, and let
        any number of readers read at their own speed**. That middle thing is Kafka. The rest of
        this lesson builds Kafka one idea at a time, and each idea fixes one problem.

        ## Idea 1: a notebook you only add to (the log)

        Picture a notebook. You only ever write on the next empty line. You never erase a line and
        you never squeeze a line in between. Every line has a line number.

        That is a **log**. Kafka stores messages, which it calls **records**, in logs like this. The
        line number is called the **offset**.

        Why is "only add at the end" so useful? Because a reader now needs to remember just one
        number: "I have read up to line 1,204."

        - The reader crashes? It restarts at line 1,205. Nothing is skipped.
        - The reader had a bug yesterday? It goes back to line 0 and reads everything again.
        - Ten readers? Each keeps its own number. The writer does not even know they exist.

        ~~~text
         0    1    2    3    4    5   ← offset
        [r0] [r1] [r2] [r3] [r4] [r5] ← add here
                  ▲         ▲
               pricing    fraud
        ~~~

        The notebook does not grow forever. After the **retention** period, for example 7 days,
        Kafka throws away the oldest pages. Until then, any reader can come back and re-read.

        That already fixes problems 1 and 3 from the start: a down or slow reader just falls
        behind and catches up later. And problem 2: a new team simply starts reading.

        ## Idea 2: one notebook is too slow, so use many (partitions)

        One notebook lives on one machine. One machine has one set of disks and one network card,
        so it has a speed limit.

        So Kafka splits a **topic** (a named stream, such as «trip-events») into many notebooks.
        Each one is a **partition**. The partitions live on different machines, which Kafka calls
        **brokers**. Now the writing and the reading spread across many machines.

        But we paid a price for that speed. Inside one notebook, order is clear: line 5 came after
        line 4. Across two notebooks there is no order at all. Record 10 in partition 0 and record 3
        in partition 1: which came first? Kafka does not know, and it does not promise anything.

        That gives the first guarantee you must say precisely in an interview:
        **ordering is per partition, not per topic.**

        ## Idea 3: the key decides the notebook

        If order only exists inside one partition, how do we keep one trip's events in order?
        Simple: make sure all of them go into the same partition.

        A record can carry a **key**. The producer turns the key into a number with a hash, then
        takes the remainder after dividing by the partition count. Same key, same partition, every
        time. Here is a tiny example with 3 partitions (the hash values are made up):

        ~~~text
        trip-81 → hash 7  → partition 1
        trip-81 → hash 7  → partition 1
        trip-95 → hash 12 → partition 0
        ~~~

        7 divided by 3 leaves 1, so "trip-81" goes to partition 1, every time, and its events stay
        in order. 12 divided by 3 leaves 0, so "trip-95" goes to partition 0.

        So key by «trip_id». Each trip stays in order, and different trips spread across all
        partitions.

        Now notice that the key also decides **balance**. Key by «city_id» instead, and every New
        York event lands in one partition. That is a **hot partition**: one broker and one consumer
        work hard while the others sit idle. A good key has many different values, each with a
        similar amount of traffic, and it matches the thing whose order you care about.

        Look at the formula again. It has the partition count in it. Go from 3 partitions to 4, and
        "trip-81" now gives 7 mod 4 = 3. Its old events are in partition 1 and its new events are in
        partition 3. Order across that change is broken. So **changing the partition count later
        re-maps keys**. Choose the count carefully at the start.

        ## Idea 4: readers share the work (consumer groups)

        A reader is a **consumer**. One team usually runs several copies of its consumer, as a
        **consumer group**. Kafka gives each partition to exactly one member of the group, so two
        members never process the same record.

        - 6 partitions, 3 consumers: each consumer reads 2 partitions.
        - 6 partitions, 6 consumers: each reads 1. This is the maximum speed.
        - 6 partitions, 8 consumers: 2 consumers sit idle with nothing to read.

        That is the second big fact: **the partition count caps the parallelism of a consumer
        group.** If you expect to need 30 consumers working at once, you need at least 30 partitions.

        ## Idea 5: do not lose data when a machine dies (replication)

        A partition that lives on one broker dies with that broker. So Kafka keeps copies. With a
        **replication factor** of 3, each partition lives on 3 brokers.

        - One copy is the **leader**. Producers write to it and consumers read from it.
        - The other copies are **followers**. They keep copying from the leader.
        - Followers that are fully caught up are the **in-sync replicas (ISR)**.

        If the leader's broker dies, one of the in-sync followers becomes the new leader. It was
        caught up, so nothing it had is lost.

        ## Idea 6: when is a write really done? (acks)

        The producer sends a record. When should Kafka answer "got it"? The producer setting
        «acks» decides. Think of posting an important letter.

        - «acks=0»: you drop the letter in the box and walk away. If it is lost, you never find out.
        - «acks=1»: the clerk says "received". If the clerk's office burns down before copies are
          filed, the letter is lost. In Kafka: the leader has it, and the leader dies before a
          follower copies it.
        - «acks=all»: the clerk says "received" only after every in-sync copy is filed. It is a bit
          slower, but it survives a broker loss. This is the **durable choice**.

        There is one gap in «acks=all». If the followers fall behind, the ISR can shrink to just
        the leader, and then "all" means one copy. So pair it with «min.insync.replicas=2»: the
        broker refuses the write unless at least two copies will hold it.

        Put it together: replication factor 3, «acks=all» and «min.insync.replicas=2». One broker
        can die, no acknowledged record is lost, and the topic still accepts writes.

        One last gap. A network blip makes the producer retry, so the same record could land twice.
        With «enable.idempotence=true», each producer gets an id and each record a sequence
        number, and the broker drops the repeat. This is the default since Kafka 3.0.

        ## Now say it like a senior engineer

        You have built Kafka from scratch. Here is the same picture in interview words.

        - Kafka is a distributed, append-only, replicated log: topic, then partitions, then offsets.
        - **Ordering is per partition.** Same key, same partition, so order holds per key.
        - **Durability:** replication factor 3, «acks=all», «min.insync.replicas=2», idempotent
          producer.
        - **Parallelism:** one consumer per partition in a group, so the partition count is the cap.
        - **Key choice:** many distinct values, even volume, and it matches the ordering you need.

        > [!trap] More partitions is not free
        > Each partition costs broker memory, open files and leader elections when a broker fails.
        > Size the count from target throughput and consumer parallelism, with headroom. "As many as
        > possible" is the wrong answer.

        > [!senior] Retention is a design choice
        > Retention decides how far back a consumer can replay after a bug. Tiered storage (KIP-405,
        > production-ready in Kafka 3.6+) moves old segments to object storage cheaply, which makes
        > long replay windows affordable. Say how many days of replay the business needs.

        ## In one breath

        Kafka is a notebook you only add to, split into many notebooks for speed and copied three
        times for safety. The key picks the notebook, so the key decides both order and balance.
      `,
      checks: [
        {
          question: 'You need all events of a trip processed in order. What do you do?',
          options: [
            'Use a single partition for the topic',
            'Use trip_id as the record key',
            'Sort events in the consumer by timestamp',
            'Set acks=all',
          ],
          answer: 1,
          why: 'The same key always maps to the same partition, and order holds within a partition. One partition would kill parallelism.',
        },
      ],
    },
    {
      slug: 'delivery-guarantees',
      title: 'Consumers and delivery guarantees',
      summary: 'At-most-once, at-least-once and exactly-once, and what each costs in practice.',
      minutes: 14,
      body: `
        ## Consumer groups

        Consumers in the same **group** split the partitions between them; each partition is read
        by exactly one member. Adding members (up to the partition count) adds parallelism. When a
        member joins or dies, the group **rebalances**. Cooperative rebalancing (incremental) moves
        only the partitions that need to move, instead of stopping everyone.

        ## When you commit decides the guarantee

        | Commit the offset | Crash between processing and commit | Guarantee |
        |---|---|---|
        | Before processing | Records are skipped | At most once |
        | After processing | Records are processed again | At least once |
        | Atomically with the output | Neither | Exactly once (effectively) |

        **At least once plus idempotent writes** is the most common production design: process,
        write with an upsert keyed by event id, then commit. A replay overwrites the same rows.

        ## Exactly-once, honestly

        Kafka transactions let a consume-process-produce application write output records and the
        consumed offsets in one atomic transaction, and readers with «isolation.level=read_committed»
        never see aborted output. Flink achieves end-to-end exactly-once with checkpoints and
        two-phase-commit sinks. Both guarantee **exactly-once effects inside the system**, not
        that an external API is called once.

        > [!senior] Say "effectively once"
        > "The pipeline is at-least-once; the sink is idempotent on «event_id», so the effect is
        > exactly once" is clearer and more honest than claiming magic. Then say where duplicates
        > could still leak, such as an email sender.

        > [!trap] Long processing triggers rebalances
        > If handling a batch takes longer than «max.poll.interval.ms», the consumer is considered
        > dead, its partitions move, and the batch is processed twice. Keep batches small or move
        > slow work off the poll loop.
      `,
      checks: [
        {
          question:
            'A consumer writes to a database and then commits offsets. It crashes after the write but before the commit. What happens?',
          options: [
            'The records are lost',
            'The records are processed again after restart',
            'Kafka rolls back the database write',
            'Nothing, offsets are committed automatically first',
          ],
          answer: 1,
          why: 'Committing after processing is at-least-once: uncommitted records are re-read. An idempotent write makes the replay harmless.',
        },
      ],
    },
    {
      slug: 'event-time-watermarks',
      title: 'Event time, windows and watermarks',
      summary: 'Compute correct windows when data arrives late and out of order.',
      minutes: 17,
      body: `
        ## Start with the problem

        You want a live chart: how many trips started in each minute. The easy idea: when an event
        arrives, look at the server clock and add 1 to that minute's count.

        Now a rider in a tunnel starts a trip at 10:00:30. The phone has no signal, so it sends the
        event at 10:07:10, when it gets out. The easy idea counts that trip in the 10:07 minute. Now
        10:00 is one too low and 10:07 is one too high.

        One rider is a rounding error. But a whole city loses signal in the rain, or your consumer
        restarts after a deploy and reads a 20-minute backlog in 30 seconds. Then the chart shows a
        huge fake spike that never happened.

        The cause is that there are **two clocks**:

        - **Processing time:** the server clock when the event arrives.
        - **Event time:** the time written inside the event, when it really happened.

        Counting by processing time measures your network and your deploys, not your business. So
        count by event time.

        But event time brings a new and harder question. It is 10:01 now. Can you announce "10:00
        had 412 trips"? Maybe the tunnel rider is still out there. **When is a minute finished?**
        Everything else in this lesson answers that one question.

        ## Windows: the buckets

        A **window** is a bucket of event time. You put each event in its bucket and aggregate the
        bucket. There are three common shapes.

        - **Tumbling window:** fixed size, no overlap, like the pages of a day calendar. Example:
          trips per minute.
        - **Sliding (hopping) window:** fixed size, but the windows overlap, like "the last 5
          minutes, updated every minute". Example: trips in the last 5 minutes.
        - **Session window:** one per key, and it closes after a quiet gap, like a chat that ends
          after 30 minutes of silence. Example: a rider's app session.

        With a 5-minute sliding window that moves every minute, one event belongs to 5 windows. That
        is why sliding windows cost more state than tumbling ones.

        ## Watermarks: deciding that a window is done

        Think of a teacher collecting exam papers. The exam ended at 11:00, but students drift in
        late to hand in their papers. The teacher cannot wait forever, so they say: "I wait until
        11:05. Then I grade." That deadline is a watermark.

        A **watermark** is a marker that flows through the stream. It says: "I believe no more
        events with an event time earlier than T will arrive." When the watermark passes the end of
        a window, the window **fires**: it emits its result.

        The system cannot see the future, so it guesses T from what it has already seen. The common
        rule is: **watermark = the largest event time seen so far, minus an allowed delay.**

        ## Worked example, one event at a time

        We count the window from 10:00 up to 10:01. The allowed delay is 60 seconds. Five events
        arrive, one after another. The time shown is each event's event time.

        1. **10:00:10** arrives. Largest seen: 10:00:10. Watermark: 09:59:10. Count: 1.
        2. **10:00:50** arrives. Largest seen: 10:00:50. Watermark: 09:59:50. Count: 2.
        3. **10:01:20** arrives. It belongs to the next window, so the count stays 2. But the
           largest seen moves to 10:01:20, so the watermark moves to 10:00:20.
        4. **10:00:40** arrives, out of order. It is ahead of the watermark (10:00:20), so it is
           accepted. Count: 3.
        5. **10:02:30** arrives. Watermark: 10:01:30. That is past the end of our window, so the
           window **fires with 3**.

        ~~~text
        watermark = largest - 60s
        10:02:30 - 60s = 10:01:30
        10:01:30 is past 10:01
        → window fires, count 3
        ~~~

        Now an event with event time 10:00:55 arrives. The watermark is already 10:01:30, so it is
        behind the watermark. That event is **late**.

        Look at step 4. The 60-second delay rescued the out-of-order event. With no delay, the
        watermark after step 3 would be 10:01:20. The window would fire with 2, and the 10:00:40 event
        would be late. **The delay is how much disorder you are willing to wait for.**

        ## Late data: what to do with stragglers

        Back to the teacher. A paper arrives after grading. The teacher can refuse it, regrade and
        publish a corrected list, or send it to the office to deal with later. Streams have the same
        three choices.

        - **Drop it**, and count drops in a metric so you know how often it happens.
        - **Allowed lateness:** keep the window's state a while longer. A late event updates the
          window, and the window emits a **correction**.
        - **Side output:** send late events to a separate stream, and fix the numbers in a batch job.

        ## The big picture: the Dataflow model

        Google's **Dataflow model** names four questions. Every streaming design answers all four,
        and you have now seen each one.

        1. **What** do you compute? Trips counted per minute.
        2. **Where** in event time? The windows.
        3. **When** in processing time do you emit? Watermarks and triggers.
        4. **How** do later results relate to earlier ones? A correction replaces the old number
           (accumulating) or adds a delta (discarding).

        > [!senior] The trade-off is latency versus completeness
        > A longer watermark delay gives more complete windows but later results. Say what the
        > consumer needs. A surge pricing signal wants seconds and tolerates small errors. A billing
        > report wants completeness, and can wait for a batch correction.

        > [!trap] Idle partitions stall watermarks
        > A job reads many partitions and its watermark is the **minimum** across them, like a convoy
        > that moves at the speed of its slowest truck. If one partition gets no data, its watermark
        > never moves, so no window fires anywhere. Flink's «withIdleness» marks such a source idle so
        > it stops holding back progress.

        ## In one breath

        Count by when things happened, not when they arrived. A watermark is the deadline that says
        "this bucket is done", set as the newest time seen minus the disorder you will wait for.
        Anything after the deadline is late, and you choose to drop it, correct it or fix it in batch.
      `,
      checks: [
        {
          question: 'Why compute per-minute trip counts on event time rather than processing time?',
          options: [
            'Event time is faster',
            'Processing time results depend on network delays and replays',
            'Kafka only stores event time',
            'Watermarks require processing time',
          ],
          answer: 1,
          why: 'Processing time shifts with delays, backlogs and replays. Event time reflects when trips actually happened.',
        },
        {
          question:
            'The watermark is "largest event time seen minus 60 seconds". The largest event time seen is 10:02:30. An event with event time 10:01:45 arrives. What happens?',
          options: [
            'It is late, because it is older than 10:02:30',
            'It is accepted, because it is ahead of the watermark at 10:01:30',
            'It is dropped, because events must arrive in order',
            'The watermark moves back to 10:01:45',
          ],
          answer: 1,
          why: 'The watermark is 10:02:30 minus 60 seconds, which is 10:01:30. The event at 10:01:45 is after that, so it still counts in its window. Watermarks never move back.',
        },
      ],
    },
    {
      slug: 'stateful-processing',
      title: 'State, checkpoints and backpressure',
      summary: 'How Flink keeps state correct across failures, and what to watch in production.',
      minutes: 14,
      body: `
        Most useful streaming jobs keep **state**: counts per key, open sessions, the last known
        driver location, a join buffer. Flink stores keyed state locally (on heap or in RocksDB) and
        makes it fault tolerant with **checkpoints**.

        ## Checkpoints and savepoints

        - A **checkpoint** is a periodic, consistent snapshot of all operator state plus the source
          offsets, taken with barriers that flow through the job. After a failure, Flink restores
          the last checkpoint and replays sources from the stored offsets.
        - A **savepoint** is a checkpoint you trigger yourself, used to upgrade code, change
          parallelism or migrate clusters without losing state.

        ## State growth

        State that never expires grows forever: a dedup set of every event id ever seen, or
        sessions for users who never come back. Use **state TTL** or timers to evict, and bound
        dedup to a time window ("ignore duplicates within 24 hours").

        ## Backpressure

        When a sink or operator is slower than the input, buffers fill and upstream operators slow
        down. Kafka consumer lag grows. Find the bottleneck operator in the UI (busy or
        backpressured percentages), then scale it, fix skew, or batch the sink writes.

        ## Stream joins

        | Join | Needs | Example |
        |---|---|---|
        | Window join | Both streams buffered for a window | Requests and acceptances within 2 minutes |
        | Interval join | Buffer within a time bound per key | Click within 30 minutes of impression |
        | Lookup (temporal) join | Versioned table or external lookup | Enrich trips with the city table as of event time |

        > [!senior] Size the state
        > "200 million active keys at 100 bytes is 20 GB of state, so RocksDB with incremental
        > checkpoints, and TTL of 24 hours" is the kind of sentence that shows you have run this.
      `,
      checks: [
        {
          question:
            'A Flink dedup job keeps every event_id it has seen. Six months later checkpoints take hours. Best fix?',
          options: [
            'Turn off checkpoints',
            'Bound dedup to a time window with state TTL',
            'Increase Kafka retention',
            'Use processing time',
          ],
          answer: 1,
          why: 'Unbounded state grows forever. A TTL-bounded dedup window keeps state proportional to recent traffic.',
        },
      ],
    },
    {
      slug: 'architectures-and-serving',
      title: 'Lambda, kappa and real-time serving',
      summary: 'Choose a batch, streaming or hybrid architecture and serve fresh results to users.',
      minutes: 12,
      body: `
        ## Lambda versus kappa

        | | Lambda | Kappa |
        |---|---|---|
        | Paths | Batch for correctness plus streaming for speed | One streaming path; replay the log to recompute |
        | Code | Logic often written twice | Logic written once |
        | Recompute | Batch rerun | Replay from Kafka (or tiered storage) into a new job version |
        | Risk | Two answers that disagree | Needs long retention and fast replay |

        Modern practice often blends them: one streaming pipeline writes to a lakehouse table
        (Hudi, Iceberg, Delta), and batch jobs read the same table for heavy analytics and
        corrections. Apache Beam lets one pipeline definition run in batch or streaming mode.

        ## Serving fresh analytics

        Dashboards that need second-level freshness at high query rates use real-time OLAP stores
        such as **Apache Pinot** (used heavily at Uber) or Druid. They ingest directly from Kafka,
        index columns, and pre-aggregate with star-tree indexes. A warehouse such as BigQuery serves
        the deep, ad-hoc analysis.

        ## Change data capture

        CDC tools (Debezium, Datastream) read a database's transaction log and publish row changes
        to Kafka. That turns an operational database into a stream without polling queries, and
        feeds upserts into a lakehouse table.

        > [!senior] Do not stream by default
        > Streaming costs more to build and operate. Ask what decision the freshness enables. A
        > dashboard looked at once a morning does not need a Flink job.
      `,
      checks: [
        {
          question: 'Main drawback of a lambda architecture?',
          options: [
            'It cannot handle late data',
            'Logic is often implemented twice and the two paths can disagree',
            'It requires Pinot',
            'It has no batch path',
          ],
          answer: 1,
          why: 'Maintaining the same logic in batch and streaming code doubles work and creates mismatches.',
        },
      ],
    },
    {
      slug: 'kafka-connect-cdc',
      title: 'Kafka Connect and change data capture',
      summary:
        'Run source and sink connectors, capture database changes with Debezium, and handle bad records without stopping.',
      minutes: 15,
      body: `
        Most data does not enter Kafka from code a team wrote. It enters through **Kafka Connect**,
        a framework that runs reusable connectors: a source connector reads a system and writes
        to topics, a sink connector reads topics and writes to a system.

        ## How Connect runs

        - A **worker** is a JVM process. In distributed mode, workers with the same group id form
          a cluster and share the work.
        - A **connector** is a configuration (JSON over a REST API). It splits itself into
          **tasks**, the units of parallelism. A JDBC source might run one task per table; a sink
          runs up to one task per partition.
        - The cluster stores connector configs, source offsets and status in three internal
          topics. Kill a worker and its tasks restart on the others from the stored offsets.
        - **Converters** turn records into bytes: Avro, Protobuf or JSON Schema with a schema
          registry, or plain JSON. **Single message transforms (SMTs)** make small per-record
          changes: rename a field, mask a column, route by a value.

        ## CDC with Debezium

        Debezium source connectors read the database’s own change log: the MySQL binlog, the
        Postgres write-ahead log through a replication slot, the SQL Server change tables. A new
        connector first takes a **snapshot** of the existing rows, then streams changes. Each
        event carries the row «before» and «after», the operation (create, update, delete), and
        the log position. A delete is followed by a **tombstone** (a record with the key and a
        null value), so a compacted topic drops the key.

        > [!trap] A stopped Postgres connector can fill the database disk
        > A replication slot keeps WAL until its consumer confirms it. If the connector is down
        > for a day, the primary keeps a day of WAL. Alert on slot lag, and set
        > «max_slot_wal_keep_size» so the database protects itself.

        ## The outbox pattern

        Capturing raw tables couples consumers to a service’s private schema. With the
        **outbox pattern**, the service writes its business event to an «outbox» table in the
        same transaction as the state change, and Debezium publishes only that table. The event
        is a public contract, and it cannot be lost or sent for a rolled-back transaction.

        ## Errors without stopping the pipeline

        | Setting | Effect |
        |---|---|
        | «errors.tolerance=none» | Default. The first bad record fails the task. |
        | «errors.tolerance=all» | Skip records that fail conversion or transforms |
        | «errors.deadletterqueue.topic.name» | Sink only: send failed records to a DLQ topic with headers that say why |

        > [!senior] What a senior answer adds
        > Say how the pipeline restarts (offsets in Kafka, so a worker loss is a rebalance), how
        > schema changes are governed (registry compatibility mode, usually backward), how deletes
        > flow (tombstones), and that someone owns the dead letter queue. A DLQ nobody reads is
        > silent data loss.
      `,
      checks: [
        {
          question:
            'Debezium on Postgres has been stopped for 20 hours. What is the main operational risk?',
          options: [
            'Kafka deletes the topic',
            'The replication slot retains WAL on the primary, which can fill its disk',
            'The connector loses its snapshot',
            'Consumers see duplicate tombstones',
          ],
          answer: 1,
          why: 'Postgres keeps WAL until the slot’s consumer confirms it, so a stopped connector grows WAL on the primary.',
        },
        {
          question: 'Why publish an outbox table instead of capturing the orders table directly?',
          options: [
            'It is faster to snapshot',
            'The event becomes a stable contract written in the same transaction as the change',
            'Debezium cannot read normal tables',
            'It removes the need for a schema registry',
          ],
          answer: 1,
          why: 'The outbox decouples consumers from internal tables, and the same transaction guarantees the event matches committed state.',
        },
      ],
    },
    {
      slug: 'kafka-streams-ksqldb',
      title: 'Kafka Streams and ksqlDB',
      summary:
        'Explain streams and tables, state stores, co-partitioning and when a library beats a cluster like Flink.',
      minutes: 15,
      body: `
        **Kafka Streams** is a Java library, not a cluster. You embed it in an ordinary service,
        run several copies, and Kafka’s consumer group protocol shares the input partitions
        between them. There is no job manager to operate, which is its main appeal.

        ## Streams and tables

        | Abstraction | Meaning | Example |
        |---|---|---|
        | «KStream» | Every record is an event | Each trip request |
        | «KTable» | The latest value per key; a record is an update | Each driver’s current status |
        | «GlobalKTable» | A KTable copied in full to every instance | A small list of cities |

        A stream aggregated by key becomes a table. A table’s change log is a stream. This
        **stream-table duality** is the core idea, and it is also how state survives a crash.

        ## State stores and changelogs

        Aggregations and joins keep state in a local store (RocksDB by default). Every write to
        the store is also written to a compacted **changelog topic**. When an instance dies, the
        partition moves and the new owner rebuilds the store from the changelog. Restoring a
        large store can take minutes, so production apps set **standby replicas**, which keep a
        warm copy on another instance.

        ## Co-partitioning

        A stream-table join is local: each instance joins the partitions it owns. That works only
        if both topics have the **same number of partitions and the same key**. If not, Kafka
        Streams writes a **repartition topic** first, which doubles the traffic for that step. A
        GlobalKTable avoids the requirement because every instance has all of it.

        ## Exactly once

        «processing.guarantee=exactly_once_v2» wraps the input offsets, state store changelog
        writes and output records in one Kafka transaction. It holds inside Kafka. A call to an
        external API is still at least once.

        ## ksqlDB

        ksqlDB puts SQL on top of Kafka Streams: «CREATE STREAM», «CREATE TABLE AS SELECT» and
        windowed aggregations run as persistent queries on a ksqlDB cluster. It is quick for
        simple transformations and filters. For new work, many teams now pick Flink SQL, which
        Confluent Cloud also leads with; know both names and the trade-off.

        | Choose | When |
        |---|---|
        | Kafka Streams | Input and output are Kafka, logic lives in a service your team runs, state fits per instance |
        | Flink | Many sources and sinks, very large state, event-time windows over long periods, SQL for analysts |
        | ksqlDB or Flink SQL | Simple filters, projections and aggregations owned by people who prefer SQL |

        > [!senior] Say what the library costs
        > No cluster to run, but scaling is capped by the input partition count, a rebalance
        > pauses processing while stores restore, and large state means long restores. Standby
        > replicas and static membership are the usual fixes.
      `,
      checks: [
        {
          question:
            'A Kafka Streams app joins a trips topic (64 partitions, key trip_id) with a drivers table (32 partitions, key driver_id). What happens?',
          options: [
            'The join fails at startup forever',
            'Kafka Streams repartitions the trips stream by driver_id through an internal topic before joining',
            'It joins only the first 32 partitions',
            'It uses a GlobalKTable automatically',
          ],
          answer: 1,
          why: 'Joins need co-partitioned inputs. The library re-keys and writes a repartition topic, which costs extra traffic.',
        },
      ],
    },
    {
      slug: 'kraft-and-rebalancing',
      title: 'KRaft, rebalancing and running Kafka',
      summary:
        'Know how Kafka manages metadata without ZooKeeper and how consumer groups rebalance without stalling.',
      minutes: 13,
      body: `
        ## KRaft replaced ZooKeeper

        Kafka used to keep cluster metadata (topics, partitions, leaders, configs) in ZooKeeper.
        In **KRaft** mode, a small quorum of **controllers** stores metadata in an internal Raft
        log, and brokers follow that log. Kafka 4.0 (2025) removed ZooKeeper entirely. A
        ZooKeeper cluster must migrate on a 3.x bridge release before it can move to 4.x.

        | | ZooKeeper era | KRaft |
        |---|---|---|
        | Systems to run | Kafka plus ZooKeeper | Kafka only |
        | Controller failover | Reloads all metadata, slow on big clusters | A standby controller already has the log |
        | Partitions per cluster | Limited by metadata load | Far higher |

        Run three or five controllers, on separate machines or zones, for the same reason you
        ran an odd ZooKeeper ensemble: a majority must survive.

        ## Consumer group rebalancing

        A rebalance reassigns partitions when a consumer joins, leaves or misses heartbeats.

        | Protocol | Behaviour |
        |---|---|
        | Eager (old default) | Every member gives up every partition, then gets a new set. Everyone stops. |
        | Cooperative sticky | Members keep what they can and give up only partitions that move |
        | **Static membership** («group.instance.id») | A restarted pod with the same id gets its partitions back without a rebalance, within the session timeout |
        | **Next-gen protocol (KIP-848)** | Generally available in Kafka 4.0 with «group.protocol=consumer». The broker computes assignments and changes them incrementally, with no group-wide barrier. |

        > [!trap] Rolling deploys cause rebalance storms
        > Restart 50 consumers one by one with the eager protocol and the group rebalances about
        > 50 times, each time stopping everyone. Use cooperative or the new protocol, add static
        > membership, and keep processing per poll well below «max.poll.interval.ms».

        ## Running Kafka well

        - **Replication:** factor 3, «min.insync.replicas=2», racks set so replicas spread across
          zones («broker.rack»).
        - **Retention:** by time and size per topic; compaction for changelog and «latest value»
          topics; tiered storage for long replay windows.
        - **Watch:** consumer lag per group, under-replicated partitions, offline partitions,
          request latency, disk usage per broker.
        - **Managed options:** Amazon MSK, Confluent Cloud, Google Cloud Managed Service for
          Apache Kafka, Aiven. They remove broker operations, not partition design.

        > [!senior] Mention the new primitives
        > Kafka 4.0 also brought **share groups** (KIP-932, early access), which let several
        > consumers read one partition like a queue, with per-record acknowledgement. Knowing
        > where the project is going is a cheap senior signal.
      `,
      checks: [
        {
          question:
            'Pods in a consumer group restart during every deploy and each restart stalls the whole group. What helps most?',
          options: [
            'More partitions',
            'Static membership plus the cooperative or KIP-848 protocol',
            'acks=all on the producers',
            'A larger retention period',
          ],
          answer: 1,
          why: 'Static membership lets a returning member keep its partitions, and incremental protocols avoid stopping everyone.',
        },
        {
          question: 'What does a KRaft controller quorum replace?',
          options: [
            'The schema registry',
            'ZooKeeper, for storing and serving cluster metadata',
            'The consumer group coordinator',
            'Tiered storage',
          ],
          answer: 1,
          why: 'In KRaft mode, controllers keep metadata in a Raft log inside Kafka; Kafka 4.0 removed ZooKeeper.',
        },
      ],
    },
    {
      slug: 'flink-vs-spark-streaming',
      title: 'Flink versus Spark Structured Streaming',
      summary:
        'Compare the two main stream processors on execution model, latency, state, event time, delivery guarantees and operations, and choose one for a workload.',
      minutes: 15,
      body: `
        "Why Flink and not Spark?" follows almost every streaming design. Both are good. They come
        from different ideas, and that difference decides the fit.

        ## Execution model

        - **Flink** is a true stream processor. Operators run all the time and records flow through
          them one by one. Batch is a special case of a bounded stream.
        - **Spark Structured Streaming** treats a stream as a table that grows. By default it runs
          **micro-batches**: every trigger it plans and runs a small batch job over the new data.

        ## Side by side

        | | **Flink** | **Spark Structured Streaming** |
        |---|---|---|
        | Latency | Milliseconds | Usually seconds (micro-batch); depends on the trigger |
        | State | Keyed state in memory or RocksDB; very large state is normal; Flink 2.0 added disaggregated state storage | State store per micro-batch, RocksDB provider for large state |
        | Event time | Watermarks plus **timers**: code can fire at any event or processing time | Watermarks for windows, aggregations and joins; arbitrary state with timers through «transformWithState» in Spark 4 |
        | Exactly-once | Checkpoint barriers plus transactional or idempotent sinks | Checkpointed offsets plus idempotent or transactional sinks |
        | Upgrades | **Savepoints**: stop, change the job, restore state | Restart from the checkpoint; some query changes are not allowed with existing state |
        | APIs | Java, SQL, Python (PyFlink) | Python, SQL, Scala, Java with the same DataFrame API as batch |
        | Runs on | Kubernetes, YARN, managed services (Amazon Managed Service for Apache Flink, Confluent) | Any Spark cluster, Databricks, EMR, Dataproc |

        ## Choose Flink when

        - Latency must be under a second: fraud scoring, alerting, real-time pricing.
        - The logic is **event-driven and stateful**: per-key timers, complex event patterns,
          session logic with custom rules.
        - State is very large and long-lived, and you must upgrade jobs without losing it.

        ## Choose Spark Structured Streaming when

        - Seconds to minutes are fine, and the team already runs Spark and writes PySpark.
        - The same code should run as batch and as a stream (backfill with the same DataFrame logic).
        - The sink is a lakehouse table (Delta or Iceberg) and the platform is Databricks or similar.

        ## Same concepts, different words

        Both need: a **watermark** to bound lateness, **checkpoints** for recovery, **keys** to
        partition state, and an **idempotent or transactional sink** for exactly-once results. Kafka
        Streams is a third option when the job is a Kafka-to-Kafka service inside an application,
        with no separate cluster.

        > [!trap] "Spark streaming is not real streaming"
        > This is an outdated jab. Micro-batch latency is fine for most analytics, and the shared
        > batch and stream API is a real advantage. Choose by latency need and team skill, not by
        > slogan.

        > [!senior] Decide with three numbers and a team
        > "We need p99 under 500 ms, 2 TB of keyed state and per-user timers: Flink. The hourly
        > aggregates into the lakehouse can be Spark, which the team already runs." Mixing engines by
        > need is a staff-level answer.
      `,
      checks: [
        {
          question:
            'A rule must fire 10 minutes after a rider requests a trip if no driver accepted. Which engine feature fits this best?',
          options: [
            'Micro-batch triggers',
            'Keyed state with event-time or processing-time timers, as in Flink',
            'A tumbling window count',
            'Broadcast joins',
          ],
          answer: 1,
          why: 'A per-key timer fires exactly when the condition is due. Flink offers this directly; in Spark it needs transformWithState.',
        },
        {
          question: 'What do Flink savepoints make easy?',
          options: [
            'Writing SQL',
            'Stopping a job, changing its code and restoring its state',
            'Reading from S3',
            'Avoiding watermarks',
          ],
          answer: 1,
          why: 'A savepoint is a consistent, portable snapshot of job state that a new job version can resume from.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'kafka-key-choice',
    title: 'Choose the Kafka key for trip events',
    track: 'streaming',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      Trip events (requested, accepted, location updates, completed) go to one topic. Consumers
      compute per-trip state and per-city metrics. Which key do you use, and what goes wrong with
      the alternatives?
    `,
    hints: ['Which consumer needs ordering?', 'Think about hot partitions.'],
    answer: `
      Key by «trip_id». The per-trip consumer needs a trip's events in order, and trip ids spread
      load evenly across partitions.

      - Keying by «city_id» keeps a city together but makes big cities hot partitions and caps
        parallelism at the number of cities.
      - No key (round robin) balances load but loses per-trip order.

      Per-city metrics do not need ordering by city: they aggregate with a keyed window in the
      stream processor, which repartitions by city internally.
    `,
    signals: [
      'Ties the key to the ordering requirement',
      'Explains hot partitions from skewed keys',
      'Notes the processor can re-key for aggregations',
    ],
    followUps: ['You need to grow from 64 to 256 partitions. What breaks, and how do you migrate?'],
  },
  {
    slug: 'exactly-once-payments-stream',
    title: 'Exactly-once for payment events',
    track: 'streaming',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A streaming job reads payment events from Kafka, aggregates driver balances, and writes them
      to a database that the driver app reads. Finance says a balance must never double count a
      payment. Explain what guarantee you can give and how.
    `,
    hints: [
      'Where can duplicates come from?',
      'At-least-once plus an idempotent sink.',
      'Or a transactional sink with Flink checkpoints.',
    ],
    answer: `
      **Sources of duplicates:** producer retries, consumer replays after a crash, and upstream
      services publishing the same payment twice.

      1. **Producer:** idempotent producer on, and every payment carries a unique «payment_id».
      2. **Processing:** Flink with checkpoints, so state and offsets are restored together.
      3. **Sink, option A:** store applied payments, not just balances: a ledger table with primary
         key «payment_id». Upsert each payment; the balance is a sum over the ledger, or is updated
         in the same database transaction as the ledger insert. A replay hits the key and does
         nothing.
      4. **Sink, option B:** a two-phase-commit sink tied to Flink checkpoints, so output becomes
         visible only when the checkpoint completes.

      Option A also handles duplicates created upstream, which no stream framework can detect for
      you. Finally, reconcile daily against the payments system of record and alert on any
      difference.
    `,
    signals: [
      'Lists every place duplicates can enter',
      'Uses a unique payment id and an idempotent ledger sink',
      'Explains checkpoint-aligned transactional sinks',
      'Adds reconciliation against the source of truth',
    ],
    followUps: ['A payment is refunded later. How does the ledger represent it?'],
  },
  {
    slug: 'late-events-surge-windows',
    title: 'Late events in surge windows',
    track: 'streaming',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A job counts ride requests per hexagon per minute to feed surge pricing. 3 percent of events
      arrive more than 30 seconds late, a few up to 10 minutes. How do you set windows, watermarks
      and late handling?
    `,
    hints: [
      'Surge needs low latency.',
      'Analytics needs completeness.',
      'You can serve both from one stream.',
    ],
    answer: `
      - **Event-time tumbling windows** of one minute, keyed by hexagon.
      - **Watermark** of max event time minus about 20 to 30 seconds, so the surge signal is fresh.
        Mark idle partitions so quiet regions do not stall progress.
      - **Late events:** for surge, a small undercount is acceptable; route late events to a side
        output and count them as a metric. Allow a short lateness (for example 2 minutes) to emit
        corrected counts if the consumer can handle updates.
      - **Analytics:** write all events, including late ones, to the lake, and compute exact
        per-minute counts in batch for reporting.

      Monitor the late-event rate: a jump usually means a client release or a regional network
      problem, not real demand.
    `,
    signals: [
      'Chooses event time and a short watermark for a latency-sensitive consumer',
      'Separates real-time signal from exact analytics',
      'Handles idle partitions',
      'Treats late-event rate as a monitored metric',
    ],
    followUps: ['How would you test watermark behaviour before production?'],
  },
  {
    slug: 'consumer-lag-growing',
    title: 'Consumer lag keeps growing',
    track: 'streaming',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A consumer group's lag has grown from seconds to 40 minutes since this morning. Input rate is
      normal. What do you check and how do you recover?
    `,
    hints: [
      'Slow processing, rebalancing loops, or one stuck partition.',
      'Lag per partition tells you which.',
    ],
    answer: `
      1. **Lag per partition.** If one partition lags, it is a hot key or a poison message. If all
         lag, processing is slow overall.
      2. **Rebalance loop.** Logs showing repeated rebalances mean consumers exceed
         «max.poll.interval.ms» or crash. Reduce batch size or fix the crash.
      3. **Downstream slowness.** A slow database sink or external API makes every batch slower.
         Check sink latency and errors.
      4. **Poison message.** A record that throws on every attempt blocks its partition. Send it to
         a dead-letter topic and move on.

      Recovery: fix the cause, then add consumers up to the partition count if throughput is the
      limit. Alert on lag in time (seconds behind), not only in message count.
    `,
    signals: [
      'Looks at lag per partition first',
      'Knows rebalance loops and max.poll.interval.ms',
      'Uses a dead-letter topic for poison messages',
      'Alerts on time lag',
    ],
    followUps: [
      'After recovery the consumer must catch up 40 minutes without overloading the database. How?',
    ],
  },
  {
    slug: 'impression-click-stream-join',
    title: 'Join clicks to impressions in a stream',
    track: 'streaming',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      Impressions and clicks arrive on two streams. A click is valid if it happens within 30
      minutes after its impression. Produce a real-time stream of attributed clicks for billing.
      Billions of impressions a day.
    `,
    hints: [
      'Interval join keyed by impression id.',
      'State must be bounded.',
      'What if the click arrives before the impression?',
    ],
    answer: `
      Key both streams by «impression_id» and use an **interval join**: click time between
      impression time and impression time plus 30 minutes. Flink keeps impressions in state for
      30 minutes plus allowed lateness, then drops them, so state is bounded:

      ~~~text
      state ≈ impressions per second × (30 min + lateness) × bytes per impression
            ≈ 50,000/s × 2,100 s × 100 B ≈ 10 GB, spread across the cluster
      ~~~

      Clicks can arrive before their impression (different pipelines, different delays), so the
      join must buffer clicks for a short time too; an interval join on event time handles both
      sides. Deduplicate clicks per impression (first valid click wins) for billing. Emit to an
      idempotent sink keyed by «impression_id», and run a daily batch reconciliation in BigQuery
      over the complete data.
    `,
    signals: [
      'Chooses an interval join on event time',
      'Estimates and bounds state',
      'Handles clicks that arrive before impressions',
      'Deduplicates per impression for billing',
      'Adds batch reconciliation',
    ],
    followUps: [
      'How does this design change if impressions are 10 times larger than clicks in bytes?',
    ],
  },
  {
    slug: 'cdc-orders-into-lake',
    title: 'Stream a Postgres orders table into the lake',
    track: 'streaming',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      The orders service runs on Postgres (2 TB, about 3,000 writes per second at peak). Analysts
      want an orders table in the lakehouse that is at most five minutes behind, includes
      deletes, and survives schema changes. Design the pipeline from the database to the table.
    `,
    hints: [
      'Do not query the primary on a schedule.',
      'How does the first load happen, and how do you switch to changes?',
      'What key do the Kafka records use, and why?',
      'What happens to a delete, and to a new column?',
    ],
    answer: `
      **Capture:** Debezium Postgres connector on Kafka Connect, reading a logical replication
      slot. It snapshots the table first, then streams changes from the WAL with no query load
      on the primary. For 2 TB, use an incremental snapshot (chunked, resumable, runs alongside
      streaming) instead of one long blocking snapshot.

      **Topic:** key = the order’s primary key, so every change of one order lands in one
      partition in order. Avro or Protobuf with a schema registry in backward-compatible mode.
      Size partitions for peak plus replay: 3,000 changes per second is small; 12 to 24
      partitions leave room for parallel sinks.

      **Apply:** a streaming job (Flink or Spark Structured Streaming) runs a MERGE into an
      Iceberg or Delta table every one to two minutes: per key, keep the change with the highest
      log position (LSN) in the batch, then insert, update or delete. Ordering by LSN, not by
      arrival, makes replays and duplicates harmless.

      **Deletes:** Debezium emits a delete event and a tombstone. The MERGE deletes the row, or
      sets «is_deleted» if analysts need history; keep an append-only change table too, for
      audit and rebuilds.

      **Schema changes:** an added nullable column flows through the registry and is added to
      the table by the job. A dropped or retyped column breaks compatibility and is stopped at
      the registry: that is a deliberate migration with the owning team.

      **Operations:** alert on replication slot lag on the primary and set
      «max_slot_wal_keep_size»; alert on end-to-end freshness, not just consumer lag; compact
      the table’s small files on a schedule. Reconcile row counts and a checksum against a
      replica daily.
    `,
    signals: [
      'Uses log-based CDC instead of polling queries',
      'Handles the initial load with an incremental snapshot',
      'Keys by primary key and orders applies by log position',
      'Explains delete handling with tombstones and MERGE',
      'Governs schema changes with a registry compatibility mode',
      'Monitors replication slot lag on the source',
    ],
    followUps: [
      'The orders table gets a new partitioned child table. What changes in the pipeline?',
      'Analysts need the order’s status as of any past minute. What do you add?',
    ],
  },
  {
    slug: 'streams-enrich-trips',
    title: 'Enrich trip events with driver status',
    track: 'streaming',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A team wants to add each driver’s current vehicle type to every trip event in real time.
      Trips arrive on «trip-events» (96 partitions, key «trip_id»). Driver profiles are on a
      compacted topic «drivers» (24 partitions, key «driver_id»), about 5 million drivers.
      They plan a Kafka Streams app. What does the topology look like, and what goes wrong?
    `,
    hints: [
      'Is the drivers topic a stream or a table?',
      'Which key does the join need on both sides?',
      'What happens when an instance dies and its state moves?',
    ],
    answer: `
      Read «drivers» as a **KTable** (latest profile per driver) and trips as a **KStream**.

      The join key is «driver_id», but trips are keyed by «trip_id» and the partition counts
      differ. Kafka Streams will re-key trips by «driver_id» and write a repartition topic with
      the drivers topic’s 24 partitions, then join locally. That adds a full copy of the trip
      traffic and caps parallelism at 24.

      Alternatives:
      - **GlobalKTable** for drivers: every instance holds all 5 million profiles (a few GB at
        most if the value is small), so no repartition is needed and trips keep 96-way
        parallelism. The cost is memory and startup time on every instance.
      - Increase «drivers» to 96 partitions and key the trip stream by driver upstream, only if
        other consumers do not need per-trip order.

      **Failure:** state lives in RocksDB with a changelog topic. When an instance dies, its
      partitions move and the new owner restores the store from the changelog, which can take
      minutes for large state. Configure standby replicas and static membership so a restart
      does not trigger a full restore.

      **Semantics:** a stream-table join uses the table value at the time the trip is
      processed. If a profile update arrives late, early trips get the old vehicle type. That is
      usually acceptable for enrichment, and it should be stated.
    `,
    signals: [
      'Identifies drivers as a table and trips as a stream',
      'Spots the co-partitioning problem and the hidden repartition topic',
      'Weighs GlobalKTable memory against repartition traffic',
      'Explains state restore and standby replicas',
      'States the timing semantics of a stream-table join',
    ],
    followUps: [
      'Finance needs the vehicle type exactly as of the trip time, even for late data. What changes?',
    ],
  },
  {
    slug: 'rebalance-storm-on-deploy',
    title: 'Lag spikes on every deploy',
    track: 'streaming',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A consumer group of 40 pods reads a 240-partition topic. During every rolling deploy,
      lag jumps from seconds to 15 minutes, and some records are processed twice. Logs show many
      "rebalance in progress" messages. Explain the cause and the fixes, in order of impact.
    `,
    hints: [
      'How many rebalances does a rolling restart of 40 pods cause?',
      'What does each rebalance do to every member under the eager protocol?',
      'Why the duplicates?',
    ],
    answer: `
      **Cause:** each pod leaving and returning triggers a rebalance; a rolling deploy of 40
      pods causes about 80. With the eager protocol, every rebalance revokes every partition
      from every member, so the whole group stops each time. Records processed but not yet
      committed when partitions are revoked are processed again by the new owner, which explains
      the duplicates.

      **Fixes, by impact:**
      1. **Static membership:** set «group.instance.id» to the pod’s stable name (a StatefulSet
         ordinal) and a session timeout longer than a restart. A pod that returns in time keeps
         its partitions and causes no rebalance.
      2. **Incremental protocol:** the KIP-848 consumer protocol on Kafka 4.x, or the
         cooperative sticky assignor on older clients, so the rebalances that remain move only
         a few partitions and nobody else stops.
      3. **Commit on revoke:** commit processed offsets in the rebalance listener’s revoke
         callback, and make the sink idempotent for the duplicates that still happen.
      4. **Short polls:** keep work per poll well under «max.poll.interval.ms» so slow batches
         do not get members kicked out mid-deploy.
      5. **Deploy pacing:** surge one pod at a time and wait for it to be ready and assigned.
    `,
    signals: [
      'Counts rebalances caused by a rolling restart',
      'Explains stop-the-world eager rebalancing',
      'Uses static membership with a stable instance id',
      'Moves to cooperative or KIP-848 incremental assignment',
      'Links duplicates to uncommitted offsets on revoke and fixes both sides',
    ],
    followUps: ['The group must scale from 40 to 120 pods for a peak. What limits you?'],
  },
  {
    slug: 'streaming-flink-or-spark',
    title: 'Flink or Spark for two streaming jobs',
    track: 'streaming',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google', 'flipkart', 'walmart', 'phonepe', 'swiggy'],
    prompt: `
      A payments team needs two jobs on the same Kafka topic of card transactions (40,000 events a
      second):

      1. Per-card features (count and amount in the last 1, 10 and 60 minutes) served to a fraud
         model with p99 under 300 ms.
      2. Per-merchant hourly totals written to an Iceberg table for finance dashboards.

      The data team knows PySpark well and has never run Flink. Which engine for each job, and how
      do you handle the skill gap?
    `,
    hints: [
      'Which job has a sub-second requirement?',
      'Which job is really an incremental batch?',
      'What can reduce the operations burden of a new engine?',
    ],
    answer: `
      **Job 1: Flink.** Sub-second p99 with per-card sliding state is Flink's home ground: keyed
      state in RocksDB, event-time windows (or incremental counters with timers that expire old
      buckets), and low per-record latency. Micro-batches would add seconds.

      **Job 2: Spark Structured Streaming** with a trigger every few minutes (or a scheduled
      «availableNow» run) writing Iceberg. Finance needs minutes or hours, the team knows PySpark,
      and the same code can backfill history.

      Closing the skill gap:

      - Use a **managed Flink** service, so the team does not run the cluster.
      - Start with **Flink SQL** for the windowed features; move to the DataStream API only where
        SQL cannot express the logic.
      - Shared rules for both jobs: keys by card or merchant, watermarks of a few seconds,
        checkpoints, idempotent sinks, and the same schema registry subject.
      - Pair one engineer with Flink experience (hire or borrow) for the first on-call rotation.
    `,
    signals: [
      'Matches Flink to the sub-second, stateful job',
      'Keeps the lakehouse aggregate on Spark',
      'Considers team skills and operations',
      'Suggests managed Flink or Flink SQL to reduce risk',
      'Keeps shared streaming rules across engines',
    ],
    followUps: ['How do you prove the features in the stream match the features used in training?'],
  },
];
