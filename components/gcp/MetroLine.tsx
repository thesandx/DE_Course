import Link from 'next/link';

import { Icon } from '@/components/layout/Icon';
import { BOSS_XP, bossId, lineProgress, stationId, stationXp } from '@/lib/course/gcp/catalog';
import { hueStyle } from '@/lib/course/hue';
import type { DoneMap } from '@/lib/course/progress';
import { cn } from '@/lib/utils';
import type { GcpLine } from '@/types/gcp';

export interface MetroLineProps {
  line: GcpLine;
  done: DoneMap;
  /** The station the learner should ride next, highlighted on the map. */
  nextSlug?: string | undefined;
}

/**
 * One line as a vertical strip map: the line in its colour, a stop per
 * station, and the boss at the terminus. A finished stop is filled, the next
 * stop pulses, and the boss is locked until every stop is done.
 */
export function MetroLine({ line, done, nextSlug }: MetroLineProps) {
  const hue = hueStyle(line.hue);
  const progress = lineProgress(line, done);
  const bossBeaten = done[bossId(line.slug)] !== undefined;

  return (
    <ol className="relative flex flex-col">
      <span
        aria-hidden="true"
        className={cn(
          'rounded-pill absolute top-6 bottom-6 left-5 w-1.5 -translate-x-1/2',
          hue.fill,
        )}
      />
      {line.stations.map((station) => {
        const finished = done[stationId(station.slug)] !== undefined;
        const next = station.slug === nextSlug;
        return (
          <li key={station.slug} className="relative flex items-stretch gap-4 py-1.5">
            <span className="relative z-10 flex w-10 shrink-0 items-center justify-center">
              <span
                aria-hidden="true"
                className={cn(
                  'text-ink inline-grid size-7 place-items-center rounded-full',
                  hue.fill,
                  next && 'animate-pulse',
                )}
              >
                {finished ? (
                  <Icon name="check" className="size-3.5" />
                ) : (
                  <span className="bg-surface size-3 rounded-full" />
                )}
              </span>
            </span>
            <Link
              href={`/gcp/lines/${line.slug}/${station.slug}`}
              className={cn(
                'bg-surface rounded-card shadow-card hover:border-line-strong flex min-h-16 min-w-0 flex-1 items-center gap-3 border px-4 py-3 transition-colors',
                next ? 'border-ink' : 'border-line',
              )}
            >
              <span className="text-small text-ink-faint w-8 shrink-0 font-mono">
                {station.code}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-semibold">{station.title}</span>
                <span className="text-small text-ink-soft">
                  {station.concepts.length} concepts · {station.keyPoints.length} checkpoints
                </span>
              </span>
              <span
                className={cn(
                  'text-small shrink-0 font-semibold',
                  finished ? 'text-easy' : next ? 'text-brand-deep' : 'text-iris',
                )}
              >
                {finished ? 'Done' : next ? 'Next' : `+${stationXp(station)} XP`}
              </span>
            </Link>
          </li>
        );
      })}
      <li className="relative flex items-stretch gap-4 py-1.5">
        <span className="relative z-10 flex w-10 shrink-0 items-center justify-center">
          <span
            aria-hidden="true"
            className={cn(
              'rounded-input inline-grid size-10 place-items-center border',
              hue.border,
              bossBeaten ? 'bg-gold text-gold-ink' : 'bg-night text-on-night',
            )}
          >
            <Icon name="trophy" filled className="size-4" />
          </span>
        </span>
        {progress.bossOpen || bossBeaten ? (
          <Link
            href={`/gcp/lines/${line.slug}/boss`}
            className="bg-night-glow text-on-night rounded-card shadow-raised flex min-h-16 flex-1 items-center gap-3 px-4 py-3"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="eyebrow text-on-night-soft">Terminus · Boss round</span>
              <span className="text-body font-semibold">{line.boss.title}</span>
            </span>
            <span className="text-small shrink-0 font-semibold">
              {bossBeaten ? 'Beaten' : `+${BOSS_XP} XP`}
            </span>
          </Link>
        ) : (
          <div className="bg-sunken border-line rounded-card flex min-h-16 flex-1 items-center gap-3 border border-dashed px-4 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="eyebrow text-ink-faint">Terminus · Boss round</span>
              <span className="text-body text-ink-soft font-semibold">{line.boss.title}</span>
            </span>
            <span className="text-small text-ink-faint shrink-0">
              {progress.stationsTotal - progress.stationsDone} stops to unlock
            </span>
          </div>
        )}
      </li>
    </ol>
  );
}
