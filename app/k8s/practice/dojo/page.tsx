import type { Metadata } from 'next';

import { CommandDojo } from '@/components/k8s/CommandDojo';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { DOJO, DOJO_XP, dojoId } from '@/lib/course/k8s/catalog';
import { requireK8sLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'kubectl dojo',
  description: 'Type real kubectl commands from memory, one task at a time.',
};

export const dynamic = 'force-dynamic';

export default async function K8sDojoPage() {
  const { progress, shell } = await requireK8sLearner('/k8s/practice/dojo');
  const ids = DOJO.map((_, index) => dojoId(index));

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'Kubernetes course', href: '/k8s' },
        { label: 'Drills', href: '/k8s/practice' },
        { label: 'kubectl dojo' },
      ]}
      back={{ fallbackHref: '/k8s/practice', label: 'Back to drills' }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeading eyebrow="Drills" title="kubectl dojo">
            Read the task, then type the command you would run. The alias{' '}
            <code className="font-mono">k</code> works, and flags can come in any order.
          </PageHeading>
          <CommandDojo
            tasks={DOJO}
            ids={ids}
            solved={ids.filter((id) => progress.done[id] !== undefined)}
            xpPerTask={DOJO_XP}
          />
        </div>
      </main>
    </AppShell>
  );
}
