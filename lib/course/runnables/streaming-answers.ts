import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/** Other answers for the streaming problems. See `test-answers.ts`. */
export const STREAMING_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'event-time-windows-watermark': {
    pass: [
      `import heapq
from collections import Counter


def window_counts(events, window_s=60, lateness_s=30):
    counts = Counter()
    ends = []
    watermark = None
    emitted, late = [], 0

    def emit_until(limit):
        ready = set()
        while ends and (limit is None or ends[0][0] <= limit):
            end, key = heapq.heappop(ends)
            ready.add((end - window_s, key))
        for start, key in sorted(ready):
            emitted.append((start, key, counts.pop((start, key))))

    for key, ts in events:
        start = (ts // window_s) * window_s
        if watermark is not None and start + window_s <= watermark:
            late += 1
            continue
        if (start, key) not in counts:
            heapq.heappush(ends, (start + window_s, key))
        counts[(start, key)] += 1
        mark = ts - lateness_s
        watermark = mark if watermark is None else max(watermark, mark)
        emit_until(watermark)
    emit_until(None)
    return emitted, late
`,
    ],
    fail: [
      // The watermark follows the last event, so it goes down after an old event.
      `def window_counts(events, window_s=60, lateness_s=30):
    open_windows, emitted, late = {}, [], 0
    watermark = float("-inf")
    for key, ts in events:
        start = ts - ts % window_s
        if start + window_s <= watermark:
            late += 1
            continue
        open_windows[(start, key)] = open_windows.get((start, key), 0) + 1
        watermark = ts - lateness_s
        for w in sorted(w for w in open_windows if w[0] + window_s <= watermark):
            emitted.append((w[0], w[1], open_windows.pop(w)))
    for w in sorted(open_windows):
        emitted.append((w[0], w[1], open_windows[w]))
    return emitted, late
`,
      // Drops an event only when its window end is strictly below the watermark.
      `def window_counts(events, window_s=60, lateness_s=30):
    open_windows, emitted, late = {}, [], 0
    watermark = float("-inf")
    for key, ts in events:
        start = ts - ts % window_s
        if start + window_s < watermark:
            late += 1
            continue
        open_windows[(start, key)] = open_windows.get((start, key), 0) + 1
        watermark = max(watermark, ts - lateness_s)
        for w in sorted(w for w in open_windows if w[0] + window_s <= watermark):
            emitted.append((w[0], w[1], open_windows.pop(w)))
    for w in sorted(open_windows):
        emitted.append((w[0], w[1], open_windows[w]))
    return emitted, late
`,
      // Never flushes the windows still open at the end of the input.
      `def window_counts(events, window_s=60, lateness_s=30):
    open_windows, emitted, late = {}, [], 0
    watermark = float("-inf")
    for key, ts in events:
        start = ts - ts % window_s
        if start + window_s <= watermark:
            late += 1
            continue
        open_windows[(start, key)] = open_windows.get((start, key), 0) + 1
        watermark = max(watermark, ts - lateness_s)
        for w in sorted(w for w in open_windows if w[0] + window_s <= watermark):
            emitted.append((w[0], w[1], open_windows.pop(w)))
    return emitted, late
`,
      // Emits windows in the order they opened, not sorted by start and key.
      `def window_counts(events, window_s=60, lateness_s=30):
    open_windows, emitted, late = {}, [], 0
    watermark = float("-inf")
    for key, ts in events:
        start = ts - ts % window_s
        if start + window_s <= watermark:
            late += 1
            continue
        open_windows[(start, key)] = open_windows.get((start, key), 0) + 1
        watermark = max(watermark, ts - lateness_s)
        for w in [w for w in open_windows if w[0] + window_s <= watermark]:
            emitted.append((w[0], w[1], open_windows.pop(w)))
    for w in list(open_windows):
        emitted.append((w[0], w[1], open_windows.pop(w)))
    return emitted, late
`,
    ],
  },
  'dedup-with-ttl': {
    pass: [
      `from collections import OrderedDict


class Deduper:
    def __init__(self, ttl_s=600):
        self.ttl_s = ttl_s
        self.live = OrderedDict()   # accepted ids in accept order

    def accept(self, event_id, ts):
        while self.live:
            oldest, at = next(iter(self.live.items()))
            if at + self.ttl_s > ts:
                break
            self.live.popitem(last=False)
        if event_id in self.live:
            return False
        self.live[event_id] = ts
        return True
`,
    ],
    fail: [
      // A rejected duplicate restarts the block.
      `class Deduper:
    def __init__(self, ttl_s=600):
        self.ttl_s = ttl_s
        self.last = {}

    def accept(self, event_id, ts):
        seen = self.last.get(event_id)
        self.last[event_id] = ts
        return seen is None or ts - seen >= self.ttl_s
`,
      // Correct answers, but every id ever seen stays in memory.
      `class Deduper:
    def __init__(self, ttl_s=600):
        self.ttl_s = ttl_s
        self.accepted_at = {}

    def accept(self, event_id, ts):
        at = self.accepted_at.get(event_id)
        if at is not None and ts < at + self.ttl_s:
            return False
        self.accepted_at[event_id] = ts
        return True
`,
      // Blocks one second too long: the id should pass again at t + ttl_s.
      `from collections import deque


class Deduper:
    def __init__(self, ttl_s=600):
        self.ttl_s = ttl_s
        self.accepted_at = {}
        self.order = deque()

    def accept(self, event_id, ts):
        while self.order and self.order[0][0] + self.ttl_s < ts:
            old_ts, old_id = self.order.popleft()
            if self.accepted_at.get(old_id) == old_ts:
                del self.accepted_at[old_id]
        if event_id in self.accepted_at:
            return False
        self.accepted_at[event_id] = ts
        self.order.append((ts, event_id))
        return True
`,
    ],
  },
};
