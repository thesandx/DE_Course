/**
 * Light and dark mode: the names, the storage key and the script that picks a
 * mode before first paint. Pure data and pure functions, so the logic is
 * tested without a browser.
 *
 * The mode is `data-mode` on <html>. The tokens in `styles/globals.css`
 * re-assign under `[data-mode='dark']`, so no component knows the mode.
 *
 * See design-language.md > Light and dark.
 */

/** What the learner chose. `system` follows the device setting. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** What the page shows. */
export type ThemeMode = 'light' | 'dark';

export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

/** The localStorage key. A device setting, so it is not stored in Firestore. */
export const THEME_STORAGE_KEY = 'loop-ready-theme';

/** The event the page fires when the learner changes the mode in this tab. */
export const THEME_CHANGE_EVENT = 'loop-ready-theme-change';

/**
 * The browser chrome colour per mode. Each matches `--color-paper` for that
 * mode; `tests/site-checklist.test.ts` fails when they differ.
 */
export const THEME_COLORS: Readonly<Record<ThemeMode, string>> = {
  light: '#f8f5f0',
  dark: '#0f0d1d',
};

/** Reads a stored value. Anything unknown, or nothing, means `system`. */
export function parseThemeChoice(value: unknown): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** The mode a choice shows, given whether the device prefers dark. */
export function resolveThemeMode(choice: ThemeChoice, systemPrefersDark: boolean): ThemeMode {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

/**
 * The inline script in <head>. It runs before the body paints, so a dark-mode
 * learner never sees a light flash. Every `theme-color` tag gets the chosen
 * mode's colour, because a hand-picked mode overrides the device's. It mirrors `parseThemeChoice` and
 * `resolveThemeMode`; the test runs it against both. Storage can throw (a
 * private window, blocked site data), so the script falls back to the system.
 * The key and colours are literals, not interpolated, so no value is built
 * into code; `lib/theme.test.ts` checks they match the constants above.
 */
export const THEME_INIT_SCRIPT =
  "(function(){var d=document.documentElement,s=null;try{s=localStorage.getItem('loop-ready-theme')}catch(e){}" +
  "var c=s==='light'||s==='dark'?s:'system';" +
  "var m=c==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):c;" +
  "d.setAttribute('data-mode',m);var k=document.querySelectorAll('meta[name=\"theme-color\"]');" +
  "for(var i=0;i<k.length;i++)k[i].setAttribute('content',m==='dark'?'#0f0d1d':'#f8f5f0');})();";
