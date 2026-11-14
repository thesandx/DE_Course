import type { Metadata } from 'next';

import { Cheatsheet } from '@/components/k8s/Cheatsheet';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { KUBECTL, ROSETTA } from '@/lib/course/k8s/cheatsheet';
import { requireK8sLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Cheatsheet',
  description:
    'Docker commands beside their Kubernetes match, and the kubectl commands of the labs, with search.',
};

export const dynamic = 'force-dynamic';

export default async function K8sCheatsheetPage() {
  const { shell } = await requireK8sLearner('/k8s/practice/cheatsheet');

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading eyebrow="Drills" title="Cheatsheet">
          What you know from Docker, and what to type in Kubernetes. Keep this page open beside your
          terminal.
        </PageHeading>
        <Cheatsheet rosetta={ROSETTA} groups={KUBECTL} />
      </main>
    </AppShell>
  );
}
