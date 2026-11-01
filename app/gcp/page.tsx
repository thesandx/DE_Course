import type { Metadata } from 'next';

import { CourseJoin } from '@/components/course/CourseJoin';
import { GcpDashboard } from '@/components/gcp/GcpDashboard';
import { AppShell } from '@/components/layout/AppShell';
import { getCourse } from '@/lib/course/courses';
import { LINES } from '@/lib/course/gcp/catalog';
import { requireGcpLearner } from '@/services/learner.service';

/**
 * The GCP course home. A learner in the course sees their dashboard: rank,
 * today's XP goal, readiness and the network of lines. A learner not in it
 * yet sees the five lines and the button to join.
 */

export const metadata: Metadata = {
  title: 'GCP Professional Data Engineer',
  description:
    'Prepare for the Google Cloud Professional Data Engineer exam: five domains as metro lines, boss rounds, flashcards and a mock exam.',
};

export const dynamic = 'force-dynamic';

export default async function GcpCoursePage() {
  const { name, joined, progress, summary, today, shell } = await requireGcpLearner('/gcp', {
    allowUnenrolled: true,
  });

  return (
    <AppShell {...shell}>
      {joined ? (
        <GcpDashboard name={name} progress={progress} summary={summary} today={today} />
      ) : (
        <CourseJoin
          course={getCourse('gcp')}
          previewTitle="The five lines"
          preview={LINES.map((line) => ({
            title: line.title,
            detail: `${line.stations.length} stations · ${line.weight}% of the exam · boss: ${line.boss.title}`,
            hue: line.hue,
          }))}
        />
      )}
    </AppShell>
  );
}
