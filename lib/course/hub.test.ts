import { describe, expect, it } from 'vitest';

import { COURSE_SLUGS, courseFromPath, COURSES, getCourse, isCourseSlug } from './courses';
import { hubStats } from './hub';
import { applyCourseCompletion, EMPTY_LEARNER } from './progress';

describe('the course list', () => {
  it('has an entry for every open course, and a later course that cannot be joined', () => {
    for (const slug of COURSE_SLUGS) expect(getCourse(slug).status).toBe('open');
    const k8s = COURSES.find((course) => course.slug === 'k8s');
    expect(k8s?.status).toBe('soon');
    expect(isCourseSlug('k8s')).toBe(false);
  });

  it('finds the course a path sits in', () => {
    expect(courseFromPath('/gcp/lines/design')).toBe('gcp');
    expect(courseFromPath('/de')).toBe('de');
    expect(courseFromPath('/profile')).toBeUndefined();
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
