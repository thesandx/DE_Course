import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EMPTY_PROGRESS } from '@/lib/course/progress';

import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('greets a new learner and points to the first lesson', () => {
    render(<Dashboard name="Sandeep" progress={EMPTY_PROGRESS} today="2026-11-01" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sandeep');
    expect(screen.getByText(/Intern/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue/ })).toHaveAttribute(
      'href',
      '/tracks/playbook/how-loops-work',
    );
  });

  it('shows the streak, level and solved count from the record', () => {
    render(
      <Dashboard
        name="Sandeep"
        today="2026-11-01"
        progress={{
          done: {
            'lesson:playbook:how-loops-work': '2026-10-31',
            'lesson:playbook:senior-signals': '2026-10-31',
            'lesson:playbook:running-the-round': '2026-11-01',
            'lesson:playbook:estimation-numbers': '2026-11-01',
            'problem:not-in-null-trap': '2026-11-01',
          },
          days: { '2026-10-31': 2, '2026-11-01': 3 },
        }}
      />,
    );
    expect(screen.getByText(/Data analyst/)).toBeInTheDocument();
    expect(screen.getAllByText(/2 days/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Continue/ })).toHaveAttribute(
      'href',
      '/tracks/sql/window-functions',
    );
  });
});
