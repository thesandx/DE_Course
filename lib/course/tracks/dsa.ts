import type { Company, Problem, Track } from '@/types/course';

/**
 * Data structures and algorithms for the general coding round. The Python
 * track covers data-flavoured coding; this track covers the classic patterns
 * that Google, Amazon, Microsoft and Indian product companies screen with.
 */
export const track: Track = {
  slug: 'dsa',
  title: 'Coding rounds: DSA patterns',
  summary:
    'The eight patterns behind most medium-level coding questions, with a method for the 45 minutes and problems to drill.',
  tone: 'soda',
  why: 'Google, Amazon, Microsoft, Walmart, Flipkart and PhonePe put at least one classic coding round in a data engineer loop. It is a filter: a strong design round does not rescue a failed coding round. The questions are medium level and come from a small set of patterns, so focused practice pays back fast.',
  lessons: [
    {
      slug: 'coding-round-method',
      title: 'How a coding round is scored',
      summary:
        'Run the 45 minutes with a fixed method, and read the input size to find the complexity the interviewer wants.',
      minutes: 12,
      body: `
        A coding round is not a puzzle contest. The interviewer fills a form with four scores:
        **problem solving**, **coding**, **verification** and **communication**. A candidate who
        reaches a working medium solution and explains it well beats a candidate who reaches an
        optimal solution in silence.

        ## The method, minute by minute

        | Minutes | Step | What you say |
        |---|---|---|
        | 0 to 5 | **Clarify** | Input size, value range, duplicates, empty input, sorted or not |
        | 5 to 10 | **Brute force** | "The simple way is two loops, O(n²). Let me find better." |
        | 10 to 15 | **Better idea** | Name the pattern and the data structure, and say the complexity |
        | 15 to 30 | **Code** | Write top to bottom. Use real names. Speak each block's purpose |
        | 30 to 38 | **Test** | Trace one normal case and two edge cases by hand |
        | 38 to 45 | **Follow-up** | Scale, streaming input, or a changed constraint |

        Always state the brute force. It proves you understand the problem, and it is your
        fallback if the better idea fails.

        ## Read the input size

        The constraint tells you the target complexity. A modern machine does about 10⁸ simple
        steps a second.

        | n up to | Target | Typical tool |
        |---|---|---|
        | 20 | O(2ⁿ) | Backtracking, bitmask |
        | 2,000 | O(n²) | Two loops, simple dynamic programming |
        | 100,000 | O(n log n) | Sort, heap, binary search |
        | 10,000,000 | O(n) | Hash map, two pointers, one pass |
        | Larger than memory | O(n) time, O(1) or O(k) space | Streaming, heap of size k |

        ## Pick the pattern from the words

        - "Pair", "seen before", "count of each": **hash map or set**.
        - "Sorted array", "pair that sums": **two pointers**.
        - "Longest or shortest contiguous part": **sliding window**.
        - "Sum of a range", "number of subarrays": **prefix sums**.
        - "Next greater", "matching brackets": **stack**.
        - "Top k", "k-th largest", "median": **heap**.
        - "Sorted", "minimum value that works": **binary search**.
        - "Levels", "shortest path with equal steps": **breadth-first search**.
        - "Dependencies", "order of tasks": **topological sort**.
        - "Number of ways", "best total with choices": **dynamic programming**.

        > [!senior] What a senior answer adds
        > A senior candidate states the trade-off without being asked: "The hash map gives O(n)
        > time for O(n) memory. If memory is tight and I may sort the input, two pointers gives
        > O(n log n) time and O(1) extra memory."

        > [!trap] Silence
        > Five silent minutes read as "stuck". Say what you are trying and why it does not work.
        > Interviewers give hints to candidates who think aloud, and a used hint costs little.
      `,
      checks: [
        {
          question:
            'The input has up to 200,000 numbers. Which complexity should you aim for at most?',
          options: ['O(n²)', 'O(n log n)', 'O(2ⁿ)', 'O(n³)'],
          answer: 1,
          why: 'At n = 200,000, n² is 4 × 10¹⁰ steps, which is far too slow. n log n is about 3.5 million steps.',
        },
        {
          question: 'Why state the brute force before the better idea?',
          options: [
            'It fills the time',
            'It proves you understand the problem and gives a fallback',
            'Interviewers want the slowest answer first',
            'It is always the answer they want',
          ],
          answer: 1,
          why: 'A correct slow solution earns partial credit and is the base you improve from.',
        },
      ],
    },
    {
      slug: 'hashing-pointers-windows',
      title: 'Hash maps, two pointers and sliding windows',
      summary:
        'Solve most array and string questions in one pass with a hash map, two pointers, a window or prefix sums.',
      minutes: 16,
      body: `
        About half of all screening questions use an array or a string, and four techniques
        cover nearly all of them. Each one replaces an inner loop with remembered state.

        ## Hash map: remember what you saw

        The question "have I seen the value I need?" costs O(1) with a set or a dictionary.

        ~~~python
        def has_pair(nums, target):
            seen = set()
            for x in nums:
                if target - x in seen:
                    return True
                seen.add(x)
            return False
        ~~~

        Use «collections.Counter» for counts and «collections.defaultdict(list)» for groups.

        ## Two pointers: use the order

        On **sorted** input, start one pointer at each end. If the sum is too small, move the
        left pointer; if too large, move the right one. Each step removes one candidate, so the
        loop is O(n) with O(1) memory.

        ~~~python
        def pair_in_sorted(nums, target):
            lo, hi = 0, len(nums) - 1
            while lo < hi:
                total = nums[lo] + nums[hi]
                if total == target:
                    return lo, hi
                if total < target:
                    lo += 1
                else:
                    hi -= 1
            return None
        ~~~

        The same idea with a slow and a fast pointer removes duplicates in place and finds a
        cycle in a linked list.

        ## Sliding window: grow right, shrink left

        For the longest or shortest **contiguous** part that meets a rule, keep a window
        «[left, right]». Move «right» one step at a time. While the window breaks the rule, move
        «left». Each index enters and leaves once, so the cost is O(n).

        ~~~python
        def longest_with_k_distinct(s, k):
            count, left, best = {}, 0, 0
            for right, ch in enumerate(s):
                count[ch] = count.get(ch, 0) + 1
                while len(count) > k:
                    count[s[left]] -= 1
                    if count[s[left]] == 0:
                        del count[s[left]]
                    left += 1
                best = max(best, right - left + 1)
            return best
        ~~~

        A window works only when shrinking fixes the rule. With negative numbers in a sum
        problem, it does not; use prefix sums.

        ## Prefix sums: a range in O(1)

        Let «prefix[i]» be the sum of the first «i» values. The sum of «nums[i:j]» is
        «prefix[j] - prefix[i]». To count subarrays with sum «k», walk once and ask how many
        earlier prefixes equal «current - k». A hash map answers that.

        ## Which one?

        | Signal in the question | Technique |
        |---|---|
        | Unsorted, "find a pair" or "duplicates" | Hash map or set |
        | Sorted input, or you may sort | Two pointers |
        | Contiguous, all values positive, "longest" or "shortest" | Sliding window |
        | Contiguous with negatives, or "count subarrays" | Prefix sums with a hash map |

        > [!senior] What a senior answer adds
        > Link it to data work when it is true: "This is a hash join. I build a hash table on
        > one side and probe with the other, which is what Spark does in a broadcast join."
      `,
      checks: [
        {
          question:
            'Count the subarrays whose sum is k. The values can be negative. What fits best?',
          options: [
            'Sliding window',
            'Two pointers on the sorted array',
            'Prefix sums with a hash map',
            'Binary search',
          ],
          answer: 2,
          why: 'With negative values, shrinking a window does not move the sum in one direction. Prefix sums with a map of earlier sums count the subarrays in one pass.',
        },
        {
          question: 'Why is a sliding window O(n) although it has a loop inside a loop?',
          options: [
            'The inner loop runs at most twice',
            'Each index enters the window once and leaves it once',
            'Python optimises it',
            'It is O(n²), in fact',
          ],
          answer: 1,
          why: 'The left pointer only moves forward, so the inner loop does at most n steps in total over the whole run.',
        },
      ],
    },
    {
      slug: 'stacks-queues-heaps',
      title: 'Stacks, queues and heaps',
      summary:
        'Use a stack for the nearest match, a deque for a moving window and a heap for the top k of a stream.',
      minutes: 14,
      body: `
        These three structures answer one question each. A **stack** answers "what is the most
        recent open item?". A **queue** answers "what arrived first?". A **heap** answers "what
        is the smallest or largest right now?".

        ## Stack: the nearest unmatched item

        Brackets, undo, and expression parsing use a plain stack. The stronger form is the
        **monotonic stack**: keep the stack in decreasing order. When a larger value arrives, it
        is the "next greater" answer for every smaller value it pops.

        ~~~python
        def next_greater(nums):
            answer = [-1] * len(nums)
            stack = []  # indexes whose answer is not known yet
            for i, x in enumerate(nums):
                while stack and nums[stack[-1]] < x:
                    answer[stack.pop()] = x
                stack.append(i)
            return answer
        ~~~

        Each index is pushed once and popped once, so the cost is O(n).

        ## Queue and deque

        «collections.deque» adds and removes at both ends in O(1). A list does not:
        «list.pop(0)» is O(n). Use a deque for breadth-first search and for the maximum of a
        moving window, where you keep indexes in decreasing order of value and drop the ones
        that left the window.

        ## Heap: the best item, cheaply

        «heapq» is a **min-heap**. Push and pop cost O(log n); reading the smallest is O(1).

        | Need | How |
        |---|---|
        | k largest of a stream | Min-heap of size k. Pop when it grows past k |
        | k smallest | Push the negated values, or use «heapq.nsmallest» |
        | Merge k sorted lists | Heap of the head of each list |
        | Running median | A max-heap for the low half and a min-heap for the high half |
        | Next event in time | Heap ordered by timestamp |

        ~~~python
        import heapq

        def k_largest(stream, k):
            heap = []
            for x in stream:
                heapq.heappush(heap, x)
                if len(heap) > k:
                    heapq.heappop(heap)
            return sorted(heap, reverse=True)
        ~~~

        The heap holds only k items, so this uses O(k) memory on a stream of any length, at
        O(n log k) time. Sorting everything costs O(n log n) time and O(n) memory.

        > [!senior] What a senior answer adds
        > Name the memory bound: "The input is a stream, so I cannot sort it. A heap of size k
        > keeps memory at O(k)." Then name the distributed form: each partition keeps its own
        > top k, and a final step merges them. That is how «ORDER BY ... LIMIT k» runs in Spark.

        > [!trap] Python has no max-heap
        > Push «-x» and negate again when you pop. For objects, push a tuple such as
        > «(-count, key)».
      `,
      checks: [
        {
          question:
            'You need the 10 largest values from a stream of a billion numbers. Which fits?',
          options: [
            'Sort the stream, take the last 10',
            'A min-heap of size 10',
            'A max-heap of every value',
            'A stack',
          ],
          answer: 1,
          why: 'A min-heap of size 10 keeps memory constant. Its root is the smallest of the current top 10, so a new value replaces it only if it is larger.',
        },
        {
          question: 'Why is a monotonic stack O(n)?',
          options: [
            'The while loop never runs',
            'Each index is pushed once and popped at most once',
            'It sorts the input first',
            'It uses a hash map',
          ],
          answer: 1,
          why: 'The total number of pops cannot exceed the total number of pushes, which is n.',
        },
      ],
    },
    {
      slug: 'binary-search',
      title: 'Binary search, on data and on the answer',
      summary:
        'Write one bug-free binary search template and use it on sorted data and on "smallest value that works" questions.',
      minutes: 12,
      body: `
        Binary search halves the search space at each step, so 1 billion items take about 30
        steps. Most candidates know the idea and still write an endless loop. Learn one
        template and use it everywhere.

        ## One template: the first true

        Think of a row of answers, false then true: «F F F T T T». Find the first «T».

        ~~~python
        def first_true(lo, hi, ok):
            """Smallest x in [lo, hi] with ok(x) true, or hi + 1 if none."""
            while lo <= hi:
                mid = (lo + hi) // 2
                if ok(mid):
                    hi = mid - 1
                else:
                    lo = mid + 1
            return lo
        ~~~

        - First index with «nums[i] >= target»: «ok = lambda i: nums[i] >= target».
        - Last index with «nums[i] <= target»: find the first index with a larger value, minus 1.
        - Python has this built in: «bisect.bisect_left» and «bisect.bisect_right».

        ## Search on the answer

        Many "minimum" and "maximum" questions hide a binary search. The signal is a yes or no
        test that flips once as the value grows.

        "What is the smallest batch size that loads all files in 5 runs?" If size 100 works,
        size 101 works too. So test a size in O(n) and binary search over the sizes.

        | Question | Search range | Test |
        |---|---|---|
        | Smallest capacity to ship in D days | max item to sum of items | Days needed at this capacity <= D |
        | Smallest speed to finish in H hours | 1 to max pile | Hours needed at this speed <= H |
        | Largest minimum gap between k servers | 0 to span | Can I place k with this gap? |

        The cost is O(n log R), where R is the size of the range.

        ## Rotated and unknown-length input

        A sorted array rotated at an unknown point still has one sorted half at each step.
        Check which half is sorted, and whether the target lies inside it. For input of unknown
        length, double the upper bound until you pass the target, then search inside.

        > [!senior] What a senior answer adds
        > Connect it to storage: "Parquet and ORC keep min and max values for each row group,
        > and a sorted file lets the reader skip to the right group. An LSM tree and a B-tree
        > index both find a key by this kind of search."

        > [!trap] Off-by-one
        > State the invariant aloud: "Everything left of «lo» is false, everything right of «hi»
        > is true." Then test on a list of length 1 and length 2 before you say you are done.
      `,
      checks: [
        {
          question: 'Which question can use binary search on the answer?',
          options: [
            'Find all anagrams in a list',
            'Smallest worker count that finishes all jobs by the deadline',
            'Count the islands in a grid',
            'Reverse a linked list',
          ],
          answer: 1,
          why: 'If k workers finish in time, k + 1 workers do too. The test flips once, so you can search over k.',
        },
        {
          question: 'About how many steps does binary search need on 1 billion sorted items?',
          options: ['30', '1,000', '31,623', '1 billion'],
          answer: 0,
          why: '2³⁰ is about 1.07 billion, so 30 halvings reach one item.',
        },
      ],
    },
    {
      slug: 'trees-and-graphs',
      title: 'Trees, graphs and the order of tasks',
      summary:
        'Traverse with breadth-first and depth-first search, sort a dependency graph, and merge groups with union-find.',
      minutes: 17,
      body: `
        Graph questions look hard and follow a small script. A data engineer has an advantage
        here: a pipeline is a **directed acyclic graph**, lineage is a graph, and an org chart
        is a tree. Say so in the interview.

        ## Build the graph first

        Most questions give edges. Turn them into an adjacency list before anything else.

        ~~~python
        from collections import defaultdict, deque

        def build(edges):
            graph = defaultdict(list)
            for a, b in edges:
                graph[a].append(b)
            return graph
        ~~~

        A grid is a graph too: each cell has up to four neighbours.

        ## Breadth-first search: levels and shortest paths

        BFS visits nodes in order of distance from the start. It gives the **shortest path
        when every step costs the same**.

        ~~~python
        def shortest_steps(graph, start, goal):
            seen = {start}
            queue = deque([(start, 0)])
            while queue:
                node, dist = queue.popleft()
                if node == goal:
                    return dist
                for nxt in graph[node]:
                    if nxt not in seen:
                        seen.add(nxt)
                        queue.append((nxt, dist + 1))
            return -1
        ~~~

        Mark a node as seen **when you add it to the queue**, not when you pop it. Otherwise
        the same node enters the queue many times.

        ## Depth-first search: explore and come back

        DFS goes deep first. Use it to count connected groups, to find a cycle, and for most
        tree questions. A tree answer is usually "combine the answers of the left and right
        child". In Python, deep recursion fails at about 1,000 frames, so mention an explicit
        stack for very deep input.

        ## Topological sort: the order of tasks

        Given tasks and "A before B" rules, **Kahn's algorithm** gives a valid order:

        1. Count the incoming edges of each node.
        2. Put every node with a count of 0 in a queue.
        3. Pop a node, add it to the order, and lower the count of each node after it. Queue the
           ones that reach 0.
        4. If the order is shorter than the node count, the graph has a **cycle**.

        This is what Airflow does when it decides which tasks can run.

        ## Union-find: merge groups

        To answer "are these two in the same group?" while groups merge, keep a parent pointer
        for each item. «find» follows the pointers to the root and shortens the path. «union»
        joins two roots. Both are nearly O(1). It fits identity resolution: two records with a
        shared email are one customer.

        | Question | Tool |
        |---|---|
        | Shortest path, equal step cost | BFS |
        | Shortest path with weights | Dijkstra: BFS with a heap |
        | Count groups, detect a cycle | DFS or union-find |
        | Order with dependencies | Topological sort |
        | Merge groups as edges arrive | Union-find |

        > [!senior] What a senior answer adds
        > Give the complexity as O(V + E), and name the real system: "This is lineage impact
        > analysis. A BFS from the changed table finds every downstream dataset."
      `,
      checks: [
        {
          question: 'Tasks have "must run before" rules. How do you find a valid run order?',
          options: ['Binary search', 'Topological sort', 'Sliding window', 'A max-heap of tasks'],
          answer: 1,
          why: 'A topological sort orders the nodes of a directed acyclic graph so that every edge points forward. It also detects a cycle.',
        },
        {
          question: 'In BFS, when do you mark a node as seen?',
          options: [
            'When you pop it from the queue',
            'When you add it to the queue',
            'After the whole search ends',
            'Never; BFS needs no seen set',
          ],
          answer: 1,
          why: 'Marking on add stops the same node from entering the queue several times through different neighbours.',
        },
      ],
    },
    {
      slug: 'dynamic-programming',
      title: 'Dynamic programming without fear',
      summary:
        'Turn a "best total" or "number of ways" question into a state, a recurrence and a small table.',
      minutes: 15,
      body: `
        Dynamic programming is recursion that remembers. Data engineer loops ask it less than
        software engineer loops, and mostly in one dimension. Five steps solve these questions.

        ## The five steps

        1. **State.** What does one subproblem mean? "«best[i]» is the best total using the
           first «i» items."
        2. **Choice.** What are the options at step «i»? Take it or skip it.
        3. **Recurrence.** Write «best[i]» from smaller states.
        4. **Base case.** The answer for 0 or 1 items.
        5. **Order.** Fill the table so that each state is ready before you need it.

        ## Example: the best sum with no two neighbours

        You cannot pick two adjacent values. At each value you either skip it, and keep the best
        so far, or take it, and add it to the best from two steps back.

        ~~~python
        def best_non_adjacent(nums):
            take, skip = 0, 0  # best total if the last value is taken, or skipped
            for x in nums:
                take, skip = skip + x, max(take, skip)
            return max(take, skip)
        ~~~

        The table needs only the last two states, so memory is O(1).

        ## Example: the fewest coins

        «fewest[a]» is the fewest coins that make amount «a». For each coin «c»,
        «fewest[a] = min(fewest[a - c] + 1)».

        ~~~python
        def fewest_coins(coins, amount):
            INF = float("inf")
            fewest = [0] + [INF] * amount
            for a in range(1, amount + 1):
                for c in coins:
                    if c <= a and fewest[a - c] + 1 < fewest[a]:
                        fewest[a] = fewest[a - c] + 1
            return fewest[amount] if fewest[amount] != INF else -1
        ~~~

        A greedy choice of the largest coin fails here: with coins 1, 3 and 4, amount 6 is two
        coins of 3, and greedy gives 4 + 1 + 1.

        ## Top-down is fine

        Write the recursion and add «functools.lru_cache». It is the same algorithm, and many
        people find it easier to get right under pressure.

        | Family | State | Examples |
        |---|---|---|
        | Linear | index | Climb stairs, non-adjacent sum, decode ways |
        | Unbounded choice | amount | Fewest coins, number of ways to pay |
        | Two sequences | (i, j) | Longest common subsequence, edit distance |
        | Grid | (row, col) | Paths in a grid, minimum path cost |
        | Subsequence | index, last value | Longest increasing subsequence |

        > [!senior] What a senior answer adds
        > Say the state in one sentence before you code, then give time and space: "States
        > times choices: O(amount × coins) time and O(amount) space."

        > [!trap] DP when greedy or a heap is enough
        > Try a simpler idea first and test it on a small counter-example. Use dynamic
        > programming when the choices at one step change the options at later steps.
      `,
      checks: [
        {
          question: 'What is the first thing to define in a dynamic programming answer?',
          options: [
            'The loop order',
            'The state: what one subproblem means',
            'The space optimisation',
            'The test cases',
          ],
          answer: 1,
          why: 'Everything else follows from the state. A clear state makes the recurrence and the base case short.',
        },
        {
          question: 'Coins are 1, 3 and 4. Why does greedy fail for amount 6?',
          options: [
            'Greedy gives 4 + 1 + 1, three coins; 3 + 3 is two',
            'Greedy cannot make 6',
            'Greedy is too slow',
            'Greedy needs a sorted list',
          ],
          answer: 0,
          why: 'Taking the largest coin first blocks the better pair of 3s. The choice at one step changes later options, which calls for dynamic programming.',
        },
      ],
    },
    {
      slug: 'linked-lists-and-design',
      title: 'Linked lists and small design questions',
      summary:
        'Handle pointer questions with a dummy node, and build an LRU cache from a hash map and an ordered list.',
      minutes: 12,
      body: `
        The last group of screening questions asks you to **build a small data structure**:
        a cache, a rate limiter, a hit counter. They test clean code more than algorithms.
        Linked lists appear here as a building block.

        ## Linked list rules

        - Draw three boxes and the arrows before you code.
        - Use a **dummy head** node, so the first real node is not a special case.
        - To reverse, walk once with three names: «prev», «node» and «nxt».
        - A slow pointer and a fast pointer find the middle, and find a cycle.

        ~~~python
        class Node:
            def __init__(self, val, nxt=None):
                self.val, self.nxt = val, nxt

        def reverse(head):
            prev = None
            node = head
            while node:
                nxt = node.nxt
                node.nxt = prev
                prev, node = node, nxt
            return prev
        ~~~

        ## The LRU cache

        A cache with a size limit drops the **least recently used** key. Both «get» and «put»
        must be O(1). The classic answer joins two structures:

        - a **hash map** from key to node, for O(1) lookup;
        - a **doubly linked list** in order of use, for O(1) move-to-front and remove-from-back.

        In Python, «collections.OrderedDict» is exactly this pair. Use it, and say what is
        inside, so the interviewer knows you could build it.

        ~~~python
        from collections import OrderedDict

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
        ~~~

        ## Machine coding rounds

        Some Indian product companies run a 90 minute **machine coding** round: build a small
        working program, such as a parking lot, a rate limiter or an in-memory key-value store.
        The score is for working code first, then for structure.

        1. Read the whole statement and list the commands it must support. 10 minutes.
        2. Name the entities and write the classes with empty methods. 10 minutes.
        3. Make one path work end to end, then add the others. 50 minutes.
        4. Handle the bad input cases, then clean the names. 20 minutes.

        > [!senior] What a senior answer adds
        > Ask the production questions: "Is this cache shared between threads? Then «get» and
        > «put» need a lock. Does an entry expire? Then each node carries a timestamp."

        > [!tip] Where you see it at work
        > A database buffer pool, a CDN and the Spark block manager all evict by recent use.
      `,
      checks: [
        {
          question: 'Which pair of structures gives an LRU cache O(1) get and put?',
          options: [
            'A hash map and a doubly linked list',
            'A sorted array and binary search',
            'Two stacks',
            'A min-heap and a set',
          ],
          answer: 0,
          why: 'The map finds the node in O(1). The doubly linked list moves it to the front and removes the oldest from the back in O(1).',
        },
        {
          question: 'Why use a dummy head node in a linked list question?',
          options: [
            'It makes the list faster',
            'It removes the special case for the first real node',
            'Python requires it',
            'It saves memory',
          ],
          answer: 1,
          why: 'With a dummy head, insert and delete at the front use the same code as anywhere else.',
        },
      ],
    },
  ],
};

