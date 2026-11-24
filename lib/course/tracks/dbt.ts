import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'dbt',
  title: 'dbt and analytics engineering',
  summary:
    'Models, incremental builds, tests, contracts, snapshots and running dbt in production, for the warehouse half of a pipeline.',
  tone: 'peach',
  why: 'Most warehouse transformation at product companies now runs through dbt. A senior answer knows how it builds a graph, when an incremental model drops rows, and how to keep a 1,000-model project fast, tested and cheap.',
  lessons: [
    {
      slug: 'dbt-in-one-picture',
      title: 'dbt in one picture',
      summary:
        'Explain what dbt compiles, how «ref» builds the graph, and how a project is layered.',
      minutes: 15,
      body: `
        ## Start with the problem

        Your warehouse has 200 SQL scripts that build tables. Each one says «CREATE TABLE ... AS
        SELECT ...». A cron file runs them in an order someone wrote by hand two years ago.

        Then three things go wrong:

        - Someone adds a script that reads «stg_trips», but puts it in the list before «stg_trips» is
          built. It reads yesterday's data, and nobody notices.
        - A developer tests a change on their laptop. The script says «from analytics.stg_trips»,
          so the test reads and overwrites **production** tables.
        - Nobody can answer "if I change this table, which dashboards break?"

        dbt is the tool that fixes this mess. To see how, you need one picture: SQL files plus a graph.

        ## Idea 1: dbt is the T in ELT, and nothing more

        ELT means Extract, Load, Transform. Other tools extract and load: raw data already sits in the
        warehouse. dbt does the **T**. It turns «SELECT» statements into tables and views in the
        warehouse.

        Think of dbt as a recipe book plus a head chef who reads it. It has no stove of its own. It
        compiles SQL plus Jinja, sends it to BigQuery, Snowflake, Databricks, Redshift or Postgres, and
        records what ran. It does not move data and has no compute of its own.

        Each model is one SQL file with one «SELECT»:

        ~~~sql
        -- models/marts/fct_trips.sql
        {{ config(materialized='table') }}

        select
            t.trip_id,
            t.city_id,
            d.driver_tier,
            t.fare_usd
        from {{ ref('stg_trips') }} as t
        left join {{ ref('dim_drivers') }} as d using (driver_id)
        ~~~

        You write only the «SELECT». dbt wraps it in the «CREATE TABLE» for you, because of
        «materialized='table'».

        ## Idea 2: ref draws the graph for you

        Look at «{{ ref('stg_trips') }}» in the model. It does two jobs.

        1. **At compile time it becomes the real table name** for the current target. In production
           that is «analytics_prod.stg_trips». In your dev run it is your own schema. So a dev run
           never touches production.
        2. **It adds an edge to the graph.** dbt now knows «stg_trips» must build before «fct_trips».
           You never write the build order by hand.

        Like a family tree: every model names its parents, and dbt draws the tree and builds from the
        roots down.

        Raw tables that dbt does not build are declared as **sources**. «source('ops', 'trips')» points
        at one. Declaring sources in YAML gives you lineage from raw to mart, and freshness checks on
        the raw data.

        ## Idea 3: five commands

        - «dbt build»: runs models, tests, seeds and snapshots in graph order. A failed test stops what
          depends on it.
        - «dbt run»: builds models only. No tests.
        - «dbt test»: runs tests only.
        - «dbt compile»: writes the final SQL to «target/» without running it.
        - «dbt retry»: reruns only what failed or was skipped in the last command.

        You rarely want the whole project. **Selection** keeps runs small:

        - «dbt build -s +fct_trips» builds the model and everything **upstream** of it (the plus is on
          the left, the parents' side).
        - «-s fct_trips+» builds everything **downstream**.
        - «-s tag:hourly» picks every model with that tag.

        ## Idea 4: three layers, like a kitchen

        A kitchen washes vegetables, then prepares sauces, then plates dishes. A dbt project has the
        same three layers.

        - **Staging** («stg_»): one model per source table. Rename, cast, deduplicate. No joins. The
          washing.
        - **Intermediate** («int_»): reusable joins and business logic. The sauces.
        - **Marts** («fct_», «dim_»): what analysts and dashboards query. The plated dish.

        ## Idea 5: Core, Cloud and Fusion

        - **dbt Core** is the open-source command-line tool.
        - **dbt Cloud** (now marketed as the dbt platform) adds a hosted scheduler, an IDE, CI jobs and
          cross-project references.
        - **Fusion** (2025) is a faster engine from dbt Labs, written in Rust. It parses SQL and
          catches errors before it runs. Check its licence and adapter support before you promise it in
          an answer.

        ## Now say it like a senior engineer

        dbt compiles SELECT statements plus Jinja into warehouse DDL. ref and source build the
        dependency graph and resolve names per target, so order and environments come for free. Projects
        are layered staging, intermediate, marts, and runs use selection to stay small.

        > [!senior] Say what dbt is not
        > dbt is a build tool for SQL in one warehouse. It is not an orchestrator, not an
        > ingestion tool and not a streaming engine. In a design answer, place it after ingestion
        > lands raw data, and say what schedules it.

        > [!trap] Hard-coded table names
        > Writing «from analytics.stg_trips» instead of «ref» breaks lineage, ignores the build
        > order and points dev runs at production tables.

        ## In one breath

        dbt is a recipe book of SELECT statements that the warehouse cooks. Every ref names a parent,
        so dbt draws the graph, builds in the right order, and points each environment at its own
        tables.
      `,
      checks: [
        {
          question: 'What does «ref("stg_trips")» add besides the table name?',
          options: [
            'A test that the table exists',
            'An edge in the graph, so stg_trips builds first',
            'A copy of the table in the current schema',
            'A lock on the table',
          ],
          answer: 1,
          why: 'ref resolves the name for the target and records the dependency, which is how dbt orders the build.',
        },
        {
          question: 'Which command builds a model and also runs its tests in graph order?',
          options: ['dbt run', 'dbt compile', 'dbt build', 'dbt test'],
          answer: 2,
          why: 'dbt build runs models, tests, seeds and snapshots together, and skips children of a failed test.',
        },
      ],
    },
    {
      slug: 'materializations-and-incremental',
      title: 'Materializations and incremental models',
      summary:
        'Pick a materialization, write an incremental model that survives late data, and choose the strategy.',
      minutes: 18,
      body: `
        ## Start with the problem

        Your «fct_trips» model is a table with 4 billion rows. It is built with
        «materialized='table'», so every hour dbt rebuilds all 4 billion rows from scratch, to add the
        200,000 trips from the last hour. The build takes 40 minutes and the warehouse bill doubles.

        The obvious fix is "only add the new rows". That is an **incremental model**. But the obvious
        way to write one has a bug that silently loses data. This lesson shows both.

        ## Idea 1: a materialization is what dbt builds from your SELECT

        Same SELECT, five possible results.

        - «view»: a view. Use it when the model is cheap, small, or rarely queried.
        - «table»: a full rebuild every run. Use it for small to medium tables with simple logic.
        - «incremental»: a table updated with new rows only. Use it for large event or fact tables.
        - «ephemeral»: nothing at all; it is inlined as a CTE. Use it for small helper logic used once
          or twice.
        - «materialized_view»: a warehouse materialized view. Use it when the warehouse can refresh it
          for you.

        ## Idea 2: an incremental model, read line by line

        ~~~sql
        {{ config(
            materialized='incremental',
            unique_key='trip_id',
            incremental_strategy='merge',
            on_schema_change='append_new_columns'
        ) }}

        select trip_id, city_id, status, fare_usd, updated_at
        from {{ ref('stg_trips') }}

        {% if is_incremental() %}
        -- 3-hour lookback: rows that arrive late still get picked up
        where updated_at > (
            select {{ dbt.dateadd('hour', -3, 'max(updated_at)') }} from {{ this }}
        )
        {% endif %}
        ~~~

        - On the **first run**, and with «--full-refresh», «is_incremental()» is false. The «where» is
          left out and the whole table builds.
        - On **later runs**, the «where» keeps only the recent rows.
        - The **merge** on «unique_key» updates rows that already exist instead of adding duplicates.
          A trip that changed from «requested» to «completed» updates its old row.

        ## Idea 3: late data, the classic bug

        The tempting filter is «updated_at > max(updated_at)»: "give me rows newer than the newest row I
        already have."

        Tiny example. At 10:00 the table's newest row is 09:58. A phone was offline and uploads a trip
        updated at 09:10. It lands at 10:05. The next run asks for rows after 09:58. The 09:10 row is
        older, so it is never selected. Not on this run, not on any run. It is **dropped for good**.

        Think of a teacher who only reads homework dated after the last one they marked. A student who
        hands in Monday's homework on Wednesday is never marked.

        The fix is two parts together:

        - a **lookback window**: re-read the last 3 hours, as the code above does;
        - a **unique key**: so re-reading the overlap updates rows instead of duplicating them.

        ## Idea 4: five ways to write the new rows

        - «append»: inserts the new rows. Watch out: duplicates on any rerun.
        - «merge»: a «MERGE» on «unique_key». Watch out: it scans the target, which is slow on huge
          tables without a partition filter.
        - «delete+insert»: deletes the matching keys, then inserts. Two statements; fine where MERGE is
          weak.
        - «insert_overwrite»: replaces whole partitions. On BigQuery and Spark it rebuilds a day without
          a row-level merge.
        - «microbatch»: one query per time batch, using «event_time». Needs dbt 1.9+. Batches retry and
          backfill on their own.

        ## Now say it like a senior engineer

        Large facts are incremental with a unique key and a lookback, so late rows are reprocessed
        safely. Choose merge for row-level updates, insert_overwrite for partition rebuilds, and
        microbatch for time-batched backfills, and bound the target scan.

        > [!senior] Cost of merge
        > On a 5 TB table, a MERGE without a partition filter can read the whole target every hour.
        > Add «incremental_predicates» to limit the target scan, or use «insert_overwrite» on
        > date partitions. Say the trade-off: overwrite recomputes whole days, merge touches rows.

        > [!trap] Schema changes
        > The default «on_schema_change» is «ignore»: a new column in the source never reaches the
        > table and nobody notices. Choose «append_new_columns» or «fail» on purpose.

        ## In one breath

        An incremental model adds only new rows instead of rebuilding everything. Always give it a
        lookback and a unique key, or late rows vanish for good, and pick the write strategy by how much
        of the target it has to read.
      `,
      checks: [
        {
          question:
            'An incremental model filters «updated_at > max(updated_at)». Some events upload an hour late. What happens?',
          options: [
            'They are merged on the next run',
            'They are dropped for good, because newer rows already set the maximum',
            'dbt fails the run',
            'They are appended as duplicates',
          ],
          answer: 1,
          why: 'Without a lookback, anything older than the current maximum is never selected again.',
        },
        {
          question:
            'Which strategy rebuilds whole date partitions on BigQuery without a row-level merge?',
          options: ['append', 'merge', 'insert_overwrite', 'ephemeral'],
          answer: 2,
          why: 'insert_overwrite replaces the partitions the new data touches.',
        },
      ],
    },
    {
      slug: 'tests-and-contracts',
      title: 'Tests, unit tests and contracts',
      summary:
        'Layer data tests, unit tests, freshness and contracts so a bad change fails before it ships.',
      minutes: 17,
      body: `
        ## Start with the problem

        Four different bad days:

        1. A source system starts sending the same trip twice. Revenue doubles on the dashboard.
        2. A developer rewrites the surge pricing logic. The SQL runs, but fares are now wrong.
        3. Someone renames the «trip_id» column. Three other teams' dashboards break the next morning.
        4. The upstream load fails silently. dbt rebuilds the dashboard from yesterday's data and it
           says "updated 5 minutes ago".

        Each of these needs a **different kind** of check. dbt has one for each. A senior answer uses
        all of them, and puts each where the risk is.

        ## Idea 1: data tests check today's data

        A data test is a query that returns **failing rows**. Zero rows means it passes. Like a
        security guard who lists everyone without a badge: an empty list is good news.

        ~~~yaml
        models:
          - name: fct_trips
            columns:
              - name: trip_id
                data_tests:
                  - unique
                  - not_null
              - name: status
                data_tests:
                  - accepted_values:
                      values: ['completed', 'cancelled', 'no_show']
              - name: driver_id
                data_tests:
                  - relationships:
                      to: ref('dim_drivers')
                      field: driver_id
        ~~~

        - The four built-in **generic tests** are «unique», «not_null», «accepted_values» and
          «relationships». Packages such as «dbt_utils» and «dbt_expectations» add more.
        - A **singular test** is a SQL file in «tests/» for a rule only one model has, such as "fare is
          never negative for a completed trip".
        - dbt 1.8 renamed the YAML key from «tests» to «data_tests». The old key still works.
        - Set «severity: warn» for checks that should alert but not block, and «store_failures» to keep
          the failing rows in a table you can query.

        Bad day 1 is caught by «unique» on «trip_id».

        ## Idea 2: unit tests check your logic

        A data test checks the data you happen to have today. It cannot tell you that your formula is
        wrong if today's data does not hit the edge case.

        Since dbt 1.8, a **unit test** runs a model against **fixed input rows** and compares the
        output. Like a calculator check: put in 10 and 1.5, expect 15.

        ~~~yaml
        unit_tests:
          - name: surge_multiplies_base_fare
            model: fct_trips
            given:
              - input: ref('stg_trips')
                rows:
                  - {trip_id: 't1', base_fare: 10, surge: 1.5}
            expect:
              rows:
                - {trip_id: 't1', fare_usd: 15}
        ~~~

        It tests your SQL logic, not today's data, so it belongs in CI. Bad day 2 is caught here,
        before the change merges.

        ## Idea 3: contracts check the shape

        A **model contract** fixes the columns and types of a model. If the SQL returns a different
        shape, the build fails **before** the table changes. Like a plug that only fits one socket.

        ~~~yaml
        models:
          - name: fct_trips
            config:
              contract:
                enforced: true
            columns:
              - name: trip_id
                data_type: string
                constraints:
                  - type: not_null
        ~~~

        Use contracts on public models that other teams or dashboards read. When you must change a
        public model, add **model versions**, so consumers move on their own schedule. Bad day 3 fails
        the build instead of breaking three teams.

        ## Idea 4: freshness checks the input

        «dbt source freshness» compares a source's «loaded_at_field» with «warn_after» and
        «error_after» limits. Run it **before** the build, so a stale upstream table is not quietly
        rebuilt into a "fresh" dashboard. Bad day 4 stops here.

        ## Now say it like a senior engineer

        Data tests guard the data, unit tests guard the logic in CI, contracts guard the public shape,
        and freshness guards the inputs. Put them where the risk is, not everywhere.

        > [!senior] Test where the risk is
        > Primary keys on every model, relationships on the joins that feed revenue, unit tests on
        > the tricky logic, contracts on public models. A thousand «not_null» tests on columns
        > nobody reads slow CI and teach people to ignore red.

        ## In one breath

        dbt checks four things: the data (data tests), the logic (unit tests with fixed rows), the
        shape (contracts) and the input (freshness). Use each where a failure would really hurt.
      `,
      checks: [
        {
          question: 'What does a dbt unit test check?',
          options: [
            'That production data has no duplicates',
            'That the model logic turns given input rows into the expected output',
            'That the source is fresh',
            'That the warehouse is reachable',
          ],
          answer: 1,
          why: 'Unit tests use fixed input rows, so they test logic and can run in CI without real data.',
        },
        {
          question:
            'A public model must keep its columns and types. What enforces that at build time?',
          options: [
            'A singular test',
            'An enforced model contract',
            'Source freshness',
            'An ephemeral materialization',
          ],
          answer: 1,
          why: 'An enforced contract fails the build when the SQL returns a different shape.',
        },
      ],
    },
    {
      slug: 'snapshots-and-history',
      title: 'Snapshots and slowly changing history',
      summary: 'Use snapshots for type 2 history, and know what they miss compared with CDC.',
      minutes: 14,
      body: `
        ## Start with the problem

        The «drivers» table in the app database has one row per driver. When driver 7 moves from Pune
        to Mumbai, the app **updates** the row. The old city is gone.

        Six months later finance asks: "How much revenue did Pune drivers bring in March?" Driver 7
        now says Mumbai, so their March trips count for Mumbai. The answer is wrong, and the source
        cannot fix it, because it no longer remembers.

        You need **history**: every version of each row, with the time it was true. That is a type 2
        slowly changing dimension. A dbt **snapshot** builds one for you.

        ## Idea 1: a snapshot is a photo album

        Think of taking a photo of the drivers table every night and keeping every photo. A snapshot
        does that, but it only stores what changed.

        Each run compares the source with the last version it kept. When a row changed, it **closes**
        the old version and **opens** a new one.

        ~~~yaml
        snapshots:
          - name: drivers_snapshot
            relation: source('ops', 'drivers')
            config:
              unique_key: driver_id
              strategy: timestamp
              updated_at: updated_at
              hard_deletes: new_record
        ~~~

        dbt adds four columns: «dbt_valid_from», «dbt_valid_to», «dbt_scd_id» and «dbt_updated_at». The
        current row has «dbt_valid_to» empty.

        Tiny example. Driver 7 now has two rows:

        - Pune, valid from 1 January to 4 April.
        - Mumbai, valid from 4 April, «dbt_valid_to» empty.

        Join March trips to the row valid in March, and Pune gets the revenue.

        dbt 1.9 added this YAML form and the «hard_deletes» option. Older projects define snapshots in
        SQL files.

        ## Idea 2: two ways to notice a change

        - «timestamp»: a change means a newer «updated_at». Use it when the source keeps a reliable
          update time.
        - «check»: a change means one of the listed columns differs. Use it when there is no reliable
          timestamp. It costs more, because it compares columns.

        ## Idea 3: what a photo album misses

        A snapshot sees the table **only when it runs**. Photos do not show what happened between them.

        - A driver changes city at 09:00 and back at 15:00. A daily snapshot at midnight sees Pune both
          times. It records **no change** at all.
        - It also cannot tell you **when** a change happened, only when the snapshot saw it. A change
          at 09:00 shows up as "valid from midnight".

        ## Now say it like a senior engineer

        A snapshot builds type 2 history by comparing state at each run, with the timestamp or check
        strategy. It misses changes between runs and records detection time, not change time, so
        audit-grade history needs CDC.

        > [!senior] Snapshot or CDC
        > For audit-grade history, read the database log with CDC (such as Debezium into Kafka) and
        > build the type 2 table from every change event. Use snapshots when "state at each run" is
        > enough, and say that limit out loud.

        > [!trap] Rebuilding a snapshot
        > A snapshot is the only copy of history it captured. Dropping it or running it against a
        > new source loses that history for good. Treat its table like source data: back it up and
        > never full-refresh it.

        ## In one breath

        A snapshot is a photo album of a changing table: each run closes old versions and opens new
        ones. It cannot see changes between photos, so use CDC when every change matters, and protect
        the snapshot table like source data.
      `,
      checks: [
        {
          question:
            'A driver changes city at 09:00 and back at 15:00. A snapshot runs at midnight. What does it record?',
          options: ['Two changes', 'One change', 'No change', 'An error'],
          answer: 2,
          why: 'The snapshot compares states at run time. Both states it sees are the same.',
        },
      ],
    },
    {
      slug: 'dbt-in-production',
      title: 'Running dbt in production',
      summary:
        'Schedule dbt from Airflow, build slim CI with state selection, and keep a large project fast.',
      minutes: 17,
      body: `
        ## Start with the problem

        Your dbt project has 900 models. Three problems show up as it grows:

        - Every night one job runs «dbt build» for everything. At 03:00 one model fails. Every
          dashboard is late, and the retry rebuilds all 900 models again.
        - Every pull request runs the whole project in CI. A one-line change waits two hours for green.
        - The nightly run writes straight into production tables. When it fails halfway, the
          dashboards show half old and half new numbers.

        This lesson fixes each one: who runs dbt, how environments work, slim CI, and how to publish
        safely.

        ## Idea 1: who runs dbt

        dbt does not schedule itself. Something else starts it. Three common options:

        - **One Airflow task.** A «BashOperator» runs «dbt build». Simple. But one retry reruns
          everything, and the graph is hidden inside one task.
        - **One task per model.** Astronomer Cosmos renders the dbt graph as Airflow tasks. You get
          per-model retries and timing, but a big DAG for the scheduler.
        - **dbt Cloud jobs.** Airflow triggers a job with «DbtCloudRunJobOperator». Hosted runs and
          logs, on a paid platform.

        Whichever you pick, run «dbt source freshness» first. After a failure, use «dbt retry», so only
        failed and skipped nodes rerun. That fixes the "retry rebuilds 900 models" problem.

        ## Idea 2: environments, everyone gets their own sandbox

        «profiles.yml» defines **targets**, such as «dev» and «prod». Each developer builds into their
        own schema («dbt_sandeep»), and production builds into the real one. Same code, different
        sandbox.

        The macro «generate_schema_name» decides the final schema name. Override it once for the whole
        project, not per model.

        ## Idea 3: slim CI, test only what you changed

        Every run writes artifacts to «target/»:

        - «manifest.json»: the graph.
        - «run_results.json»: timings and results.

        CI keeps production's manifest and compares the pull request against it:

        ~~~bash
        dbt build --select state:modified+ --defer --state ./prod-artifacts
        ~~~

        - «state:modified+» builds only the models the pull request changed, plus their children.
        - «--defer» reads every unchanged parent **from production** instead of rebuilding it.

        Like a builder who renovates one room: they check the new room and the rooms that lean on it,
        and trust the rest of the house as it stands. A 900-model project then tests a pull request in
        minutes, not hours.

        ## Idea 4: keep it fast and cheap

        - Read model timings from «run_results.json» and fix the slowest ten first.
        - Make large facts incremental, with partition filters on the target.
        - Raise «threads» to run independent models in parallel, within warehouse limits.
        - Tag models by schedule («hourly», «daily») so each job builds only what it needs.
        - Declare **exposures** for dashboards, so a change shows which reports it breaks.

        ## Now say it like a senior engineer

        An orchestrator runs freshness, then build, then retry on failure. Each developer has a
        target schema. CI uses state selection with deferral against production artifacts. Jobs are
        split by domain and schedule, and publishing is atomic.

        > [!senior] Publish safely
        > Building straight into production tables means a failed run leaves half-updated marts.
        > Build into a staging schema, run the tests, then swap or point views at the new tables.
        > Snowflake can swap schemas in one statement; elsewhere, views over versioned tables do
        > the job.

        > [!trap] One huge job
        > A single nightly «dbt build» for 1,000 models means one failure at 03:00 delays every
        > dashboard. Split by domain and schedule, and give each job an owner.

        ## In one breath

        Let an orchestrator run dbt, check freshness first and use «dbt retry» after a failure. In CI,
        build only what changed and read the rest from production, and publish by swapping, so nobody
        sees a half-built mart.
      `,
      checks: [
        {
          question: 'What does «--defer» do in slim CI?',
          options: [
            'Delays the build until production finishes',
            'Reads unchanged parent models from production instead of rebuilding them',
            'Skips tests',
            'Builds every model in the project',
          ],
          answer: 1,
          why: 'Deferral resolves refs to unchanged models against the production manifest, so CI builds only what changed.',
        },
        {
          question:
            'After a failed nightly run, which command reruns only failed and skipped nodes?',
          options: ['dbt build --full-refresh', 'dbt retry', 'dbt compile', 'dbt run -s +all'],
          answer: 1,
          why: 'dbt retry reads the last run results and reruns only what did not succeed.',
        },
      ],
    },
    {
      slug: 'dbt-at-scale-and-ai',
      title: 'dbt at scale, in design rounds and with AI',
      summary:
        'Place dbt in a system design, split a big project across teams, and use AI on dbt code safely.',
      minutes: 14,
      body: `
        ## Start with the problem

        A design interviewer says: "Riders, trips and payments flow into Kafka. Build the analytics
        layer, and fraud needs a score within 5 seconds." You say "dbt" for everything. The interviewer
        frowns. dbt runs batch SQL on a schedule. It cannot score a trip in 5 seconds.

        Later the same company has one dbt project with 3,000 models and 40 contributors. Parsing is
        slow, nobody knows who owns what, and a change in one team's model breaks another team's
        dashboard.

        And now people want an AI assistant to write the dbt models. How do you keep that safe?

        ## Idea 1: put dbt in the right place in a design

        dbt fits the **batch** part of a design. Raw data lands (from Kafka, Fivetran or a CDC tool),
        then dbt builds staging, facts and marts on a schedule. In your answer, say three things:

        1. **What schedules it** and how often: hourly or daily, not "real time".
        2. **How it stays correct**: incremental with a lookback, keys, tests that block.
        3. **What it does not do**: sub-minute freshness belongs in a streaming engine such as Flink,
           with dbt rebuilding the corrected batch view later.

        So for the fraud question: a streaming engine scores events in seconds. dbt builds the batch
        tables that analysts study later.

        ## Idea 2: many teams, one warehouse

        Think of a big office building. One open floor for 40 people is noisy and nobody owns
        anything. So you give each team its own floor, with some rooms open to visitors and some
        locked.

        Split the project by domain:

        - **Groups** and **access** («private», «protected», «public») mark which models other teams
          may «ref». The locked rooms and the open rooms.
        - **Contracts** and **versions** on the public models keep consumers safe. A public room does
          not change shape overnight.
        - **Cross-project refs** let a team read another project's public models. dbt Cloud calls this
          dbt Mesh. On open-source dbt, plugins such as «dbt-loom» do the same job.

        ## Idea 3: using AI on dbt code, with the same controls

        AI assistants are good at the boring parts: staging models from a source schema, YAML docs, a
        first draft of tests. dbt Labs also ships an MCP server, so an assistant can read the
        project's lineage and metadata.

        Treat the assistant like a fast new hire. You still review their work.

        - Generated SQL runs through «dbt build» and unit tests in CI, like human code.
        - Read every generated join. A wrong join key passes «not_null» and still doubles revenue.
        - Never give an assistant production credentials. Let it work against a dev target.

        ## Now say it like a senior engineer

        dbt is the scheduled batch layer after ingestion, correct through incremental lookbacks, keys
        and blocking tests, with low-latency needs handed to a streaming engine. At scale, split by
        domain with groups, access levels, contracts, versions and cross-project refs. AI output goes
        through the same CI and review as human code.

        > [!senior] Analytics engineering
        > Interviewers may ask how data engineers and analytics engineers split work. A clear
        > answer: the platform team owns ingestion, the warehouse and dbt's CI and conventions;
        > domain teams own their models, tests and contracts.

        ## In one breath

        dbt is the batch layer: say what schedules it, how it stays correct, and what it leaves to
        streaming. At scale, give each team its own project with public, contracted models, and let AI
        write dbt code only through the same tests and review.
      `,
      checks: [
        {
          question: 'A product needs fraud scores within 5 seconds. Where does dbt fit?',
          options: [
            'dbt computes the scores every 5 seconds',
            'A streaming engine scores events; dbt builds the batch tables for analysis later',
            'dbt replaces Kafka',
            'dbt cannot be used anywhere in this design',
          ],
          answer: 1,
          why: 'dbt runs batch SQL in the warehouse. Seconds-level latency needs a streaming path.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'dbt-incremental-late-events',
    title: 'Late events vanish from an incremental model',
    track: 'dbt',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'swiggy'],
    prompt: `
      An hourly incremental dbt model loads trip events with this filter. Finance says completed
      trips from drivers with bad signal are missing from yesterday's revenue. Find the cause and
      fix it.

      ~~~sql
      {% if is_incremental() %}
      where event_ts > (select max(event_ts) from {{ this }})
      {% endif %}
      ~~~
    `,
    hints: [
      'Drivers with bad signal upload events late. What is max(event_ts) when they arrive?',
      'You need to read an overlap, and the overlap must not create duplicates.',
    ],
    answer: `
      The filter uses event time. By the time a late event lands, newer events have already
      raised «max(event_ts)», so the late one is never selected.

      Fix both halves:

      1. Filter on **load time**, not event time, if the staging table has one («_loaded_at»),
         and add a **lookback**, such as 3 hours, sized from the real lateness distribution.
      2. Add «unique_key='event_id'» with the «merge» strategy, so reading the overlap updates
         rows instead of adding duplicates.

      ~~~sql
      {{ config(materialized='incremental', unique_key='event_id', incremental_strategy='merge') }}
      ...
      {% if is_incremental() %}
      where _loaded_at > (select {{ dbt.dateadd('hour', -3, 'max(_loaded_at)') }} from {{ this }})
      {% endif %}
      ~~~

      On dbt 1.9+, the «microbatch» strategy with «event_time» and a «lookback» does this per
      batch. Then backfill: rerun the affected days with a wider window or a targeted full
      refresh, and add a test that compares daily counts with the source.
    `,
    signals: [
      'Explains why max(event_time) drops late rows',
      'Adds a lookback sized from data, not a guess',
      'Pairs the overlap with a unique key so reruns are idempotent',
      'Backfills the missing days and adds a reconciliation check',
    ],
    followUps: ['How would you size the lookback, and what does a bigger window cost?'],
  },
  {
    slug: 'dbt-slow-nightly-build',
    title: 'A dbt build takes 4 hours and costs too much',
    track: 'dbt',
    kind: 'design',
    difficulty: 'hard',
    companies: ['google', 'uber', 'swiggy'],
    prompt: `
      A 1,200-model dbt project on BigQuery runs one nightly «dbt build». It takes 4 hours, often
      misses the 07:00 dashboard deadline, and the warehouse bill doubled in a year. Pull requests
      run the whole project in CI. How do you fix it?
    `,
    hints: [
      'Measure first: where does run_results.json say the time goes?',
      'CI and production have different fixes.',
      'Most of the cost is usually a few large tables rebuilt in full.',
    ],
    answer: `
      **Measure.** Load «run_results.json» into a table and rank models by time and bytes. A few
      models usually take most of the run.

      **Production.**

      - Make the largest facts incremental. On BigQuery use «insert_overwrite» on date partitions,
        or «merge» with «incremental_predicates», so the target is not scanned in full.
      - Partition and cluster large models, and make downstream models filter on the partition.
      - Turn rarely used heavy views into tables, and cheap intermediate tables into views or
        ephemeral models.
      - Split the single job by schedule and domain («tag:hourly», «tag:daily»), with the
        dashboard's upstream graph («+exposure:exec_dashboard») running first.
      - Raise «threads» within the slot budget, and run «dbt source freshness» before the build.

      **CI.** Use slim CI: «dbt build --select state:modified+ --defer --state prod-artifacts».
      A pull request builds only what changed and its children, on a sample of data if needed.

      **Prove it.** Track build minutes and bytes per model over time, and set an alert when a
      model's cost jumps after a merge.
    `,
    signals: [
      'Starts from run_results timings instead of guessing',
      'Uses incremental with partition-aware strategies on the big facts',
      'Splits the job so the deadline-critical graph runs first',
      'Adds slim CI with state selection and defer',
      'Adds ongoing cost tracking per model',
    ],
    followUps: [
      'Two models must rebuild in full every night. How do you make that cheaper?',
      'How do you stop a new model from doubling the bill again?',
    ],
  },
  {
    slug: 'dbt-snapshot-gaps',
    title: 'The driver history misses changes',
    track: 'dbt',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber', 'swiggy'],
    prompt: `
      A daily dbt snapshot builds a type 2 history of «drivers». An investigation needs every
      city a driver was assigned to, with exact times. The snapshot shows one city where the ops
      log shows three changes that day. Explain the gap and redesign the history.
    `,
    hints: ['When does a snapshot look at the source?', 'Where is every change already recorded?'],
    answer: `
      A snapshot compares the source with its last version **when it runs**. Changes between two
      runs collapse into one, or disappear if the value returns. «dbt_valid_from» is the time the
      snapshot saw the change, not the time it happened.

      For exact history, capture changes from the database log with CDC (Debezium into Kafka,
      or the warehouse's native change stream). Land every change event with its commit
      timestamp, then build the type 2 table in dbt from the events:

      ~~~sql
      select
          driver_id,
          city_id,
          changed_at as valid_from,
          lead(changed_at) over (partition by driver_id order by changed_at, change_seq) as valid_to
      from {{ ref('stg_driver_changes') }}
      ~~~

      Keep the existing snapshot for older history, mark where the CDC history starts, and never
      full-refresh the snapshot, because it holds the only copy of the past.
    `,
    signals: [
      'Explains that snapshots see state only at run time',
      'Points out valid_from is observation time, not change time',
      'Moves to CDC events for exact history',
      'Keeps the old snapshot and protects it from rebuilds',
    ],
    followUps: ['How do you handle a hard delete of a driver in each design?'],
  },
  {
    slug: 'dbt-revenue-test-plan',
    title: 'Design the tests for a revenue mart',
    track: 'dbt',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google', 'swiggy'],
    prompt: `
      You own «fct_revenue» in dbt. The CFO's dashboard and two other teams' models read it. Last
      quarter a join change doubled revenue for a day before anyone noticed. Design its tests and
      safeguards.
    `,
    hints: [
      'Separate checks on data, on logic and on shape.',
      'What test would have caught a doubled join?',
      'Who reads it, and how do they learn about a change?',
    ],
    answer: `
      **Inputs.** «dbt source freshness» on the payment sources, with «error_after» before the
      deadline, so stale data blocks the build.

      **Data tests** with «severity: error», run by «dbt build» so a failure stops the dashboard
      models:

      - «unique» and «not_null» on the grain key («payment_id»). A fan-out join fails «unique»,
        which is the test that catches the doubled day.
      - «relationships» from payments to orders and cities.
      - A reconciliation test: daily revenue within 0.5% of the payment processor's total.
      - A day-over-day change test with «severity: warn» for spikes above 30%.

      **Unit tests** on refunds, currency conversion and partial captures, run in CI.

      **Contract** with «enforced: true» on the columns other teams read, plus a model version
      when a column must change.

      **Process.** Slim CI on every pull request, «store_failures» for debugging, an exposure for
      the CFO dashboard, and build into a staging schema before swapping into production.
    `,
    signals: [
      'Tests the grain key so a fan-out join fails',
      'Reconciles with an independent source of truth',
      'Separates data tests, unit tests and contracts',
      'Uses severity on purpose: block vs warn',
      'Protects consumers with contracts, versions and exposures',
    ],
    followUps: ['A warn test fires every day and everyone ignores it. What do you do?'],
  },
  {
    slug: 'dbt-airflow-orchestration',
    title: 'Orchestrate a 400-model dbt project from Airflow',
    track: 'dbt',
    kind: 'design',
    difficulty: 'medium',
    companies: ['uber', 'google', 'swiggy'],
    prompt: `
      Your Airflow deployment runs ingestion DAGs. A team wants its 400-model dbt project to run
      after ingestion lands, with retries, alerts and visibility per model. Compare the options and
      choose one.
    `,
    hints: [
      'What does one BashOperator hide?',
      'What does one Airflow task per model cost the scheduler?',
      'How does the dbt run know ingestion has finished?',
    ],
    answer: `
      | Option | Strengths | Weaknesses |
      |---|---|---|
      | One task: «dbt build» | Simple; dbt owns the graph | A retry reruns all 400 models; no per-model view |
      | Cosmos: a task per model | Per-model retries, timing and alerts in Airflow | Big DAGs; parsing cost; two graphs to keep in sync |
      | dbt Cloud job via operator | Hosted runs, logs and docs | Licence cost; another system to watch |

      A balanced choice for 400 models: **Cosmos grouped by layer or domain**, so Airflow shows
      staging, intermediate and marts as task groups with their own retries. Start the dbt DAG
      from a **dataset** (or asset) that the ingestion DAG updates, not from a clock, so it runs
      only after fresh data lands. Run «dbt source freshness» first.

      If the team stays with one «dbt build» task, add «dbt retry» as the retry command, so a
      retry reruns only failed and skipped nodes, and ship «run_results.json» to the warehouse
      for per-model timings.
    `,
    signals: [
      'Names the trade-off between one task and one task per model',
      'Triggers on data arrival rather than a fixed time',
      'Keeps retries narrow with Cosmos or dbt retry',
      'Gets per-model visibility from artifacts or the UI',
    ],
    followUps: ['How would you backfill one mart for the last 90 days without blocking today?'],
  },
  {
    slug: 'dbt-daily-driver-earnings',
    title: 'Write an incremental model for driver earnings',
    track: 'dbt',
    kind: 'sql',
    difficulty: 'medium',
    companies: ['uber', 'swiggy'],
    prompt: `
      «stg_trips(trip_id, driver_id, completed_at TIMESTAMP, fare_usd, tip_usd, status,
      _loaded_at TIMESTAMP)» is a dbt staging model. Trips can be corrected (a tip added, a fare
      refunded) up to 2 days after completion.

      Write the dbt model «fct_driver_daily_earnings» with one row per driver and day. It must be
      incremental, correct after corrections, and safe to rerun.
    `,
    hints: [
      'The grain is (driver_id, earning_date). That is the unique key.',
      'A correction to a trip changes its whole day. Rebuild days, not rows.',
      'Which days must each run recompute?',
    ],
    answer: `
      ~~~sql
      {{ config(
          materialized='incremental',
          unique_key=['driver_id', 'earning_date'],
          incremental_strategy='merge'
      ) }}

      with changed_days as (
          {% if is_incremental() %}
          -- days touched by any row loaded since the last run, with a safety overlap
          select distinct cast(completed_at as date) as earning_date
          from {{ ref('stg_trips') }}
          where _loaded_at > (
              select {{ dbt.dateadd('hour', -6, 'max(last_loaded_at)') }} from {{ this }}
          )
          {% else %}
          select distinct cast(completed_at as date) as earning_date
          from {{ ref('stg_trips') }}
          {% endif %}
      )

      select
          t.driver_id,
          cast(t.completed_at as date) as earning_date,
          count(*) as trips,
          sum(t.fare_usd) as fares_usd,
          sum(coalesce(t.tip_usd, 0)) as tips_usd,
          max(t._loaded_at) as last_loaded_at
      from {{ ref('stg_trips') }} as t
      join changed_days as d
          on cast(t.completed_at as date) = d.earning_date
      where t.status = 'completed'
      group by 1, 2
      ~~~

      Each run finds the **days** touched by newly loaded rows, then recomputes those whole days
      from staging. A correction two days later reloads its trip, which marks its day as changed,
      and the merge on «(driver_id, earning_date)» replaces the old totals. Rerunning gives the
      same result.

      One gap to name: if a refund turns a driver's only trip on a day into «cancelled», that
      driver's row is not in the new result, so the merge leaves the old row. Handle it with
      «delete+insert» on the changed days, or emit zero rows for drivers who had trips that day.
    `,
    signals: [
      'States the grain and uses it as the unique key',
      'Recomputes whole affected days instead of adding deltas',
      'Uses load time with an overlap to find changed days',
      'Spots the deleted-row gap in merge and offers delete+insert',
    ],
    followUps: ['How would this model look with the microbatch strategy?'],
  },
];
