import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CaseResult, RunCase } from '@/types/runner';

import { RunnerTests } from './RunnerTests';

const CASES: RunCase[] = [
  { name: 'Sample' },
  { name: 'Ties', note: 'Two runs of the same length.' },
  { name: 'Big fleet', hidden: true },
];

function result(name: string, passed: boolean, extra: Partial<CaseResult> = {}): CaseResult {
  return { name, note: '', hidden: false, passed, message: '', stdout: '', ms: 12.4, ...extra };
}

describe('RunnerTests', () => {
  it('lists every test before the first Submit', () => {
    render(<RunnerTests cases={CASES} results={[]} running={false} />);
    expect(screen.getByText(/Submit runs all 3 tests/)).toBeInTheDocument();
    expect(screen.getAllByText('Not run yet')).toHaveLength(3);
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText('Two runs of the same length.')).toBeInTheDocument();
  });

  it('shows the tests still running', () => {
    render(<RunnerTests cases={CASES} results={[result('Sample', true)]} running />);
    expect(screen.getByRole('progressbar', { name: 'Tests passing' })).toHaveAttribute(
      'aria-valuetext',
      '1 of 3',
    );
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getAllByText('Running')).toHaveLength(2);
    expect(screen.getByText('12 ms')).toBeInTheDocument();
  });

  it('opens a failed visible test to compare the outputs', () => {
    const table = { kind: 'table' as const, columns: ['n'], rows: [['1']], total: 1 };
    render(
      <RunnerTests
        cases={CASES}
        results={[
          result('Sample', true),
          result('Ties', false, {
            message: 'Row 1 differs.',
            got: table,
            expected: { ...table, rows: [['2']] },
          }),
          result('Big fleet', false, { hidden: true, message: 'Wrong count.', got: table }),
        ]}
        running={false}
      />,
    );
    expect(screen.getByText('Row 1 differs.')).toBeInTheDocument();
    expect(screen.getByText('Wrong count.')).toBeInTheDocument();
    // Only the visible case offers the outputs: the hidden data stays hidden.
    const compare = screen.getAllByText('Compare the outputs');
    expect(compare).toHaveLength(1);
    fireEvent.click(compare[0] as HTMLElement);
    expect(screen.getByText('Your output')).toBeInTheDocument();
    expect(screen.getByText('Expected')).toBeInTheDocument();
  });

  it('names the line of an error', () => {
    render(
      <RunnerTests
        cases={CASES.slice(0, 1)}
        results={[
          result('Sample', false, {
            message: 'syntax error at or near "FRM"',
            error: { message: 'syntax error at or near "FRM"', line: 3 },
          }),
        ]}
        running={false}
      />,
    );
    expect(screen.getByText(/Line 3: syntax error/)).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
