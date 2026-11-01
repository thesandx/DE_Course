import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProgressRing } from '@/components/course/ProgressRing';
import { Prose } from '@/components/course/Prose';
import { AppBar } from '@/components/layout/AppBar';
import { Card } from '@/components/ui/Card';
import { getCompany, getTrack, readiness } from '@/lib/course/catalog';
import { requireLearner } from '@/services/learner.service';

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

  const { progress } = await requireLearner(`/companies/${slug}`);
  const ready = readiness(company, progress.done);

  return (
    <>
      <AppBar
        title={`${company.name} loop guide`}
        back={{ fallbackHref: '/', label: 'Back to home' }}
      />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-3 lg:items-start lg:gap-12">
        <Card tone="brand-soft" className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="flex items-center gap-4">
            <ProgressRing ratio={ready} label={`${company.name} readiness`} />
            <p className="text-small">
              Your readiness, from your progress in the tracks this loop tests, weighted by how much
              each round leans on them.
            </p>
          </div>
          <p>{company.summary}</p>
        </Card>

        <div className="flex min-w-0 flex-col gap-10 lg:col-span-2">
          <Prose source={company.overview} />

          <section aria-labelledby="rounds-heading" className="flex flex-col gap-4">
            <h2 id="rounds-heading" className="text-title">
              The rounds
            </h2>
            <ol className="flex flex-col gap-4">
              {company.rounds.map((round, index) => (
                <li
                  key={round.name}
                  className="border-line bg-surface rounded-card flex flex-col gap-3 border-2 p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-heading">
                      {index + 1}. {round.name}
                    </h3>
                    <span className="text-small text-ink-soft">About {round.minutes} minutes</span>
                  </div>
                  <Prose source={round.focus} />
                  <ul className="flex flex-wrap gap-2" aria-label="Tracks that prepare you">
                    {round.tracks.map((trackSlug) => {
                      const track = getTrack(trackSlug);
                      return track === undefined ? null : (
                        <li key={trackSlug}>
                          <Link
                            href={`/tracks/${trackSlug}`}
                            className="squish border-line bg-sunken shadow-mochi-sm rounded-pill inline-flex min-h-11 items-center border-2 px-4 text-small font-bold"
                          >
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
        </div>
      </main>
    </>
  );
}
