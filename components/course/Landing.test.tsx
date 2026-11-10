import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(
      screen.getByRole('heading', { level: 2, name: `${TRACKS.length} tracks, one senior bar` }),
    ).toBeInTheDocument();
  });

  it('presents every company loop', () => {
    render(<Landing signInHref="/sign-in" />);
    for (const name of ['Uber', 'Google', 'Amazon', 'Microsoft', 'Flipkart', 'Swiggy']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Read the Amazon loop guide/ })).toHaveAttribute(
      'href',
      expect.stringContaining('companies'),
    );
  });

  it('walks the sample question step by step and reveals the model on demand', () => {
    render(<Landing signInHref="/sign-in" />);
    fireEvent.click(screen.getByRole('tab', { name: /Estimates/ }));
    expect(screen.getByRole('tab', { name: /Estimates/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Model answer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reveal model' }));
    expect(screen.getByText('Model answer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Why this grain?' }));
    expect(screen.getByRole('status')).toHaveTextContent('Why this grain?');
  });
});
