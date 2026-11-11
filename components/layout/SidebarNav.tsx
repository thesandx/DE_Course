'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { COURSES, type CourseSlug } from '@/lib/course/courses';
import { activeTabHref, type AppTab, tabsFor } from '@/lib/navigation';
import { cn } from '@/lib/utils';

import { CourseBadge } from './CourseBadge';
import { Icon, type IconName } from './Icon';

export interface SidebarNavProps {
  /** The courses the learner joined. They get a tick; the others say "Join". */
  enrolled: readonly CourseSlug[];
  /** A count shown at the end of a destination's row, keyed by its href. */
  counts?: Readonly<Record<string, number>>;
}

const ICONS: Readonly<Record<AppTab['icon'], IconName>> = {
  home: 'home',
  course: 'spark',
  book: 'book',
  list: 'list',
  person: 'person',
};

function NavRow({
  href,
  label,
  icon,
  active,
  count,
  nested = false,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  count?: number | undefined;
  nested?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-input text-body flex min-h-10 items-center gap-3 px-3 font-medium transition-colors',
        nested && 'ml-4',
        active ? 'bg-ink text-on-ink' : 'text-ink-soft hover:bg-sunken hover:text-ink',
      )}
    >
      <Icon name={icon} className="size-4.5" />
      <span className="grow">{label}</span>
      {count !== undefined && (
        <span className={cn('text-small', active ? 'text-on-ink/70' : 'text-ink-faint')}>
          {count}
        </span>
      )}
    </Link>
  );
}

/**
 * The sidebar's destinations: the hub, every course, and the profile. The
 * course on screen opens to show its own sections, so the learner always
 * sees where they are and can switch course in one click.
 *
 * A client component only to read the current path.
 */
export function SidebarNav({ enrolled, counts = {} }: SidebarNavProps) {
  const pathname = usePathname();
  const tabs = tabsFor(pathname);
  const current = activeTabHref(pathname, tabs);
  const open = tabs.length === 5 ? tabs.slice(1, 4) : [];

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      <NavRow href="/" label="Home" icon="home" active={current === '/'} />

      <div className="flex flex-col gap-1">
        <p className="eyebrow text-ink-faint px-3 pb-1">Courses</p>
        <ul className="flex flex-col gap-1">
          {COURSES.map((course) => {
            const isOpen = open[0]?.href === course.href;
            const joined = (enrolled as readonly string[]).includes(course.slug);
            if (course.status === 'soon') {
              return (
                <li
                  key={course.slug}
                  className="text-ink-faint flex min-h-10 items-center gap-3 px-3"
                >
                  <CourseBadge hue={course.hue} short={course.short} muted />
                  <span className="text-body grow">{course.short}</span>
                  <span className="text-micro rounded-pill bg-sunken px-2 py-0.5">Soon</span>
                </li>
              );
            }
            return (
              <li key={course.slug} className="flex flex-col gap-1">
                <Link
                  href={course.href}
                  className={cn(
                    'rounded-input text-body flex min-h-10 items-center gap-3 px-3 font-semibold transition-colors',
                    isOpen ? 'text-ink' : 'text-ink-soft hover:bg-sunken hover:text-ink',
                  )}
                >
                  <CourseBadge hue={course.hue} short={course.short} />
                  <span className="grow truncate">{course.short} course</span>
                  {joined ? (
                    <Icon name="check" className="text-easy size-4" />
                  ) : (
                    <span className="text-micro text-brand-deep font-semibold">Join</span>
                  )}
                </Link>
                {isOpen && joined && (
                  <ul className="flex flex-col gap-1">
                    {open.map((tab, index) => (
                      <li key={tab.href}>
                        <NavRow
                          href={tab.href}
                          label={index === 0 ? 'Dashboard' : tab.label}
                          icon={ICONS[tab.icon]}
                          active={current === tab.href}
                          count={counts[tab.href]}
                          nested
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-1">
        <NavRow href="/notes" label="My notes" icon="note" active={pathname === '/notes'} />
        <NavRow href="/profile" label="Profile" icon="person" active={current === '/profile'} />
      </div>
    </nav>
  );
}
