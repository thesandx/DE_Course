import { describe, expect, it } from 'vitest';

import { COMPANIES, getTrack } from '@/lib/course/catalog';
import { getCourse } from '@/lib/course/courses';
import {
  chooseSeed,
  getMockLoop,
  loopMinutes,
  MOCK_LOOPS,
  parseSeed,
  planMock,
  randomSeeds,
  slotPool,
} from '@/lib/course/mock';

describe('mock loops', () => {
  it('has the four general loops and one loop per company', () => {
    expect(MOCK_LOOPS.map((loop) => loop.slug).slice(0, 4)).toEqual([
      'quick',
      'senior',
      'staff',
      'speed-screen',
    ]);
    for (const company of COMPANIES) {
      const loop = getMockLoop(company.slug);
      expect(loop?.company).toBe(company.slug);
      expect(loop?.rounds.length ?? 0).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(MOCK_LOOPS.map((loop) => loop.slug)).size).toBe(MOCK_LOOPS.length);
    expect(getCourse('de').facts).toContain(`${MOCK_LOOPS.length} mock loops`);
  });

  it('leaves out the rounds with nothing to mock, such as a recruiter screen', () => {
    const uber = getMockLoop('uber');
    expect(uber?.rounds.map((round) => round.name)).not.toContain(
      'Recruiter and hiring manager screen',
    );
    expect(
      loopMinutes(getMockLoop('quick') ?? { slug: '', name: '', summary: '', rounds: [] }),
    ).toBe(60);
  });

  it.each(MOCK_LOOPS.map((loop) => [loop.slug, loop] as const))(
    'gives every slot of %s real tracks and enough problems for variety',
    (_, loop) => {
      for (const round of loop.rounds) {
        expect(round.minutes).toBeGreaterThan(0);
        expect(round.slots.length).toBeGreaterThan(0);
        for (const slot of round.slots) {
          for (const track of slot.tracks ?? round.tracks) {
            expect(getTrack(track), `${loop.slug} / ${round.name}: ${track}`).toBeDefined();
          }
          const asked = loop.rounds
            .flatMap((item) => item.slots)
            .filter((other) => other === slot).length;
          const pool = slotPool(slot, round);
          expect(
            pool.length,
            `${loop.slug} / ${round.name} / ${slot.label}`,
          ).toBeGreaterThanOrEqual(Math.max(3, asked * 2));
        }
      }
    },
  );
});

describe('planMock', () => {
  const senior = getMockLoop('senior');
  if (senior === undefined) throw new Error('The senior loop is missing.');

  it('asks the same questions for the same seed', () => {
    const slugs = (seed: number) =>
      planMock(senior, seed).map((planned) => planned.problems.map((problem) => problem.slug));
    expect(slugs(42)).toEqual(slugs(42));
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(slugs(seed)));
    expect(new Set(seeds).size).toBeGreaterThan(4);
  });

  it('fills each slot with a problem of its kind and tracks, never twice in one loop', () => {
    for (const loop of MOCK_LOOPS) {
      for (const seed of [11, 222, 3333]) {
        const plan = planMock(loop, seed);
        const slugs = plan.flatMap((planned) => planned.problems.map((problem) => problem.slug));
        expect(new Set(slugs).size, loop.slug).toBe(slugs.length);
        plan.forEach(({ round, problems }) => {
          expect(problems).toHaveLength(round.slots.length);
          problems.forEach((problem, index) => {
            const slot = round.slots[index];
            expect(slot?.kinds).toContain(problem.kind);
            expect(slot?.tracks ?? round.tracks).toContain(problem.track);
          });
        });
      }
    }
  });

  it('asks the questions of one kind easiest first', () => {
    const rank = { easy: 0, medium: 1, hard: 2 } as const;
    for (let seed = 1; seed <= 40; seed += 1) {
      const sql = planMock(senior, seed)[0];
      const [first, second] = sql?.problems ?? [];
      if (first === undefined || second === undefined) throw new Error('The SQL round has two.');
      expect(rank[first.difficulty]).toBeLessThanOrEqual(rank[second.difficulty]);
    }
  });
});

describe('seeds', () => {
  it('reads a seed from the URL only when it is a positive 31-bit integer', () => {
    expect(parseSeed('123')).toBe(123);
    expect(parseSeed('2147483647')).toBe(2147483647);
    for (const bad of [undefined, '', '0', '-4', '1.5', 'abc', '2147483648', ['1', '2']]) {
      expect(parseSeed(bad)).toBeNull();
    }
  });

  it('draws random seeds in range', () => {
    const seeds = randomSeeds(16);
    expect(seeds).toHaveLength(16);
    for (const seed of seeds) expect(parseSeed(String(seed))).toBe(seed);
  });

  it('prefers the seed whose loop asks the most unsolved problems', () => {
    const quick = getMockLoop('quick');
    if (quick === undefined) throw new Error('The quick loop is missing.');
    const solvedPlan = new Set(
      planMock(quick, 7).flatMap((planned) => planned.problems.map((problem) => problem.slug)),
    );
    const other = [8, 9, 10, 11].find((seed) =>
      planMock(quick, seed).every((planned) =>
        planned.problems.every((problem) => !solvedPlan.has(problem.slug)),
      ),
    );
    expect(other).toBeDefined();
    expect(chooseSeed(quick, [7, other ?? 0], (slug) => solvedPlan.has(slug))).toBe(other);
    expect(chooseSeed(quick, [7, 8], () => false)).toBe(7);
    expect(chooseSeed(quick, [], () => false)).toBe(1);
  });
});

describe('the speed screen', () => {
  it('asks five SQL and five Python problems, none of them hard', () => {
    const loop = getMockLoop('speed-screen');
    if (loop === undefined) throw new Error('The speed screen is missing.');
    expect(loopMinutes(loop)).toBe(60);
    for (const seed of [1, 2, 3, 99, 12345]) {
      const [sql, python] = planMock(loop, seed);
      expect(sql?.problems.map((problem) => problem.kind)).toEqual(Array(5).fill('sql'));
      expect(python?.problems.map((problem) => problem.track)).toEqual(Array(5).fill('python'));
      const all = [...(sql?.problems ?? []), ...(python?.problems ?? [])];
      expect(all.filter((problem) => problem.difficulty === 'hard')).toEqual([]);
      expect(new Set(all.map((problem) => problem.slug)).size).toBe(10);
    }
  });
});
