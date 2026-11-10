import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'databases',
  title: 'Database foundations',
  summary:
    'How the databases you extract from work inside: storage engines, transactions, replication, sharding and the trade-offs that shape every source system.',
  tone: 'grape',
  why: 'Senior loops test first principles. When an interviewer asks why CDC lags, why a replica returns stale rows or why a write-heavy store uses an LSM-tree, the answer lives in the database, not in the pipeline.',
  lessons: [
    {
      slug: 'database-families',
      title: 'Database families and their trade-offs',
      summary:
        'Place relational, key-value, document, wide-column, graph, search, time-series and OLAP stores by the access pattern each one serves.',
      minutes: 15,
      body: `
        A data engineer reads from every kind of database and must say why a team picked it. The
        question is never "which is best". The question is **which access pattern does this store
        make cheap, and what does it make expensive**.

        ## The families

        | Family | Examples | Cheap | Expensive |
        |---|---|---|---|
        | **Relational (OLTP)** | Postgres, MySQL, SQL Server, Oracle | Point reads and writes by key, joins, transactions across rows | Scans over billions of rows, horizontal scale of writes |
        | **Distributed SQL (NewSQL)** | Spanner, CockroachDB, YugabyteDB, TiDB | SQL and transactions with writes spread over many nodes | Latency of cross-region commits, cost |
        | **Key-value** | DynamoDB, Redis, RocksDB | Get and put by key at any scale, predictable latency | Any query that is not by key |
        | **Document** | MongoDB, Firestore, Couchbase | Read a whole nested object in one call, flexible schema | Joins, many-to-many relations, cross-document constraints |
        | **Wide-column** | Cassandra, ScyllaDB, Bigtable, HBase | Very high write rates, range reads inside one partition key | Ad hoc filters, secondary indexes, read-modify-write |
        | **Graph** | Neo4j, Neptune, Spanner Graph | Multi-hop traversals (friends of friends, fraud rings) | Wide aggregations |
        | **Search** | Elasticsearch, OpenSearch, Solr | Full-text relevance, faceted filters | Strong consistency, joins, being a source of truth |
        | **Time-series** | TimescaleDB, InfluxDB, Prometheus | Append by time, downsampling, recent-window queries | Updates of old points, high-cardinality labels |
        | **OLAP (columnar)** | BigQuery, Snowflake, ClickHouse, Pinot, Druid | Aggregates over billions of rows and few columns | Single-row updates, high-rate point lookups |

        ## SQL versus NoSQL is the wrong axis

        "NoSQL" grouped stores that dropped joins and multi-row transactions to scale writes across
        machines. That trade has moved. Spanner and CockroachDB scale SQL with transactions, and
        DynamoDB and MongoDB now offer multi-item transactions. Compare stores on these axes instead:

        - **Data model:** tables with a fixed schema, nested documents, or opaque values.
        - **Query flexibility:** ad hoc SQL, or access only by the key you designed for.
        - **Consistency:** strong by default, tunable, or eventual.
        - **Scale model:** one primary with replicas, or writes partitioned over many nodes.
        - **Storage engine:** B-tree (read-optimised) or LSM-tree (write-optimised). See the next lessons.

        ## Row stores versus column stores

        An OLTP row store keeps all columns of a row together in a page, so "fetch order 42" is one
        page read. A column store keeps each column together, so "sum revenue for 3 billion rows"
        reads one compressed column and skips the rest. This is why a pipeline copies data **out**
        of Postgres into BigQuery instead of running dashboards on the primary.

        > [!example] Uber-shaped stack
        > Trips are written to a sharded OLTP store, driver locations to a key-value store with a
        > short TTL, events to Kafka, history to a lakehouse, and city dashboards to a real-time
        > OLAP store such as Pinot. Each store has one job. The data engineer owns the copies.

        > [!senior] Say the access pattern first
        > A strong answer: "Writes are 50,000 a second by device id and reads are the last hour for
        > one device, so I want a wide-column or key-value store with device id as the partition key.
        > Analysts get a copy in the warehouse." Naming a product before the access pattern is the
        > mid-level answer.
      `,
      checks: [
        {
          question:
            'Analysts need ad hoc aggregates over 4 billion order rows. Which family fits best?',
          options: [
            'A key-value store',
            'A columnar OLAP store',
            'A document store',
            'The OLTP primary with more indexes',
          ],
          answer: 1,
          why: 'Column stores read only the needed columns, compress them well and scan in parallel. A key-value store cannot run ad hoc queries, and analytics on the OLTP primary hurts production.',
        },
        {
          question: 'What is the most useful axis to compare two databases for a design round?',
          options: [
            'SQL or NoSQL',
            'Open source or managed',
            'The access patterns each one makes cheap',
            'Which one is newer',
          ],
          answer: 2,
          why: 'Access patterns decide fit. SQL versus NoSQL no longer separates stores cleanly: distributed SQL scales writes, and many NoSQL stores have transactions.',
        },
      ],
    },
    {
      slug: 'query-execution',
      title: 'How a database executes a query',
      summary:
        'Follow a query through parse, plan, optimise and execute, and read a Postgres EXPLAIN ANALYZE to find the slow node.',
      minutes: 16,
      body: `
        Every engine, from Postgres to Spark to BigQuery, runs the same pipeline. Know it once and
        you can reason about any slow query.

        ~~~text
        SQL text
          └─ parse        → syntax tree
          └─ analyse      → names resolved against the catalog, types checked
          └─ rewrite      → views expanded, rules applied
          └─ plan         → many candidate plans, each costed with table statistics
          └─ execute      → the cheapest plan runs as a tree of operators
        ~~~

        ## Access paths

        | Operator | When the planner picks it |
        |---|---|
        | **Seq Scan** | Reading a large share of the table, or no useful index |
        | **Index Scan** | A selective filter on an indexed column; reads index, then each heap row |
        | **Index Only Scan** | Every needed column is in the index, and the visibility map is current |
        | **Bitmap Heap Scan** | Medium selectivity: collect matching row ids, then read pages in order |

        ## Join algorithms

        | Algorithm | Good for | Cost |
        |---|---|---|
        | **Nested loop** | A small outer side and an index on the inner side | Outer rows × index lookup |
        | **Hash join** | Two large inputs, equality condition, the build side fits in memory | Build a hash table once, probe once |
        | **Merge join** | Both inputs already sorted on the key | Sort (if needed) plus one linear pass |

        ## The cost model and statistics

        The optimiser does not run plans to compare them. It **estimates** rows at each step from
        statistics: row counts, distinct values, most common values and histograms. «ANALYZE»
        refreshes them. When an estimate is wrong by 100 times, the planner picks a nested loop
        that runs a million index lookups, and the query takes an hour.

        ~~~sql
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT r.city, count(*)
        FROM trips t
        JOIN riders r ON r.rider_id = t.rider_id
        WHERE t.requested_at >= now() - interval '1 day'
        GROUP BY r.city;
        ~~~

        ~~~text
        HashAggregate  (rows=40) (actual rows=38 loops=1)
          -> Hash Join  (rows=2100) (actual rows=1850000 loops=1)
               Hash Cond: (t.rider_id = r.rider_id)
               -> Index Scan using trips_requested_at_idx on trips t
                    (rows=2100) (actual rows=1850000 loops=1)
               -> Hash  (rows=9000000)
                    -> Seq Scan on riders r
        ~~~

        Read it from the inside out. The scan on «trips» expected 2,100 rows and got 1.85 million.
        That 880-times error is the bug. Stale statistics after a bulk load are the usual cause, so
        run «ANALYZE trips» first.

        ## Execution models

        - **Iterator (Volcano):** each operator pulls one row at a time from its child. Simple, but
          the per-row function calls cost a lot on analytical work.
        - **Vectorised:** operators pass batches of about 1,000 to 2,000 values, which suits CPU
          caches and SIMD. DuckDB, ClickHouse, Snowflake and Databricks Photon work this way.
        - **Code generation:** the plan compiles into one tight loop. Spark whole-stage codegen
          and HyPer-style engines do this.

        > [!tip] Correlated columns fool the planner
        > «city = 'SF' AND state = 'CA'» looks twice as selective as it is, because the planner
        > assumes the columns are independent. In Postgres, «CREATE STATISTICS» on both columns
        > fixes the estimate.

        > [!senior] Estimates versus actuals
        > The senior habit is to compare estimated and actual rows on every node and find the first
        > large gap from the bottom. Adding an index before you find that gap is guessing.
      `,
      checks: [
        {
          question:
            'A plan node estimates 50 rows and returns 4 million, and a nested loop sits above it. What do you check first?',
          options: [
            'Add more memory',
            'The table statistics behind the estimate',
            'Rewrite the query as a CTE',
            'Disable hash joins',
          ],
          answer: 1,
          why: 'The planner chose a nested loop because it expected 50 rows. Stale or missing statistics, or correlated columns, cause the bad estimate. Fix the estimate and the plan usually fixes itself.',
        },
        {
          question: 'Why do analytical engines prefer vectorised execution?',
          options: [
            'It needs no statistics',
            'It processes batches of values per call, which uses CPU caches and SIMD well',
            'It avoids reading from disk',
            'It guarantees serializable isolation',
          ],
          answer: 1,
          why: 'Passing a batch per call removes most per-row overhead and lets the CPU work on contiguous arrays.',
        },
      ],
    },
    {
      slug: 'transactions-mvcc-wal',
      title: 'Transactions: ACID, isolation, MVCC and the WAL',
      summary:
        'Explain what each ACID letter costs, which anomalies each isolation level allows, how MVCC gives readers a snapshot and why the WAL makes CDC possible.',
      minutes: 17,
      body: `
        Transactions are where source-system bugs come from: double-charged payments, negative
        balances and rows that a CDC stream misses. A senior data engineer can name the anomaly.

        ## ACID in one line each

        - **Atomicity:** all writes of a transaction happen, or none. The undo or log makes it so.
        - **Consistency:** the database moves from one valid state to another. Constraints help,
          but this letter is mostly the application's job.
        - **Isolation:** concurrent transactions do not see each other's half-done work, to the
          level you choose.
        - **Durability:** after commit, a crash does not lose the write. The WAL plus «fsync» do this.

        ## Isolation levels and anomalies

        | Anomaly | What happens |
        |---|---|
        | **Dirty read** | You read another transaction's uncommitted write |
        | **Non-repeatable read** | You read a row twice and get two values |
        | **Phantom** | You run a range query twice and get new rows |
        | **Lost update** | Two read-modify-write cycles race and one overwrite is lost |
        | **Write skew** | Two transactions read the same data, then each writes a different row, and together they break a rule |

        | Level | Prevents | Default in |
        |---|---|---|
        | Read committed | Dirty reads | Postgres, Oracle, SQL Server |
        | Repeatable read / snapshot | Also non-repeatable reads; most phantoms | MySQL InnoDB |
        | Serializable | Every anomaly above | CockroachDB, Spanner |

        Postgres "repeatable read" is snapshot isolation. It aborts a lost update with a
        serialization error, but it still allows write skew. Only «SERIALIZABLE» (SSI in Postgres)
        stops write skew.

        ~~~sql
        -- Lost update under read committed: both sessions read 100, both write 100 - 30.
        -- Fix 1: an atomic statement
        UPDATE wallets SET balance = balance - 30 WHERE wallet_id = 7 AND balance >= 30;
        -- Fix 2: lock the row you read
        SELECT balance FROM wallets WHERE wallet_id = 7 FOR UPDATE;
        ~~~

        ## MVCC: readers do not block writers

        Multi-version concurrency control keeps several versions of a row. Each transaction reads
        the versions that were committed when its snapshot began.

        - **Postgres** writes a new row version on every update. Hidden columns «xmin» and «xmax»
          say which transactions see it. «VACUUM» removes dead versions later. A transaction left
          open for hours stops vacuum and the table bloats.
        - **MySQL InnoDB** updates in place and keeps old versions in the undo log. A long
          transaction makes the undo history grow instead.

        ## The write-ahead log

        Before a change reaches a data page, the database appends it to the **write-ahead log**
        (WAL in Postgres, redo log plus binlog in MySQL). Commit means "the log record is on disk".
        After a crash, the database replays the log. Data pages flush later, at checkpoints.

        ~~~text
        client COMMIT → append WAL record → fsync WAL → reply "committed"
                                          ↘ later: checkpoint writes dirty pages to data files
        ~~~

        The log is an ordered list of every committed change, so it also feeds **replicas** and
        **CDC**. Debezium reads Postgres logical decoding («wal_level = logical», a replication slot)
        or the MySQL binlog in row format.

        > [!trap] A replication slot can fill the disk
        > A Postgres slot keeps WAL until its consumer confirms it. If the CDC connector stops for a
        > weekend, WAL piles up on the primary until the disk is full. Alert on slot lag in bytes and
        > set «max_slot_wal_keep_size».

        > [!senior] Connect it to the pipeline
        > "A long analytical query on the primary holds a snapshot, blocks vacuum and bloats hot
        > tables, so we extract from a replica or from the WAL." That sentence joins MVCC, WAL and
        > extraction design, which is the staff-level link interviewers want.
      `,
      checks: [
        {
          question:
            'Two doctors each check that another doctor is on call, then each takes themselves off call. Both succeed under snapshot isolation. What is this anomaly?',
          options: ['Dirty read', 'Lost update', 'Write skew', 'Phantom read only'],
          answer: 2,
          why: 'Each transaction read the same set and wrote a different row, so no write conflict was detected. Only serializable isolation (or an explicit lock) prevents write skew.',
        },
        {
          question: 'What does "committed" mean for durability in a WAL-based database?',
          options: [
            'The data page is written to disk',
            'The log record is flushed to disk',
            'A replica has applied the change',
            'A checkpoint has run',
          ],
          answer: 1,
          why: 'Commit waits for the WAL record to be durable. Pages are written later; after a crash the database replays the log to rebuild them.',
        },
      ],
    },
    {
      slug: 'btree-vs-lsm',
      title: 'B-trees versus LSM-trees',
      summary:
        'Compare the two storage engines by read, write and space amplification, and match each to a workload.',
      minutes: 14,
      body: `
        Almost every database stores data in one of two structures. The choice explains why
        Postgres is good at reads and Cassandra absorbs a million writes a second.

        ## B-tree (B+tree)

        Data lives in fixed-size pages (8 KB in Postgres, 16 KB in InnoDB). Inner pages hold keys
        and child pointers. Leaf pages hold rows or row pointers and link to their neighbours for
        range scans. A fan-out of a few hundred means **3 or 4 levels cover billions of rows**, so a
        lookup reads about 4 pages, and the top levels are usually in memory.

        - Writes **update pages in place**. One small row change rewrites an 8 KB page (plus the WAL
          record), so random writes cost a lot of I/O.
        - Reads are predictable: one path from root to leaf.

        ## LSM-tree (log-structured merge)

        ~~~text
        write → WAL (for durability) + memtable (sorted, in memory)
        memtable full → flush as an immutable sorted file (SSTable), level 0
        background compaction → merge SSTables into larger, non-overlapping levels
        read → memtable, then each level newest first; bloom filters skip files
        ~~~

        - Writes are **sequential appends**, so write throughput is very high.
        - A read may check several files. **Bloom filters** answer "the key is surely not here"
          for most files, and the block cache keeps hot data in memory.
        - Deletes write a **tombstone**. Space returns only after compaction merges it.

        Used by RocksDB, Cassandra, ScyllaDB, HBase, Bigtable and the storage layer of CockroachDB
        and TiDB.

        ## The three amplifications

        | | B-tree | LSM-tree |
        |---|---|---|
        | **Write amplification** | High for small random writes (whole pages) | Data is rewritten at each compaction level |
        | **Read amplification** | Low: one root-to-leaf path | Higher: several files, helped by bloom filters |
        | **Space amplification** | Pages are partly empty after splits | Old versions and tombstones wait for compaction |

        ## Compaction strategies

        - **Leveled** (RocksDB default): each level is about 10 times the previous one, files in a
          level do not overlap. Lower read and space cost, more write cost.
        - **Size-tiered** (classic Cassandra default): merge files of similar size. Cheaper writes,
          but reads touch more files and a compaction can need twice the space for a moment.

        > [!trap] Tombstones in a queue-like table
        > Using Cassandra as a queue (insert, read, delete) builds up tombstones. A read then scans
        > thousands of them and times out. Model time buckets with a TTL, or use a real queue.

        > [!senior] Match the engine to the ratio
        > "Device telemetry is 95 percent writes and reads the recent window by device, so an LSM
        > store fits. The order service reads by key ten times more than it writes and needs
        > transactions, so a B-tree database fits." Tie the engine to the read and write ratio.
      `,
      checks: [
        {
          question: 'Why does an LSM-tree accept writes faster than a B-tree?',
          options: [
            'It skips the WAL',
            'It turns random writes into sequential appends and sorts them in memory first',
            'It stores no indexes',
            'It never rewrites data',
          ],
          answer: 1,
          why: 'Writes go to the memtable and the log, then flush as sorted files. Compaction does rewrite data later, but in large sequential batches.',
        },
        {
          question: 'What lets an LSM read avoid opening most SSTables?',
          options: ['Tombstones', 'Bloom filters', 'The memtable', 'Page splits'],
          answer: 1,
          why: 'A bloom filter per file says when a key is surely absent, so the read skips that file.',
        },
      ],
    },
    {
      slug: 'replication-and-consistency',
      title: 'Replication and consistency models',
      summary:
        'Compare single-leader, multi-leader and leaderless replication, and name the guarantee a reader gets: linearizable, read-your-writes, monotonic or eventual.',
      minutes: 16,
      body: `
        Replication copies data to more machines for availability, read scale and locality. It
        also creates the stale reads that confuse pipelines and dashboards.

        ## Three topologies

        | Topology | How writes flow | Examples | Main risk |
        |---|---|---|---|
        | **Single leader** | All writes to one primary; followers apply its log | Postgres, MySQL, MongoDB replica sets, Kafka partitions | Failover; replica lag |
        | **Multi-leader** | Each region accepts writes; leaders exchange changes | Multi-region MySQL setups, CouchDB | Write conflicts need a resolution rule |
        | **Leaderless** | The client writes to several replicas, reads from several | Cassandra, ScyllaDB, DynamoDB internals | Tunable but subtle consistency |

        ## Synchronous or asynchronous

        - **Synchronous:** commit waits for a follower. No data loss on failover, but a slow
          follower slows every write.
        - **Asynchronous:** commit returns at once. Fast, but a failover can lose the last seconds,
          and followers lag.
        - **Semi-synchronous:** wait for one follower of several. A common middle ground.

        ## Consistency models, strongest first

        | Model | What a reader is promised |
        |---|---|
        | **Linearizable** | Every read sees the latest committed write, as if there were one copy |
        | **Sequential / causal** | Everyone sees causally related writes in the same order |
        | **Read-your-writes** | You always see your own writes |
        | **Monotonic reads** | You never see time go backwards across reads |
        | **Eventual** | Replicas converge if writes stop; no promise on any single read |

        ## Quorums in leaderless stores

        With N replicas, a write waits for W acknowledgements and a read asks R replicas. If
        **R + W > N**, every read set overlaps the latest write set. With N = 3, «QUORUM» writes and
        reads (W = 2, R = 2) overlap. «ONE» and «ONE» are fast but can return stale values.
        Read repair and anti-entropy fix replicas in the background.

        ## Failover

        When a leader dies, a follower is promoted. Two leaders at once (**split brain**) corrupt
        data, so systems use fencing tokens, leases or consensus (Raft in etcd, CockroachDB and
        Kafka KRaft; Paxos in Spanner) to make sure only one leader writes.

        > [!example] The stale profile
        > A rider changes their home address, the app reloads, and the old address shows. The write
        > went to the primary and the read went to a lagging replica. Fixes: read from the primary
        > for a few seconds after a user's own write, or pin the session to a replica that has
        > reached the write's log position.

        > [!senior] Pipelines read replicas too
        > An extraction job on an async replica sees a slightly old snapshot. That is fine if the
        > job records the replica's log position as its watermark. It is a bug if the job uses
        > "now" from the primary as the watermark and skips rows the replica has not received yet.
      `,
      checks: [
        {
          question:
            'N = 3. Which setting guarantees that a read sees the latest acknowledged write?',
          options: ['W = 1, R = 1', 'W = 2, R = 1', 'W = 2, R = 2', 'W = 1, R = 2'],
          answer: 2,
          why: 'R + W must be greater than N. 2 + 2 = 4 > 3, so the read set always overlaps a replica that has the write.',
        },
        {
          question:
            'A user edits a post and then sees the old text on refresh. Which guarantee is missing?',
          options: ['Monotonic reads', 'Read-your-writes', 'Durability', 'Atomicity'],
          answer: 1,
          why: 'The user did not see their own write, which is the read-your-writes guarantee. Routing that user to the leader for a short time is a common fix.',
        },
      ],
    },
    {
      slug: 'partitioning-and-sharding',
      title: 'Partitioning, sharding and rebalancing',
      summary:
        'Choose range or hash partitioning, use consistent hashing, avoid hot keys and move data when the cluster grows.',
      minutes: 15,
      body: `
        When one machine cannot hold the data or take the writes, you split the data into
        **partitions** (shards) and spread them over nodes. The partition key is the most important
        decision in the design, because it is the hardest to change.

        ## Range or hash

        | Scheme | How | Good | Bad |
        |---|---|---|---|
        | **Range** | Keys in sorted ranges: A–F, G–M … | Range scans, ordered reads | Hot spots on sequential keys such as timestamps |
        | **Hash** | «hash(key) mod partitions» or a hash ring | Even spread of writes | Range scans must ask every partition |
        | **Compound** | Hash on the first part, sort on the second | Even writes and ordered reads inside one key | Queries without the first part fan out |

        Cassandra's primary key «((device_id), event_ts)» is compound: the device id picks the
        partition, and rows inside it are sorted by time.

        ## Consistent hashing

        Plain «hash mod N» moves almost every key when N changes. **Consistent hashing** places
        nodes and keys on a ring, and each key belongs to the next node clockwise. Adding a node
        moves only about 1/N of the keys. **Virtual nodes** give each machine many points on the
        ring, so load evens out and a new machine takes a little from everyone.

        ~~~text
                0
          vnode B1     vnode A1
        vnode C2   ring   vnode B2
          vnode A2     vnode C1
               2^64
        key k → hash(k) → walk clockwise → first vnode → its machine
        ~~~

        ## Hot keys

        Even hashing fails when one key is hot: a celebrity account, a default value, «NULL». Fixes:

        - **Salt the key:** write to «key#0» … «key#9» and read all ten.
        - **Split the hot partition:** DynamoDB and Bigtable split busy ranges automatically.
        - **Cache reads** in front of the store.

        ## Secondary indexes on sharded data

        - **Local index:** each shard indexes its own rows. Writes stay cheap; a query by the indexed
          column asks every shard (scatter and gather).
        - **Global index:** the index is partitioned by the indexed value. Reads go to one place;
          a write touches the row's shard and the index shard, usually asynchronously.

        ## Rebalancing

        - **Fixed number of partitions** (many more than nodes, for example 1,000 for 10 nodes):
          rebalancing moves whole partitions. Kafka, Elasticsearch and Cassandra vnodes use this idea.
        - **Dynamic splitting:** a partition splits when it grows past a size. HBase, Bigtable,
          MongoDB chunks and Spanner splits work this way.
        - Throttle data movement, because rebalancing competes with live traffic.

        > [!trap] Time as the leading key
        > A range-partitioned table keyed by «created_at» sends every new write to the last
        > partition. Lead with a hashed or high-cardinality column, and keep time as a sort key.

        > [!senior] Name the queries that fan out
        > A strong answer names which queries hit one shard and which hit all of them: "Trips are
        > sharded by city, so city dashboards are single-shard, but a rider's history fans out. I
        > will keep a rider-keyed copy in a second store fed by CDC."
      `,
      checks: [
        {
          question:
            'A cluster grows from 10 to 11 nodes. About how many keys move with consistent hashing?',
          options: ['None', 'About 1/11 of the keys', 'About half', 'Almost all'],
          answer: 1,
          why: 'The new node takes over a slice of the ring, about 1/N of the keys. Plain hash mod N would move almost every key.',
        },
        {
          question: 'Why is a global secondary index usually updated asynchronously?',
          options: [
            'It is stored on the client',
            'A write would otherwise need a distributed transaction across the row shard and the index shard',
            'Indexes cannot be partitioned',
            'It avoids storing the key',
          ],
          answer: 1,
          why: 'The index entry lives on a different shard from the row. Keeping both in step synchronously needs a cross-shard transaction, which is slow.',
        },
      ],
    },
    {
      slug: 'cap-and-pacelc',
      title: 'CAP theorem and PACELC',
      summary:
        'State CAP precisely, extend it with PACELC, and use both to justify a store in a design round without hand-waving.',
      minutes: 12,
      body: `
        CAP is the most quoted and most misquoted idea in distributed systems. Interviewers use it
        to test whether you understand trade-offs or only repeat a slogan.

        ## CAP, precisely

        In a replicated system, a **network partition** can stop nodes from talking. During that
        partition, the system must choose:

        - **Consistency (C):** linearizable reads; every read sees the latest write. Some requests
          are refused.
        - **Availability (A):** every request to a working node gets a non-error answer, which may
          be stale.

        Partitions are not optional in a real network, so "pick two of three" is misleading. The
        real statement is: **when a partition happens, choose C or A**.

        ## PACELC

        Daniel Abadi extended CAP with the normal case: **if Partition, choose A or C; Else, choose
        Latency or Consistency**. Most of the time there is no partition, and the trade-off you live
        with daily is latency.

        | System | During a partition | Normally | Notes |
        |---|---|---|---|
        | Spanner | C | C | Pays commit latency for global consistency |
        | CockroachDB | C | C | Raft per range |
        | DynamoDB | A by default | L | Strongly consistent reads are an option, at higher cost |
        | Cassandra | A | L | Tunable per query: «QUORUM» moves it toward C |
        | MongoDB | C (majority writes) | C or L | Depends on read and write concerns |
        | Postgres + async replicas | C on the primary | L on replicas | Replica reads trade freshness for latency |

        Read this table as defaults. Many stores are tunable per request, and that is the point to
        make.

        ## Using it in a round

        1. Name what goes wrong if the data is stale: a wrong balance, or a like count that is off by 3.
        2. Choose per data set, not per company. A ledger needs C. A feed can be A and L.
        3. Say what the user sees during a partition: an error, a retry, or old data.

        > [!trap] "We chose AP, so we have no consistency"
        > Eventual consistency still converges, and many AP stores give read-your-writes with session
        > settings. Say which guarantee you keep, not only which letter you dropped.

        > [!senior] Per-operation choices
        > "Balance reads and debits go to the strongly consistent path. The activity feed reads from
        > the nearest replica. One product, two choices." This shows you treat CAP as a per-operation
        > decision.
      `,
      checks: [
        {
          question: 'What does the "Else" half of PACELC add to CAP?',
          options: [
            'The choice between latency and consistency when there is no partition',
            'The choice between SQL and NoSQL',
            'The cost of storage',
            'Durability rules',
          ],
          answer: 0,
          why: 'With no partition, a system still trades latency for consistency, for example by waiting for remote replicas before it answers.',
        },
      ],
    },
    {
      slug: 'extracting-from-production',
      title: 'Read replicas, snapshots and safe extraction',
      summary:
        'Extract from an OLTP database without hurting it: full dumps, updated_at increments, replicas and log-based CDC, with the trap of each.',
      minutes: 16,
      body: `
        Most pipelines start by copying rows out of a production database. The senior concern is
        twofold: **do not hurt production**, and **do not miss or duplicate rows**.

        ## Four ways to extract

        | Method | How | Catches deletes | Load on source | Main trap |
        |---|---|---|---|---|
        | **Full snapshot** | «SELECT *» or a dump on a schedule | Yes, by diff | High, grows with the table | Cost and time grow forever |
        | **Query-based incremental** | «WHERE updated_at > :watermark» | No | Medium; needs an index | Missed rows, see below |
        | **Log-based CDC** | Read the WAL or binlog (Debezium, Datastream, DMS) | Yes | Low | Slots, schema changes, initial snapshot |
        | **Trigger or outbox** | The app or a trigger writes changes to a table | Yes | Adds write cost | Must be in the same transaction |

        ## Why updated_at increments miss rows

        ~~~text
        10:00:00.000  txn A starts, sets updated_at = 10:00:00.000, still open
        10:00:05.000  extractor runs: WHERE updated_at > 09:55 → A not visible yet
                      new watermark = 10:00:05
        10:00:06.000  txn A commits with updated_at = 10:00:00.000 → never extracted
        ~~~

        The timestamp is set when the row changes, but the row becomes visible at **commit**. Fixes:

        - Use an **overlap**: read from watermark minus a safety window (longer than your longest
          transaction) and deduplicate by key and version downstream.
        - Use a commit-ordered column, or move to log-based CDC, which reads in commit order.
        - Also: a column that the app forgets to update, and hard deletes, are both invisible.

        ## Use a replica, carefully

        Point extraction at a **read replica**, not the primary. Then:

        - **Replica lag:** read the replica's replay position and use it as the high watermark, not
          the primary's clock.
        - **Query conflicts:** on a Postgres hot standby, a long query can be cancelled when the
          replica must apply a vacuum change. «hot_standby_feedback = on» stops the cancels but bloats
          the primary. A dedicated replica for extraction keeps the trade-off away from the app's
          replicas.

        ## Consistent snapshots

        A full copy must be one point in time, or a join between two tables is wrong. «pg_dump»
        takes one snapshot for all tables. «mysqldump --single-transaction» does the same for
        InnoDB. Debezium's initial snapshot records the log position, then streams from exactly
        there, so nothing is lost between snapshot and stream.

        ## Chunk and throttle

        - Read in **primary-key ranges** («WHERE id > :last_id ORDER BY id LIMIT 50000»), never with
          «OFFSET».
        - Limit concurrency, run off-peak, and set a «statement_timeout».
        - Land the raw rows unchanged first, so a bug downstream never needs a second extract.

        > [!example] Backfill without a stampede
        > A two-year backfill of «orders» split into 2,000 key ranges, run 4 at a time on the
        > extraction replica, with a lag alarm that pauses the job if replica lag passes 30 seconds.

        > [!senior] Pick by deletes and freshness
        > "We need deletes and five-minute freshness on 300 tables, so log-based CDC from the
        > replica with an initial snapshot. For the two small reference tables a nightly full
        > snapshot is simpler and self-healing." Mixing methods by table is the mature answer.
      `,
      checks: [
        {
          question:
            'An updated_at incremental extract misses a few rows each day. Deletes are not the issue. What is the likely cause?',
          options: [
            'The index is missing',
            'Rows commit after the extractor has moved its watermark past their updated_at',
            'The replica is too fast',
            'The table has too many columns',
          ],
          answer: 1,
          why: 'A long transaction sets updated_at early but commits late. Read with an overlap window and deduplicate, or use log-based CDC.',
        },
        {
          question: 'Why paginate an extract by primary key ranges instead of OFFSET?',
          options: [
            'OFFSET is not valid SQL',
            'OFFSET re-reads and discards all earlier rows, so each page gets slower, and concurrent inserts shift pages',
            'Key ranges skip deleted rows',
            'Key ranges need no index',
          ],
          answer: 1,
          why: 'Keyset pagination seeks straight to the next key using the index, and it stays stable when rows are inserted.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'db-choose-store-for-locations',
    title: 'Pick stores for a driver location service',
    track: 'databases',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      Five million drivers send a GPS point every 4 seconds. The dispatch service needs each
      driver's latest position and the drivers near a point within 100 ms. Analysts need 90 days
      of history. Which stores do you use, and why?
    `,
    hints: [
      'There are three different access patterns here.',
      'Calculate the write rate first.',
      'Which data needs only the latest value?',
    ],
    answer: `
      **Size it:** 5,000,000 / 4 s = 1.25 million writes a second. At about 100 bytes a point,
      that is about 125 MB/s, or about 10 TB a day.

      Three access patterns, three stores:

      1. **Latest position by driver, and nearby drivers:** an in-memory key-value store (Redis
         or a custom service) keyed by driver id, plus a geo index by cell (H3 or S2 cells). Only
         the latest point is kept, with a short TTL so offline drivers expire. This is about
         5 million keys, small enough for memory.
      2. **Recent track per driver (minutes to hours):** a wide-column LSM store such as Cassandra
         or Bigtable, partition key «(driver_id, day)», clustering by timestamp, TTL of a few days.
         LSM handles the write rate; a bounded partition avoids huge rows.
      3. **Analytics history:** every point goes through Kafka to the lakehouse, partitioned by date
         and clustered by cell, for 90 days or more.

      The write path is: device → gateway → Kafka (keyed by driver id) → consumers update the
      cache and the wide-column store. Kafka decouples the stores and lets each one replay.
    `,
    signals: [
      'Calculates the write rate and daily volume',
      'Separates latest-value, recent-history and analytics patterns',
      'Uses an LSM or wide-column store for the high write rate',
      'Bounds partitions with a time bucket and TTL',
      'Puts Kafka in front so each store can rebuild',
    ],
    followUps: [
      'A city with 200,000 drivers becomes a hot spot in the geo index. What do you do?',
      'How do you serve "where was this driver during trip X" for support agents?',
    ],
  },
  {
    slug: 'db-read-explain-analyze',
    title: 'A dashboard query became slow after a bulk load',
    track: 'databases',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'uber', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      After a nightly bulk load of 40 million rows into «payments», a Postgres query that took
      200 ms now takes 6 minutes. Part of the plan:

      ~~~text
      Nested Loop  (rows=12) (actual rows=3100000 loops=1)
        -> Index Scan using payments_created_idx on payments
             (rows=12) (actual rows=3100000 loops=1)
             Index Cond: (created_at > '2026-11-06')
        -> Index Scan using merchants_pkey on merchants
             (rows=1) (actual rows=1 loops=3100000)
      ~~~

      What is wrong, and what do you do now and next time?
    `,
    hints: [
      'Compare estimated and actual rows.',
      'When were statistics last collected?',
      'What join would the planner pick for 3 million rows?',
    ],
    answer: `
      The planner estimated **12** rows from the scan and got **3.1 million**. For 12 rows a nested
      loop with an index lookup is ideal; for 3.1 million it means 3.1 million index lookups. The
      statistics do not know about the new rows, because the bulk load ran after the last
      «ANALYZE» and autovacuum had not caught up. The histogram's top bound is older than
      «2026-11-06», so the planner thinks almost no rows match.

      **Now:** run «ANALYZE payments». The estimate becomes about 3 million, and the planner picks
      a hash join with a sequential or bitmap scan.

      **Next time:**

      - Run «ANALYZE» as the last step of the bulk load job.
      - Tune autovacuum's analyze threshold for this large table (a scale factor of 0.1 on 2 billion
        rows waits for 200 million changes).
      - Alert on query duration so the next regression shows in minutes, not from a user.
      - Ask whether this dashboard should read the warehouse instead of the OLTP database.
    `,
    signals: [
      'Spots the gap between estimated and actual rows',
      'Links the gap to stale statistics after a bulk load',
      'Explains why the wrong estimate picked a nested loop',
      'Adds ANALYZE to the load job',
      'Questions running a dashboard on the OLTP database',
    ],
    followUps: [
      'ANALYZE fixes the estimate but the query is still slow at 3 million rows. What next?',
    ],
  },
  {
    slug: 'db-wallet-lost-update',
    title: 'Two refunds overdraw a wallet',
    track: 'databases',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      The wallet service runs this in Postgres at the default isolation level:

      ~~~sql
      BEGIN;
      SELECT balance FROM wallets WHERE wallet_id = 42;   -- returns 100
      -- application checks balance >= amount, then:
      UPDATE wallets SET balance = 100 - 80 WHERE wallet_id = 42;
      INSERT INTO ledger (wallet_id, amount) VALUES (42, -80);
      COMMIT;
      ~~~

      Two withdrawals of 80 run at the same moment. Both succeed and the ledger shows -160. Name
      the anomaly and fix it two ways.
    `,
    hints: [
      'What is the default isolation level in Postgres?',
      'Both transactions read 100.',
      'Can the check and the write be one statement?',
    ],
    answer: `
      This is a **lost update** under read committed. Both transactions read 100, both pass the
      check in the application, and both write 20. The ledger records two debits, but the balance
      shows only one.

      **Fix 1: one atomic, conditional statement.**

      ~~~sql
      UPDATE wallets
      SET balance = balance - 80
      WHERE wallet_id = 42 AND balance >= 80
      RETURNING balance;
      -- 0 rows returned → insufficient funds, roll back
      ~~~

      The second update waits for the row lock, then re-checks «balance >= 80» on the new value
      (20) and updates nothing.

      **Fix 2: lock the row you read.** «SELECT balance … FOR UPDATE» makes the second transaction
      wait until the first commits, then read 20.

      Optionally run at «REPEATABLE READ» or «SERIALIZABLE» and retry on serialization errors.
      In all cases, give each withdrawal an **idempotency key** with a unique constraint in the
      ledger, so a client retry does not debit twice.
    `,
    signals: [
      'Names the lost update anomaly',
      'Knows Postgres defaults to read committed',
      'Moves the check into one conditional UPDATE',
      'Knows SELECT FOR UPDATE as the locking alternative',
      'Adds an idempotency key for client retries',
    ],
    followUps: [
      'Now a rule says the sum of two linked wallets must stay above zero. Which anomaly can appear, and which level stops it?',
    ],
  },
  {
    slug: 'db-btree-or-lsm',
    title: 'B-tree or LSM for a metrics store',
    track: 'databases',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['google', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      A team stores service metrics: 2 million points a second, each read mostly in the first
      hour, and deleted after 30 days. They want to put it in Postgres. Which storage engine
      family fits better, and what do you watch out for?
    `,
    hints: ['Look at the read and write ratio.', 'How are old points removed?'],
    answer: `
      An **LSM-based** store (or a time-series database built on one) fits better.

      - 2 million writes a second of small rows is a write-dominated, append-only load. LSM
        turns it into sequential writes. A B-tree would do random page writes on its indexes and
        need heavy sharding.
      - Reads are recent and by series and time, which matches a key of «(series_id, time
        bucket)» with rows sorted by time.
      - Expiry: use a **TTL** or drop whole time-bucketed files or partitions. Row-by-row deletes
        would create millions of tombstones (LSM) or bloat (Postgres).

      Watch out for: write amplification from compaction (pick time-window compaction for
      time-series data), high-cardinality series ids, and read amplification for queries that
      span many series. If the team must use Postgres, partition by day and drop old partitions
      instead of deleting rows.
    `,
    signals: [
      'Reasons from the write-heavy, append-only pattern',
      'Chooses expiry by TTL or dropping partitions, not row deletes',
      'Mentions compaction strategy for time-series data',
      'Offers a partitioned Postgres fallback',
    ],
    followUps: ['Why does a time-window compaction strategy suit TTL data?'],
  },
  {
    slug: 'db-stale-replica-read',
    title: 'Riders see an old trip status',
    track: 'databases',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      Riders cancel a trip, then the app refreshes and shows it as still active for a few
      seconds. Writes go to a MySQL primary, reads to three async replicas behind a load
      balancer. Explain the bug and propose fixes, with their costs.
    `,
    hints: [
      'Which guarantee is missing?',
      'Can the read go somewhere else for a short time?',
      'Can the client carry a position?',
    ],
    answer: `
      The cancel committed on the primary, and the refresh read a replica that had not applied it
      yet. The app lacks **read-your-writes** consistency. Reads can even go backwards if two
      refreshes hit two replicas with different lag (no **monotonic reads**).

      Fixes, from simple to precise:

      1. **Read from the primary** for that rider for N seconds after their own write. Simple; it
         adds primary load, so keep N small and scoped to the user.
      2. **Sticky replica per session**, so a user's reads never go backwards. Fixes monotonic
         reads, not read-your-writes alone.
      3. **Wait for position:** return the write's GTID (or log position) to the client. A read
         sends it, and the replica waits until it has applied it (MySQL «WAIT_FOR_EXECUTED_GTID_SET»),
         or the router falls back to the primary.
      4. **Show the local state** in the app optimistically after the cancel succeeds.

      Also alert on replica lag, because lag turns a rare glitch into a common one.
    `,
    signals: [
      'Names read-your-writes and monotonic reads',
      'Gives a primary-read window with its cost',
      'Knows the wait-for-GTID or log position approach',
      'Mentions lag monitoring',
    ],
    followUps: [
      'How would a CDC pipeline reading from these replicas be affected by the same lag?',
    ],
  },
  {
    slug: 'db-shard-trips-table',
    title: 'Shard the trips table',
    track: 'databases',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      The «trips» table is 40 TB on one MySQL primary and writes peak at 60,000 a second. The
      main queries are: get a trip by id; list a rider's last 50 trips; list a driver's trips
      today; and city operations dashboards. Choose a shard key and explain how each query is
      served.
    `,
    hints: [
      'No single key serves all four queries.',
      'Which queries are user-facing and which are analytical?',
      'How do you find the shard from a trip id?',
    ],
    answer: `
      **Shard by rider id (hashed)**, with about 4,096 logical shards mapped onto physical nodes
      (for example with Vitess), so rebalancing moves whole logical shards.

      - **Trip by id:** make the trip id carry the shard. Either embed the logical shard number in
        the id, or keep a small «trip_id → rider_id» lookup table. One shard is read.
      - **Rider's last 50 trips:** single shard, index on «(rider_id, requested_at)».
      - **Driver's trips today:** a driver's trips are spread across rider shards, so this would
        fan out. Keep a second, **driver-keyed copy** maintained by CDC from the trip shards, and
        accept seconds of lag.
      - **City dashboards:** never on the OLTP shards. CDC to Kafka, then a real-time OLAP store
        (Pinot or Druid) and the lakehouse.

      Why rider, not city: city would make New York or São Paulo a hot shard, and it does not
      match the user-facing query. Why not trip id alone: the rider history query would fan out.

      Migration: dual-write or CDC into the new shards, backfill by key ranges, compare counts
      and checksums, then switch reads, then writes.
    `,
    signals: [
      'Picks the key from the user-facing access pattern',
      'Uses many logical shards mapped to fewer nodes',
      'Routes trip-id lookups with an encoded id or lookup table',
      'Serves the second access pattern with a CDC-fed copy',
      'Keeps analytics off the OLTP shards',
      'Plans a verified migration',
    ],
    followUps: [
      'One rider is a corporate account with 3 million trips. What happens to its shard?',
      'How do you run a cross-shard transaction for a split fare?',
    ],
  },
  {
    slug: 'db-cap-per-feature',
    title: 'Consistency choices for a wallet and a feed',
    track: 'databases',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'uber', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      A super-app runs in three regions. It has a wallet (balances and payments) and a social
      feed (posts and likes). Using CAP and PACELC, say what each feature should choose during a
      network partition and during normal running, and what the user sees.
    `,
    hints: ['What does a stale read cost in each feature?', 'PACELC has a normal-case half.'],
    answer: `
      **Wallet: PC / EC.** A stale balance can approve a payment twice. During a partition, a
      region that cannot reach the leader or a quorum must refuse debits or queue them as
      pending; the user sees "payment pending, try again". Normally, the wallet pays cross-region
      commit latency (for example with Spanner or a single home region per wallet with
      synchronous replicas) for correctness. Reads of one's own balance can use a cheaper path,
      but debits must be checked against the leader.

      **Feed: PA / EL.** A like count that is off by a few, or a post that appears seconds late,
      costs almost nothing. During a partition, each region keeps serving and accepting writes;
      replicas converge later (counters merge as sums, not last-writer-wins). Normally, reads
      come from the nearest replica for low latency. Keep read-your-writes for the author so
      their own post shows at once.

      One product, two choices: the decision is made per operation, by the cost of being wrong.
    `,
    signals: [
      'States CAP as a choice during a partition',
      'Uses PACELC for the normal-case latency trade-off',
      'Chooses per feature by the cost of stale data',
      'Describes what the user sees',
      'Mentions mergeable counters or read-your-writes for the feed',
    ],
    followUps: ['How do you reconcile like counts written in two regions during a partition?'],
  },
  {
    slug: 'db-extract-orders-safely',
    title: 'Extract a 2 TB orders table every night',
    track: 'databases',
    kind: 'design',
    difficulty: 'medium',
    companies: ['google', 'uber', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      A nightly job runs «SELECT * FROM orders» on the Postgres primary. The table is 2 TB, the
      job takes 7 hours, and checkout latency rises while it runs. Orders are updated for 30
      days after creation and sometimes deleted. Redesign the extraction.
    `,
    hints: [
      'Why does a long query on the primary hurt beyond CPU?',
      'Updates and deletes rule out one method.',
      'How do you start the new method without a gap?',
    ],
    answer: `
      Problems today: the 7-hour query holds one snapshot, which blocks vacuum and bloats hot
      tables, and it competes with checkout for I/O and cache. Its cost also grows with the
      table forever.

      **Move to log-based CDC:**

      1. Enable logical decoding and run Debezium (or a managed CDC service) from the primary's
         WAL, publishing to Kafka with the order id as key.
      2. Do an **initial snapshot** that records the log position, then stream from that position,
         so there is no gap and no overlap.
      3. Land the change events raw in bronze. Build the silver «orders» table with a «MERGE» by
         order id, applying deletes as soft-delete flags or removals.
      4. Monitor slot lag in bytes, cap it with «max_slot_wal_keep_size», and alert before disk
         risk.

      Why not «updated_at» increments: deletes are invisible, and long transactions can be
      missed. If CDC is not allowed, use the incremental query on a dedicated replica with an
      overlap window, keyset pagination, and a weekly full reconciliation by count and checksum
      per day.
    `,
    signals: [
      'Explains vacuum and snapshot cost of long queries on the primary',
      'Chooses log-based CDC because of updates and deletes',
      'Starts from a snapshot with a recorded log position',
      'Applies changes with a MERGE by key',
      'Monitors replication slot lag',
      'Gives a replica-based fallback with reconciliation',
    ],
    followUps: ['A column is renamed in the source. What happens to your CDC pipeline?'],
  },
  {
    slug: 'db-watermark-misses-rows',
    title: 'The incremental extract misses rows',
    track: 'databases',
    kind: 'concept',
    difficulty: 'hard',
    companies: ['google', 'amazon', 'flipkart', 'phonepe'],
    prompt: `
      An hourly job extracts «WHERE updated_at > :last_max_updated_at» from a MySQL replica and
      saves the largest «updated_at» it saw as the next watermark. A weekly reconciliation finds
      about 0.01% of changed rows missing in the warehouse. List every cause you can think of
      and how to fix each.
    `,
    hints: ['When does a row become visible?', 'Who sets updated_at?', 'Clocks and precision.'],
    answer: `
      Causes and fixes:

      1. **Late commits.** A transaction sets «updated_at» at statement time but commits later.
         The extractor has already moved past it. Fix: read from watermark minus a window longer
         than the longest transaction, and deduplicate by key and «updated_at».
      2. **Replica lag.** If the watermark comes from anything other than the rows the replica
         returned, rows still in flight are skipped. Fix: derive the watermark only from extracted
         rows, and also cap it at the replica's replay time.
      3. **Writes that skip updated_at.** Bulk SQL fixes, admin tools or a trigger-less column. Fix:
         a database default «ON UPDATE CURRENT_TIMESTAMP», and a contract with the source team.
      4. **Precision and ties.** Seconds precision with «>» drops rows that share the boundary
         second. Fix: use «>=» with deduplication, or microsecond precision.
      5. **Clock differences** between app servers that set the value. Fix: let the database set it.
      6. **Deletes** are never seen. Fix: soft deletes in the source, or CDC.

      The structural fix is log-based CDC, which reads in commit order and includes deletes.
      Keep the reconciliation either way.
    `,
    signals: [
      'Explains late commits versus statement time',
      'Uses an overlap window with deduplication',
      'Considers replica lag in the watermark',
      'Mentions boundary precision and >= versus >',
      'Notes deletes and writers that skip the column',
      'Recommends CDC and keeps reconciliation',
    ],
    followUps: ['How long should the overlap window be, and how do you measure it?'],
  },
];
