import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PipGrader } from '@/components/mock/PipGrader';
import type { PipGrade } from '@/lib/course/mock-session';

const GRADE = {
  covered: [{ signal: 0, evidence: 'an accumulating snapshot' }],
  followUp: 'What if a step is skipped?',
  summary: 'The grain is right. Skipped steps are missing.',
};

function respond(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe('PipGrader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the answer and hands back the grade', async () => {
    respond(200, GRADE);
    const onGrade = vi.fn();
    render(
      <PipGrader
        slug="returns"
        answer="Use an accumulating snapshot."
        grade={undefined}
        enabled
        onGrade={onGrade}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Grade my answer' }));
    await waitFor(() => expect(onGrade).toHaveBeenCalled());
    expect(onGrade).toHaveBeenCalledWith({ ...GRADE, replied: false });
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      slug: 'returns',
      answer: 'Use an accumulating snapshot.',
    });
  });

  it('asks the follow-up and sends the reply once', async () => {
    respond(200, { ...GRADE, followUp: 'And reopened returns?' });
    const onGrade = vi.fn();
    const grade: PipGrade = { ...GRADE, replied: false };
    render(<PipGrader slug="returns" answer="x" grade={grade} enabled onGrade={onGrade} />);
    expect(screen.getByText('What if a step is skipped?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'Lags stay NULL.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send my reply' }));
    await waitFor(() => expect(onGrade).toHaveBeenCalled());
    expect(onGrade).toHaveBeenCalledWith(
      expect.objectContaining({
        replied: true,
        question: 'What if a step is skipped?',
        reply: 'Lags stay NULL.',
      }),
    );
  });

  it('shows no reply box after the reply, and nothing when Pip is off', () => {
    const grade: PipGrade = { ...GRADE, replied: true, question: 'Q?', reply: 'R.' };
    const { rerender } = render(
      <PipGrader slug="returns" answer="x" grade={grade} enabled onGrade={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Your reply')).not.toBeInTheDocument();
    expect(screen.getByText('R.')).toBeInTheDocument();
    rerender(
      <PipGrader slug="returns" answer="x" grade={undefined} enabled={false} onGrade={vi.fn()} />,
    );
    expect(screen.queryByRole('region', { name: "Pip's grade" })).not.toBeInTheDocument();
  });

  it('says why when the server refuses', async () => {
    respond(402, { error: 'out_of_credits', message: 'The OpenRouter account is out of credit.' });
    render(<PipGrader slug="returns" answer="x" grade={undefined} enabled onGrade={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grade my answer' }));
    expect(await screen.findByText('The OpenRouter account is out of credit.')).toBeInTheDocument();
  });

  it('has nothing to grade without an answer', () => {
    render(<PipGrader slug="returns" answer="  " grade={undefined} enabled onGrade={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Grade my answer' })).not.toBeInTheDocument();
  });
});
