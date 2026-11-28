import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the streaming track: an event-time window with a
 * watermark and allowed lateness, and deduplication with a time to live.
 * Both run on Python 3.14 in the browser, in plain Python, so the learner
 * writes the state handling that a stream processor does underneath.
 */
export const STREAMING_RUNNABLES: Record<string, RunnableSpec> = {
  'event-time-windows-watermark': {
    language: 'python',
    task: `Write «window_counts(events, window_s=60, lateness_s=30)». «events» arrive in this order as «(key, event_ts)», and event times can go back. Count events per key in tumbling event-time windows «[start, start + window_s)», where «start» is a multiple of «window_s». The **watermark** is the largest «event_ts» seen so far minus «lateness_s»; it starts below every time and never goes down. For each event, in order: (1) if its window end is at or below the current watermark, drop it as late; (2) otherwise count it; (3) update the watermark; (4) emit every open window whose end is at or below the watermark. At the end of the input, emit every window still open. Emit each window once, as «(window_start, key, count)», windows closed at the same moment sorted by «window_start», then «key». Return «(emitted, late)», where «late» is the number of dropped events.`,
    setup: `events = [
    ("pune", 5),
    ("delhi", 20),
    ("pune", 61),
    ("pune", 40),
    ("delhi", 95),
    ("pune", 50),
    ("pune", 130),
    ("delhi", 70),
]`,
    starter: `def window_counts(events, window_s=60, lateness_s=30):
    # Return (emitted, late): emitted is a list of (window_start, key, count).
    ...


print(window_counts(events))
`,
    solution: `def window_counts(events, window_s=60, lateness_s=30):
    open_windows = {}            # (window_start, key) -> count
    watermark = float("-inf")
    closed_to = float("-inf")    # every window ending at or before this is emitted
    emitted, late = [], 0

    def close(up_to):
        ready = sorted(w for w in open_windows if w[0] + window_s <= up_to)
        for window in ready:
            emitted.append((window[0], window[1], open_windows.pop(window)))

    for key, ts in events:
        start = ts - ts % window_s
        if start + window_s <= watermark:
            late += 1
            continue
        open_windows[(start, key)] = open_windows.get((start, key), 0) + 1
        watermark = max(watermark, ts - lateness_s)
        # Window ends are multiples of window_s: only a new boundary can close one.
        boundary = watermark - watermark % window_s
        if boundary > closed_to:
            close(boundary)
            closed_to = boundary

    close(float("inf"))
    return emitted, late
`,
    cases: [
      {
        name: 'Sample',
        note: 'Pune at 40 arrives after 61 but the watermark is only 31, so it counts. At 95 the watermark reaches 65 and window 0 closes. Pune at 50 is then late. Delhi at 70 still counts.',
        check: 'window_counts(events)',
      },
      {
        name: 'Exactly on the watermark',
        note: 'After 90 the watermark is 60, so window 0 (end 60) closes, and an event at 59 is late.',
        setup: 'events = [("a", 0), ("a", 90), ("a", 59), ("a", 60)]',
        check: 'window_counts(events)',
      },
      {
        name: 'No lateness allowed',
        hidden: true,
        note: 'With «lateness_s=0» the watermark is the largest time seen.',
        setup:
          'events = [("a", 10), ("b", 59), ("a", 60), ("b", 30), ("b", 61), ("a", 119), ("a", 70)]',
        check: 'window_counts(events, window_s=60, lateness_s=0)',
      },
      {
        name: 'The watermark never goes down',
        hidden: true,
        note: 'An old event lowers nothing: after 200, the watermark stays at 170 even when an event at 100 arrives.',
        setup: 'events = [("k", 200), ("k", 100), ("k", 175), ("k", 150), ("k", 179)]',
        check: 'window_counts(events, window_s=10, lateness_s=30)',
      },
      {
        name: 'No events',
        hidden: true,
        check: 'window_counts([])',
      },
      {
        name: 'Fifty keys, out-of-order stream',
        hidden: true,
        setup: `import random
rng = random.Random(21)
events, clock = [], 0
for _ in range(20_000):
    clock += rng.randrange(0, 4)
    events.append(("k%d" % rng.randrange(50), max(0, clock - rng.choice([0, 0, 0, 5, 20, 45, 90]))))`,
        check: 'window_counts(events, window_s=60, lateness_s=40)',
        limitS: 2,
        slowHint:
          'Do not rescan every event on each step. Keep only the open windows, and close them as the watermark passes their end.',
      },
    ],
  },

  'dedup-with-ttl': {
    language: 'python',
    task: `Write a class «Deduper(ttl_s=600)» with «accept(event_id, ts)». It returns «True» when the event should pass: the id was not accepted in the last «ttl_s» seconds. An id accepted at «t» blocks the same id while «ts < t + ttl_s»; from «t + ttl_s» on, it passes again and its clock restarts. A rejected duplicate does not extend the block. «ts» never goes down. Each call must be fast, and memory must stay in proportion to the ids accepted in the last «ttl_s» seconds: forget an id once its block ends, even if it never comes back.`,
    setup: `events = [("e1", 0), ("e2", 1), ("e1", 5), ("e1", 9), ("e1", 10), ("e2", 12)]`,
    helpers: `def replay(events, **settings):
    deduper = Deduper(**settings)
    return [deduper.accept(event_id, ts) for event_id, ts in events]


def check_forgets_ids(cls):
    import tracemalloc
    deduper = cls(ttl_s=60)
    tracemalloc.start()
    for i in range(60_000):
        deduper.accept("event-%d" % i, i)
    held, _ = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    if held > 2_000_000:
        return verdict(False, "60,000 unique ids arrived, one a second, and your deduper now holds %.1f MB. With a 60-second TTL only about 60 ids matter. Keep a queue of (ts, id) in arrival order and drop expired ids from the front on each call." % (held / 1_000_000))
    return verdict(True)`,
    starter: `class Deduper:
    def __init__(self, ttl_s=600):
        ...

    def accept(self, event_id, ts):
        # Return True when the event is new within the TTL.
        ...


deduper = Deduper(ttl_s=10)
print([deduper.accept(event_id, ts) for event_id, ts in events])
`,
    solution: `from collections import deque


class Deduper:
    def __init__(self, ttl_s=600):
        self.ttl_s = ttl_s
        self.accepted_at = {}    # event_id -> time it was accepted
        self.order = deque()     # (ts, event_id) of every accepted event, oldest first

    def accept(self, event_id, ts):
        # Forget ids whose block has ended, oldest first.
        while self.order and self.order[0][0] + self.ttl_s <= ts:
            old_ts, old_id = self.order.popleft()
            if self.accepted_at.get(old_id) == old_ts:
                del self.accepted_at[old_id]
        if event_id in self.accepted_at:
            return False
        self.accepted_at[event_id] = ts
        self.order.append((ts, event_id))
        return True
`,
    cases: [
      {
        name: 'Sample',
        note: 'A TTL of 10 s. e1 is blocked at 5 and 9, and passes again at 10. e2 passes at 12, 11 s after it was accepted.',
        check: 'replay(events, ttl_s=10)',
      },
      {
        name: 'A duplicate does not extend the block',
        note: 'Rejected copies at 8 and 9 do not move the block: the id passes at 10.',
        setup: 'events = [("x", 0), ("x", 8), ("x", 9), ("x", 10), ("x", 19), ("x", 20)]',
        check: 'replay(events, ttl_s=10)',
      },
      {
        name: 'The default TTL is 600 seconds',
        hidden: true,
        setup: 'events = [("p", 0), ("p", 599), ("p", 600), ("q", 600), ("p", 1199), ("p", 1200)]',
        check: 'replay(events)',
      },
      {
        name: 'Many copies at the same second',
        hidden: true,
        setup: 'events = [("m", 5)] * 4 + [("n", 5)] * 3 + [("m", 15), ("n", 14)]',
        check: 'replay(events, ttl_s=10)',
      },
      {
        name: 'Random ids and retries',
        hidden: true,
        setup: `import random
rng = random.Random(8)
events, ts = [], 0
for _ in range(30_000):
    ts += rng.randrange(0, 3)
    events.append(("id%d" % rng.randrange(400), ts))`,
        check: 'replay(events, ttl_s=120)',
        limitS: 2,
        slowHint:
          'Expire ids from the front of an arrival-ordered queue instead of scanning the whole dict.',
      },
      {
        name: 'Sixty thousand ids come and go',
        hidden: true,
        note: 'Each id arrives once. Memory must not grow with every id ever seen.',
        check: 'check_forgets_ids(Deduper)',
      },
    ],
  },
};
