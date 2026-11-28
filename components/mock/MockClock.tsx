import { Icon } from '@/components/layout/Icon';
import { Button } from '@/components/ui/Button';
import { formatClock } from '@/lib/course/mock-score';
import { cn } from '@/lib/utils';

export interface MockClockProps {
  round: number;
  rounds: number;
  name: string;
  /** Time left, in ms. Null before the clock is read in the browser. */
  leftMs: number | null;
  limitMs: number;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

/** Below this, the clock turns red and says so once. */
const LOW_MS = 5 * 60_000;

/** The spoken warning for the time left, once per threshold. */
function warning(leftMs: number | null): string {
  if (leftMs === null) return '';
  if (leftMs <= 60_000) return 'One minute left in this round.';
  if (leftMs <= LOW_MS) return 'Five minutes left in this round.';
  return '';
}

/**
 * The round's clock, pinned under the top bar while the learner works: the
 * round, the time left, a bar of the time used, Pause and End round. The time
 * is a `timer`, which screen readers do not read each second; a separate
 * live line says "five minutes left" and "one minute left" once.
 */
export function MockClock({
  round,
  rounds,
  name,
  leftMs,
  limitMs,
  paused,
  onPause,
  onResume,
  onEnd,
}: MockClockProps) {
  const low = leftMs !== null && leftMs <= LOW_MS;
  const used = leftMs === null || limitMs <= 0 ? 0 : 1 - leftMs / limitMs;

  return (
    <div className="bg-paper/90 border-line sticky top-16 z-5 border-b backdrop-blur md:top-17">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 sm:gap-4 sm:px-8 sm:py-2.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="eyebrow text-ink-faint whitespace-nowrap">
            Round {round} of {rounds}
          </p>
          <p className="text-body sm:text-heading truncate font-semibold">{name}</p>
        </div>
        <p
          role="timer"
          aria-label={`Time left in round ${round}`}
          className={cn(
            'font-display text-title sm:text-key flex items-center gap-2 font-semibold tabular-nums',
            low ? 'text-hard' : 'text-ink',
          )}
        >
          <Icon name="clock" className="hidden size-5 sm:block" />
          {leftMs === null ? '–:––' : formatClock(leftMs)}
        </p>
        {/* On a phone the buttons keep short labels, so the round's name keeps its room. */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={paused ? onResume : onPause}
            aria-pressed={paused}
          >
            <Icon name={paused ? 'play' : 'pause'} className="size-4" />
            <span className="sr-only sm:not-sr-only">{paused ? 'Resume' : 'Pause'}</span>
          </Button>
          <Button variant="dark" size="sm" onClick={onEnd} aria-label="End round">
            <span className="sm:hidden">End</span>
            <span className="hidden sm:inline">End round</span>
          </Button>
        </div>
      </div>
      <span aria-hidden="true" className="bg-sunken absolute inset-x-0 bottom-0 block h-1">
        <span
          className={cn('block h-full transition-[width]', low ? 'bg-hard-bar' : 'bg-brand')}
          style={{ width: `${Math.round(Math.min(Math.max(used, 0), 1) * 1000) / 10}%` }}
        />
      </span>
      {/* The round's own alert says when the clock is paused, so this line only warns. */}
      <p className="sr-only" aria-live="polite">
        {paused ? '' : warning(leftMs)}
      </p>
    </div>
  );
}
