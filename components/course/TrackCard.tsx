import Link from 'next/link';

import { ProgressRing } from '@/components/course/ProgressRing';
import { trackNumber, trackStyle } from '@/lib/course/track-style';
import { cn } from '@/lib/utils';

export interface TrackCardProps {
  href: string;
  /** The track's slug. It picks the track's number and colour. */
  slug: string;
  title: string;
  summary: string;
  lessons: number;
  problems: number;
  /** 0 to 1. Omit for a signed-out preview. */
  ratio?: number;
  className?: string;
}

/**
 * One track as a card you press: a white card with the track's colour on the
 * top edge, the same colour the track has everywhere else.
 */
export function TrackCard({
  href,
  slug,
  title,
  summary,
  lessons,
  problems,
  ratio,
  className,
}: TrackCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'bg-surface border-line shadow-card hover:shadow-raised rounded-card flex h-full flex-col gap-3 border border-t-4 p-5 transition-shadow',
        trackStyle(slug).edge,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="eyebrow text-ink-faint">Track {trackNumber(slug)}</span>
          <h2 className="text-heading break-words">{title}</h2>
        </div>
        {ratio !== undefined ? (
          <ProgressRing ratio={ratio} label={`${title} progress`} size={52} thickness={5}>
            <span className="text-micro">{Math.round(ratio * 100)}%</span>
          </ProgressRing>
        ) : null}
      </div>
      <p className="text-small text-ink-soft grow">{summary}</p>
      <p className="text-micro text-ink-faint font-mono">
        {lessons} lessons · {problems} problems
      </p>
    </Link>
  );
}
