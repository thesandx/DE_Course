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
      minutes: 15,
      body: `
        ## Start with the problem

        A consumer reads a record from Kafka, does some work with it, and writes the result to a
        database. Then the machine crashes. When it comes back, one question decides everything:
        **which record does it read next?**

        If it reads the next one, maybe the crashed record was never saved: data lost. If it reads
        the same one again, maybe it was already saved: data written twice. There is no third choice
        for free. This lesson is about choosing, on purpose.

        ## Idea 1: the bookmark (committing the offset)

        From the Kafka lesson: a consumer remembers "I have read up to offset 1,204". Saving that
        number back to Kafka is called **committing the offset**. Think of it as moving a bookmark.

        After a crash, the consumer opens the book at the bookmark. So the only thing that matters is
        **when you move the bookmark**: before you do the work, or after.

        ## Idea 2: three choices, three guarantees

        Picture yourself paying a pile of bills, one at a time, with a bookmark in the pile.

        - **Move the bookmark first, then pay.** You crash after moving it but before paying. When
          you come back, you skip that bill. It is never paid. That is **at most once**: nothing
          twice, but you can lose some.
        - **Pay first, then move the bookmark.** You crash after paying but before moving it. When
          you come back, you pay that bill again. That is **at least once**: nothing lost, but some
          things twice.
        - **Pay and move the bookmark as one action**, so either both happen or neither does. That
          is **exactly once** (effectively).

        ## Idea 3: make "twice" harmless (idempotent writes)

        At least once is easy to build. The only problem is the duplicates. So remove the harm of a
        duplicate instead of the duplicate itself.

        An operation is **idempotent** if doing it twice gives the same result as doing it once.
        "Add 10 to the balance" is not idempotent. "Set the row for payment p-77 to 10" is.

        So the most common production design is **at least once plus idempotent writes**:

        1. Read the record.
        2. Write with an upsert keyed by the event id: "insert or replace the row for event e-91".
        3. Then commit the offset.

        A crash between 2 and 3 replays the record, and the upsert just writes the same row again.
        The effect is exactly once, with no special machinery.

        ## Idea 4: real exactly-once inside the system

        Sometimes the output is another Kafka topic, not a database. Then Kafka itself can do the
        "one action" from Idea 2. **Kafka transactions** let a consume, process, produce app write
        its output records and its consumed offsets in one atomic transaction. Readers set
        «isolation.level=read_committed» and never see output from an aborted transaction.

        Flink does the same end to end with **checkpoints** and **two-phase-commit sinks**: the sink
        writes, but only makes the writes visible when the checkpoint that covers them completes.

        Both give **exactly-once effects inside the system**. Neither can promise that an external
        API, such as an email sender, is called only once.

        ## Idea 5: who reads which partition (consumer groups and rebalancing)

        Consumers in the same **group** split the partitions; each partition is read by exactly one
        member. Add members, up to the partition count, and you add parallelism.

        When a member joins or dies, the group must re-deal the partitions. That is a
        **rebalance**. The old style stopped every consumer, took all partitions back and dealt them
        again. **Cooperative (incremental) rebalancing** only moves the partitions that need to move,
        so most consumers never stop.

        ## Now say it like a senior engineer

        | Commit the offset | Crash between work and commit | Guarantee |
        |---|---|---|
        | Before processing | Records skipped | At most once |
        | After processing | Records processed again | At least once |
        | Atomically with output | Neither | Exactly once |

        > [!senior] Say "effectively once"
        > "The pipeline is at-least-once; the sink is idempotent on «event_id», so the effect is
        > exactly once" is clearer and more honest than claiming magic. Then say where duplicates
        > could still leak, such as an email sender.

        > [!trap] Long processing triggers rebalances
        > If handling a batch takes longer than «max.poll.interval.ms», Kafka decides the consumer is
        > dead. Its partitions move, and the batch is processed twice. Keep batches small, or move
        > slow work off the poll loop.

        ## In one breath

        The guarantee is decided by when you move the bookmark. Commit after the work and make the
        write idempotent, and a replay becomes harmless: that is how most real systems get
        "exactly once".
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
      minutes: 15,
      body: `
        ## Start with the problem

        A useful streaming job must remember things. Count trips per city: it must remember the
        count so far. Spot a rider's session: it must remember when they last tapped. Drop duplicate
        events: it must remember which ids it has seen. That memory is called **state**.

        Now the machine running the job dies. If the state lived only in memory, every count starts
        from zero. Your dashboard says New York had 3 trips today. We need state that is fast to use
        **and** survives a crash.

        ## Idea 1: keep state next to the work

        Flink keeps **keyed state** on the same machine that processes those keys: the count for
        "city 5" lives where city 5's events go. Small state stays on the heap. Big state goes into
        **RocksDB**, a small database on the local disk. No network call per event, so it is fast.

        But local means it dies with the machine. So we need copies.

        ## Idea 2: a photo of everything, at the same moment (checkpoints)

        Think of a video game save. Every few minutes the game saves your position, your items and
        your score together. If the game crashes, you reload the last save and play from there.

        A **checkpoint** is that save. Every so often, Flink takes a consistent snapshot of all
        operator state **plus the Kafka offsets** it had reached, and writes it to durable storage.
        After a crash, Flink loads the last checkpoint and tells Kafka "replay from these offsets".
        State and input line up again, as if the crash never happened.

        How does it get "the same moment" across many machines without stopping the job? It puts
        markers, called **barriers**, into the stream. When an operator sees the barrier, it saves
        its state. Everything before the barrier is in the snapshot; everything after is not.

        A **savepoint** is a checkpoint you trigger by hand. You use it to upgrade code, change
        parallelism or move to another cluster without losing state.

        ## Idea 3: memory that only grows will hurt you (state TTL)

        Remember the dedup job: "remember every event id I have seen". After six months, that is
        billions of ids. Checkpoints take hours, and restore takes longer.

        The fix: decide how long memory needs to last. Duplicates usually arrive within minutes, so
        "ignore duplicates within 24 hours" is enough. **State TTL** (time to live) and timers evict
        old entries, so state stays the size of recent traffic, not all of history.

        ## Idea 4: when the output is slower than the input (backpressure)

        Picture a kitchen. The waiter brings orders faster than the cook can cook. Orders pile up on
        the counter, and the waiter must slow down. That is **backpressure**.

        In Flink, when a sink or an operator is slow, its input buffers fill, and the operators
        before it slow down too. From the outside you see **consumer lag** grow in Kafka.

        To fix it, find the slow operator. The Flink UI shows each operator as busy or
        backpressured. The busy one right after the backpressured ones is the bottleneck. Then scale
        it, fix skew (one hot key), or batch the sink writes.

        ## Idea 5: joining two streams needs state too

        To join two streams, you must hold one side in memory while you wait for the other.

        - **Window join:** buffer both streams for a window. Example: ride requests and acceptances
          in the same 2 minutes.
        - **Interval join:** buffer per key within a time bound. Example: a click within 30 minutes
          of its impression.
        - **Lookup (temporal) join:** look up a versioned table as of the event's time. Example:
          enrich each trip with the city table as it was when the trip happened.

        The longer the wait, the bigger the state. That is why every stream join needs a time bound.

        ## Now say it like a senior engineer

        - State is local (heap or RocksDB) and made durable by checkpoints of state plus offsets.
        - Savepoints are manual checkpoints for upgrades and rescaling.
        - Unbounded state is a bug: bound it with TTL or timers.
        - Backpressure shows up as lag; find the bottleneck operator, then scale, de-skew or batch.

        > [!senior] Size the state
        > "200 million active keys at 100 bytes is 20 GB of state, so RocksDB with incremental
        > checkpoints, and TTL of 24 hours" is the kind of sentence that shows you have run this.

        ## In one breath

        A streaming job's memory lives next to the work and is saved, with the input offsets, like
        a game save. Keep that memory bounded, and when it backs up, find the slowest step.
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
      minutes: 13,
      body: `
        ## Start with the problem

        The business wants two things from the same trip data. A dashboard that is fresh to the
        second. And numbers that are exactly right, for finance. Streaming is fast but late data
        makes it a little wrong. Batch is right but hours old. How do you get both?

        ## Idea 1: run both (lambda)

        The first answer was to build two pipelines side by side.

        - A **speed layer** (streaming) gives a fast, approximate answer.
        - A **batch layer** recomputes the exact answer every night and overwrites it.

        That is the **lambda architecture**. It works, but you write the same logic twice, in two
        different tools. One day someone changes the batch code and forgets the stream code. Now the
        dashboard and the finance report disagree, and nobody knows which one is right.

        ## Idea 2: run only the stream, and replay it (kappa)

        The second answer: keep one streaming pipeline, and keep the input log long. To recompute,
        start a new version of the job that reads the log from the beginning. When it catches up,
        switch traffic to it. That is the **kappa architecture**.

        Logic is written once. The price: you need long retention (tiered storage helps) and a job
        that can replay fast.

        | | Lambda | Kappa |
        |---|---|---|
        | Paths | Batch plus stream | Stream only |
        | Logic | Written twice | Written once |
        | Recompute | Batch rerun | Replay the log |
        | Risk | Two answers disagree | Needs long retention, fast replay |

        ## Idea 3: what teams actually do now

        Most modern platforms blend the two. One streaming pipeline writes to a **lakehouse table**
        (Hudi, Iceberg or Delta). Batch jobs read that same table for heavy analytics and for
        corrections. One copy of the data, two ways to use it. **Apache Beam** goes further: one
        pipeline definition can run in batch or streaming mode.

        ## Idea 4: serving fresh numbers to many people

        A dashboard used by thousands of city managers, refreshing every few seconds, sends a lot of
        queries. A normal warehouse is built for few, heavy queries, not many small ones.

        **Real-time OLAP stores**, such as **Apache Pinot** (used heavily at Uber) or Druid, fill
        that gap. They ingest straight from Kafka, index every column, and pre-aggregate with
        star-tree indexes, so each query takes milliseconds. A warehouse such as BigQuery still
        serves the deep, ad hoc analysis.

        ## Idea 5: turning a database into a stream (CDC)

        Much of the data starts in an app database. Polling it with "select rows changed since 10
        minutes ago" is slow and misses deletes. **Change data capture (CDC)** tools such as
        Debezium or Datastream read the database's own transaction log and publish each row change
        to Kafka. The database becomes a stream, and the changes feed upserts into a lakehouse table.

        ## Now say it like a senior engineer

        > [!senior] Do not stream by default
        > Streaming costs more to build and to run. Ask what decision the freshness enables. A
        > dashboard that someone opens once a morning does not need a Flink job.

        ## In one breath

        Lambda runs batch and stream side by side and pays by writing logic twice; kappa keeps one
        stream and replays the log. Today most teams stream into a lakehouse table and let batch read
        the same table.
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
      minutes: 16,
      body: `
        ## Start with the problem

        You want orders from the app's Postgres database in Kafka, and from Kafka into the lake.
        The first idea is to write a small program: every minute, run «select * from orders where
        updated_at > last_run», and send the rows to Kafka.

        It looks fine for a week. Then the problems show up.

        1. Deleted orders never appear, because a deleted row is not there to select.
        2. An order that changes twice inside one minute shows only its last state.
        3. Every team writes its own version of this program, with its own bugs, for every database.
        4. When the program crashes, nobody is sure where it stopped.

        We need two things: a standard way to move data in and out of Kafka, and a way to read
        **every change** from a database, including deletes.

        ## Idea 1: plugs instead of programs (Kafka Connect)

        **Kafka Connect** is a framework that runs ready-made connectors. You do not write code;
        you write a configuration.

        - A **source connector** reads a system and writes to topics.
        - A **sink connector** reads topics and writes to a system.

        Think of a wall socket with standard plugs. The socket (Connect) handles power, safety and
        restarts. Each plug (connector) only knows its own device.

        ## Idea 2: how Connect runs the work

        - A **worker** is a JVM process. In distributed mode, workers with the same group id form a
          cluster and share the work.
        - A **connector** is a configuration, sent as JSON to a REST API. It splits itself into
          **tasks**, the units of parallelism. A JDBC source might run one task per table. A sink runs
          up to one task per partition.
        - The cluster stores connector configs, source offsets and status in three internal topics.
          Kill a worker, and its tasks restart on the other workers from the stored offsets. That
          fixes problem 4: the bookmark lives in Kafka.
        - **Converters** turn records into bytes: Avro, Protobuf or JSON Schema with a schema
          registry, or plain JSON.
        - **Single message transforms (SMTs)** make small per-record changes: rename a field, mask a
          column, route by a value.

        ## Idea 3: read the database's diary, not its tables (CDC with Debezium)

        Every database already keeps a diary of every change, for its own crash recovery. MySQL calls
        it the binlog. Postgres calls it the write-ahead log (WAL). The diary has every insert,
        every update and every delete, in order.

        **Debezium** source connectors read that diary. That is **change data capture (CDC)**. It
        fixes problems 1 and 2: deletes are in the diary, and so is every intermediate change.

        - MySQL: the binlog. Postgres: the WAL, through a **replication slot**. SQL Server: its
          change tables.
        - A new connector first takes a **snapshot** of the existing rows, then streams changes.
        - Each event carries the row «before» and «after», the operation (create, update or
          delete), and the log position.
        - A delete is followed by a **tombstone**: a record with the key and a null value, so a
          compacted topic drops that key.

        > [!trap] A stopped Postgres connector can fill the database disk
        > A replication slot keeps WAL until its consumer confirms it. If the connector is down for
        > a day, the primary keeps a day of WAL. Alert on slot lag, and set «max_slot_wal_keep_size»
        > so the database protects itself.

        ## Idea 4: publish a letter, not your private diary (the outbox pattern)

        Raw CDC has a catch. Other teams now read your service's private tables. Rename a column, and
        you break them.

        With the **outbox pattern**, the service writes a clean business event into an «outbox»
        table, **in the same transaction** as the real change. Debezium publishes only that table.

        - The event is a public contract, separate from the private tables.
        - Same transaction means the event cannot be lost, and it is never sent for a rolled-back
          change.

        ## Idea 5: one bad record should not stop everything

        By default, the first record that cannot be converted fails the task. One malformed row stops
        the whole pipeline.

        - «errors.tolerance=none»: the default. The first bad record fails the task.
        - «errors.tolerance=all»: skip records that fail conversion or transforms.
        - «errors.deadletterqueue.topic.name»: sink only. Send failed records to a DLQ topic.

        The **dead letter queue (DLQ)** keeps the bad records, with headers that say why they failed.

        ## Now say it like a senior engineer

        > [!senior] What a senior answer adds
        > Say how the pipeline restarts (offsets in Kafka, so a worker loss is a rebalance), how
        > schema changes are governed (registry compatibility mode, usually backward), how deletes
        > flow (tombstones), and that someone owns the dead letter queue. A DLQ nobody reads is
        > silent data loss.

        ## In one breath

        Kafka Connect runs standard plugs instead of custom programs, and Debezium reads the
        database's own change diary, so you get every change, including deletes. Publish an outbox
        event as the contract, and give bad records somewhere to go.
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
      minutes: 16,
      body: `
        ## Start with the problem

        You want a small piece of logic: for each trip event, attach the driver's current status,
        and write the result to a new topic. Input is Kafka, output is Kafka.

        You could run a Flink cluster for that. But a cluster is a whole system to operate: a job
        manager, deployments, upgrades. For a small piece of logic that is a lot of weight.

        ## Idea 1: a library, not a cluster (Kafka Streams)

        **Kafka Streams** is a Java library. You put it inside an ordinary service and run several
        copies. Kafka's own consumer group protocol shares the input partitions between the copies.
        There is no job manager to run. That is its main appeal.

        ## Idea 2: two ways to read the same records (streams and tables)

        Look at a bank account. The list of transactions is a **stream**: each line is something
        that happened. The current balance is a **table**: one latest value per account.

        Kafka Streams has both.

        - «KStream»: every record is an event. Example: each trip request.
        - «KTable»: the latest value per key; each record is an update. Example: each driver's
          current status.
        - «GlobalKTable»: a KTable copied in full to every instance. Example: a small list of cities.

        Now the key insight. Add up a stream by key, and you get a table (transactions become a
        balance). Write down every change to a table, and you get a stream (balance changes become
        transactions). This **stream-table duality** is the core idea. It is also how state
        survives a crash, as the next idea shows.

        ## Idea 3: local state, backed up as a stream (state stores and changelogs)

        Aggregations and joins keep state in a local store, RocksDB by default. Every write to that
        store is also written to a compacted **changelog topic** in Kafka. That is the duality in
        action: the table is backed up as a stream.

        When an instance dies, its partitions move. The new owner rebuilds the store by replaying the
        changelog. A large store can take minutes to restore, so production apps set **standby
        replicas**: a warm copy kept on another instance, ready to take over.

        ## Idea 4: a join only works if matching keys meet (co-partitioning)

        Each instance joins only the partitions it owns. So "trip for driver 7" and "status of driver
        7" must land on the same instance. That only happens if both topics have **the same number of
        partitions and the same key**. This is **co-partitioning**.

        If they do not match, Kafka Streams first re-keys one side into a **repartition topic**. That
        works, but it doubles the traffic for that step. A GlobalKTable avoids the rule, because every
        instance has all of it.

        ## Idea 5: exactly once, inside Kafka

        «processing.guarantee=exactly_once_v2» wraps three things in one Kafka transaction: the input
        offsets, the changelog writes and the output records. Either all happen or none. This holds
        inside Kafka. A call to an external API is still at least once.

        ## Idea 6: SQL on top (ksqlDB)

        **ksqlDB** puts SQL on top of Kafka Streams. «CREATE STREAM», «CREATE TABLE AS SELECT» and
        windowed aggregations run as persistent queries on a ksqlDB cluster. It is quick for simple
        filters and transformations. For new work, many teams now choose Flink SQL, which Confluent
        Cloud also leads with. Know both names and the trade-off.

        ## Now say it like a senior engineer

        - **Kafka Streams:** input and output are Kafka, the logic lives in a service your team
          runs, and the state fits per instance.
        - **Flink:** many sources and sinks, very large state, event-time windows over long periods,
          SQL for analysts.
        - **ksqlDB or Flink SQL:** simple filters, projections and aggregations, owned by people who
          prefer SQL.

        > [!senior] Say what the library costs
        > No cluster to run, but scaling is capped by the input partition count, a rebalance pauses
        > processing while stores restore, and large state means long restores. Standby replicas and
        > static membership are the usual fixes.

        ## In one breath

        Kafka Streams is stream processing as a library: tables are streams added up, and streams
        are tables written down, which is also how state is backed up. Joins need co-partitioned
        topics, or the library repartitions for you.
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
      minutes: 14,
      body: `
        ## Start with the problem

        A Kafka cluster must always know some facts about itself. Which topics exist? How many
        partitions does each one have? Which broker leads each partition right now? This is the
        cluster's **metadata**. If two brokers disagree about who leads partition 7, both accept
        writes, and data splits in two.

        So the metadata needs one trusted home that survives a machine dying. For years, that home
        was a separate system. This lesson is about where it lives now, and about the other thing that
        makes Kafka feel slow in production: consumer groups that keep stopping.

        ## Idea 1: the old way (ZooKeeper)

        Kafka used to keep its metadata in **ZooKeeper**, a separate cluster built for exactly this
        kind of agreement. It worked, but you had to run and upgrade two different systems. And when
        the active controller failed, the new one had to reload all metadata from ZooKeeper, which
        was slow on big clusters.

        ## Idea 2: keep the metadata in a Kafka-style log (KRaft)

        Kafka is already very good at one thing: a replicated log. So why not store the metadata as a
        log too?

        In **KRaft** mode, a small group of **controllers** stores metadata in an internal log, and
        they use the Raft protocol to agree on each entry. Brokers simply follow that log. A standby
        controller already has the whole log, so failover is fast.

        - Kafka 4.0 (2025) removed ZooKeeper entirely.
        - A ZooKeeper cluster must first migrate on a 3.x bridge release before it can move to 4.x.
        - Run three or five controllers, on separate machines or zones. Raft needs a majority alive,
          so an odd number gives the best safety for the cost.

        | | ZooKeeper era | KRaft |
        |---|---|---|
        | Systems to run | Kafka plus ZooKeeper | Kafka only |
        | Controller failover | Slow reload | Instant, log already there |
        | Partitions per cluster | Limited | Far higher |

        ## Idea 3: why consumer groups stop (rebalancing)

        A **rebalance** re-deals the partitions when a consumer joins, leaves or misses heartbeats.
        How it re-deals matters a lot. Picture a card game where one new player sits down.

        - **Eager (the old default):** everyone throws all cards back, and the dealer deals again.
          Everyone stops playing while that happens.
        - **Cooperative sticky:** everyone keeps their cards, and only the few cards that must move
          are passed over.
        - **Static membership** («group.instance.id»): a player who steps out and comes back within
          the session timeout gets the same cards back, with no re-deal at all.
        - **Next-gen protocol (KIP-848):** generally available in Kafka 4.0 with
          «group.protocol=consumer». The broker computes the assignment and changes it step by step,
          with no group-wide pause.

        > [!trap] Rolling deploys cause rebalance storms
        > Restart 50 consumers one by one with the eager protocol, and the group rebalances about 50
        > times, each time stopping everyone. Use cooperative or the new protocol, add static
        > membership, and keep processing per poll well below «max.poll.interval.ms».

        ## Idea 4: running Kafka well

        - **Replication:** factor 3, «min.insync.replicas=2», and racks set with «broker.rack» so
          the copies spread across zones.
        - **Retention:** by time and size per topic; **compaction** for changelog and "latest value"
          topics; tiered storage for long replay windows.
        - **Watch:** consumer lag per group, under-replicated partitions, offline partitions,
          request latency and disk use per broker.
        - **Managed options:** Amazon MSK, Confluent Cloud, Google Cloud Managed Service for Apache
          Kafka, Aiven. They remove broker operations. They do not design your partitions for you.

        ## Now say it like a senior engineer

        > [!senior] Mention the new primitives
        > Kafka 4.0 also brought **share groups** (KIP-932, early access). They let several consumers
        > read one partition like a queue, with per-record acknowledgement. Knowing where the project
        > is going is a cheap senior signal.

        ## In one breath

        KRaft stores Kafka's metadata in Kafka's own kind of log, so there is one system and fast
        failover. Rebalances hurt when everyone throws their cards back; cooperative protocols and
        static membership move only what must move.
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
      minutes: 16,
      body: `
        ## Start with the problem

        You design a streaming pipeline. The interviewer asks: "Why Flink and not Spark?" Both are
        good. Both are used at huge scale. If you answer with a slogan, you lose the point. The
        right answer comes from one difference in how each engine thinks about a stream.

        ## Idea 1: a conveyor belt or a delivery van

        **Flink** is a conveyor belt. Its operators run all the time, and records move through them
        one by one, as they arrive. Batch is just a special case: a stream that happens to end.

        **Spark Structured Streaming** is a delivery van that leaves every few seconds. It treats a
        stream as a table that keeps growing. By default it runs **micro-batches**: at every trigger
        it plans and runs a small batch job over the data that arrived since the last trip.

        Almost every difference below follows from that picture.

        ## Idea 2: what follows from it

        - **Latency.** Flink: milliseconds. Spark: usually seconds, set by the trigger.
        - **State.** Flink keeps keyed state in memory or RocksDB, and very large state is normal;
          Flink 2.0 added disaggregated state storage. Spark keeps a state store per micro-batch,
          with a RocksDB provider for large state.
        - **Event time.** Both use **watermarks**. Flink adds **timers**: code can fire at any event
          time or processing time, per key. Spark 4 offers arbitrary state with timers through
          «transformWithState».
        - **Exactly once.** Flink: checkpoint barriers plus transactional or idempotent sinks.
          Spark: checkpointed offsets plus idempotent or transactional sinks.
        - **Upgrades.** Flink has **savepoints**: stop, change the job, restore the state. Spark
          restarts from the checkpoint, and some query changes are not allowed with existing state.
        - **APIs.** Flink: Java, SQL, Python (PyFlink). Spark: Python, SQL, Scala and Java, with the
          same DataFrame API as batch.
        - **Where it runs.** Flink: Kubernetes, YARN, managed services such as Amazon Managed Service
          for Apache Flink and Confluent. Spark: any Spark cluster, Databricks, EMR, Dataproc.

        ## Idea 3: when the conveyor belt wins (choose Flink)

        - Latency must be under a second: fraud scoring, alerting, real-time pricing.
        - The logic is **event-driven and stateful**: per-key timers, complex event patterns,
          session logic with custom rules.
        - State is very large and lives long, and you must upgrade jobs without losing it.

        ## Idea 4: when the van wins (choose Spark)

        - Seconds to minutes are fine, and the team already runs Spark and writes PySpark.
        - The same code should run as batch and as a stream, for example a backfill with the same
          DataFrame logic.
        - The sink is a lakehouse table (Delta or Iceberg), on Databricks or a similar platform.

        ## Idea 5: same concepts, different words

        Both need a **watermark** to bound lateness, **checkpoints** for recovery, **keys** to
        partition state, and an **idempotent or transactional sink** for exactly-once results.
        **Kafka Streams** is a third option, when the job is a Kafka-to-Kafka service inside an
        application, with no separate cluster.

        ## Now say it like a senior engineer

        > [!trap] "Spark streaming is not real streaming"
        > This is an outdated jab. Micro-batch latency is fine for most analytics, and the shared
        > batch and stream API is a real advantage. Choose by latency need and team skill, not by
        > slogan.

        > [!senior] Decide with three numbers and a team
        > "We need p99 under 500 ms, 2 TB of keyed state and per-user timers: Flink. The hourly
        > aggregates into the lakehouse can be Spark, which the team already runs." Mixing engines by
        > need is a staff-level answer.

        ## In one breath

        Flink is a conveyor belt that handles each record as it comes; Spark is a van that leaves
        every few seconds with a small batch. Pick the belt for sub-second, timer-heavy, huge-state
        work, and the van when seconds are fine and the team already speaks Spark.
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
