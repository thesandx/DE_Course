import Link from 'next/link';

import { DifficultyTag } from '@/components/course/DifficultyTag';
import { TryQuestion } from '@/components/course/TryQuestion';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { COMPANIES, getTrack, PROBLEMS, problemsForTrack, TRACKS } from '@/lib/course/catalog';
import { trackNumber, trackStyle } from '@/lib/course/track-style';
import { cn } from '@/lib/utils';
import type { Problem } from '@/types/course';

export interface LandingProps {
  /** Where the sign-in buttons go. */
  signInHref: string;
}

/** The dark card for each loop guide. Uber is violet, Google is navy. */
const LOOP_SURFACE: Record<string, string> = {
  uber: 'bg-night-violet',
  google: 'bg-night-glow',
};

/** One easy, a spread of medium and hard: the problem table's preview rows. */
function previewProblems() {
  const order = ['medium', 'hard', 'easy', 'medium', 'hard', 'medium'] as const;
  const picked: Problem[] = [];
  order.forEach((difficulty, index) => {
    const pool = PROBLEMS.filter(
      (problem) =>
        problem.difficulty === difficulty && !picked.some((other) => other.slug === problem.slug),
    );
    const pick = pool[(index * 5) % Math.max(pool.length, 1)];
    if (pick !== undefined) picked.push(pick);
  });
  return picked;
}

/** Sign in first, then land on the page that was asked for. */
function signInTo(path: string): string {
  return `/sign-in?next=${encodeURIComponent(path)}`;
}

/**
 * The signed-out home page. It shows the course itself: a sample design
 * question in the hero, the tracks, the two loops it prepares for and a slice
 * of the problem list. Every count comes from the catalogue.
 */
