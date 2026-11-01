import { describe, expect, it } from 'vitest';

import {
  bossRound,
  isChoiceCorrect,
  isMatchCorrect,
  isOrderCorrect,
  mockExam,
  passes,
  scrambledIndexes,
  seededRandom,
  shuffle,
  shuffleChoices,
} from './quiz';

const fixed = (): number => 0.5;

describe('shuffle', () => {
  it('keeps every item and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input, seededRandom('x'));
    expect([...result].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('seededRandom', () => {
  it('repeats for the same seed, so server and browser agree', () => {
    const a = seededRandom('prompt');
    const b = seededRandom('prompt');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('scrambledIndexes', () => {
  it('never returns the original order', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const order = scrambledIndexes(3, seed);
      expect([...order].sort()).toEqual([0, 1, 2]);
      expect(order).not.toEqual([0, 1, 2]);
    }
  });
});

describe('shuffleChoices', () => {
  it('moves the options and keeps the answers pointing at the same text', () => {
    const question = { options: ['right', 'b', 'c', 'also right'], answers: [0, 3] };
    for (const seed of ['1', '2', '3']) {
      const shuffled = shuffleChoices(question, seededRandom(seed));
      expect(shuffled.answers.map((index) => shuffled.options[index]).sort()).toEqual([
        'also right',
        'right',
      ]);
    }
  });
});

describe('marking', () => {
  it('needs exactly the right options', () => {
    expect(isChoiceCorrect([1], [1])).toBe(true);
    expect(isChoiceCorrect([2, 0], [0, 2])).toBe(true);
    expect(isChoiceCorrect([0], [0, 2])).toBe(false);
    expect(isChoiceCorrect([0, 1], [0])).toBe(false);
  });

  it('marks matches and orders', () => {
    expect(isMatchCorrect([0, 1, 2])).toBe(true);
    expect(isMatchCorrect([0, null, 2])).toBe(false);
    expect(isMatchCorrect([])).toBe(false);
    expect(isOrderCorrect([0, 1, 2])).toBe(true);
    expect(isOrderCorrect([1, 0, 2])).toBe(false);
  });

  it('passes at the bar', () => {
    expect(passes(7, 10, 0.7)).toBe(true);
    expect(passes(6, 10, 0.7)).toBe(false);
    expect(passes(0, 0, 0.7)).toBe(false);
  });
});

describe('building rounds', () => {
  const question = (id: string) => ({
    station: id,
    prompt: id,
    options: ['a'],
    answers: [0],
    why: '',
  });
  const pool = Array.from({ length: 30 }, (_, index) => question(`q${index}`));

  it('draws a boss round of the asked size', () => {
    expect(bossRound(pool, 10, fixed)).toHaveLength(10);
    expect(bossRound(pool.slice(0, 4), 10, fixed)).toHaveLength(4);
  });

  it('splits a mock exam by domain weight', () => {
    const lines = [
      { slug: 'a', weight: 50 },
      { slug: 'b', weight: 30 },
      { slug: 'c', weight: 20 },
    ];
    const byLine = (slug: string) =>
      pool.map((item) => ({ ...item, station: slug, prompt: `${slug}${item.prompt}` }));
    const exam = mockExam(lines, byLine, 10, seededRandom('m'));
    expect(exam).toHaveLength(10);
    const count = (slug: string) => exam.filter((item) => item.station === slug).length;
    expect([count('a'), count('b'), count('c')]).toEqual([5, 3, 2]);
  });

  it('hands rounding leftovers to the heaviest domains', () => {
    const lines = [
      { slug: 'a', weight: 22 },
      { slug: 'b', weight: 25 },
      { slug: 'c', weight: 20 },
      { slug: 'd', weight: 15 },
      { slug: 'e', weight: 18 },
    ];
    const byLine = (slug: string) => pool.map((item) => ({ ...item, station: slug }));
    expect(mockExam(lines, byLine, 50, seededRandom('n'))).toHaveLength(50);
  });
});
