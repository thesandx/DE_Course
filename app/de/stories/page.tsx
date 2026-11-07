import type { Metadata } from 'next';

import { StoryBank } from '@/components/course/StoryBank';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { MAX_STORIES } from '@/lib/course/story-bank';
import { requireDeLearner } from '@/services/learner.service';
import { getStories } from '@/services/story.service';

export const metadata: Metadata = {
  title: 'Story bank',
  description:
    'Build your own behavioral stories for senior and staff loops, check each one as you write, and see which interview themes you still need.',
};

export const dynamic = 'force-dynamic';

export default async function StoryBankPage() {
  const { user, shell } = await requireDeLearner('/de/stories');
  const stories = await getStories(user.uid);

  return (
    <AppShell {...shell}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <PageHeading eyebrow="Behavioral" title="Story bank">
          Eight to ten true stories answer almost every behavioral and leadership question. Write
          each one once here, check it against what interviewers listen for, and cover every theme
          before your loop. Only you can see your stories.
        </PageHeading>
        <StoryBank initialStories={stories} maxStories={MAX_STORIES} />
      </main>
    </AppShell>
  );
}
