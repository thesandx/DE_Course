import type { Metadata } from 'next';

import { LineCard } from '@/components/gcp/LineCard';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { LINES } from '@/lib/course/gcp/catalog';
import { requireGcpLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Line map',
  description: 'The five exam domains of the GCP Professional Data Engineer exam, as metro lines.',
};

export const dynamic = 'force-dynamic';

export default async function GcpLinesPage() {
  const { progress, shell } = await requireGcpLearner('/gcp/lines');

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading eyebrow="GCP course" title="Line map">
          Each exam domain is a line and each exam section is a station. Ride a line end to end,
          then beat its boss. Start with the line you feel weakest on, or ride them in order.
        </PageHeading>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINES.map((line) => (
            <li key={line.slug}>
              <LineCard line={line} done={progress.done} />
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
