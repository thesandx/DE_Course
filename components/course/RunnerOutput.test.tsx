import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RunnerOutput } from './RunnerOutput';

describe('RunnerOutput', () => {
  it('shows a table with its row count', () => {
    render(
      <RunnerOutput
        title="Your output"
        output={{
          kind: 'table',
          columns: ['driver_id', 'streak'],
          rows: [
            ['d1', '3'],
            ['d2', 'NULL'],
          ],
          total: 2,
        }}
      />,
    );
    expect(screen.getByText('Your output')).toBeInTheDocument();
    expect(screen.getByText('2 rows')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'streak' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'NULL' })).toHaveClass('italic');
  });

  it('says when it shows only the first rows', () => {
    render(
      <RunnerOutput
        title="Expected"
        output={{ kind: 'table', columns: ['n'], rows: [['1']], total: 80 }}
      />,
    );
    expect(screen.getByText('First 1 of 80 rows')).toBeInTheDocument();
  });

  it('says when a table has no rows', () => {
    render(
      <RunnerOutput
        title="Expected"
        output={{ kind: 'table', columns: ['n'], rows: [], total: 0 }}
      />,
    );
    expect(screen.getByText('No rows')).toBeInTheDocument();
    expect(screen.getByText('0 rows')).toBeInTheDocument();
  });

  it('counts one row in the singular', () => {
    render(
      <RunnerOutput
        title="Expected"
        output={{ kind: 'table', columns: ['n'], rows: [['1']], total: 1 }}
      />,
    );
    expect(screen.getByText('1 row')).toBeInTheDocument();
  });

  it('shows a Python value as text', () => {
    render(<RunnerOutput title="Printed" output={{ kind: 'text', text: "{'a': 1}" }} />);
    expect(screen.getByText("{'a': 1}").tagName).toBe('PRE');
  });
});
