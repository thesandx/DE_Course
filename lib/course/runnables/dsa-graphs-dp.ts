import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the DSA track, part two: grids, graphs, trees,
 * dynamic programming, linked lists and design. `dsa.ts` explains how the
 * big cases are sized.
 *
 * Python stops a recursion at about 1,000 calls. Where the course teaches an
 * explicit stack or a loop, a hidden case goes deeper than that, so a
 * recursive answer fails there with a message that says why.
 */
export const DSA_GRAPH_RUNNABLES: Record<string, RunnableSpec> = {
  'dsa-count-clusters': {
    language: 'python',
    task: `Write «count_regions(grid)». «grid» is a list of rows of «0» and «1»; «1» marks a map cell with an outage. Cells that touch up, down, left or right belong to one region; diagonal cells do not. Return the number of regions, or «0» for an empty grid. Very large regions must work too.`,
    setup: `grid = [
    [1, 1, 0, 0, 0],
    [1, 1, 0, 0, 1],
    [0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1],
]`,
    starter: `def count_regions(grid):
    # Return the number of regions of 1s that touch up, down, left or right.
    ...


print(count_regions(grid))
`,
    solution: `def count_regions(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    seen = set()
    regions = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] != 1 or (r, c) in seen:
                continue
            regions += 1
            stack = [(r, c)]
            seen.add((r, c))
            while stack:
                y, x = stack.pop()
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if (0 <= ny < rows and 0 <= nx < cols
                            and grid[ny][nx] == 1 and (ny, nx) not in seen):
                        seen.add((ny, nx))
                        stack.append((ny, nx))
    return regions
`,
    cases: [
      {
        name: 'Sample',
        note: 'Two regions at the top right and left, three single cells at the bottom.',
        check: 'count_regions(grid)',
      },
      {
        name: 'Diagonals do not touch',
        setup: 'grid = [[1, 0], [0, 1]]',
        check: 'count_regions(grid)',
      },
      {
        name: 'A U-shaped region',
        note: 'The two arms join at the bottom row.',
        setup: 'grid = [[1, 0, 1], [1, 0, 1], [1, 1, 1]]',
        check: 'count_regions(grid)',
      },
      {
        name: 'No outage',
        hidden: true,
        setup: 'grid = [[0, 0], [0, 0]]',
        check: 'count_regions(grid)',
      },
      { name: 'Empty grid', hidden: true, setup: 'grid = []', check: 'count_regions(grid)' },
      {
        name: 'One row',
        hidden: true,
        setup: 'grid = [[1, 0, 1, 1, 0, 1]]',
        check: 'count_regions(grid)',
      },
      {
        name: 'A snake of 2,549 cells',
        hidden: true,
        note: "One winding region. A recursive search goes deeper than Python's limit of 1,000 calls.",
        setup: `snake = []
for r in range(99):
    if r % 2 == 0:
        snake.append([1] * 50)
    else:
        row = [0] * 50
        row[49 if r % 4 == 1 else 0] = 1
        snake.append(row)`,
        check: 'count_regions(snake)',
      },
      {
        name: 'A 150 × 150 map',
        hidden: true,
        setup: `import random
rng = random.Random(21)
big_grid = [[1 if rng.random() < 0.55 else 0 for _ in range(150)] for _ in range(150)]`,
        check: 'count_regions(big_grid)',
        limitS: 1,
        slowHint:
          'Looking a cell up in a list is O(n) per lookup. Keep the visited cells in a set, or mark them in a copy of the grid.',
      },
    ],
  },

  'dsa-task-order': {
    language: 'python',
    task: `Write «task_order(tasks, rules)». «tasks» lists the task names. Each rule «(before, after)» means «before» must run before «after». Return a list of every task, once each, in an order that keeps every rule; any such order passes. Return «None» when the rules contain a cycle.`,
    setup: `tasks = ["extract", "clean", "load", "report", "audit"]
rules = [
    ("extract", "clean"),
    ("clean", "load"),
    ("load", "report"),
    ("extract", "audit"),
]`,
    helpers: `from collections import deque as _deque


def _has_cycle(tasks, rules):
    after = {task: [] for task in tasks}
    waiting = {task: 0 for task in tasks}
    for before, later in rules:
        after[before].append(later)
        waiting[later] += 1
    ready = _deque(task for task in tasks if waiting[task] == 0)
    done = 0
    while ready:
        task = ready.popleft()
        done += 1
        for later in after[task]:
            waiting[later] -= 1
            if waiting[later] == 0:
                ready.append(later)
    return done != len(tasks)


def check_order(fn, tasks, rules):
    got = fn(list(tasks), list(rules))
    if _has_cycle(tasks, rules):
        if got is None:
            return verdict(True)
        return verdict(False, f"The rules contain a cycle, so no order works: return None. You returned {got!r}.")
    if got is None:
        return verdict(False, "These rules have no cycle, so an order exists. You returned None.")
    if not isinstance(got, (list, tuple)):
        return verdict(False, f"Return a list of task names. You returned a {type(got).__name__}.")
    got = list(got)
    seen = set()
    for task in got:
        if task in seen:
            return verdict(False, f"{task!r} appears more than once in your order.")
        seen.add(task)
    names = set(tasks)
    for task in tasks:
        if task not in seen:
            return verdict(False, f"Your order leaves out {task!r}.")
    for task in got:
        if task not in names:
            return verdict(False, f"{task!r} is not one of the tasks.")
    position = {task: index for index, task in enumerate(got)}
    for before, later in rules:
        if position[before] > position[later]:
            return verdict(False, f"The rule ({before!r}, {later!r}) is broken: {later!r} runs before {before!r}.")
    return verdict(True)`,
    starter: `def task_order(tasks, rules):
    # Return every task once, in an order that keeps every rule, or None.
    ...


print(task_order(tasks, rules))
`,
    solution: `from collections import defaultdict, deque


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
    return order if len(order) == len(tasks) else None
`,
    cases: [
      {
        name: 'Sample',
        note: '«extract» first; «report» after «load».',
        check: 'check_order(task_order, tasks, rules)',
      },
      {
        name: 'A cycle',
        note: 'a before b, b before c, c before a: no order works.',
        setup: 'tasks = ["a", "b", "c"]\nrules = [("a", "b"), ("b", "c"), ("c", "a")]',
        check: 'check_order(task_order, tasks, rules)',
      },
      {
        name: 'No rules',
        note: 'Any order of the three tasks passes.',
        setup: 'tasks = ["x", "y", "z"]\nrules = []',
        check: 'check_order(task_order, tasks, rules)',
      },
      {
        name: 'Two parents',
        note: '«join» waits for both «left» and «right».',
        setup:
          'tasks = ["join", "left", "right", "source"]\nrules = [("source", "left"), ("source", "right"), ("left", "join"), ("right", "join")]',
        check: 'check_order(task_order, tasks, rules)',
      },
      {
        name: 'A cycle to the side',
        hidden: true,
        note: 'a and b are fine, but c and d wait for each other.',
        setup: 'tasks = ["a", "b", "c", "d"]\nrules = [("a", "b"), ("c", "d"), ("d", "c")]',
        check: 'check_order(task_order, tasks, rules)',
      },
      {
        name: 'A task that needs itself',
        hidden: true,
        setup: 'tasks = ["a", "b"]\nrules = [("a", "a")]',
        check: 'check_order(task_order, tasks, rules)',
      },
      {
        name: 'A rule listed twice',
        hidden: true,
        setup: 'tasks = ["a", "b"]\nrules = [("a", "b"), ("a", "b")]',
        check: 'check_order(task_order, tasks, rules)',
      },
      {
        name: 'Random pipelines',
        hidden: true,
        setup: `import random
rng = random.Random(22)
tasks = [f"t{i}" for i in range(200)]
hidden_order = tasks[:]
rng.shuffle(hidden_order)
rules = []
for _ in range(600):
    i, j = sorted(rng.sample(range(200), 2))
    rules.append((hidden_order[i], hidden_order[j]))`,
        check: 'check_order(task_order, tasks, rules)',
      },
      {
        name: 'Eight hundred tasks',
        hidden: true,
        setup: `import random
rng = random.Random(23)
big_tasks = [f"t{i}" for i in range(800)]
big_rules = [(f"t{i}", f"t{i + 1}") for i in range(799)]
for _ in range(2_400):
    i, j = sorted(rng.sample(range(800), 2))
    big_rules.append((f"t{i}", f"t{j}"))
rng.shuffle(big_tasks)`,
        check: 'check_order(task_order, big_tasks, big_rules)',
        limitS: 1,
        slowHint:
          "Scanning every task and rule to find the next one to run is O(V × E). Count each task's unfinished dependencies once, and keep a queue of the tasks whose count is 0: O(V + E).",
      },
    ],
  },

  'dsa-shortest-grid-path': {
    language: 'python',
    task: `Write «fewest_moves(grid)». «grid» is a list of rows; «0» is a free cell and «1» is a shelf. A robot starts at the top-left cell and moves up, down, left or right through free cells. Return the fewest moves to the bottom-right cell, or «-1» when no route exists. A start or end cell that is a shelf has no route.`,
    setup: `grid = [
    [0, 0, 1, 0],
    [1, 0, 1, 0],
    [0, 0, 0, 0],
    [0, 1, 1, 0],
]`,
    starter: `def fewest_moves(grid):
    # Return the fewest moves from the top-left to the bottom-right cell, or -1.
    ...


print(fewest_moves(grid))
`,
    solution: `from collections import deque


def fewest_moves(grid):
    rows, cols = len(grid), len(grid[0])
    if grid[0][0] == 1 or grid[rows - 1][cols - 1] == 1:
        return -1
    seen = {(0, 0)}
    queue = deque([(0, 0, 0)])
    while queue:
        r, c, moves = queue.popleft()
        if (r, c) == (rows - 1, cols - 1):
            return moves
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if (0 <= nr < rows and 0 <= nc < cols
                    and grid[nr][nc] == 0 and (nr, nc) not in seen):
                seen.add((nr, nc))
                queue.append((nr, nc, moves + 1))
    return -1
`,
    cases: [
      {
        name: 'Sample',
        note: 'Right, down, down, right, right, down: six moves.',
        check: 'fewest_moves(grid)',
      },
      {
        name: 'No route',
        setup: 'grid = [[0, 1], [1, 0]]',
        check: 'fewest_moves(grid)',
      },
      {
        name: 'Open floor',
        note: 'With no shelves the answer is 10. A search that stops at the first route it finds can return a longer one.',
        setup: 'grid = [[0] * 6 for _ in range(6)]',
        check: 'fewest_moves(grid)',
      },
      {
        name: 'Start on a shelf',
        hidden: true,
        setup: 'grid = [[1, 0], [0, 0]]',
        check: 'fewest_moves(grid)',
      },
      {
        name: 'End on a shelf',
        hidden: true,
        setup: 'grid = [[0, 0], [0, 1]]',
        check: 'fewest_moves(grid)',
      },
      { name: 'One cell', hidden: true, setup: 'grid = [[0]]', check: 'fewest_moves(grid)' },
      {
        name: 'A route that turns back',
        hidden: true,
        note: 'The only route goes left along the middle row.',
        setup: `grid = [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
]`,
        check: 'fewest_moves(grid)',
      },
      {
        name: 'A 60 × 60 warehouse',
        hidden: true,
        setup: `import random
rng = random.Random(24)
big_grid = [[1 if rng.random() < 0.3 else 0 for _ in range(60)] for _ in range(60)]
big_grid[0][0] = big_grid[59][59] = 0`,
        check: 'fewest_moves(big_grid)',
        limitS: 1,
        slowHint:
          'Trying every route is exponential. Breadth-first search reaches each cell once, by a shortest route: O(rows × cols).',
      },
    ],
  },

  'dsa-tree-levels': {
    language: 'python',
    task: `Write «level_counts(reports, top)». «reports» maps a manager to the list of people who report to them; a person with no reports may be missing from the dict. Return the number of people at each level under «top», starting with «top»'s own level: «[1, ...]».`,
    setup: `reports = {
    "ceo": ["cto", "cfo"],
    "cto": ["eng1", "eng2", "eng3"],
    "cfo": ["acct"],
    "eng1": ["intern"],
}
top = "ceo"`,
    starter: `def level_counts(reports, top):
    # Return the head count of each level, starting with [1] for top.
    ...


print(level_counts(reports, top))
`,
    solution: `def level_counts(reports, top):
    counts = []
    level = [top]
    while level:
        counts.append(len(level))
        level = [person for manager in level for person in reports.get(manager, [])]
    return counts
`,
    cases: [
      {
        name: 'Sample',
        note: 'ceo; cto and cfo; three engineers and acct; the intern.',
        check: 'level_counts(reports, top)',
      },
      {
        name: 'Only the top person',
        setup: 'reports = {}\ntop = "solo"',
        check: 'level_counts(reports, top)',
      },
      {
        name: 'An empty list of reports',
        note: 'b manages nobody, so no level follows it.',
        setup: 'reports = {"a": ["b"], "b": []}\ntop = "a"',
        check: 'level_counts(reports, top)',
      },
      {
        name: 'A deep branch',
        hidden: true,
        setup: 'reports = {"a": ["b", "c"], "b": ["d"], "d": ["e"]}\ntop = "a"',
        check: 'level_counts(reports, top)',
      },
      {
        name: 'Other teams in the dict',
        hidden: true,
        note: 'Count only the people under top.',
        setup: 'reports = {"top": ["x"], "other": ["y", "z"]}\ntop = "top"',
        check: 'level_counts(reports, top)',
      },
      {
        name: 'Start below the top',
        hidden: true,
        setup: 'top = "cto"',
        check: 'level_counts(reports, top)',
      },
      {
        name: 'A company of 30,000 people',
        hidden: true,
        setup: `import random
rng = random.Random(25)
big_reports = {}
people = ["p0"]
for i in range(1, 30_000):
    boss = people[rng.randrange(len(people))]
    big_reports.setdefault(boss, []).append(f"p{i}")
    people.append(f"p{i}")`,
        check: 'level_counts(big_reports, "p0")',
        limitS: 1,
        slowHint:
          "Look up each manager's reports in the dict. Scanning the whole dict for every person is O(n²).",
      },
    ],
  },

  'dsa-common-upstream': {
    language: 'python',
    task: `Write «nearest_shared_manager(manager_of, a, b)». «manager_of» maps each person to their manager; the top person maps to «None». Return the nearest person who is above both «a» and «b», or is one of them. Return «None» when they share no manager. It must stay fast on a very deep chain.`,
    setup: `manager_of = {
    "ceo": None,
    "cto": "ceo",
    "cfo": "ceo",
    "eng_lead": "cto",
    "data_lead": "cto",
    "ana": "eng_lead",
    "ben": "data_lead",
    "cara": "data_lead",
    "dev": "cfo",
}
a, b = "ana", "ben"`,
    starter: `def nearest_shared_manager(manager_of, a, b):
    # Return the nearest person above both a and b (or one of them), or None.
    ...


print(nearest_shared_manager(manager_of, a, b))
`,
    solution: `def nearest_shared_manager(manager_of, a, b):
    chain = set()
    while a is not None:
        chain.add(a)
        a = manager_of.get(a)
    while b is not None:
        if b in chain:
            return b
        b = manager_of.get(b)
    return None
`,
    cases: [
      {
        name: 'Sample',
        note: 'ana is under eng_lead and ben is under data_lead; both leads report to cto.',
        check: 'nearest_shared_manager(manager_of, a, b)',
      },
      {
        name: 'Same team',
        setup: 'a, b = "cara", "ben"',
        check: 'nearest_shared_manager(manager_of, a, b)',
      },
      {
        name: 'One manages the other',
        note: 'A person counts as above themselves.',
        setup: 'a, b = "data_lead", "ben"',
        check: 'nearest_shared_manager(manager_of, a, b)',
      },
      {
        name: 'The same person',
        hidden: true,
        setup: 'a, b = "ana", "ana"',
        check: 'nearest_shared_manager(manager_of, a, b)',
      },
      {
        name: 'Only the top is shared',
        hidden: true,
        setup: 'a, b = "ana", "dev"',
        check: 'nearest_shared_manager(manager_of, a, b)',
      },
      {
        name: 'Two separate trees',
        hidden: true,
        setup: 'manager_of = {"x": None, "y": None, "x1": "x", "y1": "y"}\na, b = "x1", "y1"',
        check: 'nearest_shared_manager(manager_of, a, b)',
      },
      {
        name: 'Two chains of 17,000',
        hidden: true,
        setup: `big_manager_of = {"root": None}
for side in ("a", "b"):
    above = "root"
    for i in range(17_000):
        big_manager_of[f"{side}{i}"] = above
        above = f"{side}{i}"`,
        check: 'nearest_shared_manager(big_manager_of, "a16999", "b16999")',
        limitS: 1,
        slowHint:
          "Checking each of b's managers against a list of a's managers is O(h²). Put a's managers in a set: O(h).",
      },
    ],
  },

  'dsa-lru-cache': {
    language: 'python',
    task: `Write a class «LRUCache». «LRUCache(capacity)» starts empty. «get(key)» returns the value, or «None» when the key is absent; a hit counts as a use. «put(key, value)» stores the value and counts as a use; when the cache then holds more than «capacity» keys, it removes the least recently used one. Both must be O(1). Do not use «OrderedDict».`,
    setup: `capacity = 2
operations = [
    ("put", "user:1", "Ana"),
    ("put", "user:2", "Ben"),
    ("get", "user:1"),
    ("put", "user:3", "Cara"),
    ("get", "user:2"),
    ("put", "user:4", "Dev"),
    ("get", "user:1"),
    ("get", "user:3"),
    ("get", "user:4"),
]`,
    helpers: `def replay(cls, capacity, operations):
    cache = cls(capacity)
    out = []
    for operation in operations:
        if operation[0] == "put":
            cache.put(operation[1], operation[2])
        else:
            out.append(("get", operation[1], cache.get(operation[1])))
    return out


def _use_time(cls, capacity, uses):
    import time

    cache = cls(capacity)
    for key in range(capacity):
        cache.put(key, key)
    recent = list(range(capacity - 50, capacity))
    fresh = capacity
    started = time.perf_counter()
    for i in range(uses):
        if i % 2:
            cache.get(recent[i % 50])
        else:
            cache.put(fresh, i)
            fresh += 1
    return time.perf_counter() - started


def check_constant_time(cls):
    small = min(_use_time(cls, 200, 4_000) for _ in range(2))
    big = min(_use_time(cls, 20_000, 4_000) for _ in range(2))
    if big > 10 * small + 0.005:
        return verdict(False, f"The same 4,000 uses took {big / max(small, 1e-9):.0f} times as long with 20,000 keys as with 200, so each use is O(n). Join a dict with a doubly linked list, so each use moves one node: O(1).")
    return verdict(True)


def check_no_ordered_dict(cls):
    import collections

    cache = cls(3)
    cache.put("a", 1)
    for value in vars(cache).values():
        if isinstance(value, collections.OrderedDict):
            return verdict(False, "Your cache keeps an OrderedDict. The question rules it out: join a dict with a doubly linked list.")
    return verdict(True)`,
    starter: `class LRUCache:
    def __init__(self, capacity):
        ...

    def get(self, key):
        # Return the value, or None. A hit counts as a use.
        ...

    def put(self, key, value):
        # Store the value. Over capacity: remove the least recently used key.
        ...


cache = LRUCache(capacity)
for operation in operations:
    if operation[0] == "put":
        cache.put(operation[1], operation[2])
    else:
        print(operation[1], "->", cache.get(operation[1]))
`,
    solution: `class _Node:
    def __init__(self, key=None, value=None):
        self.key, self.value = key, value
        self.prev = self.next = None


class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.nodes = {}
        self.head, self.tail = _Node(), _Node()
        self.head.next, self.tail.prev = self.tail, self.head

    def _remove(self, node):
        node.prev.next, node.next.prev = node.next, node.prev

    def _add_newest(self, node):
        last = self.tail.prev
        last.next, node.prev = node, last
        node.next, self.tail.prev = self.tail, node

    def get(self, key):
        node = self.nodes.get(key)
        if node is None:
            return None
        self._remove(node)
        self._add_newest(node)
        return node.value

    def put(self, key, value):
        if key in self.nodes:
            self._remove(self.nodes[key])
        node = _Node(key, value)
        self.nodes[key] = node
        self._add_newest(node)
        if len(self.nodes) > self.capacity:
            oldest = self.head.next
            self._remove(oldest)
            del self.nodes[oldest.key]
`,
    cases: [
      {
        name: 'Sample',
        note: 'Reading user:1 makes it recent, so user:2 goes first when user:3 arrives.',
        check: 'replay(LRUCache, capacity, operations)',
      },
      {
        name: 'Updating a key counts as a use',
        note: 'Putting a again makes it recent, so b goes when c arrives.',
        setup:
          'operations = [("put", "a", 1), ("put", "b", 2), ("put", "a", 10), ("put", "c", 3), ("get", "a"), ("get", "b"), ("get", "c")]',
        check: 'replay(LRUCache, capacity, operations)',
      },
      {
        name: 'Capacity of one',
        setup:
          'capacity = 1\noperations = [("put", "a", 1), ("put", "b", 2), ("get", "a"), ("get", "b")]',
        check: 'replay(LRUCache, capacity, operations)',
      },
      {
        name: 'A miss is not a use',
        hidden: true,
        setup:
          'operations = [("put", "a", 1), ("put", "b", 2), ("get", "z"), ("put", "c", 3), ("get", "a"), ("get", "b"), ("get", "c")]',
        check: 'replay(LRUCache, capacity, operations)',
      },
      {
        name: 'Falsy values',
        hidden: true,
        note: '0 and an empty string are values, not misses.',
        setup: 'operations = [("put", "a", 0), ("put", "b", ""), ("get", "a"), ("get", "b")]',
        check: 'replay(LRUCache, capacity, operations)',
      },
      {
        name: 'No OrderedDict',
        hidden: true,
        note: 'The question rules out OrderedDict.',
        check: 'check_no_ordered_dict(LRUCache)',
      },
      {
        name: 'Random traffic',
        hidden: true,
        setup: `import random
rng = random.Random(26)
capacity = 50
operations = []
for i in range(3_000):
    key = rng.randrange(120)
    operations.append(("put", key, i) if rng.random() < 0.4 else ("get", key))`,
        check: 'replay(LRUCache, capacity, operations)',
      },
      {
        name: 'Speed does not grow with size',
        hidden: true,
        note: 'The same 4,000 uses with 200 keys and with 20,000 keys must take about the same time.',
        check: 'check_constant_time(LRUCache)',
      },
    ],
  },

  'dsa-reverse-linked-list': {
    language: 'python',
    task: `Write «reverse_list(head)». Each node has «val» and «next»; the last node's «next» is «None», and an empty list is «None». Reverse the list by changing the «next» links of the existing nodes, and return the new head. Do not create nodes. Long lists must work too.`,
    setup: `class ListNode:
    def __init__(self, val, next=None):
        self.val, self.next = val, next


def build_list(values):
    head = None
    for value in reversed(values):
        head = ListNode(value, head)
    return head


def to_values(head):
    out = []
    while head is not None and len(out) <= 100_000:
        out.append(head.val)
        head = head.next
    return out


values = [1, 2, 3, 4, 5]
head = build_list(values)`,
    helpers: `def check_reverse(fn, values):
    head = build_list(values)
    nodes = []
    node = head
    while node is not None:
        nodes.append(node)
        node = node.next
    got = fn(head)
    order = []
    node = got
    while node is not None:
        if len(order) > len(values):
            return verdict(False, "Your list has a loop: following next never reaches None. The old head must point to None.")
        order.append(node)
        node = node.next
    got_values = [node.val for node in order]
    want = list(reversed(values))
    if got_values != want:
        return verdict(False, f"Expected the values {want[:20]}, got {got_values[:20]}.")
    if [id(node) for node in order] != [id(node) for node in reversed(nodes)]:
        return verdict(False, "The values are right, but the nodes are new or copied. Reverse the next links of the existing nodes instead.")
    return verdict(True)`,
    starter: `def reverse_list(head):
    # Reverse the next links in place and return the new head.
    ...


print(to_values(reverse_list(head)))
`,
    solution: `def reverse_list(head):
    prev = None
    node = head
    while node is not None:
        following = node.next
        node.next = prev
        prev, node = node, following
    return prev
`,
    cases: [
      {
        name: 'Sample',
        note: 'The values come back as 5, 4, 3, 2, 1.',
        check: 'check_reverse(reverse_list, values)',
      },
      {
        name: 'Empty list',
        note: 'Return None for an empty list.',
        setup: 'values = []\nhead = None',
        check: 'check_reverse(reverse_list, values)',
      },
      {
        name: 'Two nodes',
        note: 'The old head must end with next = None, or the list loops.',
        setup: 'values = [1, 2]\nhead = build_list(values)',
        check: 'check_reverse(reverse_list, values)',
      },
      {
        name: 'One node',
        hidden: true,
        setup: 'values = [7]\nhead = build_list(values)',
        check: 'check_reverse(reverse_list, values)',
      },
      {
        name: 'Five thousand nodes',
        hidden: true,
        note: "A recursive reverse goes deeper than Python's limit of 1,000 calls.",
        setup: 'big_values = list(range(5_000))',
        check: 'check_reverse(reverse_list, big_values)',
      },
    ],
  },

  'dsa-fewest-coins': {
    language: 'python',
    task: `Write «fewest_notes(values, amount)». «values» lists note values, and you have as many notes of each as you need. Return the fewest notes that add up to exactly «amount», or «-1» when no mix does. An amount of «0» needs «0» notes. Taking the largest note first does not always work.`,
    setup: `values = [1, 3, 4]
amount = 6`,
    starter: `def fewest_notes(values, amount):
    # Return the fewest notes that make amount exactly, or -1.
    ...


print(fewest_notes(values, amount))
`,
    solution: `def fewest_notes(values, amount):
    INF = float("inf")
    fewest = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for v in values:
            if v <= a and fewest[a - v] + 1 < fewest[a]:
                fewest[a] = fewest[a - v] + 1
    return fewest[amount] if fewest[amount] != INF else -1
`,
    cases: [
      {
        name: 'Sample',
        note: 'Greedy takes 4 + 1 + 1, three notes. 3 + 3 is two.',
        check: 'fewest_notes(values, amount)',
      },
      {
        name: 'Cannot be made',
        setup: 'values = [5, 10]\namount = 3',
        check: 'fewest_notes(values, amount)',
      },
      {
        name: 'Amount zero',
        setup: 'values = [1, 2]\namount = 0',
        check: 'fewest_notes(values, amount)',
      },
      {
        name: 'Real currency values',
        hidden: true,
        note: 'With rupee values greedy works: 200 + 100 + 50 + 20 + 10 + 5 + 2.',
        setup: 'values = [1, 2, 5, 10, 20, 50, 100, 200, 500]\namount = 387',
        check: 'fewest_notes(values, amount)',
      },
      {
        name: 'Large notes only',
        hidden: true,
        note: 'Greedy takes 11 + 11 and is stuck with 3 left. 7 + 7 + 11 works.',
        setup: 'values = [7, 11]\namount = 25',
        check: 'fewest_notes(values, amount)',
      },
      {
        name: 'Values in any order',
        hidden: true,
        setup: 'values = [9, 6, 5, 1]\namount = 11',
        check: 'fewest_notes(values, amount)',
      },
      {
        name: 'A large amount',
        hidden: true,
        setup: 'big_values = [7, 13, 29, 31, 53, 97]',
        check: 'fewest_notes(big_values, 5_000)',
        limitS: 1,
        slowHint:
          'Trying every mix of notes is exponential. Build fewest[a] for every amount a from 0 up: O(amount × values).',
      },
    ],
  },

  'dsa-longest-rising-run': {
    language: 'python',
    task: `Write «longest_rising(values)». Return the length of the longest subsequence of «values» that strictly increases; its items need not be next to each other. Return «0» for an empty list. The O(n²) answer is too slow for the largest test: find the O(n log n) one.`,
    setup: `values = [10, 9, 2, 5, 3, 7, 101, 18]`,
    starter: `def longest_rising(values):
    # Return the length of the longest strictly increasing subsequence.
    ...


print(longest_rising(values))
`,
    solution: `from bisect import bisect_left


def longest_rising(values):
    tails = []
    for value in values:
        i = bisect_left(tails, value)
        if i == len(tails):
            tails.append(value)
        else:
            tails[i] = value
    return len(tails)
`,
    cases: [
      {
        name: 'Sample',
        note: '2, 3, 7, 18 is one rising subsequence of length 4.',
        check: 'longest_rising(values)',
      },
      {
        name: 'Equal values do not rise',
        setup: 'values = [7, 7, 7]',
        check: 'longest_rising(values)',
      },
      {
        name: 'Only adjacent runs is wrong',
        note: 'The best run skips items: 1, 2, 3, 4.',
        setup: 'values = [1, 9, 2, 8, 3, 7, 4]',
        check: 'longest_rising(values)',
      },
      { name: 'Empty list', hidden: true, setup: 'values = []', check: 'longest_rising(values)' },
      {
        name: 'Falling values',
        hidden: true,
        setup: 'values = [5, 4, 3]',
        check: 'longest_rising(values)',
      },
      {
        name: 'Random versions',
        hidden: true,
        setup: `import random
rng = random.Random(28)
values = [rng.randint(0, 300) for _ in range(500)]`,
        check: 'longest_rising(values)',
      },
      {
        name: 'Ten thousand versions',
        hidden: true,
        setup: `import random
rng = random.Random(29)
big_values = [rng.randint(0, 1_000_000) for _ in range(10_000)]`,
        check: 'longest_rising(big_values)',
        limitS: 1,
        slowHint:
          'The O(n²) answer compares every pair. Keep tails[k], the smallest last value of a rising run of length k + 1, and place each value with bisect_left: O(n log n).',
      },
    ],
  },

  'dsa-max-non-adjacent': {
    language: 'python',
    task: `Write «best_total(values)». «values[i]» is the value of running a job in hourly slot «i»; values are not negative. You cannot use two neighbouring slots. Return the best total, or «0» for an empty list. Long lists must work too.`,
    setup: `values = [2, 7, 9, 3, 1]`,
    starter: `def best_total(values):
    # Return the best total with no two neighbouring slots.
    ...


print(best_total(values))
`,
    solution: `def best_total(values):
    take = skip = 0
    for value in values:
        take, skip = skip + value, max(take, skip)
    return max(take, skip)
`,
    cases: [
      {
        name: 'Sample',
        note: 'Slots 0, 2 and 4: 2 + 9 + 1 = 12.',
        check: 'best_total(values)',
      },
      {
        name: 'Skip two in a row',
        note: 'The best uses slots 0 and 3, with two empty slots between them.',
        setup: 'values = [2, 1, 1, 2]',
        check: 'best_total(values)',
      },
      {
        name: 'The biggest slot is left out',
        note: 'Taking 3 blocks both 2s: 2 + 2 is better.',
        setup: 'values = [2, 3, 2]',
        check: 'best_total(values)',
      },
      { name: 'Empty list', hidden: true, setup: 'values = []', check: 'best_total(values)' },
      { name: 'One slot', hidden: true, setup: 'values = [5]', check: 'best_total(values)' },
      { name: 'All zeros', hidden: true, setup: 'values = [0, 0, 0]', check: 'best_total(values)' },
      {
        name: 'Random values',
        hidden: true,
        setup: `import random
rng = random.Random(30)
values = [rng.randint(0, 100) for _ in range(500)]`,
        check: 'best_total(values)',
      },
      {
        name: 'Fifty thousand slots',
        hidden: true,
        note: "A recursive answer goes deeper than Python's limit of 1,000 calls.",
        setup: `import random
rng = random.Random(31)
big_values = [rng.randint(0, 1_000) for _ in range(50_000)]`,
        check: 'best_total(big_values)',
        limitS: 1,
        slowHint:
          'Keep two running totals, the best that uses the current slot and the best that does not: one pass, O(n).',
      },
    ],
  },

  'dsa-merge-identities': {
    language: 'python',
    task: `Write «merge_identities(records)». «records» maps a record id to its list of emails and phone numbers. Two records belong to the same customer when they share a contact, directly or through other records. Return the groups as lists of record ids. The order of the groups, and of the ids in a group, does not matter. It must stay fast for many records.`,
    setup: `records = {
    "r1": ["ana@mail.com", "+91-98100-00001"],
    "r2": ["ben@mail.com"],
    "r3": ["+91-98100-00001", "ana.k@work.com"],
    "r4": ["ana.k@work.com"],
    "r5": ["cara@mail.com", "ben@mail.com"],
    "r6": ["dev@mail.com"],
}`,
    starter: `def merge_identities(records):
    # Return a list of groups; each group is a list of record ids.
    ...


print(merge_identities(records))
`,
    solution: `from collections import defaultdict


def merge_identities(records):
    parent = {record_id: record_id for record_id in records}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # shorten the path
            x = parent[x]
        return x

    owner = {}
    for record_id, contacts in records.items():
        for contact in contacts:
            if contact in owner:
                parent[find(record_id)] = find(owner[contact])
            else:
                owner[contact] = record_id

    groups = defaultdict(list)
    for record_id in records:
        groups[find(record_id)].append(record_id)
    return sorted(sorted(group) for group in groups.values())
`,
    cases: [
      {
        name: 'Sample',
        note: 'r1 and r4 share no contact, but both share one with r3.',
        check: 'merge_identities(records)',
        order: 'nested',
      },
      {
        name: 'A chain of records',
        setup: 'records = {"a": ["x"], "b": ["x", "y"], "c": ["y", "z"], "d": ["z"]}',
        check: 'merge_identities(records)',
        order: 'nested',
      },
      {
        name: 'A record that joins two groups',
        note: 'r3 comes last and joins the group of r1 with the group of r2.',
        setup: 'records = {"r1": ["a"], "r2": ["b"], "r3": ["a", "b"]}',
        check: 'merge_identities(records)',
        order: 'nested',
      },
      {
        name: 'A record with no contacts',
        hidden: true,
        setup: 'records = {"r1": [], "r2": ["a"]}',
        check: 'merge_identities(records)',
        order: 'nested',
      },
      {
        name: 'A contact twice in one record',
        hidden: true,
        setup: 'records = {"r1": ["a", "a"], "r2": ["a"]}',
        check: 'merge_identities(records)',
        order: 'nested',
      },
      {
        name: 'No records',
        hidden: true,
        setup: 'records = {}',
        check: 'merge_identities(records)',
        order: 'nested',
      },
      {
        name: 'Random records',
        hidden: true,
        setup: `import random
rng = random.Random(32)
records = {f"r{i}": [f"c{rng.randrange(3_000)}" for _ in range(rng.randint(0, 3))] for i in range(2_000)}`,
        check: 'merge_identities(records)',
        order: 'nested',
      },
      {
        name: 'Sixty-five hundred records',
        hidden: true,
        setup: `import random
rng = random.Random(33)
big_records = {f"r{i:05d}": [f"c{rng.randrange(13_000)}", f"c{rng.randrange(13_000)}"] for i in range(6_500)}`,
        check: 'merge_identities(big_records)',
        order: 'nested',
        limitS: 1,
        slowHint:
          'Comparing every pair of records is O(n²). Remember the first record that owns each contact, and union the records that share it: close to O(total contacts).',
      },
    ],
  },
};
