import type { Metadata } from 'next';

import { CourseJoin } from '@/components/course/CourseJoin';
import { K8sDashboard } from '@/components/k8s/K8sDashboard';
import { AppShell } from '@/components/layout/AppShell';
import { getCourse } from '@/lib/course/courses';
import { incidentsFor, portCode, PORTS } from '@/lib/course/k8s/catalog';
import { requireK8sLearner } from '@/services/learner.service';

/**
 * The Kubernetes course home. A learner in the course sees their dashboard:
 * rank, today's XP goal, the next lesson and the ports. A learner not in it
 * yet sees the ports and the button to join.
 */

export const metadata: Metadata = {
  title: 'Kubernetes for Data Engineers',
  description:
    'Learn Kubernetes by doing: take one image from a laptop to production through 14 ports, with real labs, incident drills and a final exam.',
};

export const dynamic = 'force-dynamic';

export default async function K8sCoursePage() {
  const { name, joined, progress, summary, today, shell } = await requireK8sLearner('/k8s', {
    allowUnenrolled: true,
  });

  return (
    <AppShell {...shell}>
      {joined ? (
        <K8sDashboard name={name} progress={progress} summary={summary} today={today} />
      ) : (
        <CourseJoin
          course={getCourse('k8s')}
          previewTitle="The 14 ports"
          preview={PORTS.map((port) => {
            const incidents = incidentsFor(port.slug).length;
            return {
              title: `${portCode(port)} · ${port.title}`,
              detail: `${port.lessons.length} lessons · 1 mission${incidents > 0 ? ` · ${incidents} incidents` : ''}`,
              hue: port.hue,
            };
          })}
        />
      )}
    </AppShell>
  );
}
