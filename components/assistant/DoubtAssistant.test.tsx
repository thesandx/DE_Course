import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DoubtAssistant } from './DoubtAssistant';

let pathname = '/de/tracks/sql/window-functions';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const fetchMock = vi.fn<typeof fetch>();

function streamed(text: string): Response {
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

describe('DoubtAssistant', () => {
  beforeEach(() => {
    pathname = '/de/tracks/sql/window-functions';
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens from the floating button with a model dropdown and suggestions', () => {
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    expect(screen.getByRole('dialog', { name: /Pip/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toHaveValue('anthropic/claude-haiku-5.5');
    expect(screen.getByRole('button', { name: /Explain this page in simple words/ })).toBeVisible();
  });

  it('remembers the chosen model', () => {
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'anthropic/claude-sonnet-5.5' },
    });
    expect(window.localStorage.getItem('loop-ready-assistant-model')).toBe(
      'anthropic/claude-sonnet-5.5',
    );
  });

  it('sends the question with the page path and shows the streamed answer', async () => {
    fetchMock.mockResolvedValue(streamed('Use `ROW_NUMBER()` to **pick one row**.'));
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    fireEvent.change(screen.getByLabelText('Your doubt'), { target: { value: 'Why not RANK?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('ROW_NUMBER()')).toBeInTheDocument();
    expect(screen.getByText('pick one row')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/assistant');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      path: '/de/tracks/sql/window-functions',
      messages: [{ role: 'user', content: 'Why not RANK?' }],
    });
    await waitFor(() =>
      expect(
        window.sessionStorage.getItem('loop-ready-assistant-chat:/de/tracks/sql/window-functions'),
      ).toContain('Why not RANK?'),
    );
  });

  it('shows the server message when the model cannot answer', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'busy', message: 'That model is busy right now.' }, { status: 429 }),
    );
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    fireEvent.click(screen.getByRole('button', { name: /Quiz me with one question/ }));
    expect(await screen.findByText('That model is busy right now.')).toBeInTheDocument();
  });

  it('offers hints, not answers, on a problem page', () => {
    pathname = '/de/problems/latest-trip-status';
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    expect(screen.getByRole('button', { name: /Give me a small hint/ })).toBeInTheDocument();
  });

  it('says it is not set up when the server has no key', () => {
    render(<DoubtAssistant enabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    expect(screen.getByText(/not set up yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your doubt')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<DoubtAssistant enabled />);
    fireEvent.click(screen.getByRole('button', { name: /Ask Pip/ }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
