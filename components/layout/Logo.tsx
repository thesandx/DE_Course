import Link from 'next/link';

import { Face } from '@/components/ui/Face';
import { cn } from '@/lib/utils';

export interface LogoProps {
  appName: string;
  className?: string;
}

/** The brand mark and name, linking home. The same in every header and the sidebar. */
export function Logo({ appName, className }: LogoProps) {
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
      <span className="truncate">{appName}</span>
    </Link>
  );
}
