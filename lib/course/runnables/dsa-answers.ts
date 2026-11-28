import { DSA_GRAPH_ANSWERS } from '@/lib/course/runnables/dsa-graphs-dp-answers';
import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/**
 * Other answers for the DSA track's runnable problems. See `test-answers.ts`.
 * A wrong answer that is only too slow sits last, after the wrong ones.
 */
const ARRAY_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'dsa-pair-with-target': {
    pass: [
      `def pair_with_target(amounts, target):
    order = sorted(range(len(amounts)), key=lambda k: amounts[k])
    lo, hi = 0, len(order) - 1
    while lo < hi:
        total = amounts[order[lo]] + amounts[order[hi]]
        if total == target:
            return order[lo], order[hi]
        if total < target:
            lo += 1
        else:
            hi -= 1
    return None
`,
    ],
    fail: [
      // Lets a payment pair with itself.
      `def pair_with_target(amounts, target):
    seen = {}
    for i, amount in enumerate(amounts):
        seen[amount] = i
        if target - amount in seen:
            return seen[target - amount], i
    return None
`,
      // Checks every pair: right, but too slow for the big list.
      `def pair_with_target(amounts, target):
    for i in range(len(amounts)):
        for j in range(i + 1, len(amounts)):
            if amounts[i] + amounts[j] == target:
                return i, j
    return None
`,
    ],
  },

  'dsa-balanced-brackets': {
    pass: [
      `def is_balanced(text):
    closers = {"(": ")", "[": "]", "{": "}"}
    expect = []
    for ch in text:
        if ch in closers:
            expect.append(closers[ch])
        elif ch in ")]}":
            if not expect or expect.pop() != ch:
                return False
    return len(expect) == 0
`,
    ],
    fail: [
      // Counts each kind, so "([)]" passes.
      `def is_balanced(text):
    counts = {"(": 0, "[": 0, "{": 0}
    partner = {")": "(", "]": "[", "}": "{"}
    for ch in text:
        if ch in counts:
            counts[ch] += 1
        elif ch in partner:
            counts[partner[ch]] -= 1
            if counts[partner[ch]] < 0:
                return False
    return all(count == 0 for count in counts.values())
`,
      // Ignores the kind of bracket.
      `def is_balanced(text):
    depth = 0
    for ch in text:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            if depth == 0:
                return False
            depth -= 1
    return depth == 0
`,
      // Forgets the brackets still open at the end.
      `def is_balanced(text):
    partner = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in text:
        if ch in "([{":
            stack.append(ch)
        elif ch in partner:
            if not stack or stack.pop() != partner[ch]:
                return False
    return True
`,
      // Removes pairs until none is left: right, but O(n²).
      `def is_balanced(text):
    s = "".join(ch for ch in text if ch in "()[]{}")
    while "()" in s or "[]" in s or "{}" in s:
        s = s.replace("()", "").replace("[]", "").replace("{}", "")
    return s == ""
`,
    ],
  },

  'dsa-first-bad-partition': {
    pass: [
      `def first_bad(n, is_bad):
    lo, hi = 0, n
    while lo < hi:
        mid = (lo + hi) // 2
        if is_bad(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
`,
      `from bisect import bisect_left


def first_bad(n, is_bad):
    return bisect_left(range(n), True, key=is_bad)
`,
    ],
    fail: [
      // Returns n - 1 when no partition is bad.
      `def first_bad(n, is_bad):
    lo, hi = 0, n - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if is_bad(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
`,
      // A scan: right, but it calls is_bad up to n times.
      `def first_bad(n, is_bad):
    for i in range(n):
        if is_bad(i):
            return i
    return n
`,
    ],
  },

  'dsa-best-single-trade': {
    pass: [
      `def largest_rise(prices):
    best = current = 0
    for before, after in zip(prices, prices[1:]):
        current = max(0, current + after - before)
        best = max(best, current)
    return best
`,
    ],
    fail: [
      // Ignores the order of the days.
      `def largest_rise(prices):
    return max(prices) - min(prices) if prices else 0
`,
      // Starts below zero, so a falling price gives a negative answer.
      `def largest_rise(prices):
    if len(prices) < 2:
        return 0
    best = prices[1] - prices[0]
    lowest = prices[0]
    for price in prices[1:]:
        best = max(best, price - lowest)
        lowest = min(lowest, price)
    return best
`,
      // Takes the maximum of every later slice: right, but O(n²).
      `def largest_rise(prices):
    best = 0
    for i in range(len(prices) - 1):
        best = max(best, max(prices[i + 1:]) - prices[i])
    return best
`,
    ],
  },

  'dsa-longest-unique-window': {
    pass: [
      `def longest_distinct_run(pages):
    window = set()
    left = best = 0
    for page in pages:
        while page in window:
            window.discard(pages[left])
            left += 1
        window.add(page)
        best = max(best, len(window))
    return best
`,
    ],
    fail: [
      // An old visit outside the window moves the left edge back.
      `def longest_distinct_run(pages):
    last = {}
    left = best = 0
    for right, page in enumerate(pages):
        if page in last:
            left = last[page] + 1
        last[page] = right
        best = max(best, right - left + 1)
    return best
`,
      // Restarts the scan at every position: right, but O(n × window).
      `def longest_distinct_run(pages):
    best = 0
    for i in range(len(pages)):
        seen = set()
        for j in range(i, len(pages)):
            if pages[j] in seen:
                break
            seen.add(pages[j])
        best = max(best, len(seen))
    return best
`,
    ],
  },

  'dsa-subarray-sum-k': {
    pass: [
      `def count_periods(changes, k):
    counts = {0: 1}
    total = found = 0
    for change in changes:
        total += change
        found += counts.get(total - k, 0)
        counts[total] = counts.get(total, 0) + 1
    return found
`,
    ],
    fail: [
      // Forgets the empty prefix, so periods from hour 0 are missed.
      `from collections import defaultdict


def count_periods(changes, k):
    seen = defaultdict(int)
    total = count = 0
    for change in changes:
        total += change
        count += seen[total - k]
        seen[total] += 1
    return count
`,
      // Stores the sum before it counts, so k = 0 counts empty periods.
      `from collections import defaultdict


def count_periods(changes, k):
    seen = defaultdict(int)
    seen[0] = 1
    total = count = 0
    for change in changes:
        total += change
        seen[total] += 1
        count += seen[total - k]
    return count
`,
      // A sliding window: only right when every change is positive.
      `def count_periods(changes, k):
    count = left = total = 0
    for right, change in enumerate(changes):
        total += change
        while total > k and left <= right:
            total -= changes[left]
            left += 1
        if total == k:
            count += 1
    return count
`,
      // Sums every period: right, but O(n²).
      `def count_periods(changes, k):
    count = 0
    for i in range(len(changes)):
        total = 0
        for j in range(i, len(changes)):
            total += changes[j]
            if total == k:
                count += 1
    return count
`,
    ],
  },

  'dsa-group-anagram-keys': {
    pass: [
      // Returns the dict's values view, which the tests read like a list.
      `def group_anagrams(words):
    groups = {}
    for word in words:
        groups.setdefault("".join(sorted(word)), []).append(word)
    return groups.values()
`,
    ],
    fail: [
      // Keys on the set of letters, so "aab" joins "abb".
      `def group_anagrams(words):
    groups = {}
    for word in words:
        groups.setdefault(frozenset(word), []).append(word)
    return list(groups.values())
`,
      // Drops repeated words.
      `def group_anagrams(words):
    groups = {}
    for word in set(words):
        groups.setdefault("".join(sorted(word)), []).append(word)
    return list(groups.values())
`,
      // Compares each word with every group: right, but O(n²).
      `def group_anagrams(words):
    groups = []
    for word in words:
        for group in groups:
            if sorted(group[0]) == sorted(word):
                group.append(word)
                break
        else:
            groups.append([word])
    return groups
`,
    ],
  },

  'dsa-product-except-self': {
    pass: [
      `def product_except_self(nums):
    n = len(nums)
    left = [1] * n
    right = [1] * n
    for i in range(1, n):
        left[i] = left[i - 1] * nums[i - 1]
    for i in range(n - 2, -1, -1):
        right[i] = right[i + 1] * nums[i + 1]
    return [left[i] * right[i] for i in range(n)]
`,
    ],
    fail: [
      // Divides the total: fails on 0, and division is ruled out.
      `import math


def product_except_self(nums):
    total = math.prod(nums)
    return [total // value for value in nums]
`,
      // Divides, with the zeros handled: right values, but it divides.
      `def product_except_self(nums):
    zeros = nums.count(0)
    product = 1
    for value in nums:
        if value != 0:
            product *= value
    if zeros > 1:
        return [0] * len(nums)
    if zeros == 1:
        return [product if value == 0 else 0 for value in nums]
    return [product // value for value in nums]
`,
      // Multiplies the other values for each position: right, but O(n²).
      `import math


def product_except_self(nums):
    return [math.prod(nums[:i] + nums[i + 1:]) for i in range(len(nums))]
`,
    ],
  },

  'dsa-next-higher-latency': {
    pass: [
      `def minutes_until_higher(latency):
    wait = [0] * len(latency)
    stack = []
    for i in range(len(latency) - 1, -1, -1):
        while stack and latency[stack[-1]] <= latency[i]:
            stack.pop()
        if stack:
            wait[i] = stack[-1] - i
        stack.append(i)
    return wait
`,
    ],
    fail: [
      // Treats an equal value as higher.
      `def minutes_until_higher(latency):
    wait = [0] * len(latency)
    stack = []
    for i, value in enumerate(latency):
        while stack and latency[stack[-1]] <= value:
            j = stack.pop()
            wait[j] = i - j
        stack.append(i)
    return wait
`,
      // Scans forward from every minute: right, but O(n²).
      `def minutes_until_higher(latency):
    wait = [0] * len(latency)
    for i in range(len(latency)):
        for j in range(i + 1, len(latency)):
            if latency[j] > latency[i]:
                wait[i] = j - i
                break
    return wait
`,
    ],
  },

  'dsa-window-maximum': {
    pass: [
      `import heapq


def window_maximums(readings, k):
    heap, result = [], []
    for i, value in enumerate(readings):
        heapq.heappush(heap, (-value, i))
        while heap[0][1] <= i - k:
            heapq.heappop(heap)
        if i >= k - 1:
            result.append(-heap[0][0])
    return result
`,
    ],
    fail: [
      // Never drops a maximum that has left the window.
      `from collections import deque


def window_maximums(readings, k):
    result = []
    candidates = deque()
    for i, value in enumerate(readings):
        while candidates and readings[candidates[-1]] <= value:
            candidates.pop()
        candidates.append(i)
        if i >= k - 1:
            result.append(readings[candidates[0]])
    return result
`,
      // Takes max() of every window: right, but O(n × k).
      `def window_maximums(readings, k):
    return [max(readings[i:i + k]) for i in range(len(readings) - k + 1)]
`,
    ],
  },

  'dsa-kth-largest-stream': {
    pass: [
      `from bisect import insort


class KthLargest:
    def __init__(self, k):
        self.k = k
        self.top = []

    def add(self, value):
        insort(self.top, value)
        if len(self.top) > self.k:
            self.top.pop(0)
        return self.top[0] if len(self.top) == self.k else None
`,
    ],
    fail: [
      // Returns the smallest so far before k values arrive.
      `import heapq


class KthLargest:
    def __init__(self, k):
        self.k = k
        self.heap = []

    def add(self, value):
        heapq.heappush(self.heap, value)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0]
`,
      // One heap on the class, shared by every tracker.
      `import heapq


class KthLargest:
    heap = []

    def __init__(self, k):
        self.k = k

    def add(self, value):
        heapq.heappush(self.heap, value)
        if len(self.heap) > self.k:
            heapq.heappop(self.heap)
        return self.heap[0] if len(self.heap) == self.k else None
`,
      // Keeps every value and sorts on each add: memory grows forever.
      `class KthLargest:
    def __init__(self, k):
        self.k = k
        self.values = []

    def add(self, value):
        self.values.append(value)
        if len(self.values) < self.k:
            return None
        return sorted(self.values, reverse=True)[self.k - 1]
`,
    ],
  },

  'dsa-running-median': {
    pass: [
      `import heapq


class RunningMedian:
    def __init__(self):
        self.small, self.large = [], []

    def add(self, value):
        if self.small and value > -self.small[0]:
            heapq.heappush(self.large, value)
        else:
            heapq.heappush(self.small, -value)
        if len(self.small) > len(self.large) + 1:
            heapq.heappush(self.large, -heapq.heappop(self.small))
        elif len(self.large) > len(self.small):
            heapq.heappush(self.small, -heapq.heappop(self.large))
        if len(self.small) > len(self.large):
            return -self.small[0]
        return (-self.small[0] + self.large[0]) / 2
`,
    ],
    fail: [
      // O(n) per add: insort shifts half the list each time, too slow at 400,000 adds.
      `from bisect import insort


class RunningMedian:
    def __init__(self):
        self.values = []

    def add(self, value):
        insort(self.values, value)
        n = len(self.values)
        middle = n // 2
        if n % 2:
            return self.values[middle]
        return (self.values[middle - 1] + self.values[middle]) / 2
`,
      // Never moves values between the heaps.
      `import heapq


class RunningMedian:
    def __init__(self):
        self.low, self.high = [], []

    def add(self, value):
        if not self.low or value <= -self.low[0]:
            heapq.heappush(self.low, -value)
        else:
            heapq.heappush(self.high, value)
        if len(self.low) > len(self.high):
            return -self.low[0]
        return (-self.low[0] + self.high[0]) / 2
`,
      // Floor division drops the half.
      `import heapq


class RunningMedian:
    def __init__(self):
        self.low, self.high = [], []

    def add(self, value):
        heapq.heappush(self.low, -value)
        heapq.heappush(self.high, -heapq.heappop(self.low))
        if len(self.high) > len(self.low):
            heapq.heappush(self.low, -heapq.heappop(self.high))
        if len(self.low) > len(self.high):
            return -self.low[0]
        return (-self.low[0] + self.high[0]) // 2
`,
      // Sorts every value on each add: right, but O(n log n) per add.
      `class RunningMedian:
    def __init__(self):
        self.values = []

    def add(self, value):
        self.values.append(value)
        ordered = sorted(self.values)
        n = len(ordered)
        if n % 2:
            return ordered[n // 2]
        return (ordered[n // 2 - 1] + ordered[n // 2]) / 2
`,
    ],
  },

  'dsa-rotated-log-search': {
    pass: [
      // Finds the turn, then searches the sorted order it hides.
      `def search_rotated(nums, target):
    n = len(nums)
    if n == 0:
        return -1
    lo, hi = 0, n - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] > nums[hi]:
            lo = mid + 1
        else:
            hi = mid
    turn = lo
    lo, hi = 0, n - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        real = (mid + turn) % n
        if nums[real] == target:
            return real
        if nums[real] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`,
    ],
    fail: [
      // "<" where "<=" is needed: wrong when lo and mid are the same index.
      `def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] < nums[mid]:
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
`,
      // Leaves nums[lo] itself out of the sorted half.
      `def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:
            if nums[lo] < target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
`,
      // A scan: right, but it reads every entry.
      `def search_rotated(nums, target):
    return nums.index(target) if target in nums else -1
`,
    ],
  },

  'dsa-smallest-batch-size': {
    pass: [
      `from bisect import bisect_left


def smallest_batch_size(sizes, runs):
    def fits(limit):
        count, current = 1, 0
        for size in sizes:
            if current + size > limit:
                count += 1
                current = 0
            current += size
        return count <= runs

    lo = max(sizes)
    return lo + bisect_left(range(lo, sum(sizes) + 1), True, key=fits)
`,
    ],
    fail: [
      // Starts below the largest file, which no batch can split.
      `def smallest_batch_size(sizes, runs):
    def runs_needed(limit):
        count, current = 1, 0
        for size in sizes:
            if current + size > limit:
                count += 1
                current = 0
            current += size
        return count

    lo, hi = 1, sum(sizes)
    while lo < hi:
        mid = (lo + hi) // 2
        if runs_needed(mid) <= runs:
            hi = mid
        else:
            lo = mid + 1
    return lo
`,
      // ">=" where ">" is needed: a run may fill the batch exactly.
      `def smallest_batch_size(sizes, runs):
    def runs_needed(limit):
        count, current = 1, 0
        for size in sizes:
            if current + size >= limit:
                count += 1
                current = 0
            current += size
        return count

    lo, hi = max(sizes), sum(sizes)
    while lo < hi:
        mid = (lo + hi) // 2
        if runs_needed(mid) <= runs:
            hi = mid
        else:
            lo = mid + 1
    return lo
`,
      // Tries every size upward: right, but O(n × range).
      `def smallest_batch_size(sizes, runs):
    def runs_needed(limit):
        count, current = 1, 0
        for size in sizes:
            if current + size > limit:
                count += 1
                current = 0
            current += size
        return count

    limit = max(sizes)
    while runs_needed(limit) > runs:
        limit += 1
    return limit
`,
    ],
  },
};

export const DSA_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  ...ARRAY_ANSWERS,
  ...DSA_GRAPH_ANSWERS,
};
