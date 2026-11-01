import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'orchestration',
  title: 'Orchestration: Airflow and Prefect',
  summary:
    'Scheduling, data intervals, idempotent tasks and backfills in Airflow, and how Prefect 3 approaches the same problems.',
  tone: 'butter',
  why: 'Every pipeline answer ends with "and how is it scheduled, retried and backfilled?" Seniors are expected to know orchestrator internals and to choose between tools with clear reasons.',
  lessons: [
    {
      slug: 'what-orchestrators-do',
      title: 'What an orchestrator is for',
      summary: 'Separate scheduling, dependencies, retries and observability from the work itself.',
      minutes: 10,
      body: `
        An orchestrator decides **when** work runs, **in what order**, **what happens on failure**,
        and **who can see it**. It should not do the heavy work itself. The work runs in Spark, a
        warehouse or a container, and the orchestrator triggers and watches it.

        | Responsibility | What good looks like |
        |---|---|
        | Scheduling | Time-based and event-based triggers, with clear data intervals |
        | Dependencies | A graph of tasks, plus dependencies across pipelines |
        | Retries | Per-task retries with backoff, and alerts after the last one |
        | Backfills | Rerun any historical interval safely |
        | Observability | Run history, logs, durations, SLA misses |
        | Concurrency control | Pools and limits so a backfill does not starve production |

        ## Cron is not enough, and here is why

        Cron runs a command at a time. It does not know that job B needs job A's output for the
        same day, that A failed, or that yesterday's run must be redone. You end up rebuilding an
        orchestrator badly in shell scripts.

        > [!senior] Keep tasks thin
        > A task that runs a 40-minute pandas transformation inside the Airflow worker ties your
        > scheduler's health to your data size. Push compute to a system built for it, and let
        > the task submit and poll.

        > [!trap] Orchestrator as a database
        > Passing large data between tasks through the orchestrator (Airflow XCom, for example)
        > fills its metadata database. Pass references, such as a table name or a storage path.
      `,
      checks: [
        {
          question: 'Where should a 40-minute transformation of 200 GB run?',
          options: [
            'Inside the orchestrator worker process',
            'In a compute engine (Spark, warehouse, container) that the orchestrator triggers',
            'In the scheduler',
            'In XCom',
          ],
          answer: 1,
          why: 'The orchestrator schedules and monitors. Heavy compute in its workers couples pipeline reliability to data size.',
        },
      ],
    },
    {
      slug: 'airflow-internals',
      title: 'Airflow internals and data intervals',
      summary:
        'Scheduler, executors, logical dates and catchup, explained the way interviews probe them.',
      minutes: 15,
      body: `
        ## The moving parts

        | Component | Job |
        |---|---|
        | Scheduler | Parses DAG files, creates DAG runs and task instances, queues ready tasks |
        | Executor | Decides where tasks run: Local, Celery workers, Kubernetes pods |
        | Workers | Run the task code |
        | Metadata database | State of every DAG run and task instance |
        | Webserver / API server | The UI and REST API |
        | Triggerer | Runs deferrable operators' async waits cheaply |

        ## Data intervals: the classic confusion

        A daily DAG run for the interval 2026-10-31 00:00 to 2026-11-01 00:00 **starts after the
        interval ends**, on 1 November. Its «logical_date» (formerly «execution_date») is the start
        of the interval: 31 October. Use «data_interval_start» and «data_interval_end» in your
        queries so each run processes exactly its own slice.

        ~~~sql
        -- In a templated task
        SELECT * FROM events
        WHERE event_ts >= '{{ data_interval_start }}'
          AND event_ts <  '{{ data_interval_end }}'
        ~~~

        > [!trap] Never use now() in a task
        > A task that queries "yesterday" relative to the wall clock processes the wrong day when
        > it is retried or backfilled. Always derive the window from the run's data interval.

        ## Catchup and backfill

        With «catchup=True», a new or paused DAG creates runs for every missed interval since
        «start_date». With «catchup=False», only the latest interval runs. Backfills rerun chosen
        historical intervals on purpose.

        ## Sensors and deferrable operators

        A classic sensor occupies a worker slot while it waits. **Deferrable** operators hand the
        wait to the triggerer, which runs thousands of async waits in one process, and resume
        when the condition is met.

        > [!senior] Airflow 3 changes worth knowing
        > Airflow 3 (2025) introduced DAG versioning, an API server that isolates task execution
        > from the metadata database, and asset-driven (data-aware) scheduling as a first-class
        > idea. Mentioning that you know the direction of the project is a good signal.
      `,
      checks: [
        {
          question:
            'A daily DAG run has logical_date 2026-10-31. When does it typically start, and which data should it process?',
          options: [
            'On 31 October, processing 30 October',
            'After the interval ends (1 November), processing 31 October',
            'At midnight on 31 October, processing 31 October so far',
            'Whenever it is triggered, processing everything new',
          ],
          answer: 1,
          why: 'The run starts after its data interval closes, and the logical date names the start of that interval.',
        },
      ],
    },
    {
      slug: 'idempotency-and-backfills',
      title: 'Idempotent tasks and safe backfills',
      summary:
        'Design tasks so any interval can be rerun any number of times with the same result.',
      minutes: 13,
      body: `
        A task is idempotent when running it twice for the same interval leaves the same result as
        running it once. It is the property that makes retries, reruns and backfills safe, and it is
        asked about in almost every pipeline question.

        ## Patterns that make tasks idempotent

        - **Overwrite a partition** for the interval instead of appending: «INSERT OVERWRITE ...
          PARTITION (ds = '2026-10-31')», or a delete-then-insert in one transaction.
        - **MERGE on a key** for upserts, so duplicates collapse.
        - **Deterministic inputs:** read exactly the interval, never "latest" or "now".
        - **Write then swap:** write to a staging location and atomically rename or swap.

        ## Backfilling without hurting production

        - Run the backfill in a separate pool with a concurrency limit, so daily runs keep priority.
        - Process in date order if each day depends on the previous one (running totals, SCD type 2).
        - Validate a sample of backfilled days against known numbers before running the full range.
        - Communicate: downstream consumers will see historical numbers change.

        > [!example] A non-idempotent task, and the fix
        > «INSERT INTO daily_revenue SELECT ... WHERE day = '{{ ds }}'» doubles revenue on a retry.
        > Fix: «DELETE FROM daily_revenue WHERE day = '{{ ds }}'» and the insert in one transaction,
        > or «INSERT OVERWRITE» on the day partition.

        > [!senior] Side effects need keys
        > Sending emails, calling payment APIs or publishing events cannot be "overwritten". Give
        > each side effect an idempotency key derived from the interval and the entity, and keep a
        > record of what was sent.
      `,
      checks: [
        {
          question: 'Which task is idempotent when retried?',
          options: [
            'INSERT INTO t SELECT ... WHERE day = ds',
            'INSERT OVERWRITE the day partition with SELECT ... WHERE day = ds',
            'Append rows where event_ts > now() - 1 day',
            'Send a summary email',
          ],
          answer: 1,
          why: 'Overwriting the partition for the run’s interval gives the same result however many times it runs.',
        },
      ],
    },
    {
      slug: 'prefect-3',
      title: 'Prefect 3 for Airflow users',
      summary:
        'Flows, tasks, caching, transactions, deployments and work pools, mapped to Airflow ideas.',
      minutes: 16,
      body: `
        Prefect takes a different approach from Airflow: your pipeline is ordinary Python. A
        decorated function is a **flow**, and functions it calls can be **tasks**. There is no DAG
        file parsed on a schedule; the graph is whatever your code does when it runs, including
        loops and branches decided at runtime.

        ~~~python
        from datetime import timedelta
        from prefect import flow, task
        from prefect.cache_policies import INPUTS, TASK_SOURCE

        @task(retries=3, retry_delay_seconds=[10, 30, 120],
              cache_policy=INPUTS + TASK_SOURCE, cache_expiration=timedelta(days=1))
        def extract(day: str) -> str:
            return f"s3://raw/trips/{day}/"        # pass references, not data

        @task
        def load(path: str, day: str) -> int:
            ...                                      # submit a warehouse load, return row count

        @flow(log_prints=True)
        def daily_trips(day: str) -> int:
            path = extract(day)
            rows = load(path, day)
            print(f"loaded {rows} rows for {day}")
            return rows
        ~~~

        ## Mapping the concepts

        | Airflow | Prefect 3 |
        |---|---|
        | DAG | Flow (a Python function) |
        | Operator / task | Task (a Python function), or any code inside the flow |
        | Dynamic task mapping | «task.map(items)» or a plain Python loop |
        | XCom | Return values; persisted results when caching is on |
        | Executor and workers | Work pool plus workers, or «flow.serve()» |
        | Pools and concurrency | Global concurrency limits, work pool and work queue limits |
        | Data interval | No built-in concept: pass the date as a flow parameter |

        ## Caching and transactions

        A task's **cache policy** decides when a previous result can be reused: by inputs, by the
        task's source code, or a combination. A rerun of a flow then skips tasks whose cached
        results are still valid, which is a cheap form of idempotency. Prefect 3 also adds
        **transactions**: tasks inside «with transaction():» commit together, and a task can
        register an «on_rollback» hook to undo its side effect if a later task fails.

        ## Running it: serve or deploy

        - «daily_trips.serve(name="daily", cron="0 6 * * *")» runs a long-lived process that polls
          for scheduled runs. Simple, good for one machine.
        - «flow.from_source(repo, "flows.py:daily_trips").deploy(name="daily",
          work_pool_name="k8s-pool", cron="0 6 * * *")» registers a **deployment**. **Workers**
          poll a **work pool** and start each run as a process, container or Kubernetes job.

        Agents and infrastructure blocks from Prefect 2 were removed in Prefect 3; work pools and
        workers replaced them.

        > [!trap] Old tutorials
        > Many blog posts show «prefect agent start» and «Deployment.build_from_flow». Both belong to
        > Prefect 2. In Prefect 3 you use «serve», or «deploy» with a work pool and «prefect worker
        > start --pool <name>».

        > [!senior] Where Prefect fits and where it does not
        > Prefect is strong for Python-heavy, dynamic workflows (ML pipelines, API fan-out) and
        > teams that want local runs to look like production. Airflow's strengths are its huge
        > operator ecosystem, managed offerings (Cloud Composer, MWAA) and strict, schedule-driven
        > data intervals. Say which properties the use case needs.
      `,
      checks: [
        {
          question:
            'In Prefect 3, what replaced Prefect 2 agents for running deployments on infrastructure?',
          options: [
            'Executors',
            'Work pools and workers',
            'Infrastructure blocks',
            'The triggerer',
          ],
          answer: 1,
          why: 'Prefect 3 removed agents. Workers poll a work pool and launch flow runs on the pool’s infrastructure type.',
        },
        {
          question:
            'Prefect has no built-in data interval. How do you make a daily flow backfillable?',
          options: [
            'Use datetime.now() inside tasks',
            'Pass the date as a flow parameter and derive every query from it',
            'Enable catchup',
            'Use XCom',
          ],
          answer: 1,
          why: 'A date parameter makes each run process a fixed slice, so you can trigger runs for any past date.',
        },
      ],
    },
    {
      slug: 'choosing-an-orchestrator',
      title: 'Choosing an orchestrator',
      summary:
        'Compare Airflow, Prefect, Dagster and durable workflow engines by the properties that matter.',
      minutes: 11,
      body: `
        "Why Airflow and not X?" is a favourite senior question. A good answer compares properties,
        not popularity.

        | Property | Airflow | Prefect | Dagster | Temporal or Cadence |
        |---|---|---|---|---|
        | Model | Scheduled task DAGs | Python flows and tasks | Software-defined assets | Durable, long-running workflows |
        | Dynamic graphs | Dynamic mapping, limited | Native Python control flow | Partitions and dynamic outputs | Native code |
        | Data awareness | Assets and datasets (growing) | Results and caching | Core idea: assets with lineage | None (not a data tool) |
        | Ecosystem | Largest | Medium | Medium | Service orchestration |
        | Managed options | Composer, MWAA, Astronomer | Prefect Cloud | Dagster+ | Temporal Cloud |

        **Cadence** was created at Uber for durable service workflows (for example multi-step trip
        and payment processes). Temporal is its successor by the same original authors. They solve
        a different problem from data orchestration: guaranteeing that a long business process
        finishes despite crashes.

        ## A decision in three questions

        1. Is the workload time-scheduled batch over data intervals, or event-driven and dynamic?
        2. Does the team want lineage and data assets as first-class objects?
        3. What does the company already run, and who will operate it on call?

        > [!senior] The migration answer
        > If you would change tools, say how: run both side by side, migrate the least critical
        > pipelines first, keep the same idempotent task code, and compare outputs before cutting
        > over. Interviewers want to see that you respect the cost of change.
      `,
      checks: [
        {
          question: 'Which tool was created at Uber, and for what?',
          options: [
            'Airflow, for batch ETL',
            'Cadence, for durable long-running service workflows',
            'Dagster, for data assets',
            'Prefect, for ML pipelines',
          ],
          answer: 1,
          why: 'Cadence came from Uber to make multi-step business workflows survive failures. Airflow came from Airbnb.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'airflow-wrong-day-processed',
    title: 'The DAG processes the wrong day',
    track: 'orchestration',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'google'],
    prompt: `
      A daily DAG runs this SQL. After a two-day outage, the team cleared and reran the missed
      runs, and all of them loaded the same day's data. Why, and how do you fix it?

      ~~~sql
      INSERT INTO daily_trips
      SELECT * FROM trips WHERE trip_date = CURRENT_DATE - 1;
      ~~~
    `,
    hints: [
      'What is CURRENT_DATE during a rerun?',
      'What does each run know about its own interval?',
    ],
    answer: `
      «CURRENT_DATE - 1» is evaluated when the task runs, so every rerun on the same day selects
      the same date. Each run must use its own data interval:

      ~~~sql
      DELETE FROM daily_trips WHERE trip_date = '{{ ds }}';
      INSERT INTO daily_trips
      SELECT * FROM trips WHERE trip_date = '{{ ds }}';
      ~~~

      Wrapping the delete and insert in one transaction (or using a partition overwrite) also makes
      the task idempotent, so the retried runs do not duplicate rows.
    `,
    signals: [
      'Identifies wall-clock time as the bug',
      'Uses the run’s data interval or ds',
      'Makes the write idempotent as well',
    ],
    followUps: ['How would you backfill a year of history without slowing today’s run?'],
  },
  {
    slug: 'idempotent-daily-aggregate',
    title: 'Make a daily aggregate rerunnable',
    track: 'orchestration',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      A task computes per-city daily revenue and appends it to a table. It also posts a Slack
      summary. Retries sometimes double revenue and send two messages. Redesign the task.
    `,
    hints: [
      'Data writes and side effects need different fixes.',
      'Overwrite or merge; and keep a record of sent messages.',
    ],
    answer: `
      Split it into two tasks.

      1. **Aggregate:** write with a partition overwrite or a «MERGE» keyed by «(city_id, day)», so
         reruns replace rather than add.
      2. **Notify:** derive an idempotency key such as «revenue-summary/2026-10-31». Before sending,
         check a small «notifications_sent» table; after sending, insert the key. If the send
         succeeds but the insert fails, the worst case is one duplicate message, which you accept
         for Slack but not for payments.

      Splitting also means a notification failure does not force recomputing the aggregate.
    `,
    signals: [
      'Separates data writes from side effects',
      'Uses overwrite or merge for the data',
      'Uses an idempotency key and a sent-log for the side effect',
      'States the remaining failure window honestly',
    ],
    followUps: ['How do you alert when the summary was not sent at all?'],
  },
  {
    slug: 'prefect-dynamic-fanout',
    title: 'Fan out over a list known only at runtime',
    track: 'orchestration',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      Each morning a pipeline must call a partner API once per active city (the list changes
      daily, about 600 cities), retry failures, run at most 20 calls at a time, and then load all
      results. Sketch it in Prefect 3 and compare with Airflow.
    `,
    hints: [
      'The city list is a task output.',
      'task.map fans out; a concurrency limit caps parallel calls.',
      'Airflow has dynamic task mapping too.',
    ],
    answer: `
      ~~~python
      from prefect import flow, task
      from prefect.concurrency.sync import concurrency

      @task
      def active_cities(day: str) -> list[str]:
          ...

      @task(retries=3, retry_delay_seconds=[5, 30, 120])
      def fetch(city: str, day: str) -> str:
          with concurrency("partner-api", occupy=1):   # global limit named partner-api, set to 20
              ...                                       # call the API, write raw JSON to storage
          return f"s3://raw/partner/{day}/{city}.json"

      @task
      def load(paths: list[str], day: str) -> None:
          ...

      @flow
      def partner_daily(day: str) -> None:
          cities = active_cities(day)
          futures = fetch.map(cities, day=day)
          load([f.result() for f in futures], day)
      ~~~

      Create the limit once with «prefect gcl create partner-api --limit 20». In Airflow 2.3+,
      «fetch.expand(city=active_cities())» does the same fan-out, with a pool of 20 slots for the
      limit. The Prefect version reads as plain Python and runs locally unchanged; Airflow gives
      one task instance per city in the UI and integrates with existing pools.
    `,
    signals: [
      'Computes the list at runtime and fans out over it',
      'Applies a concurrency limit shared across runs',
      'Retries per item rather than the whole batch',
      'Passes paths, not payloads, between tasks',
      'Gives a balanced comparison with Airflow dynamic mapping',
    ],
    followUps: [
      'Twelve cities keep failing. How do you let the rest load and still track the failures?',
    ],
  },
  {
    slug: 'cross-dag-dependency',
    title: 'Wait for another team’s pipeline',
    track: 'orchestration',
    kind: 'design',
    difficulty: 'medium',
    companies: ['google', 'uber'],
    prompt: `
      Your DAG must start only after another team's «payments_daily» pipeline has finished for the
      same day. They run on a different Airflow instance. What are your options and which do you
      choose?
    `,
    hints: ['Poll, push, or watch the data itself.', 'Think about what "finished" really means.'],
    answer: `
      Options:

      - **Sensor on their output**: a deferrable sensor that checks for the partition or a
        «_SUCCESS» marker for the day. Simple and decoupled from their orchestrator.
      - **Asset or dataset event**: if both sides can publish and consume data-aware events (Airflow
        assets, a message on a topic), they emit "payments for 2026-10-31 ready" and you trigger on it.
      - **Cross-instance API trigger**: they call your API when done. Couples the teams more.

      Prefer depending on **the data and a completeness signal**, not on their task's state. Agree a
      contract: a marker written only after validation, the latest time it can arrive (an SLA), and
      what happens on late arrival (your DAG waits up to a deadline, then alerts).
    `,
    signals: [
      'Depends on data readiness rather than another scheduler’s internals',
      'Uses deferrable sensors to avoid holding workers',
      'Defines a contract: marker, SLA and late handling',
    ],
    followUps: ['They republish a corrected day a week later. How does your pipeline find out?'],
  },
  {
    slug: 'choose-orchestrator-for-team',
    title: 'Airflow, Prefect or Dagster for a new platform',
    track: 'orchestration',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      You are the first senior data engineer at a 200-person company. Pipelines run as cron jobs
      on one VM. Workloads: nightly warehouse loads, hourly API ingestions, and an ML team with
      dynamic training pipelines. Recommend an orchestrator and a rollout plan.
    `,
    hints: [
      'List the requirements before naming tools.',
      'Consider who operates it.',
      'Plan the migration, not just the choice.',
    ],
    answer: `
      **Requirements first:** time-scheduled batch with backfills, retries and alerts; dynamic
      Python workflows for ML; low operational load (small team); lineage would be nice.

      **Recommendation (one defensible version):** a managed service to avoid running a scheduler
      yourself. If the company is on GCP, Cloud Composer (managed Airflow) covers the batch loads
      with the biggest ecosystem. If the Python-heavy ML work dominates and the team wants local
      development to match production, Prefect Cloud fits better. Dagster is the choice if
      asset-level lineage and freshness policies are a priority.

      **Rollout:** containerise existing jobs unchanged; make each one idempotent with a date
      parameter; migrate the least critical first and run old and new in parallel for a week,
      comparing outputs; add alerting and ownership per pipeline; retire cron.

      The strongest answer states the trade-off you accept: for example, "Composer means two
      tools if ML outgrows it, which I accept for operational simplicity now."
    `,
    signals: [
      'Starts from requirements and operating cost',
      'Prefers managed services for a small team, with a reason',
      'Plans an incremental, verifiable migration',
      'States the trade-off accepted',
    ],
    followUps: ['How do you prevent 300 DAGs written by 40 people from becoming unmaintainable?'],
  },
];
