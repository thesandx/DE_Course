'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { buttonStyles } from '@/components/ui/Button';
import { activeTabHref, APP_TABS, TABLESS_PATHS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export interface SiteHeaderProps {
  appName: string;
  className?: string;
}

/**
 * The public header: the landing page, sign-in, the design reference and the
 * 404 page. Signed-in course pages draw their own shell (`AppShell`), and a CSS
 * rule in globals.css hides this header there, so the server sends one HTML
 * and nothing flashes.
 *
 * On a phone it is a slim top bar with the logo and "Sign in"; the destinations
 * live in the `TabBar`. From `md` up it is the website header with the
 * destinations as pills and the two calls to action.
 */
export function SiteHeader({ appName, className }: SiteHeaderProps) {
  const pathname = usePathname();
  const current = activeTabHref(pathname);
  const onSignIn = TABLESS_PATHS.includes(pathname);

  return (
    <div data-site-chrome className={cn('bg-paper/90 sticky top-0 z-30 backdrop-blur', className)}>
      <div className="flex items-center gap-3 px-4 py-3 md:hidden">
        <Logo appName={appName} />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {!onSignIn && (
            <Link href="/sign-in" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              Sign in
            </Link>
          )}
        </div>
      </div>
      <div className="hidden md:block">
        <header className="mx-auto flex w-full max-w-6xl items-center gap-8 px-8 py-4">
          <Logo appName={appName} />
          <nav aria-label="Main">
            <ul className="flex items-center gap-1">
              {APP_TABS.map((tab) => {
                const active = tab.href === current;
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'rounded-pill text-small inline-flex min-h-9 items-center border px-3.5 font-medium',
                        active
                          ? 'bg-surface border-line text-ink shadow-card'
                          : 'text-ink-soft hover:text-ink border-transparent',
                      )}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {!onSignIn && (
              <>
                <Link
                  href="/sign-in"
                  className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                >
                  Sign in
                </Link>
                <Link href="/sign-in?next=/" className={buttonStyles({ size: 'sm' })}>
                  Start learning
                </Link>
              </>
            )}
          </div>
        </header>
      </div>
    </div>
  );
}
