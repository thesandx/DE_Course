import Link from 'next/link';

import { ProgressRing } from '@/components/course/ProgressRing';
import { cn } from '@/lib/utils';
import type { TrackTone } from '@/types/course';

const TONE_CLASS: Record<TrackTone, string> = {
  butter: 'bg-butter',
  soda: 'bg-soda',
  grape: 'bg-grape',
  peach: 'bg-peach',
};

export interface TrackCardProps {
  href: string;
  title: string;
  summary: string;
  tone: TrackTone;
  /** "Track 2", so the study order is visible. */
  eyebrow: string;
  lessons: number;
  problems: number;
  /** 0 to 1. Omit for a signed-out preview. */
  ratio?: number;
  className?: string;
}

/**
 * One track as a card you press. The candy tone is the track's identity and
 * stays the same everywhere the track appears.
 */
export function TrackCard({
  href,
  title,
  summary,
  tone,
  eyebrow,
  lessons,
  problems,
  ratio,
  className,
}: TrackCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'squish border-line shadow-mochi rounded-card flex h-full flex-col gap-4 border-2 p-5',
        TONE_CLASS[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-small font-bold">{eyebrow}</span>
          <h3 className="text-heading font-display break-words">{title}</h3>
        </div>
        {ratio !== undefined ? (
          <ProgressRing
            ratio={ratio}
            label={`${title} progress`}
            size={64}
            className="text-small"
          />
        ) : null}
      </div>
      <p className="text-small grow">{summary}</p>
      <p className="text-small font-bold">
        {lessons} lessons and {problems} problems
      </p>
    </Link>
  );
}
