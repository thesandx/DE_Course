'use client';

import { Icon, type IconName } from '@/components/layout/Icon';
import { useTheme } from '@/hooks/useTheme';
import { THEME_CHOICES, type ThemeChoice } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: Readonly<Record<ThemeChoice, { label: string; icon: IconName }>> = {
  system: { label: 'Device', icon: 'monitor' },
  light: { label: 'Light', icon: 'sun' },
  dark: { label: 'Dark', icon: 'moon' },
};

export interface ThemePickerProps {
  className?: string;
}

/**
 * The appearance setting: follow the device, or always light, or always dark.
 * Native radios under segmented pills, so the keyboard and screen readers get
 * a real radio group. The header `ThemeToggle` flips between light and dark;
 * this is the one place to go back to "Device".
 */
export function ThemePicker({ className }: ThemePickerProps) {
  const { choice, setChoice } = useTheme();

  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="text-body mb-2 font-semibold">Appearance</legend>
      <div className="bg-sunken border-line rounded-pill grid grid-cols-3 gap-1 border p-1">
        {THEME_CHOICES.map((option) => {
          const { label, icon } = OPTIONS[option];
          const checked = option === choice;
          return (
            <label
              key={option}
              className={cn(
                'press rounded-pill text-small flex min-h-11 cursor-pointer items-center justify-center gap-2 px-3 font-medium transition-colors',
                'has-[:focus-visible]:outline-brand has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2',
                checked ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink',
              )}
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={checked}
                onChange={() => setChoice(option)}
                className="sr-only"
              />
              <Icon name={icon} className="size-4" />
              {label}
            </label>
          );
        })}
      </div>
      <p className="text-small text-ink-faint">
        Saved on this device. Device follows your phone or computer setting.
      </p>
    </fieldset>
  );
}
