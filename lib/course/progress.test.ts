import { describe, expect, it } from 'vitest';

import {
  activityGrid,
  applyCompletion,
  applyCourseCompletion,
  applyEnrollment,
  bestStreak,
  courseRecord,
  EMPTY_LEARNER,
  EMPTY_PROGRESS,
  isEnrolled,
  isoDay,
  lessonId,
  levelFor,
  MAX_DAYS_KEPT,
  problemId,
  streak,
  trustedDay,
  xpOnDay,
} from './progress';

describe('item ids', () => {
  it('names lessons and problems', () => {
    expect(lessonId('sql', 'window-functions')).toBe('lesson:sql:window-functions');
    expect(problemId('not-in-null-trap')).toBe('problem:not-in-null-trap');
  });
});

describe('levelFor', () => {
  it('starts at Intern with the next level in view', () => {
    expect(levelFor(0)).toEqual({ number: 1, title: 'Intern', from: 0, to: 150 });
  });

  it('promotes exactly at the threshold', () => {
    expect(levelFor(1699).title).toBe('Data engineer II');
    expect(levelFor(1700).title).toBe('Senior data engineer');
  });

  it('has no next level at the top', () => {
    expect(levelFor(99999)).toMatchObject({ title: 'Principal data engineer', to: null });
  });
});

describe('trustedDay', () => {
  const now = new Date('2026-11-01T12:00:00Z');

  it('accepts the client day within one day of UTC', () => {
    expect(trustedDay('2026-10-31', now)).toBe('2026-10-31');
    expect(trustedDay('2026-11-01', now)).toBe('2026-11-01');
    expect(trustedDay('2026-11-02', now)).toBe('2026-11-02');
  });

  it('falls back to UTC for missing, malformed or far-off days', () => {
    expect(trustedDay(undefined, now)).toBe('2026-11-01');
    expect(trustedDay('yesterday', now)).toBe('2026-11-01');
    expect(trustedDay('2026-10-01', now)).toBe('2026-11-01');
  });

  it('formats UTC days', () => {
    expect(isoDay(new Date('2026-01-05T23:59:59Z'))).toBe('2026-01-05');
  });
});

describe('streaks', () => {
  const days = { '2026-10-28': 1, '2026-10-29': 2, '2026-10-30': 1, '2026-10-31': 3 };

  it('counts a run that ends today', () => {
    expect(streak({ ...days, '2026-11-01': 1 }, '2026-11-01')).toBe(5);
  });

  it('keeps a run that ended yesterday alive', () => {
    expect(streak(days, '2026-11-01')).toBe(4);
  });

  it('resets after a missed day', () => {
    expect(streak(days, '2026-11-02')).toBe(0);
  });

  it('finds the longest run', () => {
    expect(bestStreak({ ...days, '2026-10-01': 1, '2026-10-02': 0 })).toBe(4);
    expect(bestStreak({})).toBe(0);
  });
});

describe('activityGrid', () => {
  it('builds Monday-first weeks that end today', () => {
    // 2026-11-01 is a Sunday, so the last column is a full week.
    const grid = activityGrid({ '2026-11-01': 2 }, '2026-11-01', 2);
    expect(grid).toHaveLength(2);
    expect(grid[0]?.[0]?.day).toBe('2026-10-19');
    expect(grid[1]?.[6]).toEqual({ day: '2026-11-01', count: 2 });
  });

  it('leaves out days after today', () => {
    // 2026-10-28 is a Wednesday: Monday to Wednesday only.
    const grid = activityGrid({}, '2026-10-28', 1);
    expect(grid[0]?.map((cell) => cell.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28']);
  });
});

describe('applyCompletion', () => {
  it('records an item and the day', () => {
    const next = applyCompletion(EMPTY_PROGRESS, 'problem:a', true, '2026-11-01');
    expect(next).toEqual({ done: { 'problem:a': '2026-11-01' }, days: { '2026-11-01': 1 } });
  });

  it('counts a second completion of the same item once', () => {
    const once = applyCompletion(EMPTY_PROGRESS, 'problem:a', true, '2026-11-01');
    expect(applyCompletion(once, 'problem:a', true, '2026-11-02')).toBe(once);
  });

  it('undoes an item but keeps the day of study', () => {
    const once = applyCompletion(EMPTY_PROGRESS, 'problem:a', true, '2026-11-01');
    expect(applyCompletion(once, 'problem:a', false, '2026-11-01')).toEqual({
      done: {},
      days: { '2026-11-01': 1 },
    });
  });

  it('ignores an undo for an item that is not done', () => {
    expect(applyCompletion(EMPTY_PROGRESS, 'problem:a', false, '2026-11-01')).toBe(EMPTY_PROGRESS);
  });

  it('does not change its input', () => {
    const record = { done: {}, days: {} };
    applyCompletion(record, 'problem:a', true, '2026-11-01');
    expect(record).toEqual({ done: {}, days: {} });
  });

  it('keeps only the most recent days', () => {
    const days: Record<string, number> = {};
    const start = new Date('2025-01-01T00:00:00Z');
    for (let i = 0; i < MAX_DAYS_KEPT; i += 1) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + i);
      days[isoDay(day)] = 1;
    }
    const next = applyCompletion({ done: {}, days }, 'problem:a', true, '2027-01-01');
    expect(Object.keys(next.days)).toHaveLength(MAX_DAYS_KEPT);
    expect(next.days['2025-01-01']).toBeUndefined();
    expect(next.days['2027-01-01']).toBe(1);
  });
});

describe('learner records across courses', () => {
  it('joins a course once and keeps the first day', () => {
    const joined = applyEnrollment(EMPTY_LEARNER, 'gcp', '2026-11-01');
    expect(isEnrolled(joined, 'gcp')).toBe(true);
    expect(isEnrolled(joined, 'de')).toBe(false);
    expect(applyEnrollment(joined, 'gcp', '2026-11-02')).toBe(joined);
  });

  it('keeps a separate tracker per course', () => {
    let record = applyCourseCompletion(EMPTY_LEARNER, 'gcp', 'station:a', true, '2026-11-01');
    record = applyCourseCompletion(record, 'de', 'problem:b', true, '2026-11-02');
    expect(courseRecord(record, 'gcp').done).toEqual({ 'station:a': '2026-11-01' });
    expect(courseRecord(record, 'gcp').days).toEqual({ '2026-11-01': 1 });
    expect(courseRecord(record, 'de').done).toEqual({ 'problem:b': '2026-11-02' });
  });

  it('enrolls the learner in a course when they finish an item in it', () => {
    const record = applyCourseCompletion(EMPTY_LEARNER, 'de', 'problem:b', true, '2026-11-01');
    expect(record.enrolled).toEqual({ de: '2026-11-01' });
  });

  it('returns the same record when nothing changes', () => {
    const record = applyCourseCompletion(EMPTY_LEARNER, 'de', 'problem:b', true, '2026-11-01');
    expect(applyCourseCompletion(record, 'de', 'problem:b', true, '2026-11-02')).toBe(record);
  });

  it('counts the XP earned on one day', () => {
    const tracker = { done: { a: '2026-11-01', b: '2026-11-01', c: '2026-10-31' }, days: {} };
    expect(xpOnDay(tracker, '2026-11-01', () => 10)).toBe(20);
  });
});
