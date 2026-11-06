'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  parseThemeChoice,
  resolveThemeMode,
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  type ThemeChoice,
  type ThemeMode,
} from '@/lib/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readChoice(): ThemeChoice {
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage is blocked (a private window, cleared site data): follow the system.
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Puts a mode on the page: the tokens, the browser chrome colour, no transitions. */
function applyMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (root.getAttribute('data-mode') === mode) return;
  root.setAttribute('data-mode-switching', '');
  root.setAttribute('data-mode', mode);
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', THEME_COLORS[mode]);
  }
  // Two frames: the first paints the new colours, the second lets transitions back.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.removeAttribute('data-mode-switching')),
  );
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const sync = (): void => {
    applyMode(resolveThemeMode(readChoice(), systemPrefersDark()));
    onChange();
  };
  // The device setting changed, another tab saved a choice, or this tab did.
  media.addEventListener('change', sync);
  window.addEventListener('storage', sync);
  window.addEventListener(THEME_CHANGE_EVENT, sync);
  return () => {
    media.removeEventListener('change', sync);
    window.removeEventListener('storage', sync);
    window.removeEventListener(THEME_CHANGE_EVENT, sync);
  };
}

/** One string, so React compares snapshots by value. */
function getSnapshot(): string {
  const choice = readChoice();
  return `${choice}:${resolveThemeMode(choice, systemPrefersDark())}`;
}

/** The server cannot know; the head script has already painted the right mode. */
function getServerSnapshot(): string {
  return 'system:light';
}

export interface UseTheme {
  /** What the learner chose: `system`, `light` or `dark`. */
  choice: ThemeChoice;
  /** What the page shows now. */
  mode: ThemeMode;
  /** Saves a choice on this device and applies it at once. */
  setChoice: (choice: ThemeChoice) => void;
}

/**
 * The colour mode. The choice lives in localStorage, because it belongs to the
 * device: a phone in dark mode and a laptop in light mode is a normal setup.
 * With no choice saved, the page follows the device and changes with it.
 */
export function useTheme(): UseTheme {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [choicePart, modePart] = snapshot.split(':');
  const choice = parseThemeChoice(choicePart);
  const mode: ThemeMode = modePart === 'dark' ? 'dark' : 'light';

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage is blocked: the mode still changes for this page view.
    }
    applyMode(resolveThemeMode(next, systemPrefersDark()));
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return useMemo(() => ({ choice, mode, setChoice }), [choice, mode, setChoice]);
}
