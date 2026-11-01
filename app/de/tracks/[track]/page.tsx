import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProblemTable } from '@/components/course/ProblemTable';
import { ProgressRing } from '@/components/course/ProgressRing';
import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import {
  getTrack,
  KIND_LABELS,
  problemsForTrack,
  trackProgress,
  TRACKS,
} from '@/lib/course/catalog';
import { lessonId, problemId } from '@/lib/course/progress';
import { trackNumber, trackStyle } from '@/lib/course/track-style';
import { cn } from '@/lib/utils';
import { requireDeLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ track: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const track = getTrack((await params).track);
  return track === undefined
    ? { title: 'Track not found', description: 'This track does not exist.' }
    : { title: track.title, description: track.summary };
}

export const dynamic = 'force-dynamic';

export default async function TrackPage({ params }: Props) {
  const { track: slug } = await params;
  const track = getTrack(slug);
  if (track === undefined) notFound();

  const { progress, shell } = await requireDeLearner(`/de/tracks/${slug}`);
  const stats = trackProgress(track, progress.done);
  const problems = problemsForTrack(slug);
  const firstOpen =
    track.lessons.find((lesson) => progress.done[lessonId(slug, lesson.slug)] === undefined) ??
    track.lessons[0];

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('size-2.5 rounded-full', trackStyle(slug).fill)}
              />
              <span className="eyebrow text-on-night-soft">Track {trackNumber(slug)}</span>
            </p>
            <h1 className="text-display">{track.title}</h1>
            <p className="text-body text-on-night-soft max-w-2xl">{track.why}</p>
            {firstOpen !== undefined ? (
              <Link
                href={`/de/tracks/${slug}/${firstOpen.slug}`}
                className={cn(buttonStyles({ size: 'lg' }), 'mt-1 w-full sm:w-fit')}
              >
                {stats.lessonsDone === 0 ? 'Start the track' : 'Continue the track'}
                <Icon name="arrow-right" className="size-4" />
              </Link>
            ) : null}
          </div>
          <div className="flex items-center gap-4 md:flex-col md:items-end">
            <ProgressRing
              ratio={stats.ratio}
              label={`${track.title} progress`}
              size={96}
              thickness={9}
              tone="gold"
              surface="night"
            >
              <span className="text-title">{Math.round(stats.ratio * 100)}%</span>
            </ProgressRing>
            <dl className="text-small text-on-night-soft flex flex-col gap-0.5 md:text-right">
              <div>
                <dt className="sr-only">Lessons</dt>
                <dd>
                  <b className="text-on-night">{stats.lessonsDone}</b> of {stats.lessonsTotal}{' '}
                  lessons
                </dd>
              </div>
              <div>
                <dt className="sr-only">Problems</dt>
                <dd>
                  <b className="text-on-night">{stats.problemsDone}</b> of {stats.problemsTotal}{' '}
                  problems
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <section aria-labelledby="lessons-heading" className="flex flex-col gap-3 lg:col-span-7">
            <h2 id="lessons-heading" className="text-title">
              Lessons
            </h2>
            <ol className="flex flex-col gap-3">
              {track.lessons.map((lesson, index) => {
                const done = progress.done[lessonId(slug, lesson.slug)] !== undefined;
                return (
                  <li key={lesson.slug}>
                    <Link
                      href={`/de/tracks/${slug}/${lesson.slug}`}
                      className={cn(
                        'border-line bg-surface shadow-card hover:shadow-raised rounded-card flex items-center gap-4 border border-l-4 p-4 transition-shadow',
                        trackStyle(slug).rail,
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'text-small inline-grid size-9 shrink-0 place-items-center rounded-full font-mono font-semibold',
                          done ? 'bg-easy-bar text-on-night' : 'bg-sunken text-ink-soft',
                        )}
                      >
                        {done ? <Icon name="check" className="size-4" /> : index + 1}
                      </span>
                      <span className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="font-semibold break-words">{lesson.title}</span>
                        <span className="text-small text-ink-soft">{lesson.summary}</span>
                      </span>
                      <span className="text-micro text-ink-faint hidden shrink-0 font-mono sm:block">
                        {lesson.minutes} min
                      </span>
                      <span className="sr-only">{done ? 'Finished.' : 'Not finished.'}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>

          <section
            aria-labelledby="problems-heading"
            className="flex min-w-0 flex-col gap-3 lg:col-span-5"
          >
            <h2 id="problems-heading" className="text-title">
              Interview problems
            </h2>
            <ProblemTable
              compact
              tracks={TRACKS.map((item) => ({ slug: item.slug, title: item.title }))}
              rows={problems.map((problem) => ({
                slug: problem.slug,
                title: problem.title,
                trackSlug: problem.track,
                trackTitle: track.title,
                kindLabel: KIND_LABELS[problem.kind],
                difficulty: problem.difficulty,
                companies: problem.companies,
                done: progress.done[problemId(problem.slug)] !== undefined,
              }))}
            />
          </section>
        </div>
      </main>
    </AppShell>
  );
}
