import type { Metadata } from 'next';

import { TrackCard } from '@/components/course/TrackCard';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { problemsForTrack, trackProgress, TRACKS } from '@/lib/course/catalog';
import { requireDeLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Tracks',
  description: 'Every track in the senior data engineer course, in the recommended study order.',
};

export const dynamic = 'force-dynamic';

export default async function TracksPage() {
  const { progress, shell } = await requireDeLearner('/de/tracks');

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading eyebrow="Curriculum" title="Tracks">
          {TRACKS.length} tracks, in the order we suggest. Each one has short lessons with checks,
          then interview problems with model answers. Start anywhere you feel weakest.
        </PageHeading>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((track) => (
            <li key={track.slug}>
              <TrackCard
                href={`/de/tracks/${track.slug}`}
                slug={track.slug}
                title={track.title}
                summary={track.summary}
                lessons={track.lessons.length}
                problems={problemsForTrack(track.slug).length}
                ratio={trackProgress(track, progress.done).ratio}
              />
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
