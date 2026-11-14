import type { Metadata } from 'next';

import { PortCard } from '@/components/k8s/PortCard';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { portProgress, PORTS } from '@/lib/course/k8s/catalog';
import { LAB_ROOT } from '@/lib/course/k8s/lab';
import { requireK8sLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Ports',
  description:
    'The route of the Kubernetes course: 14 ports from a local cluster to a production data platform.',
};

export const dynamic = 'force-dynamic';

export default async function K8sPortsPage() {
  const { progress, shell } = await requireK8sLearner('/k8s/ports');
  const nextPort = PORTS.find((port) => !portProgress(port, progress.done).cleared);

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading eyebrow="Kubernetes course" title="Ports">
          You take one image, tugboat, from your laptop to production. Each port is one day at work:
          a problem, the Kubernetes object that fixes it, and a lab on your own cluster. Sail them
          in order. Your lab files live under <code className="font-mono">{LAB_ROOT}</code>.
        </PageHeading>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PORTS.map((port) => (
            <li key={port.slug}>
              <PortCard port={port} done={progress.done} next={port.slug === nextPort?.slug} />
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
