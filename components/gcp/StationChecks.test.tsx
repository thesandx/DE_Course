import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StationCheck } from '@/types/gcp';

import { StationChecks } from './StationChecks';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const CHECKS: StationCheck[] = [
  {
    type: 'choice',
    prompt: 'Pick the right one',
    options: ['Right', 'Wrong', 'Other', 'Last'],
    answers: [0],
    why: 'It is right.',
  },
  {
    type: 'match',
    prompt: 'Match them',
    pairs: [
      ['Left A', 'Right A'],
      ['Left B', 'Right B'],
    ],
    why: 'They pair up.',
  },
  {
    type: 'order',
    prompt: 'Order them',
    steps: ['First', 'Second'],
    why: 'First comes first.',
  },
];

function finish(): HTMLElement {
  return screen.getByRole('button', { name: /Finish station/ });
}

describe('StationChecks', () => {
  it('keeps the finish button shut until every check is right', () => {
    render(<StationChecks itemId="station:x" checks={CHECKS} done={false} xp={60} />);
    expect(finish()).toBeDisabled();
    expect(screen.getByText(/Get every checkpoint right/)).toBeInTheDocument();

    // Pick: a wrong pick, then the right one.
    fireEvent.click(screen.getByRole('button', { name: /Wrong/ }));
    expect(screen.getByText('Not quite')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Right/ }));
    expect(screen.getByText('It is right.')).toBeInTheDocument();

    // Match: a wrong match first, then the right one.
    const [first, second] = screen.getAllByRole('combobox');
    if (first === undefined || second === undefined) throw new Error('no selects');
    fireEvent.change(first, { target: { value: '1' } });
    fireEvent.change(second, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check matches' }));
    expect(screen.getAllByText('Not quite').length).toBeGreaterThan(0);
    fireEvent.change(first, { target: { value: '0' } });
    fireEvent.change(second, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check matches' }));

    // Order: scrambled, so check once (wrong), move, and check again.
    fireEvent.click(screen.getByRole('button', { name: 'Check order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move down: Second' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check order' }));

    expect(screen.getByText(/3 of 3/)).toBeInTheDocument();
    expect(finish()).toBeEnabled();
  });

  it('says a finished station is finished', () => {
    render(<StationChecks itemId="station:x" checks={CHECKS} done xp={60} />);
    const finishSection = screen.getByRole('region', { name: 'Finish the station' });
    expect(within(finishSection).getByText('Station finished.')).toBeInTheDocument();
  });
});
