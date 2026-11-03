import { describe, expect, it } from 'vitest';

import type { SearchEntry } from '@/types/search';

import { getLesson, getProblem, getTrack } from './catalog';
import { COURSE_SLUGS } from './courses';
import { getLine, getStation } from './gcp/catalog';
import { createSearcher, normalize, queryWords, sectionAnchor } from './search';
import { browseEntries, SEARCH_EXAMPLES, searchIndex } from './search-index';

/** True when an entry's link names an item that exists. */
function resolves(href: string): boolean {
  const [path = '', fragment] = href.split('#');
  const parts = path.split('/').filter((part) => part !== '');
  const [course, section, a = '', b = ''] = parts;
  if (course === 'de') {
    if (section === 'tracks' && parts.length === 3) return getTrack(a) !== undefined;
    if (section === 'tracks' && parts.length === 4) {
      const lesson = getLesson(a, b)?.lesson;
      if (lesson === undefined) return false;
      if (fragment === undefined) return true;
      const sections = lesson.body.split('\n').filter((line) => /^\s*## /.test(line)).length;
      return Array.from({ length: sections }, (_, index) => sectionAnchor(index + 1)).includes(
        fragment,
      );
    }
    if (section === 'problems') return getProblem(a) !== undefined;
    if (section === 'companies') return a === 'uber' || a === 'google';
  }
  if (course === 'gcp') {
    if (section === 'practice') return ['flashcards', 'sprint', 'mock'].includes(a);
    if (section === 'lines' && parts.length === 3) return getLine(a) !== undefined;
    if (section === 'lines' && b === 'boss') return getLine(a) !== undefined;
    if (section === 'lines' && parts.length === 4) {
      const station = getStation(a, b)?.station;
      if (station === undefined) return false;
      if (fragment === undefined) return true;
      const number = Number(fragment.replace('concept-', ''));
      return number >= 1 && number <= station.concepts.length;
    }
  }
  return false;
}

describe('normalize and queryWords', () => {
  it('folds case, accents and punctuation', () => {
    expect(normalize('  Café — ROW_NUMBER() ')).toBe('cafe row number');
    expect(queryWords('Pub/Sub pub')).toEqual(['pub', 'sub']);
    expect(queryWords('   ')).toEqual([]);
  });
});

describe('the search index', () => {
  for (const course of COURSE_SLUGS) {
    describe(course, () => {
      const entries = searchIndex(course);

      it('has entries with unique ids', () => {
        expect(entries.length).toBeGreaterThan(20);
        const ids = entries.map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('links every entry to an item that exists, in its own course', () => {
        const broken = entries
          .filter((entry) => !entry.href.startsWith(`/${course}/`) || !resolves(entry.href))
          .map((entry) => entry.href);
        expect(broken).toEqual([]);
      });

      it('finds something for every example search', () => {
        const search = createSearcher(entries);
        const empty = SEARCH_EXAMPLES[course].filter((example) => search(example).length === 0);
        expect(empty).toEqual([]);
      });

      it('has top-level entries to browse', () => {
        expect(browseEntries(course).length).toBeGreaterThan(0);
      });
    });
  }

  it('finds a DE lesson by a term inside it, and opens a topic at its section', () => {
    const search = createSearcher(searchIndex('de'));
    const qualify = search('qualify');
    expect(qualify.length).toBeGreaterThan(0);
    expect(qualify[0]?.matchedKeyword).toBe('QUALIFY');
    const watermarks = search('watermarks')[0]?.entry;
    expect(watermarks?.kind).toBe('topic');
    expect(watermarks?.href).toMatch(/#section-\d+$/);
  });

  it('finds a GCP concept and links to its place on the station', () => {
    const search = createSearcher(searchIndex('gcp'));
    const top = search('bigtable design')[0]?.entry;
    expect(top?.kind).toBe('concept');
    expect(top?.href).toMatch(/^\/gcp\/lines\/storage\/[a-z-]+#concept-\d+$/);
  });
});

describe('createSearcher', () => {
  const entry = (id: string, title: string, keywords: string[] = []): SearchEntry => ({
    id,
    kind: 'lesson',
    title,
    context: 'Track',
    href: `/de/tracks/x/${id}`,
    dot: 'bg-track-1',
    detail: '',
    keywords,
  });
  const search = createSearcher([
    entry('a', 'Window functions'),
    entry('b', 'Joins and skew', ['window']),
    entry('c', 'Streaming windows'),
  ]);

  it('needs every word to match', () => {
    expect(search('window skew').map((result) => result.entry.id)).toEqual(['b']);
    expect(search('nothing here')).toEqual([]);
    expect(search('')).toEqual([]);
  });

  it('ranks a title match above a keyword match, and an exact start first', () => {
    expect(search('window').map((result) => result.entry.id)).toEqual(['a', 'c', 'b']);
  });

  it('says which keyword matched when the title did not', () => {
    const hit = search('window').find((result) => result.entry.id === 'b');
    expect(hit?.matchedKeyword).toBe('window');
    expect(search('window')[0]?.matchedKeyword).toBeUndefined();
  });
});
