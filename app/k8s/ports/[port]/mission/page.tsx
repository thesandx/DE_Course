import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InlineText } from '@/components/course/InlineText';
import { CodeBlock } from '@/components/gcp/CodeBlock';
import { LabFinish, LabMeter, LabProgress, LabTick } from '@/components/gcp/LabProgress';
import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { hueStyle } from '@/lib/course/hue';
import {
  getPort,
  hasDrill,
  MISSION_XP,
  missionId,
  portCode,
  PORTS,
} from '@/lib/course/k8s/catalog';
import { LAB_ROOT, missionTicks } from '@/lib/course/k8s/lab';
import { stripInline } from '@/lib/course/markdown';
import { cn } from '@/lib/utils';
import { requireK8sLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ port: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const port = getPort((await params).port);
  return port === undefined
    ? { title: 'Mission not found', description: 'This mission does not exist.' }
    : {
        title: `Mission: ${port.mission.title}`,
        description: stripInline(port.mission.brief),
      };
}

export const dynamic = 'force-dynamic';

const CARD =
  'bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6';

/**
 * The mission of a port: tasks with no steps given, one worked solution kept
 * closed, then the cleanup. The mission counts once every task and the
 * cleanup are ticked.
 */
export default async function K8sMissionPage({ params }: Props) {
  const { port: slug } = await params;
  const port = getPort(slug);
  if (port === undefined) notFound();

  const { progress, shell } = await requireK8sLearner(`/k8s/ports/${slug}/mission`);
  const { mission } = port;
  const itemId = missionId(slug);
  const done = progress.done[itemId] !== undefined;
  const ticks = missionTicks(port);
  const hue = hueStyle(port.hue);
  const after = PORTS[PORTS.indexOf(port) + 1];
  const onward = hasDrill(slug)
    ? { href: `/k8s/ports/${slug}/drill`, label: 'Incident drill: the pager goes off' }
    : after !== undefined
      ? { href: `/k8s/ports/${after.slug}`, label: `Next port: ${after.title}` }
      : { href: '/k8s/practice/exam', label: 'Sit the final exam' };

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'Kubernetes course', href: '/k8s' },
        { label: portCode(port), href: `/k8s/ports/${slug}` },
        { label: 'Mission' },
      ]}
      back={{ fallbackHref: `/k8s/ports/${slug}`, label: `Back to ${port.title}` }}
    >
      <LabProgress station={`k8s-${slug}-mission`}>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-4 p-6 sm:p-8">
              <p className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-pill eyebrow text-ink px-3 py-1', hue.fill)}>
                  {portCode(port)} · Mission
                </span>
                <span className="eyebrow text-on-night-soft">
                  {done ? 'Done' : `+${MISSION_XP} XP`}
                </span>
              </p>
              <h1 className="text-display">{mission.title}</h1>
              <p className="text-body text-on-night-soft">
                <InlineText text={mission.brief} />
              </p>
              <p className="text-small text-on-night-soft">
                No steps this time. Use what the lessons of this port taught you, in{' '}
                <code className="font-mono">
                  {LAB_ROOT}/{port.dir}
                </code>
                .
              </p>
            </header>

            <section aria-labelledby="tasks-heading" className={CARD}>
              <div className="flex flex-col gap-1">
                <p className="eyebrow text-ink-faint">Your orders</p>
                <h2 id="tasks-heading" className="text-title">
                  Tasks
                </h2>
              </div>
              <LabMeter ids={[...ticks.tasks, ticks.cleanup]} label="Mission progress" />
              <ol className="flex flex-col gap-3">
                {mission.tasks.map((task, index) => (
                  <li
                    key={task}
                    className={cn('flex flex-col gap-1 border-l-4 py-1 pl-4', hue.rail)}
                  >
                    <p className="text-body">
                      <span className="text-ink-faint font-mono">{index + 1}. </span>
                      <InlineText text={task} />
                    </p>
                    <LabTick id={ticks.tasks[index] ?? `task-${index + 1}`} label="Done" />
                  </li>
                ))}
              </ol>
              {mission.hint !== undefined && (
                <details className="border-line rounded-input border">
                  <summary className="text-body hover:bg-sunken rounded-input flex min-h-11 cursor-pointer items-center px-4 font-semibold">
                    Show a hint
                  </summary>
                  <p className="text-body text-ink-soft px-4 pb-4">
                    <InlineText text={mission.hint} />
                  </p>
                </details>
              )}
              <details className="border-line rounded-input border">
                <summary className="text-body hover:bg-sunken rounded-input flex min-h-11 cursor-pointer items-center px-4 font-semibold">
                  Show one solution
                </summary>
                <div className="flex min-w-0 flex-col gap-2 p-3 pt-0">
                  <p className="text-small text-ink-soft px-1">
                    Try the tasks first. This is one way to do them, not the only way.
                  </p>
                  <CodeBlock label="Terminal" code={mission.solution} />
                </div>
              </details>
            </section>

            <section id="cleanup" aria-labelledby="cleanup-heading" className={CARD}>
              <div className="flex flex-col gap-1">
                <p className="eyebrow text-hard">Before you leave the port</p>
                <h2 id="cleanup-heading" className="text-title">
                  Clean up
                </h2>
                <p className="text-small text-ink-soft">
                  Delete what this port created, so the next port starts from a clean cluster.
                </p>
              </div>
              <CodeBlock label="Terminal" code={port.cleanup} />
              <LabTick id={ticks.cleanup} label="I cleaned up" />
            </section>

            <section aria-label="Finish the mission" className={CARD}>
              <LabFinish
                course="k8s"
                itemId={itemId}
                done={done}
                xp={MISSION_XP}
                cleanup={[...ticks.tasks, ticks.cleanup]}
                label="Finish mission"
                doneLabel="Mission finished"
                blockedReason="Tick every task and the cleanup first."
              />
            </section>

            <nav aria-label="What comes next">
              <Link
                href={onward.href}
                className={cn(buttonStyles({ variant: 'dark', size: 'lg' }), 'w-full')}
              >
                <span className="truncate">{onward.label}</span>
                <Icon name="arrow-right" className="size-4" />
              </Link>
            </nav>
          </div>
        </main>
      </LabProgress>
    </AppShell>
  );
}
