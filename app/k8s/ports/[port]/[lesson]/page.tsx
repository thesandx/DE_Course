import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InlineText } from '@/components/course/InlineText';
import { Prose } from '@/components/course/Prose';
import { ConceptDiagram } from '@/components/gcp/ConceptDiagram';
import { LabMeter, LabProgress } from '@/components/gcp/LabProgress';
import { StationChecks } from '@/components/gcp/StationChecks';
import { K8sLabStepCard } from '@/components/k8s/LabStepCard';
import { ManifestFile } from '@/components/k8s/ManifestFile';
import { Simulator } from '@/components/k8s/sims/Simulator';
import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { ChapterNotes } from '@/components/notes/ChapterNotes';
import { buttonStyles } from '@/components/ui/Button';
import { hueStyle } from '@/lib/course/hue';
import { getLesson, lessonHref, lessonId, lessonXp, portCode } from '@/lib/course/k8s/catalog';
import { lessonDiagram } from '@/lib/course/k8s/diagrams';
import { LAB_ROOT, stepTick } from '@/lib/course/k8s/lab';
import { stripInline } from '@/lib/course/markdown';
import { env } from '@/lib/env';
import { noteKeys } from '@/lib/notes/targets';
import { cn } from '@/lib/utils';
import { requireK8sLearner } from '@/services/learner.service';
import { getNoteOrNull } from '@/services/notes.service';

