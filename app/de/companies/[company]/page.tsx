import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProgressRing } from '@/components/course/ProgressRing';
import { Prose } from '@/components/course/Prose';
import { AppShell } from '@/components/layout/AppShell';
import { getCompany, getTrack, readiness } from '@/lib/course/catalog';
import { COMPANY_META } from '@/lib/course/company-meta';
import { trackStyle } from '@/lib/course/track-style';
import { cn } from '@/lib/utils';
import { requireDeLearner } from '@/services/learner.service';

interface Props {
  params: Promise<{ company: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = getCompany((await params).company);
  return company === undefined
    ? { title: 'Guide not found', description: 'There is no loop guide for this company.' }
    : {
        title: `${company.name} loop guide`,
        description: `How the ${company.name} senior data engineer loop runs, round by round, and how to prepare.`,
      };
}

export const dynamic = 'force-dynamic';

export default async function CompanyPage({ params }: Props) {
  const { company: slug } = await params;
  const company = getCompany(slug);
  if (company === undefined) notFound();

  const { progress, shell } = await requireDeLearner(`/de/companies/${slug}`);
  const ready = readiness(company, progress.done);

  const minutes = company.rounds.reduce((sum, round) => sum + round.minutes, 0);

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <header
          className={cn(
            'rounded-sheet text-on-night flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center md:justify-between',
            COMPANY_META[company.slug].surface,
          )}
        >
          <div className="flex min-w-0 flex-col gap-3">
            <p className="eyebrow text-on-night-soft">Loop guide</p>
            <h1 className="text-display">{company.name} loop guide</h1>
            <p className="text-body text-on-night-soft max-w-2xl">{company.summary}</p>
            <p className="text-micro text-on-night-soft font-mono">
              {company.rounds.length} rounds · about {Math.round(minutes / 60)} hours
            </p>
          </div>
          <div className="flex items-center gap-4 md:flex-col md:items-center">
            <ProgressRing
              ratio={ready}
              label={`${company.name} readiness`}
              size={104}
              thickness={9}
              tone={COMPANY_META[company.slug].ring}
              surface="night"
              shape="wedge"
            >
              <span className="text-title">{Math.round(ready * 100)}%</span>
            </ProgressRing>
            <p className="text-small text-on-night-soft max-w-56 md:text-center">
              Readiness, from the tracks this loop tests, weighted by each round.
            </p>
          </div>
        </header>

        <section className="bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-4 border p-5 sm:p-6">
          <Prose source={company.overview} />
        </section>

        <section aria-labelledby="rounds-heading" className="flex flex-col gap-3">
          <h2 id="rounds-heading" className="text-title">
            The rounds
          </h2>
          <ol className="flex flex-col gap-3">
            {company.rounds.map((round, index) => (
              <li
                key={round.name}
                className="bg-surface border-line rounded-card shadow-card flex flex-col gap-3 border p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-heading flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="bg-ink text-on-ink text-small rounded-box inline-grid size-8 shrink-0 place-items-center font-mono font-semibold"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {round.name}
                  </h3>
                  <span className="text-micro text-ink-faint font-mono">~{round.minutes} min</span>
                </div>
                <Prose source={round.focus} />
                <ul className="flex flex-wrap gap-2" aria-label="Tracks that prepare you">
                  {round.tracks.map((trackSlug) => {
                    const track = getTrack(trackSlug);
                    return track === undefined ? null : (
                      <li key={trackSlug}>
                        <Link
                          href={`/de/tracks/${trackSlug}`}
                          className="border-line bg-surface hover:border-line-strong rounded-pill text-small inline-flex min-h-10 items-center gap-2 border px-3 font-medium transition-colors"
                        >
                          <span
                            aria-hidden="true"
                            className={cn('size-2 rounded-full', trackStyle(trackSlug).fill)}
                          />
                          {track.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </AppShell>
  );
}
