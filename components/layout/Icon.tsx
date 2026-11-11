import { cn } from '@/lib/utils';

/**
 * The line icons the shell and the course pages draw. One stroke weight and
 * one 24px grid, so every icon reads as one set. Decoration only: the text
 * next to an icon always carries the meaning.
 */
export type IconName =
  | 'home'
  | 'book'
  | 'list'
  | 'person'
  | 'search'
  | 'flame'
  | 'star'
  | 'trophy'
  | 'check'
  | 'clock'
  | 'arrow-right'
  | 'arrow-left'
  | 'spark'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'note';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />,
  book: (
    <>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 014 18.5z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 001.5-1.5z" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="3" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  flame: (
    <path d="M12 3c.6 3.4 4.8 5.3 4.8 10a4.8 4.8 0 01-9.6 0c0-2.2 1-3.6 2.2-4.8.2 1.6.9 2.6 1.9 3.1C11 9 11.4 6 12 3z" />
  ),
  star: <path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 01-8 0z" />
      <path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7" />
    </>
  ),
  check: <path d="M6 12.5l4 4 8-9" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.8" />
    </>
  ),
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  spark: <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  note: (
    <>
      <path d="M6 3.5h9l4 4V19a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19V5a1.5 1.5 0 011-1.5z" />
      <path d="M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />,
  monitor: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  className?: string;
  /** Fills the shape instead of stroking it. For the flame, star and trophy badges. */
  filled?: boolean;
}

export function Icon({ name, className, filled = false }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(
        'size-5 shrink-0',
        filled ? 'fill-current stroke-current' : 'stroke-current',
        className,
      )}
      fill="none"
      strokeWidth={filled ? 1.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
