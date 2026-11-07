import type { Problem, Track } from '@/types/course';

export const track: Track = {
  slug: 'python',
  title: 'Python and data coding',
  summary:
    'The data structures, patterns and production habits that coding rounds test, in idiomatic Python.',
  tone: 'grape',
  why: 'Google runs real coding rounds for data engineers, and Uber asks practical data-manipulation problems. Clean, tested Python with the right complexity is non-negotiable at senior level.',
  lessons: [
    {
      slug: 'core-structures',
      title: 'The structures you reach for',
      summary:
        'Choose between list, dict, set, deque and heap by the operation you need to be fast.',
      minutes: 13,
      body: `
        Most data coding problems are solved by picking the structure whose fast operation matches
        the question. Say the complexity as you choose. It is the cheapest senior signal there is.

        | Need | Structure | Cost |
        |---|---|---|
        | Look up or count by key | «dict», «collections.Counter» | O(1) average |
        | Membership, dedupe | «set» | O(1) average |
        | Group values by key | «collections.defaultdict(list)» | O(1) per append |
        | Add or remove at both ends | «collections.deque» | O(1) |
        | Always get the smallest | «heapq» on a list | O(log n) push and pop |
        | Keep items in order, search | sorted list with «bisect» | O(log n) search, O(n) insert |

        ~~~python
        from collections import Counter, defaultdict, deque
        import heapq

        events = [("u1", "open"), ("u2", "open"), ("u1", "click"), ("u1", "open")]

        per_user = defaultdict(list)
        for user, name in events:
            per_user[user].append(name)          # {'u1': ['open', 'click', 'open'], 'u2': ['open']}

        counts = Counter(name for _, name in events)
        counts.most_common(1)                    # [('open', 3)]

        top2 = heapq.nlargest(2, counts.items(), key=lambda kv: kv[1])
        ~~~

        > [!trap] «list.pop(0)» is O(n)
        > Removing from the front of a list shifts every element. In a sliding window or a BFS, use
        > «deque.popleft()», which is O(1). Interviewers notice.

        ## Heaps for "top k" and "next smallest"

        Python's «heapq» is a min-heap. For the k largest items in a stream, keep a min-heap of size
        k: the smallest of the current top k sits on top, ready to be evicted.

        ~~~python
        def top_k(stream, k):
            heap = []
            for value in stream:
                if len(heap) < k:
                    heapq.heappush(heap, value)
                elif value > heap[0]:
                    heapq.heapreplace(heap, value)
            return sorted(heap, reverse=True)    # O(n log k) time, O(k) memory
        ~~~

        > [!senior] Say the memory too
        > "O(n log k) time and O(k) memory, so it works on a stream that does not fit in RAM" is the
        > sentence that turns a correct answer into a data engineering answer.
      `,
      checks: [
        {
          question:
            'You need the 10 most frequent items in a stream of 10 billion. Which approach fits memory best?',
          options: [
            'Sort the whole stream',
            'Counter over the stream, then a size-10 heap over the counts',
            'A list and list.pop(0)',
            'A set of all items',
          ],
          answer: 1,
          why: 'Counting needs memory per distinct item, not per event, and a size-k heap picks the top k in O(d log k). If distinct items are too many for memory, you move to a sketch such as Count-Min plus a heap.',
        },
      ],
    },
    {
      slug: 'generators-and-files',
      title: 'Generators and data that does not fit',
      summary: 'Process large files and streams lazily, in chunks, with constant memory.',
      minutes: 12,
      body: `
        A data engineer's Python must work on inputs larger than memory. Generators are the tool:
        they produce one item at a time, so a pipeline of generators holds only what it is working on.

        ~~~python
        import json
        from typing import Iterator

        def read_events(path: str) -> Iterator[dict]:
            with open(path, encoding="utf-8") as handle:
                for line_number, line in enumerate(handle, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError:
                        # Send bad rows to a dead-letter list instead of crashing the job.
                        print(f"bad row {line_number}")

        def only(events: Iterator[dict], name: str) -> Iterator[dict]:
            return (event for event in events if event.get("event") == name)

        def batched(items: Iterator[dict], size: int) -> Iterator[list[dict]]:
            batch: list[dict] = []
            for item in items:
                batch.append(item)
                if len(batch) == size:
                    yield batch
                    batch = []
            if batch:
                yield batch

        for chunk in batched(only(read_events("events.jsonl"), "trip_completed"), 5_000):
            ...  # write chunk to the warehouse
        ~~~

        Python 3.12 added «itertools.batched», which does the same as the helper above.

        > [!trap] A generator runs once
        > After you iterate it, it is empty. Calling «len()» on it fails, and looping twice gives
        > nothing the second time. Materialise with «list()» only when you know it fits.

        ## Bad rows are data too

        Production readers do not crash on one malformed line. They count it, route it to a
        dead-letter location with the reason, and alert if the bad-row rate passes a threshold.
        Mentioning that in a coding round is a strong operational signal.

        > [!senior] Know when Python is the wrong tool
        > For hundreds of gigabytes, a generator is still single-threaded. Say when you would move
        > the job to Spark, Beam or a warehouse «COPY», and why.
      `,
      checks: [
        {
          question: 'Why does a chain of generators process a 50 GB file with little memory?',
          options: [
            'Python compresses generator data',
            'Each stage pulls one item at a time, so only items in flight are held',
            'Generators run on the GPU',
            'The file is memory-mapped automatically',
          ],
          answer: 1,
          why: 'Generators are lazy. Nothing is read until the last stage asks for the next item, and each item can be dropped once processed.',
        },
      ],
    },
    {
      slug: 'intervals-and-windows',
      title: 'Intervals, sweeps and sliding windows',
      summary:
        'Solve overlap, concurrency and rate questions with sorting, sweep lines and deques.',
      minutes: 15,
      body: `
        Trips, sessions, shifts and ad campaigns are intervals. Rate limits and "events in the last
        minute" are windows. These patterns cover a large share of practical coding questions.

        ## Merge overlapping intervals

        Sort by start, then extend the current interval while the next one overlaps it.

        ~~~python
        def merge(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
            merged: list[tuple[int, int]] = []
            for start, end in sorted(intervals):
                if merged and start <= merged[-1][1]:
                    merged[-1] = (merged[-1][0], max(merged[-1][1], end))
                else:
                    merged.append((start, end))
            return merged
        ~~~

        ## Sweep line: maximum concurrency

        Turn each interval into two events, +1 at start and -1 at end, sort them, and keep a running
        total. Decide whether an interval ending at time t overlaps one starting at t, and sort ends
        before starts if it does not.

        ~~~python
        def max_concurrent(trips: list[tuple[int, int]]) -> int:
            points = []
            for start, end in trips:
                points.append((start, 1))
                points.append((end, -1))
            points.sort(key=lambda p: (p[0], p[1]))  # -1 sorts before +1 at the same time
            current = best = 0
            for _, delta in points:
                current += delta
                best = max(best, current)
            return best
        ~~~

        ## Sliding window with a deque

        "How many requests did this user make in the last 60 seconds?" Keep the timestamps in a
        deque and drop old ones from the left.

        ~~~python
        from collections import defaultdict, deque

        class RateCounter:
            def __init__(self, window_s: int = 60) -> None:
                self.window_s = window_s
                self.hits: dict[str, deque[float]] = defaultdict(deque)

            def hit(self, user: str, ts: float) -> int:
                q = self.hits[user]
                q.append(ts)
                while q and q[0] <= ts - self.window_s:
                    q.popleft()
                return len(q)
        ~~~

        > [!senior] Memory and out-of-order input
        > The deque grows with the request rate. At very high rates, switch to fixed buckets (one
        > counter per second, sixty buckets) for O(1) memory per user. Also ask whether timestamps
        > can arrive out of order, because the deque version assumes they do not.
      `,
      checks: [
        {
          question:
            'In the sweep line for max concurrency, a trip ends at 10 and another starts at 10. They should not overlap. How do you sort?',
          options: [
            'Starts before ends at the same time',
            'Ends before starts at the same time',
            'By duration',
            'It does not matter',
          ],
          answer: 1,
          why: 'Processing the -1 first lowers the count before the +1 raises it, so touching intervals are not counted as concurrent.',
        },
      ],
    },
    {
      slug: 'production-python',
      title: 'Production habits in a coding round',
      summary: 'Retries, idempotency, typing and tests: the details that make code shippable.',
      minutes: 12,
      body: `
        At senior level, "it works on the example" is the floor. Interviewers look for code they
        would approve in review: clear names, types, error handling and a test.

        ## Retries with exponential backoff and jitter

        ~~~python
        import random
        import time

        class TransientError(Exception):
            pass

        def with_retries(call, attempts: int = 5, base_s: float = 0.5, cap_s: float = 20.0):
            for attempt in range(attempts):
                try:
                    return call()
                except TransientError:
                    if attempt == attempts - 1:
                        raise
                    delay = min(cap_s, base_s * 2 ** attempt)
                    time.sleep(random.uniform(0, delay))  # full jitter avoids thundering herds
        ~~~

        Retry only errors that can succeed later (timeouts, 429, 503). Never retry a validation
        error. And a retried write must be **idempotent**, or a retry creates a duplicate.

        ## Idempotent writes

        Give every write a deterministic key so doing it twice has the same effect as once:

        - Upsert by a natural or event id instead of blind inserts.
        - Overwrite a whole partition («date=2026-10-31») instead of appending to it.
        - Record processed offsets or file names in the same transaction as the output.

        ## A test, even a tiny one

        ~~~python
        def test_merge_handles_touching_and_nested():
            assert merge([(1, 3), (2, 6), (8, 10), (9, 9)]) == [(1, 6), (8, 10)]
            assert merge([]) == []
        ~~~

        > [!senior] Name the edge cases before you code
        > Empty input, one element, duplicates, unsorted input, very large values and time zones.
        > Listing them first, then testing two of them, shows how you work in real life.
      `,
      checks: [
        {
          question: 'Why add random jitter to exponential backoff?',
          options: [
            'To make retries faster',
            'So many clients that failed together do not retry at the same instant',
            'Because sleep is imprecise',
            'To avoid idempotency issues',
          ],
          answer: 1,
          why: 'Without jitter, clients that failed together retry in lockstep and overload the recovering service again.',
        },
      ],
    },
    {
      slug: 'decorators-and-context-managers',
      title: 'Decorators and context managers',
      summary:
        'Write a retry decorator and an atomic-write context manager, and explain what each line does.',
      minutes: 15,
      body: `
        Two language features show up again and again in pipeline code, and interviewers ask you
        to write both from memory: a decorator that adds behaviour around a function, and a
        context manager that guarantees cleanup.

        ## Decorators

        A **decorator** is a function that takes a function and returns a new one. «@retry(...)»
        above a definition is shorthand for «fetch_page = retry(...)(fetch_page)». A decorator
        with arguments therefore has three layers: the arguments, the function, the call.

        ~~~python
        import functools
        import logging
        import random
        import time

        log = logging.getLogger("pipeline")


        def retry(times: int = 3, base_delay_s: float = 0.5, retry_on: tuple = (ConnectionError, TimeoutError)):
            def decorator(func):
                @functools.wraps(func)
                def wrapper(*args, **kwargs):
                    for attempt in range(1, times + 1):
                        try:
                            return func(*args, **kwargs)
                        except retry_on as error:
                            if attempt == times:
                                raise
                            delay = base_delay_s * 2 ** (attempt - 1) * random.uniform(0.5, 1.5)
                            log.warning("retry %s after %s: attempt %d", func.__name__, error, attempt)
                            time.sleep(delay)
                return wrapper
            return decorator


        @retry(times=4)
        def fetch_page(cursor: str) -> dict:
            ...
        ~~~

        What the interviewer listens for:

        - «functools.wraps» copies the name, docstring and signature, so logs, stack traces and
          tools that inspect the function still see «fetch_page», not «wrapper».
        - Retry **only** errors that can succeed on a second try. Retrying a «ValueError» from bad
          data wastes time and hides the bug.
        - **Exponential backoff with jitter** stops a thousand workers from retrying in step and
          knocking the service over again.
        - The last attempt re-raises the original error with its traceback («raise» on its own).
        - Retrying is only safe if the call is idempotent. Say so.

        Other decorators you will write or meet: timing and metrics, caching
        («functools.lru_cache» for pure functions only), registering functions in a dictionary
        (how «@task» and «@app.route» work), and input validation.

        ## Context managers

        A **context manager** runs setup on entry to a «with» block and cleanup on exit, even
        when the block raises. «__exit__» receives the exception, if any, and returns «True» only
        to swallow it, which you almost never want.

        ~~~python
        import contextlib
        import os
        from pathlib import Path


        @contextlib.contextmanager
        def atomic_write(path: Path):
            tmp = path.with_suffix(path.suffix + ".tmp")
            handle = open(tmp, "w", encoding="utf-8")
            try:
                yield handle
                handle.close()
                os.replace(tmp, path)  # atomic on the same file system
            except BaseException:
                handle.close()
                tmp.unlink(missing_ok=True)
                raise
        ~~~

        A reader sees either the old file or the complete new one, never half a file. The same
        idea, write somewhere private then publish in one step, is how idempotent tasks write to
        object storage and tables.

        | Use a context manager for | Example |
        |---|---|
        | Resources that must be released | Files, database connections, locks |
        | A unit of work that commits or rolls back | A transaction |
        | Temporary state | A temporary directory, a changed working directory, an env var in a test |
        | Measuring a block | A timer that logs the duration |

        «contextlib.ExitStack» manages a variable number of resources, such as one open file per
        input partition.

        > [!senior] Connect the feature to the failure
        > "The decorator makes transient failures invisible to the caller but keeps permanent
        > ones loud. The context manager means a crash never leaves a partial output." Naming
        > the failure each one prevents is the senior part.
      `,
      checks: [
        {
          question: 'What does functools.wraps do in a decorator?',
          options: [
            'Makes the wrapper run faster',
            'Copies the wrapped function’s name, docstring and metadata onto the wrapper',
            'Retries the function automatically',
            'Turns the decorator into a context manager',
          ],
          answer: 1,
          why: 'Without it, every decorated function reports itself as wrapper in logs, traces and introspection.',
        },
        {
          question: 'Which error should a retry decorator around an HTTP call usually not retry?',
          options: [
            'A connection reset',
            'A timeout',
            'A 400 Bad Request caused by invalid input',
            'A 503 Service Unavailable',
          ],
          answer: 2,
          why: 'A 400 will fail the same way every time. Retry transient errors only.',
        },
      ],
    },
    {
      slug: 'pytest-for-pipelines',
      title: 'Testing pipelines with pytest',
      summary:
        'Structure pipeline code so it can be tested, and use fixtures, parametrize, tmp_path and monkeypatch well.',
      minutes: 14,
      body: `
        Pipeline code is hard to test when reading, transforming and writing are mixed in one
        function. The first move is structural: keep **transformations pure** (data in, data
        out) and push I/O to thin edges. Then most tests need no database, no cloud and no
        network.

        ## A pure transform and its tests

        ~~~python
        from datetime import datetime, timezone


        def clean_trip(raw: dict) -> dict | None:
            if raw.get("status") == "test":
                return None
            fare = round(float(raw["fare"]), 2)
            if fare < 0:
                raise ValueError(f"negative fare in trip {raw['trip_id']}")
            started = datetime.fromtimestamp(raw["started_ms"] / 1000, tz=timezone.utc)
            return {"trip_id": raw["trip_id"], "fare": fare, "started_at": started.isoformat()}
        ~~~

        ~~~python
        import pytest

        from transforms import clean_trip


        @pytest.fixture
        def raw_trip():
            return {"trip_id": "t1", "fare": "12.499", "started_ms": 1793318400000, "status": "completed"}


        def test_rounds_fare_and_converts_time(raw_trip):
            row = clean_trip(raw_trip)
            assert row == {"trip_id": "t1", "fare": 12.5, "started_at": "2026-10-30T00:00:00+00:00"}


        @pytest.mark.parametrize("status, kept", [("completed", True), ("cancelled", True), ("test", False)])
        def test_drops_only_test_trips(raw_trip, status, kept):
            raw_trip["status"] = status
            assert (clean_trip(raw_trip) is not None) == kept


        def test_negative_fare_fails_loudly(raw_trip):
            raw_trip["fare"] = "-3"
            with pytest.raises(ValueError, match="negative fare"):
                clean_trip(raw_trip)
        ~~~

        ## The pytest tools that matter

        | Tool | Use it for |
        |---|---|
        | **Fixtures** | Shared setup: a sample record, a Spark session («scope="session"»), a test database |
        | «@pytest.mark.parametrize» | One test, many cases: edge values, every status, every time zone |
        | «tmp_path» | A fresh directory per test for files the job writes |
        | «monkeypatch» | Replace an environment variable, a clock or a client for one test |
        | «pytest.raises» | Assert that bad input fails, and with which message |
        | Markers | Separate fast unit tests from slow integration tests in CI |

        ## What to test in a data pipeline

        1. **Transform logic:** nulls, duplicates, time zones and daylight saving changes, empty
           input, a late record, a schema with an extra field.
        2. **Idempotency:** run the job twice on the same input and assert the output is the
           same, not doubled.
        3. **Contracts:** the output schema and types, checked in the test, not only in
           production.
        4. **Integration:** against a real but local engine (DuckDB, a Postgres container, a
           local Spark session) for the SQL and the writes. Mark these as slow.

        Data tests in production (row counts, uniqueness, freshness) are a different layer.
        They catch bad data; unit tests catch bad code. A senior engineer wants both.

        > [!trap] Mocking everything tests nothing
        > A test that mocks the database client and asserts it was called with a string only
        > proves you wrote that string. Test SQL against a real engine, even a small local one.

        > [!senior] How you would say it
        > "I keep transforms pure so they are unit-tested with plain dictionaries, I run the SQL
        > against DuckDB or a container in CI, I test reruns for idempotency, and I let data
        > tests in the warehouse catch what code tests cannot."
      `,
      checks: [
        {
          question: 'Which design makes a pipeline easiest to unit-test?',
          options: [
            'One function that reads, transforms and writes',
            'Pure transform functions with I/O kept in thin functions at the edges',
            'Global database connections created at import time',
            'Mocking every library call',
          ],
          answer: 1,
          why: 'Pure functions take data and return data, so tests need no infrastructure.',
        },
        {
          question: 'Which pytest feature runs one test against ten edge cases?',
          options: ['tmp_path', '@pytest.mark.parametrize', 'monkeypatch', 'pytest.raises'],
          answer: 1,
          why: 'parametrize generates one test case per set of arguments.',
        },
      ],
    },
    {
      slug: 'concurrency-and-packaging',
      title: 'Concurrency, the GIL and packaging',
      summary:
        'Pick threads, processes or asyncio for a workload, and ship pipeline code as a versioned package.',
      minutes: 14,
      body: `
        ## The GIL in one paragraph

        In the standard CPython build, the **global interpreter lock (GIL)** lets one thread run
        Python bytecode at a time. Threads still help when they wait on I/O, because a thread
        releases the GIL while it waits. They do not speed up CPU-bound Python code. Python 3.13
        added an experimental free-threaded build, and Python 3.14 made it officially supported
        but not the default, so most production code still runs with the GIL.

        | Workload | Choose | Why |
        |---|---|---|
        | Many network calls (APIs, object storage) | Threads, or asyncio | Waiting releases the GIL |
        | Thousands of concurrent connections | asyncio | One thread, cheap tasks, needs async libraries |
        | CPU-bound pure Python (parsing, hashing) | Processes | Each process has its own interpreter and GIL |
        | NumPy, pandas, Polars, PyArrow work | Usually one process | They run in C and release the GIL themselves |
        | Data bigger than one machine | Spark, Beam, Dask | Not a threading question |

        ~~~python
        import hashlib
        import time
        from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed


        def fetch(url: str) -> int:
            time.sleep(0.2)  # stands in for a network call with a timeout
            return len(url)


        def hash_chunk(lines: list[str]) -> str:
            digest = hashlib.sha256()
            for line in lines:
                digest.update(line.encode())
            return digest.hexdigest()


        if __name__ == "__main__":
            urls = [f"https://api.example.com/p/{i}" for i in range(20)]
            with ThreadPoolExecutor(max_workers=10) as pool:
                sizes = list(pool.map(fetch, urls))  # about 0.4 s instead of 4 s

            chunks = [[str(i * j) for j in range(50_000)] for i in range(8)]
            with ProcessPoolExecutor(max_workers=4) as pool:
                futures = {pool.submit(hash_chunk, chunk): n for n, chunk in enumerate(chunks)}
                for future in as_completed(futures):
                    future.result()  # re-raises a worker’s exception here
        ~~~

        **Process pool costs:** arguments and results are pickled and copied between processes,
        so send file paths or chunk ids, not large objects. The «if __name__ == "__main__"» guard
        is required where processes start with spawn (macOS and Windows defaults). Always call
        «result()», or a worker’s exception disappears.

        > [!trap] Bound the concurrency
        > Fifty threads against an API that allows ten requests per second gets you throttled.
        > Size the pool from the downstream limit, not from your CPU count.

        ## Packaging pipeline code

        Copying helper files between DAG folders and notebooks is how five teams end up with
        five versions of one bug. Ship shared code as a package.

        - **pyproject.toml** declares the name, version, dependencies and build backend. It
          replaces «setup.py» for new projects.
        - Use a **src layout** («src/tripkit/»), so tests import the installed package, not the
          files next to them.
        - Build a **wheel** and publish it to a private index (Artifact Registry, CodeArtifact),
          with semantic versions.
        - **Lock** the exact dependency tree for applications and images («uv lock», pip-tools
          or Poetry). Keep library dependency ranges loose so they install next to other code.
        - Pin the Python version in the image, and run tests in CI on the version you deploy.

        > [!senior] The production answer
        > "Shared logic is a versioned package with tests and a changelog. Each job image pins
        > it with a lock file, so a fix is a version bump that teams adopt on purpose, and a bad
        > release rolls back by pinning the old version."
      `,
      checks: [
        {
          question:
            'A job parses 2,000 large JSON files with pure Python and is CPU-bound. What speeds it up on one machine?',
          options: [
            'A ThreadPoolExecutor with 32 threads',
            'A ProcessPoolExecutor, passing file paths to workers',
            'asyncio with aiofiles',
            'Increasing the GIL switch interval',
          ],
          answer: 1,
          why: 'CPU-bound pure Python needs separate processes, each with its own GIL. Passing paths keeps pickling cheap.',
        },
        {
          question: 'Why use a src layout for a shared pipeline package?',
          options: [
            'It makes the wheel smaller',
            'Tests import the installed package, so packaging mistakes show up in CI',
            'It is required by pip',
            'It removes the need for pyproject.toml',
          ],
          answer: 1,
          why: 'With a flat layout, tests can import local files that were never packaged, hiding a broken release.',
        },
      ],
    },
    {
      slug: 'api-ingestion',
      title: 'API ingestion: pagination, rate limits and retries',
      summary:
        'Pull data from a REST API without gaps, duplicates or bans: pick the pagination style, respect rate limits, retry safely and checkpoint progress.',
      minutes: 16,
      body: `
        Many sources are SaaS APIs: payments, CRM, ads, support tickets. An API extractor looks
        simple and fails in four ways: it misses pages, duplicates pages, gets rate limited, or
        restarts from zero after a crash.

        ## Pagination styles

        | Style | Request | Problem |
        |---|---|---|
        | **Offset / page number** | «?offset=1000&limit=100» | Inserts during the run shift pages, so rows are skipped or repeated; deep offsets get slow |
        | **Cursor (token)** | «?cursor=abc123» from the last response | Stable and fast; the cursor may expire, so finish or checkpoint quickly |
        | **Keyset** | «?created_after=2026-11-01T10:00:00Z&after_id=981» | Stable if the sort key is unique and immutable |
        | **Link header** | Follow the «next» URL in the response headers | Same as cursor; do not build URLs yourself |

        Prefer cursor or keyset pagination. If only offsets exist, page over a **fixed time window**
        that has stopped changing (for example, records updated before the run started) and
        deduplicate by id afterwards.

        ## Incremental pulls

        Ask only for what changed: «updated_since = last_watermark - overlap». The overlap (a few
        minutes) covers clock skew and late commits on the provider's side. Duplicates from the
        overlap are removed later by a «MERGE» on the record id and «updated_at».

        ## Rate limits

        - Read the limit from the docs and the headers, such as «X-RateLimit-Remaining» and
          «Retry-After».
        - On **429 Too Many Requests**, wait as long as «Retry-After» says.
        - Throttle on the client side with a **token bucket**, so parallel workers share one budget
          and never hit the limit in the first place.

        ## Retries

        - Retry **only** what can succeed later: timeouts, connection errors, 429 and 5xx. Never retry
          a 400 or 401 in a loop; fail and alert.
        - Use **exponential backoff with full jitter**, so 50 workers do not retry in the same second.
        - Always set a **timeout** on every call. A request without one can hang a job for hours.

        ~~~python
        import random
        import time
        from collections.abc import Iterator

        import requests

        RETRYABLE = {429, 500, 502, 503, 504}


        def get_json(session: requests.Session, url: str, params: dict, attempts: int = 6) -> dict:
            for attempt in range(attempts):
                try:
                    response = session.get(url, params=params, timeout=(5, 30))
                except (requests.ConnectionError, requests.Timeout):
                    response = None
                if response is not None and response.status_code not in RETRYABLE:
                    response.raise_for_status()  # 4xx other than 429: do not retry
                    return response.json()
                retry_after = response.headers.get("Retry-After", "") if response is not None else ""
                if retry_after.isdigit():
                    delay = float(retry_after)
                else:
                    delay = random.uniform(0, min(60.0, 2.0**attempt))  # full jitter
                time.sleep(delay)
            raise RuntimeError(f"giving up on {url} after {attempts} attempts")


        def pages(session: requests.Session, url: str, updated_since: str) -> Iterator[dict]:
            params: dict = {"updated_since": updated_since, "limit": 500}
            while True:
                page = get_json(session, url, params)
                yield page
                cursor = page.get("next_cursor")
                if not cursor:
                    return
                params = {"cursor": cursor, "limit": 500}
        ~~~

        ## Land raw, then checkpoint

        1. Write each page **as received** (JSON lines) to the landing zone, named by run id and
           page number, with request metadata: URL, parameters, time and status.
        2. After a page is safely written, save the cursor in a small state store. A crash resumes
           from the last saved cursor, not from zero.
        3. Parse and type the data in a later step. A schema change then breaks parsing, not
           extraction, and the raw pages can be re-parsed.

        ## Scale out carefully

        Split the work by a key the API filters on (date windows, accounts, regions) and run
        workers in parallel, all drawing from one shared rate budget. Backfills use the same code
        with an old start date and a lower priority budget.

        > [!trap] Retrying a POST
        > Some APIs need a POST to start an export or a search. Retrying it can create two exports
        > or two charges. Send an **idempotency key** if the API supports one, or check for the
        > existing job first.

        > [!senior] Name the failure modes
        > "Cursor pagination, an updated_since window with five minutes of overlap, MERGE by id, a
        > token bucket at 80 percent of the limit, retries with jitter on 429 and 5xx only, raw pages
        > landed before the cursor is saved." Each phrase answers a follow-up before it is asked.
      `,
      checks: [
        {
          question: 'Why is offset pagination risky on a table that changes during the pull?',
          options: [
            'Offsets are slower to type',
            'Inserts or deletes shift rows between pages, so some rows are skipped or repeated',
            'APIs never support offsets',
            'Offsets need authentication',
          ],
          answer: 1,
          why: 'Page boundaries are positions, not keys. Cursor or keyset pagination anchors each page on a stable key.',
        },
        {
          question: 'Which response should NOT be retried automatically?',
          options: [
            '429 Too Many Requests',
            '503 Service Unavailable',
            '401 Unauthorized',
            'A read timeout',
          ],
          answer: 2,
          why: 'A 401 will not succeed on retry. Refresh the credentials or fail and alert. The others are often transient.',
        },
      ],
    },
  ],
};

