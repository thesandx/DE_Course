'use client';

import { useId } from 'react';

import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  /** The name of the group, always visible. */
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

/** A row of buttons of which one is pressed. For a choice of two to four. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={id} className="text-small text-ink-soft font-semibold">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-pill text-small min-h-11 border px-4 font-semibold transition-colors duration-200',
              option.value === value
                ? 'bg-ink text-on-ink border-ink'
                : 'bg-surface border-line text-ink-soft hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** The value as the learner reads it, such as "250m". Defaults to the number. */
  display?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/** A native slider with its label and its value. Native, so the keyboard and a phone work. */
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  disabled,
  onChange,
}: RangeProps) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col">
      <div className="text-small text-ink-soft flex justify-between gap-3">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="text-ink font-mono font-semibold">
          {display ?? value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-brand h-11 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      />
    </div>
  );
}
