# ADR-0011: Keep chapter notes as Markdown, saved on the device first

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** repository owner

## Context

The owner wants a notes box in every chapter of every course. A learner writes notes for later revision. The editor must feel like a notes app: bold, highlight, code, lists and checklists, without Markdown syntax on screen. It must feel offline: typing never waits for the network. Pip, the AI helper (ADR-0009), must read the notes and format them on request.

Constraints:

- The stored note must be safe to show again. Text from a paste or a model must not carry a script into the page.
- A model must read and write the format.
- No new dependency for the editor, if the platform can do it (CLAUDE.md, dependency policy).

## Decision

We store each note as Markdown in a small dialect, and edit it in a rich `contenteditable` editor.

- **Format.** `lib/notes/markdown.ts` defines the dialect: standard Markdown plus `++underline++`, `==highlight==` and `=={green}colour==`, and GitHub checklists. It parses, writes and renders the dialect. The renderer escapes every text character and emits only its own tags.
- **Editor.** `components/notes/NoteEditor.tsx` is a `contenteditable` element with a toolbar, keyboard shortcuts and Markdown shortcuts at the start of a line. `lib/notes/dom.ts` reads its document, or pasted HTML, back into the dialect on every change. Undo and redo are the editor's own snapshots, so they also undo the highlighter and an applied Pip format.
- **Storage.** One document per chapter at `notebooks/{uid}/notes/{key}`. The key names the chapter, such as `de:lesson:sql:window-functions`. The server accepts only keys that `lib/notes/targets.ts` resolves, so a notebook holds at most one note per chapter.
- **Device first.** `hooks/useNoteSync.ts` writes every change to `localStorage` at once, and saves to the server about a second later, when the browser is back online, and when the tab is hidden. The newer `editedAt` wins on the server. An older save gets the stored note back, and the learner picks one.
- **Pip.** `POST /api/notes/format` streams a formatted copy. The learner sees it first and chooses whether to use it. The doubt helper's route reads the stored note for the page, so "check my notes" works.

## Alternatives considered

### Option A — Markdown in a custom `contenteditable` editor (chosen)

No dependency. The stored text is safe by construction and is what the model reads and writes.

### Option B — a rich text library such as Tiptap or Lexical

Rejected for now. It adds 100 KB or more to the lesson bundle, and its JSON document still needs a converter for the model. Choose it if the editor needs tables, images or collaborative editing.

### Option C — store the editor's HTML

Rejected. Stored HTML needs a sanitiser on every read. A model also writes Markdown more reliably than HTML.

### Option D — a textarea with raw Markdown

Rejected. The owner asked for a human-friendly editor, not syntax on screen.

### Option E — one document per learner with every note in it

Rejected. Hundreds of chapters at up to 20,000 characters each can pass the 1 MiB document limit.

## Consequences

- The list on `/notes` needs a composite index (`deletedAt`, `editedAt desc`) on the `notes` collection group, in `firestore.indexes.json`. Run `pnpm db:deploy` before the release.
- `document.execCommand` is deprecated, but every browser still implements it. If a browser drops it, the toolbar commands need a replacement; typing, paste, the highlighter and checklists do not use it.
- The device copy is per browser. Sign-out clears it, so the next person on a shared device cannot read it.
- A page still needs a connection to load. A service worker for full offline pages is not part of this decision.
