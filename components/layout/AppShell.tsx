import Link from 'next/link';

import { copyrightLine } from '@/lib/contact';
import { PROBLEMS, TRACKS } from '@/lib/course/catalog';
import type { CourseSlug } from '@/lib/course/courses';
import { CARDS, LINES } from '@/lib/course/gcp/catalog';
import type { ShellStats } from '@/lib/course/shell-stats';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';

import { BackButton, type BackButtonProps } from './BackButton';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { SidebarNav } from './SidebarNav';

export interface Crumb {
  label: string;
  href?: string;
}

export interface AppShellProps {
  /** Default: the configured app name. */
  appName?: string;
  learnerName: string;
  /** The courses the learner joined, for the sidebar's course list. */
  enrolled: readonly CourseSlug[];
  /** The course the page belongs to. Absent on the hub and the profile. */
  course?: CourseSlug;
  /** The course's streak and XP. Absent outside a course, where no tracker applies. */
  stats?: ShellStats;
  /**
   * `sidebar`: the dashboard and lists — a sidebar from `md` up, search in the
   * top bar. `focus`: a lesson or a problem — no sidebar, a breadcrumb instead,
   * so the reading column gets the room.
   */
  variant?: 'sidebar' | 'focus';
  crumbs?: readonly Crumb[];
  /** The `focus` variant's back arrow on a phone, where the breadcrumb does not fit. */
  back?: BackButtonProps;
  children: React.ReactNode;
}

const FOOTER_LINKS = [
  { href: '/', label: 'All courses' },
  { href: '/de/companies/uber', label: 'Uber loop guide' },
  { href: '/gcp/practice/mock', label: 'GCP mock exam' },
  { href: '/design', label: 'Design system' },
] as const;

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/** A two-line stat in a pill: the flame streak and the XP star in the top bar. */
function StatPill({
  icon,
  value,
  label,
  tone,
}: {
  icon: 'flame' | 'star';
  value: string;
  label: string;
  tone: 'brand' | 'iris';
}) {
  return (
    <span className="bg-surface border-line rounded-pill shadow-card inline-flex min-h-11 items-center gap-2 border py-1 pr-4 pl-3">
      <Icon
        name={icon}
        filled={icon === 'flame'}
        className={cn('size-4', tone === 'brand' ? 'text-gold-deep' : 'text-iris')}
      />
      <span className="flex flex-col leading-tight">
        <span
          className={cn('text-small font-semibold', tone === 'iris' ? 'text-iris' : 'text-ink')}
        >
          {value}
        </span>
        <span className="text-micro text-ink-faint">{label}</span>
      </span>
    </span>
  );
}

/**
 * The signed-in shell. A phone gets a slim top bar with the streak and XP, and
 * the `TabBar` at the bottom (from the root layout). From `md` up, the
 * `sidebar` variant adds a fixed sidebar: the destinations, the streak card and
 * the learner. The public SiteHeader and Footer hide while this is on the page
 * (see `[data-app-shell]` in globals.css).
 *
 * A Server Component: only the sidebar links read the current path, in
 * `SidebarNav`.
 */
/** Counts at the end of the sidebar rows. */
const SIDEBAR_COUNTS: Readonly<Record<string, number>> = {
  '/de/tracks': TRACKS.length,
  '/de/problems': PROBLEMS.length,
  '/gcp/lines': LINES.length,
  '/gcp/practice': CARDS.length,
};

