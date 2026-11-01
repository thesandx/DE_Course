/**
 * The app's top-level destinations. One list, drawn three ways: the `TabBar`
 * at the bottom of a phone, the `SiteHeader` links at the top of a desktop,
 * and the `AppShell` sidebar. See design-language.md > Responsive: an app on
 * a phone, a website on a desktop.
 *
 * The list depends on where the learner is. Outside a course (the hub, the
 * profile) the tabs are the hub, each open course and the profile. Inside a
 * course they are the hub, that course's dashboard, its learning content, its
 * practice and the profile. That keeps three to five tabs at every point.
 * Pages below a tab use `AppBar` with a back arrow instead.
 */

import { COURSE_SLUGS, courseFromPath, getCourse } from '@/lib/course/courses';

export type TabIcon = 'home' | 'course' | 'book' | 'list' | 'person';

export interface AppTab {
  href: string;
  label: string;
  icon: TabIcon;
}

const HOME: AppTab = { href: '/', label: 'Home', icon: 'home' };
const PROFILE: AppTab = { href: '/profile', label: 'Profile', icon: 'person' };

/** The destinations for a page. */
export function tabsFor(pathname: string): readonly AppTab[] {
  const slug = courseFromPath(pathname);
  if (slug === undefined) {
    return [
      HOME,
      ...COURSE_SLUGS.map((course) => {
        const info = getCourse(course);
        return { href: info.href, label: info.short, icon: 'course' as const };
      }),
      PROFILE,
    ];
  }
  const course = getCourse(slug);
  return [
    HOME,
    { href: course.href, label: course.short, icon: 'course' },
    { href: course.learn.href, label: course.learn.label, icon: 'book' },
    { href: course.practice.href, label: course.practice.label, icon: 'list' },
    PROFILE,
  ];
}

/** The destinations outside any course: what the public header shows. */
export const APP_TABS: readonly AppTab[] = tabsFor('/');

/**
 * Screens that hide the tab bar: a focused task the user should finish or
 * leave with the back arrow, as in a native app's sign-in flow.
 */
export const TABLESS_PATHS: readonly string[] = ['/sign-in'];

/** True when `pathname` is the tab's page or a page below it. */
export function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === '/') return pathname === '/';
  return pathname === tabHref || pathname.startsWith(`${tabHref}/`);
}

/**
 * The `href` of the destination that `pathname` sits under, if any. When two
 * tabs match (a course dashboard and its tracks), the longer one wins.
 */
export function activeTabHref(
  pathname: string,
  tabs: readonly AppTab[] = tabsFor(pathname),
): string | undefined {
  return tabs
    .filter((tab) => isTabActive(tab.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
