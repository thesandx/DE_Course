import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseThemeChoice,
  resolveThemeMode,
  THEME_COLORS,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme';

describe('parseThemeChoice', () => {
  it('keeps light and dark, and reads anything else as system', () => {
    expect(parseThemeChoice('light')).toBe('light');
    expect(parseThemeChoice('dark')).toBe('dark');
    expect(parseThemeChoice(null)).toBe('system');
    expect(parseThemeChoice('blue')).toBe('system');
  });
});

describe('resolveThemeMode', () => {
  it('follows the device only for system', () => {
    expect(resolveThemeMode('system', true)).toBe('dark');
    expect(resolveThemeMode('system', false)).toBe('light');
    expect(resolveThemeMode('light', true)).toBe('light');
    expect(resolveThemeMode('dark', false)).toBe('dark');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  const root = document.documentElement;

  function run(stored: string | null, prefersDark: boolean): void {
    if (stored === null) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, stored);
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: prefersDark,
    } as MediaQueryList);
    // The same string the layout inlines into <head>.
    new Function(THEME_INIT_SCRIPT)();
  }

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    root.removeAttribute('data-mode');
    document.head.innerHTML = '';
  });

  it.each([
    [null, true, 'dark'],
    [null, false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['nonsense', true, 'dark'],
  ] as const)('stored %s, device dark %s → %s', (stored, prefersDark, mode) => {
    run(stored, prefersDark);
    expect(root.getAttribute('data-mode')).toBe(mode);
    expect(resolveThemeMode(parseThemeChoice(stored), prefersDark)).toBe(mode);
  });

  it('sets the browser chrome colour for the mode', () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="#000000"><meta name="theme-color" content="#000000">';
    run('dark', false);
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      expect(meta).toHaveAttribute('content', THEME_COLORS.dark);
    }
  });

  it('falls back to the device when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    run(null, true);
    expect(root.getAttribute('data-mode')).toBe('dark');
  });
});
