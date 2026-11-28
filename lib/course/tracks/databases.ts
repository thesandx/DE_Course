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
      minutes: 16,
      body: `
        ## Start with the problem

        Ask "which database is best?" and you get a fight. The question has no answer, because every
        database makes some things cheap by making other things expensive. A dictionary is perfect for
        "what does this word mean?" and useless for "which words appear in this book?". A database is
        the same.

        A data engineer reads from every kind of database and must explain why a team picked it. So
        the real question is: **which access pattern does this store make cheap, and what does it make
        expensive?**

        ## Idea 1: one shelf per job (the families)

        Read each family as "good at" and "bad at".

        - **Relational (OLTP):** Postgres, MySQL, SQL Server, Oracle. Good at point reads and writes
          by key, joins, and transactions across rows. Bad at scans over billions of rows, and at
          spreading writes over many machines.
        - **Distributed SQL (NewSQL):** Spanner, CockroachDB, YugabyteDB, TiDB. Good at SQL and
          transactions with writes spread over many nodes. Bad at cross-region commit latency, and
          cost.
        - **Key-value:** DynamoDB, Redis, RocksDB. Good at get and put by key, at any scale, with
          predictable latency. Bad at any query that is not by key.
        - **Document:** MongoDB, Firestore, Couchbase. Good at reading a whole nested object in one
          call, with a flexible schema. Bad at joins, many-to-many relations and cross-document rules.
        - **Wide-column:** Cassandra, ScyllaDB, Bigtable, HBase. Good at very high write rates and
          range reads inside one partition key. Bad at ad hoc filters, secondary indexes and
          read-modify-write.
        - **Graph:** Neo4j, Neptune, Spanner Graph. Good at multi-hop traversals (friends of friends,
          fraud rings). Bad at wide aggregations.
        - **Search:** Elasticsearch, OpenSearch, Solr. Good at full-text relevance and faceted
          filters. Bad at strong consistency, joins, and being a source of truth.
        - **Time-series:** TimescaleDB, InfluxDB, Prometheus. Good at appending by time,
          downsampling and recent-window queries. Bad at updating old points, and high-cardinality
          labels.
        - **OLAP (columnar):** BigQuery, Snowflake, ClickHouse, Pinot, Druid. Good at aggregates over
          billions of rows and a few columns. Bad at single-row updates and high-rate point lookups.

        ## Idea 2: "SQL versus NoSQL" is the wrong question

        "NoSQL" grouped stores that dropped joins and multi-row transactions so they could spread
        writes across machines. That trade has moved. Spanner and CockroachDB scale SQL with
        transactions, and DynamoDB and MongoDB now offer multi-item transactions. So compare stores on
        these five questions instead:

        1. **Data model:** tables with a fixed schema, nested documents, or opaque values?
        2. **Query flexibility:** ad hoc SQL, or only by the key you designed for?
        3. **Consistency:** strong by default, tunable, or eventual?
        4. **Scale model:** one primary with replicas, or writes partitioned over many nodes?
        5. **Storage engine:** B-tree (read-optimised) or LSM-tree (write-optimised)? The next
           lessons explain both.

        ## Idea 3: rows together, or columns together

        Picture a spreadsheet printed two ways. In one, each card holds **one whole row**. In the
        other, each card holds **one whole column**.

        - To fetch "order 42", the row cards win: one card has everything. That is an OLTP **row
          store**: one page read.
        - To "sum revenue for 3 billion rows", the column cards win: read only the revenue card,
          compressed, and skip the rest. That is a **column store**.

        This is why a pipeline copies data **out** of Postgres into BigQuery, instead of running
        dashboards on the app's primary database.

        > [!example] Uber-shaped stack
        > Trips are written to a sharded OLTP store, driver locations to a key-value store with a short
        > TTL, events to Kafka, history to a lakehouse, and city dashboards to a real-time OLAP store
        > such as Pinot. Each store has one job. The data engineer owns the copies.

        ## Now say it like a senior engineer

        > [!senior] Say the access pattern first
        > A strong answer: "Writes are 50,000 a second by device id and reads are the last hour for one
        > device, so I want a wide-column or key-value store with device id as the partition key.
        > Analysts get a copy in the warehouse." Naming a product before the access pattern is the
        > mid-level answer.

        ## In one breath

        Every database makes some access patterns cheap and others expensive, so start from the access
        pattern, not the product name. Row stores fetch one record fast; column stores add up billions;
        real systems use several and copy between them.
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
      minutes: 17,
      body: `
        ## Start with the problem

        A query that took 2 seconds yesterday takes an hour today. Nobody changed the SQL. What
        changed is how the database **decided to run it**. To fix it, you need to know how a database
        turns your SQL text into work, and where that decision can go wrong.

        The good news: every engine, from Postgres to Spark to BigQuery, runs the same pipeline. Learn
        it once, and you can reason about any slow query.

        ## Idea 1: from text to work, in five steps

        Think of a kitchen getting an order slip.

        1. **Parse:** read the slip and check it is written correctly. The result is a syntax tree.
        2. **Analyse:** check that every dish exists on the menu. Names are resolved against the
           catalog, and types are checked.
        3. **Rewrite:** expand "the usual" into its real dishes. Views are expanded, and rules applied.
        4. **Plan:** the head chef thinks of several ways to cook it and estimates the cost of each,
           using table statistics.
        5. **Execute:** the cheapest plan runs, as a tree of operators.

        ~~~text
        SQL text
         → parse
         → analyse
         → rewrite
         → plan (pick cheapest)
         → execute
        ~~~

        ## Idea 2: how to read a table (access paths)

        - **Seq Scan:** read the whole table. Picked when you need a large share of it, or when no
          index helps.
        - **Index Scan:** a selective filter on an indexed column. Read the index, then fetch each
          matching row from the table (the heap).
        - **Index Only Scan:** every needed column is in the index, and the visibility map is
          current, so the table is never touched.
        - **Bitmap Heap Scan:** medium selectivity. Collect all matching row ids first, then read the
          pages in order, so each page is read once.

        ## Idea 3: how to join two tables (join algorithms)

        - **Nested loop:** for each row on the small outer side, look up matches through an index on
          the inner side. Cost: outer rows times one index lookup. Great when the outer side is tiny;
          terrible when it is not.
        - **Hash join:** build a hash table from one input, then probe it with the other. Good for two
          large inputs with an equality condition, when the build side fits in memory.
        - **Merge join:** both inputs sorted on the key, then one linear pass, like merging two sorted
          piles of cards. Good when the inputs are already sorted.

        ## Idea 4: the plan is only as good as the guess

        The optimiser does not run the plans to compare them. It **estimates** how many rows leave
        each step, from statistics: row counts, distinct values, most common values and histograms.
        «ANALYZE» refreshes them.

        Now the failure. If the estimate says 2,000 rows, a nested loop looks cheap: 2,000 index
        lookups. If the truth is 2 million, that same plan does a million lookups, and the query takes
        an hour.

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
        That 880-times error is the bug. Stale statistics after a bulk load are the usual cause, so run
        «ANALYZE trips» first.

        > [!tip] Correlated columns fool the planner
        > «city = 'SF' AND state = 'CA'» looks twice as selective as it is, because the planner assumes
        > the columns are independent. In Postgres, «CREATE STATISTICS» on both columns fixes the
        > estimate.

        ## Idea 5: how operators pass rows (execution models)

        - **Iterator (Volcano):** each operator pulls one row at a time from its child. Simple, but
          the per-row function calls cost a lot on analytical work.
        - **Vectorised:** operators pass batches of about 1,000 to 2,000 values, which suits CPU
          caches and SIMD. DuckDB, ClickHouse, Snowflake and Databricks Photon work this way.
        - **Code generation:** the plan compiles into one tight loop. Spark whole-stage codegen and
          HyPer-style engines do this.

        ## Now say it like a senior engineer

        > [!senior] Estimates versus actuals
        > The senior habit is to compare estimated and actual rows on every node, and find the first
        > large gap from the bottom. Adding an index before you find that gap is guessing.

        ## In one breath

        Every engine parses, plans from row-count guesses, then executes the cheapest plan. When a
        query suddenly slows down, find the first node where the guessed rows and the actual rows
        differ, and fix the guess.
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
      minutes: 18,
      body: `
        ## Start with the problem

        Two phones try to pay from the same wallet at the same moment. Both read the balance: 100.
        Both subtract 30. Both write 70. The rider paid twice, and the wallet only went down once.

        Bugs like this happen inside the source systems a data engineer reads from: double-charged
        payments, negative balances, and rows a CDC stream misses. A senior data engineer can **name
        the anomaly** and the fix. This lesson builds the words you need.

        ## Idea 1: what a transaction promises (ACID)

        A **transaction** is a group of writes the database treats as one unit. ACID names its four
        promises.

        - **Atomicity:** all the writes happen, or none. A bank transfer never takes money out
          without putting it in. The undo or log makes it so.
        - **Consistency:** the database moves from one valid state to another. Constraints help, but
          this letter is mostly the application's job.
        - **Isolation:** concurrent transactions do not see each other's half-done work, to the level
          you choose.
        - **Durability:** after commit, a crash does not lose the write. The WAL plus «fsync» do this.

        ## Idea 2: the five ways concurrency goes wrong (anomalies)

        - **Dirty read:** you read another transaction's write that is not committed yet. It may roll
          back, and you used a value that never existed.
        - **Non-repeatable read:** you read the same row twice and get two values.
        - **Phantom:** you run a range query twice and new rows appear.
        - **Lost update:** two read-modify-write cycles race, and one overwrite is lost. The wallet
          story above.
        - **Write skew:** two transactions read the same data, then each writes a **different** row,
          and together they break a rule. Example: two doctors each see "another doctor is on call"
          and both go off call.

        ## Idea 3: isolation levels, from loose to strict

        Stricter isolation prevents more anomalies, but costs more waiting or more aborted
        transactions.

        | Level | Prevents | Default in |
        |---|---|---|
        | Read committed | Dirty reads | Postgres, Oracle, SQL Server |
        | Repeatable read / snapshot | Non-repeatable reads, most phantoms | MySQL InnoDB |
        | Serializable | All of the above | CockroachDB, Spanner |

        Postgres "repeatable read" is snapshot isolation. It aborts a lost update with a serialization
        error, but it still allows write skew. Only «SERIALIZABLE» (SSI in Postgres) stops write skew.

        ~~~sql
        -- Lost update under read committed: both sessions read 100, both write 100 - 30.
        -- Fix 1: an atomic statement
        UPDATE wallets SET balance = balance - 30 WHERE wallet_id = 7 AND balance >= 30;
        -- Fix 2: lock the row you read
        SELECT balance FROM wallets WHERE wallet_id = 7 FOR UPDATE;
        ~~~

        ## Idea 4: readers do not wait for writers (MVCC)

        If every reader had to wait for every writer, a busy database would crawl. So databases keep
        **several versions** of a row. Each transaction gets a snapshot, like a photo taken when it
        started, and reads the versions that were committed at that moment. A writer can create a new
        version while a reader still looks at the old one. That is **multi-version concurrency control
        (MVCC)**.

        - **Postgres** writes a new row version on every update. Hidden columns «xmin» and «xmax» say
          which transactions can see it. «VACUUM» removes dead versions later. A transaction left open
          for hours stops vacuum, and the table bloats.
        - **MySQL InnoDB** updates in place, and keeps old versions in the undo log. A long
          transaction makes the undo history grow instead.

        ## Idea 5: write the diary first (the write-ahead log)

        Writing a change into the right place in a data file is slow, because it is random disk access.
        Appending a line to the end of a log is fast. So the database does the fast thing first.

        Before a change reaches a data page, the database appends it to the **write-ahead log** (WAL
        in Postgres, redo log plus binlog in MySQL). "Committed" means "the log record is safely on
        disk". After a crash, the database replays the log. The data pages are written later, at
        checkpoints.

        ~~~text
        COMMIT
         → append to WAL
         → fsync WAL
         → reply "committed"
        later: checkpoint writes
               pages to data files
        ~~~

        And here is the link to data engineering. The log is an **ordered list of every committed
        change**, so it also feeds **replicas** and **CDC**. Debezium reads Postgres logical decoding
        («wal_level = logical», with a replication slot) or the MySQL binlog in row format.

        > [!trap] A replication slot can fill the disk
        > A Postgres slot keeps WAL until its consumer confirms it. If the CDC connector stops for a
        > weekend, WAL piles up on the primary until the disk is full. Alert on slot lag in bytes, and
        > set «max_slot_wal_keep_size».

        ## Now say it like a senior engineer

        > [!senior] Connect it to the pipeline
        > "A long analytical query on the primary holds a snapshot, blocks vacuum and bloats hot tables,
        > so we extract from a replica or from the WAL." That sentence joins MVCC, WAL and extraction
        > design, which is the staff-level link interviewers want.

        ## In one breath

        A transaction is all or nothing; isolation levels decide which concurrency anomalies you allow.
        MVCC lets readers use a snapshot instead of waiting, and the write-ahead log makes commits
        durable and doubles as the change feed for replicas and CDC.
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
      minutes: 15,
      body: `
        ## Start with the problem

        Postgres is great at reading by key, but struggles to take a million writes a second.
        Cassandra takes a million writes a second, but a read can be slow. Why? Almost every database
        stores its data in one of two structures, and each structure is fast at a different thing.
        Know both, and you can predict how a database behaves before you use it.

        ## Idea 1: the B-tree is a well-organised filing cabinet

        Picture a filing cabinet with drawers labelled by name range, folders inside the drawers, and
        papers inside the folders. To find "Sharma", you open one drawer, one folder, one paper.

        A **B-tree** (strictly, a B+tree) is that cabinet.

        - Data lives in fixed-size **pages**: 8 KB in Postgres, 16 KB in InnoDB.
        - Inner pages hold keys and pointers to child pages. Leaf pages hold rows (or row pointers),
          and link to their neighbours for range scans.
        - Each page points to a few hundred children, so **3 or 4 levels cover billions of rows**. A
          lookup reads about 4 pages, and the top levels are usually in memory.

        The catch is writes. A B-tree **updates pages in place**. Change one small row, and the whole
        8 KB page is rewritten (plus the WAL record). Many small random writes mean a lot of disk I/O.
        Reads stay predictable: always one path from root to leaf.

        ## Idea 2: the LSM-tree is an inbox that gets sorted later

        Now picture a busy office. New papers go straight into an inbox tray: very fast. When the tray
        is full, someone sorts it and files it as a bundle. At night, bundles are merged into bigger
        sorted bundles.

        A **log-structured merge (LSM) tree** works the same way.

        ~~~text
        write → WAL + memtable
        memtable full
         → flush sorted file
           (SSTable, level 0)
        background compaction
         → merge into bigger,
           non-overlapping levels
        read → memtable, then
           each level, newest first
        ~~~

        - Writes are **sequential appends**, so write throughput is very high.
        - A read may have to check several files. **Bloom filters** answer "this key is surely not in
          this file" for most files, and the block cache keeps hot data in memory.
        - A delete writes a **tombstone** (a "this is deleted" marker). The space comes back only
          after compaction merges it away.

        RocksDB, Cassandra, ScyllaDB, HBase, Bigtable, and the storage layer of CockroachDB and TiDB
        all use LSM-trees.

        ## Idea 3: the three costs (amplifications)

        Every engine pays three kinds of overhead. "Amplification" means "how much more work than the
        data itself".

        - **Write amplification.** B-tree: high for small random writes, because whole pages are
          rewritten. LSM: data is rewritten again at each compaction level.
        - **Read amplification.** B-tree: low, one root-to-leaf path. LSM: higher, several files,
          helped by bloom filters.
        - **Space amplification.** B-tree: pages are partly empty after splits. LSM: old versions and
          tombstones wait for compaction.

        ## Idea 4: how LSM stores merge (compaction strategies)

        - **Leveled** (the RocksDB default): each level is about 10 times the previous one, and files
          in a level do not overlap. Lower read and space cost, higher write cost.
        - **Size-tiered** (the classic Cassandra default): merge files of similar size. Cheaper
          writes, but reads touch more files, and a compaction can briefly need twice the space.

        > [!trap] Tombstones in a queue-like table
        > Using Cassandra as a queue (insert, read, delete) builds up tombstones. A read then scans
        > thousands of them and times out. Model time buckets with a TTL, or use a real queue.

        ## Now say it like a senior engineer

        > [!senior] Match the engine to the ratio
        > "Device telemetry is 95 percent writes and reads the recent window by device, so an LSM store
        > fits. The order service reads by key ten times more than it writes and needs transactions, so
        > a B-tree database fits." Tie the engine to the read and write ratio.

        ## In one breath

        A B-tree is a filing cabinet: fast, predictable reads, but each small write rewrites a page. An
        LSM-tree is an inbox sorted later: very fast writes, reads that check several files, and space
        that returns only after compaction.
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
      minutes: 17,
      body: `
        ## Start with the problem

        A rider changes their home address and taps Save. The app reloads, and the old address is
        still there. They tap Save again. Still old. Then, a second later, the new one appears.

        Nothing was lost. The write went to one copy of the database, and the read came from another
        copy that had not caught up yet. That is **replication**: copying data to more machines for
        availability, read scale and closeness to users. It is also where stale reads come from, and
        they confuse pipelines and dashboards as much as riders.

        ## Idea 1: who accepts writes (three topologies)

        - **Single leader.** All writes go to one primary; the followers apply its log. Examples:
          Postgres, MySQL, MongoDB replica sets, Kafka partitions. Main risk: failover, and replica
          lag.
        - **Multi-leader.** Each region accepts writes, and the leaders exchange changes. Examples:
          multi-region MySQL setups, CouchDB. Main risk: two regions change the same row, and you
          need a rule to resolve the conflict.
        - **Leaderless.** The client writes to several replicas and reads from several. Examples:
          Cassandra, ScyllaDB, DynamoDB internals. Main risk: consistency is tunable, but subtle.

        ## Idea 2: wait for the copy, or not

        When the leader commits, does it wait for a follower to have the change?

        - **Synchronous:** wait. No data loss on failover, but one slow follower slows every write.
        - **Asynchronous:** do not wait. Fast, but a failover can lose the last few seconds, and
          followers lag.
        - **Semi-synchronous:** wait for one follower out of several. A common middle ground.

        ## Idea 3: what a reader is promised (consistency models)

        From strongest to weakest:

        - **Linearizable:** every read sees the latest committed write, as if there were only one
          copy.
        - **Sequential / causal:** everyone sees causally related writes in the same order. A reply
          never appears before the question.
        - **Read-your-writes:** you always see your own writes. This is the one the address story
          broke.
        - **Monotonic reads:** you never see time go backwards across your reads.
        - **Eventual:** if writes stop, the replicas converge. No promise about any single read.

        ## Idea 4: overlapping votes (quorums in leaderless stores)

        With N copies, a write waits for W of them to confirm, and a read asks R of them. If
        **R + W > N**, the set you read from always overlaps the set that has the latest write. So at
        least one answer is fresh.

        Example with N = 3: «QUORUM» writes and reads mean W = 2 and R = 2. 2 + 2 = 4, which is more
        than 3, so they overlap. «ONE» and «ONE» means 1 + 1 = 2: fast, but a read can miss the
        latest write. Read repair and anti-entropy fix stale replicas in the background.

        ## Idea 5: changing leaders safely (failover)

        When a leader dies, a follower is promoted. If the old leader comes back and still thinks it
        leads, you have two leaders writing: **split brain**, and the data diverges. Systems prevent
        it with fencing tokens, leases or consensus (Raft in etcd, CockroachDB and Kafka KRaft; Paxos
        in Spanner), so only one leader can write.

        > [!example] The stale profile
        > The address write went to the primary and the read went to a lagging replica. Fixes: read
        > from the primary for a few seconds after a user's own write, or pin the session to a replica
        > that has reached the write's log position.

        ## Now say it like a senior engineer

        > [!senior] Pipelines read replicas too
        > An extraction job on an async replica sees a slightly old snapshot. That is fine if the job
        > records the replica's log position as its watermark. It is a bug if the job uses "now" from
        > the primary as the watermark, and skips rows the replica has not received yet.

        ## In one breath

        Replication keeps copies, and copies lag, so every read has a promise: from "always the
        latest" down to "eventually". Quorums overlap reads and writes (R + W > N), and failover needs
        a way to make sure only one leader writes.
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
      minutes: 16,
      body: `
        ## Start with the problem

        Your trips table no longer fits on one machine, and one machine cannot take all the writes.
        So you split the data into pieces, called **partitions** or **shards**, and spread them over
        many machines.

        Easy to say. But now every row needs a home, and every query must know where to look. The
        rule that picks the home is the **partition key**. It is the most important decision in the
        design, because it is the hardest one to change later.

        ## Idea 1: two ways to pick a home (range or hash)

        Think of a library deciding which shelf a book goes on.

        - **Range:** shelve by title, A to F on shelf 1, G to M on shelf 2. Great for "all books
          starting with K" (range scans, ordered reads). Bad when keys arrive in order, such as
          timestamps: every new book lands on the last shelf. That is a **hot spot**.
        - **Hash:** run the title through a hash, and the number picks the shelf. Writes spread
          evenly. But "all books starting with K" now means visiting every shelf.
        - **Compound:** hash on the first part of the key, sort on the second part. Even writes, and
          ordered reads inside one key. Queries without the first part must ask every shelf.

        Cassandra's primary key «((device_id), event_ts)» is compound: the device id picks the
        partition, and inside it rows are sorted by time.

        ## Idea 2: adding a machine without moving everything (consistent hashing)

        Plain «hash mod N» has a nasty surprise. Go from 10 machines to 11, and «hash mod 11» sends
        almost every key somewhere new. Nearly all the data moves.

        **Consistent hashing** fixes this. Put the machines on a clock face (a ring). Hash each key to
        a point on the ring, and walk clockwise to the first machine. Add a machine, and it only takes
        the keys between itself and its neighbour: about 1/N of the keys move.

        **Virtual nodes** give each machine many points on the ring, so the load evens out, and a new
        machine takes a little from everyone.

        ~~~text
        key k
         → hash(k)
         → point on the ring
         → walk clockwise
         → first vnode
         → its machine
        ~~~

        ## Idea 3: one key that is too popular (hot keys)

        Even hashing fails when one key is hot: a celebrity account, a default value, «NULL». All its
        traffic goes to one machine, no matter how good the hash is.

        - **Salt the key:** write to «key#0» … «key#9», and read all ten.
        - **Split the hot partition:** DynamoDB and Bigtable split busy ranges automatically.
        - **Cache reads** in front of the store.

        ## Idea 4: looking up by another column (secondary indexes)

        Data is sharded by rider. Now you want "all trips in Pune".

        - **Local index:** each shard indexes its own rows. Writes stay cheap, but a query by city
          asks every shard and merges the answers (scatter and gather).
        - **Global index:** the index itself is partitioned by city. A read goes to one place, but a
          write touches the row's shard and the index shard, usually asynchronously.

        ## Idea 5: moving data when the cluster grows (rebalancing)

        - **Fixed number of partitions**, many more than the nodes (for example 1,000 partitions for
          10 nodes). Rebalancing moves whole partitions. Kafka, Elasticsearch and Cassandra vnodes
          use this idea.
        - **Dynamic splitting:** a partition splits when it grows past a size. HBase, Bigtable,
          MongoDB chunks and Spanner splits work this way.
        - Either way, throttle the data movement, because rebalancing competes with live traffic.

        > [!trap] Time as the leading key
        > A range-partitioned table keyed by «created_at» sends every new write to the last partition.
        > Lead with a hashed or high-cardinality column, and keep time as a sort key.

        ## Now say it like a senior engineer

        > [!senior] Name the queries that fan out
        > A strong answer names which queries hit one shard and which hit all of them: "Trips are
        > sharded by city, so city dashboards are single-shard, but a rider's history fans out. I will
        > keep a rider-keyed copy in a second store fed by CDC."

        ## In one breath

        The partition key decides which machine each row lives on: range keeps order but makes hot
        spots, hash spreads load but scatters range queries. Consistent hashing moves only a slice of
        the keys when you add a machine, and hot keys need salting or caching.
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
      minutes: 13,
      body: `
        ## Start with the problem

        You have two copies of a bank balance, one in Mumbai and one in Delhi. The cable between them
        is cut. A customer in Delhi asks for their balance. A customer in Mumbai withdraws money at the
        same moment.

        The Delhi copy has two choices. Answer with the balance it has, which may now be wrong. Or
        refuse to answer until the cable is fixed. There is no third option. That choice is the whole
        of the **CAP theorem**, the most quoted and most misquoted idea in distributed systems.
        Interviewers use it to test whether you understand trade-offs or only repeat a slogan.

        ## Idea 1: CAP, said precisely

        In a replicated system, a **network partition** can stop nodes from talking. During that
        partition, the system must choose:

        - **Consistency (C):** linearizable reads, so every read sees the latest write. Some requests
          are refused. Delhi says "try again later".
        - **Availability (A):** every request to a working node gets a non-error answer, which may be
          stale. Delhi shows the old balance.

        You will hear "pick two of three". That is misleading, because partitions are not optional in a
        real network; you cannot "pick" not to have them. The real statement is: **when a partition
        happens, choose C or A.**

        ## Idea 2: the choice you make every normal day (PACELC)

        Cables are rarely cut. So what does CAP say about a normal Tuesday? Nothing. Daniel Abadi
        added the missing half.

        **PACELC:** if **P**artition, choose **A** or **C**; **E**lse, choose **L**atency or
        **C**onsistency.

        On a normal day, keeping Mumbai and Delhi in agreement means waiting for the other city before
        you answer. That wait is latency. Most of the time there is no partition, so the trade-off you
        live with daily is latency against consistency.

        | System | Partition | Normally |
        |---|---|---|
        | Spanner | C | C |
        | CockroachDB | C | C |
        | DynamoDB | A (default) | L |
        | Cassandra | A | L |
        | MongoDB | C (majority) | C or L |
        | Postgres + async replicas | C on primary | L on replicas |

        Notes on the table:
        - Spanner pays commit latency for global consistency. CockroachDB uses Raft per range.
        - DynamoDB offers strongly consistent reads as an option, at a higher cost.
        - Cassandra is tunable per query: «QUORUM» moves it toward C.
        - MongoDB depends on its read and write concerns.
        - Postgres replica reads trade freshness for latency.

        Read the table as defaults. Many stores are tunable per request, and that is the point to make.

        ## Idea 3: using it in a design round

        1. Name what goes wrong if the data is stale: a wrong balance, or a like count that is off by 3.
        2. Choose per data set, not per company. A ledger needs C. A feed can be A and L.
        3. Say what the user sees during a partition: an error, a retry, or old data.

        > [!trap] "We chose AP, so we have no consistency"
        > Eventual consistency still converges, and many AP stores give read-your-writes with session
        > settings. Say which guarantee you keep, not only which letter you dropped.

        ## Now say it like a senior engineer

        > [!senior] Per-operation choices
        > "Balance reads and debits go to the strongly consistent path. The activity feed reads from
        > the nearest replica. One product, two choices." This shows you treat CAP as a per-operation
        > decision.

        ## In one breath

        When the network splits, each copy must either refuse (consistency) or answer with what it
        has (availability). On normal days the same trade-off shows up as latency, and you choose it
        per operation, not per company.
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
      minutes: 17,
      body: `
        ## Start with the problem

        Most pipelines start by copying rows out of a production database. The first attempt is
        usually «SELECT * FROM orders» every night. Then the table grows to 2 billion rows, the copy
        takes nine hours, and the app slows down every night while it runs. Someone switches to "only
        rows changed since last time", and three weeks later finance finds orders missing.

        So a senior engineer has two worries, always together: **do not hurt production**, and **do
        not miss or duplicate rows**.

        ## Idea 1: four ways to copy

        - **Full snapshot:** «SELECT *» or a dump on a schedule. Catches deletes (by comparing with
          the last copy). Load on the source is high and grows with the table, forever.
        - **Query-based incremental:** «WHERE updated_at > :watermark». Load is medium, and needs an
          index. Does **not** catch deletes, and can miss rows (Idea 2).
        - **Log-based CDC:** read the WAL or binlog (Debezium, Datastream, DMS). Catches deletes, and
          load on the source is low. Traps: replication slots, schema changes, the initial snapshot.
        - **Trigger or outbox:** the app or a trigger writes changes to a table. Catches deletes, but
          adds write cost, and must be in the same transaction.

        ## Idea 2: why "changed since last time" misses rows

        Here is the bug, step by step.

        1. At 10:00:00, transaction A starts and sets «updated_at» to 10:00:00. It has not committed.
        2. At 10:00:05, the extractor runs «WHERE updated_at > 09:55». A is not visible yet, so it is
           skipped. The new watermark becomes 10:00:05.
        3. At 10:00:06, A commits, with «updated_at» still 10:00:00.
        4. The next run asks for rows after 10:00:05. A is older than that. **It is never copied.**

        The timestamp is set when the row changes, but the row becomes visible only at **commit**.
        Fixes:

        - Read with an **overlap**: from the watermark minus a safety window (longer than your longest
          transaction), and deduplicate by key and version downstream.
        - Use a commit-ordered column, or move to log-based CDC, which reads in commit order.

        Two more rows this method never sees: rows where the app forgot to update «updated_at», and
        hard deletes.

        ## Idea 3: read from a copy, not the original (replicas)

        Point extraction at a **read replica**, not the primary. Then watch two things.

        - **Replica lag.** Use the replica's replay position as the high watermark, not the primary's
          clock.
        - **Query conflicts.** On a Postgres hot standby, a long query can be cancelled when the
          replica must apply a vacuum change. «hot_standby_feedback = on» stops the cancels, but
          bloats the primary. A dedicated replica for extraction keeps that trade-off away from the
          app's replicas.

        ## Idea 4: one moment in time (consistent snapshots)

        If you copy «orders» at 1:00 and «order_items» at 1:20, a join between them is wrong: items
        for orders you do not have. A full copy must be one point in time.

        «pg_dump» takes one snapshot for all tables. «mysqldump --single-transaction» does the same
        for InnoDB. Debezium's initial snapshot records the log position, then streams from exactly
        there, so nothing is lost between snapshot and stream.

        ## Idea 5: small bites, gently (chunk and throttle)

        - Read in **primary-key ranges** («WHERE id > :last_id ORDER BY id LIMIT 50000»), never
          with «OFFSET», which re-reads everything it skips.
        - Limit concurrency, run off-peak, and set a «statement_timeout».
        - Land the raw rows unchanged first, so a bug downstream never needs a second extract.

        > [!example] Backfill without a stampede
        > A two-year backfill of «orders» split into 2,000 key ranges, run 4 at a time on the
        > extraction replica, with a lag alarm that pauses the job if replica lag passes 30 seconds.

        ## Now say it like a senior engineer

        > [!senior] Pick by deletes and freshness
        > "We need deletes and five-minute freshness on 300 tables, so log-based CDC from the replica
        > with an initial snapshot. For the two small reference tables, a nightly full snapshot is
        > simpler and self-healing." Mixing methods by table is the mature answer.

        ## In one breath

        Copy from a replica, in small key-range bites, at one consistent moment. "Changed since last
        time" misses rows that commit late and never sees deletes, so use an overlap window or read the
        database's own change log.
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

      **Fix 1: one atomic, conditional statement.** The check and the write are the same
      statement, and the ledger row is written only when the debit happened.

      ~~~sql
      WITH debit AS (
        UPDATE wallets
        SET balance = balance - 80
        WHERE wallet_id = 42
          AND balance >= 80
          AND NOT EXISTS (SELECT 1 FROM ledger WHERE request_id = 'w-1001')
        RETURNING wallet_id
      )
      INSERT INTO ledger (request_id, wallet_id, amount)
      SELECT 'w-1001', wallet_id, -80 FROM debit;
      -- 0 rows inserted: not enough money, or this request was already applied
      ~~~

      The second update waits for the row lock, then re-checks «balance >= 80» on the new value
      (20) and updates nothing. The «request_id» is an **idempotency key**: a client retry finds
      its ledger row and debits nothing. A unique constraint on «ledger.request_id» backs it up:
      if two copies of one request race, the second insert fails and its transaction rolls back
      the debit.

      **Fix 2: lock the row you read.** «SELECT balance … FOR UPDATE» makes the second transaction
      wait until the first commits, then read 20.

      Optionally run at «REPEATABLE READ» or «SERIALIZABLE» and retry on serialization errors.
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
