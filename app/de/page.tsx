import type { Metadata } from 'next';

import { CourseJoin } from '@/components/course/CourseJoin';
import { Dashboard } from '@/components/course/Dashboard';
import { AppShell } from '@/components/layout/AppShell';
import { problemsForTrack, TRACKS } from '@/lib/course/catalog';
import { getCourse } from '@/lib/course/courses';
import { trackStyle } from '@/lib/course/track-style';
import { requireDeLearner } from '@/services/learner.service';

/**
 * The DE course home. A learner in the course sees their dashboard: level,
 * streak, solved counts, loop readiness and what to do next. A learner not in
 * it yet sees what the course holds and the button to join.
 */

export const metadata: Metadata = {
  title: 'Senior Data Engineering',
  description:
    'Lessons, interview problems and loop guides for senior data engineer interviews at Uber and Google.',
};

export const dynamic = 'force-dynamic';

export default async function DeCoursePage() {
  const { name, joined, progress, summary, today, shell } = await requireDeLearner('/de', {
    allowUnenrolled: true,
  });

  return (
    <AppShell {...shell}>
      {joined ? (
        <Dashboard name={name} progress={progress} summary={summary} today={today} />
      ) : (
        <CourseJoin
          course={getCourse('de')}
          previewTitle="The tracks"
          preview={TRACKS.map((track) => ({
            title: track.title,
            detail: `${track.lessons.length} lessons · ${problemsForTrack(track.slug).length} problems`,
            hue: ((trackStyle(track.slug).number - 1) % 7) + 1,
          }))}
        />
      )}
    </AppShell>
  );
}
