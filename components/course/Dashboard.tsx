import Link from 'next/link';

import { DifficultyTag } from '@/components/course/DifficultyTag';
import { ProgressRing } from '@/components/course/ProgressRing';
import { StudyCalendar } from '@/components/course/StudyCalendar';
import { Icon, type IconName } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import {
  COMPANIES,
  DIFFICULTY_LABELS,
  getTrack,
  nextLesson,
  PROBLEMS,
  readiness,
  solvedByDifficulty,
  trackProgress,
  TRACKS,
} from '@/lib/course/catalog';
import { problemId, type ProgressRecord } from '@/lib/course/progress';
import { agoLabel, CALENDAR_WEEKS, type LearnerSummary, WEEKLY_GOAL } from '@/lib/course/summary';
import { trackStyle } from '@/lib/course/track-style';
import { cn } from '@/lib/utils';
import type { Difficulty } from '@/types/course';

export interface DashboardProps {
  name: string;
  progress: ProgressRecord;
  summary: LearnerSummary;
  /** `YYYY-MM-DD`. Passed in so the page and its tests agree on the day. */
  today: string;
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  easy: 'text-easy',
  medium: 'text-medium',
  hard: 'text-hard',
};

const DIFFICULTY_BAR: Record<Difficulty, string> = {
  easy: 'bg-easy-bar',
  medium: 'bg-medium-bar',
  hard: 'bg-hard-bar',
};

const COMPANY_TONE = { uber: 'easy', google: 'blue' } as const;

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** An eyebrow and a title, the head of every dashboard card. */
function CardHead({
  eyebrow,
  title,
  chip,
  night = false,
}: {
  eyebrow: string;
  title: string;
  chip?: string;
  night?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <p className={cn('eyebrow', night ? 'text-on-night-soft' : 'text-ink-faint')}>{eyebrow}</p>
        <h2 className="text-heading">{title}</h2>
      </div>
      {chip !== undefined && (
        <span className="border-line bg-surface rounded-pill text-small shrink-0 border px-2.5 py-0.5 font-semibold">
          {chip}
        </span>
      )}
    </div>
  );
}

