import { describe, expect, it } from 'vitest';

import { PROBLEMS } from '@/lib/course/catalog';
import { EMPTY_PROGRESS, LESSON_XP } from '@/lib/course/progress';

import { agoLabel, mondayOf, summarize } from './summary';

const TODAY = '2026-11-04'; // a Wednesday

describe('mondayOf', () => {
  it('returns the Monday of the same week', () => {
    expect(mondayOf('2026-11-04')).toBe('2026-11-02');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });

  it('treats Sunday as the end of the week, not the start', () => {
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
  });
});

describe('agoLabel', () => {
  it('says today, then whole days', () => {
    expect(agoLabel(0)).toBe('today');
    expect(agoLabel(-1)).toBe('today');
    expect(agoLabel(3)).toBe('3d');
  });
});

describe('summarize', () => {
  it('starts a new learner at zero', () => {
    const summary = summarize(EMPTY_PROGRESS, TODAY);
    expect(summary.xp).toBe(0);
    expect(summary.streak).toBe(0);
    expect(summary.solved).toBe(0);
    expect(summary.totalProblems).toBe(PROBLEMS.length);
    expect(summary.recent).toEqual([]);
    expect(summary.levelRatio).toBe(0);
  });

  it('counts this week, the calendar window and recent items, newest first', () => {
    const summary = summarize(
      {
        done: {
          'lesson:sql:window-functions': '2026-10-30',
          'problem:latest-trip-status': '2026-11-01',
          'problem:month-over-month-revenue': '2026-11-03',
          'problem:sessionize-app-events': '2026-11-04',
          'lesson:gone:removed-lesson': '2026-11-04',
        },
        days: { '2026-10-30': 1, '2026-11-01': 1, '2026-11-03': 1, '2026-11-04': 2 },
      },
      TODAY,
    );
    expect(summary.solved).toBe(3);
    // Sunday 1 November is last week.
    expect(summary.solvedThisWeek).toBe(2);
    expect(summary.activeDays).toBe(4);
    expect(summary.itemsInWindow).toBe(5);
    expect(summary.streak).toBe(2);
    expect(summary.xp).toBeGreaterThanOrEqual(LESSON_XP);
    // The removed lesson is skipped; the rest are newest first.
    expect(summary.recent.map((item) => item.id)).toEqual([
      'problem:sessionize-app-events',
      'problem:month-over-month-revenue',
      'problem:latest-trip-status',
    ]);
    expect(summary.recent[0]).toMatchObject({
      kind: 'problem',
      href: '/problems/sessionize-app-events',
      daysAgo: 0,
    });
    expect(summary.recent[1]?.daysAgo).toBe(1);
  });

  it('links a recent lesson to its page', () => {
    const summary = summarize(
      { done: { 'lesson:sql:window-functions': TODAY }, days: { [TODAY]: 1 } },
      TODAY,
    );
    expect(summary.recent[0]).toMatchObject({
      kind: 'lesson',
      href: '/tracks/sql/window-functions',
    });
    expect(summary.levelRatio).toBeGreaterThan(0);
    expect(summary.levelRatio).toBeLessThanOrEqual(1);
  });
});
