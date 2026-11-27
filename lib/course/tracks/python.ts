import { pandasLessons, pandasProblems } from '@/lib/course/tracks/python-pandas';
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
      minutes: 14,
      body: `
        ## Start with the problem

        You have 10 million events and you want the count per user. The first idea: keep a list of
        (user, count) pairs, and for each event, walk the list to find the user. With 1 million users,
        each event walks up to 1 million entries. That is 10 million times 1 million steps. The job
        never finishes.

        Swap the list for a dictionary, and each lookup takes one step. Same logic, a million times
        faster. Most data coding problems are solved like this: **pick the structure whose fast
        operation matches the question.** Say the cost as you choose. It is the cheapest senior signal
        there is.

        ## Idea 1: one structure per question

        The "O(...)" notation says how the work grows with the data. O(1) means "the same, no matter
        how big". O(n) means "grows with the size". O(log n) means "grows very slowly": a million items
        needs about 20 steps.

        - **Look up or count by key:** «dict» or «collections.Counter». O(1) on average. Like a
          dictionary: jump straight to the word.
        - **"Have I seen this?" and dedupe:** «set». O(1) on average.
        - **Group values by key:** «collections.defaultdict(list)». O(1) per append, and no "if key
          not in dict" check.
        - **Add or remove at both ends:** «collections.deque». O(1). A queue at a counter.
        - **Always get the smallest:** «heapq» on a list. O(log n) push and pop.
        - **Keep items in order, and search:** a sorted list with «bisect». O(log n) search, but
          O(n) insert.

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
        > Removing from the front of a list shifts every other element one place. In a sliding window
        > or a BFS, use «deque.popleft()», which is O(1). Interviewers notice.

        ## Idea 2: heaps for "top k" and "next smallest"

        You want the 10 biggest values from a stream of a billion. Sorting the billion is slow, and
        they may not fit in memory.

        The trick: keep only 10 at a time, and always know which of the 10 is the smallest, because
        that is the one to throw out. A **min-heap** does exactly that: its smallest item is always on
        top. Python's «heapq» is a min-heap.

        For each new value: if the heap has fewer than k items, push it. Otherwise, if the value is
        bigger than the smallest on top, replace the top.

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

        ## Now say it like a senior engineer

        > [!senior] Say the memory too
        > "O(n log k) time and O(k) memory, so it works on a stream that does not fit in RAM" is the
        > sentence that turns a correct answer into a data engineering answer.

        ## In one breath

        Choose the structure by the operation you need to be fast: dict and set for lookups, deque for
        both ends, a heap for "smallest next". For top k, keep a small min-heap of size k and say both
        the time and the memory.
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
      minutes: 13,
      body: `
        ## Start with the problem

        You must process a 50 GB file of events. The first idea: «data = open(path).readlines()»,
        then loop. Your laptop has 16 GB of memory. The program fills it, the machine starts swapping,
        and the job dies.

        But look at what you actually need: one line at a time. You never need all 50 GB at once. A
        data engineer's Python must work on inputs larger than memory, and **generators** are the tool.

        ## Idea 1: a generator hands you one item at a time

        Think of a tap versus a bucket. A list is a bucket: all the water, filled up front, held in
        memory. A **generator** is a tap: water comes out only when you ask, one glass at a time.

        A function that uses «yield» instead of «return» is a generator. Each «yield» hands out one
        item, pauses, and resumes when the next item is asked for. So memory holds only the item being
        worked on.

        ## Idea 2: chain taps into a pipeline

        Each step below takes a generator and returns a generator. Nothing runs until the final «for»
        loop asks for a batch. Then each line flows through all the steps, one at a time.

        1. «read_events» reads one line, parses it, and yields one event.
        2. «only» passes through only the events with one name.
        3. «batched» collects events into lists of 5,000, so the warehouse gets fewer, bigger writes.

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
        > After you iterate it, it is empty, like a tap you already drained into glasses. Calling
        > «len()» on it fails, and looping twice gives nothing the second time. Materialise with
        > «list()» only when you know it fits.

        ## Idea 3: bad rows are data too

        A 50 GB file will have broken lines. Production readers do not crash on one malformed line.
        They count it, route it to a dead-letter location with the reason, and alert if the bad-row
        rate passes a threshold. Mentioning that in a coding round is a strong operational signal.

        ## Now say it like a senior engineer

        > [!senior] Know when Python is the wrong tool
        > For hundreds of gigabytes, a generator is still single-threaded. Say when you would move the
        > job to Spark, Beam or a warehouse «COPY», and why.

        ## In one breath

        A generator is a tap, not a bucket: it hands out one item at a time, so a chain of generators
        processes any file size in constant memory. Count bad rows instead of crashing, and know when
        the job has outgrown one Python process.
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
      minutes: 16,
      body: `
        ## Start with the problem

        Trips have a start and an end. So do sessions, shifts and ad campaigns. These are
        **intervals**. And questions like "how many requests in the last minute?" are **windows**.
        Together they cover a large share of practical coding questions: "merge these bookings", "how
        many drivers were busy at the peak?", "has this user hit the rate limit?".

        The slow way compares every interval with every other: O(n²). Each idea below replaces that
        with one sort and one pass.

        ## Idea 1: merge overlapping intervals

        Picture meetings on a calendar. Sort them by start time. Now walk through them. If the next
        meeting starts before the current one ends, they overlap, so stretch the current one. If not,
        start a new block.

        Worked example: (1,3), (2,6), (8,10). Sorted already. (2,6) starts at 2, before 3, so merge
        into (1,6). (8,10) starts after 6, so it is a new block. Result: (1,6), (8,10).

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

        ## Idea 2: sweep line, for "how many at the same time?"

        Picture a turnstile counter. Each person entering adds 1, each person leaving takes away 1.
        The highest number the counter ever shows is the peak crowd.

        So turn each trip into two events: +1 at its start, -1 at its end. Sort all the events by
        time, and keep a running total. The largest total is the maximum concurrency.

        One decision matters: does a trip ending at time t overlap a trip starting at t? If not, sort
        the ends (-1) before the starts (+1) at the same time.

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

        ## Idea 3: a sliding window with a deque

        "How many requests did this user make in the last 60 seconds?" Picture a queue at a counter.
        New requests join at the back. Anyone who has waited more than 60 seconds leaves from the
        front. The length of the queue is the answer.

        A «deque» is that queue: O(1) to add at the back and to remove from the front.

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

        ## Now say it like a senior engineer

        > [!senior] Memory and out-of-order input
        > The deque grows with the request rate. At very high rates, switch to fixed buckets (one
        > counter per second, sixty buckets) for O(1) memory per user. Also ask whether timestamps can
        > arrive out of order, because the deque version assumes they do not.

        ## In one breath

        Sort once, then walk once: merge intervals by stretching the current block, count concurrency
        with +1 and -1 events, and keep a sliding window as a queue that drops old items from the front.
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
      minutes: 13,
      body: `
        ## Start with the problem

        Your solution passes the example. The interviewer asks: "Would you ship this?" Then: "What
        happens when the API times out? When the job runs twice? When the input is empty?" Silence.

        At senior level, "it works on the example" is the floor. Interviewers look for code they would
        approve in review: clear names, types, error handling and a test. This lesson is the short list
        of habits that make code shippable.

        ## Idea 1: try again, politely (retries with backoff and jitter)

        A call to another service fails because that service is briefly overloaded. Retrying at once
        makes it worse. And if 1,000 workers all retry at the same moment, they knock it over again:
        a **thundering herd**.

        So retry like a polite person knocking on a door. Wait a bit, then knock. If no answer, wait
        twice as long (**exponential backoff**). And add a random part to each wait (**jitter**), so
        the 1,000 workers spread out instead of knocking together.

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

        Retry only errors that can succeed later: timeouts, 429, 503. Never retry a validation error;
        it will fail the same way forever.

        ## Idea 2: make "twice" the same as "once" (idempotent writes)

        Retries have a side effect. The first attempt may have worked, and only the reply got lost. So
        a retried write runs twice. If the write is "insert a row", you now have a duplicate.

        A write is **idempotent** when doing it twice has the same effect as doing it once. Give every
        write a deterministic key:

        - Upsert by a natural or event id, instead of blind inserts.
        - Overwrite a whole partition («date=2026-10-31») instead of appending to it.
        - Record processed offsets or file names in the same transaction as the output.

        ## Idea 3: a test, even a tiny one

        One short test shows you think about correctness, not only about the happy path.

        ~~~python
        def test_merge_handles_touching_and_nested():
            assert merge([(1, 3), (2, 6), (8, 10), (9, 9)]) == [(1, 6), (8, 10)]
            assert merge([]) == []
        ~~~

        ## Now say it like a senior engineer

        > [!senior] Name the edge cases before you code
        > Empty input, one element, duplicates, unsorted input, very large values and time zones.
        > Listing them first, then testing two of them, shows how you work in real life.

        ## In one breath

        Retry only errors that can succeed later, with growing, randomised waits; make every write
        idempotent so a retry cannot duplicate; and prove it with a small test that covers an edge case.
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
      minutes: 16,
      body: `
        ## Start with the problem

        Your pipeline calls an API in twelve places. Each call can fail now and then, so each one needs
        the same retry loop: try, catch, wait, try again. You copy the loop twelve times. Next month you
        fix a bug in it, and you fix eleven copies.

        The pipeline also writes files. If it crashes halfway through a write, the next job reads half
        a file. So every write needs the same "clean up if something goes wrong" code, copied again.

        Python has two features made for exactly these two problems, and interviewers ask you to write
        both from memory: a **decorator** adds behaviour around a function, and a **context manager**
        guarantees cleanup.

        ## Idea 1: a decorator wraps a function, like gift wrap

        A **decorator** is a function that takes a function and returns a new one: the original,
        wrapped in extra behaviour. Write the retry loop once, and wrap any function in it.

        «@retry(...)» above a definition is shorthand for «fetch_page = retry(...)(fetch_page)». So a
        decorator with arguments has three layers, from outside in:

        1. The **arguments** (how many times to retry).
        2. The **function** being wrapped.
        3. The **call** that runs each time someone calls the function.

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

        - «functools.wraps» copies the name, docstring and signature. Logs, stack traces and tools
          still see «fetch_page», not «wrapper».
        - Retry **only** errors that can succeed on a second try. Retrying a «ValueError» from bad
          data wastes time and hides the bug.
        - **Exponential backoff with jitter** stops a thousand workers from retrying in step and
          knocking the service over again.
        - The last attempt re-raises the original error with its traceback («raise» on its own).
        - Retrying is only safe if the call is idempotent. Say so.

        Other decorators you will write or meet: timing and metrics, caching («functools.lru_cache»,
        for pure functions only), registering functions in a dictionary (how «@task» and
        «@app.route» work), and input validation.

        ## Idea 2: a context manager always cleans up, like a self-closing door

        A **context manager** runs setup when a «with» block starts, and cleanup when it ends, even
        if the block raises an error. «__exit__» receives the exception, if any, and returns «True»
        only to swallow it, which you almost never want.

        The classic data engineering use: an **atomic write**. Write to a temporary file. Only when the
        write finishes, rename it over the real file in one step. If anything fails, delete the
        temporary file.

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

        A reader sees either the old file or the complete new one, never half a file. The same idea,
        write somewhere private and then publish in one step, is how idempotent tasks write to object
        storage and tables.

        Use a context manager for:

        - **Resources that must be released:** files, database connections, locks.
        - **A unit of work that commits or rolls back:** a transaction.
        - **Temporary state:** a temporary directory, a changed working directory, an env var in a test.
        - **Measuring a block:** a timer that logs the duration.

        «contextlib.ExitStack» manages a variable number of resources, such as one open file per input
        partition.

        ## Now say it like a senior engineer

        > [!senior] Connect the feature to the failure
        > "The decorator makes transient failures invisible to the caller but keeps permanent ones
        > loud. The context manager means a crash never leaves a partial output." Naming the failure
        > each one prevents is the senior part.

        ## In one breath

        A decorator wraps any function in shared behaviour, like retries, written once. A context
        manager guarantees cleanup on the way out of a «with» block, which is how you write a file that
        is either complete or not there at all.
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
      minutes: 15,
      body: `
        ## Start with the problem

        You want to test one rule: "test trips are dropped". But the function reads from a database,
        cleans the rows, and writes to a warehouse, all in one go. To test the rule, you need a
        database, a warehouse and the network. So nobody writes the test, and the bug ships.

        The fix is not a better testing tool. It is a better shape for the code.

        ## Idea 1: pure middle, thin edges

        Think of a juicer. Fruit goes in, juice comes out. You can test the juicer on your kitchen
        table, without the farm or the shop.

        Split pipeline code the same way.

        - Keep **transformations pure**: data in, data out, no reading or writing inside.
        - Push all I/O (database, files, APIs) to thin edges around them.

        Then most tests need no database, no cloud and no network: just plain dictionaries.

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

        ## Idea 2: three kinds of test, using pytest

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

        1. The first test checks the normal path: rounding and time conversion.
        2. The second runs one test for three statuses, with «parametrize».
        3. The third checks that bad input fails loudly, with the right message.

        ## Idea 3: the pytest tools that matter

        - **Fixtures:** shared setup, such as a sample record, a Spark session
          («scope="session"»), or a test database.
        - «@pytest.mark.parametrize»: one test, many cases. Edge values, every status, every time
          zone.
        - «tmp_path»: a fresh directory per test, for files the job writes.
        - «monkeypatch»: replace an environment variable, a clock or a client for one test.
        - «pytest.raises»: assert that bad input fails, and with which message.
        - **Markers:** separate fast unit tests from slow integration tests in CI.

        ## Idea 4: what to test in a data pipeline

        1. **Transform logic:** nulls, duplicates, time zones and daylight saving changes, empty
           input, a late record, a schema with an extra field.
        2. **Idempotency:** run the job twice on the same input, and assert the output is the same,
           not doubled.
        3. **Contracts:** the output schema and types, checked in the test, not only in production.
        4. **Integration:** against a real but local engine (DuckDB, a Postgres container, a local
           Spark session) for the SQL and the writes. Mark these as slow.

        Data tests in production (row counts, uniqueness, freshness) are a different layer. They catch
        bad data; unit tests catch bad code. A senior engineer wants both.

        > [!trap] Mocking everything tests nothing
        > A test that mocks the database client and asserts it was called with a string only proves
        > you wrote that string. Test SQL against a real engine, even a small local one.

        ## Now say it like a senior engineer

        > [!senior] How you would say it
        > "I keep transforms pure so they are unit-tested with plain dictionaries, I run the SQL
        > against DuckDB or a container in CI, I test reruns for idempotency, and I let data tests in
        > the warehouse catch what code tests cannot."

        ## In one breath

        Make the middle of the pipeline pure, so it can be tested with plain data, and keep I/O at
        thin edges. Test logic, reruns and output schema in code, test SQL on a real local engine, and
        let warehouse data tests catch bad data.
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
      minutes: 15,
      body: `
        ## Start with the problem

        Your job calls an API 1,000 times. Each call takes 0.2 seconds, so the job takes over 3
        minutes, and the CPU sits idle almost the whole time, just waiting for replies. Then a second
        job hashes 8 big files, and uses one CPU core out of 8.

        Both jobs would be faster with concurrency. But Python has a rule that decides **which kind**
        helps which job, and picking the wrong one makes code more complex without making it faster.

        ## Idea 1: one talking stick (the GIL)

        Picture a meeting where only the person holding a talking stick may speak. In the standard
        CPython build, that stick is the **global interpreter lock (GIL)**: only one thread runs Python
        bytecode at a time.

        But a thread puts the stick down while it **waits**, for example on a network reply. Then
        another thread can speak. So:

        - Threads **do** help when the work is mostly waiting on I/O.
        - Threads **do not** speed up CPU-bound Python code; they just take turns.

        Python 3.13 added an experimental free-threaded build, and Python 3.14 made it officially
        supported but not the default. So most production code still runs with the GIL.

        ## Idea 2: pick the tool by what the work is waiting for

        - **Many network calls** (APIs, object storage): threads, or asyncio. Waiting releases the
          GIL.
        - **Thousands of concurrent connections:** asyncio. One thread, cheap tasks, but it needs
          async libraries.
        - **CPU-bound pure Python** (parsing, hashing): processes. Each process has its own
          interpreter and its own GIL, so 8 processes use 8 cores.
        - **NumPy, pandas, Polars, PyArrow work:** usually one process. They run in C and release the
          GIL themselves.
        - **Data bigger than one machine:** Spark, Beam or Dask. Not a threading question at all.

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

        **What processes cost:** arguments and results are pickled and copied between processes, so
        send file paths or chunk ids, not large objects. The «if __name__ == "__main__"» guard is
        required where processes start with spawn (the macOS and Windows default). Always call
        «result()», or a worker's exception disappears silently.

        > [!trap] Bound the concurrency
        > Fifty threads against an API that allows ten requests per second gets you throttled. Size the
        > pool from the downstream limit, not from your CPU count.

        ## Idea 3: share code as a package, not as copied files

        Copying helper files between DAG folders and notebooks is how five teams end up with five
        versions of one bug. Ship shared code as a package.

        - **pyproject.toml** declares the name, version, dependencies and build backend. It replaces
          «setup.py» for new projects.
        - Use a **src layout** («src/tripkit/»), so tests import the installed package, not the files
          next to them.
        - Build a **wheel** and publish it to a private index (Artifact Registry, CodeArtifact), with
          semantic versions.
        - **Lock** the exact dependency tree for applications and images («uv lock», pip-tools or
          Poetry). Keep library dependency ranges loose, so they install next to other code.
        - Pin the Python version in the image, and run tests in CI on the version you deploy.

        ## Now say it like a senior engineer

        > [!senior] The production answer
        > "Shared logic is a versioned package with tests and a changelog. Each job image pins it with
        > a lock file, so a fix is a version bump that teams adopt on purpose, and a bad release rolls
        > back by pinning the old version."

        ## In one breath

        The GIL lets one thread run Python at a time, but a waiting thread lets others run: threads or
        asyncio for waiting, processes for CPU work, a cluster for data bigger than one machine. Share
        code as a versioned, locked package.
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
      minutes: 17,
      body: `
        ## Start with the problem

        Many sources are SaaS APIs: payments, CRM, ads, support tickets. The first extractor is ten
        lines: call the API, get page 1, page 2, page 3, save. It works in testing. In production it
        fails in four ways.

        1. It **misses** pages, because records were added while it was paging.
        2. It **duplicates** pages, for the same reason.
        3. It gets **rate limited** and banned for an hour.
        4. It crashes on page 4,000 and **restarts from zero**.

        Each idea below fixes one of these.

        ## Idea 1: page with a bookmark, not a page number (pagination)

        Imagine reading a list that people keep adding to at the top. You read "page 3" (items 21 to
        30). Someone adds two items. Now your "page 4" starts at what used to be item 29. You read two
        items twice. Delete instead of add, and you skip two items.

        - **Offset / page number** («?offset=1000&limit=100»): has exactly that problem, and deep
          offsets get slow.
        - **Cursor (token)** («?cursor=abc123», from the last response): a bookmark the server gives
          you. Stable and fast. The cursor may expire, so finish or checkpoint quickly.
        - **Keyset** («?created_after=2026-11-01T10:00:00Z&after_id=981»): "give me what comes after
          this exact row". Stable if the sort key is unique and never changes.
        - **Link header:** follow the «next» URL in the response headers. Same as cursor; do not
          build the URLs yourself.

        Prefer cursor or keyset. If only offsets exist, page over a **fixed time window** that has
        stopped changing (for example, records updated before the run started), and deduplicate by id
        afterwards.

        ## Idea 2: ask only for what changed (incremental pulls)

        Ask for «updated_since = last_watermark - overlap». The overlap of a few minutes covers clock
        differences and late commits on the provider's side. The duplicates the overlap brings are
        removed later by a «MERGE» on the record id and «updated_at».

        ## Idea 3: stay under the speed limit (rate limits)

        - Read the limit from the docs and the headers, such as «X-RateLimit-Remaining» and
          «Retry-After».
        - On **429 Too Many Requests**, wait as long as «Retry-After» says.
        - Throttle on your side with a **token bucket**: a bucket refilled with N tokens per second,
          and each request takes one. Parallel workers share one bucket, so together they never hit
          the limit.

        ## Idea 4: retry the right errors, the right way

        - Retry **only** what can succeed later: timeouts, connection errors, 429 and 5xx. Never
          retry a 400 or 401 in a loop; fail and alert.
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

        ## Idea 5: save first, then move the bookmark (land raw, then checkpoint)

        This fixes the restart-from-zero problem.

        1. Write each page **as received** (JSON lines) to the landing zone, named by run id and page
           number, with request metadata: URL, parameters, time and status.
        2. Only after a page is safely written, save the cursor in a small state store. A crash
           resumes from the last saved cursor, not from zero.
        3. Parse and type the data in a later step. A schema change then breaks parsing, not
           extraction, and the raw pages can be re-parsed.

        ## Idea 6: scale out carefully

        Split the work by a key the API filters on (date windows, accounts, regions), and run workers
        in parallel, all drawing from one shared rate budget. Backfills use the same code with an old
        start date and a lower-priority budget.

        > [!trap] Retrying a POST
        > Some APIs need a POST to start an export or a search. Retrying it can create two exports or
        > two charges. Send an **idempotency key** if the API supports one, or check for the existing
        > job first.

        ## Now say it like a senior engineer

        > [!senior] Name the failure modes
        > "Cursor pagination, an updated_since window with five minutes of overlap, MERGE by id, a
        > token bucket at 80 percent of the limit, retries with jitter on 429 and 5xx only, raw pages
        > landed before the cursor is saved." Each phrase answers a follow-up before it is asked.

        ## In one breath

        Page with the server's bookmark, ask only for what changed with a small overlap, stay under the
        rate limit with a shared token bucket, and retry only errors that can succeed. Save each raw
        page before you move the bookmark, so a crash resumes instead of restarting.
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
    ...pandasLessons,
  ],
};

