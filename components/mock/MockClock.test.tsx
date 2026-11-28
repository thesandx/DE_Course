import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MockClock, type MockClockProps } from './MockClock';

function renderClock(props: Partial<MockClockProps> = {}) {
  const handlers = { onPause: vi.fn(), onResume: vi.fn(), onEnd: vi.fn() };
  render(
    <MockClock
      round={2}
      rounds={5}
      name="System design"
      leftMs={30 * 60_000}
      limitMs={60 * 60_000}
      paused={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('MockClock', () => {
  it('shows the round and the time left, and pauses', () => {
    const { onPause, onEnd } = renderClock();
    expect(screen.getByText('Round 2 of 5')).toBeInTheDocument();
    expect(screen.getByRole('timer', { name: 'Time left in round 2' })).toHaveTextContent('30:00');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'End round' }));
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('resumes from a pause', () => {
    const { onResume } = renderClock({ paused: true });
    const resume = screen.getByRole('button', { name: 'Resume' });
    expect(resume).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(resume);
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('warns at five minutes and at one minute left', () => {
    renderClock({ leftMs: 4 * 60_000 });
    expect(screen.getByText('Five minutes left in this round.')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveClass('text-hard');
  });

  it('warns once a minute is left, and shows a dash before the clock is read', () => {
    const { unmount } = render(
      <MockClock
        round={1}
        rounds={1}
        name="SQL"
        leftMs={45_000}
        limitMs={60_000}
        paused={false}
        onPause={() => {}}
        onResume={() => {}}
        onEnd={() => {}}
      />,
    );
    expect(screen.getByText('One minute left in this round.')).toBeInTheDocument();
    unmount();
    renderClock({ leftMs: null });
    expect(screen.getByRole('timer')).toHaveTextContent('–:––');
  });
});
