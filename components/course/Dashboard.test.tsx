import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EMPTY_PROGRESS, type ProgressRecord } from '@/lib/course/progress';
import { summarize } from '@/lib/course/summary';

import { Dashboard } from './Dashboard';

const TODAY = '2026-11-01';

function renderDashboard(progress: ProgressRecord) {
  return render(
    <Dashboard
      name="Sandeep Jha"
      progress={progress}
      summary={summarize(progress, TODAY)}
      today={TODAY}
    />,
  );
}

describe('Dashboard', () => {
  it('greets a new learner and points to the first lesson', () => {
    renderDashboard(EMPTY_PROGRESS);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hi, Sandeep');
    expect(screen.getAllByText(/Intern/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Continue/ })[0]).toHaveAttribute(
      'href',
      '/de/tracks/playbook/how-loops-work',
    );
  });

  it('shows the streak, level and solved count from the record', () => {
    renderDashboard({
      done: {
        'lesson:playbook:how-loops-work': '2026-10-31',
        'lesson:playbook:senior-signals': '2026-10-31',
        'lesson:playbook:running-the-round': '2026-11-01',
        'lesson:playbook:estimation-numbers': '2026-11-01',
        'problem:not-in-null-trap': '2026-11-01',
      },
      days: { '2026-10-31': 2, '2026-11-01': 3 },
    });
    expect(screen.getAllByText(/Data analyst/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 days/).length).toBeGreaterThan(0);
    // The solved problem shows in recent activity.
    expect(screen.getAllByText('Riders who never cancelled').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Continue/ })[0]).toHaveAttribute(
      'href',
      '/de/tracks/sql/window-functions',
    );
  });
});
