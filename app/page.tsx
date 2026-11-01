import type { Metadata } from 'next';

import { Dashboard } from '@/components/course/Dashboard';
import { Landing } from '@/components/course/Landing';
import { AppShell } from '@/components/layout/AppShell';
import { getCurrentUser } from '@/services/auth.service';
import { loadLearner } from '@/services/learner.service';

/**
 * Home. A signed-out visitor sees the course: a live question, the tracks,
 * the loop guides and a slice of the problems. A signed-in learner sees their
 * dashboard: level, streak, solved counts, readiness and what to do next.
 *
 * It reads the session cookie, so it renders per request.
 */

export const metadata: Metadata = {
  description:
    'Lessons, interview problems and loop guides for senior data engineer interviews at Uber and Google.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user === null) return <Landing signInHref="/sign-in?next=/" />;

  const { name, progress, summary, today } = await loadLearner(user);
  return (
    <AppShell learnerName={name} summary={summary}>
      <Dashboard name={name} progress={progress} summary={summary} today={today} />
    </AppShell>
  );
}
