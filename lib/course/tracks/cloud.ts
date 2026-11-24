import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'cloud',
  title: 'AWS, Azure and cloud DevOps',
  summary:
    'The AWS and Azure data stacks, plus the IAM, networking, Terraform, Docker, CI/CD and cost work every platform needs.',
  tone: 'soda',
  why: 'Senior loops assume you can build on whatever cloud the team runs. Interviewers probe the limits of S3, Kinesis and Redshift, who can read what, why the NAT bill jumped, and how a change reaches production without a console click.',
  lessons: [
    {
      slug: 'aws-storage-and-catalog',
      title: 'S3, the Glue catalog and Athena',
      summary:
        'Lay out a data lake on S3, know its request limits and missing rename, and query it through the Glue catalog.',
      minutes: 16,
      body: `
        ## Start with the problem

        A team moves its Hadoop jobs to AWS and keeps everything as it was, only pointing at S3. Within
        a month:

        - A failed job leaves half an output folder, and a dashboard reads it.
        - A streaming job writes millions of 10 KB files. The S3 request bill is bigger than the storage
          bill.
        - Athena queries that took 5 seconds now spend a minute just planning, because the table has
          200,000 partitions.

        On AWS the data lake is **Amazon S3**. Everything else, from Spark to Redshift, reads and writes
        objects there. Three facts about S3 decide most designs, and each one explains one of the
        problems above.

        ## Idea 1: strongly consistent, but no rename

        The good news first. Since December 2020, S3 gives **strong read-after-write consistency** for
        every PUT, DELETE and LIST. A reader sees a new object as soon as the write returns.

        The catch: S3 has **no rename**. A "rename" is a copy plus a delete, object by object. Like
        moving house by carrying each item separately to the new address, then going back to throw out
        the old one.

        The old Hadoop commit protocol writes to a temp folder and renames it at the end. On S3 that is
        slow and not atomic: a failed job can leave half a folder behind. The fixes:

        - Use a **table format** (Iceberg, Delta or Hudi). A commit is one atomic metadata swap.
        - For plain Parquet, use the S3A magic committer or the EMRFS S3-optimized committer.
        - Since 2024, S3 supports **conditional writes** («If-None-Match» and «If-Match»), so two
          writers cannot overwrite the same object by accident.

        ## Idea 2: request limits are per prefix

        A **prefix** is the start of an object's key, like a folder path. S3 serves at least **3,500
        PUT, COPY, POST or DELETE** and **5,500 GET or HEAD requests per second per prefix**. It splits a
        busy prefix over time. Until it does, extra requests get «503 SlowDown».

        How layout plays out:

        - «s3://lake/raw/trips/dt=2026-11-03/»: one hot prefix per day. Fine for most loads.
        - Millions of 10 KB files: request cost and listing time dominate. Compact them.
        - 128 MB to 1 GB Parquet files: the sweet spot for Spark, Athena and Redshift Spectrum.

        Each request costs money. Ten million small PUTs cost more than the storage of the bytes in them.
        Like paying a fee per envelope: posting a book one page per envelope costs more than the book.

        ## Idea 3: storage classes, hot shelf to deep basement

        - **Standard:** hot data. The most expensive per GB.
        - **Intelligent-Tiering:** unknown access patterns. A small per-object monitoring fee.
        - **Standard-IA:** read about once a month. A 30-day minimum and a retrieval fee.
        - **Glacier Instant Retrieval:** read a few times a year. A 90-day minimum.
        - **Glacier Deep Archive:** compliance copies. Hours to restore, and a 180-day minimum.

        A **lifecycle rule** moves or expires objects by prefix and age. A versioned bucket also keeps old
        versions forever unless a rule expires noncurrent versions.

        ## Idea 4: the catalog and Athena

        Files alone are not tables. Something must say "this folder is the trips table, with these
        columns and partitions".

        - The **AWS Glue Data Catalog** is a Hive-compatible metastore: databases, tables, columns and
          partitions over S3 paths. Athena, EMR, Glue jobs and Redshift Spectrum all read it.
        - **Crawlers** infer schemas, but they guess. On a stable pipeline, register tables from code.
        - **Athena** is serverless SQL over the catalog (Trino and Spark engines). SQL queries cost about
          **$5 per TB scanned**. Parquet plus partition filters is the whole cost strategy.
        - **Partition projection** computes partitions from a pattern, so Athena does not list thousands
          of partitions from the catalog. That fixes the slow planning in the story.
        - **Lake Formation** adds fine-grained grants on catalog tables: column and row filters, and
          tag-based access (LF-tags).
        - **S3 Tables** (2024) are managed Iceberg tables in a special bucket type, with compaction run
          for you.

        ## Now say it like a senior engineer

        S3 is strongly consistent but has no atomic rename, so writes commit through a table format or an
        S3-aware committer. Request limits and per-request cost favour 128 MB to 1 GB files. Tables live
        in the Glue catalog, Athena is priced per byte scanned, and partition projection or table-format
        metadata avoids huge partition listings.

        > [!senior] Name the commit protocol
        > When you put S3 in a design, say how a write becomes visible: an Iceberg or Delta commit,
        > not "the job writes Parquet files". It answers the follow-up about half-written output
        > before it comes.

        > [!trap] The listing that takes an hour
        > A Hive table with 200,000 partitions makes every query plan list or fetch them all. Use
        > coarser partitions, partition projection or a table format with its own metadata.

        ## In one breath

        S3 is consistent but cannot rename, charges per request and limits each prefix, so commit through
        a table format and write big files. The Glue catalog turns folders into tables, and Athena bills
        by bytes scanned, so Parquet and partition filters are your cost plan.
      `,
      checks: [
        {
          question: 'Why is the classic "write to temp, then rename" commit a problem on S3?',
          options: [
            'S3 is eventually consistent for new objects',
            'S3 has no rename, so it is a copy and delete per object: slow and not atomic',
            'S3 cannot store Parquet',
            'Rename is free but limited to 100 objects',
          ],
          answer: 1,
          why: 'Without an atomic rename, a failed job can leave partial output. Table formats commit through one metadata swap instead.',
        },
        {
          question:
            'A Spark job writes into one prefix and gets 503 SlowDown errors. What is the limit it hit?',
          options: [
            'The bucket size limit',
            'The per-prefix request rate: about 3,500 writes and 5,500 reads per second',
            'The 5 GB single PUT limit',
            'The KMS key quota only',
          ],
          answer: 1,
          why: 'S3 scales request rates per prefix and returns SlowDown until it splits a hot prefix.',
        },
      ],
    },
    {
      slug: 'aws-compute-and-redshift',
      title: 'Glue, EMR and Redshift',
      summary:
        'Pick between Glue, EMR and Athena for Spark work, and design Redshift tables with the right distribution and sort keys.',
      minutes: 17,
      body: `
        ## Start with the problem

        You have one Spark job. On AWS you can run it five different ways, and the bill can differ by
        five times. Then the warehouse team says their Redshift join of trips to drivers takes 20 minutes,
        on a cluster that is mostly idle.

        Both problems have the same root: **where the work physically runs**. For Spark, the choice is
        about control, cost shape and team skills, not about features. For Redshift, it is about which
        rows sit on which machine.

        ## Idea 1: five places to run Spark, like five ways to get a car

        Buy, lease, rent by the hour, borrow a friend's, or take a taxi. Each fits a different driver.

        - **Glue jobs.** You manage the script. You pay for DPU-seconds (about $0.44 per DPU-hour). Best
          for spiky, medium jobs and small teams.
        - **EMR on EC2.** You manage cluster size, instance types and Spot. You pay for the instances plus
          an EMR fee. Best for large, steady jobs where tuning matters.
        - **EMR Serverless.** You manage the job and its limits. You pay for vCPU and memory per second.
          Spark without a cluster to run.
        - **EMR on EKS.** You manage Kubernetes. You pay for pods on your cluster. Best when a team
          already runs Kubernetes.
        - **Athena.** SQL only. You pay for bytes scanned. Best for ad hoc and light transforms.

        A few facts interviewers check:

        - A Glue **DPU** is 4 vCPU and 16 GB.
        - Glue adds **job bookmarks** to process only new files, and a **Flex** class that is cheaper
          for jobs that can wait.
        - At a steady heavy load, EMR on EC2 with **Spot task nodes** is usually the cheapest. Keep core
          nodes on demand: they hold HDFS and shuffle data, and losing them fails the job.

        ## Idea 2: Redshift is many workers, each with their own pile

        **Redshift** is an MPP columnar warehouse. A cluster has nodes, and each node has **slices**. A
        table's rows are spread over the slices.

        Think of a team of clerks, each with a pile of forms. To match each trip form with its driver
        form, a clerk needs both forms in their own pile. If they are in different piles, forms must be
        passed across the room first, and that is the slow part.

        A join or aggregation is fast when the rows it needs are already on the same slice.

        Around that core:

        - **RA3** nodes keep data in Redshift managed storage on S3, and cache hot blocks on local SSD,
          so storage and compute scale apart.
        - **Redshift Serverless** bills in RPU-hours while queries run. It suits uneven load.
        - **Spectrum** queries S3 tables from the Glue catalog. **Concurrency scaling** adds capacity for
          bursts. **Data sharing** lets other clusters read without copies.
        - **Zero-ETL integrations** replicate Aurora, RDS and DynamoDB tables into Redshift.

        ## Idea 3: distribution keys decide whose pile a row goes in

        ~~~sql
        CREATE TABLE fct_trips (
            trip_id     BIGINT,
            driver_id   BIGINT,
            city_id     INT,
            trip_date   DATE,
            fare_usd    DECIMAL(12, 2)
        )
        DISTSTYLE KEY
        DISTKEY (driver_id)
        SORTKEY (trip_date);

        CREATE TABLE dim_city (
            city_id     INT,
            city_name   VARCHAR(100)
        )
        DISTSTYLE ALL;
        ~~~

        - «KEY»: rows go by the hash of one column. For large tables joined on that column.
        - «ALL»: a full copy on every node. For small dimensions.
        - «EVEN»: round robin. For tables with no dominant join.
        - «AUTO»: Redshift chooses and changes it. The default; fine until a join is slow.

        Read the plan to see whether forms are being passed around:

        - «DS_DIST_NONE»: the join is co-located. Nothing moves.
        - «DS_BCAST_INNER»: the inner table is copied to every node.
        - «DS_DIST_BOTH»: both tables move. The most expensive case.

        The 20-minute join from the story showed «DS_DIST_BOTH». Distributing both tables on
        «driver_id» makes it «DS_DIST_NONE».

        ## Idea 4: sort keys and loading

        A **sort key** stores rows in order, so zone maps skip blocks a filter does not need. Put the
        column most queries filter on, usually the date, first.

        Load with «COPY» from S3, never row inserts. Split the input into files of similar size, with a
        file count that is a multiple of the slice count, so every slice works. Twelve slices and one
        giant file means one busy clerk and eleven waiting.

        ## Now say it like a senior engineer

        Choose Spark compute by cost shape and control: Glue for spiky jobs, EMR on EC2 with Spot task
        nodes for steady heavy load, serverless options to avoid clusters. In Redshift, co-locate the big
        join with a distribution key, replicate small dimensions, sort by the main filter, and load with
        COPY from evenly split files.

        > [!senior] Distribution key choice
        > Pick the column of the biggest join, and check it has many distinct values and no giant
        > value. A «DISTKEY» on a column where 30% of rows are null puts 30% of the table on one
        > slice. «SVV_TABLE_INFO.skew_rows» shows it.

        > [!trap] Spot for everything
        > Spot can save up to about 90%, and AWS can take the instance back with two minutes of
        > notice. Spot core nodes on a long EMR job turn savings into reruns.

        ## In one breath

        Pick where Spark runs by how much control you want and how steady the load is, and keep core
        nodes off Spot. In Redshift, put the rows that join together on the same slice, sort by the main
        filter, and load big evenly split files with COPY.
      `,
      checks: [
        {
          question:
            'A 2 TB fact table joins a 3,000-row city table. Which distribution suits the city table?',
          options: ['KEY on city_id', 'ALL', 'EVEN', 'No distribution style'],
          answer: 1,
          why: 'A small dimension copied to every node makes every join to it local.',
        },
        {
          question: 'The plan shows DS_DIST_BOTH on a large join. What does it mean?',
          options: [
            'The join is co-located',
            'Both tables are redistributed across the network for the join',
            'The inner table is broadcast',
            'The join ran on the leader node',
          ],
          answer: 1,
          why: 'DS_DIST_BOTH moves both sides. Matching distribution keys on the join column avoid it.',
        },
      ],
    },
    {
      slug: 'aws-streaming-and-orchestration',
      title: 'Kinesis, MSK and Step Functions',
      summary:
        'Size a Kinesis stream, choose between Kinesis and MSK, and choose between Step Functions and Airflow.',
      minutes: 16,
      body: `
        ## Start with the problem

        The trips app sends 40,000 events a second. Five teams want to read them: fraud, pricing, the
        lake, a live dashboard and a search index. Then, when a file lands, a chain of AWS steps must run,
        and each night a calendar of dependent data jobs must run too.

        On AWS you have two logs (Kinesis and MSK), one pipe (Firehose) and two schedulers (Step
        Functions and Airflow). Picking well means knowing what each one is really built for.

        ## Idea 1: Kinesis Data Streams, a log cut into lanes

        A Kinesis stream is a log split into **shards**. Think of a motorway with lanes. Each lane has a
        speed limit.

        In provisioned mode, each shard takes up to **1 MB/s or 1,000 records/s in** and gives **2 MB/s
        out**. All standard consumers share the 2 MB/s out, with up to 5 read calls per second per shard.

        - **Enhanced fan-out** gives each registered consumer its own 2 MB/s per shard, pushed over
          HTTP/2. Use it with more than two or three consumers. With five teams reading, you need it.
        - The **partition key** picks the shard. Order holds inside a shard only. A hot key makes a hot
          shard, and more shards do not help: one lane is jammed however many lanes you add.
        - Retention is 24 hours by default and up to 365 days.
        - **On-demand mode** scales shards for you. It costs more per GB at a steady load.
        - The **KCL** keeps checkpoints and shard leases in a DynamoDB table.

        Sizing example: 40,000 events per second of 1 KB each is 40 MB/s in. That needs at least 40
        shards for the bytes and 40 for the record count. Add headroom for peaks: about 60 shards.

        **Amazon Data Firehose** delivers a stream to S3, Redshift, OpenSearch, Snowflake or Iceberg
        tables. It buffers by size and time, and can convert JSON to Parquet. It has no replay and no
        custom consumers. It is a pipe, not a log.

        ## Idea 2: MSK, managed Kafka

        **Amazon MSK** runs Apache Kafka.

        - **Provisioned** clusters use Standard or Express brokers.
        - **MSK Serverless** sizes itself, with lower limits.
        - **MSK Connect** runs Kafka Connect.

        Kinesis or MSK, side by side:

        **Kinesis Data Streams.**

        - API: the AWS SDK and the KCL.
        - Scale unit: the shard.
        - Retention: up to 365 days.
        - Ops work: almost none.
        - Ecosystem: AWS services, Flink.
        - Lock-in: AWS only.

        **MSK.**

        - API: Kafka clients, Connect, Streams.
        - Scale unit: the partition and the broker.
        - Retention: set by you, with tiered storage for long periods.
        - Ops work: brokers, partitions, upgrades, quotas.
        - Ecosystem: every Kafka tool, Debezium, schema registries.
        - Lock-in: the Kafka protocol is portable.

        Choose Kinesis for an AWS-native team with few consumers and no Kafka skills. Choose MSK when you
        need the Kafka ecosystem, Debezium CDC, many consumer groups, or a path to another cloud.
        **Amazon Managed Service for Apache Flink** runs Flink jobs on either one.

        ## Idea 3: Step Functions or Airflow

        **Step Functions** is a serverless state machine. It calls AWS services directly, with retries,
        catches and parallel branches. Two types:

        - **Standard:** runs for up to one year. Exactly once per step. Priced by state transitions.
        - **Express:** runs for up to five minutes. At least once. Priced by requests and duration.

        A **Distributed Map** state fans out over millions of S3 objects. **MWAA** is managed Airflow.
        **EventBridge Scheduler** starts either one on a schedule.

        Think of a relay race versus a train timetable. Step Functions is the relay: one event starts it,
        and each runner hands the baton to the next. Airflow is the timetable: every day has its runs, and
        you can rerun last Tuesday.

        ## Now say it like a senior engineer

        Kinesis scales by shards at 1 MB/s in and 2 MB/s out each, keeps order per partition key, and
        needs enhanced fan-out for many consumers. MSK brings the Kafka ecosystem at the cost of
        operations. Firehose is delivery without replay. Step Functions runs event-driven AWS chains;
        Airflow runs data calendars with backfills.

        > [!senior] Event workflows versus a data calendar
        > Step Functions fits event-driven chains of AWS calls: a file lands, a Glue job runs, a
        > Lambda checks the result. Airflow fits a calendar of dependent data intervals with
        > backfills, catch-up and many teams' DAGs. Many platforms use both.

        > [!trap] Shards for the bytes, not the keys
        > Ten times more shards do not fix one partition key that carries 20% of traffic. Salt the
        > key, or aggregate before you write.

        ## In one breath

        Kinesis is a log in shard-sized lanes, MSK is Kafka you operate less of, and Firehose is a pipe
        with no replay. Use Step Functions for event-driven chains of AWS steps and Airflow for a calendar
        of data runs you may need to backfill.
      `,
      checks: [
        {
          question: 'Five consumer apps read one Kinesis stream and fall behind. What helps most?',
          options: [
            'A longer retention period',
            'Enhanced fan-out, so each consumer gets its own 2 MB/s per shard',
            'A bigger partition key',
            'Firehose',
          ],
          answer: 1,
          why: 'Standard consumers share 2 MB/s per shard. Enhanced fan-out gives each one its own.',
        },
        {
          question: 'A workflow must wait up to three days for a human approval. Which fits?',
          options: [
            'Step Functions Express',
            'Step Functions Standard',
            'A Lambda function',
            'Firehose',
          ],
          answer: 1,
          why: 'Standard workflows run up to a year. Express workflows stop after five minutes.',
        },
      ],
    },
    {
      slug: 'azure-data-stack',
      title: 'The Azure data stack',
      summary:
        'Use ADLS Gen2, Data Factory, Synapse and Event Hubs, and map each service to its AWS and GCP peer.',
      minutes: 16,
      body: `
        ## Start with the problem

        You know AWS well. The interviewer says: "We are an Azure shop. How would you build this?" You
        know the patterns, a log, a lake, a warehouse and an orchestrator, but not the Azure names, and
        some Azure services behave differently in ways that matter.

        This lesson maps the Azure data stack piece by piece, and ends with one table you can use in any
        cloud.

        ## Idea 1: ADLS Gen2, a lake with real folders

        **Azure Data Lake Storage Gen2** is Blob Storage with the **hierarchical namespace** turned on.

        On S3, a "folder" is only the start of a name, so renaming it means copying every file. On ADLS
        Gen2, folders are real. Like a real filing cabinet versus labels written on loose papers.

        - A directory rename is one atomic operation.
        - POSIX-style ACLs apply per folder and file.
        - Spark commits are cheaper than on a flat object store.

        Turn the namespace on when you create the account. You cannot turn it off later.

        ## Idea 2: Data Factory, the scheduler and mover

        **Data Factory** (ADF) is the managed orchestration and copy service.

        - A **pipeline** holds **activities**: Copy, a Databricks notebook, a stored procedure, a ForEach
          loop and so on.
        - A **linked service** is a connection. A **dataset** points at data through it.
        - **Triggers**: schedule, **tumbling window** (fixed intervals with dependencies and backfill),
          and storage events.
        - The **integration runtime** (IR) is the compute.
          - The **Azure IR** runs in the cloud.
          - A **self-hosted IR** runs on a machine inside your network, to reach on-premises databases.
          - The **Azure-SSIS IR** runs old SSIS packages.

        Mapping data flows run on managed Spark. They are fine for simple shapes. Heavy logic belongs in
        Databricks, Spark or SQL, with ADF as the scheduler.

        ## Idea 3: Synapse and Fabric

        **Azure Synapse Analytics** joins three engines:

        - A **dedicated SQL pool**: an MPP warehouse sized in DWUs. Every table is spread over **60
          distributions**: **hash**, **round robin** or **replicated**. The same rules as Redshift apply:
          hash the big fact on its join key, replicate small dimensions.
        - A **serverless SQL pool**: SQL over lake files, about $5 per TB processed.
        - **Spark pools**.

        Microsoft now puts new analytics work into **Microsoft Fabric** (generally available since
        November 2023). Fabric is a SaaS platform on **OneLake**, with Delta tables as the shared format.
        Synapse is still supported. For a new platform, expect "why not Fabric?", and know that **Azure
        Databricks** is the other common answer.

        ## Idea 4: Event Hubs, the Azure event log

        **Event Hubs** has **partitions** and **consumer groups**, like Kafka.

        - On Standard, capacity is **throughput units**. Each gives 1 MB/s or 1,000 events/s in and 2
          MB/s out. Auto-inflate adds units under load.
        - Standard and higher tiers speak the **Kafka protocol**. Kafka clients connect with a config
          change.
        - **Capture** writes the stream to ADLS or Blob as Avro files, on a time or size window.
        - On Standard, the partition count is fixed when you create the hub. Plan it for the peak.

        ## Idea 5: one job, three clouds

        Same job, three names. Read each line as AWS / Azure / GCP.

        - **Object store:** S3 / ADLS Gen2 / Cloud Storage.
        - **Table catalog:** Glue Data Catalog / Unity Catalog or Purview / Dataplex, BigLake metastore.
        - **SQL on the lake:** Athena / Synapse serverless, Fabric / BigQuery external tables.
        - **Warehouse:** Redshift / Synapse dedicated, Fabric Warehouse / BigQuery.
        - **Managed Spark:** EMR, Glue / Databricks, Synapse Spark / Dataproc.
        - **Event log:** Kinesis Data Streams / Event Hubs / Pub/Sub.
        - **Managed Kafka:** MSK / Event Hubs Kafka endpoint / Managed Service for Apache Kafka.
        - **Airflow:** MWAA / Apache Airflow jobs in Fabric / Cloud Composer.
        - **Workflow engine:** Step Functions / Logic Apps, ADF pipelines / Workflows.
        - **Workload identity:** IAM role / managed identity / service account.
        - **Secrets:** Secrets Manager / Key Vault / Secret Manager.

        ## Now say it like a senior engineer

        ADLS Gen2 adds a real namespace with atomic renames and ACLs. ADF orchestrates and copies through
        integration runtimes, with heavy logic elsewhere. Synapse dedicated pools distribute like
        Redshift, Fabric is the new default on OneLake, and Event Hubs is a partitioned log with a Kafka
        endpoint.

        > [!senior] Answer in the interviewer's cloud
        > Design with the pattern first (log, lake, warehouse, orchestrator), then name the service
        > for their cloud. A senior engineer moves between clouds with this table, not by
        > relearning the job.

        > [!trap] Event Hubs is not all of Kafka
        > The Kafka endpoint speaks the protocol. Compacted topics, Kafka Streams state stores and
        > some admin APIs have limits or tier rules. Check before you promise a lift-and-shift.

        ## In one breath

        Azure has a lake with real folders (ADLS Gen2), a scheduler and mover (ADF), warehouses in
        Synapse and Fabric, and a Kafka-like log (Event Hubs). Design with the pattern first, then name
        the service for the interviewer's cloud.
      `,
      checks: [
        {
          question: 'Why turn on the hierarchical namespace in ADLS Gen2 for a Spark lake?',
          options: [
            'It makes storage free',
            'Directory rename becomes atomic, and ACLs work per folder',
            'It enables the Kafka endpoint',
            'It is required for Avro files',
          ],
          answer: 1,
          why: 'Real directories give atomic renames and folder ACLs, which helps Spark commits and access control.',
        },
        {
          question:
            'ADF must copy tables from a SQL Server inside the company network. What runs it?',
          options: [
            'The Azure integration runtime',
            'A self-hosted integration runtime inside the network',
            'A tumbling window trigger',
            'A serverless SQL pool',
          ],
          answer: 1,
          why: 'A self-hosted IR runs inside the private network and pushes data out over outbound connections.',
        },
      ],
    },
    {
      slug: 'iam-and-networking',
      title: 'IAM and networking for data platforms',
      summary:
        'Grant least privilege with roles instead of keys, share data across accounts, and route traffic so it is private and cheap.',
      minutes: 17,
      body: `
        ## Start with the problem

        A Spark job in the analytics account must read trips from a bucket in the data account. It fails
        with "Access Denied". The engineer adds «s3:*» on «*» to the role. Still denied. Then it works in
        dev, and fails an audit in production.

        The same month, the cloud bill shows $13,500 for something called "NAT gateway".

        Both come from the same gap: data engineers often treat identity and networking as someone
        else's job. In interviews, and on call, they are yours.

        ## Idea 1: IAM in four ideas

        Think of an office building with key cards.

        1. A **principal** (a user, a role, a service) makes a request. The person at the door.
        2. A **policy** allows or denies actions on resources. An **explicit deny always wins**. With no
           allow, the answer is deny. The door's rule list.
        3. A **role** has no password or key. A principal assumes it and gets credentials that expire in
           minutes or hours. A visitor badge that stops working tonight.
        4. **Identity-based** policies attach to the caller. **Resource-based** policies, such as an S3
           bucket policy or a KMS key policy, attach to the resource. Rules on the card, and rules on the
           door.

        A read-only grant on one prefix needs two statements, because «ListBucket» acts on the bucket and
        «GetObject» acts on objects:

        ~~~json
        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Sid": "ListTripsPrefix",
              "Effect": "Allow",
              "Action": "s3:ListBucket",
              "Resource": "arn:aws:s3:::acme-lake-prod",
              "Condition": { "StringLike": { "s3:prefix": ["curated/trips/*"] } }
            },
            {
              "Sid": "ReadTrips",
              "Effect": "Allow",
              "Action": "s3:GetObject",
              "Resource": "arn:aws:s3:::acme-lake-prod/curated/trips/*"
            }
          ]
        }
        ~~~

        ## Idea 2: cross-account access needs both sides

        Large companies keep data in its own AWS account. A reader in another account needs **both
        sides** to allow it. Like visiting a friend's building: your company must let you go, and their
        building must let you in.

        - Same account: the identity policy **or** the resource policy can allow.
        - Cross account: the caller's identity policy **and** the bucket policy must allow.
        - If objects use a customer-managed **KMS key**, the key policy must allow the reader too. This
          is the step people forget, and the error says "Access Denied". That is the story above: «s3:*»
          never helps when the key policy says no.

        At the organisation level, **service control policies** cap what any account may do. **Permission
        boundaries** cap what a role may grant.

        ## Idea 3: no long-lived keys

        Workloads get identity from the platform, never from a key in a file:

        - EC2 and EMR: an **instance profile**. EKS: **IRSA** or **EKS Pod Identity**.
        - CI: **OIDC federation**. GitHub Actions exchanges a signed token for a role.
        - Azure: a **managed identity** with Azure RBAC roles. GCP: a service account with workload
          identity federation.

        ## Idea 4: networking for data engineers

        A **VPC** is your private estate. **Subnets** are its streets. A private subnet has no road from
        the internet.

        - A **NAT gateway** lets private machines call out. It charges per hour and per GB processed:
          about $0.045 per GB in us-east-1. A toll booth on the way out.
        - A **gateway endpoint** for S3 and DynamoDB routes that traffic privately, and it is **free**. A
          private road with no toll. **Interface endpoints** (PrivateLink) reach other services for an
          hourly and per-GB fee.
        - **Security groups** are stateful and attach to instances. **Network ACLs** are stateless and
          attach to subnets.
        - Data between Availability Zones costs about $0.01 per GB in each direction. Kafka that
          replicates across three zones pays it on every byte.
        - Azure: a **VNet**, **private endpoints** for storage and databases, and managed virtual
          networks in ADF and Synapse.

        Tiny example, the NAT bill: 300 TB a month × 1,000 GB × $0.045 is about $13,500. Through a
        gateway endpoint it is $0.

        ## Idea 5: encryption

        S3 encrypts every new object by default (SSE-S3). **SSE-KMS** with your own key adds key-level
        audit and control. Turn on **S3 Bucket Keys**, or a busy job can hit KMS request limits and costs.

        ## Now say it like a senior engineer

        Policies default to deny and an explicit deny wins. Cross-account reads need the identity policy,
        the bucket policy and the KMS key policy. Workloads use roles from the platform or OIDC, never
        keys. Private subnets reach S3 through a free gateway endpoint, not a NAT gateway.

        > [!senior] The NAT bill
        > An EMR cluster in a private subnet reading 300 TB a month from S3 through a NAT gateway
        > pays about $13,500 a month just for NAT processing. A free S3 gateway endpoint removes
        > it. Interviewers love this one because it is real.

        > [!trap] Wildcards that ship
        > «"Action": "s3:*"» on «"Resource": "*"» passes every test and fails every audit. Scope
        > actions and resources, and use IAM Access Analyzer to find what is unused.

        ## In one breath

        IAM says no unless something says yes, and across accounts the caller, the bucket and the KMS key
        must all say yes. Give workloads roles instead of keys, and send S3 traffic through a free gateway
        endpoint instead of a NAT gateway that charges per GB.
      `,
      checks: [
        {
          question:
            'A role in account A reads a bucket in account B, encrypted with a customer-managed KMS key in B. The bucket policy allows it, but reads fail. What is missing?',
          options: [
            'A NAT gateway',
            'The KMS key policy (and the role policy) must allow decrypt for the role',
            'Bucket versioning',
            'A larger instance type',
          ],
          answer: 1,
          why: 'Cross-account reads of SSE-KMS objects need the key to allow the caller, besides both S3 policies.',
        },
        {
          question: 'What is the cheapest private route from a private subnet to S3?',
          options: [
            'A NAT gateway',
            'An interface endpoint',
            'An S3 gateway endpoint',
            'A public IP on each instance',
          ],
          answer: 2,
          why: 'Gateway endpoints for S3 and DynamoDB have no hourly or per-GB charge.',
        },
      ],
    },
    {
      slug: 'terraform-and-docker',
      title: 'Terraform and Docker for data platforms',
      summary:
        'Manage buckets, roles and clusters as code with safe state, and build small, pinned, non-root images for jobs.',
      minutes: 17,
      body: `
        ## Start with the problem

        The data platform was built by clicking in the cloud console. Two years later:

        - Nobody knows why the lake bucket has a certain policy, or who added it.
        - Dev and prod were "the same", but a dozen settings now differ, and a job works in one and fails
          in the other.
        - Someone deletes the wrong bucket. There is no record of how it was set up.

        A console click has no review, no history and no undo. **Infrastructure as code** makes a platform
        reviewable, repeatable and recoverable. Docker does the same for the jobs that run on it.

        ## Idea 1: Terraform, a blueprint and a builder

        Think of building a house from a blueprint. The blueprint says what should exist. The builder
        compares it with the site and does only what is missing.

        - **Providers** talk to clouds. **Resources** are what you manage. **Modules** group them.
        - «terraform plan» shows the difference between code and reality. «apply» makes it so.
        - **State** maps each resource in code to a real object. It is the builder's notebook: "this
          bucket in the blueprint is that bucket on the site". Lose it, and Terraform no longer knows what
          it owns.

        ~~~hcl
        terraform {
          backend "s3" {
            bucket       = "acme-tf-state"
            key          = "data-platform/prod.tfstate"
            region       = "us-east-1"
            encrypt      = true
            use_lockfile = true
          }
        }

        resource "aws_s3_bucket" "lake" {
          bucket = "acme-lake-prod"

          lifecycle {
            prevent_destroy = true
          }
        }

        resource "aws_s3_bucket_versioning" "lake" {
          bucket = aws_s3_bucket.lake.id
          versioning_configuration {
            status = "Enabled"
          }
        }

        resource "aws_vpc_endpoint" "s3" {
          vpc_id            = aws_vpc.data.id
          service_name      = "com.amazonaws.us-east-1.s3"
          vpc_endpoint_type = "Gateway"
          route_table_ids   = [aws_route_table.private.id]
        }
        ~~~

        ## Idea 2: state rules

        - Keep state **remote, encrypted and locked**. Since Terraform 1.10, the S3 backend locks with a
          lock file («use_lockfile»), and the DynamoDB lock table is deprecated. On Azure, the «azurerm»
          backend locks with a blob lease.
        - State can hold secrets in plain text. Restrict who can read the state bucket.
        - Use **one state per environment and per blast radius**. A typo in the dev network must not be
          able to touch the prod lake.

        ## Idea 3: changing what already exists

        - **Adopt a resource made by hand:** an «import» block (Terraform 1.5+).
        - **Rename or move a resource in code:** a «moved» block, so Terraform does not destroy and
          recreate it.
        - **Find changes made outside Terraform:** «terraform plan -refresh-only».
        - **Never delete a data store by accident:** «prevent_destroy», plus cloud-side delete
          protection.

        HashiCorp moved Terraform to the Business Source License in 2023. **OpenTofu** is the open fork
        and reads the same code. Most teams can use either.

        ## Idea 4: Docker, a lunch box for your job

        Data jobs run in containers on Kubernetes, ECS, EMR on EKS, Cloud Run or a KubernetesPodOperator.
        A container is a lunch box: the job and everything it needs, packed so it tastes the same
        wherever it is opened. A good job image is:

        - **Pinned.** A fixed base image and a lockfile. The same tag builds the same image.
        - **Small.** A slim base and a multi-stage build, so build tools stay out.
        - **Cache-friendly.** Copy the lockfile and install before you copy the code, so a code change
          does not reinstall every package.
        - **Non-root**, with **no secrets** in any layer. Secrets come at runtime.
        - **Tagged with the git commit**, never deployed as «latest».

        ~~~dockerfile
        FROM python:3.12-slim AS build
        WORKDIR /build
        COPY requirements.lock .
        RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.lock

        FROM python:3.12-slim
        RUN useradd --uid 1001 --create-home job
        COPY --from=build /wheels /wheels
        RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels
        WORKDIR /app
        COPY --chown=job src/ ./src/
        USER job
        ENTRYPOINT ["python", "-m", "src.jobs.run"]
        ~~~

        Read it as two rooms. The first stage builds the wheels, with all the tools. The second stage
        copies only the wheels, installs them, and runs as a normal user. The tools never reach the final
        image.

        ## Now say it like a senior engineer

        Terraform state is remote, encrypted, locked and split by environment and blast radius. Existing
        resources are adopted with import blocks and renamed with moved blocks, and stateful resources
        carry prevent_destroy. Job images are pinned, multi-stage, non-root, secret-free and tagged by
        commit.

        > [!senior] Protect the data, not just the code
        > Terraform can recreate a cluster in minutes. It cannot recreate a deleted bucket's
        > contents. Say how you guard stateful resources: «prevent_destroy», versioning, delete
        > protection, and plans reviewed before apply.

        > [!trap] The rename that destroys
        > Renaming «aws_s3_bucket.lake» to «aws_s3_bucket.data_lake» in code makes the plan
        > destroy one bucket and create another. Read every "destroy" line in a plan. Add a
        > «moved» block.

        ## In one breath

        Terraform is a blueprint plus a builder's notebook: keep that state safe and separate, and never
        let a rename destroy a data store. Docker packs each job like a lunch box: pinned, small,
        non-root, without secrets, and tagged by commit.
      `,
      checks: [
        {
          question:
            'You rename a bucket resource in Terraform code. The plan wants to destroy and recreate it. What fixes it?',
          options: [
            'Run apply twice',
            'A moved block from the old address to the new one',
            'Delete the state file',
            'Use a bigger lock table',
          ],
          answer: 1,
          why: 'A moved block tells Terraform the object is the same, so it updates the address in state instead of replacing it.',
        },
        {
          question: 'Why copy the lockfile and install packages before copying the source code?',
          options: [
            'Docker requires that order',
            'So a code change reuses the cached dependency layer',
            'It makes the image run as non-root',
            'It removes secrets from the image',
          ],
          answer: 1,
          why: 'Layers rebuild from the first changed step. Dependencies change less often than code.',
        },
      ],
    },
    {
      slug: 'cicd-and-cost',
      title: 'CI/CD and cloud cost',
      summary:
        'Ship pipeline, dbt and infrastructure changes through CI/CD safely, and cut cloud cost with the levers that matter.',
      minutes: 16,
      body: `
        ## Start with the problem

        A data engineer changes one dbt model and merges it on Friday. On Monday:

        - An Airflow DAG has vanished, because the same PR had a typo in an import.
        - A dashboard shows doubled revenue, because the new join was never compared with production.
        - The cloud bill jumped 40%, and nobody can say which team or pipeline caused it.

        Code needs checks before it ships, data needs its own safe-change patterns, and cost needs to be
        visible. This lesson covers all three.

        ## Idea 1: CI, the checks on every pull request

        A pull request runs fast checks on what changed. Each one catches a different Monday surprise.

        - **Lint and format:** ruff for Python, SQLFluff for SQL.
        - **Unit tests:** pytest on small DataFrames for transform functions.
        - **DAG import test:** load every Airflow DAG and fail on any import error or cycle.
        - **dbt slim CI:** build only changed models and their children («state:modified+» with deferral
          to production).
        - **Data diff:** compare the changed model's output with production on a sample. That catches
          the doubled revenue.
        - **Terraform plan:** post the plan on the pull request, for review before merge.

        ## Idea 2: CD, one artifact, many environments

        Think of a dish that is tasted in the test kitchen, then served. You serve **the same dish**, not
        a new one cooked again for the restaurant.

        - Build once. Tag the image with the git commit, and promote the **same artifact** from dev to
          staging to production.
        - Give each environment its own account or project, with its own state and its own data.
        - Deploy with **OIDC federation**: the CI job assumes a role. No key lives in CI secrets.
        - Use **trunk-based** git: short branches, review, and protected «main». A «CODEOWNERS» file
          routes changes to the owning team.

        ## Idea 3: changing data safely

        Code rolls back. Data does not, so data changes need their own patterns.

        - **Expand, migrate, contract** for schema: add the new column, backfill and switch readers, then
          drop the old column in a later release. Like building the new bridge before you close the old
          one.
        - **Blue-green tables:** build the new version beside the old one, check it, then swap a view or
          a pointer. Roll back by swapping back.
        - Run **backfills as separate, idempotent jobs** with a dry run first, not inside a deploy.

        ## Idea 4: where cloud money goes

        Six levers, each with its typical fix:

        - **Idle compute:** autoscaling, auto-suspend warehouses, job clusters instead of always-on ones.
        - **Unit price:** Spot for fault-tolerant work; Savings Plans or reservations for the steady
          base.
        - **Bytes scanned:** partition, cluster, columnar formats, no «SELECT *» on wide tables.
        - **Data transfer:** gateway endpoints, same-zone placement, no needless cross-region copies.
        - **Requests:** compact small files; batch writes.
        - **Storage:** lifecycle rules; expire old versions and temp data.

        ## Idea 5: make cost visible

        You cannot cut what you cannot see.

        - **Tag** every resource with team, pipeline and environment, and enforce it in Terraform.
        - Load the billing export (AWS CUR 2.0 through Data Exports, Azure Cost Management exports, GCP
          billing export) into the warehouse. Join it with job metadata.
        - Track a **unit cost**, such as dollars per TB processed or per 1,000 trips, not just the
          monthly total. A bill that grows with the business is fine. A unit cost that grows is waste.
        - Set **budgets** and **anomaly detection** alerts that go to the owning team.

        Tiny example. The bill went from $50,000 to $70,000. Trips also went from 10 million to 14
        million. Cost per 1,000 trips stayed at $5. Nothing is wrong. If trips had stayed at 10 million,
        cost per 1,000 trips would be $7, and that is the waste to hunt.

        ## Now say it like a senior engineer

        CI runs lint, unit tests, DAG import tests, dbt slim CI, data diffs and Terraform plans. CD
        promotes one commit-tagged artifact through isolated environments with OIDC. Data changes use
        expand-migrate-contract, blue-green tables and separate idempotent backfills. Cost work starts from
        tagged billing data and unit cost.

        > [!senior] Lead with measurement
        > "Cut cost by 30%" answers start with where the money goes, ranked, then the cheapest fix
        > for the biggest line. Name the guardrail too: which SLA you watch while you cut.

        > [!trap] Savings Plans first
        > A commitment locks in today's waste for one to three years. Remove idle and oversized
        > resources first, then commit to the steady base that is left.

        ## In one breath

        Check every pull request with tests, DAG imports, slim dbt builds and data diffs, then promote the
        same artifact everywhere. Change data with expand and contract or blue-green swaps, and manage cost
        by tagging everything and watching the cost per unit of business.
      `,
      checks: [
        {
          question: 'Why promote the same image from staging to production instead of rebuilding?',
          options: [
            'Rebuilding is not allowed by Docker',
            'The thing you tested is exactly the thing you ship',
            'It makes the image smaller',
            'Production cannot run builds',
          ],
          answer: 1,
          why: 'A rebuild can pick up different dependencies or base layers. Promotion ships the tested artifact.',
        },
        {
          question:
            'What should come before buying a three-year compute commitment for a data platform?',
          options: [
            'Nothing: commit as early as possible',
            'Removing idle and oversized resources, then committing to the steady base',
            'Moving everything to on-demand',
            'Turning off tagging',
          ],
          answer: 1,
          why: 'A commitment on wasteful usage locks in the waste. Right-size first.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'aws-ride-events-platform',
    title: 'Design a ride events platform on AWS',
    track: 'cloud',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      A ride-hailing company runs on AWS. Phones and services send about 50,000 events per second
      at peak (trip state changes, driver locations, payments), about 1 KB each. Design the
      platform so that:

      - City operators see supply and demand per city with under one minute of delay.
      - Analysts query hourly-fresh trip facts with SQL, and finance gets exact daily revenue.
      - Raw events are kept for two years, and any day can be reprocessed.

      Name the AWS services, and explain sizing, failure handling and cost.
    `,
    hints: [
      'Start with one durable log that every consumer reads.',
      'The one-minute view and the exact revenue have different correctness needs.',
      'Where does a reprocess read from, and how does it avoid double counting?',
    ],
    answer: `
      **Ingest.** Producers write to **MSK** (or Kinesis Data Streams for an AWS-only team with few
      consumers). 50 MB/s at peak with headroom: about 100 partitions on MSK, keyed by «trip_id»
      for trip events and by «city_id» plus a salt for locations. Use a schema registry, so a bad
      producer fails at write time.

      **Real-time path.** A **Flink** job on Managed Service for Apache Flink reads the log, keeps
      one-minute event-time windows per city with a watermark of about 30 seconds, and writes to a
      low-latency store (DynamoDB or a real-time OLAP store) behind the operator dashboard. It is
      approximate by design, and late events update the window.

      **Lake path.** A Kafka Connect S3 sink (MSK Connect) or Flink writes raw events to **S3**
      every few minutes, then a job commits them to **Iceberg** tables registered in the **Glue
      Data Catalog**, partitioned by event date. Raw stays immutable for two years, with lifecycle
      rules to Standard-IA after 30 days and Glacier Instant Retrieval after 180.

      **Batch and serving.** Hourly Spark on **EMR** (Spot task nodes, on-demand core) or dbt on
      **Redshift** builds trip facts with a «MERGE» on «trip_id», so reruns are idempotent. Finance
      revenue is computed per day after a lateness cutoff and reconciled with the payments
      system. **Redshift Serverless** or Athena serves analysts. **MWAA** schedules it.

      **Reprocess.** Any day rebuilds from raw S3, writing a new Iceberg snapshot, so readers never
      see half a day.

      **Security and network.** Each workload has its own IAM role. The lake sits in a data
      account. Private subnets reach S3 through a gateway endpoint, not NAT. KMS keys per domain.

      **Cost.** Biggest lines: brokers and cross-AZ replication, EMR compute, Redshift. Tag by
      pipeline and watch dollars per million events.
    `,
    signals: [
      'Uses one durable log as the source for both real-time and batch paths',
      'Separates approximate real-time numbers from exact, reconciled revenue',
      'Sizes the log from the numbers given, and handles hot keys',
      'Makes writes idempotent and reprocessing safe with a table format',
      'Covers IAM, private networking and the cost of cross-AZ traffic and NAT',
    ],
    followUps: [
      'The Flink job is down for 20 minutes. What do operators see, and how does it catch up?',
      'How would this design change on Azure?',
    ],
  },
  {
    slug: 'kinesis-or-msk',
    title: 'Kinesis or MSK for a new event stream',
    track: 'cloud',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'microsoft'],
    prompt: `
      Your team is starting an AWS event pipeline: 20 MB/s today, maybe 200 MB/s in two years.
      Six teams want to consume it, one needs CDC from Postgres, and the platform team has two
      engineers. Do you choose Kinesis Data Streams or Amazon MSK? Defend the choice.
    `,
    hints: [
      'Count consumers. What does Kinesis give each consumer per shard?',
      'What does CDC from Postgres usually run on?',
      'Who will run brokers, and is there a middle option?',
    ],
    answer: `
      Compare on what this team needs, not on features in general.

      - **Consumers.** Six consumers share 2 MB/s per shard on Kinesis unless each uses enhanced
        fan-out, which costs extra per consumer. Kafka consumer groups read independently at no
        extra charge per group.
      - **CDC.** Debezium is the standard Postgres CDC tool, and it runs on Kafka Connect. MSK
        Connect runs it. On Kinesis you would use DMS or a custom bridge.
      - **Growth.** 200 MB/s is 200 provisioned shards or on-demand mode on Kinesis, and a larger
        cluster with more partitions on MSK. Both work. Plan Kafka partitions for the peak, because
        adding partitions later changes key-to-partition mapping.
      - **Ops.** Two engineers is the strongest argument for Kinesis. MSK Serverless or Express
        brokers cut broker work.

      **Recommendation:** MSK, provisioned with Express brokers, or MSK Serverless while volume is
      low. The Kafka ecosystem (Debezium, Connect, schema registry, many consumer groups) is the
      reason. Choose Kinesis if the consumers are mostly AWS services such as Lambda and Firehose
      and nobody needs Kafka tools.
    `,
    signals: [
      'Quantifies the shared 2 MB/s per shard and the cost of enhanced fan-out',
      'Connects CDC to Debezium and Kafka Connect',
      'Weighs operational load against the team size',
      'Mentions partition planning for growth',
      'Gives a clear recommendation and the condition that would flip it',
    ],
    followUps: ['How would you migrate if you chose Kinesis and later needed Kafka?'],
  },
  {
    slug: 'redshift-slow-join',
    title: 'Fix a slow Redshift join',
    track: 'cloud',
    kind: 'modeling',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      A daily report joins two large Redshift tables and takes 40 minutes. Both were created with
      «DISTSTYLE EVEN». The plan shows «DS_DIST_BOTH» on the join. How do you fix it?

      ~~~sql
      SELECT p.city_id, SUM(p.amount_usd) AS revenue
      FROM fct_trips t
      JOIN fct_payments p ON p.trip_id = t.trip_id
      WHERE t.trip_date = CURRENT_DATE - 1
      GROUP BY p.city_id;
      ~~~
    `,
    hints: [
      'What does DS_DIST_BOTH say the cluster does before the join?',
      'Which column joins the two tables?',
      'How does Redshift skip blocks for the date filter?',
    ],
    answer: `
      «DS_DIST_BOTH» means both tables move across the network so matching «trip_id» values meet
      on the same slice. With «EVEN», rows sit wherever round robin put them.

      1. **Co-locate the join.** Set «DISTKEY (trip_id)» on both tables. Matching rows then live on
         the same slice, and the plan shows «DS_DIST_NONE».
      2. **Check skew first.** «trip_id» has billions of distinct values and no nulls, so it
         spreads well. Check «SVV_TABLE_INFO.skew_rows» after the change.
      3. **Sort for the filter.** «SORTKEY (trip_date)» on «fct_trips», so zone maps skip all but
         one day. Payments can sort by its own date.
      4. **Rebuild.** «ALTER TABLE ... ALTER DISTKEY» changes it in place, or deep copy into a new
         table and swap.

      ~~~sql
      ALTER TABLE fct_trips ALTER DISTSTYLE KEY DISTKEY trip_id;
      ALTER TABLE fct_payments ALTER DISTSTYLE KEY DISTKEY trip_id;
      ALTER TABLE fct_trips ALTER SORTKEY (trip_date);
      ~~~

      Trade-off: a table has one distribution key. If «fct_trips» also joins drivers often, pick
      the join that costs most, and make small dimensions «DISTSTYLE ALL».
    `,
    signals: [
      'Reads DS_DIST_BOTH as redistribution of both sides',
      'Co-locates both tables on the join key',
      'Checks the key for skew and nulls before choosing it',
      'Adds a sort key for the date filter',
      'Says a table has only one distribution key and picks the costliest join',
    ],
    followUps: ['The join key has 25% nulls. What now?'],
  },
  {
    slug: 's3-slowdown-small-files',
    title: 'A Spark job gets 503 SlowDown from S3',
    track: 'cloud',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'microsoft'],
    prompt: `
      An hourly Spark job writes about 2 million files of 20 KB each into
      «s3://lake/events/dt=2026-11-03/hr=09/». It fails with «503 SlowDown», and Athena queries on
      the table are slow and cost more than expected. What is happening, and how do you fix it?
    `,
    hints: [
      'What does S3 limit per prefix?',
      'Where do 2 million files come from in Spark?',
      'What does a reader pay for each file?',
    ],
    answer: `
      **Cause.** S3 serves about 3,500 writes per second per prefix and splits busy prefixes over
      time. Two million PUTs into one new prefix in a few minutes exceed it, so S3 throttles. The
      files are tiny because the job writes one file per task per output partition: many tasks
      times many small partitions.

      **Fix the writer.**

      - Repartition or coalesce before the write to target 128 MB to 1 GB files. About 40 GB per
        hour then becomes 40 to 300 files, not 2 million.
      - Turn on retries with backoff in the S3A or EMRFS client for the rest.
      - Write through a table format (Iceberg or Delta) with a target file size, and run
        compaction on old partitions.

      **Fix the readers.** Athena and Spark pay per file for open and list calls, and Parquet
      footers and row-group stats help less on tiny files. Fewer, larger files fix both cost and
      speed.

      Spreading writes across random prefixes also lifts the limit, but it breaks partition
      pruning. Use it only for write-heavy, rarely queried data.
    `,
    signals: [
      'Names the per-prefix request rate and throttling during prefix splits',
      'Traces the file count to Spark tasks times output partitions',
      'Targets a file size, not a file count',
      'Mentions compaction or a table format for the long term',
      'Explains why small files also hurt readers',
    ],
    followUps: ['How do you compact a partition while readers are querying it?'],
  },
  {
    slug: 'nat-gateway-bill',
    title: 'Private subnets raised the bill by $20,000',
    track: 'cloud',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      After moving EMR clusters into private subnets "for security", the monthly AWS bill for the
      data platform went from $60,000 to $80,000. Compute did not change. The cost explorer shows
      a large new line called "NAT Gateway - Bytes". The jobs read about 400 TB a month from S3.
      Explain the cause and the fix.
    `,
    hints: [
      'How do private subnets reach S3 by default?',
      'What does a NAT gateway charge per GB?',
      'Is there a private path to S3 that does not cost per GB?',
    ],
    answer: `
      **Cause.** Private subnets reach S3 through the NAT gateway, which charges about $0.045 per
      GB processed in us-east-1. 400 TB is about 400,000 GB, so about **$18,000 a month** in NAT
      processing, plus the hourly NAT fee per zone. That matches the jump.

      **Fix.** Add an **S3 gateway endpoint** to the VPC and its private route tables. S3 traffic
      then goes over the endpoint at no charge, and it stays private. Add a DynamoDB gateway
      endpoint too if jobs use it. For other AWS services with heavy traffic, compare interface
      endpoint fees with NAT fees.

      **Prevent it.** Put the endpoint in the Terraform module that creates the VPC. Add a
      cost-anomaly alert on NAT bytes and on cross-AZ transfer. Tag clusters, so the line is
      traced to a team in hours, not at month end.

      The security goal still holds: the endpoint policy can restrict access to the company's
      buckets only.
    `,
    signals: [
      'Identifies NAT per-GB processing as the cause, with arithmetic',
      'Proposes the free S3 gateway endpoint',
      'Keeps the security goal, for example with an endpoint policy',
      'Adds prevention: Terraform module default and anomaly alerts',
    ],
    followUps: ['Where else does a data platform pay for bytes moving: name two more lines.'],
  },
  {
    slug: 'cross-account-lake-access',
    title: 'Give an analytics account read access to the lake',
    track: 'cloud',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      The lake bucket lives in the «data-prod» AWS account and is encrypted with a
      customer-managed KMS key. A Spark job in the «analytics» account must read only
      «curated/trips/». Describe every grant needed, with least privilege, and how you would check
      it.
    `,
    hints: [
      'Cross-account S3 access needs two sides to agree.',
      'There is a third resource policy besides the bucket and the role.',
      'Is there a way to avoid per-bucket policy sprawl as more teams ask?',
    ],
    answer: `
      Use a role in «analytics» for the job, for example «trips-reader». Then grant on three sides.

      1. **Role policy in analytics.** Allow «s3:ListBucket» on the bucket with a condition on the
         prefix «curated/trips/*», «s3:GetObject» on «arn:aws:s3:::lake/curated/trips/*», and
         «kms:Decrypt» on the key ARN.
      2. **Bucket policy in data-prod.** Allow the same two S3 actions for the role ARN as
         principal, on the same resources.
      3. **KMS key policy in data-prod.** Allow «kms:Decrypt» for the role ARN. Without it,
         reads fail with Access Denied even when both S3 policies are right.

      **Check it.** Use the IAM policy simulator and IAM Access Analyzer. Then run a positive test
      (read a trips file) and a negative test (read «raw/» or another prefix must fail). Watch
      CloudTrail for denied calls.

      **At scale.** Per-bucket policies for every team do not scale. Register the tables in the
      Glue catalog and grant through **Lake Formation**, with column and row filters, or use **S3
      Access Points** with one policy per consumer.
    `,
    signals: [
      'States that cross-account access needs both the identity and the resource policy',
      'Remembers the KMS key policy',
      'Scopes ListBucket with a prefix condition and GetObject to the prefix',
      'Tests a negative case, not only the happy path',
      'Proposes Lake Formation or access points for scale',
    ],
    followUps: ['How do you revoke access fast if the analytics account is compromised?'],
  },
  {
    slug: 'terraform-destroys-bucket',
    title: 'Terraform plans to destroy the production lake',
    track: 'cloud',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'microsoft'],
    prompt: `
      A pull request refactors the Terraform for the data platform into modules. CI posts a plan
      that says: «aws_s3_bucket.lake will be destroyed» and «module.storage.aws_s3_bucket.lake will
      be created». The reviewer is about to approve because "it is the same bucket". What do you
      do, and what stops this class of mistake in future?
    `,
    hints: [
      'What does Terraform track: the bucket name or the resource address?',
      'There is a block for exactly this refactor.',
      'What protections do not depend on a careful reviewer?',
    ],
    answer: `
      **Stop the merge.** Terraform tracks resources by **address** in state. A new address with
      no state entry means "create", and the old address with no code means "destroy". The apply
      would try to delete the production bucket and create a new, empty one. It might fail
      because the bucket is not empty, but a safety net you did not plan is not a plan.

      **Fix the refactor.** Add a «moved» block:

      ~~~hcl
      moved {
        from = aws_s3_bucket.lake
        to   = module.storage.aws_s3_bucket.lake
      }
      ~~~

      Rerun the plan. It should show no changes, or only real ones.

      **Prevent it.**

      - «lifecycle { prevent_destroy = true }» on buckets, databases and key rings. A plan that
        destroys them fails.
      - Bucket versioning, and Object Lock or backups on critical data.
      - A CI check that fails the pull request when the plan destroys any resource of a stateful
        type, unless a label approves it.
      - Separate state for stateful and stateless resources, so routine cluster changes never
        touch data stores.
    `,
    signals: [
      'Explains that state tracks resource addresses',
      'Uses a moved block and verifies a no-op plan',
      'Adds prevent_destroy on stateful resources',
      'Adds an automated plan check, not only careful review',
      'Splits state by blast radius',
    ],
    followUps: [
      'Someone changed the bucket lifecycle rule in the console. How do you find and fix the drift?',
    ],
  },
  {
    slug: 'azure-onprem-migration',
    title: 'Move an on-premises warehouse to Azure',
    track: 'cloud',
    kind: 'design',
    difficulty: 'medium',
    companies: ['google', 'uber', 'amazon', 'microsoft'],
    prompt: `
      A retailer runs a 30 TB SQL Server warehouse on premises, loaded nightly by SSIS. They are
      moving to Azure. Some source systems must stay on premises for two more years. Design the
      target platform and the migration, and say how you would cut over without breaking reports.
    `,
    hints: [
      'How does an Azure service reach a database inside the company network?',
      'What happens to the SSIS packages on day one, and later?',
      'How do you prove the new numbers match the old ones?',
    ],
    answer: `
      **Target.**

      - **ADLS Gen2** with the hierarchical namespace as the lake, in bronze, silver and gold
        zones, stored as Delta tables.
      - **Azure Databricks** (or Fabric, if the company standardises on it) for transforms, with
        dbt or notebooks under version control.
      - Serving: a Databricks SQL warehouse or Fabric Warehouse for BI, with Power BI on top.
      - **Data Factory** for ingestion and scheduling. A **self-hosted integration runtime** on
        premises reaches the sources that stay, over outbound HTTPS or ExpressRoute.
      - Managed identities for services, Key Vault for remaining secrets, private endpoints for
        storage.

      **Migration.**

      1. Lift first: run the existing SSIS packages on an **Azure-SSIS IR**, so nightly loads keep
         working while you rebuild.
      2. Backfill history: bulk copy the 30 TB into bronze, then rebuild gold tables.
      3. Rebuild pipelines domain by domain as ADF copy plus Spark or dbt, replacing SSIS.
      4. **Run in parallel** for two to four weeks. Reconcile row counts and key totals (revenue
         per day per store) between old and new, and alert on any difference.
      5. Cut over reports domain by domain. Keep the old warehouse read-only for a fixed period,
         then retire it.

      **Risks.** Network bandwidth for the initial load (consider Data Box), SQL dialect
      differences (T-SQL to Spark SQL), and the gateway machines as a single point of failure: run
      at least two self-hosted IR nodes.
    `,
    signals: [
      'Uses a self-hosted integration runtime for sources that stay on premises',
      'Plans a lift-then-rebuild path instead of a big-bang rewrite',
      'Runs old and new in parallel with numeric reconciliation',
      'Cuts over by domain with a rollback window',
      'Calls out bandwidth, dialect and gateway availability risks',
    ],
    followUps: ['Leadership asks Synapse or Fabric or Databricks. How do you decide?'],
  },
  {
    slug: 'step-functions-or-airflow',
    title: 'Step Functions or Airflow',
    track: 'cloud',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'amazon', 'microsoft'],
    prompt: `
      A team on AWS asks whether to orchestrate pipelines with Step Functions or with Airflow on
      MWAA. Give the deciding questions and an answer for each case.
    `,
    hints: [
      'Is the work triggered by events or by a calendar of data intervals?',
      'What does a backfill look like in each one?',
    ],
    answer: `
      Ask four questions.

      1. **Trigger.** A file lands or an API call arrives: Step Functions. A daily or hourly
         interval of data: Airflow, whose runs are keyed by the interval.
      2. **Backfill.** Airflow can rerun 90 days of intervals with one command and respects
         dependencies. In Step Functions you write that loop yourself.
      3. **Steps.** Mostly AWS calls (Glue, Lambda, ECS, EMR): Step Functions calls them directly,
         with retries, and has no servers. Many systems outside AWS, or many teams' DAGs:
         Airflow, with its operators and UI.
      4. **Cost and ops.** Step Functions bills per state transition (Standard) and needs no
         cluster. MWAA bills for an environment that runs all the time.

      A common answer is both: Airflow owns the data calendar, and a Step Functions workflow
      handles an event-driven chain inside one task.
    `,
    signals: [
      'Separates event-driven workflows from interval-based data scheduling',
      'Brings up backfills and catch-up',
      'Compares the cost shape: per transition versus an always-on environment',
      'Says using both is valid and how they split',
    ],
    followUps: ['When would you pick Express workflows over Standard?'],
  },
  {
    slug: 'cut-cloud-cost-30',
    title: 'Cut the data platform bill by 30%',
    track: 'cloud',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'microsoft'],
    prompt: `
      The data platform costs $400,000 a month on AWS: EMR, Redshift, S3, MSK and data transfer.
      Leadership wants 30% off in two quarters without missing any data SLA. How do you run this?
    `,
    hints: [
      'You cannot cut what you cannot attribute. What do you build first?',
      'Rank by size and by effort. Which lines usually hide the most waste?',
      'What stops the savings from going away in six months?',
    ],
    answer: `
      **1. Attribute (weeks 1 to 3).** Load the cost and usage report into the warehouse. Enforce
      tags for team, pipeline and environment, and join costs to job metadata (EMR step, Airflow
      DAG, Redshift query group). Publish cost per pipeline and a unit cost, such as dollars per TB
      processed.

      **2. Rank and fix the big lines.** Typical findings, biggest first:

      - **Idle and oversized compute.** Always-on EMR clusters for nightly jobs: move to job
        clusters or EMR Serverless; right-size from utilisation. Redshift: pause dev clusters,
        move uneven load to Serverless, use concurrency scaling instead of a bigger base.
      - **Unit price.** Spot task nodes with instance fleets for fault-tolerant Spark. Then
        Savings Plans and Redshift reservations on the steady base that is left.
      - **Transfer.** Gateway endpoints instead of NAT for S3. Fetch-from-follower in the same
        zone for Kafka consumers, to cut cross-AZ bytes.
      - **Storage.** Lifecycle rules on raw and temp prefixes, expire noncurrent versions, delete
        abandoned tables after an owner check.
      - **Scans.** Partition and cluster the top 20 queried tables, and stop full refreshes that
        could be incremental.
      - **Dead pipelines.** Find outputs nobody read in 90 days (from query logs), confirm with
        owners, and turn them off.

      **3. Guard the SLAs.** Change one lever at a time, behind a rollback, while watching
      freshness and job duration dashboards.

      **4. Keep it.** Monthly cost review per team, budgets and anomaly alerts, cost shown in the
      pull request for Terraform changes, and unit cost as a platform KPI.

      Savings of 30% are realistic when idle compute and commitments were never managed, which is
      common.
    `,
    signals: [
      'Builds cost attribution before cutting',
      'Ranks levers by size and lists concrete ones per service',
      'Right-sizes before buying commitments',
      'Protects SLAs with one change at a time and monitoring',
      'Makes savings durable with ownership, alerts and a unit cost KPI',
    ],
    followUps: ['A team refuses to give up its always-on cluster. How do you handle it?'],
  },
];