export function AppShell({
  appName = env.appName,
  learnerName,
  enrolled,
  course,
  stats,
  variant = 'sidebar',
  crumbs = [],
  back,
  children,
}: AppShellProps) {
  const xpLabel =
    stats === undefined
      ? ''
      : stats.xpTarget === null
        ? `${stats.xp} XP`
        : `${stats.xp} / ${stats.xpTarget} XP`;
  const levelLine =
    stats?.levelLine ?? `${enrolled.length} ${enrolled.length === 1 ? 'course' : 'courses'}`;

  return (
    <div data-app-shell className="flex min-h-dvh flex-1 flex-col">
      {variant === 'sidebar' && (
        <aside className="border-line bg-paper fixed inset-y-0 left-0 z-20 hidden w-56 flex-col gap-6 border-r px-3 py-5 md:flex">
          <Logo appName={appName} className="px-2" />
          <SidebarNav enrolled={enrolled} counts={SIDEBAR_COUNTS} />
          <div className="mt-auto flex flex-col gap-2">
            {stats !== undefined && (
              <div className="bg-night-glow rounded-card text-on-night flex flex-col gap-1 p-4">
                <Icon name="flame" filled className="text-gold-deep size-5" />
                <p className="font-display text-key font-semibold">
                  {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
                </p>
                <p className="text-small text-on-night-soft">
                  {course === 'gcp' ? 'GCP' : 'DE'} streak · best {stats.bestStreak}
                </p>
              </div>
            )}
            <Link
              href="/profile"
              className="bg-surface border-line rounded-card hover:border-line-strong flex items-center gap-3 border p-3 transition-colors"
            >
              <span
                aria-hidden="true"
                className="bg-brand-gradient text-on-night text-small inline-grid size-9 shrink-0 place-items-center rounded-full font-semibold"
              >
                {initialOf(learnerName)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body truncate font-semibold">{learnerName}</span>
                <span className="text-small text-ink-faint truncate">{levelLine}</span>
              </span>
            </Link>
          </div>
        </aside>
      )}

      <div className={cn('flex min-w-0 flex-1 flex-col', variant === 'sidebar' && 'md:pl-56')}>
        <header className="bg-paper/90 border-line sticky top-0 z-10 border-b backdrop-blur">
          <div
            className={cn(
              'mx-auto flex w-full items-center gap-3 px-4 py-2.5 md:gap-4 md:px-8 md:py-3',
              variant === 'sidebar' ? 'max-w-5xl md:px-8' : 'max-w-7xl',
            )}
          >
            {variant === 'focus' && back !== undefined && (
              <BackButton {...back} className="md:hidden" />
            )}
            <Logo
              appName={appName}
              className={cn(
                variant === 'sidebar' && 'md:hidden',
                variant === 'focus' && back !== undefined && 'hidden md:flex',
              )}
            />

            {variant === 'sidebar' && course !== 'de' ? (
              <span className="hidden md:block" />
            ) : variant === 'sidebar' ? (
              <form action="/de/problems" role="search" className="hidden max-w-sm flex-1 md:block">
                <label className="bg-surface border-line rounded-pill shadow-card focus-within:border-line-strong flex min-h-11 items-center gap-2.5 border px-4">
                  <Icon name="search" className="text-ink-faint size-4" />
                  <span className="sr-only">Search problems</span>
                  <input
                    type="search"
                    name="q"
                    placeholder="Search problems, tracks, concepts"
                    className="text-body placeholder:text-ink-faint min-w-0 flex-1 bg-transparent outline-none"
                  />
                  <kbd className="border-line text-micro text-ink-faint rounded-box bg-sunken border px-1.5 py-0.5 font-mono">
                    ⌘K
                  </kbd>
                </label>
              </form>
            ) : (
              <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
                <ol className="text-body flex items-center gap-2">
                  {crumbs.map((crumb, index) => (
                    <li key={crumb.label} className="flex min-w-0 items-center gap-2">
                      {index > 0 && (
                        <span aria-hidden="true" className="text-ink-faint">
                          /
                        </span>
                      )}
                      {crumb.href !== undefined ? (
                        <Link href={crumb.href} className="text-ink-soft hover:text-ink truncate">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span aria-current="page" className="truncate font-semibold">
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {stats === undefined ? (
                <Link
                  href="/profile"
                  aria-label={`Profile: ${learnerName}`}
                  className="bg-brand-gradient text-on-night text-small inline-grid size-9 place-items-center rounded-full font-semibold md:hidden"
                >
                  {initialOf(learnerName)}
                </Link>
              ) : variant === 'sidebar' ? (
                <>
                  <span className="md:hidden">
                    <span className="bg-surface border-line rounded-pill text-small inline-flex min-h-9 items-center gap-1 border px-3 font-semibold">
                      <Icon name="flame" filled className="text-gold-deep size-4" />
                      {stats.streak}
                      <span className="sr-only"> day streak</span>
                    </span>
                  </span>
                  <span className="md:hidden">
                    <span className="bg-surface border-line rounded-pill text-small text-iris inline-flex min-h-9 items-center border px-3 font-semibold">
                      {stats.xp} XP
                    </span>
                  </span>
                  <span className="hidden items-center gap-2 md:flex">
                    <StatPill
                      icon="flame"
                      value={String(stats.streak)}
                      label="day streak"
                      tone="brand"
                    />
                    <StatPill
                      icon="star"
                      value={String(stats.xp)}
                      label={stats.xpTarget === null ? 'XP' : `of ${stats.xpTarget} XP`}
                      tone="iris"
                    />
                  </span>
                </>
              ) : (
                <>
                  <span className="bg-surface border-line rounded-pill text-small inline-flex min-h-9 items-center gap-1 border px-3 font-semibold">
                    <Icon name="flame" filled className="text-gold-deep size-4" />
                    {stats.streak}
                    <span className="hidden sm:inline"> day streak</span>
                    <span className="sr-only sm:hidden"> day streak</span>
                  </span>
                  <span className="bg-surface border-line rounded-pill text-small hidden min-h-9 items-center border px-3 font-semibold sm:inline-flex">
                    {xpLabel}
                  </span>
                  <Link
                    href="/profile"
                    aria-label={`Profile: ${learnerName}`}
                    className="text-body hidden size-9 place-items-center font-semibold md:inline-grid"
                  >
                    {initialOf(learnerName)}
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        {children}

        <footer className="mt-auto">
          <div
            className={cn(
              'text-small text-ink-soft mx-auto flex w-full flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between md:px-8',
              variant === 'sidebar' ? 'max-w-5xl' : 'max-w-7xl',
            )}
          >
            <p>{copyrightLine(appName)}</p>
            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                {FOOTER_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="hover:text-ink inline-flex min-h-11 items-center"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
