import type { RunnableSpec } from '@/types/runner';

/**
 * Runnable specs for the DSA track. Each runs on Python 3.14 in the browser.
 * A case with `limitS` fails a correct answer that is too slow, so the
 * learner meets the complexity bar the interviewer sets.
 */
export const DSA_RUNNABLES: Record<string, RunnableSpec> = {
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
        setup: 'amounts = list(range(1, 24001, 2))\ntarget = 7',
        check: 'check_pair(pair_with_target, amounts, target)',
        limitS: 0.5,
        slowHint:
          'Checking every pair is O(n²). Remember the amounts you have seen in a dict, so each lookup is O(1).',
      },
    ],
  },
};
