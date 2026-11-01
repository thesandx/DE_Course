'use client';

import { useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { outcomeMessage, useRecordProgress } from '@/hooks/useRecordProgress';
import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';

export interface FlashcardItem {
  id: string;
  line: string;
  front: string;
  back: string;
}

export interface FlashcardsProps {
  cards: readonly FlashcardItem[];
  lines: ReadonlyArray<{ slug: string; short: string; hue: number }>;
  /** Ids of the cards the learner already knows. */
  known: readonly string[];
  xpPerCard: number;
}

/**
 * The flashcard deck. Read the front, flip, then say "Got it" or "Again".
 * "Again" sends the card to the back of the pile; "Got it" saves it as known
 * (a little XP the first time) and takes it out. A chip row filters the deck
 * by line.
 */
export function Flashcards({ cards, lines, known, xpPerCard }: FlashcardsProps) {
  const [filter, setFilter] = useState<string>('all');
  const [showKnown, setShowKnown] = useState(false);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { record, busy } = useRecordProgress('gcp');

  const knownSet = new Set(known);
  const inFilter = cards.filter((card) => filter === 'all' || card.line === filter);
  const pile =
    queue ?? inFilter.filter((card) => showKnown || !knownSet.has(card.id)).map((card) => card.id);
  const current = cards.find((card) => card.id === pile[0]);
  const knownInFilter = inFilter.filter((card) => knownSet.has(card.id)).length;
  const lineOf = (slug: string) => lines.find((line) => line.slug === slug);

  function choose(next: string): void {
    setFilter(next);
    setQueue(null);
    setFlipped(false);
  }

  async function gotIt(): Promise<void> {
    if (current === undefined) return;
    setError(null);
    if (!knownSet.has(current.id)) {
      const outcome = await record(current.id, true);
      const message = outcomeMessage(outcome);
      if (message !== null) {
        setError(message);
        return;
      }
    }
    setQueue(pile.slice(1));
    setFlipped(false);
  }

  function again(): void {
    if (current === undefined) return;
    setQueue([...pile.slice(1), current.id]);
    setFlipped(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Filter by line">
          {[{ slug: 'all', short: 'All lines', hue: 0 }, ...lines].map((line) => (
            <li key={line.slug}>
              <button
                type="button"
                aria-pressed={filter === line.slug}
                onClick={() => choose(line.slug)}
                className={cn(
                  'rounded-pill text-small inline-flex min-h-11 items-center gap-2 border px-3.5 font-medium',
                  filter === line.slug
                    ? 'bg-ink text-on-night border-ink'
                    : 'bg-surface border-line text-ink-soft hover:text-ink',
                )}
              >
                {line.hue > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn('size-2 rounded-full', hueStyle(line.hue).fill)}
                  />
                )}
                {line.short}
              </button>
            </li>
          ))}
        </ul>
        <Progress
          label="Cards you know"
          value={inFilter.length === 0 ? 0 : (knownInFilter / inFilter.length) * 100}
          valueText={`${knownInFilter} of ${inFilter.length}`}
        />
      </div>

      {current === undefined ? (
        <section className="bg-surface border-line rounded-card shadow-card flex flex-col items-start gap-3 border p-6">
          <h2 className="text-title">Pile cleared</h2>
          <p className="text-body text-ink-soft">
            {knownInFilter === inFilter.length
              ? 'You know every card here. Shuffle them back in for a refresher.'
              : 'That was the last card in this pile.'}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setShowKnown(true);
              setQueue(null);
            }}
          >
            Review all cards again
          </Button>
        </section>
      ) : (
        <section
          aria-live="polite"
          className={cn(
            'rounded-sheet shadow-raised flex min-h-72 flex-col gap-4 border border-t-4 p-6 sm:p-8',
            flipped ? 'bg-night-glow text-on-night border-night-line' : 'bg-surface border-line',
            hueStyle(lineOf(current.line)?.hue ?? 2).edge,
          )}
        >
          <p className={cn('eyebrow', flipped ? 'text-on-night-soft' : 'text-ink-faint')}>
            {lineOf(current.line)?.short} · {pile.length} left
            {knownSet.has(current.id) && ' · known'}
          </p>
          <p className="text-title grow">
            <InlineText text={flipped ? current.back : current.front} />
          </p>
          {!flipped ? (
            <Button size="lg" variant="dark" block onClick={() => setFlipped(true)}>
              Show answer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" variant="night" onClick={again}>
                Again
              </Button>
              <Button size="lg" onClick={() => void gotIt()} disabled={busy}>
                {busy
                  ? 'Saving'
                  : knownSet.has(current.id)
                    ? 'Got it'
                    : `Got it · +${xpPerCard} XP`}
              </Button>
            </div>
          )}
        </section>
      )}

      {error !== null && (
        <Alert tone="danger" title="Not saved">
          {error}
        </Alert>
      )}
    </div>
  );
}
