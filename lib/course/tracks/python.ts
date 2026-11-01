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
];