interface Props {
  params: Promise<{ port: string; lesson: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { port, lesson } = await params;
  const found = getLesson(port, lesson);
  return found === undefined
    ? { title: 'Lesson not found', description: 'This lesson does not exist.' }
    : { title: found.lesson.title, description: stripInline(found.lesson.pain) };
}

export const dynamic = 'force-dynamic';

const CARD =
  'bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6';

/**
 * A lesson: the production problem, the Kubernetes object that fixes it, a
 * picture, the explanation, the files, then the lab on the learner's own
 * cluster. The lesson counts once every check at the end is right.
 */
export default async function K8sLessonPage({ params }: Props) {
  const { port: portSlug, lesson: lessonSlug } = await params;
  const found = getLesson(portSlug, lessonSlug);
  if (found === undefined) notFound();
  const { port, lesson, index } = found;

  const { user, progress, shell } = await requireK8sLearner(lessonHref(portSlug, lessonSlug));
  const noteKey = noteKeys.k8sLesson(portSlug, lessonSlug);
  const note = await getNoteOrNull(user.uid, noteKey);
  const itemId = lessonId(portSlug, lessonSlug);
  const done = progress.done[itemId] !== undefined;
  const previous = port.lessons[index - 1];
  const next = port.lessons[index + 1];
  const hue = hueStyle(port.hue);
  const diagram = lessonDiagram(portSlug, lessonSlug);
  const ticks = lesson.lab.map((_, stepIndex) => stepTick(stepIndex));
  const outline = [
    { href: '#story', label: 'The problem and the fix' },
    ...(diagram !== undefined ? [{ href: '#picture', label: 'The picture' }] : []),
    { href: '#explain', label: 'How it works' },
    ...(lesson.sim !== undefined ? [{ href: '#simulator', label: 'Simulator' }] : []),
    ...(lesson.files.length > 0 ? [{ href: '#files', label: 'The files' }] : []),
    ...(lesson.lab.length > 0 ? [{ href: '#lab', label: `Lab · ${lesson.lab.length} steps` }] : []),
    { href: '#checks', label: 'Quick check' },
  ];

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'Kubernetes course', href: '/k8s' },
        { label: portCode(port), href: `/k8s/ports/${portSlug}` },
        { label: lesson.title },
      ]}
      back={{ fallbackHref: `/k8s/ports/${portSlug}`, label: `Back to ${port.title}` }}
    >
      <LabProgress station={`k8s-${portSlug}-${lessonSlug}`}>
        <main className="flex w-full flex-col">
          <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-8 md:py-8 lg:grid-cols-12 lg:items-start lg:gap-8">
            <article className="flex min-w-0 flex-col gap-4 lg:col-span-8">
              <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-4 p-6 sm:p-8">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-pill eyebrow text-ink px-3 py-1', hue.fill)}>
                    {portCode(port)} · Lesson {index + 1}
                  </span>
                  <span className="eyebrow text-on-night-soft">{port.title}</span>
                </p>
                <h1 className="text-display break-words">{lesson.title}</h1>
                <dl className="border-night-line mt-1 grid grid-cols-3 gap-4 border-t pt-5">
                  {[
                    {
                      label: 'Lab',
                      value: lesson.lab.length > 0 ? `${lesson.lab.length} steps` : 'Reading',
                    },
                    { label: 'Checks', value: String(lesson.checks.length) },
                    { label: 'Reward', value: done ? 'Earned' : `+${lessonXp(lesson)} XP` },
                  ].map((stat) => (
                    <div key={stat.label} className="flex flex-col gap-0.5">
                      <dt className="eyebrow text-on-night-soft">{stat.label}</dt>
                      <dd className="font-display text-heading font-semibold">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </header>

              <section
                id="story"
                aria-label="The problem and the fix"
                className="grid scroll-mt-20 gap-4 md:grid-cols-2"
              >
                <div className="bg-hard-soft border-hard-bar rounded-card flex flex-col gap-2 border p-5">
                  <p className="eyebrow text-hard">The problem</p>
                  <p className="text-body">
                    <InlineText text={lesson.pain} />
                  </p>
                </div>
                <div className="bg-easy-soft border-easy-bar rounded-card flex flex-col gap-2 border p-5">
                  <p className="eyebrow text-easy">The fix</p>
                  <p className="text-body">
                    <InlineText text={lesson.fix} />
                  </p>
                </div>
              </section>

              {diagram !== undefined && (
                <section id="picture" aria-label="The picture" className={cn(CARD, 'scroll-mt-20')}>
                  <ConceptDiagram diagram={diagram} id="lesson-diagram" />
                </section>
              )}

              <section
                id="explain"
                aria-labelledby="explain-heading"
                className={cn(CARD, 'scroll-mt-20')}
              >
                <p className="eyebrow text-ink-faint">Explain</p>
                <h2 id="explain-heading" className="text-title">
                  How it works
                </h2>
                <Prose source={lesson.body} />
                {lesson.note !== undefined && (
                  <div className={cn('bg-sunken rounded-input border-l-4 p-4', hue.rail)}>
                    <p className="eyebrow text-ink-faint">Common wrong idea</p>
                    <p className="text-body pt-1">
                      <InlineText text={lesson.note} />
                    </p>
                  </div>
                )}
                {lesson.docker !== undefined && lesson.docker.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-heading">You know this from Docker</h3>
                    <dl className="border-line rounded-input divide-line divide-y border">
                      {lesson.docker.map(([docker, kubernetes]) => (
                        <div key={docker} className="grid gap-1 p-3 sm:grid-cols-2 sm:gap-4">
                          <dt className="text-small text-ink-soft">
                            <span className="eyebrow text-ink-faint block">Docker</span>
                            <InlineText text={docker} />
                          </dt>
                          <dd className="text-small">
                            <span className="eyebrow text-ink-faint block">Kubernetes</span>
                            <InlineText text={kubernetes} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </section>

              {lesson.sim !== undefined && (
                <div id="simulator" className="scroll-mt-20">
                  <Simulator id={lesson.sim} />
                </div>
              )}

              {lesson.files.length > 0 && (
                <section
                  id="files"
                  aria-labelledby="files-heading"
                  className={cn(CARD, 'scroll-mt-20')}
                >
                  <p className="eyebrow text-ink-faint">Read before you run</p>
                  <h2 id="files-heading" className="text-title">
                    The files
                  </h2>
                  <p className="text-small text-ink-soft">
                    The lab writes each file for you. Read the numbered notes first: they are the
                    lines that matter.
                  </p>
                  {lesson.files.map((file) => (
                    <ManifestFile key={file.name} file={file} />
                  ))}
                </section>
              )}

              {lesson.lab.length > 0 && (
                <section
                  id="lab"
                  aria-labelledby="lab-heading"
                  className="flex scroll-mt-20 flex-col gap-4 pt-2"
                >
                  <div className="flex flex-col gap-1">
                    <p className="eyebrow text-ink-faint">Hands-on lab</p>
                    <h2 id="lab-heading" className="text-title">
                      Do it on your cluster
                    </h2>
                    <p className="text-small text-ink-soft">
                      Run each step in your WSL terminal, in{' '}
                      <code className="font-mono">
                        {LAB_ROOT}/{port.dir}
                      </code>
                      . The ticks are kept in this browser.
                    </p>
                  </div>
                  <div className="lg:hidden">
                    <LabMeter ids={ticks} label="Lab steps done" />
                  </div>
                  <ol className="flex flex-col gap-4">
                    {lesson.lab.map((step, stepIndex) => (
                      <K8sLabStepCard
                        key={ticks[stepIndex]}
                        id={ticks[stepIndex] ?? stepTick(stepIndex)}
                        number={stepIndex + 1}
                        port={port}
                        lesson={lesson}
                        step={step}
                        fill={hue.fill}
                      />
                    ))}
                  </ol>
                </section>
              )}

              <ChapterNotes
                noteKey={noteKey}
                title={`${portCode(port)} · ${lesson.title}`}
                initial={note}
                pipEnabled={env.assistantEnabled}
              />

              <div id="checks" className="scroll-mt-20">
                <StationChecks
                  course="k8s"
                  unit="lesson"
                  heading="Quick check"
                  itemId={itemId}
                  checks={lesson.checks}
                  done={done}
                  xp={lessonXp(lesson)}
                  {...(previous !== undefined
                    ? {
                        previous: (
                          <Link
                            href={lessonHref(portSlug, previous.slug)}
                            className={buttonStyles({ variant: 'secondary', size: 'lg' })}
                          >
                            <Icon name="arrow-left" className="size-4" />
                            Previous
                          </Link>
                        ),
                      }
                    : {})}
                />
              </div>

              <nav aria-label="Next lesson">
                <Link
                  href={
                    next !== undefined
                      ? lessonHref(portSlug, next.slug)
                      : `/k8s/ports/${portSlug}/mission`
                  }
                  className={cn(buttonStyles({ variant: 'dark', size: 'lg' }), 'w-full')}
                >
                  <span className="truncate">
                    {next !== undefined
                      ? `Next lesson: ${next.title}`
                      : `Mission: ${port.mission.title}`}
                  </span>
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              </nav>
            </article>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:col-span-4">
              <section
                aria-labelledby="outline-heading"
                className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5"
              >
                <h2 id="outline-heading" className="text-heading">
                  In this lesson
                </h2>
                <ol className="flex flex-col gap-1">
                  {outline.map((item, itemIndex) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="text-small text-ink-soft hover:text-ink hover:bg-sunken rounded-input flex min-h-11 items-center gap-2 px-2"
                      >
                        <span className="text-ink-faint w-5 font-mono">{itemIndex + 1}</span>
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
                {lesson.lab.length > 0 && (
                  <div className="hidden lg:block">
                    <LabMeter ids={ticks} label="Lab steps done" />
                  </div>
                )}
              </section>
              <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5">
                <h2 className="text-heading">{port.title}</h2>
                <ol className="flex flex-col gap-1">
                  {port.lessons.map((item) => {
                    const itemDone = progress.done[lessonId(portSlug, item.slug)] !== undefined;
                    const current = item.slug === lesson.slug;
                    return (
                      <li key={item.slug}>
                        <Link
                          href={lessonHref(portSlug, item.slug)}
                          aria-current={current ? 'page' : undefined}
                          className={cn(
                            'text-small rounded-input flex min-h-11 items-center gap-2 px-2',
                            current
                              ? 'bg-sunken text-ink font-semibold'
                              : 'text-ink-soft hover:text-ink',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'inline-grid size-5 shrink-0 place-items-center rounded-full',
                              hue.fill,
                            )}
                          >
                            {itemDone ? (
                              <Icon name="check" className="size-3" />
                            ) : (
                              <span className="bg-surface size-2 rounded-full" />
                            )}
                          </span>
                          <span className="truncate">{item.title}</span>
                          {itemDone && <span className="sr-only"> (done)</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </aside>
          </div>
        </main>
      </LabProgress>
    </AppShell>
  );
}
