'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DifficultyTag } from '@/components/course/DifficultyTag';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import type { Company, Difficulty } from '@/types/course';

export interface ProblemRow {
  slug: string;
  title: string;
  trackSlug: string;
  trackTitle: string;
  kindLabel: string;
  difficulty: Difficulty;
  companies: readonly Company[];
  done: boolean;
}

export interface ProblemTableProps {
  rows: readonly ProblemRow[];
  tracks: ReadonlyArray<{ slug: string; title: string }>;
  /** Pre-selects a track, e.g. on a track page. */
  initialTrack?: string;
  /** Hides the filters, for a short list inside another page. */
  compact?: boolean;
  className?: string;
}

const COMPANY_LABEL: Record<Company, string> = { uber: 'Uber', google: 'Google' };

/**
 * The problem list, LeetCode style: a status tick, the title, the track and
 * the difficulty, with filters above. Filtering runs in the browser over the
 * full list, which is small enough to ship with the page.
 *
 * One markup for both postures. On a phone each row is a stacked card; from
 * `md` the same rows line up as a table.
 */
export function ProblemTable({
  rows,
  tracks,
  initialTrack = '',
  compact = false,
  className,
}: ProblemTableProps) {
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState(initialTrack);
  const [difficulty, setDifficulty] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (needle === '' || row.title.toLowerCase().includes(needle)) &&
        (track === '' || row.trackSlug === track) &&
        (difficulty === '' || row.difficulty === difficulty) &&
        (company === '' || row.companies.includes(company as Company)) &&
        (status === '' || (status === 'solved' ? row.done : !row.done)),
    );
  }, [rows, query, track, difficulty, company, status]);

  const filtered =
    query !== '' || track !== initialTrack || difficulty !== '' || company !== '' || status !== '';

  function reset(): void {
    setQuery('');
    setTrack(initialTrack);
    setDifficulty('');
    setCompany('');
    setStatus('');
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-5', className)}>
      {compact ? null : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            label="Search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="lg:col-span-1"
          />
          <Select
            label="Track"
            value={track}
            onChange={(event) => setTrack(event.target.value)}
            placeholder="All tracks"
            options={tracks.map((item) => ({ value: item.slug, label: item.title }))}
          />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            placeholder="Any difficulty"
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
          <Select
            label="Company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Any company"
            options={[
              { value: 'uber', label: 'Asked at Uber' },
              { value: 'google', label: 'Asked at Google' },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="Any status"
            options={[
              { value: 'unsolved', label: 'Not solved yet' },
              { value: 'solved', label: 'Solved' },
            ]}
          />
        </div>
      )}

      {compact ? null : (
        <p className="text-small text-ink-soft" role="status">
          Showing {visible.length} of {rows.length} problems.
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title="No problems match these filters."
          action={
            <Button variant="secondary" onClick={reset}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="border-line bg-surface rounded-card overflow-hidden border-2">
          <li
            aria-hidden="true"
            className="bg-sunken border-line hidden grid-cols-12 gap-3 border-b-2 px-4 py-2 text-small font-bold md:grid"
          >
            <span className="col-span-1">Status</span>
            <span className="col-span-5">Title</span>
            <span className="col-span-3">Track</span>
            <span className="col-span-1">Asked at</span>
            <span className="col-span-2">Difficulty</span>
          </li>
          {visible.map((row, index) => (
            <li
              key={row.slug}
              className={cn(
                index > 0 && 'border-line border-t-2',
                index % 2 === 1 && 'md:bg-paper',
              )}
            >
              <Link
                href={`/problems/${row.slug}`}
                className="press flex min-h-14 flex-col gap-2 px-4 py-3 md:grid md:grid-cols-12 md:items-center md:gap-3"
              >
                <span className="flex items-center gap-2 md:col-span-1">
                  <StatusMark done={row.done} />
                  <span className="sr-only">{row.done ? 'Solved.' : 'Not solved.'}</span>
                </span>
                <span className="font-bold break-words md:col-span-5">{row.title}</span>
                <span className="text-small text-ink-soft md:col-span-3">
                  {row.trackTitle}
                  <span className="md:hidden"> · {row.kindLabel}</span>
                </span>
                <span className="text-small text-ink-soft md:col-span-1">
                  {row.companies.map((item) => COMPANY_LABEL[item]).join(', ')}
                </span>
                <span className="md:col-span-2">
                  <DifficultyTag difficulty={row.difficulty} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {filtered && visible.length > 0 ? (
        <Button variant="quiet" onClick={reset} className="self-start">
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

function StatusMark({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'border-line inline-grid size-6 place-items-center rounded-full border-2',
        done ? 'bg-success' : 'bg-surface',
      )}
    >
      {done ? (
        <svg viewBox="0 0 16 16" className="size-3.5 fill-none stroke-ink" strokeWidth={2.5}>
          <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}
