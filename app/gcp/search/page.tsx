import type { Metadata } from 'next';

import { CourseSearchScreen } from '@/components/course/CourseSearchScreen';
import { AppShell } from '@/components/layout/AppShell';
import { requireGcpLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Search',
  description:
    'Search every line, station and concept in the GCP Professional Data Engineer course.',
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function GcpSearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const { shell } = await requireGcpLearner('/gcp/search');
  return (
    <AppShell {...shell}>
      <CourseSearchScreen course="gcp" query={q} />
    </AppShell>
  );
}
