'use client';

import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

import { Icon } from './Icon';

export interface ThemeToggleProps {
  className?: string;
}

/**
 * The light and dark switch in every header. One press flips the mode and
 * saves the choice on this device. "Match my device" lives on the profile
 * page (`ThemePicker`).
 *
 * The icon is chosen by CSS (`dark:`), not by state, so the server HTML is
 * right for both modes and the button never flickers while it hydrates.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setChoice } = useTheme();
  const next = mode === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cn(
        'press bg-surface border-line text-ink-soft hover:text-ink hover:border-line-strong inline-grid size-11 shrink-0 place-items-center rounded-full border transition-colors',
        className,
      )}
    >
      <Icon name="moon" className="size-5 dark:hidden" />
      <Icon name="sun" className="text-gold hidden size-5 dark:block" />
    </button>
  );
}
