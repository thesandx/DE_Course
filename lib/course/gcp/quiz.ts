/**
 * Pure helpers for the GCP games: shuffling, marking answers, and building a
 * boss round or a mock exam. The random source is a parameter, so tests pass
 * a fixed one and the screens pass `Math.random`.
 */

import type { BankQuestion, GcpLine } from '@/types/gcp';

export type Random = () => number;

/** A new array in random order (Fisher–Yates). The input is not changed. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

/**
 * A repeatable random source from a string. The match and order checks use it
 * so the server and the browser draw the same "shuffled" order and the page
 * hydrates without a mismatch.
 */
export function seededRandom(seed: string): Random {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
}

/** Indexes 0..n-1 shuffled, never left in their original order when n > 1. */
export function scrambledIndexes(count: number, seed: string): number[] {
  const indexes = Array.from({ length: count }, (_, index) => index);
  const result = shuffle(indexes, seededRandom(seed));
  if (count > 1 && result.every((value, index) => value === index))
    result.push(result.shift() ?? 0);
  return result;
}

/** True when the picked options are exactly the correct ones. */
export function isChoiceCorrect(picked: readonly number[], answers: readonly number[]): boolean {
  return picked.length === answers.length && answers.every((answer) => picked.includes(answer));
}

/** True when every left item is matched to its own right item. `chosen[i]` is a pair index. */
export function isMatchCorrect(chosen: ReadonlyArray<number | null>): boolean {
  return chosen.length > 0 && chosen.every((value, index) => value === index);
}

/** True when `order` lists the step indexes in the correct order. */
export function isOrderCorrect(order: readonly number[]): boolean {
  return order.every((value, index) => value === index);
}

/** True when a score passes the given share. */
export function passes(correct: number, total: number, ratio: number): boolean {
  return total > 0 && correct / total >= ratio;
}

/** A boss round: `count` random questions from the line's bank. */
export function bossRound(
  pool: readonly BankQuestion[],
  count: number,
  random: Random,
): BankQuestion[] {
  return shuffle(pool, random).slice(0, count);
}

/**
 * A mock exam: `count` questions, drawn from each line in proportion to the
 * domain's share of the real exam. Rounding leftovers go to the heaviest
 * domains first. The result is shuffled so the domains interleave.
 */
export function mockExam(
  lines: ReadonlyArray<Pick<GcpLine, 'slug' | 'weight'>>,
  questionsFor: (line: string) => readonly BankQuestion[],
  count: number,
  random: Random,
): BankQuestion[] {
  const totalWeight = lines.reduce((sum, line) => sum + line.weight, 0);
  const shares = lines.map((line) => {
    const exact = totalWeight === 0 ? 0 : (count * line.weight) / totalWeight;
    return { line, take: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = count - shares.reduce((sum, share) => sum + share.take, 0);
  for (const share of [...shares].sort(
    (a, b) => b.rest - a.rest || b.line.weight - a.line.weight,
  )) {
    if (left <= 0) break;
    share.take += 1;
    left -= 1;
  }
  const picked = shares.flatMap((share) =>
    shuffle(questionsFor(share.line.slug), random).slice(0, share.take),
  );
  return shuffle(picked, random);
}

/**
 * The question with its options in a new order and `answers` remapped to
 * match. The source content lists the right option first, so every screen
 * that shows options shows them shuffled.
 */
export function shuffleChoices<
  T extends { options: readonly string[]; answers: readonly number[] },
>(question: T, random: Random): T {
  const order = shuffle(
    question.options.map((_, index) => index),
    random,
  );
  return {
    ...question,
    options: order.map((index) => question.options[index] ?? ''),
    answers: question.answers.map((answer) => order.indexOf(answer)).sort((a, b) => a - b),
  };
}
