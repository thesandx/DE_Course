import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'lakehouse',
  title: 'Storage, lakehouse and BigQuery',
  summary:
    'File formats, table formats, layout, compaction and warehouse cost, explained from the bytes up.',
  tone: 'peach',
  why: 'Uber created Apache Hudi to make its lake incremental, and Google interviewers expect you to know how BigQuery stores and prices data. Storage choices decide the cost and speed of everything above them.',
  lessons: [
    {
      slug: 'file-formats',
      title: 'Columnar files from the inside',
      summary: 'Explain how Parquet stores data and why that makes analytic scans cheap.',
      minutes: 16,
      body: `
        ## Start with the problem

        You have a trips table with 40 columns and a billion rows, stored as CSV. A dashboard asks:
        "Total fare per city last week." That needs 3 columns: city, fare, date.

        With CSV, each line holds one whole trip, all 40 columns side by side. To read the city and
        fare of every trip, the engine must read every line, which means all 40 columns. You pay to read
        37 columns you do not want.

        Analytic queries almost always look like this: **a few columns, many rows**. The file format
        decides whether you read 3 columns or 40.

        ## Idea 1: rows together or columns together

        Think of a school's records.

        - **Row format:** one folder per student, with their name, age, marks and address inside. To
          find the average age, you open every folder. CSV, JSON and Avro work like this.
        - **Columnar format:** one list of all names, one list of all ages, one list of all marks. To
          find the average age, you read only the ages list. Parquet and ORC work like this.

        A **columnar format** stores each column together, so a query reads only the columns it names.
        That is the first and largest saving.

        ## Idea 2: how a Parquet file is built

        From big to small:

        - A file holds one or more **row groups** (typically 128 MB to 1 GB of rows).
        - Inside a row group, each column is a **column chunk**, split into **pages**.
        - The **footer** holds the schema plus statistics for each column chunk: min, max and null
          count.
        - Readers fetch the footer first, then skip whole row groups whose stats cannot match the
          filter.

        The footer is like the index on the spine of each box in a storeroom: "box 3 holds dates from 1
        to 7 March". Looking for 20 March? Skip box 3 without opening it.

        ## Idea 3: four ways to skip work

        - **Projection pruning** skips the columns the query does not name. It needs a columnar
          layout.
        - **Predicate pushdown** skips row groups whose min/max cannot match. It needs data sorted or
          clustered on the filter column.
        - **Partition pruning** skips whole files or folders. It needs a partition column in the
          filter.
        - **Bloom filters** skip row groups that cannot hold a value. They need a Bloom filter written
          for that column.

        ## Idea 4: min/max only helps when the data is sorted

        Tiny example. You filter «city_id = 42».

        - Files written in **arrival order**: trips from all cities are mixed. Every row group holds
          cities from 1 to 900. Its range is "1 to 900", and 42 is inside every range. Nothing is
          skipped.
        - Files **sorted by city**: row group 1 holds cities 1 to 30, row group 2 holds 31 to 60. Only
          row group 2 can hold 42. The rest are skipped.

        Same data, same file format, very different cost. Sorting is what makes the stats useful.

        ## Idea 5: similar values squeeze small

        Values in one column look alike, so they compress well.

        - **Dictionary encoding** replaces repeated strings (city names, status codes) with small
          integers.
        - **Run-length encoding** stores "the next 4,000 values are 'completed'" once.
        - A general codec runs on top: Snappy for speed, ZSTD for a better ratio.

        ## Idea 6: where row formats still win

        Avro carries its schema with the data and handles schema evolution well, which is why it is
        common on Kafka. Writing one record at a time is cheap in a row format and awkward in a columnar
        one. A common pattern: Avro or Protobuf on the wire, Parquet at rest.

        ## Now say it like a senior engineer

        Columnar files read only the named columns, and footer statistics let the reader skip row groups,
        but only when the data is sorted or clustered on the filter column. Encoding and compression
        work well because a column's values are similar. Row formats stay on the wire, where records are
        written one at a time.

        > [!trap] Min/max stats only help sorted data
        > If «city_id» is spread randomly across every row group, every row group's range covers
        > almost every city, and pushdown skips nothing. Sorting or clustering on the filter column
        > is what makes the stats useful.

        > [!senior] Tie the format to the access pattern
        > Say which queries read the data, how often, and on which columns. "Parquet because it is
        > columnar" is a mid-level answer. "Parquet sorted by event time, because every dashboard
        > filters the last seven days, so the stats skip most row groups" is a senior one.

        ## In one breath

        Parquet stores each column together and keeps a min/max label on every block, so a query reads
        only the columns it needs and skips the blocks that cannot match. The labels only help if the
        data is sorted on the column you filter.
      `,
      checks: [
        {
          question:
            'A query filters on driver_id, but the files are written in arrival order. Why does predicate pushdown barely help?',
          options: [
            'Parquet does not store statistics for integer columns',
            'Every row group holds a wide range of driver ids, so no row group can be skipped',
            'Predicate pushdown only works with CSV files',
            'The query must name driver_id in the SELECT list',
          ],
          answer: 1,
          why: 'Min/max stats skip a row group only when its range excludes the value. Unsorted data gives every row group a near-full range.',
        },
        {
          question: 'Why do columnar files compress better than row files?',
          options: [
            'They always use a stronger codec',
            'They drop null values',
            'Values in one column are similar, so dictionary and run-length encoding work well',
            'They store fewer rows',
          ],
          answer: 2,
          why: 'Similar values next to each other is exactly what dictionary and run-length encoding exploit.',
        },
      ],
    },
    {
      slug: 'table-formats',
      title: 'Table formats: Iceberg, Delta and Hudi',
      summary:
        'Explain how a table format adds transactions, snapshots and time travel on object storage.',
      minutes: 18,
      body: `
        ## Start with the problem

        Your lake has a folder called «trips/» full of Parquet files. You call it "the trips table". Then:

        - A job is writing 50 new files. A dashboard query runs halfway through and reads 23 of them.
          The numbers are half updated.
        - Two jobs write at the same time. One deletes old files while the other still reads them.
          Both crash.
        - A bad job writes wrong data. You want yesterday's table back. There is no "yesterday": only
          the files that are there now.

        A folder of Parquet files is not a table. Nobody knows **which files make up the table right
        now**. A **table format** is the answer to that one question.

        ## Idea 1: a list of files, swapped in one step

        Think of a restaurant menu board. The kitchen can cook new dishes all afternoon, but guests only
        see what is on the board. At 6 PM the manager swaps the old board for a new one in one move.
        Nobody ever sees half a board.

        Every table format keeps a log or tree of metadata that lists exactly which data files form each
        **snapshot**. A commit works in two steps:

        1. Write the new data files. Nobody can see them yet.
        2. Publish new metadata that lists them, in **one atomic step**.

        Readers use the latest published snapshot, so they never see a partial write.

        ## Idea 2: three formats, same idea

        - **Apache Iceberg.** The commit lives in a catalog pointer to a metadata file, which points to
          manifest lists and manifests. Known for hidden partitioning, partition evolution and wide
          engine support.
        - **Delta Lake.** The commit lives in numbered JSON commits in «_delta_log», with periodic
          Parquet checkpoints. Known for tight Spark integration and deletion vectors.
        - **Apache Hudi.** The commit lives in a timeline of actions in «.hoodie». Known for
          record-level upserts and incremental pulls. It was built at Uber.

        ## Idea 3: changing rows in files you cannot edit

        Parquet files are immutable: you cannot change one row inside. So how do you update a trip's
        status, or delete a user? Two ways.

        - **Copy-on-write (CoW).** Rewrite every file that holds a changed row. Like reprinting a whole
          page of a book to fix one typo. Reads stay fast; writes are expensive when changes are spread
          out.
        - **Merge-on-read (MoR).** Write the change separately (a delete file, a deletion vector or a
          log file) and merge it at read time. Like a printed errata sheet tucked in the book. Writes are
          cheap; reads slow down until **compaction** folds the changes back in.

        ## Idea 4: two writers at once

        Writers use **optimistic concurrency**. Each writer reads snapshot N, does its work, and tries
        to commit N+1. If another writer committed first, the format checks whether the two changes
        conflict.

        - Non-overlapping appends usually retry cleanly.
        - Two updates to the same files fail, and one must be redone.

        Like two people editing a shared document: if they edited different paragraphs, both edits
        stay. If they edited the same sentence, one must try again.

        ## Idea 5: time travel

        Old snapshots stay readable until you expire them. So you can query the table "as of"
        yesterday, or roll back a bad write by pointing the table at an earlier snapshot. The bad job
        from the story is undone in one command.

        ## Now say it like a senior engineer

        A table format writes data files first and then atomically publishes metadata listing them, so
        readers see whole snapshots. Updates use copy-on-write or merge-on-read, writers use optimistic
        concurrency, and old snapshots allow time travel until they expire.

        > [!example] Choosing between them
        > A daily batch that rewrites a few partitions: copy-on-write. A stream of CDC upserts from
        > an operational database every minute: merge-on-read, with compaction on a schedule.

        > [!trap] Time travel is not a backup
        > Snapshot expiry and file cleanup delete old data on a schedule (Delta's «VACUUM» keeps
        > 7 days by default). Once files are gone, so is the history. Keep real backups for data
        > you must restore after weeks.

        ## In one breath

        A table format is a menu board over a pile of files: new files stay invisible until one atomic
        swap lists them. That gives you whole snapshots, safe concurrent writers, row updates by rewrite
        or by errata, and time travel until old snapshots expire.
      `,
      checks: [
        {
          question: 'What makes a commit atomic in a table format on object storage?',
          options: [
            'Object storage supports multi-file transactions',
            'Data files are written first, then one atomic metadata update publishes the new snapshot',
            'Readers lock the table while a writer runs',
            'Each row is written in its own file',
          ],
          answer: 1,
          why: 'Data files are invisible until the metadata that lists them is published in a single atomic step.',
        },
        {
          question: 'A CDC feed upserts rows every minute. Which write mode fits best?',
          options: [
            'Copy-on-write, so reads stay fast',
            'Merge-on-read, with scheduled compaction',
            'Full table overwrite every minute',
            'Append only, and dedupe in every query',
          ],
          answer: 1,
          why: 'Frequent small updates make copy-on-write rewrite many files. Merge-on-read keeps writes cheap and compaction restores read speed.',
        },
      ],
    },
    {
      slug: 'layout-and-maintenance',
      title: 'Layout, small files and compaction',
      summary: 'Choose a partition scheme and keep a lakehouse table healthy over time.',
      minutes: 16,
      body: `
        ## Start with the problem

        You launch a new events table in the lake. On day 1 every query takes 3 seconds. A month later
        the same queries take 90 seconds, and nobody changed any code.

        What changed is the **physical layout**. A streaming job wrote a small file every 30 seconds:
        86,000 files a month. And the table was partitioned on a column nobody filters on. A table's
        layout decides how much data every query reads. Get it right once and maintain it, or the table
        slowly gets slower and more expensive.

        ## Idea 1: partitioning, the drawers of a filing cabinet

        A partition is a drawer. A query that filters on the partition column opens only the drawers it
        needs. Two rules for choosing the column:

        - **Almost every query filters on it.** Otherwise nobody skips any drawers.
        - **It has modest cardinality.** A few hundred drawers, not millions.

        Event date is the classic choice. Some examples:

        - «event_date»: good. Most queries filter by date, and it makes about 365 partitions a year.
        - «event_hour»: good only for very large tables queried by hour.
        - «user_id»: bad. Millions of tiny partitions, and most queries do not filter on it.
        - «country» plus «event_date»: fine if many queries filter by country, but watch skew from big
          countries.

        Iceberg's **hidden partitioning** stores a transform such as «day(event_ts)». Queries filter on
        «event_ts» and still prune; nobody needs to know a separate date column exists. You can also
        change the partition scheme later (**partition evolution**) without rewriting old data.

        ## Idea 2: the small files problem

        Streaming and frequent micro-batches write many small files. Every file has a fixed cost: a
        metadata entry, an open call and a footer read.

        Think of moving house. Ten big boxes take ten trips. The same things in ten thousand envelopes
        take ten thousand trips. Ten thousand 1 MB files are far slower to scan than ten 1 GB files
        holding the same data.

        The fixes:

        - **Compaction** rewrites small files into larger ones: Iceberg «rewrite_data_files», Delta
          «OPTIMIZE», Hudi compaction and clustering.
        - **Clustering** sorts or Z-orders the data inside that rewrite. Similar values end up in the
          same files, so file and row-group stats skip more.
        - **Target file sizes** of roughly 256 MB to 1 GB for analytic tables.

        Compaction fixes the size of the boxes. Clustering also puts similar things in the same box.

        ## Idea 3: housekeeping

        A table format keeps old snapshots and metadata. Without cleaning, they pile up.

        - **Expire snapshots** so metadata stays small and old files can be deleted.
        - **Remove orphan files** left by failed writes.
        - **Rewrite manifests** when planning a query becomes slow because of many manifests.

        ## Now say it like a senior engineer

        Partition on a low-cardinality column that almost every query filters on, usually the event
        date. Compact small files toward 256 MB to 1 GB, cluster within the rewrite so stats skip more,
        and schedule snapshot expiry, orphan cleanup and manifest rewrites.

        > [!senior] Make maintenance part of the design
        > When you design a streaming sink into a lake, name the compaction job, its schedule, and
        > who owns it. An answer that writes files every 30 seconds and stops there will be asked
        > "what does this table look like after a month?"

        ## In one breath

        Partition on the column every query filters by, and keep the drawers few. Streaming leaves
        thousands of tiny files, so compact and cluster them on a schedule, and clean up old snapshots,
        or the table gets slower every week.
      `,
      checks: [
        {
          question: 'Why is partitioning a clickstream table by user_id usually a mistake?',
          options: [
            'user_id is not a string',
            'It creates millions of tiny partitions and most queries do not filter on it',
            'Table formats do not allow integer partition columns',
            'It prevents compaction',
          ],
          answer: 1,
          why: 'High cardinality explodes the partition count and file count, and pruning only helps if queries filter on the column.',
        },
        {
          question: 'What does clustering add on top of plain compaction?',
          options: [
            'It deletes old snapshots',
            'It sorts data so similar values share files, which makes min/max skipping effective',
            'It converts Parquet to Avro',
            'It adds more partitions',
          ],
          answer: 1,
          why: 'Compaction fixes file size. Clustering also orders the data, so statistics can skip files and row groups.',
        },
      ],
    },
    {
      slug: 'bigquery',
      title: 'BigQuery: storage, slots and cost',
      summary: 'Explain how BigQuery runs a query and design tables that scan less.',
      minutes: 17,
      body: `
        ## Start with the problem

        An analyst runs «SELECT * FROM events LIMIT 10» to "just have a look". It returns 10 rows in two
        seconds. The next morning the bill shows that query cost about $60. They ran it 30 times last
        month.

        BigQuery does not charge for rows returned. On demand, it charges for **bytes scanned**. To keep
        BigQuery cheap you need to know how it stores data, how it runs a query, and what makes it scan
        less.

        ## Idea 1: storage and compute live apart

        Think of a library with a separate reading room. The books (storage) sit in a huge store. The
        reading room (compute) has tables you rent by the hour.

        - Tables live in a columnar format (**Capacitor**) on Google's distributed file system
          (**Colossus**).
        - Queries run on **slots**, units of compute that a scheduler hands out.
        - A **shuffle tier** between stages lets thousands of workers exchange data.

        Because storage and compute scale separately, the bill has two parts.

        ## Idea 2: how you pay

        - **On-demand:** pay per byte scanned. List price is about $6.25 per TiB in the US, with the
          first 1 TiB each month free. Every column you read counts, even if the result is small.
        - **Capacity (editions):** pay for slots over time, with autoscaling. Cost then depends on how
          long queries hold slots, not on bytes.
        - **Storage:** active storage, and cheaper long-term storage for partitions untouched for 90
          days.

        Back to the story. «SELECT *» reads every column, and «LIMIT» is applied **after** the scan. On
        a 10 TiB table, that is about $60, for 10 rows.

        ## Idea 3: partitioning and clustering, so it reads less

        - **Partitioning** splits a table by a date, timestamp or integer-range column (or by
          ingestion time). A filter on that column prunes partitions before the scan, and the dry run
          shows the reduced byte count.
        - **Clustering** sorts data inside partitions by up to four columns. Filters on those columns
          skip blocks. The dry-run estimate is an upper bound; the real scan is often smaller.
        - Set «require_partition_filter» on large tables, so nobody scans all history by accident.

        ~~~sql
        CREATE TABLE analytics.trip_events
        (
          event_ts TIMESTAMP,
          city_id INT64,
          trip_id STRING,
          event_type STRING,
          fare_usd NUMERIC
        )
        PARTITION BY DATE(event_ts)
        CLUSTER BY city_id, event_type
        OPTIONS (require_partition_filter = TRUE);
        ~~~

        Now a query for last week's trips in city 42 opens 7 daily partitions, and inside them only the
        blocks for city 42. Like a library sorted by year, then by shelf: you walk to one shelf in seven
        rooms, not every shelf in the building.

        ## Idea 4: other levers

        - **Materialized views** keep an aggregate up to date incrementally, and the optimizer can
          rewrite matching queries to use them.
        - **BI Engine** caches hot data in memory for dashboards.
        - **Search indexes** speed up point lookups on text columns.
        - **BigLake and external tables** let BigQuery read Iceberg or Parquet in Cloud Storage.

        ## Now say it like a senior engineer

        BigQuery separates Capacitor storage on Colossus from slot-based compute. On demand you pay for
        bytes scanned, so name the columns, filter on the partition column, cluster on common filters
        and require a partition filter. On capacity pricing you pay for slot time instead.

        > [!trap] LIMIT does not cut the scan
        > «SELECT * FROM events LIMIT 10» on a non-clustered table still reads every column of every
        > row in scope. Name the columns and filter on the partition column instead.

        > [!senior] Answer cost questions with numbers
        > "This dashboard query scans 3 TiB, runs 200 times a day, so it costs about 600 TiB a
        > day on demand. Partitioning to the last 7 days and clustering on «city_id» cuts each run
        > to roughly 60 GiB." Interviewers remember the candidate who did the arithmetic.

        ## In one breath

        BigQuery keeps storage and compute apart, and on demand it bills the bytes a query reads, not
        the rows it returns. Read fewer columns, prune partitions, cluster on your filters, and do the
        cost arithmetic out loud.
      `,
      checks: [
        {
          question:
            'On on-demand pricing, which change cuts the cost of a dashboard query the most?',
          options: [
            'Adding LIMIT 100',
            'Reading only the needed columns and filtering on the partition column',
            'Running it at night',
            'Ordering the result',
          ],
          answer: 1,
          why: 'On-demand cost follows bytes scanned. Fewer columns and pruned partitions both cut bytes; LIMIT does not.',
        },
        {
          question: 'How many clustering columns can a BigQuery table have?',
          options: ['One', 'Up to four', 'Up to sixteen', 'Unlimited'],
          answer: 1,
          why: 'BigQuery allows up to four clustering columns, and their order matters: the first column gives the most pruning.',
        },
      ],
    },
    {
      slug: 'incremental-processing',
      title: 'Incremental processing and upserts',
      summary: 'Move from daily full rebuilds to incremental merges without losing correctness.',
      minutes: 16,
      body: `
        ## Start with the problem

        The «trips» table in the lake is 50 TB. Every night a job rebuilds all of it from the source, to
        apply the day's changes: new trips, fares corrected, a few trips cancelled. That is about 0.1%
        of the rows. The job reads and writes 50 TB to change 50 GB, and the data is a day old by the
        time it lands.

        **Incremental processing** reads only what changed and merges it into the target. It is how
        Uber cut lake latency from a day to minutes, and it is a frequent design topic.

        ## Idea 1: an upsert is "update if it exists, insert if it does not"

        Think of a class register. A new student joins: add a line. A student changes their phone
        number: fix their existing line. You never rewrite the whole register.

        In SQL this is a **MERGE**. It takes a batch of changes, keeps the latest version of each key,
        and merges it into the target.

        ~~~sql
        MERGE INTO lake.trips AS t
        USING (
          SELECT * EXCEPT (rn)
          FROM (
            SELECT
              *,
              ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY updated_at DESC) AS rn
            FROM staging.trip_changes
          )
          WHERE rn = 1
        ) AS s
        ON t.trip_id = s.trip_id
        WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET
          status = s.status, fare_usd = s.fare_usd, updated_at = s.updated_at
        WHEN NOT MATCHED THEN INSERT ROW;
        ~~~

        ## Idea 2: three details make it correct

        Each one fixes a real bug.

        - **Dedupe the source first.** Trip 9 changed twice in this batch: first «accepted», then
          «completed». Two changes for one key in a batch make MERGE fail or pick one arbitrarily. The
          inner query keeps only the newest row per «trip_id» («rn = 1»).
        - **Guard on version.** A late change from 09:00 arrives after the 09:30 change was already
          merged. «s.updated_at > t.updated_at» stops the late, older change from overwriting the newer
          row.
        - **Handle deletes.** CDC streams carry delete events. Map them to «WHEN MATCHED AND s.op = 'd'
          THEN DELETE».

        ## Idea 3: where do the changes come from?

        Three ways to find "what changed since last time":

        - **Change data capture (CDC)** reads the database's own log (Debezium on the MySQL binlog or
          the Postgres WAL). It gives every insert, update and delete, in order. Like reading the bank's
          full transaction history.
        - **Incremental reads** from a table format return only rows changed since a snapshot: Hudi
          incremental queries, Delta change data feed, Iceberg incremental scans.
        - **Watermark columns** («updated_at > last_run») are the simplest option. Like asking "which
          accounts changed since Monday?" by looking at a "last changed" stamp. But they miss hard
          deletes, because a deleted row has no row left to carry a new timestamp. And they miss rows
          whose clock was wrong.

        ## Idea 4: the hidden cost is finding the matches

        MERGE must find the target rows that match each change. If the changed trips are spread across
        every file in the table, every merge rewrites most of the table, and you are back to a full
        rebuild.

        Partition so changes cluster. Most changes touch recent trips, so partition by trip date, and
        add the partition to the ON condition. Then a merge touches the last few days of files.

        ## Now say it like a senior engineer

        Incremental pipelines read changes through CDC, table-format incremental reads or a watermark
        column, dedupe to the latest version per key, merge with a version guard and delete handling,
        and partition the target so the changes land in few files.

        > [!trap] Merge cost hides in the join
        > MERGE must find matching rows. If the target is not partitioned or clustered so the
        > changed keys land in a few files, every merge rewrites most of the table. Partition so
        > changes cluster, for example by trip date, and add the partition to the ON condition.

        > [!senior] Keep a full rebuild path
        > Incremental pipelines drift: a missed delete, a bug in one batch. Keep a tested way to
        > rebuild the table from source and reconcile counts on a schedule.

        ## In one breath

        Instead of rebuilding 50 TB, read only the changes and MERGE them: dedupe per key, keep the
        newest version, apply deletes, and partition so the merge touches few files. Keep a full rebuild
        for the day the increments drift.
      `,
      checks: [
        {
          question: 'Why add "s.updated_at > t.updated_at" to the MATCHED branch?',
          options: [
            'It makes the MERGE run faster',
            'It stops a late, older change from overwriting a newer row',
            'BigQuery requires a condition on every branch',
            'It removes duplicates in the source',
          ],
          answer: 1,
          why: 'Changes can arrive out of order. The version guard keeps the newest state.',
        },
        {
          question: 'What does a simple updated_at watermark miss?',
          options: [
            'Inserts',
            'Hard deletes in the source table',
            'Updates to string columns',
            'Rows in the current day',
          ],
          answer: 1,
          why: 'A deleted row has no row to carry a new updated_at. Log-based CDC captures deletes.',
        },
      ],
    },
    {
      slug: 'block-file-object-storage',
      title: 'Block, file and object storage',
      summary:
        'Compare block, file and object storage by interface, latency, sharing and cost, and explain why the lake lives on object storage.',
      minutes: 15,
      body: `
        ## Start with the problem

        An old Hadoop job moves to the cloud. On HDFS it wrote its output to a temporary folder, then
        renamed the folder to «output/» to "commit". It worked for years. On S3 the same job now takes 40
        minutes to commit, and once a dashboard read «output/» while only half the files were in it.

        Nothing in the code changed. The **storage** changed. Every byte in a data platform sits on one
        of three kinds of storage, and each one exposes a different interface. That interface explains
        a lot of lakehouse design.

        ## Idea 1: three kinds of storage, three kinds of shop

        **Block storage: your own hard drive.**

        - Examples: EBS, GCP Persistent Disk, Azure Managed Disks, SAN.
        - Interface: numbered blocks; the OS puts a file system on top.
        - Shared by: usually one machine at a time.
        - Latency: sub-millisecond to a few ms.
        - Scale: up to tens of TB per volume.
        - Cost: highest per GB.
        - DE use: database data files, Spark shuffle and spill disks.

        **File storage: a shared office cabinet.**

        - Examples: NFS, SMB, EFS, Filestore, Azure Files, HDFS.
        - Interface: directories and files (POSIX): open, seek, append, rename.
        - Shared by: many machines, with locks.
        - Latency: a few ms.
        - Scale: up to petabytes, with limits.
        - Cost: middle.
        - DE use: shared notebooks, legacy tools, HDFS clusters.

        **Object storage: a giant warehouse with a counter.**

        - Examples: S3, GCS, Azure Blob and ADLS Gen2.
        - Interface: HTTP. PUT, GET, LIST and DELETE whole objects by key.
        - Shared by: any number of clients.
        - Latency: tens of ms per request, but high throughput in parallel.
        - Scale: practically unlimited.
        - Cost: lowest per GB, plus per-request fees.
        - DE use: the data lake, backups, landing zones.

        At the warehouse counter you hand in a whole parcel or ask for a whole parcel by its label. You
        cannot open a parcel on the shelf and change one page.

        ## Idea 2: what object storage does not give you

        - **No in-place update.** You rewrite the whole object. That is why lake files are immutable,
          and tables change by adding new files.
        - **No atomic rename of a folder.** A "folder" is only a key prefix, a common start of the
          labels. Renaming one is a copy and delete of every object, which is slow and not atomic. That
          is the story above: old Hadoop jobs that commit by renaming a temporary folder are slow and
          unsafe on S3. ADLS Gen2 with a hierarchical namespace is the exception: it renames directories
          atomically.
        - **Listing is slow and costs money.** Listing millions of keys to plan a query is the problem
          that table formats solve with manifests.
        - **Request limits per prefix.** S3 supports about 3,500 writes and 5,500 reads per second per
          prefix, and scales by splitting busy prefixes. A sudden burst can get 503 SlowDown errors.

        One piece of good news: S3 has given strong read-after-write consistency for all operations
        since December 2020, and GCS has always been strongly consistent for object reads. Old advice
        about eventual consistency on S3 is out of date.

        ## Idea 3: why the lake still lives on object storage

        - Storage and compute **scale apart**: ten clusters can read the same files.
        - It is the cheapest durable tier. S3 Standard is about 0.02 USD per GB-month; block storage is
          several times more.
        - Lifecycle rules move cold data to cheaper classes automatically.

        Table formats (Iceberg, Delta, Hudi) add what the object store lacks: atomic commits, snapshots
        and a file list that does not need «LIST».

        ## Now say it like a senior engineer

        Block storage is fast, single-machine and expensive; file storage is shared POSIX; object
        storage is cheap, unlimited HTTP with no in-place update, no atomic folder rename and costly
        listing. The lake lives on object storage, and table formats supply the missing commit
        semantics.

        > [!trap] Local disks still matter
        > Spark shuffles and spills to local block storage, not to the lake. A job with small or slow
        > local disks fails or crawls even when the lake is fast. Size executor disks for the shuffle.

        > [!senior] Explain the design through the interface
        > "Object stores cannot rename a folder atomically, so Iceberg commits by swapping one
        > metadata pointer in the catalog" links storage to table format design. That link is the
        > senior signal.

        ## In one breath

        Block storage is your own fast drive, file storage is a shared cabinet, and object storage is a
        cheap, endless warehouse that only takes and gives whole parcels. The lake lives there, and
        because it cannot rename folders or update in place, table formats commit through metadata.
      `,
      checks: [
        {
          question: 'Why is renaming a "folder" on S3 a poor way to commit a job output?',
          options: [
            'S3 does not allow folders',
            'A folder is a key prefix, so a rename copies and deletes every object, slowly and not atomically',
            'S3 is eventually consistent',
            'Renames cost more than 1 USD each',
          ],
          answer: 1,
          why: 'Object stores have no real directories. A partial rename can leave readers seeing half the output, which is why table formats commit through metadata instead.',
        },
        {
          question: 'Where should Spark shuffle files be written?',
          options: [
            'The object store bucket of the lake',
            'Fast local block storage on each executor',
            'An NFS share',
            'The driver memory',
          ],
          answer: 1,
          why: 'Shuffle is many small random reads and writes during the job. Local block storage gives the latency and IOPS it needs.',
        },
      ],
    },
    {
      slug: 'compression-and-encoding',
      title: 'Compression codecs and encodings',
      summary:
        'Choose a codec and encoding per layer, explain splittability, and trade CPU for bytes on purpose.',
      minutes: 15,
      body: `
        ## Start with the problem

        A partner sends one file a day: «events.json.gz», 20 GB. Your Spark cluster has 200 cores, but
        the read uses **one task**. It takes 50 minutes while 199 cores wait.

        Meanwhile someone switches the whole lake from Snappy to GZIP "to save storage", and every
        dashboard gets slower.

        Compression cuts storage cost and, more important, the bytes each query reads. But it costs CPU
        to write and to read, and some choices block parallel reads entirely. A senior engineer picks it
        per layer instead of keeping the default.

        ## Idea 1: two layers of saving

        1. **Encodings** work on the values of one column, inside Parquet or ORC pages. They are cheap
           to decode, and some engines run filters on encoded data directly.
        2. **Codecs** then compress the encoded bytes of each page with a general algorithm.

        Think of packing a suitcase. Encoding is folding the clothes neatly. The codec is the vacuum
        bag on top.

        ## Idea 2: four encodings, each for one kind of column

        - **Dictionary.** Best for low to medium distinct values: status, city, country. Store each
          distinct value once, then small integer ids. "Mumbai" becomes 3, everywhere.
        - **RLE / bit-packing.** Best for repeated values, booleans and dictionary ids. Store "4,000
          times id 3", and pack ids in few bits.
        - **Delta.** Best for sorted integers and timestamps. Store the differences between neighbours,
          which are small: 1700000000, +2, +1, +3.
        - **Byte stream split.** Best for floating point measures. It groups the bytes of floats so the
          codec finds patterns.

        Parquet writers fall back from dictionary to plain encoding when a column chunk has too many
        distinct values for the dictionary page (about 1 MB by default in many writers). A UUID column
        will never dictionary-encode well: every value is new, so the dictionary is as big as the data.

        ## Idea 3: four codecs, speed against size

        - **LZ4:** fastest, lower ratio. For hot data where CPU is the limit.
        - **Snappy:** very fast, lower ratio. Spark's default for Parquet; a safe general choice.
        - **ZSTD:** fast at low levels, tunable from 1 to 22, high ratio. Iceberg's default for Parquet
          since 1.4; a good default for the lake.
        - **GZIP:** slow, high ratio. For legacy and interchange; avoid it for hot tables.

        On typical event data, ZSTD at a low level often makes files noticeably smaller than Snappy at a
        similar read speed. Measure on your own data before you change a large table.

        ## Idea 4: splittability, the one-task problem

        A file is **splittable** when many tasks can read parts of it in parallel.

        A gzip stream can only be decompressed from its beginning, like a scroll you must unroll from
        the top. A book with chapters is different: ten people can each read one chapter.

        - A 10 GB «.json.gz» or «.csv.gz» file is **not** splittable: one task must read it from the
          start. bzip2 is splittable but slow.
        - Parquet, ORC and Avro compress inside blocks or pages, so they stay splittable with any codec.

        So the codec matters most for raw text files in the landing zone. Convert them to a columnar
        format early. That fixes the 20 GB story: read it once, write Parquet, and every later read uses
        all 200 cores.

        ## Idea 5: sorting multiplies compression

        Sorting rows by a low-cardinality column puts equal values next to each other. Then RLE and
        dictionary encoding shrink them further, and min/max statistics get tighter. Sorting by
        «country, city, event_date» before writing can cut file size and scan time together.

        ## Now say it like a senior engineer

        Encodings shrink column values and codecs shrink pages. Text in gzip is not splittable, so
        convert landing files to columnar formats at once. Pick a codec per layer, and sort on
        low-cardinality columns so encodings and statistics work harder.

        > [!trap] Compressing an already compressed column
        > Images, encrypted fields and already-zipped blobs do not compress again. Paying ZSTD level
        > 19 CPU on them buys nothing.

        > [!senior] A codec per layer
        > "Landing: whatever the source sends, converted to Parquet at once. Bronze and silver: ZSTD
        > level 3. Gold tables read by dashboards all day: ZSTD or Snappy, sorted on the filter
        > columns. Archive: a high ZSTD level." That answer shows deliberate trade-offs.

        ## In one breath

        Encodings fold each column neatly and a codec vacuum-packs the result; choose both per layer,
        trading CPU for bytes on purpose. Never leave big gzip text in the lake, because one task must
        read it end to end.
      `,
      checks: [
        {
          question:
            'A daily 20 GB file arrives as one events.json.gz. Why does the Spark read use only one task?',
          options: [
            'JSON cannot be read in parallel',
            'GZIP-compressed text is not splittable, so one task must read it from the start',
            'The file is too small',
            'Spark disables parallelism for JSON',
          ],
          answer: 1,
          why: 'A gzip stream can only be decompressed from its beginning. Ask the source for smaller files or a splittable format, or convert once to Parquet.',
        },
        {
          question: 'Which column will benefit least from dictionary encoding?',
          options: ['order_status', 'country_code', 'request_uuid', 'payment_method'],
          answer: 2,
          why: 'A UUID is almost always unique, so the dictionary would be as big as the data. Writers fall back to plain encoding.',
        },
      ],
    },
    {
      slug: 'warehouse-lake-lakehouse',
      title: 'Warehouses, lakes and lakehouses',
      summary:
        'Compare the three architectures by storage, format, governance and cost, and say which one fits a given company.',
      minutes: 16,
      body: `
        ## Start with the problem

        A design interviewer opens with: "Warehouse or lakehouse?" The weak answer picks the newest
        word. The strong answer compares them on concrete properties, then chooses for the company in
        front of you.

        To do that you need the story of why there are three architectures at all.

        ## Idea 1: how we got here, in four steps

        1. **Warehouses** (Teradata, then Redshift, BigQuery, Snowflake) gave fast SQL on structured
           data.
        2. **Lakes** (HDFS, then S3) stored everything cheaply, including logs and images for ML.
        3. Most companies ran **both**: raw data in the lake, a copy in the warehouse for BI. That
           two-tier design doubled storage, added a copy pipeline, and gave two answers to one question.
        4. **Lakehouses** put warehouse features (ACID, schema, time travel, governance) on the open
           files, so one copy serves BI, data science and streaming.

        Think of a restaurant (the warehouse), a market (the lake), and then a market hall with proper
        kitchens inside (the lakehouse). Before the hall, you bought at the market and carried
        everything to the restaurant. Two places, two bills, and the food in each did not always match.

        ## Idea 2: the three side by side

        **Data warehouse.**

        - Storage: managed, proprietary. Format: an internal columnar format.
        - Transactions: full ACID. Schema: on write, enforced.
        - Engines: one, the vendor's.
        - Governance: built in. Grants, masking, audit.
        - Strength: fast SQL, low operations work.
        - Weakness: lock-in, and the cost of compute and copies.

        **Data lake.**

        - Storage: object storage. Format: open files such as Parquet, JSON and CSV.
        - Transactions: none. Files appear one by one.
        - Schema: on read, often drifting.
        - Engines: many, but each must guess the table state.
        - Governance: bucket permissions only.
        - Strength: cheap, any data type, ML access.
        - Weakness: a "data swamp", no updates, no consistency.

        **Lakehouse.**

        - Storage: object storage. Format: open files plus an open table format (Iceberg, Delta, Hudi).
        - Transactions: ACID per table, through the table format.
        - Schema: on write, with evolution rules.
        - Engines: many, sharing one table state through a catalog.
        - Governance: a catalog with grants, row filters and masks.
        - Strength: open, one copy, many engines.
        - Weakness: you run more pieces. Compaction, catalog, engines.

        ## Idea 3: the lines are blurring

        - Warehouses read and write open tables: BigQuery tables for Apache Iceberg, Snowflake Iceberg
          tables, Redshift reading Iceberg through the Glue catalog.
        - Lakehouse engines give warehouse speed: Databricks SQL with Photon, Trino, StarRocks.

        So the real choice is often **who owns the storage and the catalog**: the vendor, or you.

        ## Idea 4: how to choose

        - **A small team, mostly BI, one cloud:** a warehouse. Fewer moving parts, quick value.
        - **Large scale, ML and streaming, several engines, cost pressure:** a lakehouse on open tables.
        - **Both:** open tables as the single copy, with the warehouse reading them for BI.

        ## Now say it like a senior engineer

        Warehouses give managed ACID SQL with lock-in; lakes give cheap open files without consistency;
        lakehouses add ACID and governance to open files so many engines share one copy. As warehouses
        adopt open tables, the decision is who owns storage and catalog, sized to the team.

        > [!trap] "The lake is cheaper" is half the story
        > Storage is cheap in both. The bill is compute and people. A lakehouse that needs three
        > engineers for compaction and catalog work can cost more than a warehouse for a small team.

        > [!senior] Choose for the company, not the trend
        > "With 6 analysts, 2 data engineers and 3 TB, I choose BigQuery and keep raw files in GCS.
        > If we add streaming and ML at 500 TB, I move the core tables to Iceberg so Spark and
        > BigQuery share one copy." Naming the trigger for change is the senior part.

        ## In one breath

        A warehouse is fast and managed but closed, a lake is cheap and open but messy, and a lakehouse
        puts warehouse guarantees on open files so one copy serves everyone. Choose by team size, scale
        and who should own the storage, and name what would make you switch.
      `,
      checks: [
        {
          question:
            'What problem of the two-tier lake plus warehouse design does a lakehouse remove?',
          options: [
            'The need for SQL',
            'Keeping two copies of the data and a pipeline between them',
            'The need for object storage',
            'The need for schemas',
          ],
          answer: 1,
          why: 'With ACID tables on open files, BI and ML read one copy, so the copy pipeline and the two versions of the truth go away.',
        },
      ],
    },
    {
      slug: 'catalogs',
      title: 'Catalogs: Hive Metastore, Glue, Unity and REST',
      summary:
        'Explain what a catalog stores, how it makes a table commit atomic, and how to choose one for several engines.',
      minutes: 17,
      body: `
        ## Start with the problem

        Spark writes the «trips» table in the lake. Trino reads it for dashboards. One morning, Trino
        shows yesterday's numbers, while Spark shows today's. Same files in the same bucket. How can two
        engines see two different tables?

        Because a lakehouse table is a set of files **plus metadata**, and each engine asked a different
        place "which metadata is current?". The **catalog** is the one place that answers. Without one
        shared catalog, two engines see two different tables.

        ## Idea 1: a catalog is the library's front desk

        A library has millions of books on shelves. The front desk keeps the record of where each book
        is, which edition is current, and who may borrow it. A catalog does four jobs for tables:

        1. **Names.** It maps «catalog.schema.table» to a location and a current metadata pointer.
        2. **Atomic commits.** A writer commits by changing that pointer, only if nobody else changed it
           first (compare and swap).
        3. **Access control.** Who can read or write which table, column or row.
        4. **Discovery and lineage.** Descriptions, owners, tags and usage.

        ## Idea 2: how a commit works, step by step

        ~~~text
        1. Read pointer: v41
        2. Write data files
           and v42.metadata.json
        3. Ask catalog:
           "set pointer to v42,
            only if it is v41"
        4a. Yes: readers see v42
        4b. No: someone else
            wrote v42 first.
            Re-read, check for
            conflicts, retry.
        ~~~

        This is **optimistic concurrency**. Like booking the last seat on a train: you fill in the form,
        and at the end the system checks the seat is still free. If someone took it first, you try
        again.

        - Two appends rarely conflict, and both succeed after a retry.
        - Two jobs rewriting the same files (a compaction and a «MERGE») can conflict, and one must redo
          its work.

        Delta Lake commits a different way. It writes the next numbered file in «_delta_log» with
        "create only if absent", so the object store or a coordinator acts as the arbiter.

        ## Idea 3: the catalogs you will meet

        - **Hive Metastore.** A Thrift service on a relational database. The old default. It knows tables
          and partitions, with no fine-grained access control.
        - **AWS Glue Data Catalog.** Managed, Hive-compatible and serverless. Used by Athena, EMR and
          Redshift Spectrum; Lake Formation adds grants.
        - **Unity Catalog.** Databricks' catalog for tables, volumes, models and functions. Grants, row
          filters, column masks and lineage. An open source version exists.
        - **Iceberg REST catalog.** An open HTTP API spec that any engine speaks. Implementations include
          Apache Polaris, Unity, Glue and others.
        - **Nessie.** A catalog with git-like branches and tags. Commit to a branch, test, then merge.
        - **Managed table services.** S3 Tables and the BigLake metastore. The cloud runs the catalog
          and table maintenance.

        ## Idea 4: choosing one, three questions

        - **Which engines must read and write?** If Spark, Trino, Snowflake and BigQuery all need the
          tables, pick a catalog every one of them supports. Today that usually means the Iceberg REST
          protocol.
        - **Where do grants live?** Access rules belong in one place. If each engine has its own grants,
          they drift.
        - **One writer per table.** Many readers are fine, but one engine should own writes to a table,
          so commit conflicts and semantics stay simple.

        ## Now say it like a senior engineer

        The catalog maps names to the current metadata pointer, commits by compare and swap on that
        pointer, and holds the grants. Choose one catalog that every engine supports, usually through
        the Iceberg REST protocol, keep grants there, and give each table a single writing engine.

        > [!trap] Two catalogs for one table
        > If Spark registers a table in Hive Metastore and Trino uses a different catalog that also
        > points at the same files, each commit updates only one of them. The other engine reads a
        > stale snapshot or, after an expiry, missing files.

        > [!senior] Make the catalog an explicit design box
        > Draw the catalog in your design, name it, and say who may write each table. Interviewers
        > notice when a lakehouse answer has engines and files but no catalog.

        ## In one breath

        The catalog is the front desk that says which version of each table is current, and a commit is
        a "change it only if nobody else did" on that one pointer. Use one shared catalog for every
        engine, with the grants in it, or each engine sees its own truth.
      `,
      checks: [
        {
          question: 'Two jobs commit to the same Iceberg table at once. What usually happens?',
          options: [
            'Both overwrite each other and data is lost',
            'The second commit sees the pointer changed, re-checks for conflicts and retries',
            'The table locks for an hour',
            'The catalog merges the files',
          ],
          answer: 1,
          why: 'Iceberg uses optimistic concurrency. A compare-and-swap on the metadata pointer fails for the second writer, which retries if its changes do not conflict.',
        },
        {
          question: 'Why prefer one shared catalog for all engines?',
          options: [
            'It is free',
            'Every engine then sees the same current snapshot and the same access rules',
            'It removes the need for a table format',
            'It makes queries faster',
          ],
          answer: 1,
          why: 'The catalog holds the current metadata pointer. Separate catalogs give separate truths and separate grants.',
        },
      ],
    },
    {
      slug: 'clustering-and-z-ordering',
      title: 'Partitioning, clustering and Z-ordering',
      summary:
        'Lay out a table for its filters: partition for coarse pruning, sort or Z-order for skipping inside partitions, and know when liquid clustering fits.',
      minutes: 16,
      body: `
        ## Start with the problem

        The «trips» table is partitioned by date. A dashboard asks for one day of trips in pickup zone
        17. Partitioning already cut it to one day's folder, 2,000 files. But zone 17's trips are spread
        across all 2,000 files, so the query reads 1,800 of them.

        Partitioning prunes whole folders. **Inside** a partition, the order of rows decides how many
        files and row groups a filter can skip. That second layer is **clustering**.

        ## Idea 1: a linear sort helps the first column most

        Sort the rows by «(city, event_ts)». Now each file covers one or a few cities, so «city = 'SF'»
        skips most files.

        But a filter on «event_ts» alone gets little help. Each city's rows span the full time range, so
        every file still covers almost all times.

        Think of a phone book sorted by surname, then first name. Finding every "Sharma" is quick.
        Finding every "Priya", whatever her surname, means reading the whole book. A linear sort serves
        the **first** column well and later columns poorly.

        ## Idea 2: Z-ordering helps several columns at once

        A **Z-order curve** interleaves the bits of several columns into one value, and sorts by it.
        Rows close in **any** of the columns end up close on disk.

        ~~~text
        x = 2 → bits 10
        y = 3 → bits 11

        Take bits in turn:
        y1 x1 y0 x0
         1  1  1  0  → z = 14

        Sort rows by z.
        Each file covers a
        small square of (x, y).
        ~~~

        Think of a city map cut into small squares. Searching by street or by avenue, you only look in
        a few squares, not the whole map.

        - Good for 2 to 4 columns that are filtered **independently**, such as «pickup_zone» and
          «driver_id».
        - Each extra column weakens the benefit for every column.
        - Use high-cardinality columns. A boolean or a three-value column gains little.

        ## Idea 3: how each platform does it

        - **Delta Lake:** «OPTIMIZE t ZORDER BY (a, b)», or **liquid clustering** with «CLUSTER BY
          (a, b)».
        - **Iceberg:** a table sort order, and «rewrite_data_files» with a «sort» or «zorder(a, b)»
          strategy.
        - **BigQuery:** «CLUSTER BY» up to four columns, re-clustered automatically.
        - **Snowflake:** micro-partitions with a clustering key, maintained by Automatic Clustering
          (billed).

        ## Idea 4: liquid clustering

        Delta's **liquid clustering** replaces fixed partitions and Z-order for many tables.

        - You declare clustering columns.
        - It clusters data incrementally, with a Hilbert curve.
        - You can **change the columns later** without rewriting the table.

        It cannot be combined with partitioning or Z-order on the same table.

        ## Idea 5: a decision path

        1. Is there a column in almost every filter, with modest cardinality (a date)? Partition on it.
        2. Is there one more dominant filter column? Sort by it within partitions.
        3. Are there 2 to 4 columns filtered separately? Z-order or cluster on them.
        4. Do access patterns change, or is the table small to medium? Prefer liquid or automatic
           clustering.

        ## Now say it like a senior engineer

        Partition for coarse pruning, sort within partitions for one dominant filter, and Z-order or
        multi-column clustering for 2 to 4 independent high-cardinality filters. Liquid or automatic
        clustering fits changing access patterns. Re-cluster the hot partitions on a schedule and prove
        the win with files scanned.

        > [!trap] Clustering is not free or permanent
        > New writes arrive unsorted, so the layout decays. Clustering rewrites data and costs
        > compute. Schedule it on the partitions that are queried, not on ten years of history.

        > [!senior] Prove it with file skipping
        > Measure files scanned before and after: "The query read 1,800 of 2,000 files; after
        > Z-ordering on pickup_zone and driver_id it reads 140." Numbers like this show you
        > validated the layout instead of applying it by habit.

        ## In one breath

        Partitions skip folders; clustering decides how many files a filter skips inside them. A plain
        sort helps only the first column, Z-order helps a few columns at once, and every layout decays,
        so re-cluster the hot data and measure files scanned.
      `,
      checks: [
        {
          question:
            'Queries filter by pickup_zone in some dashboards and by driver_id in others, each alone. Which layout helps both?',
          options: [
            'Partition by driver_id',
            'Sort by pickup_zone then driver_id',
            'Z-order (or multi-column clustering) on pickup_zone and driver_id',
            'No layout can help both',
          ],
          answer: 2,
          why: 'A linear sort serves mostly the first column. Z-order keeps rows close in both columns, so each filter alone can skip files.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'lakehouse-partition-choice',
    title: 'Pick partition columns for a clickstream table',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'google', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      A clickstream table gets 5 billion events a day. Analysts usually query the last 1 to 30
      days, often for one app platform (iOS, Android, web), and sometimes look up one user.
      An engineer proposes partitioning by «user_id». What do you propose instead, and why?
    `,
    hints: [
      'Which filter appears in almost every query?',
      'How many partitions would user_id create?',
      'Partitioning and clustering solve different problems.',
    ],
    answer: `
      Partition by **event date** and cluster (or sort) by **platform** and then **user_id**.

      - Every query filters on a date range, so date partitions prune most data. About 365
        partitions a year is easy for any engine to manage.
      - «user_id» has hundreds of millions of values. As a partition column it creates a huge
        number of tiny files and directories, and the common date-range query cannot prune on it.
      - Platform has three values, too few to be worth a partition level, but a good first
        clustering key. User lookups then benefit from sorting by «user_id» within each date.

      On BigQuery: «PARTITION BY DATE(event_ts) CLUSTER BY platform, user_id» with
      «require_partition_filter». On Iceberg: «day(event_ts)» hidden partitioning and a sort order.
    `,
    signals: [
      'Starts from the query patterns, not the column list',
      'Explains the cost of high-cardinality partitions',
      'Separates partitioning (prune) from clustering (skip within)',
      'Names a guardrail such as require_partition_filter',
    ],
    followUps: [
      'Volume grows to 50 billion a day. Would you add an hour level?',
      'How would you serve the single-user lookup in under a second?',
    ],
  },
  {
    slug: 'bigquery-cost-spike',
    title: 'Cut a BigQuery bill that tripled',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['google', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      Your team's on-demand BigQuery bill tripled in a month. Most of the spend is one dashboard
      that refreshes every 15 minutes and queries a 400 TiB unpartitioned events table with
      «SELECT * ... WHERE DATE(event_ts) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) LIMIT 1000».
      Walk through how you find the cause and fix it.
    `,
    hints: [
      'Where do you see bytes billed per query?',
      'What does the WHERE clause prune on an unpartitioned table?',
      'Think about how many times a day the query runs.',
    ],
    answer: `
      **Find it.** Query «INFORMATION_SCHEMA.JOBS» for the last 30 days, grouped by query hash or
      user, ordered by «total_bytes_billed». The dashboard query stands out: about 96 refreshes a
      day, each scanning the whole table.

      **Why it is expensive.** The table is unpartitioned, so the date filter prunes nothing.
      «SELECT *» reads every column. «LIMIT» does not reduce bytes scanned.

      **Fix, in order of impact:**

      - Partition by «DATE(event_ts)» and cluster by the dashboard's filter columns. A 7-day
        window then scans 7 partitions instead of all history.
      - Select only the columns the dashboard shows.
      - Pre-aggregate: a materialized view or a scheduled rollup table at the dashboard's grain,
        so each refresh reads megabytes.
      - Set «require_partition_filter» and a per-user or per-project maximum bytes billed quota.
      - Ask whether the dashboard needs 15-minute freshness at all.

      **Rough numbers.** If the table holds 2 years and the dashboard needs 4 of 60 columns, the
      7-day partitioned, projected scan is about (7 / 730) x (4 / 60) of the original, a cut of
      over 99%.
    `,
    signals: [
      'Uses INFORMATION_SCHEMA.JOBS to find the spend, not guesses',
      'Knows LIMIT does not reduce bytes scanned',
      'Fixes the table layout and the query, then adds guardrails',
      'Does the cost arithmetic',
      'Questions the freshness requirement',
    ],
    followUps: [
      'Would moving to capacity pricing fix this? When does it make sense?',
      'How do you stop the next team from repeating this?',
    ],
  },
  {
    slug: 'streaming-small-files',
    title: 'Fix a streaming sink that writes tiny files',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      A Spark Structured Streaming job writes trip events to an Iceberg table every 30 seconds
      across 200 partitions of «city_id». After three months, queries that took 20 seconds take
      6 minutes, and planning alone takes a minute. Explain what happened and how you fix it
      without stopping ingestion.
    `,
    hints: [
      'How many files does one trigger create?',
      'Where does query planning spend its time?',
      'Compaction and ingestion can run at the same time in a table format.',
    ],
    answer: `
      **Cause.** Each 30-second trigger writes up to one file per partition per task. That is
      thousands of small files per hour and millions after three months. Every file adds a
      manifest entry and a footer read, so planning and scanning slow down. Thousands of
      snapshots also bloat metadata.

      **Fix without stopping ingestion:**

      - Run compaction (Iceberg «rewrite_data_files») on a schedule, for example hourly on the
        partitions written in the last few hours, with a target file size near 512 MB. Iceberg's
        optimistic concurrency lets it commit alongside the streaming appends.
      - Sort or cluster during the rewrite on the main filter column (event time).
      - Expire old snapshots and remove orphan files daily.
      - Rewrite manifests so planning reads a few large manifests instead of many small ones.

      **Prevent it:**

      - Partition by event date (and maybe hour) instead of «city_id», which is skewed and multiplies files.
      - Lengthen the trigger interval if the freshness target allows it.
      - Repartition by the table's partition columns before writing, so each task writes to few partitions.
    `,
    signals: [
      'Explains why small files slow planning, not only scanning',
      'Compacts without stopping the stream and knows why that is safe',
      'Adds snapshot expiry and manifest rewrite',
      'Revisits the partition scheme as the root cause',
    ],
    followUps: [
      'Compaction commits keep failing because of conflicts with the stream. What do you change?',
      'How would this answer differ on Hudi merge-on-read?',
    ],
  },
  {
    slug: 'choose-table-format',
    title: 'Choose a table format for a new lake',
    track: 'lakehouse',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      Your company is moving a Hive-style Parquet lake to a table format. Workloads: daily Spark
      batch jobs, a CDC feed from 300 MySQL tables that must land within 15 minutes, Trino for
      analysts, and a plan to query some tables from BigQuery. Which format do you pick and how
      do you justify it?
    `,
    hints: [
      'List the engines that must read and write.',
      'Which workload is hardest: batch, CDC upserts or multi-engine reads?',
      'Is one format required for every table?',
    ],
    answer: `
      Start from requirements, then compare.

      | Need | Iceberg | Delta | Hudi |
      |---|---|---|---|
      | Spark batch | Strong | Strong | Strong |
      | Frequent CDC upserts | Good (merge-on-read, equality deletes) | Good (deletion vectors) | Strongest (record index, MoR) |
      | Trino reads | Strong | Good | Good |
      | BigQuery reads | Strong (BigLake Iceberg tables) | Possible via UniForm or manifests | Limited |
      | Partition evolution | Native | Limited | Limited |

      **A defensible pick: Iceberg** as the default, because multi-engine reads (Trino and
      BigQuery) and partition evolution are hard to add later, and its merge-on-read support
      handles a 15-minute CDC target. Run compaction on CDC tables on a schedule.

      **When to choose differently:** if CDC upserts dominate and latency must be a few
      minutes, Hudi's record-level index is built for that (it is why Uber built it). If the
      whole company runs on Databricks, Delta is the path of least friction.

      Name the migration: convert tables in place where possible (metadata-only migration of
      existing Parquet files), dual-run for a week, compare counts and checksums, then switch readers.
    `,
    signals: [
      'Derives the choice from engines and workloads',
      'Is honest that all three formats are capable',
      'Names when another format would win',
      'Plans the migration and validation, not only the pick',
    ],
    followUps: [
      'How do you keep the catalog consistent across Spark, Trino and BigQuery?',
      'What would make you regret this choice in two years?',
    ],
  },
  {
    slug: 'roll-back-bad-write',
    title: 'Recover a table after a bad overwrite',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      At 09:00 a buggy job overwrote yesterday's partition of a Delta table with an empty result.
      Three downstream jobs have already read it. It is now 10:30. What do you do?
    `,
    hints: ['What does the transaction log still hold?', 'Fixing the table is half the job.'],
    answer: `
      **Stop the spread.** Pause the buggy job and the downstream jobs that have not run yet.

      **Restore.** Find the last good version with «DESCRIBE HISTORY», check it with a time
      travel query («SELECT COUNT(*) FROM t VERSION AS OF 41»), then «RESTORE TABLE t TO
      VERSION AS OF 41». The restore is a new commit, so it is itself auditable and reversible.
      This works only while the old files exist, inside the «VACUUM» retention window.

      **Repair downstream.** Re-run the three downstream jobs for that date. This is safe only if
      they are idempotent (overwrite their partition rather than append).

      **Prevent it.** Add a data check before publish (row count against yesterday, a minimum
      threshold) that fails the job instead of writing an empty partition, and alert the owner.
    `,
    signals: [
      'Contains the blast radius first',
      'Uses table history and verifies before restoring',
      'Knows restore depends on retention',
      'Re-runs downstream jobs and relies on idempotency',
      'Adds a pre-publish check',
    ],
    followUps: ['How would you do the same on Iceberg?', 'What if VACUUM ran at 10:00?'],
  },
  {
    slug: 'cdc-merge-latest',
    title: 'Write a MERGE that applies CDC changes',
    track: 'lakehouse',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['google', 'uber', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      «staging.driver_changes(driver_id, name, city_id, op, changed_at)» holds a batch of CDC
      events where «op» is 'c', 'u' or 'd'. A driver can appear several times in one batch.
      Write a MERGE into «core.drivers(driver_id, name, city_id, changed_at)» that keeps only the
      newest state of each driver, applies deletes, and never lets an older event overwrite a newer row.
    `,
    hints: [
      'Reduce the batch to one row per driver first.',
      'Each WHEN branch can have an extra condition.',
      'Compare changed_at on both sides.',
    ],
    answer: `
      ~~~sql
      MERGE INTO core.drivers AS t
      USING (
        SELECT driver_id, name, city_id, op, changed_at
        FROM (
          SELECT c.*, ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY changed_at DESC) AS rn
          FROM staging.driver_changes c
        ) newest
        WHERE rn = 1
      ) AS s
      ON t.driver_id = s.driver_id
      WHEN MATCHED AND s.op = 'd' AND s.changed_at >= t.changed_at THEN
        DELETE
      WHEN MATCHED AND s.op IN ('c', 'u') AND s.changed_at > t.changed_at THEN
        UPDATE SET name = s.name, city_id = s.city_id, changed_at = s.changed_at
      WHEN NOT MATCHED AND s.op IN ('c', 'u') THEN
        INSERT (driver_id, name, city_id, changed_at)
        VALUES (s.driver_id, s.name, s.city_id, s.changed_at);
      ~~~

      - The row number keeps the newest event per driver, so the source has one row per key and
        MERGE cannot hit "multiple source rows matched". On Databricks or Snowflake,
        «QUALIFY ROW_NUMBER() OVER (...) = 1» does the same without the subquery.
      - The «changed_at» guards make replays and out-of-order batches safe: running the same
        batch twice changes nothing.
      - A delete for an unknown driver is ignored rather than inserted.

      If two events can share the same «changed_at», add a tiebreaker such as the log sequence
      number to the ORDER BY.
    `,
    signals: [
      'Dedupes the source before merging',
      'Guards every branch on event order',
      'Handles deletes and ignores deletes for unknown keys',
      'Points out the tie on equal timestamps',
    ],
    followUps: [
      'Deleted drivers must stay queryable for audits. How do you change the model?',
      'The target is 2 TB and each batch touches 0.01%. How do you keep MERGE cheap?',
    ],
  },
  {
    slug: 'lakehouse-storage-for-each-need',
    title: 'Pick the storage type for five needs',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['google', 'uber', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      For each need, choose block, file or object storage and give one reason:

      1. The raw event lake, 4 PB and growing.
      2. Spark shuffle and spill space on each executor.
      3. The data files of the Postgres orders database.
      4. A legacy tool on 20 VMs that reads and writes the same folder with file locks.
      5. Nightly database backups kept for a year.
    `,
    hints: ['Which needs are shared by many machines?', 'Which needs low-latency random I/O?'],
    answer: `
      1. **Object storage.** Cheapest per GB, practically unlimited, read by many engines at once.
         Use a table format for commits.
      2. **Block storage** (local NVMe or attached disks). Shuffle is random, latency-sensitive I/O
         during the job; the lake is too slow and charges per request.
      3. **Block storage.** A database needs low-latency random reads and writes and «fsync»
         semantics on one machine.
      4. **File storage** (NFS, EFS, Filestore). Many machines share a POSIX folder with locks and
         renames, which object storage does not offer.
      5. **Object storage** with a lifecycle rule to a cold storage class, plus versioning or an
         object lock so backups cannot be deleted by mistake.
    `,
    signals: [
      'Matches each need to the storage interface',
      'Keeps shuffle on local block storage',
      'Uses file storage only for shared POSIX needs',
      'Adds lifecycle and immutability for backups',
    ],
    followUps: [
      'The legacy tool must move to object storage. What changes in how it commits files?',
    ],
  },
  {
    slug: 'lakehouse-gzip-json-landing',
    title: 'One task reads a 30 GB gzip file',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      A partner drops one «events.json.gz» file of 30 GB each night. The Spark job that parses it
      runs for 3 hours with one busy task while 199 cores sit idle. The bronze table it writes
      uses Snappy Parquet. What is going on, and how do you fix the pipeline end to end?
    `,
    hints: [
      'Can a gzip stream be split?',
      'What can you change at the source, and what if you cannot?',
      'Is Snappy the right codec for bronze?',
    ],
    answer: `
      GZIP text is **not splittable**: decompression must start at the beginning, so Spark gives
      the whole file to one task. The other cores have nothing to do.

      Fixes, best first:

      1. **Change the source:** ask the partner for many files of about 256 MB to 1 GB, or for a
         splittable format (Parquet, Avro, or JSON with ZSTD in multiple files).
      2. **If the source cannot change:** run one cheap step that only decompresses and re-splits
         the file (or reads it once and repartitions to 200 partitions right after the read), then
         parse in parallel. The single-task part becomes plain decompression, which is fast.
      3. **Write bronze as Parquet with ZSTD**, which usually stores the same data smaller than
         Snappy at a similar read speed. Columnar files stay splittable with any codec.

      Measure: runtime, task count after the read, and bytes stored before and after.
    `,
    signals: [
      'Explains that gzip text is not splittable',
      'Asks the source for smaller or splittable files',
      'Repartitions right after the single read as a fallback',
      'Chooses the bronze codec deliberately',
      'Proposes measuring the change',
    ],
    followUps: [
      'The partner sends a 2 GB zip archive of 50,000 small JSON files instead. Now what?',
    ],
  },
  {
    slug: 'lakehouse-zorder-trips',
    title: 'Lay out a trips table for two kinds of filter',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      A Delta table of trips holds 3 years, 20 TB, partitioned by «trip_date». Operations
      dashboards filter on the last 7 days and «pickup_zone». Support tools filter on one
      «driver_id» over 90 days. Both are slow and scan most files in each date. What layout do you
      propose, and how do you prove it works?
    `,
    hints: [
      'Both filters are used alone.',
      'A sort serves the first column best.',
      'Which partitions need the rewrite?',
    ],
    answer: `
      Keep the date partitions (every query filters on date) and **Z-order the files within each
      date on «pickup_zone» and «driver_id»**: «OPTIMIZE trips WHERE trip_date >= ... ZORDER BY
      (pickup_zone, driver_id)». A linear sort by zone would help the dashboards and leave the
      driver lookup scanning every file.

      Alternative: move to **liquid clustering** «CLUSTER BY (trip_date, pickup_zone, driver_id)»,
      which clusters incrementally and lets the columns change later. It replaces the date
      partitioning, so this is a table migration, not a setting.

      Operations:

      - Run the rewrite only on recent and frequently queried dates, then nightly on yesterday's
        partition. Old cold dates do not repay the compute.
      - Prove it: compare files and bytes scanned for both query shapes before and after (from the
        query profile or «DESCRIBE HISTORY» and the scan metrics). Target a drop from "most files"
        to a few percent.
      - For the support lookup, also consider a small driver-keyed serving table if latency must
        be under a second.
    `,
    signals: [
      'Keeps date partitioning for the universal filter',
      'Chooses multi-column clustering for independent filters',
      'Knows liquid clustering and that it replaces partitioning',
      'Limits the rewrite to hot partitions',
      'Proves the result with files scanned',
    ],
    followUps: ['Why would adding a fifth Z-order column make every query slower?'],
  },
  {
    slug: 'lakehouse-catalog-for-engines',
    title: 'One Iceberg lake for Spark, Trino and Snowflake',
    track: 'lakehouse',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'uber', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      Today Spark writes Iceberg tables registered in a Hive Metastore. Trino reads them through
      the same metastore. The finance team now wants Snowflake to query the gold tables, and the
      ML team wants to write feature tables from Python. Design the catalog layer.
    `,
    hints: [
      'What can every engine speak?',
      'Who may write each table?',
      'Where do access rules live?',
    ],
    answer: `
      **Move to one Iceberg REST catalog** (for example Apache Polaris, Unity Catalog, Glue's
      Iceberg REST endpoint or a managed equivalent). Spark, Trino, Snowflake and PyIceberg all
      speak the REST protocol, so every engine sees the same current snapshot.

      Design points:

      1. **Write ownership:** Spark owns writes to bronze, silver and gold. The ML team writes only
         to its own «features» namespace. Snowflake reads gold only. One writer per table keeps
         commit conflicts rare.
      2. **Credentials:** the catalog vends short-lived, table-scoped storage credentials, so engines
         do not hold broad bucket keys.
      3. **Grants in one place:** namespaces and roles in the catalog (finance reads gold; ML writes
         features). Avoid a second set of grants in each engine.
      4. **Migration:** register existing tables in the new catalog pointing at their current
         metadata, freeze writes for a short window, switch Spark and Trino, then retire the
         Hive Metastore entries so no one commits to the old pointer.
      5. **Maintenance:** one owner runs snapshot expiry and compaction, coordinated with the
         writers to avoid commit conflicts.
    `,
    signals: [
      'Chooses a catalog every engine supports',
      'Assigns one writer per table',
      'Centralises grants and uses vended credentials',
      'Plans a migration that avoids two live pointers',
      'Names who runs table maintenance',
    ],
    followUps: [
      'A compaction job and a MERGE keep failing with commit conflicts. What do you change?',
    ],
  },
  {
    slug: 'lakehouse-warehouse-or-lakehouse',
    title: 'Warehouse or lakehouse for a growing startup',
    track: 'lakehouse',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['google', 'microsoft', 'flipkart', 'walmart'],
    prompt: `
      A 60-person delivery startup has 2 TB of data, 5 analysts and 1 data engineer. They plan
      real-time ETAs and an ML team next year. The CTO asks: "Warehouse or lakehouse?"
    `,
    hints: ['Who will operate it?', 'What would make you change the answer later?'],
    answer: `
      **Start with a managed warehouse** (BigQuery or Snowflake), with raw files landed in object
      storage first. With one data engineer and 2 TB, the team should spend time on models and
      data quality, not on compaction, catalogs and engines.

      Keep the door open:

      - Land raw data in open formats (Parquet in GCS or S3) before loading the warehouse.
      - Keep transformations in dbt so they can move.
      - Watch the triggers: streaming at scale, ML training on large raw data, several engines, or
        compute costs that grow faster than value. When they appear, move the core tables to an
        open table format (Iceberg) that the warehouse can still read.
    `,
    signals: [
      'Fits the choice to team size and data size',
      'Keeps raw data in open formats',
      'Names concrete triggers to move later',
      'Avoids choosing by trend',
    ],
    followUps: ['A year later, compute cost has tripled. What do you look at first?'],
  },
];
