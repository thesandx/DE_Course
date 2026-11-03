import type { Metadata } from 'next';

import { CourseSearchScreen } from '@/components/course/CourseSearchScreen';
import { AppShell } from '@/components/layout/AppShell';
import { requireDeLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search every topic, lesson and problem in the Senior Data Engineering course.',
};

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function DeSearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const { shell } = await requireDeLearner('/de/search');
  return (
    <AppShell {...shell}>
      <CourseSearchScreen course="de" query={q} />
    </AppShell>
  );
}
