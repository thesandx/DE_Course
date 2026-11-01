import Link from 'next/link';

import { ProgressRing } from '@/components/course/ProgressRing';
import { StudyCalendar } from '@/components/course/StudyCalendar';
import { Icon, type IconName } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import {
  CARD_XP,
  lineProgress,
  LINES,
  MOCK_XP,
  nextStation,
  QUESTIONS,
  stationXp,
} from '@/lib/course/gcp/catalog';
import type { GcpSummary } from '@/lib/course/gcp/summary';
import { hueStyle } from '@/lib/course/hue';
import type { ProgressRecord } from '@/lib/course/progress';
import { CALENDAR_WEEKS } from '@/lib/course/summary';
import { cn } from '@/lib/utils';

import { LineCard } from './LineCard';

export interface GcpDashboardProps {
  name: string;
  progress: ProgressRecord;
  summary: GcpSummary;
  today: string;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

function HeroStat({
  icon,
  tile,
  value,
  label,
}: {
  icon: IconName;
  tile: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('rounded-input inline-grid size-9 shrink-0 place-items-center', tile)}>
        <Icon name={icon} filled={icon === 'flame' || icon === 'trophy'} className="size-4" />
      </span>
      <span className="flex flex-col">
        <span className="text-heading font-semibold">{value}</span>
        <span className="text-small text-on-night-soft">{label}</span>
      </span>
    </div>
  );
}

/**
 * The GCP course home: rank, today's XP goal and streak in the hero, the next
 * station one tap away, exam readiness by domain, the five lines as a
 * network, and the drills. Every number comes from the GCP tracker only.
 */
