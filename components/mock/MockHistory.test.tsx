import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  advance,
  endRound,
  HISTORY_KEY,
  type MockHistoryEntry,
  newSession,
  pause,
  sessionKey,
} from '@/lib/course/mock-session';

import { MockHistory } from './MockHistory';

const LOOPS = [
  { slug: 'senior', name: 'Senior data engineer loop' },
  { slug: 'uber', name: 'Uber loop' },
];
const PLAN = [['a'], ['b']];

beforeEach(() => {
  window.localStorage.clear();
});

function save(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

describe('MockHistory', () => {
  it('shows nothing when this browser holds no mock', () => {
    const { container } = render(<MockHistory loops={LOOPS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the loops under way and the recent scorecards', async () => {
    const running = advance(newSession('senior', 11, PLAN), 1_000);
    save(sessionKey('senior', 11), running);
    save(sessionKey('uber', 12), pause(advance(newSession('uber', 12, PLAN), 2_000), 3_000));
    save(
      sessionKey('senior', 13),
      endRound(advance(newSession('senior', 13, PLAN), 500), 900, false),
    );
    save(sessionKey('gone', 14), advance(newSession('gone', 14, PLAN), 4_000));
    const entry: MockHistoryEntry = {
      loop: 'uber',
      name: 'Uber loop',
      seed: 9,
      finishedAt: Date.UTC(2026, 10, 20, 12),
      score: 0.74,
      verdict: 'Hire',
      rounds: [{ name: 'Coding', score: 0.74 }],
    };
    save(HISTORY_KEY, [entry, { ...entry, loop: 'gone', seed: 10 }]);

    render(<MockHistory loops={LOOPS} />);

    expect(await screen.findByRole('heading', { name: 'Your mocks' })).toBeInTheDocument();
    const resumes = screen.getAllByRole('link', { name: 'Resume →' });
    expect(resumes.map((link) => link.getAttribute('href'))).toEqual([
      '/de/mock/uber?seed=12',
      '/de/mock/senior?seed=11',
      '/de/mock/senior?seed=13',
    ]);
    expect(screen.getByText('Paused in round 1 of 2.')).toBeInTheDocument();
    expect(screen.getByText('In the review of round 1 of 2.')).toBeInTheDocument();
    expect(screen.getByText('In round 1 of 2. Its clock is still running.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Uber loop' })).toHaveAttribute(
      'href',
      '/de/mock/uber?seed=9',
    );
    expect(screen.getByText('Hire')).toBeInTheDocument();
    expect(screen.getByText('74%')).toBeInTheDocument();
    expect(screen.queryByText(/gone/)).not.toBeInTheDocument();
  });

  it('shows nothing when storage is blocked', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      const { container } = render(<MockHistory loops={LOOPS} />);
      expect(container).toBeEmptyDOMElement();
    } finally {
      if (original !== undefined) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
