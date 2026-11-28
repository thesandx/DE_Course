import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CodeRunner as Runner, RunnerState } from '@/hooks/useCodeRunner';
import type { CaseResult, RunnableSpec } from '@/types/runner';

import { CodeRunner } from './CodeRunner';

const runner = vi.hoisted(() => ({ current: null as Runner | null }));

vi.mock('@/hooks/useCodeRunner', () => ({
  useCodeRunner: () => runner.current,
}));

const SPEC: RunnableSpec = {
  language: 'sql',
  task: 'Return each driver.',
  tables: [{ name: 'drivers', columns: [{ name: 'driver_id', type: 'text' }], rows: [['d1']] }],
  starter: 'SELECT 1;',
  solution: 'SELECT driver_id FROM drivers;',
  cases: [{ name: 'Sample' }, { name: 'Hidden one', hidden: true }],
};

const IDLE: RunnerState = {
  phase: 'idle',
  detail: '',
  action: null,
  cases: [],
  total: 0,
  error: '',
};

function passing(name: string): CaseResult {
  return {
    name,
    note: '',
    hidden: false,
    passed: true,
    message: '',
    stdout: '',
    ms: 4,
    got: { kind: 'table', columns: ['driver_id'], rows: [['d1']], total: 1 },
    expected: { kind: 'table', columns: ['driver_id'], rows: [['d1']], total: 1 },
  };
}

function withState(state: Partial<RunnerState>): Runner {
  const value: Runner = {
    state: { ...IDLE, ...state },
    warm: vi.fn(),
    run: vi.fn(),
    stop: vi.fn(),
  };
  runner.current = value;
  return value;
}

function show(onAccepted?: () => void) {
  return render(
    <CodeRunner
      slug="drivers"
      spec={SPEC}
      runKey="drivers:abc"
      task={<p>Return each driver.</p>}
      {...(onAccepted !== undefined ? { onAccepted } : {})}
    />,
  );
}