export const problems: Problem[] = [
  {
    slug: 'parse-logs-error-rate',
    title: 'Error rate per endpoint from logs',
    track: 'python',
    kind: 'coding',
    difficulty: 'easy',
    companies: ['uber', 'google'],
    prompt: `
      Each line of a large log file looks like:

      ~~~text
      2026-10-31T10:00:01Z GET /v1/trips 200 35ms
      ~~~

      Write a function that returns, per endpoint, the request count and the share of responses
      with status 500 or above. Skip malformed lines and report how many you skipped.
    `,
    hints: [
      'Read line by line; do not load the file.',
      'Split on whitespace and validate the parts.',
      'Two counters per endpoint are enough.',
    ],
    answer: `
      ~~~python
      from collections import defaultdict

      def error_rates(lines):
          total = defaultdict(int)
          errors = defaultdict(int)
          skipped = 0
          for line in lines:
              parts = line.split()
              if len(parts) != 5 or not parts[3].isdigit():
                  skipped += 1
                  continue
              _, _, endpoint, status, _ = parts
              total[endpoint] += 1
              if int(status) >= 500:
                  errors[endpoint] += 1
          rates = {ep: (total[ep], errors[ep] / total[ep]) for ep in total}
          return rates, skipped

      with open("access.log", encoding="utf-8") as handle:
          rates, skipped = error_rates(handle)
      ~~~

      O(n) time, memory proportional to the number of endpoints. Mention that paths with ids
      («/v1/trips/123») should be normalised to a route template first, or the dictionary grows
      with every trip id.
    `,
    signals: [
      'Streams the file instead of reading it whole',
      'Handles malformed lines and counts them',
      'Normalises high-cardinality paths',
    ],
    followUps: ['The file is 2 TB across 1,000 files. How do you parallelise this?'],
  },
  {
    slug: 'merge-rider-sessions',
    title: 'Merge overlapping app sessions',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      Given a list of «(user_id, start_ts, end_ts)» tuples, unsorted, return per user the merged
      sessions: sessions that overlap or are less than 5 minutes (300 s) apart become one.
    `,
    hints: [
      'Group by user first.',
      'Sort each user’s sessions by start.',
      'Merge when start <= current_end + 300.',
    ],
    answer: `
      ~~~python
      from collections import defaultdict

      def merge_sessions(rows, gap_s=300):
          by_user = defaultdict(list)
          for user, start, end in rows:
              by_user[user].append((start, end))

          result = {}
          for user, sessions in by_user.items():
              merged = []
              for start, end in sorted(sessions):
                  if merged and start <= merged[-1][1] + gap_s:
                      merged[-1][1] = max(merged[-1][1], end)
                  else:
                      merged.append([start, end])
              result[user] = [tuple(s) for s in merged]
          return result

      assert merge_sessions([("a", 0, 10), ("a", 200, 400), ("a", 1000, 1100), ("b", 5, 6)]) == {
          "a": [(0, 400), (1000, 1100)],
          "b": [(5, 6)],
      }
      ~~~

      O(n log n) for the sorts. Note «max» for nested sessions, and say that at scale this is a
      group-by user and sort within the group, which maps directly onto Spark or SQL.
    `,
    signals: [
      'Groups before sorting, and sorts within groups',
      'Uses max for the end so nested sessions work',
      'Writes a test with a gap, an overlap and a second user',
      'Maps the solution onto a distributed group-by',
    ],
    followUps: [
      'Sessions arrive as a stream, roughly in order. How do you emit merged sessions incrementally?',
    ],
  },
  {
    slug: 'rolling-rate-limiter',
    title: 'Requests in the last 60 seconds',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      Implement «allow(user_id, ts) -> bool» that permits at most 100 requests per user in any
      rolling 60-second window. Timestamps arrive in non-decreasing order.

      Then discuss what changes at 1 million users.
    `,
    hints: [
      'A deque per user of accepted timestamps.',
      'Evict timestamps older than ts - 60 before deciding.',
      'Only append when you allow the request.',
    ],
    answer: `
      ~~~python
      from collections import defaultdict, deque

      class Limiter:
          def __init__(self, limit=100, window_s=60):
              self.limit = limit
              self.window_s = window_s
              self.accepted = defaultdict(deque)

          def allow(self, user, ts):
              q = self.accepted[user]
              while q and q[0] <= ts - self.window_s:
                  q.popleft()
              if len(q) < self.limit:
                  q.append(ts)
                  return True
              return False
      ~~~

      O(1) amortised per call, O(limit) memory per active user. At a million users: evict idle
      users (or store state in Redis with a TTL), or use a sliding-window counter with two fixed
      buckets to cut memory to two integers per user, accepting a small approximation.
    `,
    signals: [
      'Evicts before deciding and appends only accepted requests',
      'Gives amortised complexity and memory per user',
      'Discusses idle-user eviction and approximate counters',
      'Mentions distributed state when there are many servers',
    ],
    followUps: ['Timestamps can now arrive up to 2 seconds out of order. What breaks?'],
  },
  {
    slug: 'top-k-trending-hashtags',
    title: 'Top k trending terms in a stream',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['google'],
    prompt: `
      You receive a stream of search terms. At any time, «top(k)» must return the k most frequent
      terms seen so far. Implement «add(term)» and «top(k)». Discuss complexity, and what you
      would do if distinct terms do not fit in memory.
    `,
    hints: [
      'A Counter makes add O(1).',
      'heapq.nlargest over the counter items gives top k.',
      'For huge cardinality, think sketches.',
    ],
    answer: `
      ~~~python
      from collections import Counter
      import heapq

      class Trending:
          def __init__(self):
              self.counts = Counter()

          def add(self, term):
              self.counts[term] += 1

          def top(self, k):
              return heapq.nlargest(k, self.counts.items(), key=lambda kv: (kv[1], kv[0]))
      ~~~

      «add» is O(1); «top» is O(d log k) for d distinct terms. If «top» is called far more often
      than «add», maintain a sorted structure instead.

      When distinct terms do not fit: a **Count-Min Sketch** estimates counts in fixed memory,
      paired with a size-k heap of candidates (the "heavy hitters" pattern). In production,
      "trending" also needs a time window and decay, for example counts per 5-minute bucket, so
      old spikes fade.
    `,
    signals: [
      'Separates the cost of add from the cost of top',
      'Uses a heap for top k rather than sorting everything',
      'Knows Count-Min Sketch or space-saving for heavy hitters',
      'Notes that trending needs windows or decay',
    ],
    followUps: ['How do you make this distributed across 100 servers?'],
  },
  {
    slug: 'max-concurrent-trips',
    title: 'Peak concurrent trips per city',
    track: 'python',
    kind: 'coding',
    difficulty: 'hard',
    companies: ['uber'],
    prompt: `
      Given trips «(city, start_ts, end_ts)», return for each city the maximum number of trips in
      progress at the same time and the earliest time that peak was reached. A trip ending at t
      does not overlap a trip starting at t.
    `,
    hints: [
      'Sweep line per city: +1 at start, -1 at end.',
      'Sort so that ends come before starts at equal times.',
      'Record the time when the running count first reaches a new maximum.',
    ],
    answer: `
      ~~~python
      from collections import defaultdict

      def peak_concurrency(trips):
          points = defaultdict(list)
          for city, start, end in trips:
              points[city].append((start, 1))
              points[city].append((end, -1))

          result = {}
          for city, events in points.items():
              events.sort(key=lambda p: (p[0], p[1]))
              current = best = 0
              best_at = None
              for ts, delta in events:
                  current += delta
                  if current > best:
                      best, best_at = current, ts
              result[city] = (best, best_at)
          return result

      assert peak_concurrency([("sf", 0, 10), ("sf", 5, 15), ("sf", 10, 20)]) == {"sf": (2, 5)}
      ~~~

      O(n log n). The test covers the touching case: the trip ending at 10 and the one starting at
      10 do not overlap, so the peak stays 2. Mention that the same idea in SQL is a running
      «SUM(delta) OVER (PARTITION BY city ORDER BY ts, delta)».
    `,
    signals: [
      'Uses a sweep line rather than comparing all pairs',
      'Handles the touching boundary with the sort order',
      'Tests the boundary explicitly',
      'Translates the idea into SQL or Spark',
    ],
    followUps: ['Trips that are still in progress have no end time. How do you include them?'],
  },
  {
    slug: 'k-way-merge-sorted-files',
    title: 'Merge k sorted files',
    track: 'python',
    kind: 'coding',
    difficulty: 'hard',
    companies: ['google'],
    prompt: `
      You have k files, each sorted by timestamp, each too large for memory together. Produce one
      output stream sorted by timestamp. Each line starts with an ISO timestamp.
    `,
    hints: [
      'Hold one line per file at a time.',
      'A heap keyed by timestamp gives the next smallest line.',
      'After you emit a line, read the next one from the same file.',
    ],
    answer: `
      ~~~python
      import heapq

      def merge_sorted(paths, out):
          handles = [open(p, encoding="utf-8") for p in paths]
          try:
              heap = []
              for index, handle in enumerate(handles):
                  line = handle.readline()
                  if line:
                      heap.append((line[:20], index, line))
              heapq.heapify(heap)
              while heap:
                  _, index, line = heapq.heappop(heap)
                  out.write(line)
                  nxt = handles[index].readline()
                  if nxt:
                      heapq.heappush(heap, (nxt[:20], index, nxt))
          finally:
              for handle in handles:
                  handle.close()
      ~~~

      O(N log k) time and O(k) memory. The file index in the tuple breaks timestamp ties so
      Python never compares lines from different files unpredictably. «heapq.merge» does the same
      thing in one call. This is the merge step of an external sort.
    `,
    signals: [
      'Uses a heap of size k, not a full load',
      'Breaks ties so comparison is well defined',
      'Closes files in a finally block',
      'Names external sort and heapq.merge',
    ],
    followUps: ['k is 10,000 and you can open only 1,000 files. What now?'],
  },
  {
    slug: 'flatten-nested-events',
    title: 'Flatten nested JSON events',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      Write «flatten(event)» that turns nested dictionaries into a single level with dotted keys.
      Lists of scalars stay lists; lists of dictionaries become «key.0.field», «key.1.field».

      «{"trip": {"id": 7, "stops": [{"lat": 1}, {"lat": 2}]}}» becomes
      «{"trip.id": 7, "trip.stops.0.lat": 1, "trip.stops.1.lat": 2}».
    `,
    hints: ['Recursion with a prefix.', 'Check the type of each value.'],
    answer: `
      ~~~python
      def flatten(value, prefix=""):
          flat = {}
          if isinstance(value, dict):
              for key, child in value.items():
                  flat.update(flatten(child, f"{prefix}{key}."))
          elif isinstance(value, list) and any(isinstance(item, dict) for item in value):
              for index, child in enumerate(value):
                  flat.update(flatten(child, f"{prefix}{index}."))
          else:
              flat[prefix[:-1]] = value
          return flat

      assert flatten({"trip": {"id": 7, "stops": [{"lat": 1}, {"lat": 2}]}}) == {
          "trip.id": 7, "trip.stops.0.lat": 1, "trip.stops.1.lat": 2,
      }
      ~~~

      Raise the design question: flattening arrays into indexed columns explodes the schema. In a
      warehouse, prefer nested types (BigQuery «STRUCT» and «ARRAY») or a child table, and flatten
      only for tools that need it. Also mention recursion depth for hostile input.
    `,
    signals: [
      'Handles dicts, lists of dicts and scalars',
      'Tests the example',
      'Questions whether flattening is the right storage choice',
    ],
    followUps: ['A key itself contains a dot. How do you keep the output reversible?'],
  },
  {
    slug: 'idempotent-retry-writer',
    title: 'Retry a write without duplicates',
    track: 'python',
    kind: 'coding',
    difficulty: 'easy',
    companies: ['uber'],
    prompt: `
      A function «send(payment)» posts to a payments API and sometimes times out, even though the
      payment may have gone through. Write a wrapper that retries safely, and explain what the API
      must support for this to be correct.
    `,
    hints: [
      'Timeouts do not mean failure.',
      'What if each request carried a key the server remembers?',
    ],
    answer: `
      The API must accept an **idempotency key**: the server stores the result for that key and
      returns the stored result if it sees the key again, instead of charging twice.

      ~~~python
      import random, time, uuid

      def pay_with_retries(send, payment, attempts=5):
          key = payment.get("idempotency_key") or str(uuid.uuid4())
          payment = {**payment, "idempotency_key": key}
          for attempt in range(attempts):
              try:
                  return send(payment)
              except TimeoutError:
                  if attempt == attempts - 1:
                      raise
                  time.sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
      ~~~

      The key is generated once, before the first attempt, and reused for every retry. Store it
      with the payment record so a crash and restart reuses it too.
    `,
    signals: [
      'Explains that a timeout is an unknown outcome, not a failure',
      'Uses one idempotency key across all retries',
      'Persists the key so restarts are safe',
      'Uses backoff with jitter',
    ],
    followUps: ['The payments API has no idempotency key. What can you do instead?'],
  },
  {
    slug: 'retry-decorator-with-budget',
    title: 'A retry decorator with a time budget',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber', 'google'],
    prompt: `
      Write a decorator «retry» for calls to a flaky service. It retries only the exception types
      it is given, uses exponential backoff with jitter capped at a maximum delay, and never spends
      more than a total time budget. When the budget runs out it raises a clear error that keeps
      the original cause. Then show how you would test it without sleeping.
    `,
    hints: [
      'A decorator with arguments has three nested functions.',
      'Check the budget before you sleep, not after.',
      'Inject the clock and the sleep function so tests control time.',
    ],
    answer: `
      ~~~python
      import functools
      import random
      import time


      class RetryBudgetExceeded(Exception):
          pass


      def retry(*, retry_on: tuple, attempts: int = 5, base_s: float = 0.2, cap_s: float = 10.0,
                budget_s: float = 60.0, sleep=time.sleep, clock=time.monotonic):
          def decorator(func):
              @functools.wraps(func)
              def wrapper(*args, **kwargs):
                  deadline = clock() + budget_s
                  for attempt in range(1, attempts + 1):
                      try:
                          return func(*args, **kwargs)
                      except retry_on as error:
                          if attempt == attempts:
                              raise
                          delay = random.uniform(0, min(cap_s, base_s * 2 ** (attempt - 1)))
                          if clock() + delay > deadline:
                              raise RetryBudgetExceeded(f"{func.__name__}: budget of {budget_s}s spent") from error
                          sleep(delay)
              return wrapper
          return decorator
      ~~~

      - «time.monotonic», not «time.time»: a wall clock can jump when NTP corrects it.
      - "Full jitter" (a random delay between zero and the backoff) spreads retries from many
        workers best.
      - «raise ... from error» keeps the last real failure in the traceback.
      - Errors outside «retry_on» propagate on the first try.

      **Tests without sleeping:** pass a fake clock whose «sleep» advances its own time.

      ~~~python
      import pytest


      class FakeClock:
          def __init__(self):
              self.now = 0.0

          def __call__(self):
              return self.now

          def sleep(self, seconds):
              self.now += seconds


      def test_stops_when_budget_is_spent(monkeypatch):
          clock = FakeClock()
          monkeypatch.setattr("random.uniform", lambda low, high: high)
          calls = {"n": 0}

          def always_fails():
              calls["n"] += 1
              raise ConnectionError("reset")

          wrapped = retry(retry_on=(ConnectionError,), attempts=10, base_s=1, budget_s=5,
                          sleep=clock.sleep, clock=clock)(always_fails)
          with pytest.raises(RetryBudgetExceeded):
              wrapped()
          assert clock.now <= 5
      ~~~

      Add tests for: success after two failures, no retry on «ValueError», and re-raise of the
      original error after the last attempt.
    `,
    signals: [
      'Writes the three-layer decorator with functools.wraps',
      'Retries only listed transient errors',
      'Uses capped exponential backoff with jitter and a monotonic clock',
      'Checks the budget before sleeping and chains the original error',
      'Makes time injectable so tests run instantly',
    ],
    followUps: [
      'Every worker in a fleet of 500 uses this against one API during an outage. What else do you need?',
    ],
  },
  {
    slug: 'test-latest-per-trip',
    title: 'Write the tests for a dedup function',
    track: 'python',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['google'],
    prompt: `
      This function keeps the latest event per trip. Events can arrive out of order, can share a
      timestamp, and can be delivered twice. Write the pytest tests you would ship with it.

      ~~~python
      def latest_per_trip(events: list[dict]) -> dict[str, dict]:
          latest: dict[str, dict] = {}
          for event in events:
              key = event["trip_id"]
              rank = (event["event_ts"], event["seq"])
              current = latest.get(key)
              if current is None or rank > (current["event_ts"], current["seq"]):
                  latest[key] = event
          return latest
      ~~~
    `,
    hints: [
      'List the ways real event data misbehaves.',
      'Which property should hold for any input order?',
      'What happens if the job runs twice?',
    ],
    answer: `
      Test the behaviours the data forces on you, plus two properties.

      ~~~python
      import random

      import pytest

      from dedup import latest_per_trip


      def ev(trip, ts, seq, status):
          return {"trip_id": trip, "event_ts": ts, "seq": seq, "status": status}


      def test_empty_input():
          assert latest_per_trip([]) == {}


      def test_keeps_latest_by_event_time_not_arrival_order():
          events = [ev("t1", 20, 1, "completed"), ev("t1", 10, 2, "accepted")]
          assert latest_per_trip(events)["t1"]["status"] == "completed"


      def test_breaks_timestamp_ties_with_sequence():
          events = [ev("t1", 10, 2, "completed"), ev("t1", 10, 1, "accepted")]
          assert latest_per_trip(events)["t1"]["status"] == "completed"


      def test_exact_duplicates_are_harmless():
          event = ev("t1", 10, 1, "accepted")
          assert latest_per_trip([event, dict(event)]) == {"t1": event}


      @pytest.mark.parametrize("seed", range(20))
      def test_result_does_not_depend_on_order(seed):
          events = [ev(f"t{i % 3}", i % 5, i, f"s{i}") for i in range(30)]
          shuffled = events[:]
          random.Random(seed).shuffle(shuffled)
          assert latest_per_trip(shuffled) == latest_per_trip(events)


      def test_rerun_on_own_output_is_stable():
          events = [ev("t1", 10, 1, "a"), ev("t2", 5, 1, "b"), ev("t1", 12, 3, "c")]
          once = latest_per_trip(events)
          assert latest_per_trip(list(once.values())) == once
      ~~~

      - **Order independence** is the property that matters for a stream: the same events in any
        order give the same answer. A seeded shuffle keeps failures reproducible; Hypothesis
        would generate the inputs for you.
      - **Idempotency:** running on its own output changes nothing, so a rerun is safe.
      - Then name what is not tested and should be decided: a missing «seq» raises «KeyError»,
        and two events with equal «event_ts» and «seq» but different content keep the first one
        seen, which is order-dependent. Ask whether that can happen upstream.
    `,
    signals: [
      'Covers out-of-order, ties and duplicate delivery explicitly',
      'Tests order independence as a property, with reproducible randomness',
      'Tests idempotency of a rerun',
      'Finds the remaining ambiguity (full ties) instead of only confirming the happy path',
    ],
    followUps: ['How would this test change when the function becomes a Spark job?'],
  },
  {
    slug: 'parallel-file-parsing',
    title: 'Parse 50,000 files faster on one machine',
    track: 'python',
    kind: 'concept',
    difficulty: 'medium',
    companies: ['uber'],
    prompt: `
      A daily job downloads 50,000 gzipped JSON files (about 4 MB each) from object storage,
      parses and validates every record in pure Python, and writes Parquet. It runs in one
      process and takes six hours on a 16-core machine. Make it faster without moving to Spark,
      and say what limits you hit.
    `,
    hints: [
      'Which part waits and which part computes?',
      'The GIL treats those two parts differently.',
      'What do you send between processes?',
    ],
    answer: `
      Profile first: time the download, the decompress and parse, and the write. Usually the
      download is I/O-bound and the parse is CPU-bound, so they need different tools.

      1. **Downloads:** a thread pool of about 32 to 64, bounded by the storage client’s
         connection limit and throttling. Threads wait on the network with the GIL released.
      2. **Parsing:** a process pool with about one worker per core (15 here). Send each worker
         a **file path**, not file contents, so nothing large is pickled. Each worker downloads,
         parses and writes its own Parquet part file, which also removes a single-writer
         bottleneck.
      3. **Faster parsing:** «orjson» or «msgspec» parse several times faster than the standard
         library; PyArrow’s JSON reader or Polars can read newline-delimited JSON in C and skip
         Python objects entirely.
      4. **Memory:** stream each file with «gzip.open» and process in batches of records,
         instead of loading 50,000 files of results into one list.
      5. **Correctness:** call «result()» on every future so failures surface; write part files
         to a temporary prefix and publish the batch only when every file succeeded; record
         which files failed so a rerun handles only those.

      Expected outcome: close to linear in cores for the parse stage, so six hours becomes
      well under one. If the job still grows, the next step is a distributed engine, because
      one machine’s cores and network are now the limit.
    `,
    signals: [
      'Profiles and separates I/O-bound from CPU-bound stages',
      'Uses threads for downloads and processes for parsing, with reasons tied to the GIL',
      'Sends paths, not data, to worker processes',
      'Mentions faster parsers or a columnar reader',
      'Keeps output atomic and failures visible',
    ],
    followUps: ['The free-threaded Python build is available. Would you switch this job to it?'],
  },
  {
    slug: 'python-paginated-api-extractor',
    title: 'Write a resumable extractor for a rate-limited API',
    track: 'python',
    kind: 'coding',
    difficulty: 'hard',
    companies: ['uber', 'google'],
    prompt: `
      A payments API returns «{"data": [...], "next_cursor": "..." | null}» for
      «GET /v1/charges?updated_since=...&cursor=...». It allows 100 requests a minute and answers
      429 with a «Retry-After» header when you go over. Write a function that pulls every charge
      updated since the last run, survives a crash in the middle, and never loads a charge twice
      into the final table. You may assume helpers «write_page(run_id, n, records)»,
      «load_state()» and «save_state(dict)».
    `,
    hints: [
      'What do you save, and when?',
      'Where do duplicates get removed?',
      'How do you stay under 100 a minute without waiting for 429s?',
    ],
    answer: `
      ~~~python
      import random
      import time
      from datetime import datetime, timedelta, timezone

      import requests

      URL = "https://api.example.com/v1/charges"
      MIN_INTERVAL = 60 / 90  # stay at 90 requests a minute, under the limit of 100
      OVERLAP = timedelta(minutes=5)


      def fetch(session: requests.Session, params: dict) -> dict:
          for attempt in range(8):
              try:
                  response = session.get(URL, params=params, timeout=(5, 30))
              except (requests.ConnectionError, requests.Timeout):
                  time.sleep(random.uniform(0, 2**attempt))
                  continue
              if response.status_code == 429:
                  time.sleep(float(response.headers.get("Retry-After", "60")))
                  continue
              if response.status_code >= 500:
                  time.sleep(random.uniform(0, 2**attempt))
                  continue
              response.raise_for_status()
              return response.json()
          raise RuntimeError("API still failing after 8 attempts")


      def extract(session: requests.Session, run_id: str) -> None:
          state = load_state()
          if state.get("cursor"):  # resume an interrupted run
              params = {"cursor": state["cursor"]}
              page_no = state["page_no"]
              started = state["started"]
          else:
              since = datetime.fromisoformat(state["watermark"]) - OVERLAP
              started = datetime.now(timezone.utc).isoformat()
              params = {"updated_since": since.isoformat()}
              page_no = 0
          while True:
              began = time.monotonic()
              body = fetch(session, params)
              write_page(run_id, page_no, body["data"])  # land raw first
              page_no += 1
              cursor = body.get("next_cursor")
              if not cursor:
                  save_state({"watermark": started, "cursor": None, "page_no": 0, "started": None})
                  return
              save_state({"watermark": state.get("watermark"), "cursor": cursor,
                          "page_no": page_no, "started": started})
              params = {"cursor": cursor}
              time.sleep(max(0.0, MIN_INTERVAL - (time.monotonic() - began)))
      ~~~

      How it meets each requirement:

      - **Crash safety:** a page is written before its cursor is saved. A crash repeats at most one
        page. The new watermark is the run's **start time**, saved only when the last page is done.
      - **No double loads:** the overlap and any repeated page create duplicates in landing on
        purpose. The load step runs «MERGE INTO charges USING staged ON id» and keeps the row with
        the latest «updated_at», so duplicates never reach the final table.
      - **Rate limit:** client-side pacing at 90 a minute, plus honouring «Retry-After» on 429.
      - **Retries:** only on network errors, 429 and 5xx, with jittered backoff; a 4xx fails fast.
    `,
    signals: [
      'Lands the page before saving the cursor',
      'Sets the next watermark to the run start, with an overlap',
      'Deduplicates with a MERGE by id and updated_at',
      'Paces requests on the client and honours Retry-After',
      'Retries only transient errors, with jitter and timeouts',
    ],
    followUps: [
      'The cursor expires after 10 minutes and a crash lasted an hour. What happens, and how do you recover?',
    ],
  },
];
