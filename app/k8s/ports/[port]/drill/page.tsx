import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { QuizRun } from '@/components/gcp/QuizRun';
import { AppShell } from '@/components/layout/AppShell';
import { buttonStyles } from '@/components/ui/Button';
import {
  DRILL_PASS_RATIO,
  DRILL_XP,
  drillId,
  getPort,
  incidentQuestion,
  incidentsFor,
  portCode,
  portProgress,
} from '@/lib/course/k8s/catalog';
import { requireK8sLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ port: string }>;
}

const STORY =
  'It is 03:00 and the pager goes off. Each incident shows what the terminal printed. Read it the way you would on call, then pick the cause.';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const port = getPort((await params).port);
  return port === undefined || incidentsFor(port.slug).length === 0
    ? { title: 'Drill not found', description: 'This incident drill does not exist.' }
    : { title: `Incident drill: ${port.title}`, description: STORY };
}

export const dynamic = 'force-dynamic';

/** The incident drill at the end of a port. Locked until every lesson at the port is done. */
export default async function K8sDrillPage({ params }: Props) {
  const { port: slug } = await params;
  const port = getPort(slug);
  const incidents = incidentsFor(slug);
  if (port === undefined || incidents.length === 0) notFound();

  const { progress, shell } = await requireK8sLearner(`/k8s/ports/${slug}/drill`);
  const stats = portProgress(port, progress.done);
  const done = stats.drillPassed;

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'Kubernetes course', href: '/k8s' },
        { label: portCode(port), href: `/k8s/ports/${slug}` },
        { label: 'Incident drill' },
      ]}
      back={{ fallbackHref: `/k8s/ports/${slug}`, label: `Back to ${port.title}` }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {stats.drillOpen || done ? (
            <QuizRun
              course="k8s"
              mode="boss"
              words={{
                kind: 'Incident drill',
                start: 'Answer the pager',
                passed: 'Incidents resolved',
                meter: 'Open incidents',
                meterEmpty: 'All resolved',
                meterUnit: 'open',
                right: 'Resolved. Correct.',
                code: 'Terminal',
              }}
              title={`${port.title}: the pager goes off`}
              story={STORY}
              groups={[
                {
                  line: { slug: port.slug, short: port.title, weight: 1 },
                  questions: incidents.map(incidentQuestion),
                },
              ]}
              count={incidents.length}
              passRatio={DRILL_PASS_RATIO}
              itemId={drillId(slug)}
              xp={DRILL_XP}
              done={done}
              backHref={`/k8s/ports/${slug}`}
              backLabel={`Back to ${port.title}`}
            />
          ) : (
            <section className="bg-surface border-line rounded-sheet shadow-card flex flex-col items-start gap-4 border p-6 md:p-8">
              <p className="eyebrow text-ink-faint">Incident drill · locked</p>
              <h1 className="text-display">{port.title}: the pager goes off</h1>
              <p className="text-body text-ink-soft">{STORY}</p>
              <p className="text-body">
                Finish every lesson at this port to unlock it:{' '}
                <strong>
                  {stats.lessonsDone} of {stats.lessonsTotal}
                </strong>{' '}
                done.
              </p>
              <Link href={`/k8s/ports/${slug}`} className={buttonStyles({ size: 'lg' })}>
                Back to the lessons
              </Link>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
