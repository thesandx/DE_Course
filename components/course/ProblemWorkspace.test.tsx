import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProblemWorkspace } from './ProblemWorkspace';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const props = {
  slug: 'kafka-key-choice',
  itemId: 'problem:kafka-key-choice',
  xp: 20,
  hints: ['Which consumer needs order?', 'Think about hot partitions.'],
  signals: ['Ties the key to ordering'],
  followUps: ['How do you grow partitions?'],
  answer: <p>Key by trip_id.</p>,
};

describe('ProblemWorkspace', () => {
  it('shows hints one at a time', () => {
    render(<ProblemWorkspace {...props} done={false} />);
    expect(screen.queryByText(/Which consumer/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show hint 1 of 2' }));
    expect(screen.getByText(/Which consumer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show hint 2 of 2' }));
    expect(screen.getByText(/hot partitions/)).toBeInTheDocument();
  });

  it('keeps "Mark solved" blocked until the model answer is revealed', () => {
    render(<ProblemWorkspace {...props} done={false} />);
    expect(screen.getByRole('button', { name: /Mark solved/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reveal the model answer' }));
    expect(screen.getByText('Key by trip_id.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ties the key to ordering' })).toBeInTheDocument();
    expect(screen.getByText('How do you grow partitions?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark solved/ })).toBeEnabled();
  });

  it('keeps the draft in this browser', () => {
    window.localStorage.setItem('draft:kafka-key-choice', 'saved draft');
    render(<ProblemWorkspace {...props} done={false} />);
    const box = screen.getByLabelText('Your answer');
    expect(box).toHaveValue('saved draft');
    fireEvent.change(box, { target: { value: 'new draft' } });
    expect(window.localStorage.getItem('draft:kafka-key-choice')).toBe('new draft');
  });
});
