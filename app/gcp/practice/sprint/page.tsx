import type { Metadata } from 'next';

import { ServiceSprint } from '@/components/gcp/ServiceSprint';
import { AppShell } from '@/components/layout/AppShell';
import {
  SPRINT,
  SPRINT_SECONDS,
  SPRINT_TARGETS,
  SPRINT_XP,
  sprintId,
} from '@/lib/course/gcp/catalog';
import { requireGcpLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Service Sprint',
  description: 'A 60-second drill: match each requirement to the Google Cloud service that fits.',
};

export const dynamic = 'force-dynamic';

export default async function GcpSprintPage() {
  const { progress, shell } = await requireGcpLearner('/gcp/practice/sprint');

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'GCP course', href: '/gcp' },
        { label: 'Drills', href: '/gcp/practice' },
        { label: 'Service Sprint' },
      ]}
      back={{ fallbackHref: '/gcp/practice', label: 'Back to drills' }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <ServiceSprint
            rounds={SPRINT}
            seconds={SPRINT_SECONDS}
            milestones={SPRINT_TARGETS.map((target) => ({
              target,
              itemId: sprintId(target),
              xp: SPRINT_XP[target] ?? 0,
              done: progress.done[sprintId(target)] !== undefined,
            }))}
          />
        </div>
      </main>
    </AppShell>
  );
}
