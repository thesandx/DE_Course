import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LessonFinish } from '@/components/course/LessonFinish';
import { Prose } from '@/components/course/Prose';
import { AppBar } from '@/components/layout/AppBar';
import { buttonStyles } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { getLesson } from '@/lib/course/catalog';
import { LESSON_XP, lessonId } from '@/lib/course/progress';
import { cn } from '@/lib/utils';
import { requireLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ track: string; lesson: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { track, lesson } = await params;
  const found = getLesson(track, lesson);
  return found === undefined
    ? { title: 'Lesson not found', description: 'This lesson does not exist.' }
    : { title: found.lesson.title, description: found.lesson.summary };
}

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: Props) {
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const found = getLesson(trackSlug, lessonSlug);
  if (found === undefined) notFound();
  const { track, lesson, index } = found;

  const { progress } = await requireLearner(`/tracks/${trackSlug}/${lessonSlug}`);
  const itemId = lessonId(trackSlug, lessonSlug);
  const done = progress.done[itemId] !== undefined;
  const previous = track.lessons[index - 1];
  const next = track.lessons[index + 1];
  const finished = track.lessons.filter(
    (item) => progress.done[lessonId(trackSlug, item.slug)] !== undefined,
  ).length;

  return (
    <>
      <AppBar
        title={lesson.title}
        back={{ fallbackHref: `/tracks/${trackSlug}`, label: `Back to ${track.title}` }}
      />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-3 lg:items-start lg:gap-12">
        <article className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          <header className="flex flex-col gap-3">
            <p className="text-small text-ink-soft">
              {track.title}, lesson {index + 1} of {track.lessons.length}. About {lesson.minutes}{' '}
              minutes.
            </p>
            <p className="text-heading max-w-prose">{lesson.summary}</p>
          </header>

          <Prose source={lesson.body} />

          <LessonFinish itemId={itemId} checks={lesson.checks} done={done} xp={LESSON_XP} />

          <nav aria-label="Lessons" className="flex flex-wrap justify-between gap-3">
            {previous !== undefined ? (
              <Link
                href={`/tracks/${trackSlug}/${previous.slug}`}
                className={buttonStyles({ variant: 'quiet' })}
              >
                Previous: {previous.title}
              </Link>
            ) : (
              <span />
            )}
            {next !== undefined ? (
              <Link
                href={`/tracks/${trackSlug}/${next.slug}`}
                className={buttonStyles({ variant: 'secondary' })}
              >
                Next: {next.title}
              </Link>
            ) : (
              <Link
                href={`/tracks/${trackSlug}`}
                className={buttonStyles({ variant: 'secondary' })}
              >
                Practise the track problems
              </Link>
            )}
          </nav>
        </article>

        <aside
          className="flex flex-col gap-4 lg:sticky lg:top-24"
          aria-labelledby="outline-heading"
        >
          <h2 id="outline-heading" className="text-heading">
            In this track
          </h2>
          <Progress
            label="Lessons finished"
            value={finished}
            max={track.lessons.length}
            valueText={`${finished} of ${track.lessons.length}`}
          />
          <ol className="flex flex-col gap-2">
            {track.lessons.map((item, itemIndex) => {
              const itemDone = progress.done[lessonId(trackSlug, item.slug)] !== undefined;
              const current = item.slug === lessonSlug;
              return (
                <li key={item.slug}>
                  <Link
                    href={`/tracks/${trackSlug}/${item.slug}`}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'press border-line rounded-input flex min-h-12 items-center gap-3 border-2 px-3 py-2 text-small',
                      current ? 'bg-brand-soft font-bold' : 'bg-surface',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'border-line inline-grid size-7 shrink-0 place-items-center rounded-full border-2',
                        itemDone ? 'bg-success' : 'bg-sunken',
                      )}
                    >
                      {itemDone ? '✓' : itemIndex + 1}
                    </span>
                    <span className="min-w-0 break-words">{item.title}</span>
                    <span className="sr-only">{itemDone ? ' Finished.' : ''}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </main>
    </>
  );
}
