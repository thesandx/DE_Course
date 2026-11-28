import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { HISTORY_KEY, newSession, sessionKey } from '@/lib/course/mock-session';
import type { MockQuestionView, MockRoundView } from '@/types/mock';

import { MockRunner } from './MockRunner';

/* jsdom has <dialog> but no modal behaviour. See Dialog.test.tsx. */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  window.scrollTo = () => {};
});

beforeEach(() => {
  window.localStorage.clear();
});

function question(slug: string, title: string): MockQuestionView {
  return {
    slug,
    title,
    kindLabel: 'Concept',
    difficulty: 'medium',
    track: { slug: 'sql', title: 'SQL' },
    prompt: <p>Prompt of {slug}</p>,
    answer: <p>Answer of {slug}</p>,
    hints: [`First hint of ${slug}`, `Second hint of ${slug}`],
    signals: [`${slug} names the grain`, `${slug} handles NULLs`],
    followUps: [`What if ${slug} arrives late?`],
  };
}

const ROUNDS: MockRoundView[] = [
  {
    name: 'SQL',
    minutes: 30,
    focus: <p>Two SQL problems.</p>,
    questions: [question('q-a', 'Alpha'), question('q-b', 'Beta')],
  },
  {
    name: 'Design',
    minutes: 45,
    focus: <p>One design.</p>,
    questions: [question('q-c', 'Gamma')],
  },
];

const LOOP = { slug: 'test', name: 'Test loop', summary: 'A loop for the tests.' };
const PLAN = [['q-a', 'q-b'], ['q-c']];

function renderRunner() {
  return render(<MockRunner loop={LOOP} seed={42} rounds={ROUNDS} />);
}

function endRound() {
  fireEvent.click(screen.getByRole('button', { name: 'End round' }));
  const dialog = screen.getByRole('dialog', { name: 'End this round now?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'End round' }));
}

describe('MockRunner', () => {
  it('runs a loop from the briefing to the scorecard and keeps the scorecard', async () => {
    renderRunner();

    // The briefing: the plan, no titles, and the pace.
    expect(await screen.findByRole('heading', { level: 1, name: 'Test loop' })).toHaveFocus();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('1 h 15 min')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Extra time/ }));
    expect(screen.getByText('1 h 53 min')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start round 1' }));

    // Round 1: the clock at 1.5 times the pace, the question without its title.
    expect(await screen.findByRole('heading', { level: 1, name: 'Round 1: SQL' })).toHaveFocus();
    expect(screen.getByRole('timer', { name: 'Time left in round 1' })).toHaveTextContent('45:00');
    expect(screen.getByText('Prompt of q-a')).toBeVisible();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take hint 1 of 2' }));
    expect(screen.getByText('First hint of q-a')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Your answer/ }), {
      target: { value: 'Group by day, then rank.' },
    });
    expect(window.localStorage.getItem(`${sessionKey('test', 42)}:draft:q-a`)).toBe(
      'Group by day, then rank.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByText('The clock is paused.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    endRound();

    // The review: titles, the learner's work, the model answers, the signals.
    expect(await screen.findByRole('heading', { level: 1, name: 'SQL' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/de/problems/q-a');
    expect(screen.getByText('Group by day, then rank.')).toBeInTheDocument();
    expect(screen.getByText('Answer of q-a')).toBeInTheDocument();
    expect(screen.getByText('1 hint')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'q-a names the grain' }));
    expect(screen.getByText(/1 of 2 ticked/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start round 2' }));

    // Round 2, then its review, then the scorecard.
    expect(await screen.findByRole('heading', { level: 1, name: 'Round 2: Design' })).toBeVisible();
    endRound();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'q-c names the grain' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'q-c handles NULLs' }));
    fireEvent.click(screen.getByRole('button', { name: 'See the scorecard' }));

    // Round 1 scored under 0.3, which caps the verdict.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lean no hire' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SQL' })).toHaveAttribute('href', '/de/tracks/sql');
    expect(screen.getByRole('link', { name: 'Alpha →' })).toHaveAttribute(
      'href',
      '/de/problems/q-a',
    );
    expect(screen.queryByRole('link', { name: 'Gamma →' })).not.toBeInTheDocument();

    const history = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]') as {
      loop: string;
      verdict: string;
      score: number;
      rounds: { name: string; score: number }[];
    }[];
    expect(history).toHaveLength(1);
    expect(history[0]?.loop).toBe('test');
    expect(history[0]?.verdict).toBe('Lean no hire');
    expect(history[0]?.rounds.map((round) => round.name)).toEqual(['SQL', 'Design']);
    expect(history[0]?.score).toBeCloseTo((0.225 + 1) / 2);

    // Retry starts the same questions again, with fresh drafts.
    fireEvent.click(screen.getByRole('button', { name: 'Retry these questions' }));
    expect(await screen.findByRole('button', { name: 'Start round 1' })).toBeInTheDocument();
    expect(window.localStorage.getItem(`${sessionKey('test', 42)}:draft:q-a`)).toBeNull();
  });

  it('resumes a saved loop after a refresh', async () => {
    const first = renderRunner();
    fireEvent.click(await screen.findByRole('button', { name: 'Start round 1' }));
    expect(await screen.findByRole('timer')).toBeInTheDocument();
    first.unmount();

    renderRunner();
    expect(await screen.findByRole('heading', { level: 1, name: 'Round 1: SQL' })).toBeVisible();
  });

  it('ends a round by itself when its time is up', async () => {
    const session = newSession('test', 42, PLAN);
    const started = {
      ...session,
      phase: 'round' as const,
      rounds: session.rounds.map((round, index) =>
        index === 0 ? { ...round, startedAt: Date.now() - 31 * 60_000 } : round,
      ),
    };
    window.localStorage.setItem(sessionKey('test', 42), JSON.stringify(started));

    renderRunner();
    expect(await screen.findByText(/The clock ran out/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start round 2' })).toBeInTheDocument();
  });

  it('starts afresh when the saved session is for other questions', async () => {
    const other = { ...newSession('test', 42, [['x'], ['y']]), phase: 'round' as const };
    window.localStorage.setItem(sessionKey('test', 42), JSON.stringify(other));

    renderRunner();
    expect(await screen.findByRole('button', { name: 'Start round 1' })).toBeInTheDocument();
  });
});
