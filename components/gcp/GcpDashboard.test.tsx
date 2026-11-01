import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getLine } from '@/lib/course/gcp/catalog';
import { summarizeGcp } from '@/lib/course/gcp/summary';
import { EMPTY_PROGRESS, type ProgressRecord } from '@/lib/course/progress';

import { GcpDashboard } from './GcpDashboard';
import { MetroLine } from './MetroLine';

const TODAY = '2026-11-01';

const DESIGN_DONE: ProgressRecord = {
  done: {
    'station:security-compliance': '2026-10-31',
    'station:reliability-fidelity': '2026-10-31',
    'station:flexibility-portability': TODAY,
    'station:data-migrations': TODAY,
    'boss:design': TODAY,
    'mock:pass': TODAY,
  },
  days: { '2026-10-31': 2, [TODAY]: 4 },
};

function renderDashboard(progress: ProgressRecord) {
  return render(
    <GcpDashboard
      name="Sandeep Jha"
      progress={progress}
      summary={summarizeGcp(progress, TODAY)}
      today={TODAY}
    />,
  );
}

describe('GcpDashboard', () => {
  it('greets a new learner and sends them to station 1.1', () => {
    renderDashboard(EMPTY_PROGRESS);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hi, Sandeep');
    expect(screen.getByText(/Rank 1 · Trainee/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ride on: 1.1/ })).toHaveAttribute(
      'href',
      '/gcp/lines/design/security-compliance',
    );
  });

  it("counts today's XP, bosses and stations from the GCP tracker", () => {
    renderDashboard(DESIGN_DONE);
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    expect(screen.getByText('4 / 19')).toBeInTheDocument();
    expect(screen.getAllByText(/Daily goal met|of 100 XP today/).length).toBeGreaterThan(0);
    expect(screen.getByText('Passed · replay any time')).toBeInTheDocument();
  });
});

describe('MetroLine', () => {
  const design = getLine('design');
  const ingest = getLine('ingest');
  if (design === undefined || ingest === undefined) throw new Error('missing line');

  it('locks the boss until every station is done', () => {
    render(<MetroLine line={ingest} done={{}} nextSlug="pipeline-planning" />);
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('3 stops to unlock')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Boss round/ })).not.toBeInTheDocument();
  });

  it('opens the boss and marks it beaten', () => {
    render(<MetroLine line={design} done={DESIGN_DONE.done} />);
    expect(screen.getAllByText('Done')).toHaveLength(4);
    expect(screen.getByRole('link', { name: /Boss round/ })).toHaveAttribute(
      'href',
      '/gcp/lines/design/boss',
    );
    expect(screen.getByText('Beaten')).toBeInTheDocument();
  });
});
