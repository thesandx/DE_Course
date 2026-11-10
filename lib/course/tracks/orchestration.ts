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
    {
      slug: 'airflow-taskflow-and-trigger-rules',
      title: 'Airflow hands-on: TaskFlow, mapping and trigger rules',
      summary:
        'Write a modern Airflow DAG with TaskFlow, dynamic task mapping, branching, trigger rules and setup and teardown tasks.',
      minutes: 17,
      body: `
        Interviewers who use Airflow every day ask you to write a DAG on a whiteboard, then ask
        what happens when one task fails. This lesson is that DAG.

        ## TaskFlow

        The **TaskFlow API** turns Python functions into tasks with «@task». Return values pass
        to the next task through **XCom**, and the dependency is inferred from the call. In
        Airflow 3, DAG authors import from «airflow.sdk».

        ~~~python
        import pendulum
        from airflow.sdk import dag, task


        @dag(
            schedule="@daily",
            start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
            catchup=False,
            max_active_runs=1,
            default_args={"retries": 2, "retry_delay": pendulum.duration(minutes=5)},
            tags=["trips"],
        )
        def city_trip_metrics():
            @task
            def list_cities(data_interval_start=None) -> list[str]:
                # Small metadata only. XCom lives in the metadata database.
                return ["nyc", "sfo", "lon", "blr"]

            @task(max_active_tis_per_dag=2)
            def build_city(city: str, ds=None) -> str:
                # Idempotent: overwrite the partition for this city and this day.
                return f"s3://lake/metrics/dt={ds}/city={city}/"

            @task
            def publish(paths: list[str]) -> None:
                print(f"published {len(paths)} partitions")

            publish(build_city.expand(city=list_cities()))


        city_trip_metrics()
        ~~~

        ## Dynamic task mapping

        «build_city.expand(city=...)» creates one task instance per element at run time, so the
        number of cities can change between runs without a code change. «partial()» fixes the
        arguments that do not vary. The downstream task receives the list of results. Limit the
        fan-out with «max_active_tis_per_dag» or a **pool**, or a list of 5,000 elements becomes
        5,000 simultaneous queries against the warehouse.

        > [!trap] XCom is not a data channel
        > XCom values are stored in the metadata database. Pass paths, ids and counts, never a
        > DataFrame. A large XCom slows the scheduler for every DAG. If you must pass data, use an
        > object storage XCom backend, and still prefer passing a path.

        ## Trigger rules

        A task runs when its upstream tasks reach the state its **trigger rule** asks for.

        | Rule | Runs when | Typical use |
        |---|---|---|
        | «all_success» | Default. Every upstream succeeded | Normal steps |
        | «all_done» | Every upstream finished, in any state | Cleanup, notifications |
        | «one_failed» | At least one upstream failed | Alert or rollback task |
        | «none_failed» | No upstream failed; skips are fine | Join after a branch |
        | «none_failed_min_one_success» | As above, and at least one succeeded | The usual join after a branch |
        | «all_skipped» | Every upstream was skipped | "Nothing to do" path |
        | «always» | Always, even with no upstream run | Rarely right; prefer all_done |

        ## Branching

        «@task.branch» returns the task id (or ids) to follow; the other direct paths are
        **skipped**. Skips propagate: a join task with the default «all_success» rule is skipped
        too, which is the classic bug. Give the join «none_failed_min_one_success».

        ~~~python
        @task.branch
        def full_or_incremental(ds=None) -> str:
            return "full_reload" if ds.endswith("-01") else "incremental_load"
        ~~~

        ## Setup and teardown

        Mark a task that creates a resource with «as_setup()» and the one that removes it with
        «as_teardown(setups=...)». Airflow runs the teardown even when work in between fails, and
        the teardown’s own result does not fail the run by default. Use it for a temporary
        cluster or a scratch schema, instead of a cleanup task with «all_done» that someone forgets
        to wire.

        > [!senior] The failure walk-through
        > Be ready to say, for your DAG: which task retries and how often, which tasks are
        > skipped when a branch is not taken, what the join does, what runs on failure (an
        > «on_failure_callback» or a «one_failed» task), and why rerunning the whole run is safe
        > (each task overwrites its partition).
      `,
      checks: [
        {
          question:
            'A branch task chooses path A, so path B is skipped. The join task after both paths never runs. Why?',
          options: [
            'Branching is not supported with TaskFlow',
            'The join has the default all_success rule, and the skip of path B propagates to it',
            'XCom is too large',
            'The join needs max_active_runs=1',
          ],
          answer: 1,
          why: 'Skips propagate under all_success. Use none_failed_min_one_success on the join.',
        },
        {
          question:
            'A mapped task fans out over 3,000 table names and overloads the warehouse. What is the right fix?',
          options: [
            'Remove the mapping and use a for loop inside one task',
            'Limit concurrency with max_active_tis_per_dag or a pool',
            'Pass the tables through a larger XCom',
            'Set catchup=True',
          ],
          answer: 1,
          why: 'Mapping keeps per-table retries and visibility. A pool or a per-task concurrency limit caps the load.',
        },
      ],
    },
    {
      slug: 'sensors-operators-hooks',
      title: 'Sensors, custom operators and hooks',
      summary:
        'Wait on external events without wasting workers, and package reusable integrations as operators and hooks.',
      minutes: 14,
      body: `
        ## Sensors: three ways to wait

        A sensor is a task that waits until a condition is true: a file lands, a partition
        appears, another DAG finishes.

        | Mode | How it waits | Cost |
        |---|---|---|
        | «poke» | Holds a worker slot and checks every «poke_interval» | One slot per waiting sensor. Fine for short waits only. |
        | «reschedule» | Checks, then frees the slot and is rescheduled | No slot between checks; each check is a new task start |
        | **Deferrable** («deferrable=True») | Hands the wait to the **triggerer**, an async process | Thousands of waits in one process. The default choice for long waits. |

        Always set «timeout» (how long to wait in total) and decide what a timeout means: fail
        and alert, or «soft_fail=True» to skip. A sensor without a timeout waits seven days by
        default, holding up the run behind it.

        ~~~python
        from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor

        wait_for_export = S3KeySensor(
            task_id="wait_for_partner_export",
            bucket_key="s3://partner-drop/trips/{{ ds }}/_SUCCESS",
            deferrable=True,
            timeout=60 * 60 * 6,
            poke_interval=300,
        )
        ~~~

        > [!tip] Prefer events over polling
        > If the producer is your own pipeline, have it update an **asset** and schedule the
        > consumer on that asset. Polling is for systems you do not control.

        ## Hooks and operators

        A **hook** wraps a connection to an external system: it reads credentials from an Airflow
        **connection** (or a secrets backend) and exposes methods. An **operator** is a reusable
        task: it takes parameters, uses hooks, and does its work in «execute».

        ~~~python
        from airflow.sdk import BaseHook, BaseOperator


        class TripApiHook(BaseHook):
            def __init__(self, conn_id: str = "trip_api"):
                super().__init__()
                self.conn_id = conn_id

            def fetch_day(self, day: str) -> list[dict]:
                conn = self.get_connection(self.conn_id)
                # Call conn.host with conn.password, with a timeout and retries.
                return []


        class TripApiToLakeOperator(BaseOperator):
            template_fields = ("day", "target_path")

            def __init__(self, *, day: str, target_path: str, conn_id: str = "trip_api", **kwargs):
                super().__init__(**kwargs)
                self.day = day
                self.target_path = target_path
                self.conn_id = conn_id

            def execute(self, context):
                rows = TripApiHook(self.conn_id).fetch_day(self.day)
                # Write to a temporary path, then rename into target_path: idempotent.
                return len(rows)
        ~~~

        - «template_fields» lists the arguments Airflow renders with Jinja at run time, so
          «day="{{ ds }}"» becomes the run’s date.
        - The constructor runs every time the scheduler parses the file. Do no I/O there; do it in
          «execute».
        - Package operators and hooks in an internal provider package with tests, not copied
          between DAG folders.

        > [!senior] When not to write an operator
        > A custom operator is worth it when several teams repeat the same integration. For one
        > DAG, a «@task» function is simpler. For heavy or conflicting dependencies, run the work
        > in a container with «KubernetesPodOperator» or «@task.docker», so the Airflow image stays
        > small.
      `,
      checks: [
        {
          question:
            'Two hundred sensors wait up to five hours each for partner files. Workers are full. What do you change?',
          options: [
            'Increase poke_interval to one second',
            'Make the sensors deferrable so the triggerer holds the waits',
            'Add retries to the sensors',
            'Use mode poke with soft_fail',
          ],
          answer: 1,
          why: 'Deferrable sensors free worker slots and wait asynchronously in the triggerer.',
        },
        {
          question: 'Why must an operator’s constructor avoid calling external APIs?',
          options: [
            'Constructors cannot use hooks',
            'The scheduler parses DAG files often, so constructor code runs on every parse',
            'Templates are not rendered yet, so it is a style rule only',
            'XCom is not available',
          ],
          answer: 1,
          why: 'Top-level and constructor code runs at parse time, repeatedly. Network calls there slow parsing for every DAG.',
        },
      ],
    },
    {
      slug: 'testing-and-deploying-airflow',
      title: 'Testing DAGs and running Airflow in production',
      summary:
        'Test DAGs at three levels, ship them through CI, and choose an executor and a managed service.',
      minutes: 15,
      body: `
        ## Three levels of tests

        1. **Integrity tests** load every DAG file the way the scheduler does and fail on import
           errors, cycles, or missing conventions such as owners, tags and retries.
        2. **Unit tests** call the task logic directly. Keep logic in plain functions in a
           package, and keep the task a thin wrapper, so tests need no Airflow at all.
        3. **Run tests** execute a whole DAG for one logical date in a single process with
           «dag.test()», against a test warehouse or local fakes.

        ~~~python
        import pytest
        from airflow.models import DagBag


        @pytest.fixture(scope="session")
        def dagbag():
            return DagBag(dag_folder="dags/", include_examples=False)


        def test_no_import_errors(dagbag):
            assert dagbag.import_errors == {}


        @pytest.mark.parametrize("dag_id", ["city_trip_metrics"])
        def test_retries_and_tags(dagbag, dag_id):
            dag = dagbag.get_dag(dag_id)
            assert dag.tags, "every DAG needs tags"
            for task in dag.tasks:
                assert task.retries >= 1, task.task_id
        ~~~

        Run these in CI on every pull request, then deploy DAG files and the image. A DAG that
        fails to import in production does not fail loudly: it disappears from the UI.

        ## Parse time is a budget

        The DAG processor re-parses files continuously. Top-level code (database calls, API
        calls, reading a big config) runs on every parse and slows scheduling for everyone.
        Generate DAGs from a small static config, and do the real work inside tasks.

        ## Executors

        | Executor | How tasks run | Fits |
        |---|---|---|
        | «LocalExecutor» | Processes on the scheduler machine | Small installs, development |
        | «CeleryExecutor» | A pool of long-running workers fed by a queue | Many short tasks, fast start |
        | «KubernetesExecutor» | One pod per task | Isolation, per-task resources, uneven load |

        Since Airflow 2.10 one deployment can configure several executors and choose per task.
        Separately, «KubernetesPodOperator» runs any container image as a task, whatever the
        executor, which keeps heavy dependencies out of the Airflow image.

        ## Managed Airflow

        | Service | Notes |
        |---|---|
        | Amazon MWAA | DAGs and requirements from S3; Celery workers with autoscaling |
        | Google Cloud Composer 3 | Runs on GKE managed by Google; DAGs in a Cloud Storage bucket |
        | Astronomer (Astro) | Image-based deploys with a CLI, multiple executors, hosted on several clouds |
        | Self-managed on Kubernetes | The official Helm chart; you own upgrades and the metadata database |

        Managed versions trail open source releases. Check that your target service supports
        the Airflow version and provider versions you test against.

        > [!senior] What a platform owner says
        > "DAG code and the runtime image are versioned and deployed separately; CI runs the
        > integrity and unit tests; heavy work runs in pods; the metadata database is backed up
        > and its old rows are cleaned with «airflow db clean»; and we alert on scheduler
        > heartbeat, DAG processor errors and queued tasks, not only task failures."
      `,
      checks: [
        {
          question: 'What is the cheapest test that catches a DAG that would vanish from the UI?',
          options: [
            'A full end-to-end run in staging',
            'An integrity test that loads the DagBag and asserts there are no import errors',
            'A unit test of one task function',
            'Checking the scheduler logs after deploy',
          ],
          answer: 1,
          why: 'A DAG with an import error is not registered. Loading the DagBag in CI catches it before deploy.',
        },
        {
          question:
            'A team needs one task with a GPU and a conflicting library version. What fits best?',
          options: [
            'Install the library into the shared Airflow image',
            'Run that task in its own container with KubernetesPodOperator',
            'Use a larger Celery worker for every task',
            'Split the DAG into two DAG files',
          ],
          answer: 1,
          why: 'A pod per task gives its own image and resources without changing the Airflow image.',
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
    companies: ['uber', 'google', 'amazon', 'walmart', 'swiggy'],
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
    companies: ['uber', 'amazon', 'walmart', 'swiggy'],
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
    companies: ['uber', 'amazon', 'walmart', 'swiggy'],
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
    companies: ['google', 'uber', 'amazon', 'walmart', 'swiggy'],
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
    companies: ['uber', 'google', 'amazon', 'walmart', 'swiggy'],
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
  {
    slug: 'airflow-branch-join-skipped',
    title: 'The report never sends after a branch',
    track: 'orchestration',
    kind: 'concept',
    difficulty: 'easy',
    companies: ['uber', 'google', 'amazon', 'walmart', 'swiggy'],
    prompt: `
      A DAG runs «check_volume», a branch task that returns «full_reload» on the first day of the
      month and «incremental_load» otherwise. Both lead to «send_report». Since the change,
      «send_report» is skipped every day. A teammate proposes «trigger_rule="always"». What is
      happening, and what is the right fix?
    `,
    hints: [
      'What state does the branch give the path it did not choose?',
      'What does the default trigger rule do with a skipped upstream?',
    ],
    answer: `
      The branch skips the path it did not choose. «send_report» has the default «all_success»
      rule, and one of its upstreams is skipped, so the skip propagates and the report is skipped
      too.

      Set «trigger_rule="none_failed_min_one_success"» on «send_report». It runs when no upstream
      failed and at least one succeeded, which is exactly "whichever path ran, it worked".

      «always» is wrong: it would send the report even when the load failed, which publishes bad
      numbers. «all_done» has the same problem.
    `,
    signals: [
      'Explains skip propagation under all_success',
      'Chooses none_failed_min_one_success for the join',
      'Explains why always and all_done would send a report after a failure',
    ],
    followUps: ['How would you also alert the on-call engineer when either load fails?'],
  },
  {
    slug: 'partner-api-operator',
    title: 'Write a reusable operator for a partner API',
    track: 'orchestration',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'walmart', 'swiggy'],
    prompt: `
      Five teams each copied a 200-line Python task that pulls one day of data from a partner’s
      paginated REST API and writes JSON lines to object storage. Two copies have a bug that
      writes partial files on failure. Write the operator and hook they should share, and say
      how you test it.
    `,
    hints: [
      'Where do credentials come from?',
      'What makes a rerun of the same day safe?',
      'Which arguments must be templated?',
    ],
    answer: `
      A hook owns the connection and the HTTP details; the operator owns the task contract.

      ~~~python
      import json
      import time
      import urllib.request

      from airflow.sdk import BaseHook, BaseOperator


      class PartnerApiHook(BaseHook):
          def __init__(self, conn_id: str = "partner_api", timeout_s: int = 30):
              super().__init__()
              self.conn_id = conn_id
              self.timeout_s = timeout_s

          def pages(self, day: str):
              conn = self.get_connection(self.conn_id)
              cursor = ""
              while True:
                  url = f"https://{conn.host}/v1/trips?day={day}&cursor={cursor}"
                  request = urllib.request.Request(url, headers={"Authorization": f"Bearer {conn.password}"})
                  for attempt in range(5):
                      try:
                          with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                              body = json.load(response)
                          break
                      except OSError:
                          if attempt == 4:
                              raise
                          time.sleep(2 ** attempt)
                  yield body["items"]
                  cursor = body.get("next_cursor") or ""
                  if not cursor:
                      return


      class PartnerApiToStorageOperator(BaseOperator):
          template_fields = ("day", "target_uri")

          def __init__(self, *, day: str, target_uri: str, writer, conn_id: str = "partner_api", **kwargs):
              super().__init__(**kwargs)
              self.day = day
              self.target_uri = target_uri
              self.writer = writer  # an object with write_temp(lines) -> uri and promote(temp, final)
              self.conn_id = conn_id

          def execute(self, context):
              hook = PartnerApiHook(self.conn_id)
              lines = (json.dumps(item) for page in hook.pages(self.day) for item in page)
              temp_uri = self.writer.write_temp(lines)
              self.writer.promote(temp_uri, self.target_uri)
              return self.target_uri
      ~~~

      **What makes it safe:**
      - Credentials come from an Airflow connection or secrets backend, never the DAG file.
      - Every request has a timeout and bounded retries with backoff.
      - The output is written to a temporary object, then promoted to the final path in one
        step, so a failure never leaves a partial file and a rerun overwrites the same day.
      - «day» and «target_uri» are templated, so «day="{{ ds }}"» follows the run’s interval and
        backfills work.

      **Tests:** unit-test the hook against a fake HTTP server (pages, a timeout, a 500 then
      success); unit-test the operator with a fake writer and assert promote is called only
      after all pages; one DagBag integrity test per team’s DAG. Ship both in an internal
      provider package with a version, so a fix reaches all five teams.
    `,
    signals: [
      'Separates the hook (connection, HTTP) from the operator (task contract)',
      'Templates the date and path so backfills work',
      'Writes to a temporary location and promotes atomically',
      'Puts timeouts and bounded retries on every call',
      'Tests with fakes and ships as a versioned package',
    ],
    followUps: [
      'The partner limits you to 10 requests per second across all teams. Where do you enforce it?',
    ],
  },
  {
    slug: 'airflow-platform-for-teams',
    title: 'Run Airflow for fifteen teams',
    track: 'orchestration',
    kind: 'design',
    difficulty: 'hard',
    companies: ['uber', 'google', 'amazon', 'walmart', 'swiggy'],
    prompt: `
      You own the Airflow platform. Fifteen teams run about 600 DAGs and 40,000 task runs a
      day. Problems this quarter: one team’s DAG file made a database call at the top level and
      slowed scheduling for everyone; a library upgrade for one team broke another; a sensor
      storm filled every worker. Design the platform for the next two years.
    `,
    hints: [
      'Separate what teams control from what the platform controls.',
      'Where do conflicting dependencies run?',
      'What do you check before a DAG reaches production?',
      'Managed or self-run?',
    ],
    answer: `
      **Runtime:** Airflow 3 on Kubernetes, managed (Composer, MWAA or Astro) unless a hard
      requirement says otherwise; the team’s time goes to the platform, not to running the
      metadata database. Celery workers for the many short tasks; heavy or dependency-specific
      work runs in pods via «KubernetesPodOperator» with each team’s own image. The shared
      Airflow image stays small and owned by the platform.

      **Isolation:**
      - Pools and per-team concurrency limits, so one team cannot take every slot.
      - Sensors must be deferrable, enforced by a CI check; waits run in the triggerer.
      - Team ownership through tags and folders, with access control on DAGs in the UI.
      - Dependencies between teams through assets, not cross-DAG sensors.

      **Delivery:** each team’s DAGs live in its own repo or folder. CI runs the integrity test
      (import errors, cycles, owners, retries, tags), a parse-time budget test (fail a file that
      takes more than about a second to import), lint rules that forbid top-level I/O, and
      unit tests. Deploys sync the DAG folder; the image changes through a separate release.

      **Operations:** alert on scheduler heartbeat, DAG processor import errors, queued task
      age, triggerer capacity and metadata database size. Run «airflow db clean» on a schedule.
      Track freshness SLOs per important dataset, not only task success. Publish a paved-road
      DAG template and a shared operator package.

      **Upgrades:** a staging environment where every team’s DAGs parse and integrity-test
      against the next version before production moves.
    `,
    signals: [
      'Moves conflicting dependencies into per-task containers',
      'Enforces parse-time hygiene and deferrable sensors in CI',
      'Isolates teams with pools and concurrency limits',
      'Uses assets for cross-team dependencies',
      'Monitors the scheduler and data freshness, not only task failures',
      'Has an upgrade path that tests every team’s DAGs',
    ],
    followUps: [
      'Two teams ask to move to Dagster. How do you decide whether the platform supports two orchestrators?',
    ],
  },
];
