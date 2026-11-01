# ADR-0006: Store course content in code and progress in one Firestore document per learner

- **Status:** Accepted. The storage location is superseded by [ADR-0008](./0008-host-several-courses-with-one-learner-document.md).
- **Date:** 2026-11-01
- **Deciders:** repository owner

## Context

The app serves Loop Ready, a course for senior data engineer interviews. It has 11 tracks, about 50 lessons and about 70 problems. Learners sign in, and their progress must persist across devices.

Two decisions follow:

1. Where the lessons and problems live.
2. How to store each learner's progress, and how to derive XP, levels, streaks and readiness from it.

Constraints:

- The repository is public and deploys to a public URL. All content must be original.
- Every course page needs the learner's whole record: the dashboard shows totals, a track shows each lesson's state, and the problem list shows a tick for each row.
- Firestore bills per document read and allows about one sustained write per second per document.
- The XP table and the level ladder will change as the course grows.

## Decision

We will keep the course content in TypeScript modules under `lib/course/tracks/`, one module per track. Prose uses a small Markdown dialect that `lib/course/markdown.ts` parses.

We will store progress in one Firestore document per learner, `progress/{uid}`, with two bounded maps:

- `done`: item id to the day the learner finished it.
- `days`: day to the number of items finished that day, trimmed to the newest 400 days.

We will not store XP, levels, streaks or readiness. Pure functions in `lib/course/` derive them from the record and the catalogue.

## Alternatives considered

### Option A — content in code, one progress document (chosen)

Content changes go through pull requests, type checks and tests. Tests check every slug, every quiz answer index and every code fence. A page needs one key lookup for progress. A change to the XP table applies to every learner at once.

### Option B — content in Firestore or a headless CMS

Editors could change content without a deploy. But the content then needs its own schema validation, its own review flow and a read on every page. There is one author, who works in the repository, so the benefit is small and the cost is real.

### Option C — one document per completion in a subcollection

This is the usual pattern for unbounded lists. But the list is bounded by the catalogue size, and every page would need a query that reads one document per finished item. A learner who finished 100 items would cost 100 reads per page instead of 1.

### Option D — store XP and streaks as counters

Reads would need no computation. But counters drift from the record when a write fails halfway, and a change to the XP table would need a migration of every document.

## Consequences

**Good**

- One read per page for progress, and one transactional write per finished item.
- Content is reviewed, typed and tested like code.
- XP, levels and readiness can never disagree with what the learner finished.

**Bad**

- A content change needs a deploy.
- The progress document grows with the catalogue. At a few hundred items it is far below the 1 MiB limit, but a catalogue of tens of thousands of items would need Option C.
- An item id that is removed from the catalogue stays in old records. It earns no XP, because `xpForItem` returns 0 for unknown ids, but it stays in the document.

**Neutral**

- `firestore.indexes.json` exempts `done` and `days` from indexing, because nothing queries inside them.

## Revisit when

- The catalogue grows past about 2,000 items, or the document passes 100 KiB.
- Someone other than a developer needs to edit content.
- A feature needs to query across learners, such as a leaderboard. That needs a separate, denormalised collection.

## References

- [`lib/course/README.md`](../../lib/course/README.md) — how to write course content
- [`services/progress.service.ts`](../../services/progress.service.ts) — the repository and the transaction
- [`docs/firestore-modeling.md`](../firestore-modeling.md) — bounded maps and write rates
