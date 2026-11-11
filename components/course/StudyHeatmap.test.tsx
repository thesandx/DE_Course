import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyHeatmap } from './StudyHeatmap';

describe('StudyHeatmap', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Noon UTC, so the learner's local day is the same in any test time zone east of -12.
    vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const activity = {
    seconds: { '2026-11-11': 2700, '2026-11-10': 600 },
    items: { '2026-11-10': 2 },
  };

  it('gives the headline, the streaks and today’s time', () => {
    render(<StudyHeatmap activity={activity} today="2026-11-11" />);
    expect(
      screen.getByRole('heading', { name: '2 days studied in the last year' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Current streak').nextSibling).toHaveTextContent('2 days');
    expect(screen.getByText('Time this year').nextSibling).toHaveTextContent('55m');
    expect(screen.getByText('Today').nextSibling).toHaveTextContent('45m');
  });

  it('names every day, and says what the learner did on the one they pick', () => {
    render(<StudyHeatmap activity={activity} today="2026-11-11" />);
    const yesterday = screen.getByRole('button', {
      name: 'Tue, 10 Nov 2026: 10m studied, 2 items finished',
    });
    fireEvent.click(yesterday);
    expect(yesterday).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText('Tue, 10 Nov 2026: 10m studied, 2 items finished', { selector: 'p' }),
    ).toBeInTheDocument();
  });

  it('moves a day with the arrow keys and stops at today', () => {
    render(<StudyHeatmap activity={activity} today="2026-11-11" />);
    const today = screen.getByRole('button', { name: /^Wed, 11 Nov 2026/ });
    expect(today).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(today, { key: 'ArrowDown' });
    expect(today).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(today, { key: 'ArrowUp' });
    expect(screen.getByRole('button', { name: /^Tue, 10 Nov 2026/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
