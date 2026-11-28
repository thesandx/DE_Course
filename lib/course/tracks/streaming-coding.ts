import type { Problem } from '@/types/course';

/**
 * Runnable streaming problems: the state a stream processor keeps, written
 * by hand. They join the streaming track in `streaming.ts`. The specs are in
 * `lib/course/runnables/streaming.ts`.
 */
export const streamingCodingProblems: readonly Problem[] = [
  {
    slug: 'event-time-windows-watermark',
    title: 'Event-time windows with a watermark',
    track: 'streaming',
    kind: 'coding',
    difficulty: 'hard',
    companies: ['uber', 'google', 'meta', 'swiggy', 'phonepe'],
    prompt: `
      Events arrive out of order. Count events per key in one-minute tumbling windows of **event
      time**, allow 30 seconds of lateness with a watermark, drop events that arrive after their
      window has closed, and emit each window once when it closes. Write it in plain Python, the
      way Flink or Spark does it underneath.
    `,
    hints: [
      'The window of an event is its time rounded down to a multiple of the window size.',
      'The watermark is the largest event time seen, minus the lateness. It never goes down.',
      'Keep only open windows in memory. Close every window whose end the watermark has passed.',
    ],
    answer: `
      Keep a dict of **open windows** keyed by «(start, key)». The watermark decides two things:
      which events are late, and which windows close.

      ~~~python
      def window_counts(events, window_s=60, lateness_s=30):
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
      ~~~

      Order matters: check lateness against the watermark **before** this event moves it, then
      count, then advance, then close. Window ends are multiples of «window_s», so a window can
      only close when the watermark crosses a new boundary; checking only then keeps each event
      cheap. Memory holds only the open windows, about (lateness ÷ window + 1) per key.

      In Spark Structured Streaming this is «withWatermark("event_ts", "30 seconds")» and
      «groupBy(window("event_ts", "1 minute"), "key")» in append mode. In Flink it is a
      bounded-out-of-orderness watermark strategy with a tumbling event-time window. Late events
      are counted, not silently lost: in production, send them to a side output.
    `,
    signals: [
      'Assigns windows from event time, not arrival time',
      'Keeps the watermark monotonic',
      'Checks lateness before advancing the watermark',
      'Emits each window once, in a stable order, and flushes at the end',
      'Keeps only open windows in memory and maps it to Spark or Flink',
    ],
    followUps: [
      'Product wants a correction when a late event arrives instead of dropping it. What changes?',
      'One key has no events for an hour. Does its last window ever close?',
    ],
  },
  {
    slug: 'dedup-with-ttl',
    title: 'Deduplicate a stream with a time to live',
    track: 'streaming',
    kind: 'coding',
    difficulty: 'medium',
    companies: ['uber', 'amazon', 'phonepe', 'flipkart', 'meta'],
    prompt: `
      A payment stream is at-least-once: retries resend the same event id, usually within a few
      minutes. Write a deduper that passes the first copy of each id and drops copies within a
      time to live. Memory must not grow with every id ever seen.
    `,
    hints: [
      'A dict from id to the time it was accepted answers "is this a copy?".',
      'The dict grows forever unless something removes old ids.',
      'Ids expire in the order they were accepted. A queue in that order lets you drop them from the front.',
    ],
    answer: `
      A dict answers the question, and a queue in **accept order** lets you forget expired ids
      without scanning the dict.

      ~~~python
      from collections import deque


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
      ~~~

      A rejected copy does not move the block: otherwise an id that retries every minute is
      blocked forever. The check «accepted_at.get(old_id) == old_ts» matters when an id was
      accepted again after it expired, so an old queue entry does not delete the new one. Each
      call does amortised O(1) work, and memory is in proportion to the ids accepted in the last
      TTL.

      In Spark Structured Streaming this is «dropDuplicatesWithinWatermark("event_id")» with a
      watermark, and in Flink a keyed state with a state TTL. Say the trade-off: a TTL shorter than
      the longest retry lets a duplicate through, so pick it from the retry policy and measure the
      duplicates that still pass downstream.
    `,
    signals: [
      'Uses a dict for lookups and an ordered queue for expiry',
      'Does not let a rejected copy extend the block',
      'Gets the boundary right at exactly t + ttl',
      'Keeps memory bounded and says the cost per call',
      'Chooses the TTL from the retry policy and maps it to a stream engine',
    ],
    followUps: [
      'There are 2 billion ids a day across 50 machines. Where does this state live?',
      'The job restarts. How do you avoid passing duplicates after the restart?',
    ],
  },
];
