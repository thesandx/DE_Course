/**
 * A small seeded random source for the simulators.
 *
 * A simulator keeps its seed in its state, so the same clicks always give the
 * same result. That makes the logic pure, lets a test assert exact output,
 * and gives the server and the browser the same first render.
 */

const RANGE = 2 ** 32;
const LETTERS = 'bcdfghjklmnpqrstvwxz2456789';

/** The seed that follows `seed`. A linear congruential step. */
export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

/** An index from 0 to `count - 1`, chosen by the seed. */
export function pickIndex(seed: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.floor((seed / RANGE) * count));
}

/** Five characters that look like the random end of a pod name. */
export function podSuffix(seed: number): string {
  let value = seed;
  let suffix = '';
  for (let index = 0; index < 5; index += 1) {
    value = nextSeed(value);
    suffix += LETTERS[pickIndex(value, LETTERS.length)] ?? 'x';
  }
  return suffix;
}
