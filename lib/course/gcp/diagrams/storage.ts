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
      title: 'The storage decision tree',
      questions: [
        {
          ask: 'Files, blobs, a lake or backups?',
          yes: { label: 'Cloud Storage', note: 'Objects up to 5 TiB.', tone: 'gold' },
        },
        {
          ask: 'SQL analytics over TB to PB?',
          yes: { label: 'BigQuery', note: 'Serverless warehouse. Not for OLTP.', tone: 'sky' },
        },
        {
          ask: 'Relational OLTP that must scale writes globally?',
          yes: {
            label: 'Spanner',
            note: 'Horizontal, strongly consistent, 99.999%.',
            tone: 'brand',
          },
        },
        {
          ask: 'Relational OLTP in one region, up to about 64 TB?',
          yes: {
            label: 'Cloud SQL or AlloyDB',
            note: 'AlloyDB when analytics run on live data.',
            tone: 'iris',
          },
        },
        {
          ask: 'Millions of writes per second, lookups by key, ms latency?',
          yes: { label: 'Bigtable', note: 'One index: the row key.', tone: 'teal' },
        },
        {
          ask: 'Documents for a web or mobile app, no ops?',
          yes: { label: 'Firestore', note: 'Formerly Datastore.', tone: 'easy' },
        },
      ],
      otherwise: {
        label: 'Memorystore',
        note: 'Sub-millisecond cache and sessions. Never the system of record.',
        tone: 'hard',
      },
      caption:
        'Walk it in order: structured? transactional or analytical? how big and how global? how fast? BigQuery is never the app database, and Bigtable is wrong under 1 TB or for ad hoc joins.',
    },
    {
      concept: 2,
      kind: 'compare',
      title: 'Bigtable row keys: hotspot or spread',
      columns: [
        {
          label: 'Bad: timestamp first',
          tone: 'hard',
          points: [
            'New keys sort next to each other.',
            'Every write lands on one tablet, on one node.',
            'More nodes do not help.',
          ],
          chips: ['20261112T0930#s17', '20261112T0930#s04'],
        },
        {
          label: 'Good: high-cardinality id first',
          tone: 'easy',
          points: [
            'Writes spread across all tablets.',
            'One prefix scan reads one sensor over time.',
            'A reverse timestamp puts the newest row first.',
          ],
          chips: ['s17#(MAX-ts)', 's04#(MAX-ts)'],
        },
      ],
      caption:
        'The row key is the only index. Never lead with a timestamp or a sequence. A key of only the sensor id is wrong too: the row grows forever and you cannot scan a time range. Key Visualizer shows hotspots.',
    },
    {
      concept: 3,
      kind: 'spectrum',
      title: 'Operational databases by scale',
      from: 'One region, scale up',
      to: 'Global, scale out',
      stops: [
        {
          label: 'Cloud SQL',
          note: 'MySQL, PostgreSQL, SQL Server. HA standby; replicas are promoted by hand.',
          tone: 'sky',
        },
        {
          label: 'AlloyDB',
          note: 'PostgreSQL with a columnar engine for analytics on live data.',
          tone: 'iris',
        },
        {
          label: 'Firestore',
          note: 'Serverless documents, ACID, scales by itself.',
          tone: 'easy',
        },
        {
          label: 'Spanner',
          note: 'Processing units; avoid increasing keys; interleave child tables.',
          tone: 'brand',
        },
      ],
      caption:
        'Memorystore sits beside all of them as a cache (Redis, Valkey, Memcached). It is never the system of record.',
    },
    {
      concept: 4,
      kind: 'spectrum',
      title: 'Cloud Storage classes',
      from: 'Read often: higher storage price',
      to: 'Read rarely: retrieval fees',
      stops: [
        { label: 'Standard', note: 'Hot data. No minimum.', tone: 'brand' },
        { label: 'Nearline', note: 'About once a month. 30 days minimum.', tone: 'gold' },
        { label: 'Coldline', note: 'About once a quarter. 90 days minimum.', tone: 'sky' },
        { label: 'Archive', note: 'Under once a year. 365 days minimum.', tone: 'iris' },
      ],
      caption:
        'Every class has the same millisecond latency and durability. Lifecycle rules move objects when you know the pattern; Autoclass moves them when you do not. Retention policy + Bucket Lock gives WORM.',
    },
    {
      concept: 5,
      kind: 'flow',
      title: 'A BigQuery partition gets cheaper by itself',
      steps: [
        { label: 'Active', note: 'Written or changed in the last 90 days.', tone: 'brand' },
        { label: 'Long-term', note: 'About 50% cheaper. Same speed.', tone: 'easy' },
        { label: 'Expired', note: 'Partition expiration deletes it.', tone: 'plain' },
      ],
      edges: ['90 days unchanged', 'expiration'],
      caption:
        'Do not export old BigQuery data to Cloud Storage just to save money: long-term pricing already halves it. Partitioning lets old partitions go long-term while new ones keep changing.',
    },
  ],
  'data-warehouse': [
    {
      concept: 1,
      kind: 'hub',
      title: 'A star schema',
      center: { label: 'fact_sales', note: 'One row per event, with the measures.' },
      spokes: [
        { label: 'dim_customer', note: 'Who', tone: 'sky' },
        { label: 'dim_product', note: 'What', tone: 'iris' },
        { label: 'dim_date', note: 'When', tone: 'gold' },
        { label: 'dim_store', note: 'Where', tone: 'teal' },
      ],
      caption:
        'A warehouse puts measures in a central fact table and context in dimensions. Type 2 dimensions add a row with valid_from and valid_to to keep history.',
    },
    {
      concept: 1,
      kind: 'compare',
      title: 'Three ways to shape the same data',
      columns: [
        {
          label: 'Normalised (3NF)',
          note: 'OLTP: Cloud SQL, Spanner.',
          tone: 'sky',
          points: ['No duplication.', 'Cheap updates.', 'Many joins to read.'],
        },
        {
          label: 'Star schema',
          note: 'Classic warehouse.',
          tone: 'gold',
          points: ['Fact + dimensions.', 'Small dimensions join cheaply.', 'Easy for BI tools.'],
        },
        {
          label: 'Nested and repeated',
          note: 'BigQuery prefers this.',
          tone: 'brand',
          points: [
            'Order lines live inside the order row.',
            'No join and no shuffle.',
            'Uses «STRUCT» and «ARRAY».',
          ],
        },
      ],
      caption:
        'Do not normalise a BigQuery fact table "for best practice": denormalise with nested fields. Do not apply that advice to an OLTP design.',
    },
    {
      concept: 2,
      kind: 'grid',
      title: 'Partition by date, cluster by customer',
      columns: ['10-01', '10-02', '10-03', '10-04'],
      rows: ['cust A–F', 'cust G–M', 'cust N–S', 'cust T–Z'],
      read: [[1, 1]],
      legend: {
        read: "WHERE day = '10-02' AND customer = 'Kim'",
        skipped: 'pruned: never scanned, never billed',
      },
      caption:
        'The partition filter drops whole columns of days; clustering sorts blocks inside each day, so only one block is read. Partition on a date, cluster on high-cardinality filters (up to 4 columns, order matters).',
    },
    {
      concept: 3,
      kind: 'compare',
      title: 'Views, materialized views, snapshots and clones',
      columns: [
        {
          label: 'Logical view',
          tone: 'plain',
          points: ['A saved query; runs every time.', 'No storage.', 'Good for access control.'],
        },
        {
          label: 'Materialized view',
          tone: 'brand',
          points: [
            'Precomputed, refreshed incrementally.',
            'BigQuery rewrites queries to use it.',
            '«max_staleness» trades freshness for cost.',
          ],
        },
        {
          label: 'Table snapshot',
          tone: 'sky',
          points: ['Read-only, point in time.', 'Cheap: pay for changed data only.'],
        },
        {
          label: 'Table clone',
          tone: 'teal',
          points: ['A writable copy.', 'Pay only for what changes.'],
        },
      ],
      caption:
        'To change a column type, «CREATE OR REPLACE TABLE … AS SELECT CAST(…)». Do not add a duplicate column and reload everything.',
    },
  ],
  'data-lake': [
    {
      concept: 1,
      kind: 'flow',
      title: 'Zones of a lake on Cloud Storage',
      steps: [
        {
          label: 'Raw',
          note: 'As it arrived, any format.',
          tone: 'plain',
          chips: ['dt=2026-10-02/'],
        },
        { label: 'Staged', note: 'Validated, typed, Parquet or Avro.', tone: 'gold' },
        {
          label: 'Curated',
          note: 'Iceberg or BigLake tables with row and column security.',
          tone: 'brand',
          chips: ['BigLake'],
        },
      ],
      edges: ['clean', 'model'],
      fork: {
        label: 'read by',
        boxes: [
          { label: 'BigQuery', note: 'Over BigLake tables.', tone: 'sky' },
          { label: 'Spark', note: 'Dataproc or Serverless.', tone: 'iris' },
          { label: 'Dataflow', note: 'Batch and stream.', tone: 'teal' },
        ],
      },
      caption:
        'Dataplex discovers the files and registers tables. Analysts get BigLake tables, not Storage Object Viewer on the whole bucket. Compact small files and set lifecycle rules.',
    },
  ],
  'data-platform': [
    {
      concept: 1,
      kind: 'layers',
      title: 'The platform stack',
      layers: [
        {
          label: 'Share',
          note: 'Publish data products without copies.',
          tone: 'brand',
          chips: ['Analytics Hub'],
        },
        {
          label: 'Govern',
          note: 'Lakes per domain, quality, metadata, lineage, glossary.',
          tone: 'iris',
          chips: ['Dataplex', 'Knowledge Catalog'],
        },
        {
          label: 'Store',
          note: 'The lake and the warehouse (lakehouse).',
          tone: 'teal',
          chips: ['Cloud Storage', 'BigQuery'],
        },
      ],
      caption:
        'Lineage is captured automatically for BigQuery, Dataflow, Composer and Dataproc jobs, so you can see the impact of a change.',
    },
    {
      concept: 1,
      kind: 'hub',
      title: 'Data mesh: federated governance',
      center: {
        label: 'Central platform team',
        note: 'Standards, policy tags, quality rules, the self-serve platform.',
      },
      spokes: [
        { label: 'Sales domain', note: 'Owns its project and lake.', tone: 'sky' },
        { label: 'Marketing domain', note: 'Publishes its data product.', tone: 'gold' },
        { label: 'Finance domain', note: 'Owns quality of its tables.', tone: 'teal' },
        { label: 'Consumers', note: 'Subscribe through Analytics Hub.', tone: 'brand' },
      ],
      caption:
        'When the scenario describes autonomous domains, do not centralise every dataset in one project run by one team.',
    },
  ],
};
