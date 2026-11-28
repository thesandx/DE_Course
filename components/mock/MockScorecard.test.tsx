import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { verdictFor } from '@/lib/course/mock-score';
import { advance, endRound, newSession, takeHint } from '@/lib/course/mock-session';
import type { MockRoundView } from '@/types/mock';

import { MockScorecard } from './MockScorecard';

const ROUNDS: MockRoundView[] = [
  {
    name: 'SQL',
    minutes: 45,
    focus: null,
    questions: [
      {
        slug: 'top-drivers',
        title: 'Top drivers by city',
        kindLabel: 'SQL',
        difficulty: 'medium',
        track: { slug: 'sql', title: 'SQL' },
        prompt: null,
        answer: null,
        hints: ['Rank in each city.'],
        signals: ['Ties'],
        followUps: [],
      },
    ],
  },
];

function finished() {
  let session = takeHint(advance(newSession('quick', 5, [['top-drivers']]), 0), 0);
  session = endRound(session, 20 * 60_000, true);
  return { ...advance(session, 21 * 60_000), finishedAt: 21 * 60_000 };
}

describe('MockScorecard', () => {
  it('praises a loop with no weak round and offers the next steps', () => {
    const onRetry = vi.fn();
    render(
      <MockScorecard
        loop={{ slug: 'quick', name: 'One-hour practice loop', summary: '' }}
        rounds={ROUNDS}
        session={finished()}
        scores={[0.9]}
        verdict={verdictFor([0.9])}
        limits={[45 * 60_000]}
        onRetry={onRetry}
        headingRef={null}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Strong hire' })).toBeInTheDocument();
    expect(screen.getByText(/Every round scored 70% or more/)).toBeInTheDocument();
    expect(screen.getByText(/Ran out of time at 45:00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Run a new practice loop' })).toHaveAttribute(
      'href',
      '/de/mock/quick',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry these questions' }));
    expect(onRetry).toHaveBeenCalledOnce();
    const stats = screen.getByText('Hints').parentElement;
    expect(stats).toHaveTextContent('1');
  });
});
