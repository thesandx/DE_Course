import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DIAGRAMS } from '@/lib/course/gcp/diagrams';
import type { GcpDiagram } from '@/types/gcp';

import { ConceptDiagram } from './ConceptDiagram';

const base = { concept: 1, caption: 'What to remember from the picture.' };

describe('ConceptDiagram', () => {
  it('names the figure by its title and shows the caption', () => {
    render(
      <ConceptDiagram
        id="d1"
        diagram={{
          ...base,
          kind: 'flow',
          title: 'Streaming path',
          steps: [{ label: 'Pub/Sub' }, { label: 'Dataflow', note: 'Parse' }],
          edges: ['pull'],
        }}
      />,
    );
    expect(screen.getByRole('figure', { name: 'Streaming path' })).toBeInTheDocument();
    expect(screen.getByText('Pub/Sub')).toBeInTheDocument();
    expect(screen.getByText('pull')).toBeInTheDocument();
    expect(screen.getByText('What to remember from the picture.')).toBeInTheDocument();
  });

  it('labels a decision tree with numbered questions and an answer when every answer is no', () => {
    render(
      <ConceptDiagram
        id="d2"
        diagram={{
          ...base,
          kind: 'decision',
          title: 'Pick a store',
          questions: [
            { ask: 'Analytics?', yes: { label: 'BigQuery' } },
            { ask: 'Global OLTP?', yes: { label: 'Spanner' } },
          ],
          otherwise: { label: 'Cloud SQL' },
        }}
      />,
    );
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Q2')).toBeInTheDocument();
    expect(screen.getAllByText('Yes')).toHaveLength(2);
    expect(screen.getByText('None of the above')).toBeInTheDocument();
    expect(screen.getByText('Cloud SQL')).toBeInTheDocument();
  });

  it('marks the grid cells a query reads, and says the rest are skipped', () => {
    render(
      <ConceptDiagram
        id="d3"
        diagram={{
          ...base,
          kind: 'grid',
          title: 'Pruning',
          columns: ['d1', 'd2'],
          rows: ['A', 'B'],
          read: [[0, 1]],
          legend: { read: 'read', skipped: 'pruned' },
        }}
      />,
    );
    expect(screen.getAllByText('read')).toHaveLength(2);
    expect(screen.getAllByText('skipped')).toHaveLength(3);
  });

  it('shows a verdict for every call that crosses a boundary', () => {
    render(
      <ConceptDiagram
        id="d4"
        diagram={{
          ...base,
          kind: 'boundary',
          title: 'Perimeter',
          inside: { label: 'Service perimeter', boxes: [{ label: 'prod' }] },
          outside: [
            { label: 'Copy out', verdict: 'blocked' },
            { label: 'Office', verdict: 'allowed' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  it('renders every diagram of the course without an error', () => {
    const all: GcpDiagram[] = Object.values(DIAGRAMS).flat();
    for (const [index, diagram] of all.entries()) {
      const { unmount } = render(<ConceptDiagram id={`all-${index}`} diagram={diagram} />);
      expect(screen.getByRole('figure', { name: diagram.title })).toBeInTheDocument();
      unmount();
    }
  });
});
