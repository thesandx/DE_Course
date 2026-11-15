import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CourseVideo } from '@/components/course/CourseVideo';
import { InlineText } from '@/components/course/InlineText';
import { ProgressRing } from '@/components/course/ProgressRing';
import { PortRoute } from '@/components/k8s/PortRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { hueStyle } from '@/lib/course/hue';
import {
  DRILL_PASS_RATIO,
  getPort,
  hasDrill,
  incidentsFor,
  lessonHref,
  lessonId,
  portCode,
  portProgress,
  PORTS,
} from '@/lib/course/k8s/catalog';
import { LAB_ROOT } from '@/lib/course/k8s/lab';
import { stripInline } from '@/lib/course/markdown';
import { courseVideo, videoCaptionsHref, videoPosterHref } from '@/lib/course/videos';
import { cn } from '@/lib/utils';
import { getCourseVideoUrl } from '@/services/course-video.service';
import { requireK8sLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ port: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const port = getPort((await params).port);
  return port === undefined
    ? { title: 'Port not found', description: 'This port does not exist.' }
    : { title: `${portCode(port)}: ${port.title}`, description: stripInline(port.story) };
}

export const dynamic = 'force-dynamic';

/** One port: the day at work that frames it, then its lessons, mission and incident drill. */
export default async function K8sPortPage({ params }: Props) {
  const { port: slug } = await params;
  const port = getPort(slug);
  if (port === undefined) notFound();

  const { progress, shell } = await requireK8sLearner(`/k8s/ports/${slug}`);
  // The film is optional: with no file in the bucket the URL is null, and the
  // page shows the port without a player.
  const video = courseVideo('k8s', slug);
  const videoUrl = video === undefined ? null : await getCourseVideoUrl('k8s', slug);
  const stats = portProgress(port, progress.done);
  const next = port.lessons.find(
    (lesson) => progress.done[lessonId(port.slug, lesson.slug)] === undefined,
  );
  const drill = hasDrill(port.slug);
  const incidents = incidentsFor(port.slug).length;
  const after = PORTS[PORTS.indexOf(port) + 1];
  const action =
    next !== undefined
      ? {
          href: lessonHref(port.slug, next.slug),
          label: `${stats.lessonsDone === 0 ? 'Start with' : 'Sail on to'} ${next.title}`,
        }
      : !stats.missionDone
        ? { href: `/k8s/ports/${slug}/mission`, label: 'Take the mission' }
        : drill && !stats.drillPassed
          ? { href: `/k8s/ports/${slug}/drill`, label: 'Answer the pager' }
          : after !== undefined
            ? { href: `/k8s/ports/${after.slug}`, label: `Next port: ${after.title}` }
            : { href: '/k8s/practice/exam', label: 'Sit the final exam' };

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('size-2.5 rounded-full', hueStyle(port.hue).fill)}
              />
              <span className="eyebrow text-on-night-soft">
                {portCode(port)} · {port.tag}
              </span>
            </p>
            <h1 className="text-display">{port.title}</h1>
            <p className="text-body text-on-night-soft max-w-2xl">
              <InlineText text={port.story} />
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href={action.href} className={buttonStyles({ className: 'max-w-full' })}>
                <span className="min-w-0 truncate">{action.label}</span>
                <Icon name="arrow-right" className="size-4 shrink-0" />
              </Link>
            </div>
          </div>
          <ProgressRing
            ratio={stats.ratio}
            label={`${port.title} progress`}
            size={112}
            thickness={10}
            tone="gold"
            surface="night"
            className="shrink-0"
          >
            <span className="flex flex-col items-center gap-0.5">
              <span className="text-title">
                {stats.lessonsDone}/{stats.lessonsTotal}
              </span>
              <span className="text-micro text-on-night-soft">lessons</span>
            </span>
          </ProgressRing>
        </header>

        {video !== undefined && videoUrl !== null && (
          <CourseVideo
            video={video}
            title="The port in one video"
            src={videoUrl}
            poster={videoPosterHref('k8s', slug)}
            captionsSrc={videoCaptionsHref('k8s', slug)}
          />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <section aria-labelledby="route-heading" className="flex flex-col gap-3 lg:col-span-8">
            <h2 id="route-heading" className="text-title">
              The route
            </h2>
            <PortRoute port={port} done={progress.done} nextSlug={next?.slug} />
          </section>
          <aside className="flex flex-col gap-4 lg:col-span-4">
            <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5">
              <p className="eyebrow text-ink-faint">Your files</p>
              <h2 className="text-heading font-mono break-words">
                {LAB_ROOT}/{port.dir}
              </h2>
              <p className="text-small text-ink-soft">
                Every lab at this port writes its files into this folder. Each step gives you the
                command that creates the file, so you never need to copy a file by hand.
              </p>
            </section>
            <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5">
              <p className="eyebrow text-ink-faint">Mission</p>
              <h2 className="text-heading">{port.mission.title}</h2>
              <p className="text-small text-ink-soft">
                <InlineText text={port.mission.brief} />
              </p>
            </section>
            {drill && (
              <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5">
                <p className="eyebrow text-ink-faint">Incident drill</p>
                <h2 className="text-heading">The pager goes off</h2>
                <p className="text-small text-ink-soft">
                  {`${incidents} real failures from this port. Read the terminal output and pick the cause. Get ${Math.ceil(incidents * DRILL_PASS_RATIO)} right to pass. It opens when every lesson is done.`}
                </p>
              </section>
            )}
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
