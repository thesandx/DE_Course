import Link from 'next/link';

import { Icon } from '@/components/layout/Icon';
import { lineProgress, stationId } from '@/lib/course/gcp/catalog';
import { hueStyle } from '@/lib/course/hue';
import type { DoneMap } from '@/lib/course/progress';
import { cn } from '@/lib/utils';
import type { GcpLine } from '@/types/gcp';

export interface LineCardProps {
  line: GcpLine;
  done: DoneMap;
}

/**
 * A line as a tile: its number and name, the exam weight, and a mini strip
 * map — one dot per station and the boss at the end — so progress reads at a
 * glance.
 */
export function LineCard({ line, done }: LineCardProps) {
  const hue = hueStyle(line.hue);
  const progress = lineProgress(line, done);
  return (
    <Link
      href={`/gcp/lines/${line.slug}`}
      className={cn(
        'bg-surface border-line rounded-card shadow-card hover:shadow-raised flex h-full flex-col gap-3 border border-t-4 p-5 transition-shadow',
        hue.edge,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-ink-faint">Line {line.number}</span>
        <span className="text-small border-line rounded-pill border px-2.5 py-0.5 font-semibold">
          {line.weight}% of exam
        </span>
      </div>
      <h3 className="text-heading">{line.title}</h3>
      <div className="relative flex items-center justify-between py-2" aria-hidden="true">
        <span
          className={cn('rounded-pill absolute inset-x-1 top-1/2 h-1 -translate-y-1/2', hue.fill)}
        />
        {line.stations.map((station) => (
          <span
            key={station.slug}
            className={cn('relative inline-grid size-4 place-items-center rounded-full', hue.fill)}
          >
            {done[stationId(station.slug)] === undefined && (
              <span className="bg-surface size-2 rounded-full" />
            )}
          </span>
        ))}
        <span
          className={cn(
            'rounded-box relative inline-grid size-6 place-items-center',
            progress.bossBeaten ? 'bg-gold text-gold-ink' : 'bg-night text-on-night',
          )}
        >
          <Icon name="trophy" filled className="size-3" />
        </span>
      </div>
      <p className="text-small text-ink-soft mt-auto">
        {progress.stationsDone} of {progress.stationsTotal} stations
        {progress.bossBeaten ? ' · boss beaten' : progress.bossOpen ? ' · boss open' : ''}
      </p>
    </Link>
  );
}
