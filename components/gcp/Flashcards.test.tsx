import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Flashcards } from './Flashcards';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

const CARDS = [
  { id: 'card:design:0', line: 'design', front: 'Front one', back: 'Back one' },
  { id: 'card:ingest:0', line: 'ingest', front: 'Front two', back: 'Back two' },
];
const LINES = [
  { slug: 'design', short: 'Design', hue: 3 },
  { slug: 'ingest', short: 'Ingest', hue: 5 },
];

describe('Flashcards', () => {
  it('flips a card, saves it as known and moves to the next', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<Flashcards cards={CARDS} lines={LINES} known={[]} xpPerCard={2} />);
    expect(screen.getByText('Front one')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(screen.getByText('Back one')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it · +2 XP' }));
    expect(await screen.findByText('Front two')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends a card to the back of the pile with Again', () => {
    render(<Flashcards cards={CARDS} lines={LINES} known={[]} xpPerCard={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Again' }));
    expect(screen.getByText('Front two')).toBeInTheDocument();
  });

  it('filters by line and clears the pile of known cards', () => {
    render(<Flashcards cards={CARDS} lines={LINES} known={['card:ingest:0']} xpPerCard={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ingest' }));
    expect(screen.getByRole('heading', { name: 'Pile cleared' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review all cards again' }));
    expect(screen.getByText('Front two')).toBeInTheDocument();
  });

  it('keeps the card when the save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    render(<Flashcards cards={CARDS} lines={LINES} known={[]} xpPerCard={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Got it · +2 XP' }));
    expect(await screen.findByText(/was not saved/)).toBeInTheDocument();
    expect(screen.getByText('Back one')).toBeInTheDocument();
  });
});
