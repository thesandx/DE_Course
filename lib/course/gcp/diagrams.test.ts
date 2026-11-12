import { describe, expect, it } from 'vitest';

import type { DiagramBox, GcpDiagram } from '@/types/gcp';

import { allStations } from './catalog';
import { conceptDiagrams, DIAGRAMS } from './diagrams';

const all: GcpDiagram[] = Object.values(DIAGRAMS).flat();

/** Every piece of text a diagram shows. */
function texts(diagram: GcpDiagram): string[] {
  const box = (item: DiagramBox): string[] => [item.label, item.note ?? '', ...(item.chips ?? [])];
  const base = [diagram.title, diagram.caption];
  switch (diagram.kind) {
    case 'flow':
      return [
        ...base,
        ...diagram.steps.flatMap(box),
        ...(diagram.edges ?? []),
        ...(diagram.fork === undefined
          ? []
          : [diagram.fork.label, ...diagram.fork.boxes.flatMap(box)]),
      ];
    case 'decision':
      return [
        ...base,
        ...diagram.questions.flatMap((question) => [question.ask, ...box(question.yes)]),
        ...box(diagram.otherwise),
      ];
    case 'layers':
      return [...base, diagram.rail ?? '', ...diagram.layers.flatMap(box)];
    case 'spectrum':
      return [...base, diagram.from, diagram.to, ...diagram.stops.flatMap(box)];
    case 'compare':
      return [...base, ...diagram.columns.flatMap((column) => [...box(column), ...column.points])];
    case 'hub':
      return [...base, ...box(diagram.center), ...diagram.spokes.flatMap(box)];
    case 'timeline':
      return [
        ...base,
        diagram.axis.start,
        diagram.axis.end,
        ...diagram.lanes.flatMap((lane) => [
          lane.label,
          ...(lane.spans ?? []).map((span) => span.label ?? ''),
        ]),
        ...(diagram.marks ?? []).map((mark) => mark.label),
      ];
    case 'grid':
      return [
        ...base,
        ...diagram.columns,
        ...diagram.rows,
        diagram.legend.read,
        diagram.legend.skipped,
      ];
    case 'boundary':
      return [
        ...base,
        diagram.inside.label,
        ...diagram.inside.boxes.flatMap(box),
        ...diagram.outside.flatMap(box),
      ];
    case 'pairs':
      return [...base, diagram.left, diagram.right, ...diagram.pairs.flat()];
  }
}

describe('GCP concept diagrams', () => {
  it('gives every concept of every station at least one diagram', () => {
    const missing = allStations().flatMap(({ station }) =>
      station.concepts
        .map((concept, index) => ({ concept, number: index + 1 }))
        .filter(({ number }) => conceptDiagrams(station.slug, number).length === 0)
        .map(({ concept }) => `${station.slug}: ${concept.title}`),
    );
    expect(missing).toEqual([]);
  });

  it('keys diagrams by real stations and real concept numbers', () => {
    const stations = new Map(allStations().map(({ station }) => [station.slug, station]));
    for (const [slug, diagrams] of Object.entries(DIAGRAMS)) {
      const station = stations.get(slug);
      expect(station, slug).toBeDefined();
      for (const diagram of diagrams) {
        expect(diagram.concept, `${slug}: ${diagram.title}`).toBeGreaterThanOrEqual(1);
        expect(diagram.concept, `${slug}: ${diagram.title}`).toBeLessThanOrEqual(
          station?.concepts.length ?? 0,
        );
      }
    }
  });

  it('keeps every diagram complete and small enough for a phone', () => {
    for (const diagram of all) {
      const name = diagram.title;
      expect(diagram.title.length, name).toBeLessThanOrEqual(60);
      expect(diagram.caption.length, name).toBeGreaterThan(20);
      if (diagram.kind === 'flow') {
        expect(diagram.steps.length + (diagram.fork === undefined ? 0 : 1), name).toBeGreaterThan(
          1,
        );
        expect(diagram.steps.length, name).toBeLessThanOrEqual(6);
        expect((diagram.edges ?? []).length, name).toBeLessThan(diagram.steps.length);
      }
      if (diagram.kind === 'decision') expect(diagram.questions.length, name).toBeGreaterThan(1);
      if (diagram.kind === 'spectrum') expect(diagram.stops.length, name).toBeLessThanOrEqual(5);
      if (diagram.kind === 'compare') expect(diagram.columns.length, name).toBeLessThanOrEqual(4);
    }
  });

  it('keeps timeline positions inside the axis', () => {
    for (const diagram of all) {
      if (diagram.kind !== 'timeline') continue;
      const points = [
        ...diagram.lanes.flatMap((lane) => [
          ...(lane.spans ?? []).flatMap((span) => [span.start, span.end]),
          ...(lane.dots ?? []).map((dot) => dot.at),
        ]),
        ...(diagram.marks ?? []).map((mark) => mark.at),
      ];
      for (const point of points) {
        expect(point, diagram.title).toBeGreaterThanOrEqual(0);
        expect(point, diagram.title).toBeLessThanOrEqual(100);
      }
      for (const span of diagram.lanes.flatMap((lane) => lane.spans ?? [])) {
        expect(span.end, diagram.title).toBeGreaterThan(span.start);
      }
    }
  });

  it('points grid reads at real cells', () => {
    for (const diagram of all) {
      if (diagram.kind !== 'grid') continue;
      for (const [row, column] of diagram.read) {
        expect(row).toBeLessThan(diagram.rows.length);
        expect(column).toBeLessThan(diagram.columns.length);
      }
    }
  });

  it('uses no backticks, template markers or duplicate keys', () => {
    for (const diagram of all) {
      for (const text of texts(diagram)) {
        expect(text, diagram.title).not.toMatch(/`|\$\{/);
      }
    }
    // React keys inside one diagram come from labels, so they must be unique.
    for (const diagram of all) {
      const labels =
        diagram.kind === 'flow'
          ? (diagram.fork?.boxes ?? []).map((box) => box.label)
          : diagram.kind === 'hub'
            ? diagram.spokes.map((box) => box.label)
            : diagram.kind === 'decision'
              ? diagram.questions.map((question) => question.ask)
              : diagram.kind === 'compare'
                ? diagram.columns.map((column) => column.label)
                : diagram.kind === 'spectrum'
                  ? diagram.stops.map((stop) => stop.label)
                  : diagram.kind === 'layers'
                    ? diagram.layers.map((layer) => layer.label)
                    : diagram.kind === 'timeline'
                      ? diagram.lanes.map((lane) => lane.label)
                      : [];
      expect(new Set(labels).size, diagram.title).toBe(labels.length);
    }
  });
});
