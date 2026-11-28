import { DSA_GRAPH_RUNNABLES } from '@/lib/course/runnables/dsa-graphs-dp';
import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the DSA track. Each runs on Python 3.14 in the browser.
 * This file holds hash maps, windows, stacks, heaps and binary search;
 * `dsa-graphs-dp.ts` holds trees, graphs, dynamic programming and design.
 *
 * A case with `limitS` fails a correct answer that is too slow, so the
 * learner meets the complexity bar the interviewer sets. Each big case is
 * sized so that the expected answer takes a few milliseconds and the usual
 * brute force takes seconds: a right answer passes on a slow phone, and a
 * brute force fails on a fast laptop. Big inputs use their own names, such
 * as `big_prices`, so the learner's own `print` of the sample stays quick.
 */
const ARRAY_RUNNABLES: Record<string, RunnableSpec> = {
  'dsa-pair-with-target': {
    language: 'python',
    task: `Write «pair_with_target(amounts, target)». Return the indexes «(i, j)» of two different payments with «amounts[i] + amounts[j] == target», or «None» if no pair exists. Any valid pair passes. It must stay fast on large lists.`,
    setup: `amounts = [120, 450, 300, 80, 330]
target = 410`,
    helpers: `def check_pair(fn, amounts, target):
    data = list(amounts)
    got = fn(data, target)
    if data != list(amounts):
        return verdict(False, "Your function changed the input list. Leave it as it is.")
    want = None
    seen = {}
    for j, amount in enumerate(amounts):
        if target - amount in seen:
            want = (seen[target - amount], j)
            break
        seen[amount] = j
    if want is None:
        if got is None:
            return verdict(True)
        return verdict(False, f"No two payments sum to {target}, so the answer is None. You returned {got!r}.")
    if got is None:
        return verdict(False, f"Expected a pair such as {want}: {amounts[want[0]]} + {amounts[want[1]]} = {target}. You returned None.")
    try:
        i, j = got
    except (TypeError, ValueError):
        return verdict(False, f"Return a pair of indexes like (3, 4). You returned {got!r}.")
    if not all(isinstance(k, int) for k in (i, j)):
        return verdict(False, f"Return indexes, not amounts. You returned {got!r}.")
    if i == j:
        return verdict(False, f"({i}, {j}) uses the same payment twice.")
    if not (0 <= i < len(amounts) and 0 <= j < len(amounts)):
        return verdict(False, f"{got!r} is outside the list.")
    if amounts[i] + amounts[j] != target:
        return verdict(False, f"amounts[{i}] + amounts[{j}] = {amounts[i] + amounts[j]}, not {target}.")
    return verdict(True)`,
    starter: `def pair_with_target(amounts, target):
    # Return (i, j) with amounts[i] + amounts[j] == target, or None.
    ...


print(pair_with_target(amounts, target))
`,
    solution: `def pair_with_target(amounts, target):
    seen = {}
    for i, amount in enumerate(amounts):
        need = target - amount
        if need in seen:
            return seen[need], i
        seen[amount] = i
    return None
`,
    cases: [
      {
        name: 'Sample',
        note: '80 + 330 = 410.',
        check: 'check_pair(pair_with_target, amounts, target)',
      },
      {
        name: 'Two equal payments',
        note: 'Two payments of 50 make a refund of 100.',
        setup: 'amounts = [50, 20, 50]\ntarget = 100',
        check: 'check_pair(pair_with_target, amounts, target)',
      },
      {
        name: 'One payment is not a pair',
        note: 'A single payment of 100 does not count twice.',
        setup: 'amounts = [100, 7, 13]\ntarget = 200',
        check: 'check_pair(pair_with_target, amounts, target)',
      },
      {
        name: 'Empty list',
        setup: 'amounts = []\ntarget = 10',
        check: 'check_pair(pair_with_target, amounts, target)',
      },
      {
        name: 'Negative amounts',
        hidden: true,
        note: 'A reversal is a negative amount.',
        setup: 'amounts = [-40, 15, 90, -5]\ntarget = 50',
        check: 'check_pair(pair_with_target, amounts, target)',
      },
      {
        name: 'Twelve thousand payments, no pair',
        hidden: true,
        note: 'Checking every pair takes seconds here; one pass takes milliseconds.',
        setup: 'big_amounts = list(range(1, 24001, 2))',
        check: 'check_pair(pair_with_target, big_amounts, 7)',
        limitS: 0.5,
        slowHint:
          'Checking every pair is O(n²). Remember the amounts you have seen in a dict, so each lookup is O(1).',
      },
    ],
  },

  'dsa-balanced-brackets': {
    language: 'python',
    task: `Write «is_balanced(text)». Return «True» when every bracket in «text» closes in the right order, and «False» when one does not. The brackets are «( )», «[ ]» and «{ }»; ignore every other character. It must stay fast on a long file.`,
    setup: `text = "{cfg: [a(1), b(2)]}"`,
    starter: `def is_balanced(text):
    # Return True when every bracket closes in the right order.
    ...


print(is_balanced(text))
`,
    solution: `def is_balanced(text):
    partner = {")": "(", "]": "[", "}": "{"}
    opens = set(partner.values())
    stack = []
    for ch in text:
        if ch in opens:
            stack.append(ch)
        elif ch in partner:
            if not stack or stack.pop() != partner[ch]:
                return False
    return not stack
`,
    cases: [
      { name: 'Sample', note: 'Every bracket closes in order.', check: 'is_balanced(text)' },
      {
        name: 'Wrong kind',
        note: '«]» cannot close «(».',
        setup: 'text = "(]"',
        check: 'is_balanced(text)',
      },
      {
        name: 'Wrong order',
        note: '«[» opened last, so it must close first.',
        setup: 'text = "([)]"',
        check: 'is_balanced(text)',
      },
      {
        name: 'Left open',
        note: 'A bracket that is still open at the end fails.',
        setup: 'text = "{[]"',
        check: 'is_balanced(text)',
      },
      {
        name: 'Close with nothing open',
        hidden: true,
        note: 'The counts match, but «)» comes before its «(».',
        setup: 'text = "())("',
        check: 'is_balanced(text)',
      },
      {
        name: 'No brackets',
        hidden: true,
        note: 'Text with no brackets is balanced.',
        setup: 'text = "port: 8080"',
        check: 'is_balanced(text)',
      },
      {
        name: 'Empty text',
        hidden: true,
        setup: 'text = ""',
        check: 'is_balanced(text)',
      },
      {
        name: 'A long config file',
        hidden: true,
        note: '60,000 nested brackets.',
        setup: 'big_text = "([{" * 10_000 + "}])" * 10_000',
        check: 'is_balanced(big_text)',
        limitS: 1,
        slowHint:
          'Removing pairs with replace() scans the whole text again for every pair: O(n²). Push each open bracket on a stack and check each close bracket against the top: one pass, O(n).',
      },
    ],
  },

  'dsa-first-bad-partition': {
    language: 'python',
    task: `Write «first_bad(n, is_bad)». The partitions are numbered «0» to «n - 1», and every partition from the first bad one on is bad. «is_bad(i)» runs a slow validation query and returns «True» or «False». Return the number of the first bad partition, or «n» when none is bad. The tests count your calls: use about «log₂ n» of them.`,
    setup: `n = 1095  # three years of daily partitions


def is_bad(i):
    # A slow validation query in real life. Here the bug started on day 1000.
    return i >= 1000`,
    helpers: `def check_first_bad(fn, *scenarios):
    for n, first in scenarios:
        calls = []

        def probe(i, n=n, first=first, calls=calls):
            if not isinstance(i, int) or isinstance(i, bool):
                raise TypeError(f"is_bad() takes a partition number, not {i!r}.")
            if not 0 <= i < n:
                raise IndexError(f"is_bad({i}) is outside the partitions 0 to {n - 1}.")
            calls.append(i)
            return i >= first

        got = fn(n, probe)
        where = f"With n = {n}"
        if got != first:
            if first == n:
                return verdict(False, f"{where}, no partition is bad, so return n = {n}. You returned {got!r}.")
            return verdict(False, f"{where}, the first bad partition is {first}. You returned {got!r}.")
        budget = max(1, n.bit_length()) + 1
        if len(calls) > budget:
            return verdict(False, f"{where} you called is_bad {len(calls)} times. Binary search needs at most {budget}.")
    return verdict(True)`,
    starter: `def first_bad(n, is_bad):
    # Return the first i with is_bad(i), or n. Call is_bad as few times as you can.
    ...


print(first_bad(n, is_bad))
`,
    solution: `def first_bad(n, is_bad):
    lo, hi = 0, n - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if is_bad(mid):
            hi = mid - 1
        else:
            lo = mid + 1
    return lo
`,
    cases: [
      {
        name: 'Sample',
        note: 'The bug started on day 1000 of 1,095.',
        check: 'check_first_bad(first_bad, (1095, 1000))',
      },
      {
        name: 'Bad from the first day',
        note: 'Partition 0 is already bad.',
        check: 'check_first_bad(first_bad, (10, 0))',
      },
      {
        name: 'No bad partition',
        note: 'Return n when every partition is good.',
        check: 'check_first_bad(first_bad, (10, 10))',
      },
      {
        name: 'Only the last one',
        hidden: true,
        check: 'check_first_bad(first_bad, (1000, 999))',
      },
      {
        name: 'One partition, or none',
        hidden: true,
        note: 'With n = 0 there is nothing to check, and the answer is 0.',
        check: 'check_first_bad(first_bad, (1, 0), (1, 1), (0, 0))',
      },
      {
        name: 'Every boundary',
        hidden: true,
        note: 'Every n up to 40, with every first bad day.',
        check: 'check_first_bad(first_bad, *[(n, f) for n in range(1, 41) for f in range(n + 1)])',
      },
      {
        name: 'Ten years of hourly partitions',
        hidden: true,
        note: '87,600 partitions: a scan makes tens of thousands of calls.',
        check: 'check_first_bad(first_bad, (87600, 54321))',
      },
    ],
  },

  'dsa-best-single-trade': {
    language: 'python',
    task: `Write «largest_rise(prices)». «prices[i]» is the price at the end of day «i». Return the largest rise from an earlier day to a later day: the largest «prices[j] - prices[i]» with «i < j». Return «0» when the price never rises, and for fewer than two days. It must stay fast on a long history.`,
    setup: `prices = [7, 1, 5, 3, 6, 4]`,
    starter: `def largest_rise(prices):
    # Return the largest prices[j] - prices[i] with i < j, or 0.
    ...


print(largest_rise(prices))
`,
    solution: `def largest_rise(prices):
    best = 0
    lowest = float("inf")
    for price in prices:
        lowest = min(lowest, price)
        best = max(best, price - lowest)
    return best
`,
    cases: [
      {
        name: 'Sample',
        note: 'Buy at 1 on day 1, sell at 6 on day 4.',
        check: 'largest_rise(prices)',
      },
      {
        name: 'Price only falls',
        note: 'There is no rise: return 0, not a negative number.',
        setup: 'prices = [9, 7, 4, 1]',
        check: 'largest_rise(prices)',
      },
      {
        name: 'Lowest price comes last',
        note: 'The lowest price is on the last day, so no rise can start there.',
        setup: 'prices = [3, 8, 2, 9, 1]',
        check: 'largest_rise(prices)',
      },
      { name: 'One day', hidden: true, setup: 'prices = [5]', check: 'largest_rise(prices)' },
      { name: 'No days', hidden: true, setup: 'prices = []', check: 'largest_rise(prices)' },
      {
        name: 'Prices with cents',
        hidden: true,
        setup: 'prices = [10.5, 10.25, 11.75, 9.0, 10.0]',
        check: 'largest_rise(prices)',
      },
      {
        name: 'Twenty thousand days',
        hidden: true,
        setup: `import random
rng = random.Random(7)
big_prices = [rng.randint(1, 10_000) for _ in range(20_000)]`,
        check: 'largest_rise(big_prices)',
        limitS: 1,
        slowHint:
          'Comparing every pair of days is O(n²). Keep the lowest price seen so far: one pass, O(n).',
      },
    ],
  },

  'dsa-longest-unique-window': {
    language: 'python',
    task: `Write «longest_distinct_run(pages)». «pages» lists page ids in visit order. Return the length of the longest contiguous run in which no page repeats, or «0» for an empty session. It must stay fast on a long session.`,
    setup: `pages = ["home", "search", "item", "search", "cart", "pay", "home"]`,
    starter: `def longest_distinct_run(pages):
    # Return the length of the longest run with no repeated page.
    ...


print(longest_distinct_run(pages))
`,
    solution: `def longest_distinct_run(pages):
    last = {}
    left = best = 0
    for right, page in enumerate(pages):
        if page in last and last[page] >= left:
            left = last[page] + 1
        last[page] = right
        best = max(best, right - left + 1)
    return best
`,
    cases: [
      {
        name: 'Sample',
        note: '«item, search, cart, pay, home» has five different pages.',
        check: 'longest_distinct_run(pages)',
      },
      {
        name: 'All the same page',
        setup: 'pages = ["home"] * 4',
        check: 'longest_distinct_run(pages)',
      },
      {
        name: 'An old visit outside the window',
        note: 'When «a» repeats, its first visit is already outside the window. It must not move the left edge back.',
        setup: 'pages = ["a", "b", "b", "a"]',
        check: 'longest_distinct_run(pages)',
      },
      {
        name: 'No repeats',
        hidden: true,
        setup: 'pages = list("abcdef")',
        check: 'longest_distinct_run(pages)',
      },
      {
        name: 'Empty session',
        hidden: true,
        setup: 'pages = []',
        check: 'longest_distinct_run(pages)',
      },
      {
        name: 'Number ids',
        hidden: true,
        setup: 'pages = [1, 2, 3, 1, 2, 3, 4, 5, 1]',
        check: 'longest_distinct_run(pages)',
      },
      {
        name: 'Random sessions',
        hidden: true,
        setup: `import random
rng = random.Random(3)
pages = [rng.randrange(40) for _ in range(3_000)]`,
        check: 'longest_distinct_run(pages)',
      },
      {
        name: 'A long session',
        hidden: true,
        note: '30,000 visits that cycle through 1,500 pages.',
        setup: 'big_pages = [f"p{i % 1500}" for i in range(30_000)]',
        check: 'longest_distinct_run(big_pages)',
        limitS: 1,
        slowHint:
          'Restarting the scan at every position is O(n × window). Keep the last index of each page and move only the left edge forward: O(n).',
      },
    ],
  },

  'dsa-subarray-sum-k': {
    language: 'python',
    task: `Write «count_periods(changes, k)». «changes» holds the net stock change of each hour; values can be negative. Return how many contiguous periods of one hour or more have a total change of exactly «k». It must stay fast on a long history.`,
    setup: `changes = [3, 4, 7, 2, -3, 1, 4, 2]
k = 7`,
    starter: `def count_periods(changes, k):
    # Return the number of contiguous periods whose total is exactly k.
    ...


print(count_periods(changes, k))
`,
    solution: `from collections import defaultdict


def count_periods(changes, k):
    seen = defaultdict(int)
    seen[0] = 1  # the empty prefix
    total = count = 0
    for change in changes:
        total += change
        count += seen[total - k]
        seen[total] += 1
    return count
`,
    cases: [
      {
        name: 'Sample',
        note: '«3, 4», «7», «7, 2, -3, 1» and «1, 4, 2» each total 7.',
        check: 'count_periods(changes, k)',
      },
      {
        name: 'Periods from the first hour',
        note: 'Both «2, 5» and «2, 5, -1, 1» start at the first hour.',
        setup: 'changes = [2, 5, -1, 1]\nk = 7',
        check: 'count_periods(changes, k)',
      },
      {
        name: 'k is 0',
        note: 'Six periods total 0. A period with no hours does not count.',
        setup: 'changes = [1, -1, 0, 2, -2]\nk = 0',
        check: 'count_periods(changes, k)',
      },
      {
        name: 'Negative changes',
        hidden: true,
        note: 'A window that only grows or shrinks misses periods when values can be negative.',
        setup: 'changes = [1, -1, 1, -1, 1]\nk = 1',
        check: 'count_periods(changes, k)',
      },
      {
        name: 'No such period',
        hidden: true,
        setup: 'changes = [1, 2, 3]\nk = 10',
        check: 'count_periods(changes, k)',
      },
      {
        name: 'No hours',
        hidden: true,
        setup: 'changes = []\nk = 0',
        check: 'count_periods(changes, k)',
      },
      {
        name: 'Random history',
        hidden: true,
        setup: `import random
rng = random.Random(5)
changes = [rng.randint(-5, 5) for _ in range(2_000)]
k = 3`,
        check: 'count_periods(changes, k)',
      },
      {
        name: 'Ten thousand hours',
        hidden: true,
        setup: `import random
rng = random.Random(11)
big_changes = [rng.randint(-20, 20) for _ in range(10_000)]`,
        check: 'count_periods(big_changes, 7)',
        limitS: 1,
        slowHint:
          'Summing every start and end pair is O(n²). Count the earlier running totals in a dict: a period that ends here totals k when an earlier running total equals total - k. One pass, O(n).',
      },
    ],
  },

  'dsa-group-anagram-keys': {
    language: 'python',
    task: `Write «group_anagrams(words)». Group the words that use the same letters the same number of times. Return a list of groups, each a list of words. The order of the groups, and of the words in a group, does not matter. Keep repeated words. It must stay fast on a long list.`,
    setup: `words = ["eat", "tea", "tan", "ate", "nat", "bat"]`,
    starter: `def group_anagrams(words):
    # Return a list of groups; each group is a list of words.
    ...


print(group_anagrams(words))
`,
    solution: `from collections import defaultdict


def group_anagrams(words):
    groups = defaultdict(list)
    for word in words:
        counts = [0] * 26
        for ch in word:
            counts[ord(ch) - ord("a")] += 1
        groups[tuple(counts)].append(word)
    return list(groups.values())
`,
    cases: [
      {
        name: 'Sample',
        note: 'Three groups: eat, tea, ate; tan, nat; bat.',
        check: 'group_anagrams(words)',
        order: 'nested',
      },
      {
        name: 'Same letters, different counts',
        note: '«aab» and «abb» use the same letters, but not the same number of times.',
        setup: 'words = ["aab", "abb", "bab", "aba"]',
        check: 'group_anagrams(words)',
        order: 'nested',
      },
      {
        name: 'A word listed twice',
        note: 'Keep both copies of «abc».',
        setup: 'words = ["abc", "bca", "abc"]',
        check: 'group_anagrams(words)',
        order: 'nested',
      },
      {
        name: 'Empty words',
        hidden: true,
        setup: 'words = ["", "a", ""]',
        check: 'group_anagrams(words)',
        order: 'nested',
      },
      {
        name: 'No words',
        hidden: true,
        setup: 'words = []',
        check: 'group_anagrams(words)',
        order: 'nested',
      },
      {
        name: 'Random words',
        hidden: true,
        setup: `import random
rng = random.Random(8)
words = ["".join(rng.choice("abcde") for _ in range(rng.randint(1, 4))) for _ in range(2_000)]`,
        check: 'group_anagrams(words)',
        order: 'nested',
      },
      {
        name: 'Four thousand column names',
        hidden: true,
        setup: `import random
rng = random.Random(11)
big_words = []
for _ in range(2_000):
    base = "".join(rng.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(rng.randint(6, 9)))
    for _ in range(2):
        letters = list(base)
        rng.shuffle(letters)
        big_words.append("".join(letters))
rng.shuffle(big_words)`,
        check: 'group_anagrams(big_words)',
        order: 'nested',
        limitS: 1,
        slowHint:
          'Comparing each word with every group is O(n²). Give each word a key that all its anagrams share, such as its sorted letters, and group by the key in a dict.',
      },
    ],
  },

  'dsa-product-except-self': {
    language: 'python',
    task: `Write «product_except_self(nums)». Return a list where position «i» holds the product of every value except «nums[i]». The product of no values is «1». Do not divide: a test checks. Run in O(n).`,
    setup: `nums = [1, 2, 3, 4]`,
    helpers: `import dis as _dis
import types as _types


def divides(fn):
    """True when fn, or a function inside it, uses / or //."""
    codes = [fn.__code__]
    while codes:
        code = codes.pop()
        for instruction in _dis.get_instructions(code):
            if instruction.opname == "BINARY_OP" and instruction.argrepr in ("/", "//", "/=", "//="):
                return True
        codes.extend(const for const in code.co_consts if isinstance(const, _types.CodeType))
    return False


def check_no_division(fn):
    if divides(fn):
        return verdict(False, "Your function divides. The interviewer ruled division out: multiply the products from the left and from the right instead.")
    return verdict(True)`,
    starter: `def product_except_self(nums):
    # Return a list: position i holds the product of every value but nums[i].
    ...


print(product_except_self(nums))
`,
    solution: `def product_except_self(nums):
    result = [1] * len(nums)
    for i in range(1, len(nums)):
        result[i] = result[i - 1] * nums[i - 1]
    right = 1
    for i in range(len(nums) - 1, -1, -1):
        result[i] *= right
        right *= nums[i]
    return result
`,
    cases: [
      { name: 'Sample', note: '24 = 2 × 3 × 4, and so on.', check: 'product_except_self(nums)' },
      {
        name: 'One zero',
        note: 'Dividing the total by 0 fails. The 0 itself gets 3 × 4.',
        setup: 'nums = [3, 0, 4]',
        check: 'product_except_self(nums)',
      },
      {
        name: 'Two zeros',
        setup: 'nums = [0, 5, 0, 2]',
        check: 'product_except_self(nums)',
      },
      {
        name: 'Negative values',
        hidden: true,
        setup: 'nums = [-1, 2, -3, 4]',
        check: 'product_except_self(nums)',
      },
      {
        name: 'One value',
        hidden: true,
        note: 'The product of no values is 1.',
        setup: 'nums = [9]',
        check: 'product_except_self(nums)',
      },
      { name: 'No values', hidden: true, setup: 'nums = []', check: 'product_except_self(nums)' },
      {
        name: 'No division',
        hidden: true,
        note: 'The question rules out / and //.',
        check: 'check_no_division(product_except_self)',
      },
      {
        name: 'Eighteen thousand values',
        hidden: true,
        setup: `big_nums = [1 if i % 3 else -1 for i in range(18_000)]
for i in range(0, 18_000, 900):
    big_nums[i] = 2`,
        check: 'product_except_self(big_nums)',
        limitS: 1,
        slowHint:
          'Multiplying all the other values for each position is O(n²). Store the product of everything left of each position, then sweep from the right with a running product: O(n).',
      },
    ],
  },

  'dsa-next-higher-latency': {
    language: 'python',
    task: `Write «minutes_until_higher(latency)». «latency[i]» is the p99 latency of minute «i». For each minute, return how many minutes pass until a strictly higher latency appears, or «0» if none does. Return a list as long as the input. It must stay fast on a long day.`,
    setup: `latency = [73, 74, 75, 71, 69, 72, 76, 73]`,
    starter: `def minutes_until_higher(latency):
    # Return a list: minutes until a strictly higher value, or 0.
    ...


print(minutes_until_higher(latency))
`,
    solution: `def minutes_until_higher(latency):
    wait = [0] * len(latency)
    stack = []
    for i, value in enumerate(latency):
        while stack and latency[stack[-1]] < value:
            j = stack.pop()
            wait[j] = i - j
        stack.append(i)
    return wait
`,
    cases: [
      {
        name: 'Sample',
        note: 'Minute 2 (75) waits 4 minutes for 76.',
        check: 'minutes_until_higher(latency)',
      },
      {
        name: 'Equal is not higher',
        note: 'The first 50 waits for 60, not for the second 50.',
        setup: 'latency = [50, 50, 60]',
        check: 'minutes_until_higher(latency)',
      },
      {
        name: 'Falling latency',
        setup: 'latency = [90, 80, 70]',
        check: 'minutes_until_higher(latency)',
      },
      {
        name: 'One minute',
        hidden: true,
        setup: 'latency = [42]',
        check: 'minutes_until_higher(latency)',
      },
      {
        name: 'No minutes',
        hidden: true,
        setup: 'latency = []',
        check: 'minutes_until_higher(latency)',
      },
      {
        name: 'A random day',
        hidden: true,
        setup: `import random
rng = random.Random(4)
latency = [rng.randint(80, 400) for _ in range(1_440)]`,
        check: 'minutes_until_higher(latency)',
      },
      {
        name: 'A long falling stretch',
        hidden: true,
        note: '13,000 minutes of falling latency, then a spike.',
        setup: 'big_latency = list(range(13_000, 0, -1)) + [50_000]',
        check: 'minutes_until_higher(big_latency)',
        limitS: 1,
        slowHint:
          'Scanning forward from every minute is O(n²) when latency falls for a long time. Keep a stack of the minutes still waiting for a higher value: each minute is pushed and popped once, O(n).',
      },
    ],
  },

  'dsa-window-maximum': {
    language: 'python',
    task: `Write «window_maximums(readings, k)». Return the maximum of every window of «k» consecutive readings, in order: «len(readings) - k + 1» values. «k» is at least 1 and at most «len(readings)». It must stay fast when «k» is large.`,
    setup: `readings = [1, 3, -1, -3, 5, 3, 6, 7]
k = 3`,
    starter: `def window_maximums(readings, k):
    # Return the maximum of each window of k consecutive readings.
    ...


print(window_maximums(readings, k))
`,
    solution: `from collections import deque


def window_maximums(readings, k):
    result = []
    candidates = deque()
    for i, value in enumerate(readings):
        while candidates and readings[candidates[-1]] <= value:
            candidates.pop()
        candidates.append(i)
        if candidates[0] <= i - k:
            candidates.popleft()
        if i >= k - 1:
            result.append(readings[candidates[0]])
    return result
`,
    cases: [
      {
        name: 'Sample',
        note: 'The first window is 1, 3, -1, so the first maximum is 3.',
        check: 'window_maximums(readings, k)',
      },
      {
        name: 'Window of one',
        setup: 'readings = [4, 2, 12]\nk = 1',
        check: 'window_maximums(readings, k)',
      },
      {
        name: 'One window',
        setup: 'readings = [4, 2, 12, 3]\nk = 4',
        check: 'window_maximums(readings, k)',
      },
      {
        name: 'Falling readings',
        note: 'Each maximum leaves the window. Drop it when it does.',
        setup: 'readings = [9, 8, 7, 6, 5]\nk = 2',
        check: 'window_maximums(readings, k)',
      },
      {
        name: 'Repeated maximum',
        hidden: true,
        setup: 'readings = [5, 5, 5, 1]\nk = 2',
        check: 'window_maximums(readings, k)',
      },
      {
        name: 'Random readings',
        hidden: true,
        setup: `import random
rng = random.Random(6)
readings = [rng.randint(-100, 100) for _ in range(2_000)]
k = 50`,
        check: 'window_maximums(readings, k)',
      },
      {
        name: 'Forty thousand readings',
        hidden: true,
        note: 'Windows of 5,000 readings.',
        setup: `import random
rng = random.Random(12)
big_readings = [rng.randint(0, 1_000_000) for _ in range(40_000)]`,
        check: 'window_maximums(big_readings, 5_000)',
        limitS: 1,
        slowHint:
          'Taking max() of every window is O(n × k). Keep a deque of indexes whose readings decrease: the front is the maximum, and each index enters and leaves once, O(n).',
      },
    ],
  },

  'dsa-kth-largest-stream': {
    language: 'python',
    task: `Write a class «KthLargest». «KthLargest(k)» starts an empty tracker. «add(value)» records one order value and returns the k-th largest value so far, or «None» while fewer than «k» values have arrived. The stream never ends, so keep memory in proportion to «k», not to the number of values.`,
    setup: `k = 3
values = [4, 5, 8, 2, 3, 5, 10, 9, 4]`,
    helpers: `def replay(cls, k, values):
    tracker = cls(k)
    return [tracker.add(value) for value in values]


def two_trackers(cls):
    first, second = cls(1), cls(2)
    out = []
    for value in [5, 1, 7, 3]:
        out.append(("first", first.add(value)))
        out.append(("second", second.add(value * 10)))
    return out


def held_values(tracker):
    total = 0
    for value in vars(tracker).values():
        if isinstance(value, (list, tuple, dict, set, frozenset)) or type(value).__name__ == "deque":
            total += len(value)
    return total


def check_memory(cls):
    tracker = cls(5)
    for value in range(3_000):
        tracker.add(value % 977)
    held = held_values(tracker)
    if held > 50:
        return verdict(False, f"After 3,000 values with k = 5, your tracker holds {held} values. The stream never ends: keep only the k largest.")
    return verdict(True)`,
    starter: `class KthLargest:
    def __init__(self, k):
        ...

    def add(self, value):
        # Record value. Return the k-th largest value so far, or None.
        ...


tracker = KthLargest(k)
print([tracker.add(value) for value in values])
`,
    solution: `import heapq


class KthLargest:
    def __init__(self, k):
        self.k = k
        self.heap = []

    def add(self, value):
        if len(self.heap) < self.k:
            heapq.heappush(self.heap, value)
        elif value > self.heap[0]:
            heapq.heapreplace(self.heap, value)
        return self.heap[0] if len(self.heap) == self.k else None
`,
    cases: [
      {
        name: 'Sample',
        note: 'None until three values arrive. Then 4, the third largest of 4, 5 and 8.',
        check: 'replay(KthLargest, k, values)',
      },
      {
        name: 'k is 1',
        note: 'With k = 1 the answer is the largest value so far.',
        setup: 'k = 1\nvalues = [3, 1, 4, 1, 5]',
        check: 'replay(KthLargest, k, values)',
      },
      {
        name: 'Equal values',
        setup: 'k = 2\nvalues = [7, 7, 7]',
        check: 'replay(KthLargest, k, values)',
      },
      {
        name: 'Negative values',
        hidden: true,
        setup: 'k = 2\nvalues = [-5, -1, -3]',
        check: 'replay(KthLargest, k, values)',
      },
      {
        name: 'Two trackers at once',
        hidden: true,
        note: 'Each tracker keeps its own values.',
        check: 'two_trackers(KthLargest)',
      },
      {
        name: 'Memory stays small',
        hidden: true,
        note: '3,000 values with k = 5.',
        check: 'check_memory(KthLargest)',
      },
      {
        name: 'A random stream',
        hidden: true,
        setup: `import random
rng = random.Random(14)
k = 25
values = [rng.randint(0, 5_000) for _ in range(3_000)]`,
        check: 'replay(KthLargest, k, values)',
      },
    ],
  },

  'dsa-running-median': {
    language: 'python',
    task: `Write a class «RunningMedian». «RunningMedian()» starts empty. «add(value)» records one delivery time and returns the median of all times so far. With an even count, the median is the mean of the two middle values. Each «add» must be faster than O(n).`,
    setup: `times = [5, 15, 1, 3, 8, 7, 9, 10]`,
    helpers: `def replay(cls, values):
    tracker = cls()
    return [tracker.add(value) for value in values]


def two_trackers(cls):
    first, second = cls(), cls()
    out = []
    for value in [1, 9, 2, 8]:
        out.append(("first", first.add(value)))
        out.append(("second", second.add(value * 100)))
    return out`,
    starter: `class RunningMedian:
    def __init__(self):
        ...

    def add(self, value):
        # Record value. Return the median of every value so far.
        ...


tracker = RunningMedian()
print([tracker.add(time) for time in times])
`,
    solution: `import heapq


class RunningMedian:
    def __init__(self):
        self.low = []   # max-heap, stored as negated values
        self.high = []  # min-heap

    def add(self, value):
        heapq.heappush(self.low, -value)
        heapq.heappush(self.high, -heapq.heappop(self.low))
        if len(self.high) > len(self.low):
            heapq.heappush(self.low, -heapq.heappop(self.high))
        if len(self.low) > len(self.high):
            return -self.low[0]
        return (-self.low[0] + self.high[0]) / 2
`,
    cases: [
      {
        name: 'Sample',
        note: 'After 5 and 15, the median is 10.0.',
        check: 'replay(RunningMedian, times)',
      },
      {
        name: 'Equal values',
        setup: 'times = [4, 4, 4, 4]',
        check: 'replay(RunningMedian, times)',
      },
      {
        name: 'Falling times',
        setup: 'times = [9, 7, 5, 3, 1]',
        check: 'replay(RunningMedian, times)',
      },
      {
        name: 'Times with decimals',
        hidden: true,
        setup: 'times = [2.5, 3.5, 1.0]',
        check: 'replay(RunningMedian, times)',
      },
      {
        name: 'Two trackers at once',
        hidden: true,
        note: 'Each tracker keeps its own values.',
        check: 'two_trackers(RunningMedian)',
      },
      {
        name: 'Random times',
        hidden: true,
        setup: `import random
rng = random.Random(15)
times = [rng.randint(5, 120) for _ in range(1_000)]`,
        check: 'replay(RunningMedian, times)',
      },
      {
        name: 'Eight thousand deliveries',
        hidden: true,
        setup: 'big_times = [(i * 7919) % 1_009 for i in range(8_000)]',
        check: 'replay(RunningMedian, big_times)',
        limitS: 1,
        slowHint:
          'Sorting every time on each add is O(n log n) per value. Keep a max-heap of the low half and a min-heap of the high half: O(log n) per add.',
      },
    ],
  },

  'dsa-rotated-log-search': {
    language: 'python',
    task: `Write «search_rotated(nums, target)». «nums» holds distinct timestamps in increasing order, rotated at an unknown position, such as «[40, 50, 60, 10, 20, 30]». Return the index of «target», or «-1». Use O(log n) reads: the tests count the entries your search reads.`,
    setup: `nums = [40, 50, 60, 10, 20, 30]
target = 20`,
    helpers: `class _Counted:
    """A list that counts how many entries the search reads."""

    def __init__(self, values):
        self._values = list(values)
        self.reads = 0

    def __len__(self):
        return len(self._values)

    def __getitem__(self, index):
        if isinstance(index, slice):
            part = self._values[index]
            self.reads += len(part)
            return part
        self.reads += 1
        return self._values[index]

    def __iter__(self):
        for value in self._values:
            self.reads += 1
            yield value

    def __contains__(self, value):
        return any(item == value for item in self)

    def index(self, value):
        for position, item in enumerate(self):
            if item == value:
                return position
        raise ValueError(f"{value!r} is not in the list")

    def __repr__(self):
        return repr(self._values)


def check_search(fn, *scenarios):
    for values, target in scenarios:
        counted = _Counted(values)
        got = fn(counted, target)
        want = values.index(target) if target in values else -1
        shown = values if len(values) <= 12 else f"a list of {len(values)} timestamps"
        if got != want:
            return verdict(False, f"search_rotated({shown}, {target}) returned {got!r}. Expected {want}.")
        steps = max(1, len(values)).bit_length()
        if counted.reads > 8 * (steps + 1):
            return verdict(False, f"Right answer, but your search read {counted.reads} of {len(values)} entries. Binary search takes about {steps} steps of a few reads each.")
    return verdict(True)


def rotations(size):
    base = [10 * (i + 1) for i in range(size)]
    for shift in range(max(1, size)):
        values = base[shift:] + base[:shift]
        for target in base + [5, 15, 10 * size + 5]:
            yield values, target`,
    starter: `def search_rotated(nums, target):
    # Return the index of target in the rotated list, or -1.
    ...


print(search_rotated(nums, target))
`,
    solution: `def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:          # left half is sorted
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:                              # right half is sorted
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
`,
    cases: [
      {
        name: 'Sample',
        note: '20 is at index 4.',
        check: 'check_search(search_rotated, (nums, target))',
      },
      {
        name: 'Target before the turn',
        note: '50 is in the first, larger part.',
        setup: 'target = 50',
        check: 'check_search(search_rotated, (nums, target))',
      },
      {
        name: 'Missing target',
        setup: 'target = 35',
        check: 'check_search(search_rotated, (nums, target))',
      },
      {
        name: 'Not rotated',
        setup: 'nums = [10, 20, 30, 40]\ntarget = 10',
        check: 'check_search(search_rotated, (nums, target))',
      },
      {
        name: 'One value, or none',
        hidden: true,
        check: 'check_search(search_rotated, ([7], 7), ([7], 3), ([], 5))',
      },
      {
        name: 'Every rotation',
        hidden: true,
        note: 'Lists of 1 to 9 timestamps, every rotation, every target, and missing ones.',
        check:
          'check_search(search_rotated, *[s for size in range(1, 10) for s in rotations(size)])',
      },
      {
        name: 'A big ring buffer',
        hidden: true,
        note: '33,334 timestamps: a scan reads thousands of entries.',
        setup: `big_nums = list(range(60_000, 100_000, 3)) + list(range(0, 60_000, 3))
big_targets = [0, 3, 59_997, 60_000, 99_999, 4_500, 77_777, -1, 100_000]`,
        check: 'check_search(search_rotated, *[(big_nums, t) for t in big_targets])',
      },
    ],
  },

  'dsa-smallest-batch-size': {
    language: 'python',
    task: `Write «smallest_batch_size(sizes, runs)». Files load in the given order. One run loads consecutive files whose sizes add up to at most the batch size. Return the smallest batch size that loads every file in at most «runs» runs. «sizes» is not empty, and «runs» is at least 1. It must stay fast for large sizes.`,
    setup: `sizes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
runs = 5`,
    starter: `def smallest_batch_size(sizes, runs):
    # Return the smallest batch size that loads every file in at most runs runs.
    ...


print(smallest_batch_size(sizes, runs))
`,
    solution: `def smallest_batch_size(sizes, runs):
    def runs_needed(limit):
        count, current = 1, 0
        for size in sizes:
            if current + size > limit:
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
    cases: [
      {
        name: 'Sample',
        note: '1 to 5, then 6 and 7, then 8, 9 and 10 alone: five runs of at most 15.',
        check: 'smallest_batch_size(sizes, runs)',
      },
      {
        name: 'One run',
        note: 'One run must hold every file.',
        setup: 'sizes = [3, 2, 2, 4, 1, 4]\nruns = 1',
        check: 'smallest_batch_size(sizes, runs)',
      },
      {
        name: 'A run per file',
        note: 'The batch must still hold the largest file.',
        setup: 'sizes = [3, 2, 2, 4, 1, 4]\nruns = 6',
        check: 'smallest_batch_size(sizes, runs)',
      },
      {
        name: 'More runs than files',
        hidden: true,
        setup: 'sizes = [7, 2, 5]\nruns = 10',
        check: 'smallest_batch_size(sizes, runs)',
      },
      {
        name: 'Three runs',
        hidden: true,
        setup: 'sizes = [3, 2, 2, 4, 1, 4]\nruns = 3',
        check: 'smallest_batch_size(sizes, runs)',
      },
      {
        name: 'One large file',
        hidden: true,
        note: 'The answer can be larger than the largest file.',
        setup: 'sizes = [1, 1, 1, 50, 1]\nruns = 2',
        check: 'smallest_batch_size(sizes, runs)',
      },
      {
        name: 'Random files',
        hidden: true,
        setup: `import random
rng = random.Random(16)
sizes = [rng.randint(1, 300) for _ in range(300)]
runs = 17`,
        check: 'smallest_batch_size(sizes, runs)',
      },
      {
        name: 'Four thousand files',
        hidden: true,
        setup: `import random
rng = random.Random(17)
big_sizes = [rng.randint(1, 1_000) for _ in range(4_000)]`,
        check: 'smallest_batch_size(big_sizes, 150)',
        limitS: 1,
        slowHint:
          'Trying every batch size from the largest file upward is O(n × range). "It fits in the runs" flips once as the size grows, so binary search the size: O(n log S).',
      },
    ],
  },
};

export const DSA_RUNNABLES: Record<string, RunnableSpec> = {
  ...ARRAY_RUNNABLES,
  ...DSA_GRAPH_RUNNABLES,
};
