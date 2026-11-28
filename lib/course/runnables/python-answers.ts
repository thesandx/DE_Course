import { AI_ANSWERS } from '@/lib/course/runnables/ai-answers';
import { PANDAS_ANSWERS } from '@/lib/course/runnables/python-pandas-answers';
import { PYTHON_PRODUCTION_ANSWERS } from '@/lib/course/runnables/python-production-answers';
import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/**
 * Other correct answers and the usual mistakes for the Python track's data
 * problems, for `python-specs.test.ts`.
 */
const DATA_ANSWERS: Record<string, SpecAnswers> = {
  'parse-logs-error-rate': {
    pass: [
      `from collections import Counter


def error_rates(lines):
    requests, errors = Counter(), Counter()
    skipped = 0
    for line in lines:
        fields = line.split()
        if len(fields) != 5:
            skipped += 1
            continue
        try:
            status = int(fields[3])
        except ValueError:
            skipped += 1
            continue
        requests[fields[2]] += 1
        errors[fields[2]] += status >= 500
    return {endpoint: (count, errors[endpoint] / count) for endpoint, count in requests.items()}, skipped
`,
      `import re

LINE = re.compile(r"\\S+\\s+\\S+\\s+(\\S+)\\s+(\\d+)\\s+\\S+")


def error_rates(lines):
    stats = {}
    skipped = 0
    for line in lines:
        match = LINE.fullmatch(line.strip())
        if match is None:
            skipped += 1
            continue
        endpoint, status = match.group(1), int(match.group(2))
        total, bad = stats.get(endpoint, (0, 0))
        stats[endpoint] = (total + 1, bad + (status >= 500))
    return {endpoint: (total, bad / total) for endpoint, (total, bad) in stats.items()}, skipped
`,
    ],
    fail: [
      // 500 itself is an error.
      `from collections import defaultdict


def error_rates(lines):
    total, errors, skipped = defaultdict(int), defaultdict(int), 0
    for line in lines:
        parts = line.split()
        if len(parts) != 5 or not parts[3].isdigit():
            skipped += 1
            continue
        total[parts[2]] += 1
        if int(parts[3]) > 500:
            errors[parts[2]] += 1
    return {e: (total[e], errors[e] / total[e]) for e in total}, skipped
`,
      // A status that is not a number crashes the job.
      `from collections import defaultdict


def error_rates(lines):
    total, errors, skipped = defaultdict(int), defaultdict(int), 0
    for line in lines:
        parts = line.split()
        if len(parts) != 5:
            skipped += 1
            continue
        endpoint, status = parts[2], int(parts[3])
        total[endpoint] += 1
        errors[endpoint] += status >= 500
    return {e: (total[e], errors[e] / total[e]) for e in total}, skipped
`,
      // len() does not work on a file or a generator.
      `from collections import defaultdict


def error_rates(lines):
    total, errors, valid = defaultdict(int), defaultdict(int), 0
    for line in lines:
        parts = line.split()
        if len(parts) == 5 and parts[3].isdigit():
            valid += 1
            total[parts[2]] += 1
            errors[parts[2]] += int(parts[3]) >= 500
    return {e: (total[e], errors[e] / total[e]) for e in total}, len(lines) - valid
`,
      // A count of errors is not a share.
      `from collections import defaultdict


def error_rates(lines):
    total, errors, skipped = defaultdict(int), defaultdict(int), 0
    for line in lines:
        parts = line.split()
        if len(parts) != 5 or not parts[3].isdigit():
            skipped += 1
            continue
        total[parts[2]] += 1
        errors[parts[2]] += int(parts[3]) >= 500
    return {e: (total[e], errors[e]) for e in total}, skipped
`,
      // split(" ") breaks on two spaces or a tab.
      `from collections import defaultdict


def error_rates(lines):
    total, errors, skipped = defaultdict(int), defaultdict(int), 0
    for line in lines:
        parts = line.strip().split(" ")
        if len(parts) != 5 or not parts[3].isdigit():
            skipped += 1
            continue
        total[parts[2]] += 1
        errors[parts[2]] += int(parts[3]) >= 500
    return {e: (total[e], errors[e] / total[e]) for e in total}, skipped
`,
      // Two passes: the second pass over a file sees nothing.
      `def valid(line):
    parts = line.split()
    return len(parts) == 5 and parts[3].isdigit()


def error_rates(lines):
    rates = {}
    for line in lines:
        if valid(line):
            parts = line.split()
            total, bad = rates.get(parts[2], (0, 0))
            rates[parts[2]] = (total + 1, bad + (int(parts[3]) >= 500))
    skipped = sum(1 for line in lines if not valid(line))
    return {e: (total, bad / total) for e, (total, bad) in rates.items()}, skipped
`,
    ],
  },

  'merge-rider-sessions': {
    pass: [
      `from itertools import groupby
from operator import itemgetter


def merge_sessions(rows, gap_s=300):
    result = {}
    for user, group in groupby(sorted(rows), key=itemgetter(0)):
        merged = []
        for _, start, end in group:
            if merged and start - merged[-1][1] <= gap_s:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))
        result[user] = merged
    return result
`,
      `def merge_sessions(rows, gap_s=300):
    sessions = {}
    for user, start, end in rows:
        sessions.setdefault(user, []).append([start, end])
    for user, items in sessions.items():
        items.sort()
        merged = [items[0]]
        for start, end in items[1:]:
            last = merged[-1]
            if start <= last[1] + gap_s:
                last[1] = max(last[1], end)
            else:
                merged.append([start, end])
        sessions[user] = merged
    return sessions
`,
    ],
    fail: [
      // A nested session shortens the merged one.
      `from collections import defaultdict


def merge_sessions(rows, gap_s=300):
    by_user = defaultdict(list)
    for user, start, end in rows:
        by_user[user].append((start, end))
    result = {}
    for user, sessions in by_user.items():
        merged = []
        for start, end in sorted(sessions):
            if merged and start <= merged[-1][1] + gap_s:
                merged[-1][1] = end
            else:
                merged.append([start, end])
        result[user] = [tuple(s) for s in merged]
    return result
`,
      // A gap of exactly 300 seconds should merge.
      `from collections import defaultdict


def merge_sessions(rows, gap_s=300):
    by_user = defaultdict(list)
    for user, start, end in rows:
        by_user[user].append((start, end))
    result = {}
    for user, sessions in by_user.items():
        merged = []
        for start, end in sorted(sessions):
            if merged and start < merged[-1][1] + gap_s:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        result[user] = [tuple(s) for s in merged]
    return result
`,
      // The input is not sorted.
      `from collections import defaultdict


def merge_sessions(rows, gap_s=300):
    by_user = defaultdict(list)
    for user, start, end in rows:
        by_user[user].append((start, end))
    result = {}
    for user, sessions in by_user.items():
        merged = []
        for start, end in sessions:
            if merged and start <= merged[-1][1] + gap_s:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        result[user] = [tuple(s) for s in merged]
    return result
`,
      // Sessions of different users merge.
      `def merge_sessions(rows, gap_s=300):
    merged = []
    for user, start, end in sorted(rows, key=lambda row: row[1]):
        if merged and start <= merged[-1][2] + gap_s:
            merged[-1][2] = max(merged[-1][2], end)
        else:
            merged.append([user, start, end])
    result = {}
    for user, start, end in merged:
        result.setdefault(user, []).append((start, end))
    return result
`,
      // gap_s is ignored.
      `from collections import defaultdict


def merge_sessions(rows, gap_s=300):
    by_user = defaultdict(list)
    for user, start, end in rows:
        by_user[user].append((start, end))
    result = {}
    for user, sessions in by_user.items():
        merged = []
        for start, end in sorted(sessions):
            if merged and start <= merged[-1][1] + 300:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        result[user] = [tuple(s) for s in merged]
    return result
`,
    ],
  },

  'rolling-rate-limiter': {
    pass: [
      `from collections import deque


class Limiter:
    def __init__(self, limit=100, window_s=60):
        self.limit = limit
        self.window_s = window_s
        self.recent = {}
        self.log = deque()

    def allow(self, user_id, ts):
        cutoff = ts - self.window_s
        while self.log and self.log[0][0] <= cutoff:
            _, user = self.log.popleft()
            recent = self.recent.get(user)
            if recent is not None and recent[-1] <= cutoff:
                del self.recent[user]
        recent = self.recent.setdefault(user_id, deque(maxlen=self.limit))
        if len(recent) == self.limit and recent[0] > cutoff:
            return False
        recent.append(ts)
        self.log.append((ts, user_id))
        return True
`,
    ],
    fail: [
      // Correct counts, but a user who never comes back stays in memory forever.
      `from collections import defaultdict, deque


class Limiter:
    def __init__(self, limit=100, window_s=60):
        self.limit = limit
        self.window_s = window_s
        self.recent = defaultdict(lambda: deque(maxlen=limit))

    def allow(self, user_id, ts):
        recent = self.recent[user_id]
        if len(recent) == self.limit and recent[0] > ts - self.window_s:
            return False
        recent.append(ts)
        return True
`,
      // A rejected request still takes a place in the window.
      `from collections import defaultdict, deque


class Limiter:
    def __init__(self, limit=100, window_s=60):
        self.limit = limit
        self.window_s = window_s
        self.seen = defaultdict(deque)

    def allow(self, user_id, ts):
        times = self.seen[user_id]
        while times and times[0] <= ts - self.window_s:
            times.popleft()
        times.append(ts)
        return len(times) <= self.limit
`,
      // A request at t still counts at t + window_s.
      `from collections import defaultdict, deque


class Limiter:
    def __init__(self, limit=100, window_s=60):
        self.limit = limit
        self.window_s = window_s
        self.accepted = defaultdict(deque)

    def allow(self, user_id, ts):
        times = self.accepted[user_id]
        while times and times[0] < ts - self.window_s:
            times.popleft()
        if len(times) < self.limit:
            times.append(ts)
            return True
        return False
`,
      // One window for every user.
      `from collections import deque


class Limiter:
    def __init__(self, limit=100, window_s=60):
        self.limit = limit
        self.window_s = window_s
        self.accepted = deque()

    def allow(self, user_id, ts):
        while self.accepted and self.accepted[0] <= ts - self.window_s:
            self.accepted.popleft()
        if len(self.accepted) < self.limit:
            self.accepted.append(ts)
            return True
        return False
`,
      // Right, but each call scans the whole history.
      `from collections import defaultdict


class Limiter:
    def __init__(self, limit=100, window_s=60):
        self.limit = limit
        self.window_s = window_s
        self.history = defaultdict(list)

    def allow(self, user_id, ts):
        recent = sum(1 for t in self.history[user_id] if t > ts - self.window_s)
        if recent < self.limit:
            self.history[user_id].append(ts)
            return True
        return False
`,
      // The settings are ignored.
      `from collections import defaultdict, deque


class Limiter:
    def __init__(self, limit=100, window_s=60):
        self.accepted = defaultdict(deque)

    def allow(self, user_id, ts):
        times = self.accepted[user_id]
        while times and times[0] <= ts - 60:
            times.popleft()
        if len(times) < 100:
            times.append(ts)
            return True
        return False
`,
    ],
  },

  'top-k-trending-hashtags': {
    pass: [
      `class Trending:
    def __init__(self):
        self.counts = {}

    def add(self, term):
        self.counts[term] = self.counts.get(term, 0) + 1

    def top(self, k):
        return sorted(self.counts.items(), key=lambda item: (-item[1], item[0]))[:k]
`,
      `from collections import defaultdict


class Trending:
    def __init__(self):
        self.count = defaultdict(int)
        self.by_count = defaultdict(set)

    def add(self, term):
        old = self.count[term]
        if old:
            self.by_count[old].discard(term)
        self.count[term] = old + 1
        self.by_count[old + 1].add(term)

    def top(self, k):
        answer = []
        for count in sorted(self.by_count, reverse=True):
            for term in sorted(self.by_count[count]):
                if len(answer) == k:
                    return answer
                answer.append((term, count))
        return answer
`,
    ],
    fail: [
      // Ties come out in reverse alphabetical order.
      `from collections import Counter
import heapq


class Trending:
    def __init__(self):
        self.counts = Counter()

    def add(self, term):
        self.counts[term] += 1

    def top(self, k):
        return heapq.nlargest(k, self.counts.items(), key=lambda kv: (kv[1], kv[0]))
`,
      // most_common breaks ties by first appearance.
      `from collections import Counter


class Trending:
    def __init__(self):
        self.counts = Counter()

    def add(self, term):
        self.counts[term] += 1

    def top(self, k):
        return self.counts.most_common(k)
`,
      // Terms without their counts.
      `from collections import Counter


class Trending:
    def __init__(self):
        self.counts = Counter()

    def add(self, term):
        self.counts[term] += 1

    def top(self, k):
        return [term for term, _ in sorted(self.counts.items(), key=lambda kv: (-kv[1], kv[0]))[:k]]
`,
    ],
  },

  'max-concurrent-trips': {
    pass: [
      `from collections import defaultdict


def peak_concurrency(trips):
    by_city = defaultdict(lambda: ([], []))
    for city, start, end in trips:
        by_city[city][0].append(start)
        by_city[city][1].append(end)
    result = {}
    for city, (starts, ends) in by_city.items():
        starts.sort()
        ends.sort()
        best, best_at, current, j = 0, None, 0, 0
        for start in starts:
            while j < len(ends) and ends[j] <= start:
                j += 1
                current -= 1
            current += 1
            if current > best:
                best, best_at = current, start
        result[city] = (best, best_at)
    return result
`,
      `import heapq
from collections import defaultdict


def peak_concurrency(trips):
    by_city = defaultdict(list)
    for city, start, end in trips:
        by_city[city].append((start, end))
    result = {}
    for city, items in by_city.items():
        items.sort()
        ends, best, best_at = [], 0, None
        for start, end in items:
            while ends and ends[0] <= start:
                heapq.heappop(ends)
            heapq.heappush(ends, end)
            if len(ends) > best:
                best, best_at = len(ends), start
        result[city] = (best, best_at)
    return result
`,
    ],
    fail: [
      // A start before an end at the same time counts a touching pair as overlapping.
      `from collections import defaultdict


def peak_concurrency(trips):
    points = defaultdict(list)
    for city, start, end in trips:
        points[city].append((start, 1))
        points[city].append((end, -1))
    result = {}
    for city, events in points.items():
        events.sort(key=lambda p: (p[0], -p[1]))
        current = best = 0
        best_at = None
        for ts, delta in events:
            current += delta
            if current > best:
                best, best_at = current, ts
        result[city] = (best, best_at)
    return result
`,
      // >= keeps the last time the peak was reached.
      `from collections import defaultdict


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
            if current >= best and delta == 1:
                best, best_at = current, ts
        result[city] = (best, best_at)
    return result
`,
      // Right, but compares every pair of trips.
      `from collections import defaultdict


def peak_concurrency(trips):
    by_city = defaultdict(list)
    for city, start, end in trips:
        by_city[city].append((start, end))
    result = {}
    for city, items in by_city.items():
        best, best_at = 0, None
        for moment in sorted({start for start, _ in items}):
            count = sum(1 for start, end in items if start <= moment < end)
            if count > best:
                best, best_at = count, moment
        result[city] = (best, best_at)
    return result
`,
      // The time of the peak is missing.
      `from collections import defaultdict


def peak_concurrency(trips):
    points = defaultdict(list)
    for city, start, end in trips:
        points[city] += [(start, 1), (end, -1)]
    result = {}
    for city, events in points.items():
        current = best = 0
        for _, delta in sorted(events):
            current += delta
            best = max(best, current)
        result[city] = best
    return result
`,
    ],
  },

  'k-way-merge-sorted-files': {
    pass: [
      `import heapq


def merge_sorted(files, out):
    out.writelines(heapq.merge(*files, key=lambda line: line[:20]))
`,
      `import heapq


def merge_sorted(files, out):
    iterators = [iter(handle) for handle in files]
    heap = []
    for index, lines in enumerate(iterators):
        line = next(lines, None)
        if line is not None:
            heapq.heappush(heap, (line[:20], index, line))
    while heap:
        _, index, line = heapq.heappop(heap)
        out.write(line)
        line = next(iterators[index], None)
        if line is not None:
            heapq.heappush(heap, (line[:20], index, line))
`,
    ],
    fail: [
      // Reads everything, and sorts by the whole line.
      `def merge_sorted(files, out):
    lines = []
    for handle in files:
        lines.extend(handle.readlines())
    out.writelines(sorted(lines))
`,
      // The right order, but every line is in memory at once.
      `def merge_sorted(files, out):
    lines = [line for handle in files for line in handle]
    lines.sort(key=lambda line: line[:20])
    out.writelines(lines)
`,
      // Never reads past the first line of each file.
      `import heapq


def merge_sorted(files, out):
    heap = []
    for index, handle in enumerate(files):
        line = handle.readline()
        if line:
            heapq.heappush(heap, (line[:20], index, line))
    while heap:
        out.write(heapq.heappop(heap)[2])
`,
      // The heap compares whole lines, so equal timestamps sort by text.
      `import heapq


def merge_sorted(files, out):
    heap = []
    for index, handle in enumerate(files):
        line = handle.readline()
        if line:
            heapq.heappush(heap, (line, index))
    while heap:
        line, index = heapq.heappop(heap)
        out.write(line)
        following = files[index].readline()
        if following:
            heapq.heappush(heap, (following, index))
`,
    ],
  },

  'flatten-nested-events': {
    pass: [
      `def flatten(event):
    flat = {}
    stack = [("", event)]
    while stack:
        prefix, value = stack.pop()
        if isinstance(value, dict):
            for key, child in value.items():
                stack.append((f"{prefix}{key}.", child))
        elif isinstance(value, list) and any(isinstance(item, dict) for item in value):
            for index, child in enumerate(value):
                stack.append((f"{prefix}{index}.", child))
        else:
            flat[prefix[:-1]] = value
    return flat
`,
      `def flatten(event):
    out = {}

    def walk(value, path):
        if isinstance(value, dict):
            for key, child in value.items():
                walk(child, path + (str(key),))
        elif isinstance(value, list) and any(isinstance(item, dict) for item in value):
            for index, child in enumerate(value):
                walk(child, path + (str(index),))
        else:
            out[".".join(path)] = value

    walk(event, ())
    return out
`,
    ],
    fail: [
      // Lists of plain values become indexed keys too.
      `def flatten(value, prefix=""):
    flat = {}
    if isinstance(value, dict):
        for key, child in value.items():
            flat.update(flatten(child, f"{prefix}{key}."))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            flat.update(flatten(child, f"{prefix}{index}."))
    else:
        flat[prefix[:-1]] = value
    return flat
`,
      // The wrong separator.
      `def flatten(value, prefix=""):
    flat = {}
    if isinstance(value, dict):
        for key, child in value.items():
            flat.update(flatten(child, f"{prefix}{key}_"))
    elif isinstance(value, list) and any(isinstance(item, dict) for item in value):
        for index, child in enumerate(value):
            flat.update(flatten(child, f"{prefix}{index}_"))
    else:
        flat[prefix[:-1]] = value
    return flat
`,
      // A list of dicts stays one value.
      `def flatten(value, prefix=""):
    flat = {}
    if isinstance(value, dict):
        for key, child in value.items():
            flat.update(flatten(child, f"{prefix}{key}."))
    else:
        flat[prefix[:-1]] = value
    return flat
`,
      // None values disappear.
      `def flatten(value, prefix=""):
    flat = {}
    if isinstance(value, dict):
        for key, child in value.items():
            flat.update(flatten(child, f"{prefix}{key}."))
    elif isinstance(value, list) and any(isinstance(item, dict) for item in value):
        for index, child in enumerate(value):
            flat.update(flatten(child, f"{prefix}{index}."))
    elif value is not None:
        flat[prefix[:-1]] = value
    return flat
`,
      // The right output, but the event is emptied on the way.
      `def flatten(event, prefix=""):
    flat = {}
    while event:
        key, value = event.popitem()
        if isinstance(value, dict):
            flat.update(flatten(value, f"{prefix}{key}."))
        elif isinstance(value, list) and any(isinstance(item, dict) for item in value):
            for index, child in enumerate(value):
                if isinstance(child, dict):
                    flat.update(flatten(child, f"{prefix}{key}.{index}."))
                else:
                    flat[f"{prefix}{key}.{index}"] = child
        else:
            flat[f"{prefix}{key}"] = value
    return flat
`,
    ],
  },
};

export const PYTHON_ANSWERS: Record<string, SpecAnswers> = {
  ...DATA_ANSWERS,
  ...PYTHON_PRODUCTION_ANSWERS,
  ...PANDAS_ANSWERS,
  ...AI_ANSWERS,
};
