import Link from 'next/link';

import { Icon } from '@/components/layout/Icon';
import { hueStyle } from '@/lib/course/hue';
import { lessonId, portCode, portProgress } from '@/lib/course/k8s/catalog';
import type { DoneMap } from '@/lib/course/progress';
import { cn } from '@/lib/utils';
import type { K8sPort } from '@/types/k8s';

export interface PortCardProps {
  port: K8sPort;
  done: DoneMap;
  /** True for the first port that is not cleared yet. */
  next?: boolean;
}

/**
 * A port as a tile: its number and name, a dot per lesson, and the flag at
 * the end that turns gold when the port is cleared.
 */
export function PortCard({ port, done, next = false }: PortCardProps) {
  const hue = hueStyle(port.hue);
  const progress = portProgress(port, done);
  return (
    <Link
      href={`/k8s/ports/${port.slug}`}
      className={cn(
        'bg-surface rounded-card shadow-card hover:shadow-raised flex h-full flex-col gap-3 border border-t-4 p-5 transition-shadow',
        next ? 'border-ink' : 'border-line',
        hue.edge,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-ink-faint">{portCode(port)}</span>
        {(progress.cleared || next) && (
          <span
            className={cn(
              'text-small rounded-pill border px-2.5 py-0.5 font-semibold',
              progress.cleared ? 'bg-easy-soft text-easy border-easy-bar' : 'border-line',
            )}
          >
            {progress.cleared ? 'Cleared' : 'Next port'}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-heading">{port.title}</h3>
        <p className="text-small text-ink-soft">{port.tag}</p>
      </div>
      <div className="relative flex items-center justify-between py-2" aria-hidden="true">
        <span
          className={cn('rounded-pill absolute inset-x-1 top-1/2 h-1 -translate-y-1/2', hue.fill)}
        />
        {port.lessons.map((lesson) => (
          <span
            key={lesson.slug}
            className={cn('relative inline-grid size-4 place-items-center rounded-full', hue.fill)}
          >
            {done[lessonId(port.slug, lesson.slug)] === undefined && (
              <span className="bg-surface size-2 rounded-full" />
            )}
          </span>
        ))}
        <span
          className={cn(
            'rounded-box relative inline-grid size-6 place-items-center',
            progress.cleared ? 'bg-gold text-gold-ink' : 'bg-night text-on-night',
          )}
        >
          <Icon name="trophy" filled className="size-3" />
        </span>
      </div>
      <p className="text-small text-ink-soft mt-auto">
        {progress.lessonsDone} of {progress.lessonsTotal} lessons
        {progress.missionDone ? ' · mission done' : ''}
        {progress.drillPassed ? ' · drill passed' : ''}
      </p>
    </Link>
  );
}
