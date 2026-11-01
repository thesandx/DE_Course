import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SidebarNav } from './SidebarNav';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('SidebarNav', () => {
  it('lists the hub, every course and the profile', () => {
    pathname = '/';
    render(<SidebarNav enrolled={['de']} />);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /DE course/ })).toHaveAttribute('href', '/de');
    expect(screen.getByRole('link', { name: /GCP course/ })).toHaveTextContent('Join');
    expect(screen.getByText('Soon')).toBeInTheDocument();
  });

  it("opens the current course's sections for a learner in it", () => {
    pathname = '/gcp/lines/design';
    render(<SidebarNav enrolled={['gcp']} counts={{ '/gcp/lines': 5 }} />);
    expect(screen.getByRole('link', { name: /Lines/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/gcp');
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('keeps the sections shut for a course the learner has not joined', () => {
    pathname = '/gcp';
    render(<SidebarNav enrolled={[]} />);
    expect(screen.queryByRole('link', { name: /Dashboard/ })).not.toBeInTheDocument();
  });
});
