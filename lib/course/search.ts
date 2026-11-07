/**
 * The course search: matching and ranking over a `SearchEntry` list. Pure and
 * free of catalogue imports, so `CourseSearch` runs it in the browser on every
 * keystroke. `search-index.ts` builds the entries on the server.
 *
 * Every word of the query must match the entry somewhere. A match in the
 * title counts most, then the context, then the keywords inside the item.
 */

import type { SearchEntry, SearchKind } from '@/types/search';

/** The label of each kind, singular, for the badge on a result. */
export const SEARCH_KIND_LABELS: Readonly<Record<SearchKind, string>> = {
  track: 'Track',
  lesson: 'Lesson',
  topic: 'Topic',
  problem: 'Problem',
  guide: 'Loop guide',
  line: 'Line',
  station: 'Station',
  concept: 'Concept',
  lab: 'Lab',
  drill: 'Drill',
};

/** The filter order on the search page. A kind with no result is not shown. */
export const SEARCH_KIND_ORDER: readonly SearchKind[] = [
  'lesson',
  'topic',
  'problem',
  'station',
  'concept',
  'lab',
  'track',
  'line',
  'guide',
  'drill',
];

/** The `id` of a lesson's numbered `##` section, as `Prose sectioned` renders it. */
export function sectionAnchor(number: number): string {
  return `section-${number}`;
}

/** The most results the search returns. */
export const RESULT_LIMIT = 60;

/** The longest query the page accepts, in characters. */
export const MAX_QUERY_LENGTH = 80;

/** Lower case, accents removed, and every run of other characters made one space. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}

/** The words of a query, without duplicates. */
export function queryWords(query: string): string[] {
  return [...new Set(normalize(query.slice(0, MAX_QUERY_LENGTH)).split(' '))].filter(
    (word) => word !== '',
  );
}

export interface SearchResult {
  entry: SearchEntry;
  score: number;
  /** A keyword that matched when the title did not, to show why the entry is here. */
  matchedKeyword: string | undefined;
}

interface Prepared {
  entry: SearchEntry;
  title: string;
  /** Title words, to give a word that starts with the query word a higher score. */
  titleWords: readonly string[];
  context: string;
  detail: string;
  keywords: readonly string[];
}

/** Extra score by kind for a title match, so a whole lesson ranks above one topic inside it. */
const KIND_BONUS: Readonly<Record<SearchKind, number>> = {
  track: 3,
  line: 3,
  lesson: 2,
  station: 2,
  problem: 2,
  guide: 1,
  topic: 0,
  concept: 0,
  lab: 1,
  drill: 0,
};

function prepare(entry: SearchEntry): Prepared {
  const title = normalize(entry.title);
  return {
    entry,
    title,
    titleWords: title.split(' '),
    context: normalize(entry.context),
    detail: normalize(entry.detail),
    keywords: entry.keywords.map(normalize),
  };
}

function scoreWord(item: Prepared, word: string): number {
  if (item.titleWords.some((titleWord) => titleWord.startsWith(word))) return 10;
  if (item.title.includes(word)) return 6;
  if (item.keywords.includes(word)) return 5;
  if (item.keywords.some((keyword) => keyword.split(' ').some((part) => part.startsWith(word))))
    return 4;
  if (item.context.includes(word)) return 3;
  if (item.detail.includes(word)) return 2;
  if (item.keywords.some((keyword) => keyword.includes(word))) return 1;
  return 0;
}

/**
 * Returns a function that ranks `entries` against a query. The entries are
 * normalised once, so each keystroke only compares strings.
 */
export function createSearcher(
  entries: readonly SearchEntry[],
): (query: string, limit?: number) => SearchResult[] {
  const prepared = entries.map(prepare);
  return (query, limit = RESULT_LIMIT) => {
    const words = queryWords(query);
    if (words.length === 0) return [];
    const phrase = words.join(' ');
    const results: SearchResult[] = [];
    for (const item of prepared) {
      let score = 0;
      let missed = false;
      for (const word of words) {
        const wordScore = scoreWord(item, word);
        if (wordScore === 0) {
          missed = true;
          break;
        }
        score += wordScore;
      }
      if (missed) continue;
      if (item.title === phrase) score += 30;
      else if (item.title.startsWith(phrase)) score += 15;
      else if (words.length > 1 && item.title.includes(phrase)) score += 10;
      const titleHit = words.some((word) => item.title.includes(word));
      // The kind bonus orders title matches; a lesson that only mentions a
      // term should not outrank the topic that teaches it.
      if (titleHit) score += KIND_BONUS[item.entry.kind];
      const keywordIndex = titleHit
        ? -1
        : item.keywords.findIndex((keyword) => words.some((word) => keyword.includes(word)));
      results.push({ entry: item.entry, score, matchedKeyword: item.entry.keywords[keywordIndex] });
    }
    return results
      .sort((a, b) => b.score - a.score || a.entry.title.length - b.entry.title.length)
      .slice(0, limit);
  };
}