/** The loops that include a classic coding round. */
const CODING_LOOPS: readonly Company[] = [
  'google',
  'amazon',
  'microsoft',
  'flipkart',
  'walmart',
  'phonepe',
];

export const problems: readonly Problem[] = [
  {
    slug: 'dsa-pair-with-target',
    title: 'Two payments that sum to a refund',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'easy',
    companies: CODING_LOOPS,
    prompt: `
      You have a list of payment amounts in paise, as integers, and a refund amount. Return the
      indexes of two different payments that sum to the refund exactly, or «None». The list is
      not sorted and can hold 10 million values.
    `,
    hints: [
      'Two loops are O(n²). At 10 million values that is too slow.',
      'For each amount, which other amount do you need? Can you look it up in O(1)?',
    ],
    answer: `
      Keep a dictionary from each amount seen so far to its index. For each amount, look up the
      amount that completes the pair.

      ~~~python
      def pair_with_target(amounts, target):
          seen = {}
          for i, amount in enumerate(amounts):
              need = target - amount
              if need in seen:
                  return seen[need], i
              seen[amount] = i
          return None
      ~~~

      One pass: **O(n) time, O(n) memory**. The lookup comes before the insert, so a payment
      never pairs with itself, and two equal payments still work.

      If memory is the limit and you may reorder, sort a list of (amount, index) pairs and use
      two pointers: O(n log n) time and no hash map.
    `,
    signals: [
      'States the O(n²) brute force first',
      'Uses a hash map and looks up before inserting',
      'Handles duplicates and the "same element twice" case',
      'Offers the sort and two pointers trade-off',
    ],
    followUps: [
      'The amounts do not fit in memory. How do you find a pair?',
      'Return every pair, not only one. What changes?',
    ],
  },
  {
    slug: 'dsa-balanced-brackets',
    title: 'Check that brackets are balanced',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'easy',
    companies: CODING_LOOPS,
    prompt: `
      A config validator receives a string that holds the brackets «( ) [ ] { }» and other
      characters. Return «True» if every bracket closes in the right order.
    `,
    hints: [
      'The most recent open bracket must close first.',
      'Use a stack. What do you check when the string ends?',
    ],
    answer: `
      Push each open bracket. On a close bracket, the top of the stack must be its partner.

      ~~~python
      def is_balanced(text):
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
      ~~~

      **O(n) time, O(n) memory** in the worst case. Three cases fail: a close with an empty
      stack, a close of the wrong kind, and open brackets left over at the end.

      A real validator must also skip brackets inside quoted strings. Say so, and ask whether
      it is in scope.
    `,
    signals: [
      'Uses a stack and a partner map, not a chain of if statements',
      'Checks the empty stack before the pop',
      'Returns false for leftover open brackets',
      'Raises brackets inside strings as a real-world case',
    ],
    followUps: ['Return the position of the first error instead of a boolean.'],
  },
  {
    slug: 'dsa-first-bad-partition',
    title: 'Find the first bad partition',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'easy',
    companies: CODING_LOOPS,
    prompt: `
      A table has «n» daily partitions, numbered 0 to n - 1. A bug started on one day, and every
      partition from that day on is bad. «is_bad(i)» runs a slow validation query. Find the first
      bad partition with as few calls as you can. Return «n» if none is bad.
    `,
    hints: [
      'The answers look like good, good, good, bad, bad.',
      'Halve the range at each step. Keep an invariant for what lies left and right.',
    ],
    answer: `
      The partitions are ordered "good then bad", so binary search finds the boundary.

      ~~~python
      def first_bad(n, is_bad):
          lo, hi = 0, n - 1
          while lo <= hi:
              mid = (lo + hi) // 2
              if is_bad(mid):
                  hi = mid - 1
              else:
                  lo = mid + 1
          return lo
      ~~~

      Invariant: everything left of «lo» is good, everything right of «hi» is bad. When the
      loop ends, «lo» is the first bad partition. That is about **log₂ n calls**: 10 for three
      years of days, where a linear scan needs up to 1,095.

      This is how «git bisect» finds a bad commit.
    `,
    signals: [
      'Sees the monotonic good-then-bad shape',
      'States the loop invariant',
      'Counts calls to the slow function, not only big-O',
      'Handles "none bad" and "all bad"',
    ],
    followUps: ['The validation is flaky and is wrong 5 percent of the time. How do you adapt?'],
  },
  {
    slug: 'dsa-best-single-trade',
    title: 'Largest price rise in one pass',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'easy',
    companies: CODING_LOOPS,
    prompt: `
      A list holds the price of an item at the end of each day. Return the largest rise from an
      earlier day to a later day, or 0 if the price never rises.
    `,
    hints: [
      'For each day, the best buy day is the cheapest day before it.',
      'Carry the minimum so far in one variable.',
    ],
    answer: `
      Track the lowest price so far. At each day, the best rise that ends today is today's
      price minus that minimum.

      ~~~python
      def largest_rise(prices):
          best = 0
          lowest = float("inf")
          for price in prices:
              lowest = min(lowest, price)
              best = max(best, price - lowest)
          return best
      ~~~

      **O(n) time, O(1) memory.** The brute force tests every pair in O(n²).

      In SQL this is a running minimum: «price - MIN(price) OVER (ORDER BY day ROWS UNBOUNDED
      PRECEDING)», then the maximum of that column.
    `,
    signals: [
      'Reduces the pair search to a running minimum',
      'Returns 0 for a falling or empty list',
      'Gives the window function form in SQL',
    ],
    followUps: ['Allow two separate buy and sell pairs. How does the state change?'],
  },
  {
    slug: 'dsa-longest-unique-window',
    title: 'Longest run of distinct pages',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      A session is a list of page ids in visit order. Find the length of the longest contiguous
      run in which no page repeats.
    `,
    hints: [
      'Contiguous and "longest" suggest a sliding window.',
      'When a page repeats, where must the window start?',
      'Store the last index of each page, and never move the left edge backwards.',
    ],
    answer: `
      Keep a window with no repeats. Remember the last index of each page. When a page repeats
      inside the window, move the left edge to one past its earlier position.

      ~~~python
      def longest_distinct_run(pages):
          last = {}
          left = best = 0
          for right, page in enumerate(pages):
              if page in last and last[page] >= left:
                  left = last[page] + 1
              last[page] = right
              best = max(best, right - left + 1)
          return best
      ~~~

      **O(n) time**, and memory in proportion to the number of distinct pages. The test
      «last[page] >= left» matters: an old position outside the window must not pull the left
      edge back.
    `,
    signals: [
      'Chooses a sliding window and says why',
      'Jumps the left edge instead of stepping one by one',
      'Guards against a stale index outside the window',
      'Tests an empty list and a list of one repeated page',
    ],
    followUps: ['Allow each page at most twice in the run.'],
  },
  {
    slug: 'dsa-subarray-sum-k',
    title: 'Count periods with a net change of k',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      A list holds the net stock change of each hour. Values can be negative. Count the
      contiguous periods whose total change is exactly «k».
    `,
    hints: [
      'Negative values break a sliding window.',
      'The sum of a period is a difference of two prefix sums.',
      'For the current prefix sum s, how many earlier prefixes equal s - k?',
    ],
    answer: `
      Let «s» be the running sum. A period that ends here has total «k» when some earlier
      prefix sum equals «s - k». Count the earlier prefix sums in a dictionary.

      ~~~python
      from collections import defaultdict

      def count_periods(changes, k):
          seen = defaultdict(int)
          seen[0] = 1  # the empty prefix
          total = count = 0
          for change in changes:
              total += change
              count += seen[total - k]
              seen[total] += 1
          return count
      ~~~

      **O(n) time and O(n) memory.** The entry «seen[0] = 1» counts the periods that start at
      index 0. Add to «count» before you store the current sum, or «k = 0» counts empty periods.
    `,
    signals: [
      'Explains why the window fails with negative values',
      'Derives the prefix sum identity',
      'Seeds the map with the empty prefix',
      'Orders the lookup before the insert',
    ],
    followUps: ['Return the longest such period instead of the count.'],
  },
  {
    slug: 'dsa-group-anagram-keys',
    title: 'Group column names that are anagrams',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      Given a list of lowercase words, group the words that use the same letters the same number
      of times. Return the groups in any order.
    `,
    hints: [
      'Two anagrams must map to the same key.',
      'The sorted letters are one such key. A tuple of 26 counts is another.',
    ],
    answer: `
      Give every word a **canonical key** that all its anagrams share, and group by the key.

      ~~~python
      from collections import defaultdict

      def group_anagrams(words):
          groups = defaultdict(list)
          for word in words:
              counts = [0] * 26
              for ch in word:
                  counts[ord(ch) - ord("a")] += 1
              groups[tuple(counts)].append(word)
          return list(groups.values())
      ~~~

      With n words of length up to m this is **O(n × m)**. A sorted-letters key is simpler to
      write and costs O(n × m log m); either is accepted if you state the cost.

      The idea is general: to group things that are "equal under some rule", normalise each
      one and use the result as a hash key. Deduplicating addresses works the same way.
    `,
    signals: [
      'Names the canonical key idea',
      'Uses a hashable key: a tuple or a string, not a list',
      'Compares the count key and the sorted key by cost',
      'Links it to normalisation in deduplication',
    ],
    followUps: ['The words do not fit on one machine. How do you group them in Spark?'],
  },
  {
    slug: 'dsa-product-except-self',
    title: 'Product of all other values',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      Given a list of integers, return a list where position «i» holds the product of every
      value except the one at «i». Do not use division. Run in O(n).
    `,
    hints: [
      'The answer at i is (product of everything left of i) times (product of everything right of i).',
      'Fill the left products in one pass, then multiply by the right products in a second pass.',
    ],
    answer: `
      Make one pass from the left to store the product of everything before each index. Make
      one pass from the right with a running product of everything after it.

      ~~~python
      def product_except_self(nums):
          result = [1] * len(nums)
          for i in range(1, len(nums)):
              result[i] = result[i - 1] * nums[i - 1]
          right = 1
          for i in range(len(nums) - 1, -1, -1):
              result[i] *= right
              right *= nums[i]
          return result
      ~~~

      **O(n) time, O(1) extra memory** beyond the output. Division fails when a value is 0,
      which is why the question forbids it. This version needs no special case for zeros.
    `,
    signals: [
      'Splits the answer into a prefix part and a suffix part',
      'Reuses the output list to keep extra memory at O(1)',
      'Explains why division is unsafe with zeros',
    ],
    followUps: ['How many zeros make every output 0?'],
  },
  {
    slug: 'dsa-next-higher-latency',
    title: 'Minutes until latency gets worse',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      A list holds the p99 latency of each minute. For each minute, return how many minutes
      pass until a strictly higher latency appears, or 0 if none does.
    `,
    hints: [
      'The brute force looks ahead from every minute: O(n²).',
      'Keep the minutes that still wait for an answer. In what order are their latencies?',
    ],
    answer: `
      Keep a stack of minutes that have no answer yet. Their latencies are in decreasing order.
      A new, higher value answers every lower minute on top of the stack.

      ~~~python
      def minutes_until_higher(latency):
          wait = [0] * len(latency)
          stack = []
          for i, value in enumerate(latency):
              while stack and latency[stack[-1]] < value:
                  j = stack.pop()
                  wait[j] = i - j
              stack.append(i)
          return wait
      ~~~

      **O(n) time**: each minute is pushed once and popped at most once. Store indexes, not
      values, because the answer is a distance.
    `,
    signals: [
      'Recognises the "next greater element" pattern',
      'Keeps indexes on a monotonic stack',
      'Explains the O(n) bound by counting pushes and pops',
      'Gets "strictly higher" right for equal values',
    ],
    followUps: ['The latencies arrive as a stream. What can you output, and when?'],
  },
  {
    slug: 'dsa-window-maximum',
    title: 'Maximum of every window of size k',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'hard',
    companies: CODING_LOOPS,
    prompt: `
      Given a list of readings and a window size «k», return the maximum of every contiguous
      window of «k» readings. The list has 5 million readings and «k» can be 100,000.
    `,
    hints: [
      'Recomputing each window is O(n × k): too slow here.',
      'A reading that is older and smaller than a newer one can never be a maximum again.',
      'Keep a deque of indexes in decreasing order of value.',
    ],
    answer: `
      Keep a deque of indexes whose values decrease from front to back. The front is always the
      maximum of the current window.

      ~~~python
      from collections import deque

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
      ~~~

      **O(n) time, O(k) memory.** Each index enters and leaves the deque once. A max-heap also
      works at O(n log n), with lazy removal of indexes that left the window; offer it as the
      simpler fallback.
    `,
    signals: [
      'Rejects the O(n × k) scan with numbers',
      'Explains why smaller, older values can be dropped',
      'Removes expired indexes from the front',
      'Mentions the heap alternative and its cost',
    ],
    followUps: ['How does a streaming engine compute a sliding-window maximum over event time?'],
  },
  {
    slug: 'dsa-kth-largest-stream',
    title: 'The k-th largest order value so far',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      Order values arrive one at a time and never stop. After each one, report the k-th largest
      value seen so far, or «None» while fewer than «k» have arrived. Design a class with an
      «add(value)» method.
    `,
    hints: [
      'You cannot store or sort the whole stream.',
      'Which k values matter? Which one of them is the answer?',
    ],
    answer: `
      Keep the k largest values in a **min-heap**. Its root is the smallest of them, which is
      the k-th largest overall.

      ~~~python
      import heapq

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
      ~~~

      Each «add» is **O(log k)** and memory stays at **O(k)** for a stream of any length.
      «heapreplace» pops and pushes in one step.
    `,
    signals: [
      'Uses a min-heap of size k, not a max-heap of everything',
      'Explains why the root is the answer',
      'Handles fewer than k values',
      'States the memory bound for an endless stream',
    ],
    followUps: ['The stream is split over 200 partitions. How do you get the global k-th largest?'],
  },
  {
    slug: 'dsa-running-median',
    title: 'Running median of delivery times',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'hard',
    companies: CODING_LOOPS,
    prompt: `
      Delivery times arrive one at a time. After each one, return the median of all times so
      far. Each update must be faster than O(n).
    `,
    hints: [
      'The median sits between the low half and the high half.',
      'You need the largest of the low half and the smallest of the high half.',
      'Use two heaps and keep their sizes within one of each other.',
    ],
    answer: `
      Split the values into a low half in a **max-heap** and a high half in a **min-heap**.
      Keep the low half the same size as the high half, or one larger.

      ~~~python
      import heapq

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
      ~~~

      Each update is **O(log n)**, and reading the median is O(1). Pushing through the low heap
      first keeps every low value at or below every high value.

      At real scale an exact median needs all the data. Production systems use a sketch, such
      as t-digest behind «approx_percentile», with a known error.
    `,
    signals: [
      'Chooses two heaps and states the size invariant',
      'Handles the even and odd counts',
      'Negates values for the max-heap in Python',
      'Raises approximate quantiles for large data',
    ],
    followUps: ['Now the median must cover only the last hour. What breaks?'],
  },
  {
    slug: 'dsa-rotated-log-search',
    title: 'Search a rotated sorted list',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      A ring buffer holds distinct timestamps in increasing order, but the start is at an
      unknown position, for example «[40, 50, 60, 10, 20, 30]». Return the index of a target
      timestamp in O(log n), or -1.
    `,
    hints: [
      'Cut the list in the middle. At least one half is sorted.',
      'You can tell which half is sorted by comparing its two ends.',
      'If the target lies inside the sorted half, go there. Otherwise go to the other half.',
    ],
    answer: `
      At every step, one of the two halves is fully sorted. Check whether the target is inside
      that half; if not, it must be in the other one.

      ~~~python
      def search_rotated(nums, target):
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
      ~~~

      **O(log n).** The «<=» in «nums[lo] <= nums[mid]» covers the case where «lo» and «mid»
      are the same index. With duplicates, the test can be undecided and the worst case
      becomes O(n).
    `,
    signals: [
      'States that one half is always sorted',
      'Gets the inclusive and exclusive bounds right',
      'Tests lists of length 1 and 2',
      'Knows that duplicates break the O(log n) bound',
    ],
    followUps: ['Find the index of the smallest timestamp, the rotation point.'],
  },
  {
    slug: 'dsa-smallest-batch-size',
    title: 'Smallest batch size that meets the deadline',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      Files must load in their given order. A run loads consecutive files whose total size is
      at most the batch size. You have at most «runs» runs. Return the smallest batch size that
      loads every file. Example: sizes «[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]» with 5 runs gives 15.
    `,
    hints: [
      'If batch size B works, does B + 1 work?',
      'What are the smallest and the largest sizes worth testing?',
      'Count the runs for a given size with one greedy pass.',
    ],
    answer: `
      A larger batch size never needs more runs, so the test "does this size fit in the runs?"
      flips once. Binary search over the size.

      ~~~python
      def smallest_batch_size(sizes, runs):
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
      ~~~

      The range starts at the largest file, because a smaller batch cannot hold it, and ends at
      the total, which is one run. **O(n log S)** where S is the sum of the sizes.
    `,
    signals: [
      'Spots the monotonic yes or no test',
      'Chooses correct lower and upper bounds',
      'Writes the greedy feasibility check in O(n)',
      'Uses a loop form that cannot run forever',
    ],
    followUps: ['The files may load in any order. Why is the problem now much harder?'],
  },
  {
    slug: 'dsa-count-clusters',
    title: 'Count the outage regions in a grid',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      A grid of 0 and 1 marks the map cells with an outage. Cells that touch up, down, left or
      right belong to one region. Count the regions.
    `,
    hints: [
      'Treat each cell as a node with up to four neighbours.',
      'When you find an unvisited 1, flood its whole region, then count one.',
    ],
    answer: `
      Scan the grid. Each time you meet an unvisited outage cell, count one region and visit
      every cell connected to it.

      ~~~python
      def count_regions(grid):
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
      ~~~

      **O(rows × cols)** time and memory. An explicit stack avoids Python's recursion limit on
      a large region. Ask before you change the input grid to mark visited cells.
    `,
    signals: [
      'Models the grid as a graph',
      'Marks cells as seen when they are added, not when popped',
      'Uses an explicit stack or BFS for large regions',
      'Asks whether the input may be modified',
    ],
    followUps: ['The grid has a billion cells in a table. How do you find regions in Spark?'],
  },
  {
    slug: 'dsa-task-order',
    title: 'Order pipeline tasks by their dependencies',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      You get a list of task names and a list of pairs «(before, after)». Return an order in
      which every task runs after the tasks it depends on. If the rules contain a cycle, return
      «None».
    `,
    hints: [
      'Which tasks can run first?',
      'When a task finishes, which tasks become ready?',
      'How do you know that a cycle exists?',
    ],
    answer: `
      Use Kahn's algorithm: repeatedly run a task that has no unfinished dependency.

      ~~~python
      from collections import defaultdict, deque

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
      ~~~

      **O(tasks + rules).** If a cycle exists, its tasks never reach a count of 0, so the order
      comes out short. Every task that is in «ready» at the same time can run in parallel,
      which is how an orchestrator schedules a DAG.
    `,
    signals: [
      'Names topological sort and builds in-degree counts',
      'Detects the cycle by comparing lengths',
      'Gives O(V + E)',
      'Connects ready tasks to parallel scheduling in an orchestrator',
    ],
    followUps: [
      'Each task has a duration and you have unlimited workers. What is the shortest total time?',
    ],
  },
  {
    slug: 'dsa-shortest-grid-path',
    title: 'Shortest route through a warehouse',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      A warehouse is a grid where 0 is a free cell and 1 is a shelf. A robot moves up, down,
      left or right. Return the fewest moves from the top-left cell to the bottom-right cell,
      or -1 if no route exists.
    `,
    hints: [
      'Every move costs the same. Which search gives the shortest path then?',
      'Store the distance with each queued cell.',
    ],
    answer: `
      Every move costs 1, so breadth-first search reaches each cell by a shortest route first.

      ~~~python
      from collections import deque

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
      ~~~

      **O(rows × cols).** Depth-first search finds a route, but not the shortest one. If cells
      had different costs, use Dijkstra with a heap.
    `,
    signals: [
      'Chooses BFS because the step cost is equal',
      'Checks blocked start and end cells',
      'Uses a deque, not list.pop(0)',
      'Names Dijkstra for weighted moves',
    ],
    followUps: ['The robot may remove one shelf. How does the state change?'],
  },
  {
    slug: 'dsa-tree-levels',
    title: 'Head count at each level of the org tree',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'easy',
    companies: CODING_LOOPS,
    prompt: `
      A dictionary maps each manager to the list of people who report to them. Given the name
      of the top person, return the number of people at each level, top first.
    `,
    hints: [
      'Process the tree one level at a time.',
      'The queue length at the start of a round is the level size.',
    ],
    answer: `
      Walk the tree level by level. At the start of each round, everyone in the queue is on
      the same level.

      ~~~python
      def level_counts(reports, top):
          counts = []
          level = [top]
          while level:
              counts.append(len(level))
              level = [person for manager in level for person in reports.get(manager, [])]
          return counts
      ~~~

      **O(n)** for n people. Building the next level as a new list keeps the code short and
      avoids a queue with level markers.

      In SQL this is a recursive CTE that carries a «depth» column, then «GROUP BY depth».
    `,
    signals: [
      'Uses level-order traversal',
      'Handles people with no reports through a default',
      'Gives the recursive CTE form',
    ],
    followUps: ['The data has a loop by mistake: A reports to B and B to A. How do you stay safe?'],
  },
  {
    slug: 'dsa-common-upstream',
    title: 'Nearest shared manager of two people',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      A dictionary maps each person to their manager. The top person maps to «None». Given two
      people, return the nearest person who is above both of them, or is one of them.
    `,
    hints: [
      'Walk up from the first person and remember everyone on the path.',
      'Then walk up from the second person until you meet that path.',
    ],
    answer: `
      Collect the chain of the first person up to the top. Then climb from the second person
      until you reach someone in that chain.

      ~~~python
      def nearest_shared_manager(manager_of, a, b):
          chain = set()
          while a is not None:
              chain.add(a)
              a = manager_of.get(a)
          while b is not None:
              if b in chain:
                  return b
              b = manager_of.get(b)
          return None
      ~~~

      **O(h)** time and memory, where h is the height of the tree. This is the lowest common
      ancestor with parent pointers. Without parent pointers, a depth-first search from the
      root returns the node where the two targets first appear in different subtrees.

      The same walk on a lineage graph finds the nearest dataset that two reports share.
    `,
    signals: [
      'Recognises lowest common ancestor',
      'Uses the parent pointers instead of a search from the root',
      'Covers the case where one person manages the other',
      'States the cost in terms of the height',
    ],
    followUps: ['You get a million such queries on a static tree. What do you precompute?'],
  },
  {
    slug: 'dsa-lru-cache',
    title: 'Build an LRU cache',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      Build a cache with a fixed capacity. «get(key)» returns the value or «None». «put(key,
      value)» stores it. When the cache is full, «put» removes the least recently used key.
      Both must be O(1). Do not use «OrderedDict».
    `,
    hints: [
      'A dictionary gives O(1) lookup, but has no cheap "oldest" or "move to newest".',
      'A doubly linked list removes and inserts a known node in O(1).',
      'Two dummy nodes, head and tail, remove the edge cases.',
    ],
    answer: `
      Join a dictionary, key to node, with a doubly linked list in order of use. The newest
      node sits before the tail and the oldest after the head.

      ~~~python
      class _Node:
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
      ~~~

      Each node stores its key, so eviction can delete the dictionary entry. For shared use,
      guard «get» and «put» with one lock; «get» changes the list, so it is a write.
    `,
    signals: [
      'Combines a hash map with a doubly linked list',
      'Uses dummy head and tail nodes',
      'Stores the key in the node for eviction',
      'Notes that get is a write and needs a lock under threads',
    ],
    followUps: ['Add a time to live for each entry.', 'How does an LFU cache differ?'],
  },
  {
    slug: 'dsa-reverse-linked-list',
    title: 'Reverse a linked list in place',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'easy',
    companies: CODING_LOOPS,
    prompt: `
      Each node has «val» and «next». Reverse the list without creating new nodes, and return
      the new head.
    `,
    hints: [
      'Walk the list once and turn each arrow around.',
      'Save the next node before you overwrite the pointer.',
    ],
    answer: `
      Walk once with three names. Save the next node, point the current node backwards, then
      step forward.

      ~~~python
      class ListNode:
          def __init__(self, val, next=None):
              self.val, self.next = val, next

      def reverse_list(head):
          prev = None
          node = head
          while node is not None:
              following = node.next
              node.next = prev
              prev, node = node, following
          return prev
      ~~~

      **O(n) time, O(1) memory.** A recursive version is short but uses O(n) stack and fails in
      Python past about 1,000 nodes. Trace a list of three nodes by hand before you say it works.
    `,
    signals: [
      'Saves the next pointer before overwriting',
      'Returns prev, not node',
      'Handles the empty list and one node',
      'Knows the stack cost of the recursive form',
    ],
    followUps: ['Reverse only the nodes from position m to position n.'],
  },
  {
    slug: 'dsa-fewest-coins',
    title: 'Fewest notes to pay a cash amount',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      Given a list of note values and an amount, return the fewest notes that make the amount
      exactly, or -1 if it cannot be made. You have unlimited notes of each value. Example:
      values «[1, 3, 4]» and amount 6 give 2.
    `,
    hints: [
      'Greedy with the largest note fails on the example. Why?',
      'Define fewest[a] as the answer for amount a.',
      'fewest[a] is 1 plus the best of fewest[a - v] over each value v.',
    ],
    answer: `
      Greedy picks 4 + 1 + 1, three notes, and the best is 3 + 3. So build the answer for every
      amount from 0 upwards.

      ~~~python
      def fewest_notes(values, amount):
          INF = float("inf")
          fewest = [0] + [INF] * amount
          for a in range(1, amount + 1):
              for v in values:
                  if v <= a and fewest[a - v] + 1 < fewest[a]:
                      fewest[a] = fewest[a - v] + 1
          return fewest[amount] if fewest[amount] != INF else -1
      ~~~

      State: «fewest[a]» is the fewest notes for amount «a». **O(amount × values) time and
      O(amount) memory.** Real currencies are designed so that greedy works; the question uses
      values where it does not.
    `,
    signals: [
      'Shows a counter-example to greedy',
      'States the state and the recurrence in words first',
      'Handles the impossible amount',
      'Gives time and space',
    ],
    followUps: ['Count the number of different ways to make the amount.'],
  },
  {
    slug: 'dsa-longest-rising-run',
    title: 'Longest rising subsequence of versions',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'hard',
    companies: CODING_LOOPS,
    prompt: `
      A list holds version numbers in arrival order. Return the length of the longest
      subsequence, not necessarily contiguous, that strictly increases. Give the O(n²) answer,
      then an O(n log n) answer.
    `,
    hints: [
      'O(n²): best[i] is the longest rising subsequence that ends at i.',
      'For O(n log n): keep, for each length, the smallest value that can end a subsequence of that length.',
      'That list is sorted, so you can binary search it.',
    ],
    answer: `
      The simple answer: «best[i] = 1 + max(best[j])» over earlier «j» with a smaller value.
      That is O(n²).

      The fast answer keeps a list «tails», where «tails[k]» is the smallest value that ends
      a rising subsequence of length «k + 1». The list stays sorted. Each new value replaces the
      first tail that is not smaller than it, or extends the list.

      ~~~python
      from bisect import bisect_left

      def longest_rising(values):
          tails = []
          for value in values:
              i = bisect_left(tails, value)
              if i == len(tails):
                  tails.append(value)
              else:
                  tails[i] = value
          return len(tails)
      ~~~

      **O(n log n) time.** «tails» is not itself a valid subsequence; only its length is the
      answer. «bisect_left» makes the result strictly increasing; «bisect_right» would allow
      equal values.
    `,
    signals: [
      'Gives the O(n²) dynamic programming answer first',
      'Explains what the tails list means',
      'Knows tails is not the subsequence itself',
      'Chooses bisect_left for strict increase',
    ],
    followUps: ['Return the subsequence itself, not only its length.'],
  },
  {
    slug: 'dsa-max-non-adjacent',
    title: 'Best total without two neighbouring slots',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'medium',
    companies: CODING_LOOPS,
    prompt: `
      A list holds the value of running a job in each hourly slot. Values are not negative. You
      cannot use two neighbouring slots. Return the best total value.
    `,
    hints: [
      'At each slot you take it or skip it.',
      'If you take slot i, the best before it ends at slot i - 2 or earlier.',
      'You need only the last two answers.',
    ],
    answer: `
      At each slot, either skip it and keep the best so far, or take it and add the best total
      that ended at least two slots back.

      ~~~python
      def best_total(values):
          take = skip = 0
          for value in values:
              take, skip = skip + value, max(take, skip)
          return max(take, skip)
      ~~~

      «take» is the best total that uses the current slot, and «skip» is the best that does
      not. The tuple assignment updates both from the old values. **O(n) time, O(1) memory.**
    `,
    signals: [
      'Defines the two states clearly',
      'Reduces the table to two variables',
      'Tests an empty list and a single slot',
    ],
    followUps: ['The slots form a ring: the first and last are neighbours too.'],
  },
  {
    slug: 'dsa-merge-identities',
    title: 'Merge customer records that share a contact',
    track: 'dsa',
    kind: 'coding',
    difficulty: 'hard',
    companies: CODING_LOOPS,
    prompt: `
      Each record is a record id with a list of emails and phone numbers. Two records belong to
      the same customer if they share any contact, directly or through other records. Return
      the groups of record ids.
    `,
    hints: [
      'Sharing is transitive: A with B, B with C, so A with C.',
      'Think of records as nodes. A shared contact is an edge.',
      'Union-find merges groups without building every edge.',
    ],
    answer: `
      Use union-find. Remember the first record that owns each contact. When another record has
      the same contact, union the two records.

      ~~~python
      from collections import defaultdict

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
      ~~~

      The cost is close to **O(total contacts)**. Comparing every pair of records is O(n²) and
      fails at a few hundred thousand records.

      At warehouse scale this is **connected components**: iterate "take the smallest id among
      my neighbours" in SQL or Spark until nothing changes, or use GraphFrames.
    `,
    signals: [
      'Sees the transitive closure and models a graph',
      'Uses union-find with path compression',
      'Avoids the all-pairs comparison',
      'Names connected components for the distributed version',
    ],
    followUps: [
      'One shared office phone joins 5,000 unrelated customers. How do you prevent that?',
    ],
  },
];
