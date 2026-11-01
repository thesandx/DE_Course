import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuickChecks } from './QuickChecks';

const CHECKS = [
  {
    question: 'Which key keeps a trip in order?',
    options: ['city_id', 'trip_id'],
    answer: 1,
    why: 'Same key, same partition.',
  },
  { question: 'Does LIMIT cut the scan?', options: ['Yes', 'No'], answer: 1, why: 'It does not.' },
];

describe('QuickChecks', () => {
  it('says "Not quite" in words for a wrong pick and shows why', () => {
    render(<QuickChecks checks={CHECKS} />);
    fireEvent.click(screen.getByRole('button', { name: 'city_id' }));
    expect(screen.getByRole('button', { name: /city_id\s*Not quite/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Same key, same partition.')).toBeInTheDocument();
  });

  it('locks the other options once a question is answered correctly', () => {
    render(<QuickChecks checks={CHECKS} />);
    fireEvent.click(screen.getByRole('button', { name: 'trip_id' }));
    expect(screen.getByRole('button', { name: /trip_id\s*Correct/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'city_id' })).toBeDisabled();
  });

  it('reports all-correct only when every question is solved', () => {
    const onAllCorrect = vi.fn();
    render(<QuickChecks checks={CHECKS} onAllCorrect={onAllCorrect} />);
    fireEvent.click(screen.getByRole('button', { name: 'trip_id' }));
    expect(onAllCorrect).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onAllCorrect).toHaveBeenLastCalledWith(true);
  });

  it('ignores a second press on the same option', () => {
    const onAllCorrect = vi.fn();
    render(<QuickChecks checks={CHECKS} onAllCorrect={onAllCorrect} />);
    fireEvent.click(screen.getByRole('button', { name: 'city_id' }));
    fireEvent.click(screen.getByRole('button', { name: /city_id/ }));
    expect(onAllCorrect).toHaveBeenCalledTimes(1);
  });
});
