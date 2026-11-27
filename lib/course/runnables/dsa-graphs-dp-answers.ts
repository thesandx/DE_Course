import type { SpecAnswers } from '@/lib/course/runnables/test-answers';

/**
 * Other answers for the DSA problems in `dsa-graphs-dp.ts`. See
 * `test-answers.ts`. A wrong answer that is only too slow, or only too deep
 * for Python's recursion limit, sits last.
 */
export const DSA_GRAPH_ANSWERS: Readonly<Record<string, SpecAnswers>> = {
  'dsa-count-clusters': {
    pass: [
      // Union-find over the cells.
      `def count_regions(grid):
    parent = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            if cell == 1:
                parent[(r, c)] = (r, c)
                for nr, nc in ((r - 1, c), (r, c - 1)):
                    if (nr, nc) in parent:
                        parent[find((nr, nc))] = find((r, c))
    return len({find(cell) for cell in parent})
`,
      // Marks visited cells in the grid itself: the tests pass a fresh grid.
      `from collections import deque


def count_regions(grid):
    regions = 0
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if grid[r][c] == 1:
                regions += 1
                grid[r][c] = 0
                queue = deque([(r, c)])
                while queue:
                    y, x = queue.popleft()
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < len(grid) and 0 <= nx < len(grid[ny]) and grid[ny][nx] == 1:
                            grid[ny][nx] = 0
                            queue.append((ny, nx))
    return regions
`,
    ],
    fail: [
      // Lets diagonal cells touch.
      `def count_regions(grid):
    seen = set()
    regions = 0
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if grid[r][c] != 1 or (r, c) in seen:
                continue
            regions += 1
            stack = [(r, c)]
            seen.add((r, c))
            while stack:
                y, x = stack.pop()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if (0 <= ny < len(grid) and 0 <= nx < len(grid[ny])
                                and grid[ny][nx] == 1 and (ny, nx) not in seen):
                            seen.add((ny, nx))
                            stack.append((ny, nx))
    return regions
`,
      // Counts cells with no outage above or to the left: a U counts twice.
      `def count_regions(grid):
    regions = 0
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if grid[r][c] == 1:
                up = r > 0 and grid[r - 1][c] == 1
                left = c > 0 and grid[r][c - 1] == 1
                if not up and not left:
                    regions += 1
    return regions
`,
      // Keeps the visited cells in a list: right, but each lookup is O(n).
      `def count_regions(grid):
    if not grid:
        return 0
    seen = []
    regions = 0
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] != 1 or (r, c) in seen:
                continue
            regions += 1
            stack = [(r, c)]
            seen.append((r, c))
            while stack:
                y, x = stack.pop()
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if (0 <= ny < len(grid) and 0 <= nx < len(grid[0])
                            and grid[ny][nx] == 1 and (ny, nx) not in seen):
                        seen.append((ny, nx))
                        stack.append((ny, nx))
    return regions
`,
      // A recursive search: right, but too deep for a long region.
      `def count_regions(grid):
    seen = set()

    def visit(r, c):
        if not (0 <= r < len(grid) and 0 <= c < len(grid[0])):
            return
        if grid[r][c] != 1 or (r, c) in seen:
            return
        seen.add((r, c))
        visit(r + 1, c)
        visit(r - 1, c)
        visit(r, c + 1)
        visit(r, c - 1)

    regions = 0
    for r in range(len(grid)):
        for c in range(len(grid[r])):
            if grid[r][c] == 1 and (r, c) not in seen:
                regions += 1
                visit(r, c)
    return regions
`,
    ],
  },

  'dsa-task-order': {
    pass: [
      // The standard library's topological sort.
      `from graphlib import CycleError, TopologicalSorter


def task_order(tasks, rules):
    sorter = TopologicalSorter({task: set() for task in tasks})
    for before, after in rules:
        sorter.add(after, before)
    try:
        return list(sorter.static_order())
    except CycleError:
        return None
`,
      // Depth-first search with three colours, without recursion.
      `def task_order(tasks, rules):
    after = {task: [] for task in tasks}
    for before, later in rules:
        after[before].append(later)
    state = {task: 0 for task in tasks}  # 0 new, 1 on the path, 2 done
    order = []
    for start in tasks:
        if state[start]:
            continue
        state[start] = 1
        stack = [(start, iter(after[start]))]
        while stack:
            task, children = stack[-1]
            for child in children:
                if state[child] == 1:
                    return None
                if state[child] == 0:
                    state[child] = 1
                    stack.append((child, iter(after[child])))
                    break
            else:
                stack.pop()
                state[task] = 2
                order.append(task)
    return order[::-1]
`,
    ],
    fail: [
      // Never checks for a cycle, so it returns a partial order.
      `from collections import defaultdict, deque


def task_order(tasks, rules):
    after = defaultdict(list)
    waiting = {task: 0 for task in tasks}
    for before, later in rules:
        after[before].append(later)
        waiting[later] += 1
    ready = deque(task for task in tasks if waiting[task] == 0)
    order = []
    while ready:
        task = ready.popleft()
        order.append(task)
        for later in after[task]:
            waiting[later] -= 1
            if waiting[later] == 0:
                ready.append(later)
    return order
`,
      // A set of edges with a counted in-degree: a repeated rule never clears.
      `from collections import defaultdict, deque


def task_order(tasks, rules):
    after = defaultdict(set)
    waiting = {task: 0 for task in tasks}
    for before, later in rules:
        after[before].add(later)
        waiting[later] += 1
    ready = deque(task for task in tasks if waiting[task] == 0)
    order = []
    while ready:
        task = ready.popleft()
        order.append(task)
        for later in after[task]:
            waiting[later] -= 1
            if waiting[later] == 0:
                ready.append(later)
    return order if len(order) == len(tasks) else None
`,
      // Scans every task and rule for the next one to run: right, but O(V × E).
      `def task_order(tasks, rules):
    done = set()
    order = []
    remaining = list(tasks)
    while remaining:
        for task in remaining:
            if all(before in done for before, later in rules if later == task):
                order.append(task)
                done.add(task)
                remaining.remove(task)
                break
        else:
            return None
    return order
`,
    ],
  },

  'dsa-shortest-grid-path': {
    pass: [
      `from collections import deque


def fewest_moves(grid):
    rows, cols = len(grid), len(grid[0])
    if grid[0][0] or grid[-1][-1]:
        return -1
    dist = [[-1] * cols for _ in range(rows)]
    dist[0][0] = 0
    queue = deque([(0, 0)])
    while queue:
        r, c = queue.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols and not grid[nr][nc] and dist[nr][nc] < 0:
                dist[nr][nc] = dist[r][c] + 1
                queue.append((nr, nc))
    return dist[-1][-1]
`,
    ],
    fail: [
      // Depth-first: returns the first route it finds, not the shortest.
      `def fewest_moves(grid):
    rows, cols = len(grid), len(grid[0])
    if grid[0][0] == 1 or grid[rows - 1][cols - 1] == 1:
        return -1
    seen = {(0, 0)}
    stack = [(0, 0, 0)]
    while stack:
        r, c, moves = stack.pop()
        if (r, c) == (rows - 1, cols - 1):
            return moves
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 0 and (nr, nc) not in seen:
                seen.add((nr, nc))
                stack.append((nr, nc, moves + 1))
    return -1
`,
      // Never checks whether the start is a shelf.
      `from collections import deque


def fewest_moves(grid):
    rows, cols = len(grid), len(grid[0])
    seen = {(0, 0)}
    queue = deque([(0, 0, 0)])
    while queue:
        r, c, moves = queue.popleft()
        if (r, c) == (rows - 1, cols - 1):
            return moves
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 0 and (nr, nc) not in seen:
                seen.add((nr, nc))
                queue.append((nr, nc, moves + 1))
    return -1
`,
      // Moves only right and down.
      `def fewest_moves(grid):
    rows, cols = len(grid), len(grid[0])
    if grid[0][0] == 1 or grid[-1][-1] == 1:
        return -1
    INF = float("inf")
    best = [[INF] * cols for _ in range(rows)]
    best[0][0] = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == 1 or (r, c) == (0, 0):
                continue
            up = best[r - 1][c] if r > 0 else INF
            left = best[r][c - 1] if c > 0 else INF
            best[r][c] = min(up, left) + 1
    return best[-1][-1] if best[-1][-1] != INF else -1
`,
    ],
  },

  'dsa-tree-levels': {
    pass: [
      `from collections import deque


def level_counts(reports, top):
    counts = []
    queue = deque([(top, 0)])
    while queue:
        person, depth = queue.popleft()
        if depth == len(counts):
            counts.append(0)
        counts[depth] += 1
        for report in reports.get(person, []):
            queue.append((report, depth + 1))
    return counts
`,
      // Recursion is fine here: org trees are shallow.
      `def level_counts(reports, top):
    counts = []

    def visit(person, depth):
        if depth == len(counts):
            counts.append(0)
        counts[depth] += 1
        for report in reports.get(person, ()):
            visit(report, depth + 1)

    visit(top, 0)
    return counts
`,
    ],
    fail: [
      // Leaves out the top person's own level.
      `def level_counts(reports, top):
    counts = []
    level = reports.get(top, [])
    while level:
        counts.append(len(level))
        level = [person for manager in level for person in reports.get(manager, [])]
    return counts
`,
      // reports[manager] fails for a person with no reports.
      `def level_counts(reports, top):
    counts = []
    level = [top]
    while level:
        counts.append(len(level))
        level = [person for manager in level for person in reports[manager]]
    return counts
`,
    ],
  },

  'dsa-common-upstream': {
    pass: [
      // Lift the deeper person to the same depth, then climb together.
      `def nearest_shared_manager(manager_of, a, b):
    def depth(x):
        d = 0
        while x is not None:
            x = manager_of.get(x)
            d += 1
        return d

    da, db = depth(a), depth(b)
    while da > db:
        a = manager_of.get(a)
        da -= 1
    while db > da:
        b = manager_of.get(b)
        db -= 1
    while a != b:
        a, b = manager_of.get(a), manager_of.get(b)
    return a
`,
    ],
    fail: [
      // Starts above each person, so a manager is never their own answer.
      `def nearest_shared_manager(manager_of, a, b):
    chain = set()
    node = manager_of.get(a)
    while node is not None:
        chain.add(node)
        node = manager_of.get(node)
    node = manager_of.get(b)
    while node is not None:
        if node in chain:
            return node
        node = manager_of.get(node)
    return None
`,
      // Returns the highest shared manager, not the nearest.
      `def nearest_shared_manager(manager_of, a, b):
    def chain(x):
        out = []
        while x is not None:
            out.append(x)
            x = manager_of.get(x)
        return out

    above_b = set(chain(b))
    shared = [person for person in chain(a) if person in above_b]
    return shared[-1] if shared else None
`,
      // Keeps a's managers in a list: right, but O(h²).
      `def nearest_shared_manager(manager_of, a, b):
    chain = []
    while a is not None:
        chain.append(a)
        a = manager_of.get(a)
    while b is not None:
        if b in chain:
            return b
        b = manager_of.get(b)
    return None
`,
    ],
  },

  'dsa-lru-cache': {
    pass: [
      // A plain dict keeps insertion order: pop and re-insert marks a use.
      `class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = {}

    def get(self, key):
        if key not in self.items:
            return None
        value = self.items.pop(key)
        self.items[key] = value
        return value

    def put(self, key, value):
        self.items.pop(key, None)
        self.items[key] = value
        if len(self.items) > self.capacity:
            del self.items[next(iter(self.items))]
`,
    ],
    fail: [
      // A get does not count as a use.
      `class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = {}

    def get(self, key):
        return self.items.get(key)

    def put(self, key, value):
        self.items.pop(key, None)
        self.items[key] = value
        if len(self.items) > self.capacity:
            del self.items[next(iter(self.items))]
`,
      // Treats a stored 0 or "" as a miss.
      `class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = {}

    def get(self, key):
        value = self.items.get(key)
        if not value:
            return None
        del self.items[key]
        self.items[key] = value
        return value

    def put(self, key, value):
        self.items.pop(key, None)
        self.items[key] = value
        if len(self.items) > self.capacity:
            del self.items[next(iter(self.items))]
`,
      // Uses OrderedDict, which the question rules out.
      `from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = OrderedDict()

    def get(self, key):
        if key not in self.items:
            return None
        self.items.move_to_end(key)
        return self.items[key]

    def put(self, key, value):
        self.items[key] = value
        self.items.move_to_end(key)
        if len(self.items) > self.capacity:
            self.items.popitem(last=False)
`,
      // Keeps the order in a list: right, but each use is O(n).
      `class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = {}
        self.order = []

    def get(self, key):
        if key not in self.items:
            return None
        self.order.remove(key)
        self.order.append(key)
        return self.items[key]

    def put(self, key, value):
        if key in self.items:
            self.order.remove(key)
        self.items[key] = value
        self.order.append(key)
        if len(self.items) > self.capacity:
            oldest = self.order.pop(0)
            del self.items[oldest]
`,
    ],
  },

  'dsa-reverse-linked-list': {
    pass: [
      // Collects the nodes, then relinks them backwards.
      `def reverse_list(head):
    nodes = []
    while head is not None:
        nodes.append(head)
        head = head.next
    for i in range(len(nodes) - 1, 0, -1):
        nodes[i].next = nodes[i - 1]
    if not nodes:
        return None
    nodes[0].next = None
    return nodes[-1]
`,
    ],
    fail: [
      // Builds new nodes.
      `def reverse_list(head):
    new_head = None
    while head is not None:
        new_head = ListNode(head.val, new_head)
        head = head.next
    return new_head
`,
      // Moves to node.next after changing it, so the rest is lost.
      `def reverse_list(head):
    prev = None
    node = head
    while node is not None:
        node.next = prev
        prev = node
        node = node.next
    return prev
`,
      // Swaps the values and keeps the links.
      `def reverse_list(head):
    nodes = []
    node = head
    while node is not None:
        nodes.append(node)
        node = node.next
    values = [node.val for node in nodes]
    for node, value in zip(nodes, reversed(values)):
        node.val = value
    return head
`,
      // Recursive: right, but too deep for a long list.
      `def reverse_list(head):
    if head is None or head.next is None:
        return head
    new_head = reverse_list(head.next)
    head.next.next = head
    head.next = None
    return new_head
`,
    ],
  },

  'dsa-fewest-coins': {
    pass: [
      // Breadth-first over the amounts: the first hit uses the fewest notes.
      `from collections import deque


def fewest_notes(values, amount):
    if amount == 0:
        return 0
    seen = {0}
    queue = deque([(0, 0)])
    while queue:
        total, count = queue.popleft()
        for value in values:
            nxt = total + value
            if nxt == amount:
                return count + 1
            if nxt < amount and nxt not in seen:
                seen.add(nxt)
                queue.append((nxt, count + 1))
    return -1
`,
      // Top-down with a cache.
      `from functools import lru_cache


def fewest_notes(values, amount):
    @lru_cache(maxsize=None)
    def best(left):
        if left == 0:
            return 0
        options = [best(left - v) for v in values if v <= left]
        options = [option for option in options if option >= 0]
        return min(options) + 1 if options else -1

    return best(amount)
`,
    ],
    fail: [
      // Greedy: largest note first.
      `def fewest_notes(values, amount):
    count = 0
    for value in sorted(values, reverse=True):
        count += amount // value
        amount %= value
    return count if amount == 0 else -1
`,
      // Returns infinity instead of -1.
      `def fewest_notes(values, amount):
    fewest = [0] + [float("inf")] * amount
    for a in range(1, amount + 1):
        for v in values:
            if v <= a:
                fewest[a] = min(fewest[a], fewest[a - v] + 1)
    return fewest[amount]
`,
    ],
  },

  'dsa-longest-rising-run': {
    pass: [
      `def longest_rising(values):
    tails = []
    for value in values:
        lo, hi = 0, len(tails)
        while lo < hi:
            mid = (lo + hi) // 2
            if tails[mid] < value:
                lo = mid + 1
            else:
                hi = mid
        if lo == len(tails):
            tails.append(value)
        else:
            tails[lo] = value
    return len(tails)
`,
    ],
    fail: [
      // bisect_right lets equal values extend a run.
      `from bisect import bisect_right


def longest_rising(values):
    tails = []
    for value in values:
        i = bisect_right(tails, value)
        if i == len(tails):
            tails.append(value)
        else:
            tails[i] = value
    return len(tails)
`,
      // The longest run of adjacent rising items.
      `def longest_rising(values):
    best = run = 0
    for i, value in enumerate(values):
        run = run + 1 if i > 0 and value > values[i - 1] else 1
        best = max(best, run)
    return best
`,
      // The O(n²) answer: right, but too slow for the largest test.
      `def longest_rising(values):
    if not values:
        return 0
    best = [1] * len(values)
    for i in range(len(values)):
        for j in range(i):
            if values[j] < values[i] and best[j] + 1 > best[i]:
                best[i] = best[j] + 1
    return max(best)
`,
    ],
  },

  'dsa-max-non-adjacent': {
    pass: [
      `def best_total(values):
    if not values:
        return 0
    best = [0] * (len(values) + 1)
    best[1] = values[0]
    for i in range(2, len(values) + 1):
        best[i] = max(best[i - 1], best[i - 2] + values[i - 1])
    return best[-1]
`,
    ],
    fail: [
      // Every other slot: misses a gap of two.
      `def best_total(values):
    return max(sum(values[0::2]), sum(values[1::2]))
`,
      // Greedy: biggest slot first.
      `def best_total(values):
    taken = [False] * len(values)
    total = 0
    for i in sorted(range(len(values)), key=lambda i: -values[i]):
        if (i > 0 and taken[i - 1]) or (i + 1 < len(values) and taken[i + 1]):
            continue
        taken[i] = True
        total += values[i]
    return total
`,
      // Top-down with a cache: right, but too deep for a long list.
      `from functools import lru_cache


def best_total(values):
    @lru_cache(maxsize=None)
    def best(i):
        if i >= len(values):
            return 0
        return max(values[i] + best(i + 2), best(i + 1))

    return best(0)
`,
    ],
  },

  'dsa-merge-identities': {
    pass: [
      // Breadth-first search from each record through shared contacts.
      `from collections import defaultdict, deque


def merge_identities(records):
    by_contact = defaultdict(list)
    for record_id, contacts in records.items():
        for contact in contacts:
            by_contact[contact].append(record_id)
    seen = set()
    groups = []
    for start in records:
        if start in seen:
            continue
        seen.add(start)
        group = []
        queue = deque([start])
        while queue:
            record_id = queue.popleft()
            group.append(record_id)
            for contact in records[record_id]:
                for other in by_contact[contact]:
                    if other not in seen:
                        seen.add(other)
                        queue.append(other)
        groups.append(group)
    return groups
`,
    ],
    fail: [
      // Joins a record to the first group it meets, never merging two groups.
      `def merge_identities(records):
    group_of = {}
    owner = {}
    for record_id, contacts in records.items():
        group_of[record_id] = record_id
        for contact in contacts:
            if contact in owner:
                group_of[record_id] = group_of[owner[contact]]
            else:
                owner[contact] = record_id
    groups = {}
    for record_id, group in group_of.items():
        groups.setdefault(group, []).append(record_id)
    return list(groups.values())
`,
      // Compares every pair of records: right, but O(n²).
      `from collections import defaultdict


def merge_identities(records):
    ids = list(records)
    parent = {record_id: record_id for record_id in ids}

    def find(x):
        while parent[x] != x:
            x = parent[x]
        return x

    contacts = {record_id: set(records[record_id]) for record_id in ids}
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            if not contacts[ids[i]].isdisjoint(contacts[ids[j]]):
                parent[find(ids[i])] = find(ids[j])
    groups = defaultdict(list)
    for record_id in ids:
        groups[find(record_id)].append(record_id)
    return list(groups.values())
`,
    ],
  },
};
