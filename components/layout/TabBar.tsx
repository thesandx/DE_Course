'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { activeTabHref, type TabIcon, TABLESS_PATHS, tabsFor } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const ICONS: Record<TabIcon, React.ReactNode> = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />,
  course: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 014 18.5z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 001.5-1.5z" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.5" />
      <circle cx="4.5" cy="12" r="1.5" />
      <circle cx="4.5" cy="18" r="1.5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
    </>
  ),
};

export interface TabBarProps {
  className?: string;
}

/**
 * The bottom tab bar: the app's top-level destinations, always one thumb away.
 * It floats above the page, as the nav bar does in a native app, and hides on
 * focused screens such as sign-in. Destinations live in `lib/navigation.ts`.
 *
 * Phone posture only. From `md` up it hides, and `SiteHeader` shows the same
 * destinations at the top, as a website does.
 *
 * The active tab sits on a raised pill that springs across to the tab the user
 * pressed. It moves on the press itself, not when the next page arrives, so the
 * bar answers at once even on a slow network. The pill, the lift and
 * `aria-current` mark the tab together, so the state never rests on colour alone.
 *
 * A client component: it reads the current path and remembers the pressed tab.
 */
export function TabBar({ className }: TabBarProps) {
  const pathname = usePathname();
  const [pressed, setPressed] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState(pathname);

  // The new page has arrived, so the path is the truth again. Updating state
  // during render is React's pattern for resetting on a prop change.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setPressed(null);
  }

  if (TABLESS_PATHS.includes(pathname)) return null;

  const tabs = tabsFor(pathname);
  const current = activeTabHref(pathname, tabs);
  const activeIndex = tabs.findIndex((tab) => tab.href === (pressed ?? current));

  return (
    <nav
      aria-label="Main"
      className={cn(
        'fixed inset-x-3 bottom-3 z-30 mx-auto max-w-sm pb-[env(safe-area-inset-bottom)] md:hidden',
        className,
      )}
    >
      <ul className="bg-surface border-line shadow-raised rounded-pill relative flex border p-1.5">
        <span
          aria-hidden="true"
          className={cn(
            'bg-ink shadow-card rounded-pill absolute top-1.5 bottom-1.5 left-1.5',
            'ease-spring transition-[transform,opacity] duration-300',
            activeIndex === -1 && 'opacity-0',
          )}
          style={{
            // 0.75rem is the ul's padding on both sides, p-1.5 twice.
            width: `calc((100% - 0.75rem) / ${tabs.length})`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          }}
        />
        {tabs.map((tab, index) => {
          const active = index === activeIndex;
          return (
            <li key={tab.href} className="relative flex-1">
              <Link
                href={tab.href}
                aria-current={tab.href === current ? 'page' : undefined}
                onClick={(event) => {
                  // A modified click opens a new browser tab; this page stays put.
                  const newTab = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
                  if (!newTab && event.button === 0) setPressed(tab.href);
                }}
                className={cn(
                  'press rounded-pill flex min-h-13 flex-col items-center justify-center gap-0.5 px-1',
                  'text-small font-medium transition-colors duration-200',
                  active ? 'text-on-night' : 'text-ink-soft hover:text-ink',
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={cn('stroke-current size-5', active && 'animate-check')}
                  fill="none"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICONS[tab.icon]}
                </svg>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