describe('CodeRunner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('opens on the starter code and the sample data', () => {
    withState({});
    show();
    expect(screen.getByRole('heading', { name: /Code it in SQL/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'SQL editor' })).toHaveValue('SELECT 1;');
    expect(screen.getByText('drivers')).toBeInTheDocument();
    expect(screen.getByText(/Runs in your browser on PostgreSQL 18/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset code' })).toBeDisabled();
  });

  it('warms the engine when the editor gets focus', () => {
    const value = withState({});
    show();
    fireEvent.focus(screen.getByRole('textbox', { name: 'SQL editor' }));
    expect(value.warm).toHaveBeenCalled();
  });

  it('runs the sample and shows the result, submits and shows the tests', () => {
    const value = withState({});
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(value.run).toHaveBeenCalledWith('run', 'SELECT 1;');
    expect(screen.getByRole('tab', { name: 'Result' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(value.run).toHaveBeenCalledWith('check', 'SELECT 1;');
    expect(screen.getByRole('tab', { name: 'Tests' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the code in this browser, and resets with an undo', () => {
    window.localStorage.setItem('code:drivers', 'SELECT 2;');
    withState({});
    show();
    const area = screen.getByRole('textbox', { name: 'SQL editor' });
    expect(area).toHaveValue('SELECT 2;');
    fireEvent.change(area, { target: { value: 'SELECT 3;' } });
    expect(window.localStorage.getItem('code:drivers')).toBe('SELECT 3;');
    fireEvent.click(screen.getByRole('button', { name: 'Reset code' }));
    expect(area).toHaveValue('SELECT 1;');
    fireEvent.click(screen.getByRole('button', { name: 'Undo reset' }));
    expect(area).toHaveValue('SELECT 3;');
  });

  it('shows the sample verdict and the outputs after Run', () => {
    withState({ phase: 'done', action: 'run', total: 1, cases: [passing('Sample')] });
    show();
    fireEvent.click(screen.getByRole('tab', { name: 'Result' }));
    expect(screen.getByText('The sample case passes.')).toBeInTheDocument();
    expect(screen.getByText('Your output')).toBeInTheDocument();
    expect(screen.getByText('Show the expected output')).toBeInTheDocument();
  });

  it('shows why a failing sample fails, with the line', () => {
    withState({
      phase: 'done',
      action: 'run',
      total: 1,
      cases: [
        {
          ...passing('Sample'),
          passed: false,
          message: 'syntax error',
          got: null,
          error: { message: 'syntax error', line: 2 },
        },
      ],
    });
    show();
    fireEvent.click(screen.getByRole('tab', { name: 'Result' }));
    expect(screen.getByText('The sample case fails.')).toBeInTheDocument();
    expect(screen.getByText('Line 2: syntax error')).toBeInTheDocument();
    expect(screen.getByText('Expected')).toBeInTheDocument();
  });

  it('says when the run did not finish', () => {
    withState({ phase: 'failed', action: 'run', total: 1, error: 'Stopped.' });
    show();
    fireEvent.click(screen.getByRole('tab', { name: 'Result' }));
    expect(screen.getByText('Stopped.')).toBeInTheDocument();
    expect(screen.getAllByText('The run did not finish.').length).toBeGreaterThan(0);
  });

  it('blocks Run and Submit while busy, and stops on request', () => {
    const value = withState({
      phase: 'running',
      action: 'check',
      total: 2,
      cases: [passing('Sample')],
    });
    show();
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    expect(screen.getByText('Running test 2 of 2…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(value.stop).toHaveBeenCalled();
  });

  it('shows the engine loading', () => {
    withState({ phase: 'loading', action: 'run', total: 1, detail: 'Loading pandas' });
    show();
    expect(screen.getByText('Loading pandas…')).toBeInTheDocument();
  });

  it('accepts a Submit that passes every test', () => {
    const onAccepted = vi.fn();
    withState({
      phase: 'done',
      action: 'check',
      total: 2,
      cases: [passing('Sample'), { ...passing('Hidden one'), hidden: true }],
    });
    show(onAccepted);
    expect(screen.getByText('Accepted. All 2 tests pass.')).toBeInTheDocument();
    expect(onAccepted).toHaveBeenCalled();
    expect(screen.getByText(/PostgreSQL 18 · 8 ms/)).toBeInTheDocument();
  });

  it('reports each finished Submit, and can keep its code and note elsewhere', () => {
    window.localStorage.setItem('mock:senior:7:code:drivers', 'SELECT 9;');
    const onChecked = vi.fn();
    withState({
      phase: 'done',
      action: 'check',
      total: 2,
      cases: [passing('Sample'), { ...passing('Hidden one'), hidden: true, passed: false }],
    });
    const { rerender } = render(
      <CodeRunner
        slug="drivers"
        spec={SPEC}
        runKey="drivers:abc"
        task={<p>Return each driver.</p>}
        onChecked={onChecked}
        storageKey="mock:senior:7:code:drivers"
        acceptedNote="Move on to the next question."
      />,
    );
    expect(screen.getByRole('textbox', { name: 'SQL editor' })).toHaveValue('SELECT 9;');
    expect(onChecked).toHaveBeenCalledWith(1, 2);
    withState({
      phase: 'done',
      action: 'check',
      total: 2,
      cases: [passing('Sample'), { ...passing('Hidden one'), hidden: true }],
    });
    rerender(
      <CodeRunner
        slug="drivers"
        spec={SPEC}
        runKey="drivers:abc"
        task={<p>Return each driver.</p>}
        onChecked={onChecked}
        storageKey="mock:senior:7:code:drivers"
        acceptedNote="Move on to the next question."
      />,
    );
    expect(onChecked).toHaveBeenLastCalledWith(2, 2);
    expect(screen.getByText('Move on to the next question.')).toBeInTheDocument();
    expect(window.localStorage.getItem('code:drivers')).toBeNull();
  });

  it('does not accept a Run, even when the sample passes', () => {
    const onAccepted = vi.fn();
    withState({ phase: 'done', action: 'run', total: 1, cases: [passing('Sample')] });
    show(onAccepted);
    expect(screen.queryByText(/Accepted/)).not.toBeInTheDocument();
    expect(onAccepted).not.toHaveBeenCalled();
  });
});
