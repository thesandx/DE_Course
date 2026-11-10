import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PipMascot } from './PipMascot';

describe('PipMascot', () => {
  it('is decoration by default and an image when labelled', () => {
    const { container } = render(<PipMascot />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    render(<PipMascot label="Pip waves" mood="wow" />);
    expect(screen.getByRole('img', { name: 'Pip waves' })).toBeInTheDocument();
  });

  it('draws every mood', () => {
    for (const mood of ['happy', 'thinking', 'wow', 'sleepy'] as const) {
      const { container } = render(<PipMascot mood={mood} size={32} blink />);
      expect(container.querySelector('svg')).toHaveAttribute('width', '32');
    }
  });
});
