import type { Metadata } from 'next';

import { CourseComingSoon } from '@/components/course/CourseComingSoon';
import { AppShell } from '@/components/layout/AppShell';
import { getSoonCourse } from '@/lib/course/courses';
import { requireLearner } from '@/services/learner.service';

/**
 * The Professional Cloud Architect course. It is not open yet, so the page
 * says so and lists the exam sections it will cover. It has no tracker and
 * no join button. When the course opens, this page becomes its dashboard.
 */

export const metadata: Metadata = {
  title: 'GCP Professional Cloud Architect',
  description:
    'Prep for the Google Cloud Certified Professional Cloud Architect exam. The course is being written; see the exam sections it will cover.',
};

export const dynamic = 'force-dynamic';

export default async function GcpArchitectCoursePage() {
  const { shell } = await requireLearner('/gcp-architect');

  return (
    <AppShell {...shell}>
      <CourseComingSoon course={getSoonCourse('gcp-architect')} />
    </AppShell>
  );
}
