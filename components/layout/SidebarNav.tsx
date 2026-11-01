'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { APP_TABS, isTabActive } from '@/lib/navigation';
import { cn } from '@/lib/utils';

import { Icon } from './Icon';

export interface SidebarNavProps {
  /** A count shown at the end of a destination's row, keyed by its href. */
  counts?: Readonly<Record<string, number>>;
}

/** The sidebar's destinations. A client component only to read the current path. */
export function SidebarNav({ counts = {} }: SidebarNavProps) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1">
        {APP_TABS.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          const count = counts[tab.href];
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-input text-body flex min-h-10 items-center gap-3 px-3 font-medium transition-colors',
                  active ? 'bg-ink text-on-night' : 'text-ink-soft hover:bg-sunken hover:text-ink',
                )}
              >
                <Icon name={tab.icon} className="size-4.5" />
                <span className="grow">{tab.label}</span>
                {count !== undefined && (
                  <span
                    className={cn('text-small', active ? 'text-on-night-soft' : 'text-ink-faint')}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
