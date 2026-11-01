import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProblemTable } from '@/components/course/ProblemTable';
import { ProgressRing } from '@/components/course/ProgressRing';
import { AppBar } from '@/components/layout/AppBar';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  getTrack,
  KIND_LABELS,
  problemsForTrack,
  trackProgress,
  TRACKS,
} from '@/lib/course/catalog';
import { lessonId, problemId } from '@/lib/course/progress';
import { cn } from '@/lib/utils';
import { requireLearner } from '@/services/learner.service';

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

  const { progress } = await requireLearner(`/tracks/${slug}`);
  const stats = trackProgress(track, progress.done);
  const problems = problemsForTrack(slug);
  const firstOpen =
    track.lessons.find((lesson) => progress.done[lessonId(slug, lesson.slug)] === undefined) ??
    track.lessons[0];

  return (
    <>
      <AppBar title={track.title} back={{ fallbackHref: '/tracks', label: 'Back to tracks' }} />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-3 lg:items-start lg:gap-12">
        <Card tone={track.tone} className="flex flex-col gap-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-4">
            <ProgressRing ratio={stats.ratio} label={`${track.title} progress`} />
            <div className="flex flex-col gap-1 text-small">
              <span>
                <b>{stats.lessonsDone}</b> of {stats.lessonsTotal} lessons
              </span>
              <span>
                <b>{stats.problemsDone}</b> of {stats.problemsTotal} problems
              </span>
            </div>
          </div>
          <p>{track.why}</p>
          {firstOpen !== undefined ? (
            <Link
              href={`/tracks/${slug}/${firstOpen.slug}`}
              className={buttonStyles({ block: true })}
            >
              {stats.lessonsDone === 0 ? 'Start the track' : 'Continue the track'}
            </Link>
          ) : null}
        </Card>

        <div className="flex min-w-0 flex-col gap-10 lg:col-span-2">
          <section aria-labelledby="lessons-heading" className="flex flex-col gap-4">
            <h2 id="lessons-heading" className="text-title">
              Lessons
            </h2>
            <ol className="flex flex-col gap-3">
              {track.lessons.map((lesson, index) => {
                const done = progress.done[lessonId(slug, lesson.slug)] !== undefined;
                return (
                  <li key={lesson.slug}>
                    <Link
                      href={`/tracks/${slug}/${lesson.slug}`}
                      className="squish border-line bg-surface shadow-mochi-sm rounded-card flex items-center gap-4 border-2 p-4"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'border-line font-display inline-grid size-10 shrink-0 place-items-center rounded-full border-2',
                          done ? 'bg-success' : 'bg-sunken',
                        )}
                      >
                        {done ? '✓' : index + 1}
                      </span>
                      <span className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="font-bold break-words">{lesson.title}</span>
                        <span className="text-small text-ink-soft">{lesson.summary}</span>
                      </span>
                      <span className="text-small text-ink-soft hidden shrink-0 sm:block">
                        {lesson.minutes} min
                      </span>
                      <span className="sr-only">{done ? 'Finished.' : 'Not finished.'}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="problems-heading" className="flex flex-col gap-4">
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
    </>
  );
}
