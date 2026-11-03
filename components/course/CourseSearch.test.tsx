import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SearchEntry } from '@/types/search';

import { CourseSearch } from './CourseSearch';

const ENTRIES: SearchEntry[] = [
  {
    id: 'track:sql',
    kind: 'track',
    title: 'SQL for the interview',
    context: 'Track',
    href: '/de/tracks/sql',
    dot: 'bg-track-1',
    detail: 'Joins, windows and gaps.',
    keywords: [],
  },
  {
    id: 'lesson:sql:windows',
    kind: 'lesson',
    title: 'Window functions',
    context: 'SQL for the interview',
    href: '/de/tracks/sql/windows',
    dot: 'bg-track-1',
    detail: '14 min · Rank rows.',
    keywords: ['QUALIFY'],
  },
  {
    id: 'problem:dedupe',
    kind: 'problem',
    title: 'Latest status per trip',
    context: 'SQL for the interview',
    href: '/de/problems/dedupe',
    dot: 'bg-track-1',
    detail: 'Easy · SQL',
    keywords: ['QUALIFY', 'ROW_NUMBER'],
  },
];

function renderSearch(initialQuery = '') {
  return render(
    <CourseSearch
      entries={ENTRIES}
      browse={ENTRIES.slice(0, 1)}
      examples={['window functions']}
      courseShort="DE"
      scope="topic, lesson or problem"
      initialQuery={initialQuery}
    />,
  );
}

describe('CourseSearch', () => {
  it('shows examples and the tracks to browse before the learner types', () => {
    renderSearch();
    expect(screen.getByRole('button', { name: 'window functions' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SQL for the interview' })).toHaveAttribute(
      'href',
      '/de/tracks/sql',
    );
  });

  it('lists matches as links, and says which term matched', () => {
    renderSearch();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'qualify' } });
    expect(screen.getByRole('status')).toHaveTextContent('2 results');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/de/tracks/sql/windows',
      '/de/problems/dedupe',
    ]);
    expect(links[0]).toHaveTextContent('Covers QUALIFY');
  });

  it('filters the results by kind', () => {
    renderSearch('qualify');
    fireEvent.click(screen.getByRole('button', { name: /Problem/ }));
    expect(screen.getByRole('status')).toHaveTextContent('1 result');
    expect(screen.getByRole('link', { name: /Latest status per trip/ })).toBeInTheDocument();
  });

  it('fills the box from an example', () => {
    renderSearch();
    fireEvent.click(screen.getByRole('button', { name: 'window functions' }));
    expect(screen.getByRole('searchbox')).toHaveValue('window functions');
    expect(screen.getByRole('link', { name: /Window functions/ })).toBeInTheDocument();
  });

  it('offers to clear the search when nothing matches', () => {
    renderSearch('kubernetes');
    expect(screen.getByText('Nothing in DE matches “kubernetes”.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});
