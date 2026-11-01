import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';

export interface CourseBadgeProps {
  /** The course's `--color-track-*` hue. */
  hue: number;
  /** Two to four characters, such as "GCP". */
  short: string;
  /** A course that is not open yet. */
  muted?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
}

/** A course's square badge: its short name on its hue. Decoration; the name sits next to it. */
export function CourseBadge({
  hue,
  short,
  muted = false,
  size = 'sm',
  className,
}: CourseBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'rounded-box text-ink inline-grid shrink-0 place-items-center font-mono font-semibold',
        size === 'sm' ? 'text-micro size-7' : 'text-small size-11',
        muted ? 'bg-sunken text-ink-faint' : hueStyle(hue).fill,
        className,
      )}
    >
      {short}
    </span>
  );
}
