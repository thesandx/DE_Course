import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProgressRing } from '@/components/course/ProgressRing';
import { MetroLine } from '@/components/gcp/MetroLine';
import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { getLine, lineProgress, questionsForLine, stationId } from '@/lib/course/gcp/catalog';
import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';
import { requireGcpLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ line: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const line = getLine((await params).line);
  return line === undefined
    ? { title: 'Line not found', description: 'This line does not exist.' }
    : { title: `Line ${line.number}: ${line.title}`, description: line.intro };
}

export const dynamic = 'force-dynamic';

export default async function GcpLinePage({ params }: Props) {
  const { line: slug } = await params;
  const line = getLine(slug);
  if (line === undefined) notFound();

  const { progress, shell } = await requireGcpLearner(`/gcp/lines/${slug}`);
  const stats = lineProgress(line, progress.done);
  const next = line.stations.find(
    (station) => progress.done[stationId(station.slug)] === undefined,
  );

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <p className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn('size-2.5 rounded-full', hueStyle(line.hue).fill)}
              />
              <span className="eyebrow text-on-night-soft">
                Line {line.number} · {line.weight}% of the exam
              </span>
            </p>
            <h1 className="text-display">{line.title}</h1>
            <p className="text-body text-on-night-soft max-w-2xl">{line.intro}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              {next !== undefined ? (
                <Link href={`/gcp/lines/${slug}/${next.slug}`} className={buttonStyles()}>
                  {stats.stationsDone === 0 ? 'Board at' : 'Ride on to'} {next.code}
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              ) : (
                <Link href={`/gcp/lines/${slug}/boss`} className={buttonStyles()}>
                  {stats.bossBeaten ? 'Replay the boss round' : 'Face the boss'}
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              )}
            </div>
          </div>
          <ProgressRing
            ratio={stats.ratio}
            label={`${line.title} progress`}
            size={112}
            thickness={10}
            tone="gold"
            surface="night"
            className="shrink-0"
          >
            <span className="flex flex-col items-center gap-0.5">
              <span className="text-title">
                {stats.stationsDone}/{stats.stationsTotal}
              </span>
              <span className="text-micro text-on-night-soft">stations</span>
            </span>
          </ProgressRing>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          <section aria-labelledby="map-heading" className="flex flex-col gap-3 lg:col-span-8">
            <h2 id="map-heading" className="text-title">
              Stations
            </h2>
            <MetroLine line={line} done={progress.done} nextSlug={next?.slug} />
          </section>
          <aside className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5 lg:col-span-4">
            <p className="eyebrow text-ink-faint">Boss round</p>
            <h2 className="text-heading">{line.boss.title}</h2>
            <p className="text-small text-ink-soft">{line.boss.story}</p>
            <p className="text-small text-ink-soft">
              {`Ten questions from the ${questionsForLine(slug).length} in this line's bank. Get seven right to win. It opens when every station is done.`}
            </p>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
