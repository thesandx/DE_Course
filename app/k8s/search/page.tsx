import type { Metadata } from 'next';

import { CourseSearchScreen } from '@/components/course/CourseSearchScreen';
import { AppShell } from '@/components/layout/AppShell';
import { requireK8sLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search every port, lesson, lab and incident in the Kubernetes course.',
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function K8sSearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const { shell } = await requireK8sLearner('/k8s/search');
  return (
    <AppShell {...shell}>
      <CourseSearchScreen course="k8s" query={q} />
    </AppShell>
  );
}
