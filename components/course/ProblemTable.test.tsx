import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type ProblemRow, ProblemTable } from './ProblemTable';

const ROWS: ProblemRow[] = [
  {
    slug: 'a',
    title: 'Latest status per trip',
    trackSlug: 'sql',
    trackTitle: 'SQL',
    kindLabel: 'SQL',
    difficulty: 'easy',
    companies: ['uber'],
    done: true,
  },
  {
    slug: 'b',
    title: 'Merge k sorted files',
    trackSlug: 'python',
    trackTitle: 'Python',
    kindLabel: 'Coding',
    difficulty: 'hard',
    companies: ['google'],
    done: false,
  },
];
const TRACKS = [
  { slug: 'sql', title: 'SQL' },
  { slug: 'python', title: 'Python' },
];

describe('ProblemTable', () => {
  it('links every problem', () => {
    render(<ProblemTable rows={ROWS} tracks={TRACKS} />);
    expect(screen.getByRole('link', { name: /Latest status per trip/ })).toHaveAttribute(
      'href',
      '/problems/a',
    );
    expect(screen.getByRole('link', { name: /Merge k sorted files/ })).toHaveAttribute(
      'href',
      '/problems/b',
    );
  });

  it('filters by search text', () => {
    render(<ProblemTable rows={ROWS} tracks={TRACKS} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'merge' } });
    expect(screen.queryByRole('link', { name: /Latest status/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Merge k sorted/ })).toBeInTheDocument();
  });

  it('filters by difficulty, company and status', () => {
    render(<ProblemTable rows={ROWS} tracks={TRACKS} />);
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } });
    expect(screen.queryByRole('link', { name: /Latest status/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'uber' } });
    expect(screen.queryByRole('link', { name: /Merge k/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'solved' } });
    expect(screen.getByRole('link', { name: /Latest status/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Merge k/ })).not.toBeInTheDocument();
  });

  it('starts on a given track and offers a reset when nothing matches', () => {
    render(<ProblemTable rows={ROWS} tracks={TRACKS} initialTrack="python" />);
    expect(screen.queryByRole('link', { name: /Latest status/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } });
    expect(screen.getByText('No problems match these filters.')).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: /clear|reset|show all/i })[0] as HTMLElement,
    );
    expect(screen.getByRole('link', { name: /Merge k sorted/ })).toBeInTheDocument();
  });

  it('hides the filters in compact mode', () => {
    render(<ProblemTable rows={ROWS} tracks={TRACKS} compact />);
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
  });
});
