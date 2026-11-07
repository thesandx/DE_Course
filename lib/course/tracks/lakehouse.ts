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
      minutes: 14,
      body: `
        Analytic queries read a few columns from many rows. A **row format** (CSV, JSON, Avro)
        stores each record together, so reading two columns still reads every byte. A **columnar
        format** (Parquet, ORC) stores each column together, so a query reads only the columns it
        names. That is the first and largest saving.

        ## Parquet's layout

        - A file holds one or more **row groups** (typically 128 MB to 1 GB of rows).
        - Inside a row group, each column is a **column chunk**, split into **pages**.
        - The **footer** holds the schema plus statistics for each column chunk: min, max and null count.
        - Readers fetch the footer first, then skip whole row groups whose stats cannot match the filter.

        | Technique | What it skips | Needs |
        |---|---|---|
        | Projection pruning | Columns the query does not name | Columnar layout |
        | Predicate pushdown | Row groups whose min/max cannot match | Data sorted or clustered on the filter column |
        | Partition pruning | Whole files or folders | A partition column in the filter |
        | Bloom filters | Row groups that cannot hold a value | Bloom filter written for that column |

        ## Encodings and compression

        Values in one column look alike, so they compress well. **Dictionary encoding** replaces
        repeated strings (city names, status codes) with small integers. **Run-length encoding**
        stores "the next 4,000 values are 'completed'" once. A general codec (Snappy for speed,
        ZSTD for a better ratio) runs on top.

        > [!trap] Min/max stats only help sorted data
        > If «city_id» is spread randomly across every row group, every row group's range covers
        > almost every city, and pushdown skips nothing. Sorting or clustering on the filter column
        > is what makes the stats useful.

        ## Where row formats still win

        Avro carries its schema with the data and handles schema evolution well, which is why it
        is common on Kafka. Writing one record at a time is cheap in a row format and awkward in a
        columnar one. A common pattern: Avro or Protobuf on the wire, Parquet at rest.

        > [!senior] Tie the format to the access pattern
        > Say which queries read the data, how often, and on which columns. "Parquet because it is
        > columnar" is a mid-level answer. "Parquet sorted by event time, because every dashboard
        > filters the last seven days, so the stats skip most row groups" is a senior one.
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
      minutes: 16,
      body: `
        A folder of Parquet files is not a table. Two writers can collide, a reader can see half a
        write, and nobody knows which files make up "the table right now". A **table format** adds
        a metadata layer that answers that question atomically.

        ## The shared idea

        Every table format keeps a log or tree of metadata that lists exactly which data files form
        each **snapshot**. A commit writes new data files first, then publishes new metadata in one
        atomic step. Readers use the latest published snapshot and never see a partial write.

        | Format | Where the commit lives | Known for |
        |---|---|---|
        | Apache Iceberg | A catalog pointer to a metadata file, which points to manifest lists and manifests | Hidden partitioning, partition evolution, wide engine support |
        | Delta Lake | Numbered JSON commits in «_delta_log», with periodic Parquet checkpoints | Tight Spark integration, deletion vectors |
        | Apache Hudi | A timeline of actions in «.hoodie» | Record-level upserts and incremental pulls, built at Uber |

        ## Copy-on-write and merge-on-read

        An update or delete must change rows that already live in immutable files. There are two ways.

        - **Copy-on-write (CoW):** rewrite every file that holds a changed row. Reads stay fast;
          writes are expensive when changes are spread out.
        - **Merge-on-read (MoR):** write the change separately (a delete file, a deletion vector or a
          log file) and merge it at read time. Writes are cheap; reads slow down until compaction
          folds the changes back in.

        > [!example] Choosing between them
        > A daily batch that rewrites a few partitions: copy-on-write. A stream of CDC upserts from
        > an operational database every minute: merge-on-read, with compaction on a schedule.

        ## Concurrency

        Writers use optimistic concurrency. Each writer reads snapshot N, does its work, and tries
        to commit N+1. If another writer committed first, the format checks whether the two changes
        conflict. Non-overlapping appends usually retry cleanly; two updates to the same files fail
        and must be redone.

        ## Time travel

        Old snapshots stay readable until you expire them, so you can query the table "as of"
        yesterday, or roll back a bad write by pointing the table at an earlier snapshot.

        > [!trap] Time travel is not a backup
        > Snapshot expiry and file cleanup delete old data on a schedule (Delta's «VACUUM» keeps
        > 7 days by default). Once files are gone, so is the history. Keep real backups for data
        > you must restore after weeks.
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
      minutes: 14,
      body: `
        A table's physical layout decides how much data every query reads. Get it right once and
        maintain it, or the table slowly gets slower and more expensive.

        ## Partitioning

        Partition on a column that almost every query filters on and that has modest cardinality.
        Event date is the classic choice.

        | Partition column | Verdict |
        |---|---|
        | «event_date» | Good: most queries filter by date, about 365 partitions a year |
        | «event_hour» | Good only for very large tables queried by hour |
        | «user_id» | Bad: millions of tiny partitions, and most queries do not filter on it |
        | «country» plus «event_date» | Fine if many queries filter by country, but watch skew from big countries |

        Iceberg's **hidden partitioning** stores a transform such as «day(event_ts)», so queries
        filter on «event_ts» and still prune. You can also change the partition scheme later
        (partition evolution) without rewriting old data.

        ## The small files problem

        Streaming and frequent micro-batches write many small files. Every file costs a metadata
        entry, an open call and a footer read. Ten thousand 1 MB files are far slower to scan than
        ten 1 GB files holding the same data.

        - **Compaction** rewrites small files into larger ones (Iceberg «rewrite_data_files»,
          Delta «OPTIMIZE», Hudi compaction and clustering).
        - **Clustering** (sorting or Z-ordering inside the rewrite) puts similar values together
          so file and row-group stats skip more.
        - Target file sizes of roughly 256 MB to 1 GB for analytic tables.

        ## Housekeeping

        - **Expire snapshots** so metadata stays small and old files can be deleted.
        - **Remove orphan files** left by failed writes.
        - **Rewrite manifests** when planning a query becomes slow because of many manifests.

        > [!senior] Make maintenance part of the design
        > When you design a streaming sink into a lake, name the compaction job, its schedule, and
        > who owns it. An answer that writes files every 30 seconds and stops there will be asked
        > "what does this table look like after a month?"
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
      minutes: 15,
      body: `
        BigQuery separates storage from compute. Tables live in a columnar format (Capacitor) on
        Google's distributed file system (Colossus). Queries run on **slots**, units of compute
        that a scheduler hands out. A shuffle tier between stages lets thousands of workers
        exchange data. Because storage and compute scale separately, the bill has two parts.

        ## How you pay

        - **On-demand:** pay per byte scanned (list price is about $6.25 per TiB in the US, with
          the first 1 TiB each month free). Every column you read counts, even if the result is small.
        - **Capacity (editions):** pay for slots over time, with autoscaling. Cost then depends on
          how long queries hold slots, not on bytes.
        - **Storage:** active storage, and cheaper long-term storage for partitions untouched for
          90 days.

        > [!trap] LIMIT does not cut the scan
        > «SELECT * FROM events LIMIT 10» on a non-clustered table still reads every column of every
        > row in scope. Name the columns and filter on the partition column instead.

        ## Partitioning and clustering

        - **Partitioning** splits a table by a date, timestamp or integer-range column (or by
          ingestion time). A filter on that column prunes partitions before the scan, and the dry
          run shows the reduced byte count.
        - **Clustering** sorts data inside partitions by up to four columns. Filters on those
          columns skip blocks. The dry-run estimate is an upper bound; the real scan is often smaller.
        - Set «require_partition_filter» on large tables so nobody scans all history by accident.

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

        ## Other levers

        - **Materialized views** keep an aggregate up to date incrementally, and the optimizer can
          rewrite matching queries to use them.
        - **BI Engine** caches hot data in memory for dashboards.
        - **Search indexes** speed up point lookups on text columns.
        - **BigLake and external tables** let BigQuery read Iceberg or Parquet in Cloud Storage.

        > [!senior] Answer cost questions with numbers
        > "This dashboard query scans 3 TiB, runs 200 times a day, so it costs about 600 TiB a
        > day on demand. Partitioning to the last 7 days and clustering on «city_id» cuts each run
        > to roughly 60 GiB." Interviewers remember the candidate who did the arithmetic.
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
      minutes: 14,
      body: `
        A daily job that rebuilds a 50 TB table to apply 0.1% of changes wastes almost all of its
        compute. **Incremental processing** reads only what changed and merges it into the target.
        It is how Uber cut lake latency from a day to minutes, and it is a frequent design topic.

        ## The MERGE pattern

        Upserts take a batch of changes, keep the latest version of each key, and merge it.

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

        Three details make this correct:

        - **Dedupe the source first.** Two changes for one key in a batch make MERGE fail or pick one arbitrarily.
        - **Guard on version.** «s.updated_at > t.updated_at» stops a late, older change from overwriting a newer row.
        - **Handle deletes.** CDC streams carry delete events; map them to «WHEN MATCHED AND s.op = 'd' THEN DELETE».

        ## Reading changes

        - **Change data capture (CDC)** from database logs (Debezium on MySQL binlog or Postgres WAL)
          gives every insert, update and delete in order.
        - **Incremental reads** from a table format return only rows changed since a snapshot:
          Hudi incremental queries, Delta change data feed, Iceberg incremental scans.
        - **Watermark columns** («updated_at > last_run») are the simplest option, but miss hard
          deletes and rows whose clock was wrong.

        > [!trap] Merge cost hides in the join
        > MERGE must find matching rows. If the target is not partitioned or clustered so the
        > changed keys land in a few files, every merge rewrites most of the table. Partition so
        > changes cluster, for example by trip date, and add the partition to the ON condition.

        > [!senior] Keep a full rebuild path
        > Incremental pipelines drift: a missed delete, a bug in one batch. Keep a tested way to
        > rebuild the table from source and reconcile counts on a schedule.
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
      minutes: 13,
      body: `
        Every byte in a data platform sits on one of three kinds of storage. Each one exposes a
        different interface, and that interface explains a lot of lakehouse design.

        ## The three kinds

        | | **Block** | **File** | **Object** |
        |---|---|---|---|
        | Examples | EBS, GCP Persistent Disk, Azure Managed Disks, SAN | NFS, SMB, EFS, Filestore, Azure Files, HDFS | S3, GCS, Azure Blob and ADLS Gen2 |
        | Interface | Numbered blocks; the OS puts a file system on top | Directories and files (POSIX): open, seek, append, rename | HTTP: PUT, GET, LIST, DELETE whole objects by key |
        | Shared by | Usually one machine at a time | Many machines, with locks | Any number of clients |
        | Latency | Sub-millisecond to a few ms | A few ms | Tens of ms per request; high throughput in parallel |
        | Scale | Up to tens of TB per volume | Up to petabytes, with limits | Practically unlimited |
        | Typical cost | Highest per GB | Middle | Lowest per GB, plus per-request fees |
        | DE use | Database data files, Spark shuffle and spill disks | Shared notebooks, legacy tools, HDFS clusters | The data lake, backups, landing zones |

        ## What object storage does not give you

        - **No in-place update.** You rewrite the whole object. That is why lake files are immutable
          and tables change by adding new files.
        - **No atomic rename of a folder.** A "folder" is only a key prefix. Renaming one is a copy and
          delete of every object, which is slow and not atomic. Old Hadoop jobs that commit by
          renaming a temporary folder are slow and unsafe on S3. ADLS Gen2 with a hierarchical
          namespace is the exception: it renames directories atomically.
        - **Listing is slow and costs money.** Listing millions of keys to plan a query is the
          problem that table formats solve with manifests.
        - **Request limits per prefix.** S3 supports about 3,500 writes and 5,500 reads per second
          per prefix, and scales by splitting busy prefixes. A sudden burst can get 503 SlowDown errors.

        S3 has given strong read-after-write consistency for all operations since December 2020,
        and GCS has always been strongly consistent for object reads. Old advice about eventual
        consistency on S3 is out of date.

        ## Why the lake is on object storage

        - Storage and compute **scale apart**: ten clusters can read the same files.
        - It is the cheapest durable tier (S3 Standard is about 0.02 USD per GB-month, block storage
          is several times more).
        - Lifecycle rules move cold data to cheaper classes automatically.

        Table formats (Iceberg, Delta, Hudi) add what the object store lacks: atomic commits,
        snapshots and a file list that does not need «LIST».

        > [!trap] Local disks still matter
        > Spark shuffles and spills to local block storage, not to the lake. A job with small or slow
        > local disks fails or crawls even when the lake is fast. Size executor disks for the shuffle.

        > [!senior] Explain the design through the interface
        > "Object stores cannot rename a folder atomically, so Iceberg commits by swapping one
        > metadata pointer in the catalog" links storage to table format design. That link is the
        > senior signal.
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
      minutes: 13,
      body: `
        Compression cuts storage cost and, more important, the bytes each query reads. It costs CPU
        to write and to read. A senior engineer picks it per layer instead of keeping the default.

        ## Two layers of saving

        1. **Encodings** work on the values of one column, inside Parquet or ORC pages. They are
           cheap to decode and some engines run filters on encoded data directly.
        2. **Codecs** compress the encoded bytes of each page with a general algorithm.

        | Encoding | Best for | Idea |
        |---|---|---|
        | **Dictionary** | Low to medium distinct values: status, city, country | Store each distinct value once, then small integer ids |
        | **RLE / bit-packing** | Repeated values, booleans, dictionary ids | "4,000 times id 3", and ids packed in few bits |
        | **Delta** | Sorted integers and timestamps | Store differences between neighbours, which are small |
        | **Byte stream split** | Floating point measures | Groups the bytes of floats so the codec finds patterns |

        Parquet writers fall back from dictionary to plain encoding when a column chunk has too many
        distinct values for the dictionary page (about 1 MB by default in many writers). A UUID
        column will never dictionary-encode well.

        ## Codecs

        | Codec | Speed | Ratio | Use |
        |---|---|---|---|
        | **LZ4** | Fastest | Lower | Hot data where CPU is the limit |
        | **Snappy** | Very fast | Lower | Spark's default for Parquet; safe general choice |
        | **ZSTD** | Fast at low levels, tunable 1 to 22 | High | Iceberg's default for Parquet since 1.4; good default for the lake |
        | **GZIP** | Slow | High | Legacy and interchange; avoid for hot tables |

        On typical event data, ZSTD at a low level often makes files noticeably smaller than Snappy
        at a similar read speed. Measure on your own data before you change a large table.

        ## Splittability

        A file is **splittable** when many tasks can read parts of it in parallel.

        - A 10 GB «.json.gz» or «.csv.gz» file is **not** splittable: one task must read it from the
          start. bzip2 is splittable but slow.
        - Parquet, ORC and Avro compress inside blocks or pages, so they stay splittable with any codec.

        So the codec matters most for raw text files in the landing zone. Convert them to a
        columnar format early.

        ## Sorting multiplies compression

        Sorting rows by a low-cardinality column puts equal values next to each other, so RLE and
        dictionary encoding shrink them further, and min/max statistics get tighter. Sorting by
        «country, city, event_date» before writing can cut file size and scan time together.

        > [!trap] Compressing an already compressed column
        > Images, encrypted fields and already-zipped blobs do not compress again. Paying ZSTD level
        > 19 CPU on them buys nothing.

        > [!senior] A codec per layer
        > "Landing: whatever the source sends, converted to Parquet at once. Bronze and silver: ZSTD
        > level 3. Gold tables read by dashboards all day: ZSTD or Snappy, sorted on the filter
        > columns. Archive: a high ZSTD level." That answer shows deliberate trade-offs.
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
      minutes: 14,
      body: `
        "Warehouse or lakehouse?" is a common opening question in a design round. A good answer
        compares them on concrete properties and then chooses for the company in front of you.

        ## Three architectures

        | | **Data warehouse** | **Data lake** | **Lakehouse** |
        |---|---|---|---|
        | Storage | Managed, proprietary | Object storage | Object storage |
        | Format | Internal columnar format | Open files: Parquet, JSON, CSV | Open files plus an open table format (Iceberg, Delta, Hudi) |
        | Transactions | Full ACID | None: files appear one by one | ACID per table through the table format |
        | Schema | On write, enforced | On read, often drifting | On write, with evolution rules |
        | Engines | One (the vendor's) | Many, but each must guess the table state | Many, sharing one table state through a catalog |
        | Governance | Built in: grants, masking, audit | Bucket permissions only | A catalog with grants, row filters and masks |
        | Strength | Fast SQL, low operations work | Cheap, any data type, ML access | Open, one copy, many engines |
        | Weakness | Lock-in, cost of compute and copies | "Data swamp", no updates, no consistency | You run more pieces: compaction, catalog, engines |

        ## How we got here

        1. **Warehouses** (Teradata, then Redshift, BigQuery, Snowflake) gave fast SQL on structured data.
        2. **Lakes** (HDFS, then S3) stored everything cheaply, including logs and images for ML.
        3. Most companies ran **both**: raw data in the lake, a copy in the warehouse for BI. That
           two-tier design doubled storage, added a copy pipeline and gave two answers to one question.
        4. **Lakehouses** put warehouse features (ACID, schema, time travel, governance) on the open
           files, so one copy serves BI, data science and streaming.

        ## The lines are blurring

        - Warehouses read and write open tables: BigQuery tables for Apache Iceberg, Snowflake
          Iceberg tables, Redshift reading Iceberg through the Glue catalog.
        - Lakehouse engines give warehouse speed: Databricks SQL with Photon, Trino, StarRocks.

        So the real choice is often **who owns the storage and the catalog**: the vendor, or you.

        ## How to choose

        - **A small team, mostly BI, one cloud:** a warehouse. Fewer moving parts, quick value.
        - **Large scale, ML and streaming, several engines, cost pressure:** a lakehouse on open tables.
        - **Both:** open tables as the single copy, with the warehouse reading them for BI.

        > [!trap] "The lake is cheaper" is half the story
        > Storage is cheap in both. The bill is compute and people. A lakehouse that needs three
        > engineers for compaction and catalog work can cost more than a warehouse for a small team.

        > [!senior] Choose for the company, not the trend
        > "With 6 analysts, 2 data engineers and 3 TB, I choose BigQuery and keep raw files in GCS.
        > If we add streaming and ML at 500 TB, I move the core tables to Iceberg so Spark and
        > BigQuery share one copy." Naming the trigger for change is the senior part.
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
      minutes: 15,
      body: `
        A lakehouse table is a set of files plus metadata. The **catalog** tells every engine which
        metadata is current. Without one shared catalog, two engines see two different tables.

        ## What a catalog does

        1. **Names:** maps «catalog.schema.table» to a location and a current metadata pointer.
        2. **Atomic commits:** a writer commits by changing that pointer only if nobody else changed
           it first (compare and swap).
        3. **Access control:** who can read or write which table, column or row.
        4. **Discovery and lineage:** descriptions, owners, tags and usage.

        ## How a commit works

        ~~~text
        writer reads current pointer → v41.metadata.json
        writer writes new data files and v42.metadata.json
        writer asks catalog: set pointer to v42 IF it is still v41
          success → readers now see v42
          conflict → another writer committed v42 first: re-read, check for conflicts, retry
        ~~~

        This is **optimistic concurrency**. Two appends rarely conflict and both succeed after a
        retry. Two jobs rewriting the same files (a compaction and a «MERGE») can conflict, and one
        must redo its work. Delta Lake commits a different way: it writes the next numbered file in
        «_delta_log» with "create only if absent", so the object store or a coordinator acts as
        the arbiter.

        ## The catalogs you will meet

        | Catalog | What it is | Notes |
        |---|---|---|
        | **Hive Metastore** | A Thrift service on a relational database | The old default. Knows tables and partitions; no fine-grained access control |
        | **AWS Glue Data Catalog** | Managed, Hive-compatible, serverless | Used by Athena, EMR, Redshift Spectrum; Lake Formation adds grants |
        | **Unity Catalog** | Databricks' catalog for tables, volumes, models and functions | Grants, row filters, column masks, lineage; an open source version exists |
        | **Iceberg REST catalog** | An open HTTP API spec | Any engine speaks it; implementations include Apache Polaris, Unity, Glue and others |
        | **Nessie** | A catalog with git-like branches and tags | Commit to a branch, test, then merge |
        | **Managed table services** | S3 Tables, BigLake metastore | The cloud runs the catalog and table maintenance |

        ## Choosing

        - **Which engines must read and write?** If Spark, Trino, Snowflake and BigQuery all need the
          tables, pick a catalog every one of them supports, which today usually means the Iceberg
          REST protocol.
        - **Where do grants live?** Access rules belong in one place. If each engine has its own
          grants, they drift.
        - **One writer per table.** Many readers are fine, but one engine should own writes to a
          table, so commit conflicts and semantics stay simple.

        > [!trap] Two catalogs for one table
        > If Spark registers a table in Hive Metastore and Trino uses a different catalog that also
        > points at the same files, each commit updates only one of them. The other engine reads a
        > stale snapshot or, after an expiry, missing files.

        > [!senior] Make the catalog an explicit design box
        > Draw the catalog in your design, name it, and say who may write each table. Interviewers
        > notice when a lakehouse answer has engines and files but no catalog.
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
      minutes: 14,
      body: `
        Partitioning prunes whole folders. Inside a partition, the order of rows decides how many
        files and row groups a filter can skip. That second layer is **clustering**.

        ## Linear sort order

        Sorting by «(city, event_ts)» makes every file cover one or a few cities, so «city = 'SF'»
        skips most files. But a filter on «event_ts» alone gets little help, because each city's
        rows span the full time range. A linear sort serves the **first** column well and later
        columns poorly.

        ## Z-ordering

        A Z-order curve interleaves the bits of several columns into one value and sorts by it.
        Rows close in **any** of the columns end up close on disk.

        ~~~text
        x = 2 → 10, y = 3 → 11
        interleave y1 x1 y0 x0 → 1 1 1 0 → z = 14
        sort rows by z → files cover small squares of the (x, y) space
        ~~~

        - Good for 2 to 4 columns that are filtered **independently**, such as «pickup_zone» and
          «driver_id».
        - Each extra column weakens the benefit for every column.
        - Use high-cardinality columns. A boolean or a three-value column gains little.

        ## How each platform does it

        | Platform | Feature |
        |---|---|
        | Delta Lake | «OPTIMIZE t ZORDER BY (a, b)»; or **liquid clustering** with «CLUSTER BY (a, b)» |
        | Iceberg | A table sort order; «rewrite_data_files» with a «sort» or «zorder(a, b)» strategy |
        | BigQuery | «CLUSTER BY» up to four columns, re-clustered automatically |
        | Snowflake | Micro-partitions with a clustering key, maintained by Automatic Clustering (billed) |

        ## Liquid clustering

        Delta's liquid clustering replaces fixed partitions and Z-order for many tables. You
        declare clustering columns, it clusters data incrementally (with a Hilbert curve), and you
        can **change the columns later** without rewriting the table. It cannot be combined with
        partitioning or Z-order on the same table.

        ## A decision path

        1. Is there a column in almost every filter with modest cardinality (a date)? Partition on it.
        2. Is there one more dominant filter column? Sort by it within partitions.
        3. Are there 2 to 4 columns filtered separately? Z-order or cluster on them.
        4. Do access patterns change, or is the table small to medium? Prefer liquid or automatic clustering.

        > [!trap] Clustering is not free or permanent
        > New writes arrive unsorted, so the layout decays. Clustering rewrites data and costs
        > compute. Schedule it on the partitions that are queried, not on ten years of history.

        > [!senior] Prove it with file skipping
        > Measure files scanned before and after: "The query read 1,800 of 2,000 files; after
        > Z-ordering on pickup_zone and driver_id it reads 140." Numbers like this show you
        > validated the layout instead of applying it by habit.
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
    companies: ['uber', 'google'],
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
    companies: ['google'],
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
    companies: ['uber'],
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
    companies: ['uber', 'google'],
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
    companies: ['uber'],
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
    companies: ['google', 'uber'],
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
        FROM staging.driver_changes
        QUALIFY ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY changed_at DESC) = 1
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

      - «QUALIFY» keeps the newest event per driver, so the source has one row per key and MERGE
        cannot hit "multiple source rows matched".
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
    companies: ['google', 'uber'],
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
    companies: ['uber'],
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
    companies: ['uber'],
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
    companies: ['google', 'uber'],
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
    companies: ['google'],
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
