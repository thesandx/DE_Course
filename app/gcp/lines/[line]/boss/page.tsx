import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { QuizRun } from '@/components/gcp/QuizRun';
import { AppShell } from '@/components/layout/AppShell';
import { buttonStyles } from '@/components/ui/Button';
import {
  BOSS_QUESTIONS,
  BOSS_XP,
  bossId,
  getLine,
  lineProgress,
  PASS_RATIO,
  questionsForLine,
} from '@/lib/course/gcp/catalog';
import { requireGcpLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ line: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const line = getLine((await params).line);
  return line === undefined
    ? { title: 'Line not found', description: 'This line does not exist.' }
    : { title: `Boss: ${line.boss.title}`, description: line.boss.story };
}

export const dynamic = 'force-dynamic';

/** The boss round at the end of a line. Locked until every station on the line is done. */
export default async function GcpBossPage({ params }: Props) {
  const { line: slug } = await params;
  const line = getLine(slug);
  if (line === undefined) notFound();

  const { progress, shell } = await requireGcpLearner(`/gcp/lines/${slug}/boss`);
  const stats = lineProgress(line, progress.done);
  const done = stats.bossBeaten;

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'GCP course', href: '/gcp' },
        { label: `Line ${line.number}`, href: `/gcp/lines/${slug}` },
        { label: 'Boss round' },
      ]}
      back={{ fallbackHref: `/gcp/lines/${slug}`, label: `Back to line ${line.number}` }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {stats.bossOpen || done ? (
            <QuizRun
              mode="boss"
              title={line.boss.title}
              story={line.boss.story}
              groups={[
                {
                  line: { slug: line.slug, short: line.short, weight: line.weight },
                  questions: questionsForLine(slug),
                },
              ]}
              count={BOSS_QUESTIONS}
              passRatio={PASS_RATIO}
              itemId={bossId(slug)}
              xp={BOSS_XP}
              done={done}
              backHref={`/gcp/lines/${slug}`}
              backLabel={`Back to line ${line.number}`}
            />
          ) : (
            <section className="bg-surface border-line rounded-sheet shadow-card flex flex-col items-start gap-4 border p-6 md:p-8">
              <p className="eyebrow text-ink-faint">Boss round · locked</p>
              <h1 className="text-display">{line.boss.title}</h1>
              <p className="text-body text-ink-soft">{line.boss.story}</p>
              <p className="text-body">
                Finish every station on this line to unlock it:{' '}
                <strong>
                  {stats.stationsDone} of {stats.stationsTotal}
                </strong>{' '}
                done.
              </p>
              <Link href={`/gcp/lines/${slug}`} className={buttonStyles({ size: 'lg' })}>
                Back to the stations
              </Link>
            </section>
          )}
        </div>
      </main>
    </AppShell>
  );
}
