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
      minutes: 15,
      body: `
        Kafka is a distributed, append-only log. Producers append records to a **topic**, which is
        split into **partitions**. Each partition is an ordered sequence; each record in it has an
        **offset**. Consumers read by offset and can re-read whenever they want, until retention
        deletes old segments.

        ## The guarantees, precisely

        - **Ordering is per partition**, not per topic. Records with the same key go to the same
          partition (by default, a hash of the key), so per-key order holds.
        - **Durability** comes from replication. Each partition has a leader and followers. The
          in-sync replicas (ISR) are followers that are caught up.
        - With «acks=all» and «min.insync.replicas=2» on a replication factor of 3, a write is
          acknowledged only when at least two replicas have it, so one broker failure loses nothing.

        | Producer setting | Effect |
        |---|---|
        | «acks=0» | Fire and forget, can lose data |
        | «acks=1» | Leader has it; lost if the leader dies before followers copy it |
        | «acks=all» | All in-sync replicas have it; the durable choice |
        | «enable.idempotence=true» | Retries cannot create duplicates in the partition (default since Kafka 3.0) |

        ## Choosing the key and the partition count

        The key decides both ordering and load balance. Key by «trip_id» to keep a trip's events
        in order. Key by «city_id» and New York becomes a hot partition. Partition count caps
        consumer parallelism (one consumer per partition in a group), and changing it later
        re-maps keys to partitions, which breaks per-key ordering across the change.

        > [!trap] More partitions is not free
        > Each partition costs broker memory, file handles and leader elections. Size from target
        > throughput and consumer parallelism, with headroom, not "as many as possible".

        > [!senior] Retention is a design choice
        > Retention decides how far back a consumer can replay after a bug. Tiered storage (KIP-405,
        > production-ready in Kafka 3.6+) keeps old segments in object storage cheaply, which makes
        > long replay windows affordable.
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
      minutes: 16,
      body: `
        Phones go through tunnels. Events created at 10:00 can arrive at 10:07. If you count trips
        per minute by **processing time** (when the event arrived), your numbers depend on network
        luck. **Event time** (when it happened) gives the true answer, but raises a question: when
        is a window complete?

        ## Windows

        | Window | Shape | Example |
        |---|---|---|
        | Tumbling | Fixed, non-overlapping | Trips per minute |
        | Sliding (hopping) | Fixed size, overlapping | Trips in the last 5 minutes, every minute |
        | Session | Gap-based, per key | A rider's app session |

        ## Watermarks

        A **watermark** is the stream's estimate that "no more events older than time T will
        arrive". When the watermark passes the end of a window, the window can fire. A common
        strategy is "maximum event time seen minus a bounded delay", such as 2 minutes.

        ~~~text
        events (event time): 10:00:10  10:00:50  10:01:20  10:00:40 (late)  10:02:30
        watermark = max_seen - 60s
        window [10:00, 10:01) fires when watermark >= 10:01, i.e. after an event at >= 10:02 arrives
        ~~~

        ## Late data

        Events behind the watermark are **late**. Options: drop them (count them in a metric),
        allow lateness so the window updates and emits a correction, or send them to a side output
        for a batch fix-up. This is the **Dataflow model's** framing, from Google: what you
        compute, where in event time, when in processing time you emit, and how refinements relate.

        > [!senior] The trade-off is latency versus completeness
        > A longer watermark delay means more complete windows but later results. Say what the
        > consumer needs: a surge pricing signal wants seconds and tolerates small errors; a
        > billing report wants completeness and can wait for a batch correction.

        > [!trap] Idle partitions stall watermarks
        > If one source partition has no data, its watermark does not advance, and windows never
        > fire. Flink's «withIdleness» marks such sources idle so they stop holding back progress.
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
  ],
};

export const problems: Problem[] = [
  {
    slug: 'kafka-key-choice',
    title: 'Choose the Kafka key for trip events',
    track: 'streaming',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber'],
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
    companies: ['uber'],
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
    companies: ['uber', 'google'],
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
    companies: ['uber'],
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
    companies: ['google'],
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
];
