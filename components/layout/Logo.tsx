import Link from 'next/link';

import { Face } from '@/components/ui/Face';
import { cn } from '@/lib/utils';

export interface LogoProps {
  appName: string;
  /** Show only the mark on a phone, where a crowded top bar would cut the name. */
  compact?: boolean;
  className?: string;
}

/** The brand mark and name, linking home. The same in every header and the sidebar. */
export function Logo({ appName, compact = false, className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        'font-display text-heading flex min-h-11 min-w-0 items-center gap-2.5 font-semibold',
        className,
      )}
    >
      <span className="bg-brand shadow-glow inline-grid size-8 shrink-0 place-items-center rounded-full">
        <Face size={26} blush={false} />
      </span>
      <span className={cn('truncate', compact && 'max-sm:sr-only')}>{appName}</span>
    </Link>
  );
}
