import Link from 'next/link';

import { DifficultyTag } from '@/components/course/DifficultyTag';
import { QuickChecks } from '@/components/course/QuickChecks';
import { TrackCard } from '@/components/course/TrackCard';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Face } from '@/components/ui/Face';
import {
  COMPANIES,
  getTrack,
  KIND_LABELS,
  PROBLEMS,
  problemsForTrack,
  TRACKS,
} from '@/lib/course/catalog';
import type { QuickCheck } from '@/types/course';

export interface LandingProps {
  /** Where the sign-in button goes. */
  signInHref: string;
}

/** A real question from the SQL track, so the first screen shows the product working. */
const SAMPLE: QuickCheck = TRACKS.find((track) => track.slug === 'sql')?.lessons[0]?.checks[0] ?? {
  question: 'Which function gives tied rows the same rank and leaves gaps after them?',
  options: ['ROW_NUMBER', 'RANK', 'DENSE_RANK'],
  answer: 1,
  why: 'RANK keeps ties and skips the following positions.',
};

/**
 * The signed-out home page. It shows the course itself: a live question in
 * the hero, the tracks, the loops it prepares for and a slice of the problem
 * list. Every count comes from the catalogue.
 */
export function Landing({ signInHref }: LandingProps) {
  const lessonCount = TRACKS.reduce((sum, track) => sum + track.lessons.length, 0);
  const preview = ['medium', 'hard', 'easy', 'medium', 'hard', 'medium'].flatMap(
    (difficulty, index) => {
      const pool = PROBLEMS.filter((problem) => problem.difficulty === difficulty);
      const pick = pool[index % Math.max(pool.length, 1)];
      return pick === undefined ? [] : [pick];
    },
  );
  const uniquePreview = preview.filter(
    (problem, index) => preview.findIndex((other) => other.slug === problem.slug) === index,
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-5 py-10 sm:gap-24 sm:px-8 sm:py-16">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <header className="flex flex-col gap-5">
          <span className="bg-brand-soft border-line shadow-mochi-lg inline-grid size-20 place-items-center rounded-full border-2">
            <Face size={64} blink label="The course mascot" />
          </span>
          <h1 className="text-hero">Pass the senior data engineer loop</h1>
          <p className="text-ink-soft max-w-prose">
            Short lessons, real interview problems and round-by-round guides, built around how Uber
            and Google interview senior data engineers. Sign in once and your progress, streak and
            XP follow you to your phone and your laptop.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={signInHref} className={buttonStyles({ size: 'lg' })}>
              Start learning
            </Link>
            <a href="#tracks" className={buttonStyles({ variant: 'quiet' })}>
              See the tracks
            </a>
          </div>
          <dl className="grid max-w-md grid-cols-3 gap-3">
            {[
              { label: 'Tracks', value: TRACKS.length },
              { label: 'Lessons', value: lessonCount },
              { label: 'Problems', value: PROBLEMS.length },
            ].map((fact) => (
              <div key={fact.label} className="bg-surface border-line rounded-input border-2 p-3">
                <dt className="text-small text-ink-soft">{fact.label}</dt>
                <dd className="text-heading font-display">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <Card tone="brand-soft" className="flex flex-col gap-4">
          <h2 className="text-heading">Try a question</h2>
          <p className="text-small">
            From the SQL track. Pick an answer; a wrong pick shows you why.
          </p>
          <QuickChecks checks={[SAMPLE]} />
        </Card>
      </div>

      <section id="tracks" aria-labelledby="tracks-heading" className="flex flex-col gap-6">
        <div className="flex max-w-prose flex-col gap-2">
          <h2 id="tracks-heading" className="text-title">
            {TRACKS.length} tracks, one senior bar
          </h2>
          <p className="text-ink-soft">
            From SQL fluency to staff-level system design. Every lesson ends with checks you must
            pass, and every track ends with interview problems.
          </p>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((track, index) => (
            <li key={track.slug}>
              <TrackCard
                href={`/tracks/${track.slug}`}
                title={track.title}
                summary={track.summary}
                tone={track.tone}
                eyebrow={`Track ${index + 1}`}
                lessons={track.lessons.length}
                problems={problemsForTrack(track.slug).length}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="loops-heading" className="grid gap-6 lg:grid-cols-5 lg:gap-12">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <h2 id="loops-heading" className="text-title">
            Built around two loops
          </h2>
          <p className="text-ink-soft max-w-prose">
            Each guide walks the rounds in order, says what each one tests, and links the tracks
            that prepare you. Your readiness score for each company grows as you finish them.
          </p>
        </div>
        <ul className="flex flex-col gap-4 lg:col-span-3">
          {COMPANIES.map((company) => (
            <li key={company.slug}>
              <Card className="flex flex-col gap-3">
                <h3 className="text-heading font-display">{company.name}</h3>
                <p className="text-small text-ink-soft">{company.summary}</p>
                <ol className="flex flex-wrap gap-2">
                  {company.rounds.map((round) => (
                    <li
                      key={round.name}
                      className="bg-sunken rounded-pill px-3 py-1 text-small font-medium"
                    >
                      {round.name}
                    </li>
                  ))}
                </ol>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="problems-heading" className="flex flex-col gap-6">
        <div className="flex max-w-prose flex-col gap-2">
          <h2 id="problems-heading" className="text-title">
            Problems the way interviewers ask them
          </h2>
          <p className="text-ink-soft">
            Draft your answer, take hints one at a time, then compare with a model answer and the
            signals that separate senior from mid-level.
          </p>
        </div>
        <ul className="border-line bg-surface rounded-card overflow-hidden border-2">
          {uniquePreview.map((problem, index) => (
            <li
              key={problem.slug}
              className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                index > 0 ? 'border-line border-t-2' : ''
              }`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-bold break-words">{problem.title}</span>
                <span className="text-small text-ink-soft">
                  {getTrack(problem.track)?.title}, {KIND_LABELS[problem.kind]}
                </span>
              </span>
              <DifficultyTag
                difficulty={problem.difficulty}
                className="self-start sm:self-center"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="border-line bg-butter shadow-mochi rounded-sheet flex flex-col items-start gap-4 border-2 p-6 sm:p-10">
        <h2 className="text-title">Your first lesson takes fifteen minutes</h2>
        <p className="max-w-prose">
          Sign in with Google to save your progress. The course is free to use.
        </p>
        <Link href={signInHref} className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
          Sign in and start
        </Link>
      </section>
    </main>
  );
}
