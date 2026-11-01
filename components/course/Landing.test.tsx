import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TRACKS } from '@/lib/course/catalog';

import { Landing } from './Landing';

describe('Landing', () => {
  it('leads with one heading and one sign-in call to action', () => {
    render(<Landing signInHref="/sign-in?next=/" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Pass the senior data engineer loop',
    );
    expect(screen.getAllByRole('link', { name: /Start learning/ })[0]).toHaveAttribute(
      'href',
      '/sign-in?next=/',
    );
  });

  it('counts the tracks from the catalogue', () => {
    render(<Landing signInHref="/sign-in" />);
    expect(screen.getByText(new RegExp(`${TRACKS.length} tracks`))).toBeInTheDocument();
  });

  it('presents both company loops', () => {
    render(<Landing signInHref="/sign-in" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Uber' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Google' })).toBeInTheDocument();
  });
});
