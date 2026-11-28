import { AI_RUNNABLES } from '@/lib/course/runnables/ai';
import { PANDAS_RUNNABLES } from '@/lib/course/runnables/python-pandas';
import { PYTHON_PRODUCTION_RUNNABLES } from '@/lib/course/runnables/python-production';
import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the Python track. Each runs on Python 3.14 in the
 * browser. This file holds the data-processing problems: logs, sessions,
 * rate limits, streams, sweeps, merges and nested events.
 * `python-production.ts` holds retries, tests and the API extractor;
 * `python-pandas.ts` holds the pandas problems; `ai.ts` holds the AI track.
 *
 * The same sizing rule as the DSA track applies: a big case takes the
 * expected answer a few milliseconds and the usual brute force seconds.
 */
const DATA_RUNNABLES: Record<string, RunnableSpec> = {
  'parse-logs-error-rate': {
    language: 'python',
    task: `Write «error_rates(lines)». «lines» is any iterable of log lines, such as an open file, so read it once and do not call «len()» on it. Return «(rates, skipped)»: «rates» maps each endpoint to «(requests, error_share)», where «error_share» is the share of its requests with status 500 or above, from 0.0 to 1.0. A line is valid when it has exactly 5 fields separated by whitespace and the 4th field, the status, is all digits. «skipped» counts the other lines.`,
    setup: `lines = [
    "2026-10-31T10:00:01Z GET /v1/trips 200 35ms",
    "2026-10-31T10:00:02Z GET /v1/trips 503 120ms",
    "2026-10-31T10:00:02Z POST /v1/payments 201 80ms",
    "garbage line",
    "2026-10-31T10:00:03Z POST /v1/payments 500 95ms",
    "2026-10-31T10:00:04Z GET /v1/drivers 200 12ms",
    "2026-10-31T10:00:05Z GET /v1/trips 200 40ms",
    "2026-10-31T10:00:06Z GET /v1/trips - 3ms",
]`,
    starter: `def error_rates(lines):
    # Return (rates, skipped), where rates[endpoint] = (requests, error_share).
    ...


print(error_rates(lines))
`,
    solution: `from collections import defaultdict


def error_rates(lines):
    total = defaultdict(int)
    errors = defaultdict(int)
    skipped = 0
    for line in lines:
        parts = line.split()
        if len(parts) != 5 or not parts[3].isdigit():
            skipped += 1
            continue
        endpoint, status = parts[2], int(parts[3])
        total[endpoint] += 1
        if status >= 500:
            errors[endpoint] += 1
    rates = {endpoint: (total[endpoint], errors[endpoint] / total[endpoint]) for endpoint in total}
    return rates, skipped
`,
    cases: [
      {
        name: 'Sample',
        note: '/v1/trips has 3 requests and one 503, so its share is 1/3. Two lines are malformed.',
        check: 'error_rates(lines)',
      },
      {
        name: '500 is an error, 499 is not',
        setup: `lines = [
    "2026-10-31T11:00:00Z GET /v1/eta 499 5ms",
    "2026-10-31T11:00:01Z GET /v1/eta 500 9ms",
    "2026-10-31T11:00:02Z GET /v1/eta 599 4ms",
    "2026-10-31T11:00:03Z GET /v1/eta 404 2ms",
]`,
        check: 'error_rates(lines)',
      },
      {
        name: 'Every line is malformed',
        note: 'An empty line, a short line, a status that is not a number, and a sixth field.',
        setup: `lines = [
    "",
    "GET /v1/trips 200",
    "2026-10-31T11:00:00Z GET /v1/trips OK 3ms",
    "2026-10-31T11:00:00Z GET /v1/trips 200 3ms extra",
]`,
        check: 'error_rates(lines)',
      },
      {
        name: 'Fields separated by more than one space',
        hidden: true,
        note: 'Two spaces or a tab still separate two fields. «split()» with no argument handles both.',
        setup: `lines = [
    "2026-10-31T12:00:00Z  GET /v1/trips 200 35ms",
    "2026-10-31T12:00:01Z GET\\t/v1/trips 502 35ms",
]`,
        check: 'error_rates(lines)',
      },
      {
        name: 'A file is read once',
        hidden: true,
        note: 'This test passes a generator, like an open file: it has no «len()» and a second loop over it sees nothing.',
        setup: `endpoints = ["/v1/trips", "/v1/payments", "/v1/drivers", "/v1/eta", "/v1/surge"]
statuses = [200, 200, 201, 204, 301, 404, 429, 500, 502, 503]
big_lines = []
for i in range(20_000):
    if i % 97 == 0:
        big_lines.append("partial line %d" % i)
    else:
        big_lines.append("2026-10-31T10:%02d:%02dZ GET %s %d %dms" % (
            i // 60 % 60, i % 60, endpoints[i % 5], statuses[i // 5 % 10], i % 300))`,
        check: 'error_rates(line for line in big_lines)',
      },
    ],
  },

  'merge-rider-sessions': {
    language: 'python',
    task: `Write «merge_sessions(rows, gap_s=300)». «rows» holds «(user_id, start_ts, end_ts)» tuples in any order. Return a dict that maps each user to their merged sessions: a list of «(start, end)» tuples sorted by start. A session merges into the one before it when it starts at most «gap_s» seconds after that one ends, so overlapping, nested and touching sessions merge too.`,
    setup: `rows = [
    ("u1", 1000, 1600),
    ("u2", 50, 80),
    ("u1", 0, 300),
    ("u1", 2200, 2300),
    ("u1", 1700, 1750),
]`,
    starter: `def merge_sessions(rows, gap_s=300):
    # Return {user_id: [(start, end), ...]}, merged and sorted by start.
    ...


print(merge_sessions(rows))
`,
    solution: `from collections import defaultdict


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
        result[user] = [tuple(session) for session in merged]
    return result
`,
    cases: [
      {
        name: 'Sample',
        note: 'u1 at 1700 starts 100 s after the session that ends at 1600, so the two merge.',
        check: 'merge_sessions(rows)',
      },
      {
        name: 'A session inside a longer one',
        note: 'The short session ends before the long one, so the merged end stays 1000.',
        setup: 'rows = [("u", 0, 1000), ("u", 100, 200), ("u", 1250, 1300)]',
        check: 'merge_sessions(rows)',
      },
      {
        name: 'Exactly 300 seconds apart',
        note: '400 is 300 s after 100, so it merges. 801 is 301 s after 500, so it does not.',
        setup: 'rows = [("u", 0, 100), ("u", 400, 500), ("u", 801, 900)]',
        check: 'merge_sessions(rows)',
      },
      {
        name: 'Two users at the same time',
        hidden: true,
        note: 'Sessions of different users never merge, even when they overlap in time.',
        setup: 'rows = [("a", 0, 100), ("b", 50, 150), ("a", 450, 500), ("b", 500, 520)]',
        check: 'merge_sessions(rows)',
      },
      {
        name: 'A gap of zero',
        hidden: true,
        note: 'With «gap_s=0» only touching or overlapping sessions merge.',
        setup: 'rows = [("u", 0, 10), ("u", 10, 20), ("u", 21, 30)]',
        check: 'merge_sessions(rows, gap_s=0)',
      },
      {
        name: 'No sessions',
        hidden: true,
        check: 'merge_sessions([])',
      },
      {
        name: 'Forty users, random sessions',
        hidden: true,
        setup: `import random
rng = random.Random(11)
rows = []
for _ in range(3000):
    start = rng.randrange(0, 200_000)
    rows.append(("u%d" % rng.randrange(40), start, start + rng.randrange(1, 900)))`,
        check: 'merge_sessions(rows)',
      },
    ],
  },

  'rolling-rate-limiter': {
    language: 'python',
    task: `Write a class «Limiter(limit=100, window_s=60)» with «allow(user_id, ts)». It returns «True» and counts the request when the user has fewer than «limit» allowed requests in the last «window_s» seconds, and «False» otherwise. A request allowed at time «t» stops counting at «t + window_s». Rejected requests do not count. Each user has their own limit, and «ts» never goes down. Each call must be fast however long the limiter runs, and memory must stay in proportion to the requests of the last «window_s» seconds: forget a user whose requests have all left the window, even if that user never calls again.`,
    setup: `events = [("ana", 0), ("ana", 1), ("ana", 2), ("ana", 3), ("ana", 10), ("ana", 11), ("ana", 12)]`,
    helpers: `def replay(events, **settings):
    limiter = Limiter(**settings)
    return [limiter.allow(user, ts) for user, ts in events]


def check_idle_users(cls):
    import tracemalloc
    limiter = cls(limit=5, window_s=60)
    tracemalloc.start()
    for i in range(50_000):
        limiter.allow("user-%d" % i, i)
    held, _ = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    if held > 2_000_000:
        return verdict(False, "50,000 users sent one request each, one a second, and your limiter now holds %.1f MB. Only the last 60 seconds count: forget a user once their last request leaves the window. Keep one queue of (ts, user) for every accepted request, and drop expired entries from it on each call." % (held / 1_000_000))
    return verdict(True)`,
    starter: `from collections import defaultdict, deque


class Limiter:
    def __init__(self, limit=100, window_s=60):
        ...

    def allow(self, user_id, ts):
        # Return True and count the request, or return False.
        ...


limiter = Limiter(limit=3, window_s=10)
print([limiter.allow(user, ts) for user, ts in events])
`,
    solution: `from collections import deque


class Limiter:
    def __init__(self, limit=100, window_s=60):
        self.limit = limit
        self.window_s = window_s
        self.accepted = {}      # user -> deque of accepted times, oldest first
        self.order = deque()    # (ts, user) of every accepted request, oldest first

    def allow(self, user_id, ts):
        # Expire old requests of every user, so idle users are forgotten too.
        while self.order and self.order[0][0] <= ts - self.window_s:
            _, user = self.order.popleft()
            times = self.accepted[user]
            times.popleft()
            if not times:
                del self.accepted[user]
        times = self.accepted.get(user_id)
        if times is None:
            times = self.accepted[user_id] = deque()
        if len(times) < self.limit:
            times.append(ts)
            self.order.append((ts, user_id))
            return True
        return False
`,
    cases: [
      {
        name: 'Sample',
        note: 'A limit of 3 in 10 seconds. At 10 s the request from 0 s has left the window.',
        check: 'replay(events, limit=3, window_s=10)',
      },
      {
        name: 'Rejected requests do not count',
        note: 'Only the requests at 0 s and 1 s count, so 10 s and 11 s are allowed again.',
        setup: 'events = [("bo", ts) for ts in range(13)]',
        check: 'replay(events, limit=2, window_s=10)',
      },
      {
        name: 'Each user has their own limit',
        setup: 'events = [("a", 0), ("b", 0), ("a", 1), ("b", 1), ("a", 2)]',
        check: 'replay(events, limit=2, window_s=60)',
      },
      {
        name: 'A request leaves the window exactly window_s later',
        hidden: true,
        note: 'The request at 0 s stops counting at 10 s.',
        setup: 'events = [("u", 0), ("u", 9), ("u", 10)]',
        check: 'replay(events, limit=1, window_s=10)',
      },
      {
        name: 'The default is 100 requests a minute',
        hidden: true,
        setup: 'burst = [("u", i // 2) for i in range(240)]',
        check: 'replay(burst)',
      },
      {
        name: 'Twenty users, random traffic',
        hidden: true,
        setup: `import random
rng = random.Random(3)
events, ts = [], 0
for _ in range(5000):
    ts += rng.randrange(0, 3)
    events.append(("u%d" % rng.randrange(20), ts))`,
        check: 'replay(events, limit=5, window_s=30)',
      },
      {
        name: 'Twelve thousand requests',
        hidden: true,
        note: 'Counting every past request on each call takes seconds here.',
        setup: 'big_events = [("u", i // 2) for i in range(12_000)]',
        check: 'replay(big_events)',
        limitS: 1,
        slowHint:
          'Drop the timestamps that left the window, oldest first, so each call looks at no more than limit entries.',
      },
      {
        name: 'Fifty thousand users come and go',
        hidden: true,
        note: 'Each user sends one request and never comes back. Memory must not grow with every user ever seen.',
        check: 'check_idle_users(Limiter)',
      },
    ],
  },

  'top-k-trending-hashtags': {
    language: 'python',
    task: `Write a class «Trending» with «add(term)» and «top(k)». «top(k)» returns a list of «(term, count)» pairs for the «k» most frequent terms added so far: the highest count first, and terms with the same count in alphabetical order. When fewer than «k» terms exist, return them all.`,
    setup: `stream = ["#ipl", "#rain", "#ipl", "#budget", "#rain", "#ipl", "#cricket", "#budget"]`,
    helpers: `def replay(script):
    trending = Trending()
    answers = []
    for step in script:
        if isinstance(step, int):
            answers.append(trending.top(step))
        else:
            trending.add(step)
    return answers`,
    starter: `from collections import Counter
import heapq


class Trending:
    def __init__(self):
        ...

    def add(self, term):
        ...

    def top(self, k):
        # Return [(term, count), ...]: highest count first, ties in alphabetical order.
        ...


trending = Trending()
for term in stream:
    trending.add(term)
print(trending.top(3))
`,
    solution: `from collections import Counter
import heapq


class Trending:
    def __init__(self):
        self.counts = Counter()

    def add(self, term):
        self.counts[term] += 1

    def top(self, k):
        return heapq.nsmallest(k, self.counts.items(), key=lambda item: (-item[1], item[0]))
`,
    cases: [
      {
        name: 'Sample',
        note: '#budget and #rain both have 2, so #budget comes first.',
        check: 'replay(stream + [3])',
      },
      {
        name: 'Ties in alphabetical order',
        setup: 'stream = ["#b", "#c", "#a"]',
        check: 'replay(stream + [2])',
      },
      {
        name: 'k is larger than the number of terms',
        setup: 'stream = ["#x", "#y", "#x"]',
        check: 'replay(stream + [10])',
      },
      {
        name: 'top between adds',
        hidden: true,
        note: 'Each «top» call sees every term added before it.',
        check: 'replay(["#a", 1, "#b", "#b", 1, "#a", "#a", 2])',
      },
      {
        name: 'k is 0',
        hidden: true,
        check: 'replay(["#a", 0])',
      },
      {
        name: 'A long stream',
        hidden: true,
        setup: `import random
rng = random.Random(8)
tags = ["#t%03d" % n for n in range(500)]
script = []
for n in range(20_000):
    script.append(tags[min(int(rng.paretovariate(1.2)) - 1, 499)])
    if n % 1000 == 999:
        script.append(10)`,
        check: 'replay(script)',
      },
    ],
  },

  'max-concurrent-trips': {
    language: 'python',
    task: `Write «peak_concurrency(trips)». «trips» holds «(city, start_ts, end_ts)» tuples with «start_ts < end_ts». Return a dict that maps each city to «(peak, at)»: the largest number of its trips in progress at the same moment, and the earliest time that number was reached. A trip is in progress from its start up to, but not including, its end, so a trip ending at «t» does not overlap a trip starting at «t». It must stay fast for a busy city.`,
    setup: `trips = [
    ("blr", 0, 10),
    ("blr", 5, 15),
    ("blr", 10, 20),
    ("del", 3, 8),
    ("blr", 12, 14),
]`,
    starter: `def peak_concurrency(trips):
    # Return {city: (peak, earliest_time_of_peak)}.
    ...


print(peak_concurrency(trips))
`,
    solution: `from collections import defaultdict


def peak_concurrency(trips):
    points = defaultdict(list)
    for city, start, end in trips:
        points[city].append((start, 1))
        points[city].append((end, -1))

    result = {}
    for city, events in points.items():
        events.sort()
        current = best = 0
        best_at = None
        for ts, delta in events:
            current += delta
            if current > best:
                best, best_at = current, ts
        result[city] = (best, best_at)
    return result
`,
    cases: [
      {
        name: 'Sample',
        note: 'At 12 three Bengaluru trips are in progress: 5-15, 10-20 and 12-14. The trip 0-10 ended at 10.',
        check: 'peak_concurrency(trips)',
      },
      {
        name: 'A trip ends as another starts',
        note: 'The trip that ends at 10 and the trip that starts at 10 never overlap.',
        setup: 'trips = [("x", 0, 10), ("x", 10, 20)]',
        check: 'peak_concurrency(trips)',
      },
      {
        name: 'The earliest time of the peak',
        note: 'Two trips overlap from 1 and again from 11. The answer is 1.',
        setup: 'trips = [("x", 0, 5), ("x", 1, 6), ("x", 10, 15), ("x", 11, 16)]',
        check: 'peak_concurrency(trips)',
      },
      {
        name: 'Trips that start together',
        hidden: true,
        setup: 'trips = [("x", 5, 10), ("x", 5, 8), ("x", 1, 3)]',
        check: 'peak_concurrency(trips)',
      },
      {
        name: 'Six cities, random trips',
        hidden: true,
        setup: `import random
rng = random.Random(21)
trips = []
for _ in range(3000):
    start = rng.randrange(0, 50_000)
    trips.append((rng.choice(["blr", "del", "bom", "hyd", "maa", "ccu"]), start, start + rng.randrange(1, 2000)))`,
        check: 'peak_concurrency(trips)',
      },
      {
        name: 'A busy city',
        hidden: true,
        note: 'Comparing every pair of trips takes seconds here; one sorted sweep takes milliseconds.',
        setup: `import random
rng = random.Random(4)
big_trips = []
for _ in range(8000):
    start = rng.randrange(0, 86_400)
    big_trips.append(("blr", start, start + rng.randrange(300, 3600)))`,
        check: 'peak_concurrency(big_trips)',
        limitS: 1,
        slowHint:
          'Make a +1 event at each start and a -1 event at each end, sort them with ends first at equal times, and keep a running count.',
      },
    ],
  },

  'k-way-merge-sorted-files': {
    language: 'python',
    task: `Write «merge_sorted(files, out)». «files» is a list of open text files. Each line starts with a 20-character ISO timestamp such as «2026-10-31T10:00:01Z», and each file is sorted by it. Write every line to «out», a file open for writing, in timestamp order. Lines with the same timestamp keep the order of their files: file 0 first. The files are too big for memory, so hold about one line per file at a time.`,
    setup: `file_a = """2026-10-31T10:00:01Z trip_started t1
2026-10-31T10:00:04Z trip_ended t1
2026-10-31T10:00:09Z trip_started t4
"""
file_b = """2026-10-31T10:00:02Z payment p7
2026-10-31T10:00:04Z payment p8
"""
file_c = """2026-10-31T10:00:00Z login u3
2026-10-31T10:00:05Z logout u3
"""
texts = [file_a, file_b, file_c]`,
    helpers: `class _Meter:
    def __init__(self):
        self.read = 0
        self.written = 0
        self.peak = 0


class _Source:
    """A text file open for reading. It counts the lines taken out of it."""

    def __init__(self, text, meter):
        self._lines = text.splitlines(keepends=True)
        self._next = 0
        self._meter = meter
        self.closed = False

    def readline(self, size=-1):
        if self.closed:
            raise ValueError("I/O operation on closed file.")
        if self._next >= len(self._lines):
            return ""
        line = self._lines[self._next]
        self._next += 1
        meter = self._meter
        meter.read += 1
        meter.peak = max(meter.peak, meter.read - meter.written)
        return line

    def __iter__(self):
        return self

    def __next__(self):
        line = self.readline()
        if not line:
            raise StopIteration
        return line

    def read(self, size=-1):
        return "".join(iter(self.readline, ""))

    def readlines(self, hint=-1):
        return list(iter(self.readline, ""))

    def close(self):
        self.closed = True

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()


class _Sink:
    """A text file open for writing."""

    def __init__(self, meter):
        self._parts = []
        self._meter = meter
        self.closed = False

    def write(self, text):
        if not isinstance(text, str):
            raise TypeError("write() argument must be str, not %s" % type(text).__name__)
        self._parts.append(text)
        self._meter.written += text.count("\\n")
        return len(text)

    def writelines(self, lines):
        for line in lines:
            self.write(line)

    def flush(self):
        pass

    def close(self):
        self.closed = True

    def getvalue(self):
        return "".join(self._parts)


def _merge(fn, texts):
    meter = _Meter()
    out = _Sink(meter)
    fn([_Source(text, meter) for text in texts], out)
    return meter, out.getvalue()


def merged(fn, texts):
    return _merge(fn, texts)[1].splitlines()


def check_memory(fn, texts):
    meter, output = _merge(fn, texts)
    if meter.peak > len(texts) + 1:
        return verdict(False, "Your code held %d lines at once. With %d files it should hold about one line per file: read the next line of a file only after you write the line it came from." % (meter.peak, len(texts)))
    if sorted(output.splitlines()) != sorted(line for text in texts for line in text.splitlines()):
        return verdict(False, "Write every line of every file exactly once.")
    return verdict(True)`,
    starter: `import heapq
import io


def merge_sorted(files, out):
    # Write the lines of all files to out, in timestamp order.
    ...


out = io.StringIO()
merge_sorted([io.StringIO(text) for text in texts], out)
print(out.getvalue())
`,
    solution: `import heapq


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
        following = files[index].readline()
        if following:
            heapq.heappush(heap, (following[:20], index, following))
`,
    cases: [
      {
        name: 'Sample',
        note: 'Two lines have the time 10:00:04. The line from file 0 comes first.',
        check: 'merged(merge_sorted, texts)',
      },
      {
        name: 'An empty file',
        setup: 'texts = ["", file_b, ""]',
        check: 'merged(merge_sorted, texts)',
      },
      {
        name: 'One timestamp in every file',
        note: 'Equal timestamps keep the order of the files, then the order inside each file.',
        setup: `texts = [
    "2026-10-31T10:00:00Z c first\\n2026-10-31T10:00:00Z c second\\n",
    "2026-10-31T10:00:00Z b first\\n",
    "2026-10-31T10:00:00Z a first\\n2026-10-31T10:00:01Z a later\\n",
]`,
        check: 'merged(merge_sorted, texts)',
      },
      {
        name: 'Twenty files',
        hidden: true,
        setup: `import random
rng = random.Random(9)
texts = []
for file_no in range(20):
    second, lines = 0, []
    for n in range(100):
        second += rng.randrange(0, 5)
        lines.append("2026-10-31T10:%02d:%02dZ f%d-%d\\n" % (second // 60, second % 60, file_no, n))
    texts.append("".join(lines))`,
        check: 'merged(merge_sorted, texts)',
      },
      {
        name: 'One line per file in memory',
        hidden: true,
        note: 'Five files of 2,000 lines. Reading them whole and sorting holds 10,000 lines.',
        setup: `import random
from datetime import datetime, timedelta
rng = random.Random(5)
big_texts = []
for file_no in range(5):
    seconds, lines = 0, []
    for n in range(2000):
        seconds += rng.randrange(0, 40)
        stamp = (datetime(2026, 10, 31) + timedelta(seconds=seconds)).strftime("%Y-%m-%dT%H:%M:%SZ")
        lines.append("%s event f%d-%d\\n" % (stamp, file_no, n))
    big_texts.append("".join(lines))`,
        check: 'check_memory(merge_sorted, big_texts)',
      },
    ],
  },

  'flatten-nested-events': {
    language: 'python',
    task: `Write «flatten(event)». Return a new dict with one level: the keys of nested dicts join with dots. A list that holds a dict becomes indexed keys such as «stops.0.lat» and «stops.1.lat». A list of plain values stays one list value. Every other value stays as it is, «None» included. Do not change «event».`,
    setup: `event = {
    "event_id": "e1",
    "trip": {
        "id": 7,
        "city": "blr",
        "stops": [{"lat": 12.97, "lng": 77.59}, {"lat": 12.93, "lng": 77.62}],
        "tags": ["airport", "night"],
    },
    "rider": {"id": 42, "rating": None},
}`,
    helpers: `import copy as _copy_module


def check_unchanged(fn, event):
    before = _copy_module.deepcopy(event)
    fn(event)
    if event != before:
        return verdict(False, "flatten changed the event it was given. Build a new dict instead.")
    return verdict(True)`,
    starter: `def flatten(event):
    # Return a one-level dict with dotted keys.
    ...


print(flatten(event))
`,
    solution: `def flatten(value, prefix=""):
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
`,
    cases: [
      {
        name: 'Sample',
        note: '«stops» holds dicts, so it becomes indexed keys. «tags» holds strings, so it stays a list.',
        check: 'flatten(event)',
      },
      {
        name: 'The example from the question',
        setup: 'event = {"trip": {"id": 7, "stops": [{"lat": 1}, {"lat": 2}]}}',
        check: 'flatten(event)',
      },
      {
        name: 'Deep nesting',
        setup: 'event = {"a": {"b": {"c": {"d": {"e": {"f": 1}}}}}, "g": 2}',
        check: 'flatten(event)',
      },
      {
        name: 'Lists of dicts inside lists of dicts',
        hidden: true,
        setup: `event = {"orders": [{"id": 1, "items": [{"sku": "x", "qty": 2}, {"sku": "y", "qty": 1}]}, {"id": 2, "items": [{"sku": "z", "qty": 5}]}]}`,
        check: 'flatten(event)',
      },
      {
        name: 'Plain values stay as they are',
        hidden: true,
        note: 'An empty list, a list of numbers, None, False and 0 all stay.',
        setup:
          'event = {"scores": [1, 2, 3], "empty": [], "meta": {"note": None, "ok": False, "count": 0}}',
        check: 'flatten(event)',
      },
      {
        name: 'The event is unchanged',
        hidden: true,
        check: 'check_unchanged(flatten, event)',
      },
    ],
  },
};

export const PYTHON_RUNNABLES: Record<string, RunnableSpec> = {
  ...DATA_RUNNABLES,
  ...PYTHON_PRODUCTION_RUNNABLES,
  ...PANDAS_RUNNABLES,
  ...AI_RUNNABLES,
};
