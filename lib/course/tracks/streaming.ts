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
