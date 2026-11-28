import { describe, expect, it } from 'vitest';

import {
  average,
  formatClock,
  formatMinutes,
  percent,
  problemScore,
  scoreRounds,
  toneOf,
  verdictFor,
} from '@/lib/course/mock-score';

describe('problemScore', () => {
  it('scores a runnable problem mostly on its tests', () => {
    const facts = { signals: 4, runnable: true };
    expect(
      problemScore(facts, { hints: 0, tests: { passed: 4, total: 4 }, covered: [] }),
    ).toBeCloseTo(0.7);
    expect(
      problemScore(facts, { hints: 0, tests: { passed: 4, total: 4 }, covered: [0, 1, 2, 3] }),
    ).toBeCloseTo(1);
    expect(problemScore(facts, { hints: 0, tests: null, covered: [0, 1] })).toBeCloseTo(0.15);
  });

  it('scores any other problem on the signals ticked, once each', () => {
    const facts = { signals: 4, runnable: false };
    expect(problemScore(facts, { hints: 0, tests: null, covered: [0, 0, 1, 9] })).toBeCloseTo(0.5);
    expect(
      problemScore({ signals: 0, runnable: false }, { hints: 0, tests: null, covered: [] }),
    ).toBe(0);
  });

  it('takes a tenth for each hint, down to half', () => {
    const facts = { signals: 2, runnable: false };
    const all = { tests: null, covered: [0, 1] };
    expect(problemScore(facts, { ...all, hints: 2 })).toBeCloseTo(0.8);
    expect(problemScore(facts, { ...all, hints: 9 })).toBeCloseTo(0.5);
  });
});

describe('scoreRounds', () => {
  it('averages the questions of each round, and counts a missing result as zero', () => {
    const facts = [
      [
        { signals: 2, runnable: false },
        { signals: 2, runnable: false },
      ],
      [{ signals: 1, runnable: true }],
    ];
    const results = [[{ hints: 0, tests: null, covered: [0, 1] }]];
    expect(scoreRounds(facts, results)).toEqual([0.5, 0]);
  });
});

describe('verdictFor', () => {
  it('maps the average to a hiring band', () => {
    expect(verdictFor([0.9, 0.95]).label).toBe('Strong hire');
    expect(verdictFor([0.7, 0.8]).label).toBe('Hire');
    expect(verdictFor([0.6, 0.55]).label).toBe('Lean hire');
    expect(verdictFor([0.4, 0.5]).label).toBe('Lean no hire');
    expect(verdictFor([0.1, 0.2]).label).toBe('No hire');
    expect(verdictFor([]).label).toBe('No hire');
  });

  it('reads the tone back from a stored label', () => {
    expect(toneOf('Strong hire')).toBe('easy');
    expect(toneOf('Hire')).toBe('easy');
    expect(toneOf('Lean hire')).toBe('medium');
    expect(toneOf('Lean no hire')).toBe('hard');
    expect(toneOf('No hire')).toBe('hard');
  });

  it('caps a strong loop with one very weak round at lean no hire', () => {
    const verdict = verdictFor([1, 1, 1, 0.2]);
    expect(verdict.label).toBe('Lean no hire');
    expect(verdict.tone).toBe('hard');
    expect(verdict.reason).toMatch(/one round/);
  });
});

describe('formatting', () => {
  it('formats minutes, clocks and shares', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(285)).toBe('4 h 45 min');
    expect(formatClock(45 * 60_000)).toBe('45:00');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('0:00');
    expect(percent(0.426)).toBe('43%');
    expect(percent(2)).toBe('100%');
    expect(average([1, 0])).toBe(0.5);
  });
});
