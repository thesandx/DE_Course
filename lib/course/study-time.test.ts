import { describe, expect, it } from 'vitest';

import { applyCourseCompletion, EMPTY_LEARNER, MAX_DAYS_KEPT } from './progress';
import {
  applyLearnerStudyTime,
  applyStudyTime,
  buildStudyMap,
  describeStudyDay,
  formatStudyTime,
  itemsPerDay,
  MAX_SECONDS_PER_DAY,
  MAX_SECONDS_PER_REPORT,
  STUDY_MAP_WEEKS,
  studyActivity,
  studyLevel,
} from './study-time';

describe('applyStudyTime', () => {
  it('adds to the day and leaves the input alone', () => {
    const before = { '2026-11-10': 60 };
    const after = applyStudyTime(before, '2026-11-10', 90);
    expect(after['2026-11-10']).toBe(150);
    expect(before['2026-11-10']).toBe(60);
  });

  it('caps one report and one day', () => {
    expect(applyStudyTime({}, '2026-11-10', 10_000)['2026-11-10']).toBe(MAX_SECONDS_PER_REPORT);
    expect(applyStudyTime({ '2026-11-10': MAX_SECONDS_PER_DAY - 10 }, '2026-11-10', 200)).toEqual({
      '2026-11-10': MAX_SECONDS_PER_DAY,
    });
    expect(applyStudyTime(undefined, '2026-11-10', -5)['2026-11-10']).toBe(0);
  });

  it('keeps only the newest days', () => {
    const map: Record<string, number> = {};
    for (let i = 0; i < MAX_DAYS_KEPT; i += 1) {
      map[new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)] = 60;
    }
    const after = applyStudyTime(map, '2027-01-01', 60);
    expect(Object.keys(after)).toHaveLength(MAX_DAYS_KEPT);
    expect(after['2025-01-01']).toBeUndefined();
    expect(after['2027-01-01']).toBe(60);
  });

  it('adds to a learner record without touching the courses', () => {
    const record = applyLearnerStudyTime(EMPTY_LEARNER, '2026-11-10', 120);
    expect(record.studyTime).toEqual({ '2026-11-10': 120 });
    expect(record.courses).toBe(EMPTY_LEARNER.courses);
  });
});

describe('itemsPerDay', () => {
  it('sums finished items over every course', () => {
    let record = applyCourseCompletion(EMPTY_LEARNER, 'de', 'problem:a', true, '2026-11-10');
    record = applyCourseCompletion(record, 'gcp', 'station:b', true, '2026-11-10');
    record = applyCourseCompletion(record, 'gcp', 'station:c', true, '2026-11-09');
    expect(itemsPerDay(record)).toEqual({ '2026-11-10': 2, '2026-11-09': 1 });
    expect(studyActivity(record).seconds).toEqual({});
  });
});

describe('studyLevel', () => {
  it('steps at 15 minutes, 30 minutes and an hour', () => {
    expect(studyLevel(0, 0)).toBe(0);
    expect(studyLevel(30, 0)).toBe(0);
    expect(studyLevel(60, 0)).toBe(1);
    expect(studyLevel(0, 2)).toBe(1);
    expect(studyLevel(900, 0)).toBe(2);
    expect(studyLevel(1800, 0)).toBe(3);
    expect(studyLevel(3600, 0)).toBe(4);
  });
});

describe('buildStudyMap', () => {
  // 2026-11-11 is a Wednesday.
  const today = '2026-11-11';

  it('lays out 53 full weeks, Monday first, ending this week', () => {
    const map = buildStudyMap({ seconds: {}, items: {} }, today);
    expect(map.weeks).toHaveLength(STUDY_MAP_WEEKS);
    for (const week of map.weeks) expect(week.days).toHaveLength(7);
    const last = map.weeks.at(-1)?.days ?? [];
    expect(last[0]?.day).toBe('2026-11-09');
    expect(last[2]).toMatchObject({ day: today, future: false });
    expect(last[3]).toMatchObject({ day: '2026-11-12', future: true });
  });

  it('labels the week that holds the 1st of a month', () => {
    const map = buildStudyMap({ seconds: {}, items: {} }, today);
    const labelled = map.weeks.filter((week) => week.month !== null);
    expect(labelled.length).toBeGreaterThanOrEqual(12);
    expect(map.weeks.find((week) => week.days.some((d) => d.day === '2026-11-01'))?.month).toBe(
      'Nov',
    );
  });

  it('counts active days, time and streaks', () => {
    const map = buildStudyMap(
      {
        seconds: {
          '2026-11-11': 1200,
          '2026-11-10': 600,
          '2026-11-09': 30,
          '2026-11-01': 3600,
          '2026-11-02': 3600,
          '2026-11-03': 3600,
        },
        items: { '2026-11-09': 1, '2026-11-12': 9 },
      },
      today,
    );
    expect(map.activeDays).toBe(6);
    expect(map.totalSeconds).toBe(1200 + 600 + 30 + 3 * 3600);
    expect(map.currentStreak).toBe(3);
    expect(map.longestStreak).toBe(3);
  });

  it('keeps a streak alive until the end of the next day', () => {
    const map = buildStudyMap(
      { seconds: { '2026-11-10': 600, '2026-11-09': 600 }, items: {} },
      today,
    );
    expect(map.currentStreak).toBe(2);
    const broken = buildStudyMap({ seconds: { '2026-11-09': 600 }, items: {} }, today);
    expect(broken.currentStreak).toBe(0);
  });
});

describe('formatting', () => {
  it('formats a duration', () => {
    expect(formatStudyTime(0)).toBe('0m');
    expect(formatStudyTime(20)).toBe('under 1m');
    expect(formatStudyTime(45 * 60)).toBe('45m');
    expect(formatStudyTime(3600)).toBe('1h');
    expect(formatStudyTime(80 * 60 + 30)).toBe('1h 20m');
  });

  it('describes a day in words', () => {
    expect(describeStudyDay({ day: '2026-11-11', seconds: 2700, items: 3 })).toBe(
      'Wed, 11 Nov 2026: 45m studied, 3 items finished',
    );
    expect(describeStudyDay({ day: '2026-11-11', seconds: 0, items: 1 })).toBe(
      'Wed, 11 Nov 2026: 1 item finished',
    );
    expect(describeStudyDay({ day: '2026-11-11', seconds: 0, items: 0 })).toBe(
      'Wed, 11 Nov 2026: no study',
    );
  });
});
