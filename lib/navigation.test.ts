import { describe, expect, it } from 'vitest';

import { activeTabHref, isTabActive, tabsFor } from './navigation';

describe('isTabActive', () => {
  it('matches home only on the root', () => {
    expect(isTabActive('/', '/')).toBe(true);
    expect(isTabActive('/', '/profile')).toBe(false);
  });

  it('matches a tab and the pages below it', () => {
    expect(isTabActive('/profile', '/profile')).toBe(true);
    expect(isTabActive('/profile', '/profile/photo')).toBe(true);
  });

  it('does not match a path that only shares a prefix', () => {
    expect(isTabActive('/profile', '/profiles')).toBe(false);
  });
});

describe('activeTabHref', () => {
  it('names the destination a page sits under', () => {
    expect(activeTabHref('/')).toBe('/');
    expect(activeTabHref('/profile/photo')).toBe('/profile');
  });

  it('names nothing for a page outside every destination', () => {
    expect(activeTabHref('/sign-in')).toBeUndefined();
  });
});

describe('tabsFor', () => {
  it('lists the hub, each open course and the profile outside a course', () => {
    expect(tabsFor('/').map((tab) => tab.href)).toEqual(['/', '/de', '/gcp', '/profile']);
    expect(tabsFor('/profile').map((tab) => tab.href)).toEqual(['/', '/de', '/gcp', '/profile']);
  });

  it("lists the course's own destinations inside a course", () => {
    expect(tabsFor('/gcp/lines/design').map((tab) => tab.href)).toEqual([
      '/',
      '/gcp',
      '/gcp/lines',
      '/gcp/practice',
      '/profile',
    ]);
    expect(tabsFor('/de/problems').map((tab) => tab.label)).toEqual([
      'Home',
      'DE',
      'Tracks',
      'Problems',
      'Profile',
    ]);
  });

  it('marks the most specific tab active', () => {
    expect(activeTabHref('/de/tracks/sql')).toBe('/de/tracks');
    expect(activeTabHref('/gcp')).toBe('/gcp');
  });
});
