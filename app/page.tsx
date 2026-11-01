import type { Metadata } from 'next';

import { CourseHub } from '@/components/course/CourseHub';
import { Landing } from '@/components/course/Landing';
import { AppShell } from '@/components/layout/AppShell';
import { hubStats } from '@/lib/course/hub';
import { getCurrentUser } from '@/services/auth.service';
import { loadLearner } from '@/services/learner.service';

/**
 * Home. A signed-out visitor sees the platform: the courses, a live question
 * and a slice of each course. A signed-in learner sees the course hub: each
 * course they joined with its own tracker, and the courses they can join.
 *
 * It reads the session cookie, so it renders per request.
 */

export const metadata: Metadata = {
  description:
    'Courses for data engineers: senior DE interview prep and the GCP Professional Data Engineer exam, each with its own progress tracker.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user === null) return <Landing signInHref="/sign-in?next=/" />;

  const { name, record, enrolled, today, shell } = await loadLearner(user);
  return (
    <AppShell {...shell}>
      <CourseHub name={name} joined={enrolled.map((course) => hubStats(record, course, today))} />
    </AppShell>
  );
}
