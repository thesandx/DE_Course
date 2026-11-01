import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceSprint } from './ServiceSprint';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ROUNDS = [
  {
    scenario: 'Petabyte SQL',
    answer: 'BigQuery',
    distractors: ['Bigtable', 'Cloud SQL', 'Spanner'],
  },
  {
    scenario: 'IoT time series',
    answer: 'Bigtable',
    distractors: ['BigQuery', 'Firestore', 'Spanner'],
  },
];

describe('ServiceSprint', () => {
  it('scores taps until the deck ends, then saves a milestone reached', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ServiceSprint
        rounds={ROUNDS}
        seconds={60}
        milestones={[{ target: 1, itemId: 'sprint:10', xp: 25, done: false }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start the sprint' }));
    for (let i = 0; i < 2; i += 1) {
      const scenario = screen.getByText(/Petabyte SQL|IoT time series/).textContent ?? '';
      const answer = scenario.includes('Petabyte') ? 'BigQuery' : 'Bigtable';
      fireEvent.click(screen.getByRole('button', { name: answer }));
    }
    expect(screen.getByRole('heading', { name: '2 right' })).toBeInTheDocument();
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ends the run when the time runs out', () => {
    render(<ServiceSprint rounds={ROUNDS} seconds={2} milestones={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the sprint' }));
    const scenario = screen.getByText(/Petabyte SQL|IoT time series/).textContent ?? '';
    fireEvent.click(
      screen.getByRole('button', { name: scenario.includes('Petabyte') ? 'Spanner' : 'Firestore' }),
    );
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole('heading', { name: '0 right' })).toBeInTheDocument();
    expect(screen.getByText(/1 miss/)).toBeInTheDocument();
  });
});
