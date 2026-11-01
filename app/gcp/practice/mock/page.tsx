import type { Metadata } from 'next';

import { QuizRun } from '@/components/gcp/QuizRun';
import { AppShell } from '@/components/layout/AppShell';
import {
  LINES,
  MOCK_PASS_ID,
  MOCK_QUESTIONS,
  MOCK_XP,
  PASS_RATIO,
  questionsForLine,
} from '@/lib/course/gcp/catalog';
import { requireGcpLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Mock exam',
  description:
    'A 50-question GCP Professional Data Engineer mock exam, weighted by exam domain, with a review of every miss.',
};

export const dynamic = 'force-dynamic';

export default async function GcpMockPage() {
  const { progress, shell } = await requireGcpLearner('/gcp/practice/mock');

  return (
    <AppShell
      {...shell}
      variant="focus"
      crumbs={[
        { label: 'GCP course', href: '/gcp' },
        { label: 'Drills', href: '/gcp/practice' },
        { label: 'Mock exam' },
      ]}
      back={{ fallbackHref: '/gcp/practice', label: 'Back to drills' }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <QuizRun
            mode="mock"
            title="Mock exam"
            story="Fifty scenario questions across all five domains, in the same proportions as the real exam. Read each scenario for the constraint that decides it: least privilege, lowest ops, latency or region."
            groups={LINES.map((line) => ({
              line: { slug: line.slug, short: line.short, weight: line.weight },
              questions: questionsForLine(line.slug),
            }))}
            count={MOCK_QUESTIONS}
            passRatio={PASS_RATIO}
            itemId={MOCK_PASS_ID}
            xp={MOCK_XP}
            done={progress.done[MOCK_PASS_ID] !== undefined}
            backHref="/gcp"
            backLabel="Back to the course"
          />
        </div>
      </main>
    </AppShell>
  );
}
