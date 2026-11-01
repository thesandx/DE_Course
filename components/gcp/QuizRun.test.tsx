import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BankQuestion } from '@/types/gcp';

import { QuizRun, type QuizRunProps } from './QuizRun';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

function question(id: number, answers: number[] = [0]): BankQuestion {
  return {
    station: 's',
    prompt: `Question ${id}?`,
    options: [`right ${id}`, `wrong ${id}`, `also ${id}`, `nope ${id}`],
    answers,
    why: `Because ${id}.`,
  };
}

function props(over: Partial<QuizRunProps> = {}): QuizRunProps {
  return {
    mode: 'boss',
    title: 'The Boss',
    story: 'A story.',
    groups: [
      {
        line: { slug: 'design', short: 'Design', weight: 100 },
        questions: [question(1), question(2, [0, 2])],
      },
    ],
    count: 2,
    passRatio: 0.5,
    itemId: 'boss:design',
    xp: 100,
    done: false,
    backHref: '/gcp/lines/design',
    backLabel: 'Back',
    ...over,
  };
}

/** Picks the options whose text starts with "right" or "also" for the current question. */
function answerRight(): void {
  for (const button of screen.getAllByRole('button')) {
    const text = button.textContent ?? '';
    const multi = screen.queryByText(/^Choose 2$/) !== null;
    if (/^[A-D]right/.test(text) || (multi && /^[A-D]also/.test(text))) fireEvent.click(button);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
}

/** Picks a wrong option. On a single-answer question the last click wins. */
function answerWrong(): void {
  for (const button of screen.getAllByRole('button')) {
    const text = button.textContent ?? '';
    if (/^[A-D](wrong|nope)/.test(text)) fireEvent.click(button);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
}

describe('QuizRun', () => {
  it('starts on a story screen and draws the questions on Start', () => {
    render(<QuizRun {...props()} />);
    expect(screen.getByRole('heading', { name: 'The Boss' })).toBeInTheDocument();
    expect(screen.getByText('+100 XP for a pass')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start the boss round' }));
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Boss health')).toBeInTheDocument();
  });

  it('saves a pass once and shows the XP win', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<QuizRun {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the boss round' }));
    answerRight();
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    answerRight();
    expect(await screen.findByText('+100 XP')).toBeInTheDocument();
    expect(screen.getByText('Boss defeated')).toBeInTheDocument();
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as unknown;
    expect(body).toMatchObject({ course: 'gcp', itemId: 'boss:design', done: true });
  });

  it('shows the misses and saves nothing on a fail', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<QuizRun {...props({ passRatio: 1 })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the boss round' }));
    answerWrong();
    expect(screen.getByText('Not quite.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    answerRight();
    expect(screen.getByText('Not this time')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review your misses' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('breaks a mock exam down by domain and says when the XP was already banked', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<QuizRun {...props({ mode: 'mock', title: 'Mock exam', done: true })} />);
    expect(screen.getByText('Already beaten · replay for practice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start the mock exam' }));
    answerRight();
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    answerRight();
    expect(screen.getByText('Mock exam passed')).toBeInTheDocument();
    expect(screen.getByText(/already banked/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Score by domain' })).toBeInTheDocument();
  });

  it('reports a save that failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    render(<QuizRun {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start the boss round' }));
    answerRight();
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    answerRight();
    await waitFor(() => expect(screen.getByText(/Sign in again/)).toBeInTheDocument());
  });
});
