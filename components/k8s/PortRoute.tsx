import Link from 'next/link';

import { Icon, type IconName } from '@/components/layout/Icon';
import { hueStyle } from '@/lib/course/hue';
import {
  DRILL_XP,
  hasDrill,
  lessonHref,
  lessonId,
  lessonXp,
  MISSION_XP,
  portProgress,
} from '@/lib/course/k8s/catalog';
import { stripInline } from '@/lib/course/markdown';
import type { DoneMap } from '@/lib/course/progress';
import { cn } from '@/lib/utils';
import type { K8sPort } from '@/types/k8s';

export interface PortRouteProps {
  port: K8sPort;
  done: DoneMap;
  /** The lesson to do next, highlighted on the route. */
  nextSlug?: string | undefined;
}

function Finale({
  href,
  icon,
  eyebrow,
  title,
  status,
  won,
  open,
  border,
}: {
  href: string;
  icon: IconName;
  eyebrow: string;
  title: string;
  status: string;
  won: boolean;
  open: boolean;
  border: string;
}) {
  return (
    <li className="relative flex items-stretch gap-4 py-1.5">
      <span className="relative z-10 flex w-10 shrink-0 items-center justify-center">
        <span
          aria-hidden="true"
          className={cn(
            'rounded-input inline-grid size-10 place-items-center border',
            border,
            won ? 'bg-gold text-gold-ink' : 'bg-night text-on-night',
          )}
        >
          <Icon name={icon} filled={icon === 'trophy'} className="size-4" />
        </span>
      </span>
      {open ? (
        <Link
          href={href}
          className="bg-night-glow text-on-night rounded-card shadow-raised flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="eyebrow text-on-night-soft">{eyebrow}</span>
            <span className="text-body font-semibold">{title}</span>
          </span>
          <span className="text-small shrink-0 font-semibold">{status}</span>
        </Link>
      ) : (
        <Link
          href={href}
          className="bg-sunken border-line rounded-card flex min-h-16 min-w-0 flex-1 items-center gap-3 border border-dashed px-4 py-3"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="eyebrow text-ink-faint">{eyebrow}</span>
            <span className="text-body text-ink-soft font-semibold">{title}</span>
          </span>
          <span className="text-small text-ink-faint shrink-0">{status}</span>
        </Link>
      )}
    </li>
  );
}

/**
 * One port as a vertical route: a stop per lesson, then the mission and the
 * incident drill. A finished stop is filled, the next stop pulses, and the
 * drill is locked until every lesson is done.
 */
export function PortRoute({ port, done, nextSlug }: PortRouteProps) {
  const hue = hueStyle(port.hue);
  const progress = portProgress(port, done);
  const left = progress.lessonsTotal - progress.lessonsDone;

  return (
    <ol className="relative flex flex-col">
      <span
        aria-hidden="true"
        className={cn(
          'rounded-pill absolute top-6 bottom-6 left-5 w-1.5 -translate-x-1/2',
          hue.fill,
        )}
      />
      {port.lessons.map((lesson, index) => {
        const finished = done[lessonId(port.slug, lesson.slug)] !== undefined;
        const next = lesson.slug === nextSlug;
        return (
          <li key={lesson.slug} className="relative flex items-stretch gap-4 py-1.5">
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
              href={lessonHref(port.slug, lesson.slug)}
              className={cn(
                'bg-surface rounded-card shadow-card hover:border-line-strong flex min-h-16 min-w-0 flex-1 items-center gap-3 border px-4 py-3 transition-colors',
                next ? 'border-ink' : 'border-line',
              )}
            >
              <span className="text-small text-ink-faint w-5 shrink-0 font-mono">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-semibold">{lesson.title}</span>
                <span className="text-small text-ink-soft line-clamp-2">
                  {stripInline(lesson.pain)}
                </span>
                <span className="text-micro text-ink-faint pt-1">
                  {lesson.lab.length > 0 ? `Lab · ${lesson.lab.length} steps` : 'Reading'}
                </span>
              </span>
              <span
                className={cn(
                  'text-small shrink-0 font-semibold',
                  finished ? 'text-easy' : next ? 'text-brand-deep' : 'text-iris',
                )}
              >
                {finished ? 'Done' : next ? 'Next' : `+${lessonXp(lesson)} XP`}
              </span>
            </Link>
          </li>
        );
      })}
      <Finale
        href={`/k8s/ports/${port.slug}/mission`}
        icon="spark"
        eyebrow="Mission · no steps given"
        title={port.mission.title}
        status={progress.missionDone ? 'Done' : `+${MISSION_XP} XP`}
        won={progress.missionDone}
        open
        border={hue.border}
      />
      {hasDrill(port.slug) && (
        <Finale
          href={`/k8s/ports/${port.slug}/drill`}
          icon="trophy"
          eyebrow="Incident drill"
          title="The pager goes off"
          status={
            progress.drillPassed
              ? 'Passed'
              : progress.drillOpen
                ? `+${DRILL_XP} XP`
                : `${left} ${left === 1 ? 'lesson' : 'lessons'} to unlock`
          }
          won={progress.drillPassed}
          open={progress.drillOpen || progress.drillPassed}
          border={hue.border}
        />
      )}
    </ol>
  );
}
