import Link from 'next/link';

import { ActivityGrid } from '@/components/course/ActivityGrid';
import { DifficultyTag } from '@/components/course/DifficultyTag';
import { ProgressRing } from '@/components/course/ProgressRing';
import { Avatar } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import {
  COMPANIES,
  DIFFICULTY_LABELS,
  getTrack,
  nextLesson,
  PROBLEMS,
  readiness,
  solvedByDifficulty,
  totalXp,
  trackProgress,
  TRACKS,
} from '@/lib/course/catalog';
import {
  bestStreak,
  levelFor,
  problemId,
  type ProgressRecord,
  streak,
} from '@/lib/course/progress';
import type { Difficulty } from '@/types/course';

export interface DashboardProps {
  name: string;
  progress: ProgressRecord;
  /** `YYYY-MM-DD`. Passed in so the page and its tests agree on the day. */
  today: string;
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * The signed-in home: where you are, what to do next, and how close you are
 * to each loop. Every number comes from the learner's record and the
 * catalogue. Nothing here is decoration pretending to be data.
 */
export function Dashboard({ name, progress, today }: DashboardProps) {
  const xp = totalXp(progress.done);
  const level = levelFor(xp);
  const current = streak(progress.days, today);
  const best = bestStreak(progress.days);
  const next = nextLesson(progress.done);
  const solved = solvedByDifficulty(progress.done);
  const solvedTotal = DIFFICULTIES.reduce((sum, key) => sum + solved[key].done, 0);
  const firstName = name.split(' ')[0] ?? name;

  const upNext = PROBLEMS.filter((problem) => progress.done[problemId(problem.slug)] === undefined)
    .sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty))
    .slice(0, 4);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-5 py-8 sm:px-8 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <Card peek={<Avatar name={name} size="lg" />} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-title">Hi, {firstName}</h1>
            <p className="text-small text-ink-soft">
              Level {level.number}: {level.title}
            </p>
          </div>
          <Progress
            label="XP to the next level"
            value={level.to === null ? 1 : xp - level.from}
            max={level.to === null ? 1 : level.to - level.from}
            valueText={level.to === null ? `${xp} XP, top level` : `${xp} of ${level.to} XP`}
          />
          <dl className="grid grid-cols-2 gap-3">
            <div className="bg-sunken rounded-input flex flex-col gap-1 p-3">
              <dt className="text-small text-ink-soft">Streak</dt>
              <dd className="font-display text-heading">
                {current} {current === 1 ? 'day' : 'days'}
              </dd>
            </div>
            <div className="bg-sunken rounded-input flex flex-col gap-1 p-3">
              <dt className="text-small text-ink-soft">Best streak</dt>
              <dd className="font-display text-heading">
                {best} {best === 1 ? 'day' : 'days'}
              </dd>
            </div>
          </dl>
          {next !== undefined ? (
            <Link
              href={`/tracks/${next.track.slug}/${next.lesson.slug}`}
              className={buttonStyles({ block: true })}
            >
              Continue: {next.lesson.title}
            </Link>
          ) : (
            <p className="font-bold">Every lesson is finished. Keep solving problems.</p>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-heading">Problems solved</h2>
          <div className="flex items-center gap-5">
            <ProgressRing
              ratio={PROBLEMS.length === 0 ? 0 : solvedTotal / PROBLEMS.length}
              label="Problems solved"
              size={104}
            >
              <span className="flex flex-col items-center gap-1">
                <span className="text-heading">{solvedTotal}</span>
                <span className="text-small font-sans">of {PROBLEMS.length}</span>
              </span>
            </ProgressRing>
            <ul className="flex min-w-0 grow flex-col gap-3">
              {DIFFICULTIES.map((difficulty) => (
                <li key={difficulty} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <DifficultyTag difficulty={difficulty} />
                    <span className="text-small font-bold">
                      {solved[difficulty].done}/{solved[difficulty].total}
                    </span>
                  </div>
                  <span className="sr-only">
                    {DIFFICULTY_LABELS[difficulty]}: {solved[difficulty].done} of{' '}
                    {solved[difficulty].total} solved.
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Link href="/problems" className={buttonStyles({ variant: 'secondary', block: true })}>
            Open the problem list
          </Link>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-heading">Study calendar</h2>
          <ActivityGrid days={progress.days} today={today} />
        </Card>
      </div>

      <section aria-labelledby="ready-heading" className="flex flex-col gap-4">
        <h2 id="ready-heading" className="text-title">
          Loop readiness
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2">
          {COMPANIES.map((company) => (
            <li key={company.slug}>
              <Link
                href={`/companies/${company.slug}`}
                className="squish border-line bg-surface shadow-mochi rounded-card flex h-full items-center gap-5 border-2 p-5"
              >
                <ProgressRing
                  ratio={readiness(company, progress.done)}
                  label={`${company.name} readiness`}
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-heading font-display">{company.name}</span>
                  <span className="text-small text-ink-soft">{company.summary}</span>
                  <span className="text-small font-bold">Read the loop guide</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-10 lg:grid-cols-5 lg:gap-12">
        <section aria-labelledby="tracks-heading" className="flex flex-col gap-4 lg:col-span-3">
          <h2 id="tracks-heading" className="text-title">
            Your tracks
          </h2>
          <ul className="border-line bg-surface rounded-card overflow-hidden border-2">
            {TRACKS.map((track, index) => {
              const stats = trackProgress(track, progress.done);
              return (
                <li key={track.slug} className={index > 0 ? 'border-line border-t-2' : undefined}>
                  <Link
                    href={`/tracks/${track.slug}`}
                    className="press flex flex-col gap-2 px-4 py-3"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-bold break-words">{track.title}</span>
                      <span className="text-small text-ink-soft shrink-0">
                        {Math.round(stats.ratio * 100)}%
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="bg-sunken border-line rounded-pill block h-3 overflow-hidden border-2"
                    >
                      <span
                        className="bg-brand block h-full origin-left"
                        style={{ transform: `scaleX(${stats.ratio})` }}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="next-heading" className="flex flex-col gap-4 lg:col-span-2">
          <h2 id="next-heading" className="text-title">
            Problems to try next
          </h2>
          {upNext.length === 0 ? (
            <p>You solved every problem. Time for a mock loop with a friend.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {upNext.map((problem) => (
                <li key={problem.slug}>
                  <Link
                    href={`/problems/${problem.slug}`}
                    className="squish border-line bg-surface shadow-mochi-sm rounded-card flex flex-col gap-2 border-2 p-4"
                  >
                    <span className="font-bold break-words">{problem.title}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <DifficultyTag difficulty={problem.difficulty} />
                      <span className="text-small text-ink-soft">
                        {getTrack(problem.track)?.title}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
