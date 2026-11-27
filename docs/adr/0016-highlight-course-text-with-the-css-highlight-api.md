# ADR-0016: Highlight the course text with the CSS Highlight API, and keep text quotes

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** repository owner
- **Extends:** [ADR-0011](./0011-keep-chapter-notes-as-markdown-on-the-device-first.md). ADR-0011 stays in force.

## Context

The owner wants to mark the course text itself, like a highlighter on a printed page. The learner selects a passage in a lesson, taps "Highlight", and the mark stays. A tap on a mark removes it or changes its colour. The owner also asked for a bright marker yellow (`#FFFF00`).

The lesson text is a Server Component (`components/course/Prose.tsx`). A lesson can change in a later release. A learner uses a phone and a laptop.

## Decision

- **Draw with the CSS Custom Highlight API.** `components/notes/TextHighlighter.tsx` finds each mark as a DOM `Range` and adds it to `CSS.highlights`. `::highlight(text-hl-<colour>)` in `styles/globals.css` paints it. The server-rendered DOM does not change.
- **Store a text quote, not a position.** A highlight keeps its text, 32 characters on each side, a section name (`scope`) and a colour (`lib/notes/highlights.ts`). The page finds the quote again in the section's text. The context picks the right copy when the quote occurs twice. When a lesson edit removes the quote, the mark is not shown, and nothing breaks.
- **One document per chapter.** `notebooks/{uid}/highlights/{key}`, next to the chapter's note, with the same key. It holds an array of at most 200 marks, so it is bounded. `items` is exempt from indexing.
- **Device first.** `hooks/useTextHighlights.ts` writes `localStorage` at once and saves the whole list to `PUT /api/notes/highlights`. The newer change wins, as for notes. The device copy uses the notes prefix, so sign-out clears it.
- **Neon.** A fifth highlight colour, `neon` (`#FFFF00` with dark text in both modes), is added to notes and to the course text.

## Alternatives considered

### Option A: CSS Highlight API (chosen)

No DOM change, so React never sees a foreign node, and a re-render cannot break a mark. Chrome 105+, Safari 17.2+ and Firefox 140+ support it. An older browser shows the text with no bar.

### Option B: wrap the text in `<mark>` elements

This works in every browser. But it changes DOM nodes that React owns. A re-render or a client navigation can throw or drop the marks. A mark across two paragraphs needs several wrappers. Rejected.

### Option C: store a character offset or a DOM path

Small and exact. But a lesson edit moves every later offset, and the marks land on the wrong words. Rejected.

## Consequences

- A mark whose text a lesson edit removes is lost from view. It stays in the stored list until the learner's next change on that page drops it.
- An old browser gets no highlighter. The rest of the page works.
