import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LessonFinish } from '@/components/course/LessonFinish';
import { Prose } from '@/components/course/Prose';
import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { getLesson } from '@/lib/course/catalog';
import { LESSON_XP, lessonId } from '@/lib/course/progress';
import { trackNumber } from '@/lib/course/track-style';
import { cn } from '@/lib/utils';
import { requireDeLearner } from '@/services/learner.service';

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

/**
 * One lesson. The reading column holds a dark hero, the body as numbered
 * section cards, the checks and the finish card. From `lg` an aside follows
 * the reader: the lessons in this track, previous and next, the next
 * milestone and a short note on how to use the page.
 */
export default async function LessonPage({ params }: Props) {
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const found = getLesson(trackSlug, lessonSlug);
  if (found === undefined) notFound();
  const { track, lesson, index } = found;

  const { progress, shell } = await requireDeLearner(`/de/tracks/${trackSlug}/${lessonSlug}`);
  const itemId = lessonId(trackSlug, lessonSlug);
  const done = progress.done[itemId] !== undefined;
  const previous = track.lessons[index - 1];
  const next = track.lessons[index + 1];
  const isDone = (slug: string): boolean => progress.done[lessonId(trackSlug, slug)] !== undefined;
  const finished = track.lessons.filter((item) => isDone(item.slug)).length;
  const left = track.lessons.length - finished;
  const lessonHref = (slug: string): string => `/de/tracks/${trackSlug}/${slug}`;

  const stats = [
    { label: 'Duration', value: `${lesson.minutes} min` },
    { label: 'Reward', value: `+${LESSON_XP} XP` },
    { label: 'Checks', value: String(lesson.checks.length) },
    { label: 'Progress in track', value: `${finished} / ${track.lessons.length}` },
  ];

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'DE course', href: '/de' },
        { label: 'Tracks', href: '/de/tracks' },
        { label: track.title, href: `/de/tracks/${trackSlug}` },
        { label: lesson.title },
      ]}
      back={{ fallbackHref: `/de/tracks/${trackSlug}`, label: `Back to ${track.title}` }}
    >
      <main className="flex w-full flex-col">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-8 md:py-8 lg:grid-cols-12 lg:items-start lg:gap-8">
          <article className="flex min-w-0 flex-col gap-4 lg:col-span-8">
            <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-4 p-6 sm:p-8">
              <p className="bg-gold-deep text-night rounded-pill eyebrow w-fit px-3 py-1">
                Lesson {index + 1} · Track {trackNumber(trackSlug)}
              </p>
              <h1 className="text-display">{lesson.title}</h1>
              <p className="text-lead text-on-night-soft max-w-2xl">{lesson.summary}</p>
              <dl className="border-night-line mt-2 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-0.5">
                    <dt className="eyebrow text-on-night-soft">{stat.label}</dt>
                    <dd className="font-display text-heading font-semibold">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </header>

            <Prose source={lesson.body} sectioned />

            <LessonFinish
              itemId={itemId}
              checks={lesson.checks}
              done={done}
              xp={LESSON_XP}
              {...(previous !== undefined
                ? {
                    previous: (
                      <Link
                        href={lessonHref(previous.slug)}
                        className={buttonStyles({ variant: 'secondary', size: 'lg' })}
                      >
                        <Icon name="arrow-left" className="size-4" />
                        Previous
                      </Link>
                    ),
                  }
                : {})}
            />

            {/* Phone: the way on, since the aside sits below the lesson. */}
            <nav aria-label="Next lesson" className="lg:hidden">
              <Link
                href={next !== undefined ? lessonHref(next.slug) : `/de/tracks/${trackSlug}`}
                className={cn(buttonStyles({ variant: 'dark', size: 'lg' }), 'w-full')}
              >
                {next !== undefined ? `Next: ${next.title}` : 'Practise the track problems'}
                <Icon name="arrow-right" className="size-4" />
              </Link>
            </nav>
          </article>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:col-span-4">
            <section
              aria-labelledby="outline-heading"
              className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="outline-heading" className="text-heading">
                  In this track
                </h2>
                <span className="text-small text-ink-faint font-mono">
                  {finished}/{track.lessons.length}
                </span>
              </div>
              <ol className="flex flex-col gap-1">
                {track.lessons.map((item, itemIndex) => {
                  const itemDone = isDone(item.slug);
                  const current = item.slug === lessonSlug;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={lessonHref(item.slug)}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          'rounded-input text-small flex min-h-11 items-center gap-3 px-2.5 py-2 transition-colors',
                          current
                            ? 'bg-brand-soft text-brand-deep font-semibold'
                            : 'hover:bg-sunken',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'text-micro inline-grid size-6 shrink-0 place-items-center rounded-full font-mono font-semibold',
                            itemDone && 'bg-easy-bar text-on-night',
                            !itemDone && current && 'bg-brand text-on-night',
                            !itemDone && !current && 'border-line-strong text-ink-faint border',
                          )}
                        >
                          {itemDone ? <Icon name="check" className="size-3.5" /> : itemIndex + 1}
                        </span>
                        <span className="min-w-0 flex-1 break-words">{item.title}</span>
                        <span className="text-micro text-ink-faint shrink-0 font-mono">
                          {item.minutes}m
                        </span>
                        <span className="sr-only">{itemDone ? ' Finished.' : ''}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>

            <nav aria-label="Lessons" className="hidden grid-cols-2 gap-2 lg:grid">
              {previous !== undefined ? (
                <Link
                  href={lessonHref(previous.slug)}
                  className={buttonStyles({ variant: 'secondary' })}
                >
                  <Icon name="arrow-left" className="size-4" />
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <Link
                href={next !== undefined ? lessonHref(next.slug) : `/de/tracks/${trackSlug}`}
                className={buttonStyles({ variant: 'dark' })}
              >
                {next !== undefined ? 'Next lesson' : 'Problems'}
                <Icon name="arrow-right" className="size-4" />
              </Link>
            </nav>

            <section className="bg-sun rounded-card text-gold-ink flex flex-col gap-1 p-5">
              <p className="eyebrow">
                Next milestone{left > 0 ? ` · +${left * LESSON_XP} XP` : ''}
              </p>
              <p className="text-heading font-display font-semibold">
                {left === 0 ? 'Track lessons finished' : `Finish ${track.title}`}
              </p>
              <p className="text-small">
                {left === 0
                  ? 'Every lesson here is done. The track problems are next.'
                  : `${left} ${left === 1 ? 'lesson' : 'lessons'} to go in this track.`}
              </p>
            </section>

            <section className="bg-surface border-line rounded-card flex flex-col gap-2 border p-5">
              <h2 className="text-heading">How to use this lesson</h2>
              <ol className="text-small text-ink-soft flex list-decimal flex-col gap-1.5 pl-5">
                <li>Read one section at a time. Say the idea out loud before you move on.</li>
                <li>Treat each senior signal as a line you could say in the interview.</li>
                <li>Answer the checks. A wrong pick costs nothing and shows why.</li>
              </ol>
            </section>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
