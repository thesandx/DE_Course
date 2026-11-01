import type { Metadata } from 'next';

import { Flashcards } from '@/components/gcp/Flashcards';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { CARD_XP, cardsFor, LINES } from '@/lib/course/gcp/catalog';
import { requireGcpLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Flashcards',
  description: 'GCP Professional Data Engineer flashcards, grouped by exam domain.',
};

export const dynamic = 'force-dynamic';

export default async function GcpFlashcardsPage() {
  const { progress, shell } = await requireGcpLearner('/gcp/practice/flashcards');
  const cards = cardsFor();

  return (
    <AppShell {...shell}>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeading eyebrow="Drills" title="Flashcards">
            Read the front, say the answer in your head, then flip. Cards you know leave the pile.
          </PageHeading>
          <Flashcards
            cards={cards}
            lines={LINES.map((line) => ({ slug: line.slug, short: line.short, hue: line.hue }))}
            known={cards
              .filter((card) => progress.done[card.id] !== undefined)
              .map((card) => card.id)}
            xpPerCard={CARD_XP}
          />
        </div>
      </main>
    </AppShell>
  );
}
