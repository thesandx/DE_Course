/**
 * Diagrams for line 3: Storing the data. Keyed by station slug; each diagram
 * names the concept it explains. See lib/course/gcp/README.md > Diagrams.
 */

import type { GcpDiagram } from '@/types/gcp';

export const DIAGRAMS: Readonly<Record<string, readonly GcpDiagram[]>> = {
  'storage-selection': [
    {
      concept: 1,
      kind: 'decision',
      title: 'Which database or store fits this workload?',
      scenario:
        'Every team at Cymbal asks for "a database". The right one depends on how the data is read and written. Ask these questions from the top and stop at the first "yes".',
      questions: [
        {
          ask: 'Is it files: images, logs, backups, a data lake?',
          yes: {
            icon: 'cloud-storage',
            label: 'Cloud Storage',
            note: 'Stores any object up to 5 TiB. Cheapest per GB.',
            tone: 'gold',
          },
        },
        {
          ask: 'Do analysts run SQL over huge data (terabytes to petabytes)?',
          yes: {
            icon: 'bigquery',
            label: 'BigQuery',
            note: 'A serverless data warehouse. Built to scan, not to serve an app.',
            tone: 'sky',
          },
        },
        {
          ask: 'Is it an app with relational data that must scale writes across the world?',
          yes: {
            icon: 'spanner',
            label: 'Spanner',
            note: 'Relational, strongly consistent, and it scales out. Up to 99.999% availability.',
            tone: 'brand',
          },
        },
        {
          ask: 'Is it an app with relational data in one region (up to about 64 TB)?',
          yes: {
            icon: 'cloud-sql',
            label: 'Cloud SQL, or AlloyDB',
            note: 'Managed MySQL, PostgreSQL or SQL Server. AlloyDB when you also run analytics on the live data.',
            tone: 'iris',
          },
        },
        {
          ask: 'Is it a flood of writes with lookups by key in milliseconds (IoT, time series)?',
          yes: {
            icon: 'bigtable',
            label: 'Bigtable',
            note: 'A wide-column store. One index only: the row key. No joins.',
            tone: 'teal',
          },
        },
        {
          ask: 'Is it documents for a web or mobile app, with nothing to manage?',
          yes: {
            icon: 'firestore',
            label: 'Firestore',
            note: 'A serverless document database. It scales by itself.',
            tone: 'easy',
          },
        },
      ],
      otherwise: {
        icon: 'memorystore',
        label: 'Memorystore',
        note: 'An in-memory cache for sessions and hot results. It sits beside a real database, never in place of one.',
        tone: 'hard',
      },
      walk: [
        'Files and blobs are not database rows. They go to Cloud Storage.',
        'Analytics over big data goes to BigQuery.',
        'Transactions that must scale worldwide go to Spanner.',
        'Transactions in one region go to Cloud SQL or AlloyDB.',
        'Very high write rates with key lookups go to Bigtable.',
        'App documents with zero operations go to Firestore.',
      ],
      caption:
        'Three classic traps: BigQuery as an app database, Bigtable for under 1 TB or for joins, and Cloud SQL when writes must scale globally.',
    },
    {
      concept: 2,
      kind: 'compare',
      title: 'Bigtable row keys: one hot node, or an even spread',
      scenario:
        'Cymbal stores sensor readings in Bigtable. The table has 10 nodes, but it is slow. Bigtable sorts rows by key and each node owns a range of keys, so the key decides which node does the work.',
      columns: [
        {
          n: 1,
          icon: 'warning',
          label: 'Key starts with the timestamp',
          note: 'Bad',
          tone: 'hard',
          points: [
            'Every new reading has a key just after the last one.',
            'So every write goes to the same key range, on one node.',
            'That node is overloaded. The other nine are idle. Adding nodes changes nothing.',
          ],
          chips: ['20261112T0930#sensor17', '20261112T0931#sensor04'],
        },
        {
          n: 2,
          icon: 'bigtable',
          label: 'Key starts with the sensor id',
          note: 'Good',
          tone: 'easy',
          points: [
            'Thousands of sensors mean thousands of different key starts.',
            'Writes land on all nodes evenly.',
            'All readings of one sensor sit together, so "sensor 17, last hour" is one fast scan.',
          ],
          chips: ['sensor17#20261112T0930', 'sensor04#20261112T0931'],
        },
      ],
      walk: [
        'A key that begins with time puts all new rows in one place. That is a hotspot.',
        'A key that begins with a value that varies a lot (a sensor id, a user id) spreads the rows. Put the time second.',
      ],
      caption:
        'The row key is the only index. Never start it with a timestamp or a counter. A key of the sensor id alone is wrong too: one row then grows forever. Key Visualizer shows hotspots.',
    },
    {
      concept: 3,
      kind: 'spectrum',
      title: 'The operational databases, by how far they scale',
      scenario:
        'Cymbal needs a database behind an app. All four below handle transactions. They differ in how big and how global they can get.',
      from: 'One region, bigger machine',
      to: 'Global, more machines',
      stops: [
        {
          n: 1,
          icon: 'cloud-sql',
          label: 'Cloud SQL',
          note: 'MySQL, PostgreSQL, SQL Server. Grows by a bigger machine, up to 64 TB. A standby in another zone takes over automatically.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'alloydb',
          label: 'AlloyDB',
          note: 'PostgreSQL-compatible and faster. A built-in columnar engine runs analytics on live data.',
          tone: 'iris',
        },
        {
          n: 3,
          icon: 'firestore',
          label: 'Firestore',
          note: 'Documents, not tables. Serverless, with transactions. Nothing to size.',
          tone: 'easy',
        },
        {
          n: 4,
          icon: 'spanner',
          label: 'Spanner',
          note: 'Relational and it scales out by adding nodes, across regions.',
          tone: 'brand',
        },
      ],
      walk: [
        'Cloud SQL is the standard managed relational database for one region.',
        'AlloyDB is the choice when you need PostgreSQL with much more speed, or analytics on operational data.',
        'Firestore is the choice when the app stores documents and the team wants no infrastructure.',
        'Spanner is the choice when a relational database must grow without limit or span the world.',
      ],
      caption:
        'A Cloud SQL read replica does not take over by itself; the HA standby does. In Spanner, avoid keys that only increase. Memorystore is a cache, never the system of record.',
    },
    {
      concept: 4,
      kind: 'spectrum',
      title: 'Cloud Storage classes: pay by how often you read',
      scenario:
        'Cymbal keeps product photos, monthly reports and seven-year-old invoices in Cloud Storage. They are all read at very different rates, so they should not cost the same.',
      from: 'Read often: pay more to store',
      to: 'Read rarely: pay more to read',
      stops: [
        {
          n: 1,
          icon: 'cloud-storage',
          label: 'Standard',
          note: 'For data read every day. No minimum storage time.',
          tone: 'brand',
        },
        {
          n: 2,
          icon: 'cloud-storage',
          label: 'Nearline',
          note: 'Read about once a month. You pay for at least 30 days.',
          tone: 'gold',
        },
        {
          n: 3,
          icon: 'cloud-storage',
          label: 'Coldline',
          note: 'Read about once a quarter. You pay for at least 90 days.',
          tone: 'sky',
        },
        {
          n: 4,
          icon: 'cloud-storage',
          label: 'Archive',
          note: 'Read less than once a year. You pay for at least 365 days.',
          tone: 'iris',
        },
      ],
      walk: [
        'Standard has the highest storage price and no fee to read.',
        'Nearline is cheaper to store, but each read has a fee.',
        'Coldline is cheaper again, with a higher read fee.',
        'Archive is the cheapest to store and the most expensive to read.',
      ],
      caption:
        'Every class answers in milliseconds: colder does not mean slower. A lifecycle rule moves objects by age. Autoclass moves them for you when the pattern is unknown. Retention policy + Bucket Lock makes data impossible to delete.',
    },
    {
      concept: 5,
      kind: 'flow',
      title: 'BigQuery lowers the storage price for you',
      scenario:
        'Cymbal has five years of order history in BigQuery. A colleague wants to export old data to Cloud Storage to save money. Look at what BigQuery already does.',
      steps: [
        {
          n: 1,
          icon: 'bigquery',
          label: 'Active storage',
          note: 'A table or partition changed in the last 90 days. Full price.',
          tone: 'brand',
        },
        {
          n: 2,
          icon: 'dollar',
          label: 'Long-term storage',
          note: 'About half the price. Queries are just as fast.',
          tone: 'easy',
        },
        {
          n: 3,
          icon: 'clock',
          label: 'Expired',
          note: 'A partition expiration deletes data you no longer need.',
          tone: 'plain',
        },
      ],
      edges: ['90 days with no change', 'expiration date'],
      walk: [
        'New and changing data is billed as active storage.',
        'After 90 days with no change, the price drops by about half. You do nothing, and nothing gets slower.',
        'If you set an expiration, BigQuery deletes old partitions on that date.',
      ],
      caption:
        'Do not export old BigQuery data only to save money: long-term pricing already halves the cost. Partition the table by date, so old partitions go long-term while new ones change.',
    },
  ],
  'data-warehouse': [
    {
      concept: 1,
      kind: 'hub',
      title: 'A star schema: one fact table, dimensions around it',
      scenario:
        'Cymbal wants reports like "sales by product, by store, by month". A warehouse answers these with one table of events in the centre and small descriptive tables around it.',
      center: {
        icon: 'table',
        label: 'fact_sales',
        note: 'One row per sale: the amounts, plus a key to each dimension.',
      },
      spokes: [
        {
          n: 2,
          icon: 'users',
          label: 'dim_customer',
          note: 'Who bought: name, segment, city.',
          tone: 'sky',
        },
        {
          n: 2,
          icon: 'box',
          label: 'dim_product',
          note: 'What was sold: name, category, brand.',
          tone: 'iris',
        },
        {
          n: 2,
          icon: 'clock',
          label: 'dim_date',
          note: 'When: day, month, quarter, holiday.',
          tone: 'gold',
        },
        {
          n: 2,
          icon: 'globe',
          label: 'dim_store',
          note: 'Where: store, region, country.',
          tone: 'teal',
        },
      ],
      walk: [
        'The fact table is long and narrow. It records what happened and how much.',
        'Each dimension describes one side of the event. A report joins the fact to the dimensions it needs and groups by their columns.',
      ],
      caption:
        'When a dimension changes (a customer moves city), Type 1 overwrites the value. Type 2 adds a new row with valid_from and valid_to, so history is kept.',
    },
    {
      concept: 1,
      kind: 'compare',
      title: 'Three shapes for the same orders data',
      scenario:
        'An order has a customer and several order lines. You can store that in three ways. The right one depends on the database.',
      columns: [
        {
          n: 1,
          icon: 'cloud-sql',
          label: 'Normalised (3NF)',
          note: 'For apps: Cloud SQL, Spanner.',
          tone: 'sky',
          points: [
            'Separate tables: customers, orders, order_lines.',
            'Each fact is stored once, so an update is cheap and safe.',
            'Reading an order needs joins.',
          ],
        },
        {
          n: 2,
          icon: 'table',
          label: 'Star schema',
          note: 'For a classic warehouse.',
          tone: 'gold',
          points: [
            'A fact table plus dimension tables.',
            'A few simple joins. BI tools understand it.',
            'Small dimensions join cheaply in BigQuery.',
          ],
        },
        {
          n: 3,
          icon: 'bigquery',
          label: 'Nested and repeated',
          note: 'What BigQuery likes best.',
          tone: 'brand',
          points: [
            'One row per order. The order lines sit inside that row as an «ARRAY» of «STRUCT».',
            'No join is needed to read an order with its lines.',
            'Storage is cheap in BigQuery; joining huge tables is not.',
          ],
        },
      ],
      walk: [
        'A transactional app wants normalised tables, because it updates single rows all day.',
        'A warehouse wants a star, because it reads and groups.',
        'BigQuery goes one step further: keep child records inside the parent row.',
      ],
      caption:
        'Do not normalise a BigQuery fact table "because it is best practice". And do not use BigQuery denormalisation advice on a Cloud SQL design.',
    },
    {
      concept: 2,
      kind: 'grid',
      title: 'Partitioning and clustering: read one block, not the table',
      scenario:
        "The orders table holds four days of data. It is partitioned by day and clustered by customer. An analyst runs: WHERE day = '10-02' AND customer = 'Kim'. Each cell below is a block of storage.",
      columns: ['10-01', '10-02', '10-03', '10-04'],
      rows: ['cust A–F', 'cust G–M', 'cust N–S', 'cust T–Z'],
      read: [[1, 1]],
      legend: {
        read: 'scanned and billed',
        skipped: 'skipped: not scanned, not billed',
      },
      walk: [
        '**Partitioning** splits the table by day: the four columns. The filter on day throws away three of them before the query starts.',
        '**Clustering** sorts the rows inside each day by customer: the four rows. The filter on customer finds the one block that can hold "Kim".',
        'The query scans 1 block of 16. On-demand pricing bills for bytes scanned, so it costs about one sixteenth.',
      ],
      caption:
        'Partition by a date column, then cluster by the columns you filter on most (up to four; order matters). Do not partition by a column with many distinct values, such as a customer id: cluster on it.',
    },
    {
      concept: 3,
      kind: 'compare',
      title: 'View, materialized view, snapshot, clone',
      scenario:
        'Four BigQuery objects all look like "a table made from another table". They differ in when the work is done and what you pay for.',
      columns: [
        {
          n: 1,
          icon: 'search',
          label: 'Logical view',
          tone: 'plain',
          points: [
            'A saved query. It runs again on every read.',
            'Stores nothing.',
            'Use it to hide columns or simplify a schema.',
          ],
        },
        {
          n: 2,
          icon: 'bigquery',
          label: 'Materialized view',
          tone: 'brand',
          points: [
            'The result is stored and kept up to date with small refreshes.',
            'BigQuery uses it automatically, even when the query names the base table.',
            'Use it for an aggregation that many people repeat.',
          ],
        },
        {
          n: 3,
          icon: 'clock',
          label: 'Table snapshot',
          tone: 'sky',
          points: [
            'A read-only picture of a table at one moment.',
            'You pay only for data that later differs from the base table.',
            'Use it as a cheap backup.',
          ],
        },
        {
          n: 4,
          icon: 'table',
          label: 'Table clone',
          tone: 'teal',
          points: [
            'A copy you can write to.',
            'You pay only for what you change.',
            'Use it to test a change on real data.',
          ],
        },
      ],
      walk: [
        'A logical view does the work at read time, every time.',
        'A materialized view does the work ahead of time and keeps it fresh.',
        'A snapshot freezes a table for safety.',
        'A clone gives you a private writable copy.',
      ],
      caption:
        'To change a column type, run «CREATE OR REPLACE TABLE … AS SELECT CAST(…)». Do not add a second column and reload everything.',
    },
  ],
  'data-lake': [
    {
      concept: 1,
      kind: 'flow',
      title: 'A data lake on Cloud Storage, zone by zone',
      scenario:
        'Cymbal collects click logs, partner CSV files and app exports. They arrive messy. A lake keeps them all, and improves them in steps, so nothing is lost and analysts get clean tables.',
      steps: [
        {
          n: 1,
          icon: 'cloud-storage',
          label: 'Raw zone',
          note: 'Files exactly as they arrived, in dated folders.',
          tone: 'plain',
          chips: ['dt=2026-10-02/'],
        },
        {
          n: 2,
          icon: 'dataflow',
          label: 'Staged zone',
          note: 'Checked, typed and converted to Parquet or Avro.',
          tone: 'gold',
        },
        {
          n: 3,
          icon: 'table',
          label: 'Curated zone',
          note: 'Business tables in Iceberg. BigLake controls rows and columns.',
          tone: 'brand',
          chips: ['BigLake'],
        },
      ],
      edges: ['clean', 'model'],
      fork: {
        label: 'step 4: any engine reads the curated tables',
        boxes: [
          {
            icon: 'bigquery',
            label: 'BigQuery',
            note: 'SQL over BigLake tables.',
            tone: 'sky',
          },
          {
            icon: 'dataproc',
            label: 'Spark',
            note: 'On Dataproc, or serverless.',
            tone: 'iris',
          },
          {
            icon: 'vertex-ai',
            label: 'ML training',
            note: 'Reads the same files.',
            tone: 'teal',
          },
        ],
      },
      walk: [
        'Everything lands in the raw zone unchanged. This is your safety copy.',
        'A pipeline validates the files and writes them in an efficient columnar format.',
        'The curated zone holds tables that mean something to the business. BigLake secures them.',
        'Because the formats are open, BigQuery, Spark and ML tools all read the same data.',
      ],
      caption:
        'Dataplex discovers the files and registers them as tables. Give analysts BigLake tables, not Storage Object Viewer on the bucket. Merge small files and add lifecycle rules to control cost.',
    },
  ],
  'data-platform': [
    {
      concept: 1,
      kind: 'layers',
      title: 'The building blocks of a data platform',
      scenario:
        'Cymbal wants one platform that every team can use. Three layers do three jobs: keep the data, keep it under control, and hand it to others.',
      rail: 'Each layer builds on the one below',
      layers: [
        {
          n: 3,
          icon: 'analytics-hub',
          label: 'Share',
          note: 'Analytics Hub publishes a dataset to other teams or companies. They query it live; nothing is copied.',
          tone: 'brand',
        },
        {
          n: 2,
          icon: 'dataplex',
          label: 'Govern',
          note: 'Dataplex groups data by domain and checks quality. Knowledge Catalog adds search, lineage and a glossary.',
          tone: 'iris',
        },
        {
          n: 1,
          icon: 'bigquery',
          label: 'Store',
          note: 'Cloud Storage is the lake for files. BigQuery is the warehouse for tables.',
          tone: 'teal',
          chips: ['Cloud Storage', 'BigQuery'],
        },
      ],
      walk: [
        'Storage is the base: files in Cloud Storage and tables in BigQuery.',
        'Governance sits over it. It answers: what data do we have, who owns it, is it good, where did it come from?',
        'Sharing is on top. It lets others use a dataset without making copies.',
      ],
      caption:
        'Lineage is recorded automatically for BigQuery, Dataflow, Composer and Dataproc jobs. Use it to see what breaks before you change a table.',
    },
    {
      concept: 1,
      kind: 'hub',
      title: 'Data mesh: teams own their data, one team sets the rules',
      scenario:
        'The central data team at Cymbal is a bottleneck: every request waits for them. In a data mesh, each business domain publishes its own data, and the central team provides the platform and the rules.',
      center: {
        icon: 'dataplex',
        label: 'Central platform team',
        note: 'Sets the standards: naming, quality rules, security classes, policy tags. Runs the shared platform.',
      },
      spokes: [
        {
          n: 1,
          icon: 'project',
          label: 'Sales domain',
          note: 'Owns its project and its Dataplex lake. Publishes "orders" as a data product.',
          tone: 'sky',
        },
        {
          n: 1,
          icon: 'project',
          label: 'Marketing domain',
          note: 'Owns and publishes "campaigns".',
          tone: 'gold',
        },
        {
          n: 1,
          icon: 'project',
          label: 'Finance domain',
          note: 'Owns and answers for the quality of "invoices".',
          tone: 'teal',
        },
        {
          n: 2,
          icon: 'analytics-hub',
          label: 'Consumers',
          note: 'Find a data product in the catalog and subscribe through Analytics Hub.',
          tone: 'brand',
        },
      ],
      walk: [
        'Each domain team owns its data from end to end and publishes it as a product others can trust.',
        'Consumers discover products in the catalog and subscribe. The central team is not in the path of every request.',
      ],
      caption:
        'When a question describes autonomous domain teams, do not put every dataset into one project run by one team. That is the opposite of federated governance.',
    },
  ],
};