export function GcpDashboard({ name, progress, summary, today }: GcpDashboardProps) {
  const next = nextStation(progress.done);
  const firstName = name.split(' ')[0] ?? name;
  const goalRatio = Math.min(summary.xpToday / summary.dailyGoal, 1);
  const continueHref =
    next === undefined ? '/gcp/practice/mock' : `/gcp/lines/${next.line.slug}/${next.station.slug}`;
  const continueLabel =
    next === undefined
      ? 'Sit the mock exam'
      : `Ride on: ${next.station.code} ${next.station.title}`;

  const stats = [
    {
      icon: 'flame',
      tile: 'bg-brand/20 text-brand',
      value: plural(summary.streak, 'day'),
      label: 'Streak',
    },
    {
      icon: 'trophy',
      tile: 'bg-gold/20 text-gold',
      value: `${summary.bossesBeaten} / ${summary.linesTotal}`,
      label: 'Bosses beaten',
    },
    {
      icon: 'check',
      tile: 'bg-easy-bar/20 text-easy-bar',
      value: `${summary.stationsDone} / ${summary.stationsTotal}`,
      label: 'Stations',
    },
    {
      icon: 'star',
      tile: 'bg-iris/25 text-iris',
      value: `${summary.xp}`,
      label: summary.rank.to === null ? 'XP' : `of ${summary.rank.to} XP`,
    },
  ] as const;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 md:gap-6 md:px-8 md:py-6">
      <section
        aria-labelledby="greeting"
        className="bg-night-glow rounded-sheet text-on-night shadow-raised relative overflow-hidden p-6 md:p-8"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-3">
            <span className="border-night-line bg-night-raised rounded-pill text-small inline-flex w-fit items-center gap-2 border px-3 py-1 font-semibold">
              <span aria-hidden="true" className="bg-track-5 size-1.5 rounded-full" />
              Rank {summary.rank.number} · {summary.rank.title}
            </span>
            <h1 id="greeting" className="text-display">
              Hi, {firstName}
            </h1>
            <p className="text-body text-on-night-soft max-w-md">
              {next !== undefined
                ? `Next stop: ${next.line.short}, station ${next.station.code}, ${next.station.title}.`
                : 'Every station is done. Beat the remaining bosses and pass the mock exam.'}
            </p>
          </div>
          <div className="shrink-0">
            <ProgressRing
              ratio={goalRatio}
              label="Today's XP goal"
              size={104}
              thickness={10}
              tone="gold"
              surface="night"
              className="hidden md:inline-grid"
            >
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-title">{summary.xpToday}</span>
                <span className="text-micro text-on-night-soft">of {summary.dailyGoal} today</span>
              </span>
            </ProgressRing>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4 md:hidden">
          <ProgressRing
            ratio={goalRatio}
            label="Today's XP goal"
            size={76}
            thickness={8}
            tone="gold"
            surface="night"
          >
            <span className="text-body font-semibold">{summary.xpToday}</span>
          </ProgressRing>
          <div className="flex flex-col gap-1">
            <p className="text-body font-semibold">
              {summary.xpToday} of {summary.dailyGoal} XP today
            </p>
            <p className="text-small text-on-night-soft">
              {goalRatio >= 1
                ? 'Daily goal met. Nice.'
                : `${summary.dailyGoal - summary.xpToday} XP to today's goal`}
            </p>
          </div>
        </div>

        <dl className="border-night-line mt-6 grid grid-cols-2 gap-4 border-t pt-5 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <HeroStat icon={stat.icon} tile={stat.tile} value={stat.value} label={stat.label} />
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={continueHref} className={buttonStyles({ className: 'w-full sm:w-auto' })}>
            <span className="truncate">{continueLabel}</span>
            {next !== undefined && (
              <span className="shrink-0">· +{stationXp(next.station)} XP</span>
            )}
          </Link>
          <Link
            href="/gcp/practice"
            className={buttonStyles({ variant: 'night', className: 'w-full sm:w-auto' })}
          >
            Open the drills
          </Link>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-ink-faint">Exam radar</p>
              <h2 className="text-heading">Readiness by domain</h2>
            </div>
            <span className="border-line bg-surface rounded-pill text-small shrink-0 border px-2.5 py-0.5 font-semibold">
              {Math.round(summary.readiness * 100)}% overall
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {LINES.map((line) => {
              const ratio = lineProgress(line, progress.done).ratio;
              return (
                <li key={line.slug} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn('size-2.5 shrink-0 rounded-full', hueStyle(line.hue).fill)}
                  />
                  <span className="text-small w-28 shrink-0 font-semibold sm:w-36">
                    {line.short}
                  </span>
                  <span className="bg-sunken rounded-pill relative h-1.5 flex-1 overflow-hidden">
                    <span
                      className={cn(
                        'rounded-pill absolute inset-y-0 left-0',
                        hueStyle(line.hue).fill,
                      )}
                      style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%` }}
                    />
                  </span>
                  <span className="text-small text-ink-soft w-10 shrink-0 text-right font-mono">
                    {line.weight}%
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-small text-ink-faint">
            Weighted by each domain&apos;s share of the real exam. A boss counts as one station.
          </p>
        </section>

        <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-ink-faint">Consistency</p>
              <h2 className="text-heading">Study calendar</h2>
            </div>
            <span className="border-line bg-surface rounded-pill text-small shrink-0 border px-2.5 py-0.5 font-semibold">
              best {plural(summary.bestStreak, 'day')}
            </span>
          </div>
          <StudyCalendar days={progress.days} today={today} weeks={CALENDAR_WEEKS} />
          <Progress
            label={
              summary.rank.to === null ? 'Top rank reached' : `To rank ${summary.rank.number + 1}`
            }
            value={summary.rankRatio * 100}
            valueText={
              summary.rank.to === null
                ? `${summary.xp} XP`
                : `${summary.xp} / ${summary.rank.to} XP`
            }
          />
        </section>
      </div>

      <section aria-labelledby="network-heading" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="eyebrow text-ink-faint">The network</p>
            <h2 id="network-heading" className="text-title">
              Five lines, one exam
            </h2>
          </div>
          <Link
            href="/gcp/lines"
            className="text-small text-brand-deep inline-flex min-h-11 items-center font-semibold hover:underline"
          >
            Line map →
          </Link>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINES.map((line) => (
            <li key={line.slug}>
              <LineCard line={line} done={progress.done} />
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="drills-heading"
        className="bg-night-soft rounded-sheet text-on-night flex flex-col gap-5 p-6 md:p-7"
      >
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-on-night-soft">Practice</p>
          <h2 id="drills-heading" className="text-title">
            Drills
          </h2>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {[
            {
              href: '/gcp/practice/flashcards',
              title: 'Flashcards',
              detail: `${summary.cardsKnown} of ${summary.cardsTotal} known · +${CARD_XP} XP each`,
            },
            {
              href: '/gcp/practice/sprint',
              title: 'Service Sprint',
              detail: '60 seconds: match each need to its service',
            },
            {
              href: '/gcp/practice/mock',
              title: 'Mock exam',
              detail: summary.mockPassed
                ? 'Passed · replay any time'
                : `50 of ${QUESTIONS.length} questions · +${MOCK_XP} XP for a pass`,
            },
          ].map((drill) => (
            <li key={drill.href}>
              <Link
                href={drill.href}
                className="border-night-line bg-night-raised/60 hover:border-on-night-soft rounded-card flex h-full flex-col gap-1 border p-5 transition-colors"
              >
                <span className="text-heading">{drill.title}</span>
                <span className="text-small text-on-night-soft">{drill.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
