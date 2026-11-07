'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

export interface CopyButtonProps {
  /** The text to put on the clipboard. */
  text: string;
  /** What is copied, for screen readers: "Cloud Shell commands". */
  label: string;
  className?: string;
}

/**
 * Copies a block of commands to the clipboard and says so for two seconds.
 * A client component because it calls the Clipboard API.
 */
export function CopyButton({ text, label, className }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${label}`}
      className={cn(
        'text-micro text-on-night-soft hover:text-on-night rounded-input border-night-line inline-flex min-h-11 items-center border px-3 font-mono md:min-h-8',
        className,
      )}
    >
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy' : 'Copy'}
      </span>
    </button>
  );
}
