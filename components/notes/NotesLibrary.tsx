'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Icon } from '@/components/layout/Icon';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CourseSlug } from '@/lib/course/courses';
import { noteToPlainText, parseNote } from '@/lib/notes/markdown';
import { cn } from '@/lib/utils';

import { NoteView } from './NoteView';
import { ToolIcon } from './ToolIcon';

export interface NotesLibraryItem {
  key: string;
  markdown: string;
  editedAt: string;
  title: string;
  /** The track or exam domain. */
  group: string;
  /** "Lesson", "Problem", "Station" or "Lab". */
  kind: string;
  course: CourseSlug;
  /** The chapter's page. */
  href: string;
}

export interface NotesLibraryProps {
  items: readonly NotesLibraryItem[];
}

type Filter = 'all' | CourseSlug;

const FILTERS: ReadonlyArray<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'de', label: 'DE' },
  { id: 'gcp', label: 'GCP' },
];

const DATE = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A long note opens folded, so the page stays a list you can scan. */
const FOLD_CHARS = 700;

function download(items: readonly NotesLibraryItem[]) {
  const body = items
    .map((item) => `## ${item.title}\n\n*${item.kind} · ${item.group}*\n\n${item.markdown}`)
    .join('\n\n---\n\n');
  const file = new Blob([`# My notes\n\n${body}\n`], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'my-notes.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * The notes page's list: search across every note, filter by course, unfold
 * a long note, jump back to its chapter, and download everything as one
 * Markdown file for offline revision.
 */
export function NotesLibrary({ items }: NotesLibraryProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const searchable = useMemo(
    () =>
      new Map(
        items.map((item) => [
          item.key,
          `${item.title} ${item.group} ${noteToPlainText(parseNote(item.markdown))}`.toLowerCase(),
        ]),
      ),
    [items],
  );

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '');
  const shown = items.filter(
    (item) =>
      (filter === 'all' || item.course === filter) &&
      words.every((word) => searchable.get(item.key)?.includes(word) === true),
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title="No notes yet"
        action={
          <Link href="/de/tracks" className={buttonStyles()}>
            Open a lesson
          </Link>
        }
      >
        Every lesson, problem, GCP station and lab has a “My notes” box at the end. Write there, and
        your notes collect here for revision.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search your notes</span>
          <Icon
            name="search"
            className="text-ink-faint pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your notes"
            className="bg-surface border-line-strong rounded-pill text-body placeholder:text-ink-faint focus:border-ink-faint min-h-11 w-full border pr-4 pl-10 outline-none"
          />
        </label>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Course" className="flex gap-1">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={cn(
                  'press rounded-pill text-small min-h-11 px-3.5 font-semibold whitespace-nowrap',
                  filter === option.id
                    ? 'bg-ink text-on-ink'
                    : 'bg-surface border-line text-ink-soft hover:text-ink border',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => download(shown)}
            disabled={shown.length === 0}
            className="ml-auto md:ml-0"
          >
            <ToolIcon name="download" className="size-4" />
            Download
          </Button>
        </div>
      </div>

      <p role="status" className="text-small text-ink-faint">
        {shown.length === items.length
          ? `${items.length} ${items.length === 1 ? 'note' : 'notes'}`
          : `${shown.length} of ${items.length} notes match`}
      </p>

      {shown.length === 0 ? (
        <EmptyState title="Nothing matches">Try fewer words, or another course.</EmptyState>
      ) : (
        <ul className="grid items-start gap-4 lg:grid-cols-2">
          {shown.map((item) => {
            const long = item.markdown.length > FOLD_CHARS;
            const unfolded = open.has(item.key);
            return (
              <li
                key={item.key}
                className="bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col border"
              >
                <div className="flex flex-col gap-1 px-5 pt-4">
                  <p className="text-micro text-ink-faint flex flex-wrap items-center gap-x-2 font-semibold tracking-wide uppercase">
                    <span
                      className={cn(
                        'rounded-pill px-2 py-0.5',
                        item.course === 'de' ? 'bg-grape text-ink' : 'bg-soda text-ink',
                      )}
                    >
                      {item.course === 'de' ? 'DE' : 'GCP'} · {item.kind}
                    </span>
                    <span className="truncate">{item.group}</span>
                  </p>
                  <h2 className="text-heading">
                    <Link href={item.href} className="hover:underline">
                      {item.title}
                    </Link>
                  </h2>
                  <p className="text-small text-ink-faint">
                    Edited {DATE.format(new Date(item.editedAt))}
                  </p>
                </div>
                <div
                  className={cn(
                    'relative px-5 py-4',
                    long && !unfolded && 'max-h-72 overflow-hidden',
                  )}
                >
                  <NoteView markdown={item.markdown} />
                  {long && !unfolded && (
                    <div className="from-surface absolute inset-x-0 bottom-0 h-16 bg-linear-to-t to-transparent" />
                  )}
                </div>
                <div className="border-line mt-auto flex flex-wrap items-center gap-2 border-t px-5 py-3">
                  {long && (
                    <button
                      type="button"
                      onClick={() =>
                        setOpen((before) => {
                          const next = new Set(before);
                          if (next.has(item.key)) next.delete(item.key);
                          else next.add(item.key);
                          return next;
                        })
                      }
                      className="text-small text-ink-soft hover:text-ink min-h-11 font-semibold md:min-h-9"
                    >
                      {unfolded ? 'Fold' : 'Show all'}
                    </button>
                  )}
                  <Link
                    href={`${item.href}#notes`}
                    className={cn(buttonStyles({ variant: 'secondary', size: 'sm' }), 'ml-auto')}
                  >
                    Edit on the {item.kind.toLowerCase()} page
                    <Icon name="arrow-right" className="size-4" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
