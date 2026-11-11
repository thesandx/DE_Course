import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/AppShell';
import { PageHeading } from '@/components/layout/PageHeading';
import { NotesLibrary, type NotesLibraryItem } from '@/components/notes/NotesLibrary';
import { KIND_LABEL } from '@/lib/notes/targets';
import { requireLearner } from '@/services/learner.service';
import { listNotes } from '@/services/notes.service';

export const metadata: Metadata = {
  title: 'My notes',
  description: 'Every note you wrote in the courses, in one place, for revision.',
  robots: { index: false, follow: false },
};

// Reads the session cookie, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * `GET /notes` — the learner's notes from every chapter of every course, most
 * recently edited first, with search, a course filter and a download of the
 * lot as one Markdown file. Notes are written on the chapter pages; this page
 * is for revision.
 */
export default async function NotesPage() {
  const { user, shell } = await requireLearner('/notes');
  const { notes, more } = await listNotes(user.uid);

  const items: NotesLibraryItem[] = notes.map((note) => ({
    key: note.key,
    markdown: note.markdown,
    editedAt: note.editedAt,
    title: note.target.title,
    group: note.target.group,
    kind: KIND_LABEL[note.target.kind],
    course: note.target.course,
    href: note.target.href,
  }));

  return (
    <AppShell {...shell}>
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-8 md:pt-8">
        <PageHeading eyebrow="Revision" title="My notes">
          {items.length === 0
            ? 'Notes you write on a lesson, problem, station or lab collect here.'
            : `${items.length} ${items.length === 1 ? 'chapter' : 'chapters'} with notes${more ? ', most recent first' : ''}`}
        </PageHeading>
      </div>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 md:py-8">
        <NotesLibrary items={items} />
      </main>
    </AppShell>
  );
}
