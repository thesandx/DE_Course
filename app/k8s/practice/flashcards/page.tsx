import type { Metadata } from 'next';

import { Flashcards } from '@/components/gcp/Flashcards';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { CARD_XP, cardsFor, PORTS } from '@/lib/course/k8s/catalog';
import { requireK8sLearner } from '@/services/learner.service';

export const metadata: Metadata = {
  title: 'Flashcards',
  description: 'Kubernetes flashcards, grouped by port.',
};

export const dynamic = 'force-dynamic';

export default async function K8sFlashcardsPage() {
  const { progress, shell } = await requireK8sLearner('/k8s/practice/flashcards');
  const cards = cardsFor().map((card) => ({
    id: card.id,
    line: card.port,
    front: card.front,
    back: card.back,
  }));

  return (
    <AppShell {...shell}>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <PageHeading eyebrow="Drills" title="Flashcards">
            Read the front, say the answer in your head, then flip. Cards you know leave the pile.
          </PageHeading>
          <Flashcards
            course="k8s"
            groupWord="port"
            cards={cards}
            lines={PORTS.map((port) => ({ slug: port.slug, short: port.title, hue: port.hue }))}
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
