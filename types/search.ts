/**
 * The course search index. `lib/course/search.ts` builds it on the server
 * from each catalogue; the search page sends it to `CourseSearch`, which
 * filters it in the browser.
 */

/** What a result points to. Each course uses the kinds it has. */
export type SearchKind =
  'track' | 'lesson' | 'topic' | 'problem' | 'guide' | 'line' | 'station' | 'concept' | 'drill';

export interface SearchEntry {
  /** Unique in the course. */
  id: string;
  kind: SearchKind;
  title: string;
  /** Where the entry sits, such as the track or the station. */
  context: string;
  /** The page to open, with a `#fragment` when the entry is a part of a page. */
  href: string;
  /**
   * The literal class of the result's hue dot, such as `bg-track-3`. It comes
   * from `track-style.ts` or `hue.ts`, where Tailwind can read it.
   */
  dot: string;
  /** One short line under the title: a summary, minutes, a difficulty. */
  detail: string;
  /** The terms inside the item: headings, bold terms and code. Matched, never shown in full. */
  keywords: readonly string[];
}