/** One stat in the hero: an icon tile, a value and a label. */
function HeroStat({
  icon,
  tile,
  value,
  label,
}: {
  icon: IconName;
  tile: string;
  value: React.ReactNode;
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
 * The signed-in home: where you are, what to do next, and how close you are
 * to each loop. Every number comes from the learner's record and the
 * catalogue. Nothing here is decoration pretending to be data.
 *
 * One ink hero owns the thing that matters (resume the next lesson), with the
 * XP ring beside it. Loop readiness is a full-width night band, so the page has
 * a rhythm instead of a stack of identical cards.
 */
export function Dashboard({ name, progress, summary, today }: DashboardProps) {
  const next = nextLesson(progress.done);
  const solved = solvedByDifficulty(progress.done);
  const firstName = name.split(' ')[0] ?? name;
  const { level } = summary;
  const levelPercent = Math.round(summary.levelRatio * 100);
  const nextLevelTitle = level.to === null ? undefined : `Level ${level.number + 1}`;

  const upNext = PROBLEMS.filter((problem) => progress.done[problemId(problem.slug)] === undefined)
    .sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty))
    .slice(0, 4);

  const weekly = Math.min(summary.solvedThisWeek, WEEKLY_GOAL);
  const weeklyLeft = WEEKLY_GOAL - weekly;
  const continueHref = next ? `/de/tracks/${next.track.slug}/${next.lesson.slug}` : '/de/problems';

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 md:gap-6 md:px-8 md:py-6">
      {/* Hero */}
      <section
        aria-labelledby="greeting"
        className="bg-night-glow rounded-sheet text-on-night shadow-raised relative overflow-hidden p-6 md:p-8"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-3">
            <span className="border-night-line bg-night-raised rounded-pill text-small inline-flex w-fit items-center gap-2 border px-3 py-1 font-semibold">
              <span aria-hidden="true" className="bg-easy-bar size-1.5 rounded-full" />
              Level {level.number} · {level.title}
            </span>
            <h1 id="greeting" className="text-display">
              Hi, {firstName}
            </h1>
            <p className="text-body text-on-night-soft max-w-md">
              {next !== undefined ? (
                <>
                  {next.lesson.title} is your next lesson
                  <span className="hidden md:inline"> — {next.lesson.minutes} minutes.</span>
                  <span className="md:hidden"> — {next.lesson.minutes} minutes.</span>
                </>
              ) : (
                'Every lesson is finished. Keep your edge with the problems.'
              )}
            </p>
          </div>
          {/* cn() does not merge classes, so the ring hides through its wrapper. */}
          <div className="hidden shrink-0 md:block">
            <ProgressRing
              ratio={summary.levelRatio}
              label="Progress to the next level"
              size={112}
              thickness={10}
              tone="gold"
              surface="night"
            >
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-title">{levelPercent}%</span>
                <span className="text-micro text-on-night-soft">XP</span>
              </span>
            </ProgressRing>
          </div>
        </div>

        {/* Phone: the XP ring sits inside the hero, under the greeting. */}
        <div className="mt-5 flex items-center gap-4 md:hidden">
          <ProgressRing
            ratio={summary.levelRatio}
            label="Progress to the next level"
            size={84}
            thickness={8}
            tone="gold"
            surface="night"
          >
            <span className="text-heading">{levelPercent}%</span>
          </ProgressRing>
          <div className="flex flex-col gap-1">
            <p className="text-body font-semibold">
              {level.to === null ? `${summary.xp} XP` : `${summary.xp} of ${level.to} XP`}
            </p>
            <p className="text-small text-on-night-soft">
              {nextLevelTitle !== undefined
                ? `${nextLevelTitle} is ${level.to === null ? 0 : level.to - summary.xp} XP away`
                : 'Top level reached'}
            </p>
          </div>
        </div>

        <div className="mt-6 hidden flex-wrap gap-3 md:flex">
          <Link href={continueHref} className={buttonStyles()}>
            {next !== undefined ? `Continue: ${next.lesson.title}` : 'Open the problems'}
            <Icon name="arrow-right" className="size-4" />
          </Link>
          <Link href="/de/problems" className={buttonStyles({ variant: 'night' })}>
            Browse the {PROBLEMS.length} problems
          </Link>
        </div>

        <dl className="border-night-line mt-6 grid grid-cols-3 gap-4 border-t pt-5 md:grid-cols-4">
          <div className="hidden md:block">
            <dt className="sr-only">Current streak</dt>
            <dd>
              <HeroStat
                icon="flame"
                tile="bg-brand/20 text-brand"
                value={plural(summary.streak, 'day')}
                label="Current streak"
              />
            </dd>
          </div>
          <div className="hidden md:block">
            <dt className="sr-only">Best streak</dt>
            <dd>
              <HeroStat
                icon="trophy"
                tile="bg-gold/20 text-gold"
                value={plural(summary.bestStreak, 'day')}
                label="Best streak"
              />
            </dd>
          </div>
          <div className="hidden md:block">
            <dt className="sr-only">Problems solved</dt>
            <dd>
              <HeroStat
                icon="check"
                tile="bg-easy-bar/20 text-easy-bar"
                value={
                  <>
                    {summary.solved}
                    <span className="text-small text-on-night-soft font-normal">
                      {' '}
                      / {summary.totalProblems}
                    </span>
                  </>
                }
                label="Problems solved"
              />
            </dd>
          </div>
          <div className="hidden md:block">
            <dt className="sr-only">Days studied</dt>
            <dd>
              <HeroStat
                icon="clock"
                tile="bg-iris/25 text-iris"
                value={plural(summary.activeDays, 'day')}
                label={`Studied, last ${CALENDAR_WEEKS} wks`}
              />
            </dd>
          </div>
          {/* Phone: three plain stats. */}
          <div className="md:hidden">
            <dt className="text-small text-on-night-soft order-2">Streak</dt>
            <dd className="text-body font-semibold">{plural(summary.streak, 'day')}</dd>
          </div>
          <div className="md:hidden">
            <dt className="text-small text-on-night-soft">Best</dt>
            <dd className="text-body font-semibold">{plural(summary.bestStreak, 'day')}</dd>
          </div>
          <div className="md:hidden">
            <dt className="text-small text-on-night-soft">Solved</dt>
            <dd className="text-body font-semibold">
              {summary.solved} / {summary.totalProblems}
            </dd>
          </div>
        </dl>

        <Link
          href={continueHref}
          className={buttonStyles({ block: true, className: 'mt-5 md:hidden' })}
        >
          {next !== undefined ? `Continue: ${next.lesson.title}` : 'Open the problems'}
        </Link>
      </section>

      {/* Progress and consistency */}
      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-6">
          <CardHead
            eyebrow="Progress"
            title="Problems solved"
            chip={`+${summary.solvedThisWeek} this week`}
          />
          <div className="flex items-center gap-6">
            <ProgressRing
              ratio={summary.totalProblems === 0 ? 0 : summary.solved / summary.totalProblems}
              label="Problems solved"
              size={100}
              thickness={9}
              className="hidden sm:inline-grid"
            >
              <span className="flex flex-col items-center gap-1">
                <span className="text-key">{summary.solved}</span>
                <span className="text-micro text-ink-faint font-normal">
                  of {summary.totalProblems}
                </span>
              </span>
            </ProgressRing>
            <ul className="flex min-w-0 flex-1 flex-col gap-3">
              {DIFFICULTIES.map((key) => {
                const { done, total } = solved[key];
                const ratio = total === 0 ? 0 : done / total;
                return (
                  <li key={key} className="flex items-center gap-3">
                    <span
                      className={cn('text-small w-16 shrink-0 font-semibold', DIFFICULTY_TEXT[key])}
                    >
                      {DIFFICULTY_LABELS[key]}
                    </span>
                    <span className="bg-sunken rounded-pill relative h-1.5 flex-1 overflow-hidden">
                      <span
                        className={cn(
                          'rounded-pill absolute inset-y-0 left-0',
                          DIFFICULTY_BAR[key],
                        )}
                        style={{ width: `${Math.max(ratio * 100, done > 0 ? 4 : 0)}%` }}
                      />
                    </span>
                    <span className="text-small text-ink-soft w-10 shrink-0 text-right font-mono">
                      {done}/{total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <Link href="/de/problems" className={buttonStyles({ variant: 'secondary', block: true })}>
            Open the problem list
          </Link>
        </section>

        <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-5 border p-6">
          <CardHead eyebrow="Consistency" title="Study calendar" chip={`${CALENDAR_WEEKS} weeks`} />
          <StudyCalendar days={progress.days} today={today} weeks={CALENDAR_WEEKS} />
        </section>
      </div>

      {/* Loop readiness */}
      <section
        aria-labelledby="readiness-heading"
        className="bg-night-soft rounded-sheet text-on-night flex flex-col gap-5 p-6 md:p-7"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="eyebrow text-on-night-soft">Company drills</p>
            <h2 id="readiness-heading" className="text-title">
              Loop readiness
            </h2>
            <p className="text-body text-on-night-soft hidden md:block">
              How close you are to the bar each company actually sets.
            </p>
          </div>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {COMPANIES.map((company) => {
            const ratio = readiness(company, progress.done);
            const asked = PROBLEMS.filter((problem) =>
              problem.companies.includes(company.slug),
            ).length;
            return (
              <li
                key={company.slug}
                className="border-night-line bg-night-raised/60 rounded-card flex items-start gap-4 border p-5"
              >
                <ProgressRing
                  ratio={ratio}
                  label={`${company.name} readiness`}
                  size={68}
                  thickness={7}
                  tone={COMPANY_TONE[company.slug]}
                  surface="night"
                  shape="wedge"
                >
                  <span className="text-body">{Math.round(ratio * 100)}%</span>
                </ProgressRing>
                <div className="flex min-w-0 flex-col gap-2">
                  <h3 className="text-heading">{company.name}</h3>
                  <p className="text-small text-on-night-soft">{company.summary}</p>
                  <ul className="hidden flex-wrap gap-1.5 md:flex">
                    {[`${asked} problems`, ...company.highlights].map((tag) => (
                      <li
                        key={tag}
                        className="border-night-line rounded-pill text-micro border px-2.5 py-1 font-semibold"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/de/companies/${company.slug}`}
                    className="text-small text-brand inline-flex min-h-11 w-fit items-center font-semibold hover:underline md:min-h-0"
                  >
                    Read the loop guide →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Tracks and what to do next */}
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-6">
        <section aria-labelledby="tracks-heading" className="flex flex-col gap-4 lg:col-span-7">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-ink-faint">Curriculum</p>
              <h2 id="tracks-heading" className="text-title">
                Your tracks
              </h2>
            </div>
            <Link
              href="/de/tracks"
              className="text-small text-brand-deep font-semibold hover:underline"
            >
              All {TRACKS.length} →
            </Link>
          </div>
          <ul className="flex flex-col gap-2.5">
            {TRACKS.map((track) => {
              const stats = trackProgress(track, progress.done);
              const style = trackStyle(track.slug);
              const percent = Math.round(stats.ratio * 100);
              return (
                <li key={track.slug}>
                  <Link
                    href={`/de/tracks/${track.slug}`}
                    className={cn(
                      'bg-surface border-line rounded-input shadow-card hover:border-line-strong flex items-center gap-4 border border-l-4 py-3.5 pr-4 pl-4 transition-colors',
                      style.rail,
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-semibold">{track.title}</span>
                      <span className="text-small text-ink-faint">
                        {plural(stats.lessonsTotal, 'lesson')} ·{' '}
                        {plural(stats.problemsTotal, 'problem')}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="bg-sunken rounded-pill relative hidden h-1.5 w-32 overflow-hidden sm:block"
                    >
                      <span
                        className={cn('rounded-pill absolute inset-y-0 left-0', style.fill)}
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="text-small text-ink-soft w-10 text-right font-mono">
                      {percent}%
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <section aria-labelledby="next-heading" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-ink-faint">Picked for you</p>
              <h2 id="next-heading" className="text-title">
                Problems to try next
              </h2>
            </div>
            {upNext.length === 0 ? (
              <p className="text-body text-ink-soft">
                Every problem is solved. Review your weakest track.
              </p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {upNext.map((problem, index) => (
                  <li key={problem.slug}>
                    <Link
                      href={`/de/problems/${problem.slug}`}
                      className="bg-surface border-line rounded-card shadow-card hover:border-line-strong flex items-start gap-3 border p-4 transition-colors"
                    >
                      <span className="bg-sunken rounded-box text-micro text-ink-soft mt-0.5 inline-grid size-6 shrink-0 place-items-center font-mono">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="text-body font-semibold">{problem.title}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          <DifficultyTag difficulty={problem.difficulty} />
                          <span className="text-small text-ink-faint">
                            {getTrack(problem.track)?.title}
                          </span>
                        </span>
                      </span>
                      <Icon name="arrow-right" className="text-ink-faint mt-3 size-4" />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section
            aria-labelledby="milestone-heading"
            className="bg-night rounded-card text-on-night flex flex-col gap-3 p-6"
          >
            <p className="eyebrow text-on-night-soft">Weekly milestone</p>
            <h2 id="milestone-heading" className="text-heading">
              Finish {WEEKLY_GOAL} problems this week
            </h2>
            <p className="text-small text-on-night-soft">
              {weekly} of {WEEKLY_GOAL} done
              {weeklyLeft > 0
                ? ` — ${weeklyLeft === 1 ? 'one more' : `${weeklyLeft} more`} to hit your goal.`
                : ' — goal reached. Nice work.'}
            </p>
            <div
              role="progressbar"
              aria-label="Weekly problems"
              aria-valuemin={0}
              aria-valuemax={WEEKLY_GOAL}
              aria-valuenow={weekly}
              className="bg-night-line rounded-pill mt-1 h-1.5 overflow-hidden"
            >
              <div
                className="bg-milestone rounded-pill h-full"
                style={{ width: `${(weekly / WEEKLY_GOAL) * 100}%` }}
              />
            </div>
            <div className="text-micro text-on-night-soft flex justify-between font-mono">
              <span>
                {weekly} / {WEEKLY_GOAL}
              </span>
              <span>resets Monday</span>
            </div>
          </section>

          <section
            aria-labelledby="recent-heading"
            className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-6"
          >
            <h2 id="recent-heading" className="eyebrow text-ink-faint">
              Recent activity
            </h2>
            {summary.recent.length === 0 ? (
              <p className="text-small text-ink-soft">
                Nothing yet. Finish a lesson or solve a problem and it shows here.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {summary.recent.map((item) => (
                  <li key={item.id} className="text-small flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        item.kind === 'problem' ? 'bg-easy-bar' : 'bg-gold',
                      )}
                    />
                    <Link href={item.href} className="min-w-0 flex-1 hover:underline">
                      {item.kind === 'problem' ? 'Solved ' : 'Finished lesson '}
                      <span className="font-semibold">{item.title}</span>
                    </Link>
                    <span className="text-ink-faint shrink-0 font-mono">
                      {agoLabel(item.daysAgo)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
