import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InlineText } from '@/components/course/InlineText';
import { Prose } from '@/components/course/Prose';
import { StationChecks } from '@/components/gcp/StationChecks';
import { AppShell } from '@/components/layout/AppShell';
import { Icon } from '@/components/layout/Icon';
import { buttonStyles } from '@/components/ui/Button';
import { getStation, stationId, stationXp } from '@/lib/course/gcp/catalog';
import { hueStyle } from '@/lib/course/hue';
import { cn } from '@/lib/utils';
import { requireGcpLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ line: string; station: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { line, station } = await params;
  const found = getStation(line, station);
  return found === undefined
    ? { title: 'Station not found', description: 'This station does not exist.' }
    : {
        title: `${found.station.code} ${found.station.title}`,
        description: found.station.mission,
      };
}

export const dynamic = 'force-dynamic';

/**
 * A station: the mission that frames it, the concepts to read, the key points
 * to remember, then the checkpoint. The station counts once every checkpoint
 * is right.
 */
export default async function GcpStationPage({ params }: Props) {
  const { line: lineSlug, station: stationSlug } = await params;
  const found = getStation(lineSlug, stationSlug);
  if (found === undefined) notFound();
  const { line, station, index } = found;

  const { progress, shell } = await requireGcpLearner(`/gcp/lines/${lineSlug}/${stationSlug}`);
  const itemId = stationId(station.slug);
  const done = progress.done[itemId] !== undefined;
  const previous = line.stations[index - 1];
  const next = line.stations[index + 1];
  const hue = hueStyle(line.hue);
  const stationHref = (slug: string): string => `/gcp/lines/${lineSlug}/${slug}`;

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'GCP course', href: '/gcp' },
        { label: `Line ${line.number}`, href: `/gcp/lines/${lineSlug}` },
        { label: station.title },
      ]}
      back={{ fallbackHref: `/gcp/lines/${lineSlug}`, label: `Back to line ${line.number}` }}
    >
      <main className="flex w-full flex-col">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-8 md:py-8 lg:grid-cols-12 lg:items-start lg:gap-8">
          <article className="flex min-w-0 flex-col gap-4 lg:col-span-8">
            <header className="bg-night-glow rounded-sheet text-on-night flex flex-col gap-4 p-6 sm:p-8">
              <p className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-pill eyebrow text-ink px-3 py-1', hue.fill)}>
                  Station {station.code}
                </span>
                <span className="eyebrow text-on-night-soft">
                  Line {line.number} · {line.short}
                </span>
              </p>
              <h1 className="text-display">{station.title}</h1>
              {station.mission !== '' && (
                <div className="border-night-line bg-night-raised/60 rounded-card flex flex-col gap-1 border p-4">
                  <p className="eyebrow text-gold">Mission</p>
                  <p className="text-body text-on-night-soft">{station.mission}</p>
                </div>
              )}
              <dl className="border-night-line mt-1 grid grid-cols-3 gap-4 border-t pt-5">
                {[
                  { label: 'Concepts', value: String(station.concepts.length) },
                  { label: 'Checkpoints', value: String(station.keyPoints.length) },
                  { label: 'Reward', value: done ? 'Earned' : `+${stationXp(station)} XP` },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-0.5">
                    <dt className="eyebrow text-on-night-soft">{stat.label}</dt>
                    <dd className="font-display text-heading font-semibold">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </header>

            {station.concepts.map((concept, conceptIndex) => (
              <section
                key={concept.title}
                id={`concept-${conceptIndex + 1}`}
                aria-labelledby={`concept-${conceptIndex + 1}-heading`}
                className="bg-surface border-line rounded-card shadow-card flex scroll-mt-20 flex-col gap-4 border p-5 sm:p-6"
              >
                <p className="eyebrow text-ink-faint">Concept {conceptIndex + 1}</p>
                <h2 id={`concept-${conceptIndex + 1}-heading`} className="text-title">
                  {concept.title}
                </h2>
                <Prose source={concept.body} />
              </section>
            ))}

            {station.keyPoints.length > 0 && (
              <section
                aria-labelledby="key-points-heading"
                className="bg-surface border-line rounded-card shadow-card flex flex-col gap-4 border p-5 sm:p-6"
              >
                <p className="eyebrow text-ink-faint">Remember</p>
                <h2 id="key-points-heading" className="text-title">
                  Key points
                </h2>
                <ol className="flex flex-col gap-4">
                  {station.keyPoints.map((point, pointIndex) => (
                    <li
                      key={point.point}
                      className={cn('flex flex-col gap-2 border-l-4 pl-4', hue.rail)}
                    >
                      <p className="text-body font-semibold">
                        <span className="text-ink-faint font-mono">{pointIndex + 1}. </span>
                        <InlineText text={point.point} />
                      </p>
                      {point.more !== undefined && <Prose source={point.more} />}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <StationChecks
              itemId={itemId}
              checks={station.keyPoints.map((point) => point.check)}
              done={done}
              xp={stationXp(station)}
              {...(previous !== undefined
                ? {
                    previous: (
                      <Link
                        href={stationHref(previous.slug)}
                        className={buttonStyles({ variant: 'secondary', size: 'lg' })}
                      >
                        <Icon name="arrow-left" className="size-4" />
                        Previous
                      </Link>
                    ),
                  }
                : {})}
            />

            <nav aria-label="Next station">
              <Link
                href={next !== undefined ? stationHref(next.slug) : `/gcp/lines/${lineSlug}/boss`}
                className={cn(buttonStyles({ variant: 'dark', size: 'lg' }), 'w-full')}
              >
                {next !== undefined
                  ? `Next stop: ${next.code} ${next.title}`
                  : `Terminus: ${line.boss.title}`}
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
                On this station
              </h2>
              <ol className="flex flex-col gap-1">
                {station.concepts.map((concept, conceptIndex) => (
                  <li key={concept.title}>
                    <a
                      href={`#concept-${conceptIndex + 1}`}
                      className="text-small text-ink-soft hover:text-ink hover:bg-sunken rounded-input flex min-h-11 items-center gap-2 px-2"
                    >
                      <span className="text-ink-faint w-5 font-mono">{conceptIndex + 1}</span>
                      {concept.title}
                    </a>
                  </li>
                ))}
              </ol>
            </section>
            <section className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5">
              <h2 className="text-heading">Line {line.number}</h2>
              <ol className="flex flex-col gap-1">
                {line.stations.map((item) => {
                  const itemDone = progress.done[stationId(item.slug)] !== undefined;
                  const current = item.slug === station.slug;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={stationHref(item.slug)}
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
                        <span className="font-mono">{item.code}</span>
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
    </AppShell>
  );
}
