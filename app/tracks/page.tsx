import type { Metadata } from 'next';

import { TrackCard } from '@/components/course/TrackCard';
import { AppBar } from '@/components/layout/AppBar';
import { problemsForTrack, trackProgress, TRACKS } from '@/lib/course/catalog';
import { requireLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Tracks',
  description: 'Every track in the senior data engineer course, in the recommended study order.',
};

export const dynamic = 'force-dynamic';

export default async function TracksPage() {
  const { progress } = await requireLearner('/tracks');

  return (
    <>
      <AppBar title="Tracks" />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
        <p className="text-ink-soft max-w-prose">
          {TRACKS.length} tracks, in the order we suggest. Each one has short lessons with checks,
          then interview problems with model answers. Start anywhere you feel weakest.
        </p>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((track, index) => (
            <li key={track.slug}>
              <TrackCard
                href={`/tracks/${track.slug}`}
                title={track.title}
                summary={track.summary}
                tone={track.tone}
                eyebrow={`Track ${index + 1}`}
                lessons={track.lessons.length}
                problems={problemsForTrack(track.slug).length}
                ratio={trackProgress(track, progress.done).ratio}
              />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
