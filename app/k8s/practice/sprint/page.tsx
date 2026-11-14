import type { Metadata } from 'next';

import { ServiceSprint } from '@/components/gcp/ServiceSprint';
import { AppShell } from '@/components/layout/AppShell';
import {
  SPRINT,
  SPRINT_SECONDS,
  SPRINT_TARGETS,
  SPRINT_XP,
  sprintId,
} from '@/lib/course/k8s/catalog';
import { requireK8sLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Object sprint',
  description: 'A 60-second drill: match each situation to the Kubernetes object that fits.',
};

export const dynamic = 'force-dynamic';

export default async function K8sSprintPage() {
  const { progress, shell } = await requireK8sLearner('/k8s/practice/sprint');

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'Kubernetes course', href: '/k8s' },
        { label: 'Drills', href: '/k8s/practice' },
        { label: 'Object sprint' },
      ]}
      back={{ fallbackHref: '/k8s/practice', label: 'Back to drills' }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <ServiceSprint
            course="k8s"
            title="Object sprint"
            intro="A situation appears; tap the Kubernetes object or tool that fits it. Naming the right object fast is what a design interview and an outage both ask of you."
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
