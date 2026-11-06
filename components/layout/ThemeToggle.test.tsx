import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemePicker } from '@/components/profile/ThemePicker';
import { THEME_STORAGE_KEY } from '@/lib/theme';

import { ThemeToggle } from './ThemeToggle';

const root = document.documentElement;

beforeEach(() => {
  // Run the frame callbacks at once, so `data-mode-switching` clears in the test.
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  root.removeAttribute('data-mode');
});

describe('ThemeToggle', () => {
  it('flips light to dark, saves the choice and flips back', () => {
    root.setAttribute('data-mode', 'light');
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(root).toHaveAttribute('data-mode', 'dark');
    expect(root).not.toHaveAttribute('data-mode-switching');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(root).toHaveAttribute('data-mode', 'light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('follows a choice saved in another tab', () => {
    render(<ThemeToggle />);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    act(() => {
      window.dispatchEvent(new Event('storage'));
    });
    expect(root).toHaveAttribute('data-mode', 'dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
});

describe('ThemePicker', () => {
  it('starts on Device and can go back to it after a choice', () => {
    render(<ThemePicker />);
    expect(screen.getByRole('radio', { name: 'Device' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(root).toHaveAttribute('data-mode', 'dark');

    fireEvent.click(screen.getByRole('radio', { name: 'Device' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    // The test device prefers light (tests/setup.ts).
    expect(root).toHaveAttribute('data-mode', 'light');
  });
});