export const problems: Problem[] = [
  {
    slug: 'parse-logs-error-rate',
    title: 'Error rate per endpoint from logs',
    track: 'python',
    kind: 'coding',
    difficulty: 'easy',
    companies: ['uber', 'google', 'amazon', 'meta', 'microsoft'],
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
      ~~~

      Pass it an open file, «error_rates(open("access.log", encoding="utf-8"))». The loop reads
      one line at a time, so a file of any size fits.

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
    companies: ['uber', 'amazon', 'meta', 'microsoft'],
    prompt: `
      Given a list of «(user_id, start_ts, end_ts)» tuples, unsorted, return per user the merged
      sessions: sessions that overlap or are at most 5 minutes (300 s) apart become one.
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
    companies: ['uber', 'google', 'amazon', 'meta', 'microsoft'],
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
    companies: ['google', 'amazon', 'meta', 'microsoft'],
    prompt: `
      You receive a stream of search terms. At any time, «top(k)» must return the k most frequent
      terms seen so far, as «(term, count)» pairs: the highest count first, and terms with the
      same count in alphabetical order. Implement «add(term)» and «top(k)». Discuss complexity,
      and what you would do if distinct terms do not fit in memory.
    `,
    hints: [
      'A Counter makes add O(1).',
      'heapq.nsmallest with the key (-count, term) gives top k with the tie rule.',
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
              # The highest count first; a tie goes to the term that sorts first.
              return heapq.nsmallest(k, self.counts.items(), key=lambda item: (-item[1], item[0]))
      ~~~

      «add» is O(1); «top» is O(d log k) for d distinct terms. The key «(-count, term)» puts
      the tie rule in one place: «nlargest» with «(count, term)» would put «#rain» before
      «#ipl» on a tie. If «top» is called far more often
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
    companies: ['uber', 'amazon', 'meta', 'microsoft'],
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
    companies: ['google', 'amazon', 'meta', 'microsoft'],
    prompt: `
      You have k files, each sorted by timestamp, each too large for memory together. Produce one
      output stream sorted by timestamp. Each line starts with an ISO timestamp. Lines with the
      same timestamp keep the order of their files.
    `,
    hints: [
      'Hold one line per file at a time.',
      'A heap keyed by timestamp gives the next smallest line.',
      'After you emit a line, read the next one from the same file.',
    ],
    answer: `
      ~~~python
      import heapq
      from contextlib import ExitStack

      def merge_sorted(files, out):
          heap = []
          for index, handle in enumerate(files):
              line = handle.readline()
              if line:
                  heap.append((line[:20], index, line))
          heapq.heapify(heap)
          while heap:
              _, index, line = heapq.heappop(heap)
              out.write(line)
              nxt = files[index].readline()
              if nxt:
                  heapq.heappush(heap, (nxt[:20], index, nxt))

      def merge_paths(paths, out_path):
          # ExitStack closes every file that opened, even when a later open fails.
          with ExitStack() as stack:
              files = [stack.enter_context(open(p, encoding="utf-8")) for p in paths]
              out = stack.enter_context(open(out_path, "w", encoding="utf-8"))
              merge_sorted(files, out)
      ~~~

      O(N log k) time and O(k) memory. The file index in the tuple breaks timestamp ties, so
      lines with the same timestamp keep the order of their files, and Python never compares
      two whole lines. «heapq.merge(*files, key=lambda line: line[:20])» does the same thing in
      one call. This is the merge step of an external sort.
    `,
    signals: [
      'Uses a heap of size k, not a full load',
      'Breaks ties so comparison is well defined',
      'Closes every file, with a finally block or an ExitStack',
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
    companies: ['uber', 'google', 'amazon', 'meta', 'microsoft'],
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
    companies: ['uber', 'amazon', 'meta', 'microsoft'],
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

      def pay_with_retries(send, payment, attempts=5, sleep=time.sleep):
          key = payment.get("idempotency_key") or str(uuid.uuid4())
          payment = {**payment, "idempotency_key": key}
          for attempt in range(attempts):
              try:
                  return send(payment)
              except TimeoutError:
                  if attempt == attempts - 1:
                      raise
                  sleep(random.uniform(0, min(10, 0.5 * 2 ** attempt)))
      ~~~

      The key is generated once, before the first attempt, and reused for every retry. Store it
      with the payment record so a crash and restart reuses it too. The «sleep» parameter lets a
      test pass a fake that records the delays, so the test never waits.
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
    companies: ['uber', 'google', 'amazon', 'meta', 'microsoft'],
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
    companies: ['google', 'amazon', 'meta', 'microsoft'],
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
    companies: ['uber', 'amazon', 'meta', 'microsoft'],
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
    companies: ['uber', 'google', 'amazon', 'meta', 'microsoft'],
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
      Pass the API, the storage, the clock and «sleep» in as arguments. The code is the same in
      production, and a test runs it on a fake clock in milliseconds.

      ~~~python
      import random
      from datetime import datetime, timedelta

      MIN_INTERVAL = 60 / 90  # 90 requests a minute, under the limit of 100
      OVERLAP = timedelta(minutes=5)


      def get_page(fetch, params, sleep):
          for attempt in range(8):
              try:
                  response = fetch(params)
              except (ConnectionError, TimeoutError):
                  sleep(random.uniform(0, 2 ** attempt))
                  continue
              if response.status_code == 429:
                  sleep(float(response.headers.get("Retry-After", "60")))
                  continue
              if response.status_code >= 500:
                  sleep(random.uniform(0, 2 ** attempt))
                  continue
              if response.status_code >= 400:
                  raise RuntimeError(f"HTTP {response.status_code}: the request is wrong, so a retry will not help")
              return response.json()
          raise RuntimeError("the API still fails after 8 attempts")


      def extract(fetch, store, run_id, now, sleep, clock):
          state = store.load_state()
          if state.get("cursor"):  # resume an interrupted run
              params = {"cursor": state["cursor"]}
              page_no = state["page_no"]
              started = state["started"]
          else:
              since = datetime.fromisoformat(state["watermark"]) - OVERLAP
              started = now().isoformat()
              params = {"updated_since": since.isoformat()}
              page_no = 0
          while True:
              began = clock()
              body = get_page(fetch, params, sleep)
              store.write_page(run_id, page_no, body["data"])  # land the page first
              page_no += 1
              cursor = body.get("next_cursor")
              if not cursor:
                  store.save_state({"watermark": started, "cursor": None, "page_no": 0, "started": None})
                  return
              store.save_state({"watermark": state["watermark"], "cursor": cursor,
                                "page_no": page_no, "started": started})
              params = {"cursor": cursor}
              sleep(max(0.0, MIN_INTERVAL - (clock() - began)))
      ~~~

      In production, «fetch» wraps «session.get(URL, params=params, timeout=(5, 30))» and turns
      «requests.ConnectionError» and «requests.Timeout» into the built-in errors. «sleep» is
      «time.sleep», «clock» is «time.monotonic», and «now» returns «datetime.now(timezone.utc)».

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
  ...pandasProblems,
];
