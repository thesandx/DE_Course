import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LabFinish, LabMeter, LabProgress, LabTick } from './LabProgress';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => {
  window.localStorage.clear();
});

function renderLab(done = false) {
  return render(
    <LabProgress station="test-station">
      <LabTick id="step-1" label="I did step 1" />
      <LabTick id="cleanup-1" label="I deleted the bucket" />
      <LabTick id="cleanup-2" label="I deleted the dataset" />
      <LabMeter ids={['cleanup-1', 'cleanup-2']} label="Cleanup" />
      <LabFinish
        itemId="lab:test-station"
        done={done}
        xp={50}
        cleanup={['cleanup-1', 'cleanup-2']}
      />
    </LabProgress>,
  );
}

describe('LabProgress', () => {
  it('keeps the finish button locked until every cleanup step is ticked', () => {
    renderLab();
    const finish = screen.getByRole('button', { name: 'Finish lab · +50 XP' });
    expect(finish).toBeDisabled();
    expect(screen.getByText(/Tick every cleanup step first/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('I did step 1'));
    fireEvent.click(screen.getByLabelText('I deleted the bucket'));
    expect(finish).toBeDisabled();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('I deleted the dataset'));
    expect(finish).toBeEnabled();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('remembers ticks in this browser', () => {
    const { unmount } = renderLab();
    fireEvent.click(screen.getByLabelText('I deleted the bucket'));
    unmount();
    renderLab();
    expect(screen.getByLabelText('I deleted the bucket')).toBeChecked();
    expect(screen.getByLabelText('I deleted the dataset')).not.toBeChecked();
  });

  it('shows a finished lab as done', () => {
    renderLab(true);
    expect(screen.getByText('Lab finished and cleaned up.')).toBeInTheDocument();
  });
});
