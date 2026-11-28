import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DataTable } from '@/types/runner';

import { RunnerData } from './RunnerData';

const TRIPS: DataTable = {
  name: 'trips',
  columns: [
    { name: 'trip_id', type: 'int' },
    { name: 'tags', type: 'jsonb' },
    { name: 'paid', type: 'boolean' },
    { name: 'city', type: 'text' },
  ],
  rows: [
    [1, { surge: true }, true, null],
    [2, ['a'], false, 'Pune'],
  ],
};

describe('RunnerData', () => {
  it('shows each table with its column types', () => {
    render(<RunnerData tables={[TRIPS]} language="sql" />);
    expect(screen.getByText('trips')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('2 rows')).toBeInTheDocument();
    expect(screen.getByText('jsonb')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '{"surge":true}' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'NULL' })).toHaveClass('italic');
    expect(screen.getByRole('cell', { name: 'false' })).toBeInTheDocument();
  });

  it('names a DataFrame by the engine', () => {
    const { rerender } = render(<RunnerData tables={[TRIPS]} language="pyspark" />);
    expect(screen.getByText('DataFrame')).toBeInTheDocument();
    rerender(<RunnerData tables={[TRIPS]} language="python" />);
    expect(screen.getByText('pandas DataFrame')).toBeInTheDocument();
  });

  it('shows the first 30 rows of a big table and counts the rest', () => {
    const big: DataTable = {
      name: 'numbers',
      columns: [{ name: 'n', type: 'int' }],
      rows: Array.from({ length: 45 }, (_, index) => [index]),
    };
    render(<RunnerData tables={[big]} language="sql" />);
    expect(screen.getAllByRole('row')).toHaveLength(31);
    expect(screen.getByText('15 more rows are loaded but not shown.')).toBeInTheDocument();
  });

  it('shows the setup code with a title for the language', () => {
    const { rerender } = render(
      <RunnerData tables={[]} setup="amounts = [3, 4]" language="python" />,
    );
    expect(screen.getByText('Inputs your code can use')).toBeInTheDocument();
    rerender(<RunnerData tables={[TRIPS]} setup="CREATE INDEX ON trips (city);" language="sql" />);
    expect(screen.getByText('Runs before your query')).toBeInTheDocument();
  });

  it('says when there is no sample data', () => {
    render(<RunnerData tables={[]} setup="  " language="python" />);
    expect(screen.getByText(/no sample data/)).toBeInTheDocument();
  });
});
