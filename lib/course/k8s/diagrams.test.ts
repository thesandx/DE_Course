import { describe, expect, it } from 'vitest';

import { allLessons } from './catalog';
import { DIAGRAMS, lessonDiagram } from './diagrams';

describe('Kubernetes lesson diagrams', () => {
  it('gives every lesson one diagram, and keys every diagram by a real lesson', () => {
    const keys = allLessons().map((ref) => `${ref.port.slug}/${ref.lesson.slug}`);
    expect(keys.filter((key) => DIAGRAMS[key] === undefined)).toEqual([]);
    expect(Object.keys(DIAGRAMS).filter((key) => !keys.includes(key))).toEqual([]);
    expect(lessonDiagram('workloads', 'deployments')?.kind).toBe('layers');
    expect(lessonDiagram('workloads', 'nope')).toBeUndefined();
  });

  it('keeps every diagram complete and small enough for a phone', () => {
    for (const [key, diagram] of Object.entries(DIAGRAMS)) {
      expect(diagram.title.length, key).toBeLessThanOrEqual(60);
      expect(diagram.caption.length, key).toBeGreaterThan(20);
      expect(diagram.caption.includes('`'), key).toBe(false);
      if (diagram.kind === 'flow') {
        expect(diagram.steps.length + (diagram.fork === undefined ? 0 : 1), key).toBeGreaterThan(1);
        expect(diagram.steps.length, key).toBeLessThanOrEqual(6);
        expect((diagram.edges ?? []).length, key).toBeLessThan(diagram.steps.length);
      }
      if (diagram.kind === 'decision') expect(diagram.questions.length, key).toBeGreaterThan(1);
      if (diagram.kind === 'spectrum') expect(diagram.stops.length, key).toBeLessThanOrEqual(5);
      if (diagram.kind === 'compare') expect(diagram.columns.length, key).toBeLessThanOrEqual(4);
      if (diagram.kind === 'timeline') {
        const points = [
          ...diagram.lanes.flatMap((lane) =>
            (lane.spans ?? []).flatMap((span) => [span.start, span.end]),
          ),
          ...(diagram.marks ?? []).map((mark) => mark.at),
        ];
        for (const point of points) {
          expect(point, key).toBeGreaterThanOrEqual(0);
          expect(point, key).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
