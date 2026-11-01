import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CompleteButton } from './CompleteButton';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

function mockFetch(status: number): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

const props = {
  course: 'de' as const,
  itemId: 'problem:a',
  xp: 40,
  label: 'Mark solved',
  doneLabel: 'Problem solved',
};

describe('CompleteButton', () => {
  it('saves, shows the XP win and refreshes the page', async () => {
    const fetchMock = mockFetch(200);
    render(<CompleteButton {...props} done={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark solved · +40 XP' }));
    expect(await screen.findByText('+40 XP')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as unknown;
    expect(body).toMatchObject({ course: 'de', itemId: 'problem:a', done: true });
  });

  it('asks the learner to sign in again on 401', async () => {
    mockFetch(401);
    render(<CompleteButton {...props} done={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark solved/ }));
    expect(await screen.findByText(/Sign in again/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows an error when the save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<CompleteButton {...props} done={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark solved/ }));
    expect(await screen.findByText(/Progress was not saved/)).toBeInTheDocument();
  });

  it('shows the error for a server failure too', async () => {
    mockFetch(500);
    render(<CompleteButton {...props} done={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark solved/ }));
    expect(await screen.findByText(/Progress was not saved/)).toBeInTheDocument();
  });

  it('is blocked with a visible reason', () => {
    render(<CompleteButton {...props} done={false} blockedReason="Reveal the answer first." />);
    expect(screen.getByRole('button', { name: /Mark solved/ })).toBeDisabled();
    expect(screen.getByText('Reveal the answer first.')).toBeInTheDocument();
  });

  it('lets a finished item be undone', async () => {
    const fetchMock = mockFetch(200);
    render(<CompleteButton {...props} done />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark as not done' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as unknown;
    expect(body).toMatchObject({ done: false });
  });
});
