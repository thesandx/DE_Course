'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/components/layout/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  createSearcher,
  MAX_QUERY_LENGTH,
  queryWords,
  RESULT_LIMIT,
  SEARCH_KIND_LABELS,
  SEARCH_KIND_ORDER,
} from '@/lib/course/search';
import { cn } from '@/lib/utils';
import type { SearchEntry, SearchKind } from '@/types/search';

export interface CourseSearchProps {
  /** The course's whole index, from `searchIndex` on the server. */
  entries: readonly SearchEntry[];
  /** The course's short name, for the placeholder: "Search DE". */
  courseShort: string;
  /** What the search finds, for the placeholder: "topic, lesson or problem". */
  scope: string;
  /** Pre-fills the box, from `?q=`. */
  initialQuery?: string;
  /** Shown before the learner types: the course's tracks or lines, as quick links. */
  browse: readonly SearchEntry[];
  /** Example searches, shown as buttons before the learner types. */
  examples: readonly string[];
  className?: string;
}

/** Splits `text` so the parts that match a query word can be marked. */
function highlight(text: string, words: readonly string[]): React.ReactNode {
  const usable = words.filter((word) => word.length > 0);
  if (usable.length === 0) return text;
  const escaped = usable.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="bg-sun text-ink rounded-box">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/**
 * Search inside one course: lessons, the topics inside them, problems and
 * guides (or lines, stations and concepts). The index ships with the page and
 * filtering runs in the browser, so results change on each keystroke with no
 * round trip. The query stays in the URL, so the back button returns to the
 * same results.
 *
 * One markup for both postures: a full-width box and stacked result cards on
 * a phone, the same list in the page frame on a desktop.
 */
export function CourseSearch({
  entries,
  courseShort,
  scope,
  initialQuery = '',
  browse,
  examples,
  className,
}: CourseSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState<SearchKind | ''>('');
  const input = useRef<HTMLInputElement>(null);
  const search = useMemo(() => createSearcher(entries), [entries]);
  const results = useMemo(() => search(query), [search, query]);
  const words = useMemo(() => queryWords(query), [query]);

  const counts = useMemo(() => {
    const byKind = new Map<SearchKind, number>();
    for (const result of results) {
      byKind.set(result.entry.kind, (byKind.get(result.entry.kind) ?? 0) + 1);
    }
    return SEARCH_KIND_ORDER.filter((item) => byKind.has(item)).map((item) => ({
      kind: item,
      count: byKind.get(item) ?? 0,
    }));
  }, [results]);

  const activeKind = counts.some((item) => item.kind === kind) ? kind : '';
  const visible =
    activeKind === '' ? results : results.filter((result) => result.entry.kind === activeKind);

  // Keep `?q=` in step with the box, without a navigation per keystroke.
  useEffect(() => {
    const url = new URL(window.location.href);
    const trimmed = query.trim();
    if (trimmed === '') url.searchParams.delete('q');
    else url.searchParams.set('q', trimmed);
    window.history.replaceState(window.history.state, '', url);
  }, [query]);

  function choose(text: string): void {
    setQuery(text);
    setKind('');
    input.current?.focus();
  }

  const hasQuery = words.length > 0;

  return (
    <div className={cn('flex min-w-0 flex-col gap-5', className)}>
      <form role="search" onSubmit={(event) => event.preventDefault()} className="flex flex-col">
        <label className="bg-surface border-line rounded-pill shadow-card focus-within:border-line-strong flex min-h-14 items-center gap-3 border px-5">
          <Icon name="search" className="text-ink-faint size-5 shrink-0" />
          <span className="sr-only">Search {courseShort}</span>
          <input
            ref={input}
            // A text box with the searchbox role: `type="search"` adds the
            // browser's own clear cross next to the Clear button.
            type="text"
            role="searchbox"
            inputMode="search"
            name="q"
            value={query}
            maxLength={MAX_QUERY_LENGTH}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search a ${scope}`}
            // The learner opened search to type; the box takes the focus at once.
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
            className="text-body placeholder:text-ink-faint min-w-0 flex-1 bg-transparent outline-none"
          />
          {query !== '' && (
            <button
              type="button"
              onClick={() => choose('')}
              className="text-small text-ink-soft hover:text-ink -mr-2 inline-flex min-h-11 items-center px-2 font-semibold"
            >
              Clear
            </button>
          )}
        </label>
      </form>

      {!hasQuery ? (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="search-examples" className="flex flex-col gap-3">
            <h2 id="search-examples" className="eyebrow text-ink-faint">
              Try
            </h2>
            <ul className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => choose(example)}
                    className="bg-surface border-line rounded-pill text-small text-ink-soft hover:text-ink hover:border-line-strong inline-flex min-h-11 items-center gap-2 border px-4 font-medium"
                  >
                    <Icon name="search" className="text-ink-faint size-3.5" />
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="search-browse" className="flex flex-col gap-3">
            <h2 id="search-browse" className="eyebrow text-ink-faint">
              Browse
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {browse.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={entry.href}
                    className="bg-surface border-line rounded-card shadow-card hover:border-line-strong flex min-h-14 items-center gap-3 border px-4 py-3 transition-colors"
                  >
                    <span
                      aria-hidden="true"
                      className={cn('size-2.5 shrink-0 rounded-full', entry.dot)}
                    />
                    <span className="min-w-0 flex-1 font-semibold">{entry.title}</span>
                    <Icon name="arrow-right" className="text-ink-faint size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title={`Nothing in ${courseShort} matches “${query.trim()}”.`}
          action={
            <Button variant="secondary" onClick={() => choose('')}>
              Clear search
            </Button>
          }
        >
          Try a shorter word, or the name of a tool, such as {examples[0] ?? 'a track'}.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul aria-label="Filter results" className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
              {[{ kind: '' as const, count: results.length }, ...counts].map((item) => (
                <li key={item.kind || 'all'}>
                  <button
                    type="button"
                    aria-pressed={activeKind === item.kind}
                    onClick={() => setKind(item.kind)}
                    className={cn(
                      'rounded-pill text-small inline-flex min-h-11 items-center gap-2 border px-3.5 font-medium whitespace-nowrap',
                      activeKind === item.kind
                        ? 'bg-ink text-on-night border-ink'
                        : 'bg-surface border-line text-ink-soft hover:text-ink',
                    )}
                  >
                    {item.kind === '' ? 'All' : SEARCH_KIND_LABELS[item.kind]}
                    <span className="font-mono opacity-70">{item.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-small text-ink-soft" role="status">
            {visible.length} {visible.length === 1 ? 'result' : 'results'}
            {results.length === RESULT_LIMIT ? ` (the best ${RESULT_LIMIT})` : ''}
          </p>

          <ul className="border-line bg-surface rounded-card shadow-card overflow-hidden border">
            {visible.map(({ entry, matchedKeyword }, index) => (
              <li key={entry.id} className={cn(index > 0 && 'border-line border-t')}>
                <Link
                  href={entry.href}
                  className="hover:bg-sunken flex min-h-16 items-start gap-3 px-4 py-3.5 transition-colors md:px-5"
                >
                  <span
                    aria-hidden="true"
                    className={cn('mt-2 size-2.5 shrink-0 rounded-full', entry.dot)}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="eyebrow text-ink-faint">
                        {SEARCH_KIND_LABELS[entry.kind]}
                      </span>
                      <span className="text-small text-ink-faint truncate">{entry.context}</span>
                    </span>
                    <span className="font-semibold break-words">
                      {highlight(entry.title, words)}
                    </span>
                    <span className="text-small text-ink-soft line-clamp-2">
                      {matchedKeyword !== undefined ? (
                        <>
                          Covers{' '}
                          <span className="text-ink">{highlight(matchedKeyword, words)}</span>
                        </>
                      ) : (
                        entry.detail
                      )}
                    </span>
                  </span>
                  <Icon name="arrow-right" className="text-ink-faint mt-1.5 size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
