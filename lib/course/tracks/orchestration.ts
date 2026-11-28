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
      minutes: 12,
      body: `
        ## Start with the problem

        You have three jobs that run every night:

        1. Copy yesterday's trips from the app database into the lake.
        2. Clean them.
        3. Build the daily revenue table from the clean trips.

        The easy idea is cron. You put three lines in a crontab: job 1 at 01:00, job 2 at 02:00, job
        3 at 03:00. You hope each job finishes before the next one starts.

        Then one night job 1 is slow and finishes at 02:20. Job 2 starts at 02:00 and cleans half a
        day. Job 3 builds revenue from half a day. Nobody notices until the finance team asks why
        Tuesday's revenue dropped by 40%.

        Another night job 1 fails. Cron does not know. Jobs 2 and 3 run anyway, on old data. And when
        you fix job 1, you must remember by hand to rerun jobs 2 and 3, for the right day.

        Cron runs a command at a time. That is all it knows. It does not know that job B needs job A's
        output for the same day, that A failed, or that yesterday's run must be redone. Teams that
        stay on cron end up writing shell scripts with lock files, retry loops and "did it finish?"
        checks. They rebuild an orchestrator, badly.

        ## Idea 1: an orchestrator is the shift manager, not the cook

        Think of a restaurant kitchen. The cooks cook. The shift manager decides **when** each dish
        starts, **in what order**, **what happens when a dish is burned**, and keeps the **board** that
        shows everyone what is done.

        An orchestrator is the shift manager for data jobs. It decides:

        - **When** work runs.
        - **In what order** it runs.
        - **What happens on failure.**
        - **Who can see** what happened.

        It does not cook. The heavy work runs in Spark, a warehouse or a container. The orchestrator
        starts it and watches it.

        ## Idea 2: the six jobs of a good orchestrator

        Each one fixes a problem from the story above.

        - **Scheduling.** Time-based and event-based triggers, with clear data intervals. Each run
          knows which day it is for.
        - **Dependencies.** A graph of tasks: job 3 starts only when job 2 succeeds. It also handles
          dependencies across pipelines.
        - **Retries.** Per-task retries with backoff, and an alert after the last one fails.
        - **Backfills.** Rerun any historical interval safely: "redo 3 to 7 March".
        - **Observability.** Run history, logs, durations and SLA misses, in one place.
        - **Concurrency control.** Pools and limits, so a big backfill does not starve the production
          runs.

        Tiny example. With an orchestrator, the slow night looks like this: job 1 finishes at 02:20,
        and job 2 starts at 02:20, not 02:00. The failed night looks like this: job 1 retries 3 times,
        then you get an alert, and jobs 2 and 3 wait. When you fix job 1, you clear that one run, and
        jobs 2 and 3 run after it for the same day.

        ## Idea 3: keep the tasks thin

        Back to the kitchen. If the shift manager starts cooking a 40-minute dish, nobody watches the
        board for 40 minutes.

        Same with an orchestrator. A task that runs a 40-minute pandas transformation inside the
        Airflow worker ties the scheduler's health to the data size. When data doubles, the workers
        run out of memory, and every pipeline on the cluster suffers.

        The fix: the task **submits** the work to a system built for it (Spark, the warehouse, a
        container) and **polls** until it is done. The task stays small. The data can grow.

        ## Idea 4: pass notes, not boxes

        Tasks often need to tell the next task something. The orchestrator gives a way to do that. In
        Airflow it is called **XCom**, and it is stored in the orchestrator's own metadata database.

        Pass a note: "the clean trips are in «s3://lake/trips/dt=2026-10-31/»". Do not pass the box of
        trips itself. A DataFrame in XCom fills the metadata database and slows the scheduler for every
        pipeline.

        ## Now say it like a senior engineer

        An orchestrator owns scheduling, dependencies, retries, backfills, observability and
        concurrency. It does not own compute. Cron fails because it has no dependency graph, no
        failure state and no idea of "the run for 31 October".

        > [!senior] Keep tasks thin
        > A task that runs a 40-minute pandas transformation inside the Airflow worker ties your
        > scheduler's health to your data size. Push compute to a system built for it, and let
        > the task submit and poll.

        > [!trap] Orchestrator as a database
        > Passing large data between tasks through the orchestrator (Airflow XCom, for example)
        > fills its metadata database. Pass references, such as a table name or a storage path.

        ## In one breath

        An orchestrator is the shift manager: it decides when, in what order, what happens on failure,
        and shows the board. It starts and watches the heavy work in other systems, and passes small
        notes between tasks, never the data itself.
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
      minutes: 17,
      body: `
        ## Start with the problem

        You write a daily Airflow DAG to load "yesterday's" trips. On 1 November you open the UI and
        see a run named **31 October**. It ran at 00:00 on 1 November. You think: "Is that a bug? Did
        it load 30 October or 31 October?"

        Almost everyone gets confused here once. Interviewers know it, so they ask. To answer well,
        you need two things: what the parts of Airflow do, and what a **data interval** is.

        ## Idea 1: the moving parts, as a small office

        Think of Airflow as a small office that runs errands.

        - **Scheduler:** the planner. It parses the DAG files, creates DAG runs and task instances,
          and puts tasks that are ready into a queue.
        - **Executor:** the dispatcher. It decides **where** each task runs: as local processes, on
          Celery workers, or as Kubernetes pods.
        - **Workers:** the people who run the errands. They run the task code.
        - **Metadata database:** the office logbook. It records the state of every DAG run and every
          task instance.
        - **Webserver / API server:** the front desk. It serves the UI and the REST API.
        - **Triggerer:** a receptionist who waits on many phone calls at once. It runs the async waits
          of deferrable operators cheaply.

        Tiny example. At midnight the scheduler sees that the 31 October interval is over. It writes a
        new DAG run to the logbook, marks the first task as ready, and queues it. The executor sends it
        to a worker. The worker runs it and writes "success" to the logbook. The scheduler sees that
        and queues the next task.

        ## Idea 2: a run is named after the day it covers

        Here is the confusing part, made simple.

        A newspaper is printed on the morning of 1 November, and it reports the news of 31 October.
        You cannot print the news of a day before the day is over.

        A daily DAG works the same way. The run for the interval **2026-10-31 00:00 to 2026-11-01
        00:00**:

        - **starts after the interval ends**, on 1 November;
        - has a «logical_date» (formerly «execution_date») equal to the **start** of the interval:
          31 October.

        So the run named 31 October, which ran on 1 November, loads 31 October. That is correct.

        In your queries, use «data_interval_start» and «data_interval_end». Then each run processes
        exactly its own slice, no more and no less.

        ~~~sql
        -- In a templated task
        SELECT * FROM events
        WHERE event_ts >= '{{ data_interval_start }}'
          AND event_ts <  '{{ data_interval_end }}'
        ~~~

        ## Idea 3: never ask the wall clock

        The tempting shortcut is "load yesterday", where yesterday means today minus one day, read from
        the clock when the task runs.

        That works on a normal night. Now the task fails on 1 November and you retry it on 3 November.
        "Yesterday" is now 2 November. The run named 31 October loads 2 November. Backfill a whole
        month and every run loads the same wrong day.

        The run's data interval never changes, whenever the run executes. So always take the window
        from the interval, never from now().

        ## Idea 4: catchup and backfill

        Say you pause a daily DAG for five days, then unpause it.

        - With «catchup=True», Airflow creates runs for **every missed interval** since «start_date».
          You get five runs, one per missed day.
        - With «catchup=False», **only the latest** interval runs. The five missed days are skipped.

        A **backfill** is different: you choose historical intervals on purpose and rerun them, for
        example after a bug fix.

        ## Idea 5: waiting without wasting a seat

        Some tasks wait: "start when the partner file arrives". A classic **sensor** waits while
        holding a worker slot, like a person who sits at the desk staring at the door. Ten waiting
        sensors use ten workers that do nothing.

        A **deferrable** operator hands the wait to the **triggerer**. The triggerer runs thousands of
        async waits in one process, like one receptionist with many phone lines. When the condition is
        met, the task resumes on a worker.

        ## Now say it like a senior engineer

        The scheduler creates runs and queues tasks, the executor places them, workers run them, and the
        metadata database holds all state. A run starts after its data interval closes, and its
        logical date is the start of that interval. Every query is templated on the interval, so
        retries and backfills are correct.

        > [!trap] Never use now() in a task
        > A task that queries "yesterday" relative to the wall clock processes the wrong day when
        > it is retried or backfilled. Always derive the window from the run's data interval.

        > [!senior] Airflow 3 changes worth knowing
        > Airflow 3 (2025) introduced DAG versioning, an API server that isolates task execution
        > from the metadata database, and asset-driven (data-aware) scheduling as a first-class
        > idea. Mentioning that you know the direction of the project is a good signal.

        ## In one breath

        Airflow is a planner, a dispatcher, workers and a logbook, and a run is named after the day it
        covers, like a newspaper printed the next morning. Take every window from the data interval,
        never from the clock, and hand long waits to the triggerer.
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
      minutes: 15,
      body: `
        ## Start with the problem

        A task builds the daily revenue table:

        ~~~sql
        INSERT INTO daily_revenue
        SELECT city, SUM(fare) FROM trips
        WHERE day = '{{ ds }}'
        GROUP BY city
        ~~~

        It inserts the rows, then the worker crashes before it tells Airflow "done". Airflow sees a
        failed task and retries it. The retry inserts the same rows again. Revenue for that day is now
        **doubled**. The dashboard says the company had its best day ever.

        Retries, reruns and backfills all run a task again. If running again changes the answer, none
        of them are safe.

        ## Idea 1: idempotent means "pressing it twice is the same as pressing it once"

        Think of a lift button. You press "5" once or ten times, and the lift goes to floor 5 once. The
        button is **idempotent**.

        A task is idempotent when running it twice for the same interval leaves the same result as
        running it once. That one property makes retries, reruns and backfills safe. It comes up in
        almost every pipeline interview question.

        The insert above is not a lift button. It is a coin slot: each push adds more.

        ## Idea 2: four ways to make a task idempotent

        Each one turns "add" into "set".

        - **Overwrite a partition.** Replace the whole slice for the interval instead of appending:
          «INSERT OVERWRITE ... PARTITION (ds = '2026-10-31')», or a delete-then-insert in one
          transaction. Run it ten times and the slice is the same.
        - **MERGE on a key.** For upserts, match on the key, so a duplicate row updates the existing
          one instead of adding a second.
        - **Deterministic inputs.** Read exactly the interval, never "latest" or "now". The same run
          must read the same input every time.
        - **Write then swap.** Write to a staging location, then atomically rename or swap it into
          place. Readers see the old version or the new one, never half.

        Tiny example, the fix for the story: delete the day, then insert it, in one transaction. First
        run: delete 0 rows, insert 12. Retry: delete 12, insert 12. The table has 12 rows either way.

        ## Idea 3: backfill without hurting today

        A backfill reruns many past intervals, for example a year of days after a bug fix. It is like
        repainting every room in a hotel while guests still sleep there. Do it without waking them.

        - Run the backfill in a **separate pool with a concurrency limit**, so the daily runs keep
          priority.
        - Process **in date order** if each day depends on the previous one (running totals, SCD type
          2).
        - **Validate a sample** of backfilled days against known numbers before you run the full range.
        - **Communicate.** Downstream consumers will see historical numbers change.

        ## Idea 4: side effects cannot be overwritten

        Some tasks do not write a table. They send an email, call a payment API or publish an event.
        You cannot "overwrite" an email that is already in someone's inbox.

        The fix is a ticket number. Give each side effect an **idempotency key** made from the interval
        and the entity, for example «payout/2026-10-31/driver-77». Keep a record of the keys you sent.
        Before you send, check the record. A retry sees the key and skips.

        ## Now say it like a senior engineer

        Every task overwrites or merges the slice for its own interval and reads only that interval, so
        any run can be repeated. Backfills run in their own pool, in order when days depend on each
        other, with a sample check first. Side effects carry idempotency keys and a sent-log.

        > [!example] A non-idempotent task, and the fix
        > «INSERT INTO daily_revenue SELECT ... WHERE day = '{{ ds }}'» doubles revenue on a retry.
        > Fix: «DELETE FROM daily_revenue WHERE day = '{{ ds }}'» and the insert in one transaction,
        > or «INSERT OVERWRITE» on the day partition.

        > [!senior] Side effects need keys
        > Sending emails, calling payment APIs or publishing events cannot be "overwritten". Give
        > each side effect an idempotency key derived from the interval and the entity, and keep a
        > record of what was sent.

        ## In one breath

        Make every task a lift button: overwrite or merge its own slice, read only its own interval,
        and give every side effect a key. Then retries and backfills are boring, which is exactly what
        you want.
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
      minutes: 18,
      body: `
        ## Start with the problem

        Each morning you must call a partner API for every active city. The list of cities changes
        every day. Some days it is 580, some days 612. For each city you fetch data, then load it.

        In classic Airflow, the graph is a DAG file that the scheduler parses again and again, before
        any run starts. The graph is decided in advance. A loop whose length you only learn at run time
        does not fit that model well. (Airflow later added dynamic task mapping for exactly this, and
        you will see it in another lesson.)

        Prefect starts from the other end: what if the pipeline was just ordinary Python, and the graph
        was whatever the code did when it ran?

        ## Idea 1: a flow is a Python function, a task is a step inside it

        Think of a recipe card versus a cook. Airflow asks you to write the recipe card first, then a
        cook follows it. Prefect watches the cook and writes down what they did.

        - A function with «@flow» is a **flow**: one pipeline run.
        - Functions it calls with «@task» are **tasks**: steps that get retries, caching and a row in
          the UI.

        There is no DAG file parsed on a schedule. Loops and branches decided at run time just work.

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

        Read it top to bottom. «extract» retries 3 times, waiting 10, 30 and 120 seconds. It returns a
        path, not the data. «load» takes that path. The flow passes the result of one to the other,
        exactly as normal Python does.

        ## Idea 2: the same ideas, different names

        If you know Airflow, you already know most of Prefect. Here is the dictionary.

        | Airflow | Prefect 3 |
        |---|---|
        | DAG | Flow (a Python function) |
        | Operator / task | Task (a Python function), or any code inside the flow |
        | Dynamic task mapping | «task.map(items)» or a plain Python loop |
        | XCom | Return values; persisted results when caching is on |
        | Executor and workers | Work pool plus workers, or «flow.serve()» |
        | Pools and concurrency | Global concurrency limits, work pool and work queue limits |
        | Data interval | No built-in concept: pass the date as a flow parameter |

        The last row matters most. Prefect has no data interval. So you pass the day in, as «day» in
        the code above. Every query uses that parameter. To backfill 3 March, you start a run with
        «day="2026-03-03"». Never call now() inside a task.

        ## Idea 3: caching, a cheap way to skip work you already did

        Think of a student who keeps their finished homework. If the teacher asks for the same
        exercise again, with the same numbers, they hand in the old answer.

        A task's **cache policy** decides when a previous result can be reused:

        - by **inputs**: same arguments, same answer;
        - by the **task's source code**: if you edit the function, the old answer is no longer valid;
        - or a **combination**, as in «INPUTS + TASK_SOURCE» above.

        Tiny example. The flow for 31 October fails in «load». You rerun it. «extract» was called with
        the same day and its code did not change, so Prefect reuses the cached path and goes straight
        to «load». That is a cheap form of idempotency.

        ## Idea 4: transactions, so a half-done run can undo itself

        Say task A writes a file and task B registers it in a catalog. B fails. Now there is a file
        that nobody knows about.

        Prefect 3 adds **transactions**. Tasks inside «with transaction():» commit together. A task can
        register an «on_rollback» hook: "if a later task fails, delete my file". Like a shop that
        refunds your card when the item turns out to be out of stock.

        ## Idea 5: running it, serve or deploy

        You wrote a flow. How does it run every morning at 06:00?

        - **Serve.** «daily_trips.serve(name="daily", cron="0 6 * * *")» runs a long-lived process
          that polls for scheduled runs. Simple, good for one machine.
        - **Deploy.** «flow.from_source(repo, "flows.py:daily_trips").deploy(name="daily",
          work_pool_name="k8s-pool", cron="0 6 * * *")» registers a **deployment**. **Workers** poll a
          **work pool** and start each run as a process, container or Kubernetes job.

        A work pool is like a taxi rank. Runs wait in the rank. Workers are the taxis that pick them up
        and take them to the right kind of infrastructure.

        Agents and infrastructure blocks from Prefect 2 were removed in Prefect 3. Work pools and
        workers replaced them.

        ## Now say it like a senior engineer

        Prefect 3 builds the graph from ordinary Python at run time. Tasks get retries, cache policies
        and transactions with rollback hooks. There is no data interval, so the date is a flow
        parameter, which keeps runs backfillable. It runs with «serve» on one machine, or as a
        deployment that workers pick up from a work pool.

        > [!trap] Old tutorials
        > Many blog posts show «prefect agent start» and «Deployment.build_from_flow». Both belong to
        > Prefect 2. In Prefect 3 you use «serve», or «deploy» with a work pool and «prefect worker
        > start --pool <name>».

        > [!senior] Where Prefect fits and where it does not
        > Prefect is strong for Python-heavy, dynamic workflows (ML pipelines, API fan-out) and
        > teams that want local runs to look like production. Airflow's strengths are its huge
        > operator ecosystem, managed offerings (Cloud Composer, MWAA) and strict, schedule-driven
        > data intervals. Say which properties the use case needs.

        ## In one breath

        In Prefect your pipeline is plain Python: flows call tasks, tasks retry and cache, and
        transactions can roll back. Pass the date as a parameter so any day can be rerun, and run it
        with serve, or with workers that pick runs from a work pool.
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
      minutes: 13,
      body: `
        ## Start with the problem

        The interviewer asks: "Your team uses Airflow. Why not Prefect, or Dagster?"

        The weak answer is about popularity: "Airflow is the industry standard." The interviewer hears
        "I have only used one tool." The strong answer compares **properties**: what each tool is built
        around, and which of those properties this use case needs.

        ## Idea 1: each tool is built around a different picture

        Think of four kinds of vehicle. A bus runs a fixed route on a timetable. A taxi goes wherever
        the passenger says. A delivery van is planned around the parcels. An ambulance is built so the
        trip always finishes, whatever happens on the way. All four move people or things, but you
        would not swap them.

        **Airflow, the bus.**

        - Model: scheduled task DAGs.
        - Dynamic graphs: dynamic mapping, but limited.
        - Data awareness: assets and datasets, growing.
        - Ecosystem: the largest.
        - Managed options: Composer, MWAA, Astronomer.

        **Prefect, the taxi.**

        - Model: Python flows and tasks.
        - Dynamic graphs: native Python control flow.
        - Data awareness: results and caching.
        - Ecosystem: medium.
        - Managed option: Prefect Cloud.

        **Dagster, the delivery van.**

        - Model: software-defined assets. You declare the tables you want, not the steps.
        - Dynamic graphs: partitions and dynamic outputs.
        - Data awareness: the core idea, assets with lineage.
        - Ecosystem: medium.
        - Managed option: Dagster+.

        **Temporal or Cadence, the ambulance.**

        - Model: durable, long-running workflows.
        - Dynamic graphs: native code.
        - Data awareness: none. It is not a data tool.
        - Ecosystem: service orchestration.
        - Managed option: Temporal Cloud.

        ## Idea 2: Cadence and Temporal solve a different problem

        **Cadence** was created at Uber for durable service workflows, for example multi-step trip and
        payment processes. Temporal is its successor, by the same original authors.

        Their promise: a long business process finishes even if servers crash halfway. Step 3 of a
        payment will not run twice, and step 4 will not be forgotten. That is not data orchestration.
        They do not think about daily partitions or backfills. If an interviewer at Uber mentions
        Cadence, they want to see that you know this difference.

        (Airflow, for the record, came from Airbnb.)

        ## Idea 3: decide with three questions

        1. Is the workload **time-scheduled batch** over data intervals, or **event-driven and
           dynamic**?
        2. Does the team want **lineage and data assets** as first-class objects?
        3. What does the company **already run**, and who will operate it on call?

        Tiny example. A team runs 300 nightly SQL pipelines on Cloud Composer, and the on-call team
        knows Airflow well. Question 1 says batch, question 3 says Airflow is already paid for. Stay on
        Airflow. A separate ML team fans out over a different list of models each day and wants local
        runs to match production. Question 1 says dynamic. Prefect is a fair choice there.

        ## Now say it like a senior engineer

        Airflow is schedule-driven with the biggest ecosystem. Prefect is dynamic Python. Dagster is
        asset-first with lineage. Temporal and Cadence are durable service workflows, not data tools.
        Choose by workload shape, need for assets, and what the team can operate.

        > [!senior] The migration answer
        > If you would change tools, say how: run both side by side, migrate the least critical
        > pipelines first, keep the same idempotent task code, and compare outputs before cutting
        > over. Interviewers want to see that you respect the cost of change.

        ## In one breath

        Compare orchestrators by what they are built around: schedules, Python, assets or durable
        workflows. Pick with three questions about workload, lineage and operations, and if you switch,
        migrate slowly and side by side.
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
      minutes: 19,
      body: `
        ## Start with the problem

        An interviewer who uses Airflow every day says: "Write me a DAG that builds trip metrics for
        each city, every day." You write it on the whiteboard. Then comes the real question: "One city
        fails. What happens to the others, and to the task at the end?"

        To answer, you need four tools: TaskFlow for writing tasks, mapping for "one task per city",
        trigger rules for "what runs after a failure", and setup and teardown for cleaning up. This
        lesson builds that DAG, one idea at a time.

        ## Idea 1: TaskFlow, tasks as plain functions

        The **TaskFlow API** turns a Python function into a task with «@task». When one task's return
        value is passed into another, two things happen:

        - the value goes to the next task through **XCom**;
        - Airflow **infers the dependency** from the call, so you do not write «a >> b».

        In Airflow 3, DAG authors import from «airflow.sdk».

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

        Read the last line from the inside out. «list_cities()» returns 4 cities. «build_city.expand»
        makes one task per city. «publish» receives the 4 paths. That one line is the whole graph.

        ## Idea 2: dynamic task mapping, one task per item

        Think of a teacher with a pile of exam papers. Today there are 4, tomorrow 40. The teacher does
        not rewrite the lesson plan, they just hand one paper to each helper.

        «build_city.expand(city=...)» creates one task instance per element **at run time**, so the
        number of cities can change between runs without a code change. «partial()» fixes the arguments
        that do not vary. The downstream task receives the list of results.

        Each city is its own task, so each city retries on its own, and the UI shows which city failed.

        But helpers can overwhelm the photocopier. A list of 5,000 elements becomes 5,000 simultaneous
        queries against the warehouse. Limit the fan-out with «max_active_tis_per_dag» (it is 2 in the
        code above) or a **pool**.

        ## Idea 3: XCom carries notes, not parcels

        XCom values are stored in the metadata database, the same database the scheduler reads all the
        time. A small value, such as a path or a count, is a note. A DataFrame is a parcel, and it
        slows the scheduler for every DAG.

        ## Idea 4: trigger rules, "when may I start?"

        By default a task starts only when **every** task before it succeeded. That default is a
        **trigger rule**, and you can choose another one. A task runs when its upstream tasks reach the
        state its trigger rule asks for.

        - «all_success»: the default. Every upstream succeeded. Use it for normal steps.
        - «all_done»: every upstream finished, in any state. Use it for cleanup and notifications.
        - «one_failed»: at least one upstream failed. Use it for an alert or a rollback task.
        - «none_failed»: no upstream failed; skips are fine. Use it for a join after a branch.
        - «none_failed_min_one_success»: as above, and at least one succeeded. The usual join after a
          branch.
        - «all_skipped»: every upstream was skipped. A "nothing to do" path.
        - «always»: always, even with no upstream run. Rarely right; prefer «all_done».

        ## Idea 5: branching, and the classic bug

        Sometimes the DAG takes one road or the other: a full reload on the first day of the month, an
        incremental load on other days. «@task.branch» returns the task id (or ids) to follow. The
        other direct paths are **skipped**.

        ~~~python
        @task.branch
        def full_or_incremental(ds=None) -> str:
            return "full_reload" if ds.endswith("-01") else "incremental_load"
        ~~~

        Now the bug. After the two paths there is a join task. On 5 March, «full_reload» is skipped.
        The join has the default «all_success» rule. "Skipped" is not "success", so the join is skipped
        too. Skips **propagate**, like one closed road that closes every road after it. The run is
        green, and nothing was published.

        The fix: give the join «none_failed_min_one_success».

        ## Idea 6: setup and teardown, cleanup that always happens

        Say the DAG starts a temporary Spark cluster, runs work on it, then deletes it. If the work
        fails, a normal "delete cluster" task never runs, and the cluster costs money all weekend.

        Mark the task that creates a resource with «as_setup()» and the one that removes it with
        «as_teardown(setups=...)». Airflow runs the teardown even when the work in between fails, and
        the teardown's own result does not fail the run by default. Use it for a temporary cluster or a
        scratch schema, instead of a cleanup task with «all_done» that someone forgets to wire.

        ## Now say it like a senior engineer

        TaskFlow infers dependencies from function calls. Mapping fans out at run time with a
        concurrency cap. XCom carries only references. The join after a branch uses
        «none_failed_min_one_success», and temporary resources use setup and teardown.

        > [!trap] XCom is not a data channel
        > XCom values are stored in the metadata database. Pass paths, ids and counts, never a
        > DataFrame. A large XCom slows the scheduler for every DAG. If you must pass data, use an
        > object storage XCom backend, and still prefer passing a path.

        > [!senior] The failure walk-through
        > Be ready to say, for your DAG: which task retries and how often, which tasks are
        > skipped when a branch is not taken, what the join does, what runs on failure (an
        > «on_failure_callback» or a «one_failed» task), and why rerunning the whole run is safe
        > (each task overwrites its partition).

        ## In one breath

        Write tasks as functions, fan out with «expand» and a limit, and pass only small notes through
        XCom. Know your trigger rules, because a skip after a branch silently skips the join unless you
        give it «none_failed_min_one_success».
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
      minutes: 16,
      body: `
        ## Start with the problem

        A partner sends you a trips file every morning, "sometime between 2 and 8 AM". Your DAG must
        not start until the file is there. You also call the partner's API from five different DAGs,
        and each DAG has its own copy of the login and retry code.

        So two problems: how do you **wait** well, and how do you **reuse** an integration instead of
        copying it? Sensors answer the first. Hooks and operators answer the second.

        ## Idea 1: a sensor is a task that waits

        A sensor waits until a condition is true: a file lands, a partition appears, another DAG
        finishes. The question is **how** it waits. Picture someone waiting for a parcel.

        - «poke», **sit by the door.** The sensor holds a worker slot and checks every
          «poke_interval». It costs one slot per waiting sensor. Fine for short waits only.
        - «reschedule», **check, then go back to work.** It checks, frees the slot, and is
          rescheduled for the next check. No slot between checks, but each check is a new task start.
        - **Deferrable**, «deferrable=True», **ask the reception desk to call you.** The sensor hands the
          wait to the **triggerer**, an async process. Thousands of waits fit in one process. This is
          the default choice for long waits.

        Tiny example. 200 sensors wait up to five hours each. In poke mode they hold 200 worker slots
        doing nothing, and real tasks queue behind them. Deferrable, they hold zero slots.

        ## Idea 2: always decide how long to wait

        Always set «timeout», the total time to wait. Then decide what a timeout means:

        - fail and alert, or
        - «soft_fail=True», which marks the sensor skipped.

        A sensor without a timeout waits seven days by default, holding up the run behind it.

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

        This waits for the «_SUCCESS» marker of the run's day, checks every 5 minutes, gives up after
        6 hours, and holds no worker while it waits.

        ## Idea 3: hooks are the plug, operators are the appliance

        Think of a wall socket and a kettle.

        - A **hook** is the plug. It wraps a connection to an external system. It reads credentials
          from an Airflow **connection** (or a secrets backend) and exposes methods, such as
          «fetch_day».
        - An **operator** is the appliance. It is a reusable task: it takes parameters, uses hooks, and
          does its work in «execute».

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

        Three rules hide in that code.

        - «template_fields» lists the arguments Airflow renders with Jinja at run time. So
          «day="{{ ds }}"» becomes the run's date.
        - **The constructor runs every time the scheduler parses the file.** Do no I/O there; do it in
          «execute». An API call in the constructor runs on every parse, for every DAG.
        - **Share it properly.** Package operators and hooks in an internal provider package with
          tests. Do not copy them between DAG folders.

        ## Now say it like a senior engineer

        Long waits are deferrable, with a timeout and a clear meaning for that timeout. Integrations are
        a hook for the connection and an operator for the reusable task, with templated fields and no
        I/O at parse time.

        > [!tip] Prefer events over polling
        > If the producer is your own pipeline, have it update an **asset** and schedule the
        > consumer on that asset. Polling is for systems you do not control.

        > [!senior] When not to write an operator
        > A custom operator is worth it when several teams repeat the same integration. For one
        > DAG, a «@task» function is simpler. For heavy or conflicting dependencies, run the work
        > in a container with «KubernetesPodOperator» or «@task.docker», so the Airflow image stays
        > small.

        ## In one breath

        Wait with deferrable sensors that have a timeout, so waiting costs no workers. Wrap each
        external system in a hook, build reusable tasks as operators that do their work in «execute»,
        and keep the constructor free of I/O.
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
      minutes: 17,
      body: `
        ## Start with the problem

        On Friday someone merges a DAG change with a typo in an import. In production, nothing fails
        loudly. The DAG just **disappears from the UI**. No runs, no red task, no alert. On Monday the
        finance team asks where the weekend numbers are.

        Separately, the Airflow workers keep running out of memory, and one team needs a GPU library
        that conflicts with everyone else's. This lesson covers how to catch the first problem before
        deploy, and how to run Airflow so the second one does not happen.

        ## Idea 1: three levels of tests

        Think of checking a car. First, does it start? Then, does each part work on the bench? Then, a
        short drive round the block.

        1. **Integrity tests: does it start?** Load every DAG file the way the scheduler does. Fail on
           import errors, cycles, or missing conventions such as owners, tags and retries.
        2. **Unit tests: each part on the bench.** Call the task logic directly. Keep the logic in
           plain functions in a package, and keep the task a thin wrapper, so tests need no Airflow at
           all.
        3. **Run tests: round the block.** Execute a whole DAG for one logical date in a single process
           with «dag.test()», against a test warehouse or local fakes.

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

        The first test would have caught Friday's typo in seconds. Run these in CI on every pull
        request, then deploy the DAG files and the image.

        ## Idea 2: parse time is a budget

        The DAG processor re-parses DAG files continuously, many times an hour. Top-level code runs on
        every parse: database calls, API calls, reading a big config. It slows scheduling for everyone.

        Like a shop sign that you repaint every time a customer walks past. Generate DAGs from a small
        static config, and do the real work inside tasks.

        ## Idea 3: executors, where tasks physically run

        - «LocalExecutor»: processes on the scheduler machine. Fits small installs and development.
        - «CeleryExecutor»: a pool of long-running workers fed by a queue. Fits many short tasks;
          tasks start fast.
        - «KubernetesExecutor»: one pod per task. Fits isolation, per-task resources and uneven
          load.

        Since Airflow 2.10 one deployment can configure several executors and choose per task.

        Separately, «KubernetesPodOperator» runs any container image as a task, whatever the executor.
        That is the answer to the GPU team: their task runs in its own image, with its own GPU and
        libraries, and the shared Airflow image stays small.

        ## Idea 4: managed Airflow, someone else runs the engine room

        - **Amazon MWAA:** DAGs and requirements come from S3. Celery workers with autoscaling.
        - **Google Cloud Composer 3:** runs on GKE managed by Google. DAGs live in a Cloud Storage
          bucket.
        - **Astronomer (Astro):** image-based deploys with a CLI, multiple executors, hosted on several
          clouds.
        - **Self-managed on Kubernetes:** the official Helm chart. You own upgrades and the metadata
          database.

        Managed versions trail open source releases. Check that your target service supports the
        Airflow version and provider versions you test against.

        ## Now say it like a senior engineer

        CI loads the DagBag and runs unit tests on every pull request, because a broken DAG vanishes
        instead of failing. Top-level code is cheap, heavy work runs in pods, and the executor matches
        the load shape.

        > [!senior] What a platform owner says
        > "DAG code and the runtime image are versioned and deployed separately; CI runs the
        > integrity and unit tests; heavy work runs in pods; the metadata database is backed up
        > and its old rows are cleaned with «airflow db clean»; and we alert on scheduler
        > heartbeat, DAG processor errors and queued tasks, not only task failures."

        ## In one breath

        Test DAGs at three levels, and above all load the DagBag in CI, because a DAG with an import
        error silently disappears. Keep parse-time code tiny, run heavy or odd tasks in their own pods,
        and pick an executor or managed service that matches your load.
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

      from partner import active_cities, fetch_trips, save_raw, load_raw


      @task
      def cities_for(day):
          return active_cities(day)  # read the list when the run starts


      @task(retries=3, retry_delay_seconds=[5, 30, 120])
      def fetch(city, day):
          with concurrency("partner-api", occupy=1):  # global limit partner-api, 20 slots
              rows = fetch_trips(city, day)
          return save_raw(city, day, rows)  # pass the path on, not the rows


      @task
      def load(paths, day):
          return load_raw(paths, day)


      @flow
      def partner_daily(day):
          cities = cities_for(day)
          futures = fetch.map(cities, day=day)
          load([future.result() for future in futures], day)
      ~~~

      Create the limit once with «prefect gcl create partner-api --limit 20». The limit lives on
      the server, so it also holds when two runs overlap. The slot is held only during the API
      call: saving the file and the wait before a retry do not block other cities.

      The numbers: 600 calls of 2 seconds, 20 at a time, take about 60 seconds. One city at a time
      takes 20 minutes. Each city retries on its own, with longer waits (5, 30, 120 seconds), so
      one timeout does not fail or repeat the other 599 cities.

      In Airflow, dynamic task mapping does the same fan-out: «fetch.expand(city=active_cities())»,
      with a pool of 20 slots as the limit. The Prefect version reads as plain Python and runs
      locally unchanged. Airflow gives one task instance per city in the UI and works with the
      pools that the platform already has.
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
      import urllib.error
      import urllib.parse
      import urllib.request

      from airflow.sdk import BaseHook, BaseOperator

      import storage


      class PartnerApiHook(BaseHook):
          """Owns the connection and the HTTP details of the partner API."""

          def __init__(self, conn_id="partner_api", timeout_s=30, max_retries=4):
              super().__init__()
              self.conn_id = conn_id
              self.timeout_s = timeout_s
              self.max_retries = max_retries

          def _get(self, url, token):
              request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
              for attempt in range(self.max_retries + 1):
                  try:
                      with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                          return json.load(response)
                  except urllib.error.HTTPError as error:
                      if error.code < 500 or attempt == self.max_retries:
                          raise
                  except (TimeoutError, urllib.error.URLError):
                      if attempt == self.max_retries:
                          raise
                  time.sleep(2 ** attempt)

          def pages(self, day):
              conn = self.get_connection(self.conn_id)
              cursor = ""
              while True:
                  query = urllib.parse.urlencode({"day": day, "cursor": cursor})
                  body = self._get(f"https://{conn.host}/v1/trips?{query}", conn.password)
                  yield body["items"]
                  cursor = body.get("next_cursor") or ""
                  if not cursor:
                      return


      class PartnerApiToStorageOperator(BaseOperator):
          """Writes one day of the partner API to storage as JSON lines, all or nothing."""

          template_fields = ("day", "target_uri")

          def __init__(self, *, day, target_uri, conn_id="partner_api", **kwargs):
              super().__init__(**kwargs)
              self.day = day
              self.target_uri = target_uri
              self.conn_id = conn_id

          def execute(self, context):
              hook = PartnerApiHook(self.conn_id)
              temp_uri = f"{self.target_uri}.tmp-{context['run_id']}"
              try:
                  with storage.open(temp_uri, "w") as out:
                      for page in hook.pages(self.day):
                          for item in page:
                              out.write(json.dumps(item) + "\\n")
                  storage.rename(temp_uri, self.target_uri)
              finally:
                  if storage.exists(temp_uri):
                      storage.delete(temp_uri)
              return self.target_uri
      ~~~

      **What makes it safe:**
      - Credentials come from an Airflow connection or secrets backend, never the DAG file.
      - Every request has a timeout. Only a timeout, a network error or a 5xx answer is
        retried, up to 4 times, with a longer wait each time. A 4xx answer fails at once: a
        wrong token or an unknown day does not get better with a retry.
      - The lines go to a temporary file named after the run. One «rename» then replaces the
        target, so a failure never leaves a partial file, and a rerun replaces the same day.
        The «finally» block removes the temporary file when something fails.
      - «day» and «target_uri» are templated, so «day="{{ ds }}"» follows the run’s interval and
        backfills work.

      On S3 or GCS, an object appears only when its upload completes, and a "rename" is a copy
      and a delete. There, upload the finished file in one step to the final key, or write the
      parts and then a manifest that readers trust.

      **Tests:** unit-test the hook against a fake HTTP server: three pages, a timeout, a 503
      and then success, a 404, and a partner that stays down. Unit-test the operator with a
      fake storage, and assert that the target appears only after the last page. Add one
      DagBag integrity test per team’s DAG. Ship both in an internal provider package with a
      version, so a fix reaches all five teams.
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
