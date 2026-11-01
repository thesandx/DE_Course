# ADR-0008: Host several courses, with one learner document that holds a tracker per course

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** repository owner
- **Supersedes:** the storage location in [ADR-0006](./0006-store-course-content-in-code-and-progress-in-one-document.md). The rest of ADR-0006 stays in force.

## Context

The app started as one course, the senior data engineering (DE) course. The owner now adds a second course, GCP Professional Data Engineer exam prep. A Kubernetes course comes later.

Requirements:

- A learner joins each course separately.
- Each course keeps its own tracker: its own XP, streak and progress.
- The GCP course keeps the game structure of its source lab: metro lines, stations, boss rounds, flashcards, a sprint and a mock exam.
- The existing DE learners keep their progress.

ADR-0006 stores one `{ done, days }` record per learner in `progress/{uid}`. That record has no place for a second course, and no place to record that a learner joined a course.

## Decision

We will store each learner in one document, `learners/{uid}`, with two maps keyed by course slug:

- `enrolled`: course to the day the learner joined it.
- `courses`: course to that course's tracker, the same `{ done, days }` shape as ADR-0006.

`COURSE_SLUGS` in `lib/course/courses.ts` fixes the allowed keys. `lib/course/rules.ts` gives each course its own item check and XP table, so the server refuses an item id that the course does not have.

We will not migrate `progress/{uid}` in bulk. A learner with no `learners` document but with a `progress` document reads as enrolled in the DE course, with that record. Their first write copies it into `learners/{uid}` inside the same transaction. The app never writes `progress` again.

Each course lives under its own URL prefix: `/de/...` and `/gcp/...`. The old DE paths (`/tracks`, `/problems`, `/companies`) redirect permanently to `/de/...`.

## Alternatives considered

### Option A — one learner document with a map per course (chosen)

Every signed-in page needs the enrollments (for the navigation) and the tracker of one course. One document gives both in one key lookup. The number of courses is fixed in code, so the document stays bounded.

### Option B — one document per learner per course, `learners/{uid}/courses/{course}`

Each tracker would grow alone. But the navigation needs every enrollment on every page, so each page would read several documents. With three courses of a few hundred keys each, the single document is still far below the 1 MiB limit.

### Option C — keep `progress/{uid}` and add `gcpProgress/{uid}`

This needs no read of old data. But each new course adds a collection, a repository and an index entry, and the enrollments still need a home.

### Option D — migrate every `progress` document with a script

The read path would be simpler. But a bulk write needs a dry run, a restore point and a human with production access. The lazy copy gives the same result with no bulk write.

## Consequences

**Good**

- One read per page, and one transactional write per finished item, as before.
- A new course needs a slug, a rules entry and its pages. It needs no new collection.
- DE learners keep their progress with no migration.

**Bad**

- A learner who never returns keeps an old `progress` document. It costs storage only.
- A learner with no `learners` document costs two reads per page until their first write.
- Each course has its own XP scale, so a level or a rank never mixes courses. Only the hub total adds them.

**Neutral**

- `firestore.indexes.json` exempts `enrolled` and `courses` from indexing, because nothing queries inside them.

## Revisit when

- The platform has more than about ten courses, or the document passes 100 KiB.
- A feature needs a query across learners, such as a leaderboard for one course.

## References

- [`services/progress.service.ts`](../../services/progress.service.ts) — the repository, the transaction and the lazy copy
- [`lib/course/courses.ts`](../../lib/course/courses.ts) — the course list
- [`lib/course/README.md`](../../lib/course/README.md) — how to add a course
- [`lib/course/gcp/README.md`](../../lib/course/gcp/README.md) — the GCP course and its game rules
