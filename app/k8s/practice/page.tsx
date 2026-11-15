import type { Metadata } from 'next';
import Link from 'next/link';

import { AppShell } from '@/components/layout/AppShell';
import { Icon, type IconName } from '@/components/layout/Icon';
import { PageHeading } from '@/components/layout/PageHeading';
import { hueStyle } from '@/lib/course/hue';
import {
  CARD_XP,
  DOJO_XP,
  DRILL_XP,
  EXAM_PASS_RATIO,
  EXAM_QUESTIONS,
  EXAM_XP,
  hasDrill,
  incidentsFor,
  portCode,
  portProgress,
  PORTS,
  SPRINT_SECONDS,
  SPRINT_TARGETS,
  SPRINT_XP,
  sprintId,
} from '@/lib/course/k8s/catalog';
import { cn } from '@/lib/utils';
import { requireK8sLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Drills',
  description:
    'Incident drills, the object sprint, the kubectl dojo, flashcards, the cheatsheet and the final exam of the Kubernetes course.',
};

export const dynamic = 'force-dynamic';

export default async function K8sPracticePage() {
  const { progress, summary, shell } = await requireK8sLearner('/k8s/practice');
  const sprintsDone = SPRINT_TARGETS.filter(
    (target) => progress.done[sprintId(target)] !== undefined,
  );

  const drills: ReadonlyArray<{
    href: string;
    icon: IconName;
    title: string;
    body: string;
    meta: string;
  }> = [
    {
      href: '/k8s/practice/dojo',
      icon: 'spark',
      title: 'kubectl dojo',
      body: 'A task appears and you type the real command from memory. Flags can come in any order.',
      meta: `${summary.dojoSolved} of ${summary.dojoTotal} solved · +${DOJO_XP} XP each`,
    },
    {
      href: '/k8s/practice/sprint',
      icon: 'clock',
      title: 'Object sprint',
      body: `${SPRINT_SECONDS} seconds: match each situation to the Kubernetes object that fits.`,
      meta: SPRINT_TARGETS.map(
        (target) =>
          `${target} right ${sprintsDone.includes(target) ? '✓' : `+${SPRINT_XP[target] ?? 0} XP`}`,
      ).join(' · '),
    },
    {
      href: '/k8s/practice/flashcards',
      icon: 'book',
      title: 'Flashcards',
      body: 'The facts an interview leans on, one card at a time. Flip, then say if you knew it.',
      meta: `${summary.cardsKnown} of ${summary.cardsTotal} known · +${CARD_XP} XP per new card`,
    },
    {
      href: '/k8s/practice/cheatsheet',
      icon: 'search',
      title: 'Cheatsheet',
      body: 'Docker commands beside their Kubernetes match, and every kubectl command of the labs.',
      meta: 'Search and copy',
    },
    {
      href: '/k8s/practice/exam',
      icon: 'trophy',
      title: 'Final exam',
      body: `${EXAM_QUESTIONS} questions drawn from every port: lesson checks and incidents.`,
      meta: summary.examPassed
        ? 'Passed'
        : `Pass at ${Math.round(EXAM_PASS_RATIO * 100)}% · +${EXAM_XP} XP`,
    },
  ];

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading eyebrow="Kubernetes course" title="Drills">
          Short games that make the commands and the failure modes stick. They earn XP toward your
          rank and keep your streak alive on days with no new lesson.
        </PageHeading>

        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drills.map((drill) => (
            <li key={drill.href}>
              <Link
                href={drill.href}
                className="bg-surface border-line rounded-card shadow-card hover:shadow-raised flex h-full flex-col gap-3 border p-5 transition-shadow"
              >
                <span className="bg-sunken rounded-input inline-grid size-10 place-items-center">
                  <Icon name={drill.icon} className="size-5" />
                </span>
                <span className="text-heading">{drill.title}</span>
                <span className="text-body text-ink-soft">{drill.body}</span>
                <span className="text-small text-iris mt-auto font-semibold">{drill.meta}</span>
              </Link>
            </li>
          ))}
        </ul>

        <section aria-labelledby="incidents-heading" className="flex flex-col gap-4">
          <h2 id="incidents-heading" className="text-title">
            Incident drills
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PORTS.filter((port) => hasDrill(port.slug)).map((port) => {
              const stats = portProgress(port, progress.done);
              const open = stats.drillOpen || stats.drillPassed;
              const left = stats.lessonsTotal - stats.lessonsDone;
              return (
                <li key={port.slug}>
                  <Link
                    href={`/k8s/ports/${port.slug}/drill`}
                    className={cn(
                      'rounded-card flex h-full flex-col gap-1 border border-l-4 p-4',
                      hueStyle(port.hue).rail,
                      open ? 'bg-surface border-line shadow-card' : 'bg-sunken border-line',
                    )}
                  >
                    <span className="eyebrow text-ink-faint">
                      {portCode(port)} · {incidentsFor(port.slug).length} incidents
                    </span>
                    <span className="text-body font-semibold">{port.title}</span>
                    <span className="text-small text-ink-soft">
                      {stats.drillPassed
                        ? 'Passed'
                        : open
                          ? `Open · +${DRILL_XP} XP`
                          : `Locked · ${left} ${left === 1 ? 'lesson' : 'lessons'} to go`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