export function Landing({ signInHref }: LandingProps) {
  const lessonCount = TRACKS.reduce((sum, track) => sum + track.lessons.length, 0);
  const preview = previewProblems();
  const facts = [
    { label: 'Tracks', value: TRACKS.length, note: 'SQL to staff design' },
    { label: 'Lessons', value: lessonCount, note: 'with checks' },
    { label: 'Problems', value: PROBLEMS.length, note: 'with model answers' },
  ];

  return (
    <main className="flex w-full flex-col">
      {/* Hero */}
      <div className="bg-wash">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-8 pb-14 sm:px-8 md:pt-14 lg:grid-cols-12 lg:items-center lg:gap-12 lg:pb-20">
          <header className="flex flex-col gap-5 lg:col-span-6">
            <p className="bg-surface border-line rounded-pill text-small text-ink-soft inline-flex w-fit items-center gap-2 border py-1 pr-3 pl-2">
              <span className="bg-brand-soft text-brand-deep rounded-pill text-micro px-2 py-0.5 font-semibold">
                New
              </span>
              {TRACKS.length} tracks · Uber and Google loops
            </p>
            <h1 className="text-hero font-display leading-none font-semibold">
              Pass the <span className="text-gradient-brand">senior</span> data engineer loop
            </h1>
            <p className="text-lead text-ink-soft max-w-xl">
              Short lessons, real interview problems and round-by-round guides, built around how
              Uber and Google interview senior data engineers. Your progress, streak and XP follow
              you from your phone to your laptop.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={signInHref} className={buttonStyles({ size: 'lg' })}>
                Start learning
                <Icon name="arrow-right" className="size-4" />
              </Link>
              <a href="#tracks" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
                See the tracks
              </a>
            </div>
            <dl className="grid max-w-lg grid-cols-3 gap-2 sm:gap-3">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="bg-surface border-line rounded-card shadow-card flex flex-col gap-0.5 border p-3 sm:p-4"
                >
                  <dt className="text-small order-2 font-semibold">{fact.label}</dt>
                  <dd className="font-display text-key order-1 leading-none font-semibold">
                    {fact.value}
                  </dd>
                  <dd className="text-micro text-ink-faint order-3 hidden sm:block">{fact.note}</dd>
                </div>
              ))}
            </dl>
          </header>

          <div className="min-w-0 lg:col-span-6">
            <TryQuestion />
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <section
        id="tracks"
        aria-labelledby="tracks-heading"
        className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-6 px-4 py-12 sm:px-8 md:py-16"
      >
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-brand-deep">Curriculum</p>
          <h2 id="tracks-heading" className="text-display">
            {TRACKS.length} tracks, one senior bar
          </h2>
          <p className="text-ink-soft max-w-2xl">
            From SQL fluency to staff-level system design. Every lesson ends with checks, and every
            track ends with interview problems.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {TRACKS.map((track) => {
            const style = trackStyle(track.slug);
            return (
              <li key={track.slug}>
                <Link
                  href={signInTo(`/de/tracks/${track.slug}`)}
                  className={cn(
                    'bg-surface border-line rounded-card shadow-card hover:shadow-raised flex h-full flex-col gap-2 border border-t-4 p-4 transition-shadow sm:p-5',
                    style.edge,
                  )}
                >
                  <span className="eyebrow text-ink-faint">Track {trackNumber(track.slug)}</span>
                  <span className="text-body sm:text-heading font-semibold">{track.title}</span>
                  <span className="text-small text-ink-soft hidden sm:block">{track.summary}</span>
                  <span className="text-micro text-ink-faint mt-auto pt-1 font-mono">
                    {track.lessons.length} lessons · {problemsForTrack(track.slug).length} problems
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Loops */}
      <section
        aria-labelledby="loops-heading"
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-8 md:py-16"
      >
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-brand-deep">Company loops</p>
          <h2 id="loops-heading" className="text-display">
            Built around two loops
          </h2>
          <p className="text-ink-soft max-w-2xl">
            Each guide walks the rounds in order, says what each one tests, and links the tracks
            that prepare you. Your readiness for each company grows as you finish them.
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {COMPANIES.map((company) => {
            const minutes = company.rounds.reduce((sum, round) => sum + round.minutes, 0);
            return (
              <li
                key={company.slug}
                className={cn(
                  'rounded-sheet text-on-night flex flex-col gap-4 p-6 sm:p-8',
                  LOOP_SURFACE[company.slug] ?? 'bg-night',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-title">{company.name}</h3>
                  <span className="border-night-line text-micro text-on-night-soft rounded-pill border px-2.5 py-1 font-mono">
                    {company.rounds.length} rounds · ~{Math.round(minutes / 60)} h
                  </span>
                </div>
                <p className="text-body text-on-night-soft">{company.summary}</p>
                <ol className="flex flex-wrap gap-2" aria-label={`${company.name} rounds`}>
                  {company.rounds.map((round, index) => (
                    <li
                      key={round.name}
                      className="bg-night-raised/70 border-night-line rounded-pill text-small inline-flex items-center gap-2 border py-1 pr-3 pl-1"
                    >
                      <span className="bg-on-night text-night text-micro inline-grid size-5 place-items-center rounded-full font-semibold">
                        {index + 1}
                      </span>
                      {round.name}
                    </li>
                  ))}
                </ol>
                <Link
                  href={signInTo(`/de/companies/${company.slug}`)}
                  className={cn(buttonStyles({ variant: 'night' }), 'mt-auto w-fit')}
                >
                  Read the {company.name} loop guide
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Problems */}
      <section
        aria-labelledby="problems-heading"
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-8 md:py-16"
      >
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-brand-deep">Practice</p>
          <h2 id="problems-heading" className="text-display">
            Problems the way interviewers ask them
          </h2>
          <p className="text-ink-soft max-w-2xl">
            Draft your answer, take hints one at a time, then compare with a model answer and the
            signals that separate senior from mid-level.
          </p>
        </div>
        <div className="bg-surface border-line rounded-card shadow-card overflow-hidden border">
          <div className="border-line bg-sunken text-ink-faint eyebrow hidden grid-cols-12 gap-4 border-b px-5 py-3 md:grid">
            <span className="col-span-6">Problem</span>
            <span className="col-span-4">Track</span>
            <span className="col-span-2">Level</span>
          </div>
          <ul>
            {preview.map((problem, index) => (
              <li key={problem.slug} className={cn(index > 0 && 'border-line border-t')}>
                <Link
                  href={signInTo(`/de/problems/${problem.slug}`)}
                  className="hover:bg-sunken flex items-center gap-3 px-4 py-3.5 transition-colors md:grid md:grid-cols-12 md:gap-4 md:px-5"
                >
                  <span className="text-micro text-ink-faint self-start pt-1 font-mono md:hidden">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5 md:col-span-6 md:flex-row md:items-center md:gap-3">
                    <span className="text-micro text-ink-faint hidden font-mono md:inline">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-body font-semibold break-words">{problem.title}</span>
                    <span className="flex flex-wrap items-center gap-2 md:hidden">
                      <DifficultyTag difficulty={problem.difficulty} />
                      <span className="text-small text-ink-soft">
                        {getTrack(problem.track)?.title}
                      </span>
                    </span>
                  </span>
                  <span className="text-small text-ink-soft hidden md:col-span-4 md:block">
                    {getTrack(problem.track)?.title}
                  </span>
                  <span className="hidden items-center justify-between md:col-span-2 md:flex">
                    <DifficultyTag difficulty={problem.difficulty} />
                    <Icon name="arrow-right" className="text-ink-faint size-4" />
                  </span>
                  <Icon name="arrow-right" className="text-ink-faint size-4 md:hidden" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-4 pb-16 sm:px-8">
        <div className="bg-sun rounded-sheet text-gold-ink flex flex-col items-start gap-4 p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-display">Your first lesson takes fifteen minutes</h2>
            <p className="text-lead max-w-xl">
              Sign in with Google or your phone number to save your progress. The course is free.
            </p>
          </div>
          <Link
            href={signInHref}
            className={cn(buttonStyles({ variant: 'dark', size: 'lg' }), 'shrink-0')}
          >
            Sign in and start
            <Icon name="arrow-right" className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
