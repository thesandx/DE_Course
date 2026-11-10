// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { contextForPath, MAX_CONTEXT_CHARS } from '@/lib/assistant/context';
import { PROBLEMS } from '@/lib/course/catalog';

describe('contextForPath', () => {
  it('gives a lesson its own text and checks', () => {
    const context = contextForPath('/de/tracks/sql/window-functions');
    expect(context.label).toMatch(/^Lesson: /);
    expect(context.text).toContain('LESSON TEXT');
    expect(context.text).toContain('QUICK CHECKS');
  });

  it('gives a track its lessons', () => {
    const context = contextForPath('/de/tracks/sql');
    expect(context.label).toMatch(/^Track: /);
    expect(context.text).toContain('Lessons:');
  });

  it('gives a problem its question and marks the model answer as hidden', () => {
    const problem = PROBLEMS[0];
    if (problem === undefined) throw new Error('The catalogue has no problems');
    const context = contextForPath(`/de/problems/${problem.slug}`);
    expect(context.label).toBe(`Problem: ${problem.title}`);
    expect(context.text).toContain('do not paste it unless they ask');
  });

  it('gives a loop guide its rounds', () => {
    expect(contextForPath('/de/companies/uber').label).toMatch(/^Loop guide: /);
  });

  it('gives a GCP station, domain and lab their own text', () => {
    expect(contextForPath('/gcp/lines/analysis/visualization').label).toMatch(/^Station /);
    expect(contextForPath('/gcp/lines/analysis').label).toMatch(/^Domain: /);
    expect(contextForPath('/gcp/labs/visualization').label).toMatch(/^Lab: /);
  });

  it('falls back to the course for a list page or an unknown slug', () => {
    expect(contextForPath('/de/problems').label).toBe('DE course');
    expect(contextForPath('/de/tracks/nope/nothing').label).toBe('DE course');
    expect(contextForPath('/gcp/practice/mock').label).toBe('GCP course');
    expect(contextForPath('/gcp/lines/analysis/boss').label).toMatch(/^Domain: /);
    expect(contextForPath('/profile').label).toBe('Loop Ready');
  });

  it('ignores a query string and survives a malformed escape', () => {
    expect(contextForPath('/de/tracks/sql?tab=1').label).toMatch(/^Track: /);
    expect(contextForPath('/de/tracks/%E0%A4').label).toBe('DE course');
  });

  it('never returns more than the cap plus the cut note', () => {
    for (const problem of PROBLEMS) {
      const { text } = contextForPath(`/de/problems/${problem.slug}`);
      expect(text.length).toBeLessThan(MAX_CONTEXT_CHARS + 200);
    }
  });
});
