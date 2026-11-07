import type { Metadata } from 'next';
import Link from 'next/link';

import { AppShell } from '@/components/layout/AppShell';
import { Icon, type IconName } from '@/components/layout/Icon';
import { PageHeading } from '@/components/layout/PageHeading';
import {
  BOSS_XP,
  CARD_XP,
  LAB_XP,
  lineProgress,
  LINES,
  MOCK_QUESTIONS,
  MOCK_XP,
  QUESTIONS,
  SPRINT_SECONDS,
  SPRINT_TARGETS,
  SPRINT_XP,
  sprintId,
} from '@/lib/course/gcp/catalog';
import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';
import { requireGcpLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Drills',
  description: 'Flashcards, Service Sprint, boss rounds and the mock exam for the GCP course.',
};

export const dynamic = 'force-dynamic';

export default async function GcpPracticePage() {
  const { progress, summary, shell } = await requireGcpLearner('/gcp/practice');
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
      href: '/gcp/practice/flashcards',
      icon: 'book',
      title: 'Flashcards',
      body: 'The facts the exam leans on, one card at a time. Flip, then say if you knew it.',
      meta: `${summary.cardsKnown} of ${summary.cardsTotal} known · +${CARD_XP} XP per new card`,
    },
    {
      href: '/gcp/practice/sprint',
      icon: 'clock',
      title: 'Service Sprint',
      body: `${SPRINT_SECONDS} seconds: match each requirement to the service that fits.`,
      meta: SPRINT_TARGETS.map(
        (target) =>
          `${target} right ${sprintsDone.includes(target) ? '✓' : `+${SPRINT_XP[target] ?? 0} XP`}`,
      ).join(' · '),
    },
    {
      href: '/gcp/labs',
      icon: 'spark',
      title: 'Hands-on labs',
      body: 'Each exam section done for real in your Google Cloud project, with sample data and a cleanup.',
      meta: `${summary.labsDone} of ${summary.labsTotal} done · +${LAB_XP} XP each`,
    },
    {
      href: '/gcp/practice/mock',
      icon: 'trophy',
      title: 'Mock exam',
      body: `${MOCK_QUESTIONS} scenario questions drawn from all ${QUESTIONS.length}, weighted like the real exam.`,
      meta: summary.mockPassed ? 'Passed' : `Pass at 70% · +${MOCK_XP} XP`,
    },
  ];

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading eyebrow="GCP course" title="Drills">
          Short games that make the facts stick. They earn XP toward your rank and keep your streak
          alive on days with no new station.
        </PageHeading>

        <ul className="grid gap-4 md:grid-cols-2">
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

        <section aria-labelledby="bosses-heading" className="flex flex-col gap-4">
          <h2 id="bosses-heading" className="text-title">
            Boss rounds
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LINES.map((line) => {
              const stats = lineProgress(line, progress.done);
              const open = stats.bossOpen || stats.bossBeaten;
              return (
                <li key={line.slug}>
                  <Link
                    href={`/gcp/lines/${line.slug}/boss`}
                    className={cn(
                      'rounded-card flex h-full flex-col gap-1 border border-l-4 p-4',
                      hueStyle(line.hue).rail,
                      open ? 'bg-surface border-line shadow-card' : 'bg-sunken border-line',
                    )}
                  >
                    <span className="eyebrow text-ink-faint">Line {line.number}</span>
                    <span className="text-body font-semibold">{line.boss.title}</span>
                    <span className="text-small text-ink-soft">
                      {stats.bossBeaten
                        ? 'Beaten'
                        : open
                          ? `Open · +${BOSS_XP} XP`
                          : `Locked · ${stats.stationsTotal - stats.stationsDone} stations to go`}
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
