import { describe, expect, it } from 'vitest';

import {
  COURSE_SLUGS,
  courseFromPath,
  COURSES,
  getCourse,
  getSoonCourse,
  isCourseSlug,
} from './courses';
import { hubStats } from './hub';
import { applyCourseCompletion, EMPTY_LEARNER } from './progress';

describe('the course list', () => {
  it('has an open entry for every course a learner can join', () => {
    for (const slug of COURSE_SLUGS) expect(getCourse(slug).status).toBe('open');
    expect(COURSES.map((course) => course.slug)).toEqual(['de', 'gcp', 'k8s', 'gcp-architect']);
    expect(isCourseSlug('k8s')).toBe(true);
    expect(isCourseSlug('rust')).toBe(false);
    expect(isCourseSlug('gcp-architect')).toBe(false);
  });

  it('keeps a course that is not open yet out of the joinable slugs', () => {
    const soon = COURSES.filter((course) => course.status === 'soon');
    expect(soon.map((course) => course.slug)).toEqual(['gcp-architect']);
    for (const course of soon) {
      expect(isCourseSlug(course.slug)).toBe(false);
      expect(course.plan?.length ?? 0).toBeGreaterThan(0);
    }
    expect(getSoonCourse('gcp-architect').href).toBe('/gcp-architect');
    expect(() => getSoonCourse('gcp')).toThrow();
  });

  it('finds the course a path sits in', () => {
    expect(courseFromPath('/gcp/lines/design')).toBe('gcp');
    expect(courseFromPath('/de')).toBe('de');
    expect(courseFromPath('/k8s/ports/setup')).toBe('k8s');
    expect(courseFromPath('/profile')).toBeUndefined();
    // A course that is not open yet is not a course a path sits in.
    expect(courseFromPath('/gcp-architect')).toBeUndefined();
    expect(courseFromPath('/')).toBeUndefined();
  });
});

describe('hubStats', () => {
  it('starts each course at zero with the first step next', () => {
    const de = hubStats(EMPTY_LEARNER, 'de', '2026-11-01');
    expect(de).toMatchObject({ xp: 0, streak: 0, ratio: 0, nextXp: 40 });
    expect(de.nextHref).toMatch(/^\/de\/tracks\//);
    const gcp = hubStats(EMPTY_LEARNER, 'gcp', '2026-11-01');
    expect(gcp).toMatchObject({ xp: 0, ratio: 0 });
    expect(gcp.nextHref).toBe('/gcp/lines/design/security-compliance');
  });

  it('counts only the course it is asked about', () => {
    const record = applyCourseCompletion(
      EMPTY_LEARNER,
      'gcp',
      'station:security-compliance',
      true,
      '2026-11-01',
    );
    expect(hubStats(record, 'gcp', '2026-11-01').xp).toBeGreaterThan(0);
    expect(hubStats(record, 'gcp', '2026-11-01').streak).toBe(1);
    expect(hubStats(record, 'de', '2026-11-01').xp).toBe(0);
    expect(hubStats(record, 'gcp', '2026-11-01').nextHref).toBe(
      '/gcp/lines/design/reliability-fidelity',
    );
  });
});
