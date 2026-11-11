# ADR-0012: Track study time with a browser heartbeat, in the learner document

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** repository owner

## Context

The owner asked for a study streak map on the home page, like a contribution graph. Each learner sees how many days they studied and how much time they spent on each day. Only the learner sees their own map.

The app records finished items per day in each course tracker (`days`). It does not record time. A day with no finished item, such as a day of reading, does not show.

Constraints:

- The map covers one year, which is 371 days at most.
- The home page already reads one document per request: `learners/{uid}`.
- A learner can leave a tab open overnight. That is not study.
- A day is the learner's local day, not the UTC day.

## Decision

We will count time in the browser and add it to a new optional map, `studyTime`, in `learners/{uid}`. The map holds the local day and the seconds on that day, for all courses together.

- `useStudyTimer`, mounted by the shell on every course page, adds 5 seconds every 5 seconds. It adds time only when the tab is visible and the learner used the page in the last 5 minutes.
- It sends the total to `POST /api/study-time` once a minute, and sends the rest with `keepalive` when the learner leaves the page.
- The server accepts 1 to 300 seconds in one report, caps a day at 24 hours, and accepts the client day only within one day of the server clock (`trustedDay`).
- The map keeps the newest 400 days, the same limit as `days`.
- A day counts as studied from 60 seconds, or when the learner finished an item on it. So the map shows activity from before time tracking began.

## Alternatives considered

### Option A — a heartbeat into the learner document (chosen)

The home page reads the map with the document it already reads. One learner writes about once a minute while they study, far below one write a second per document. The map is bounded, so the document stays small.

### Option B — a subcollection of sessions, `learners/{uid}/sessions/{id}`

This keeps an exact log of each visit. But the home page then needs a query of up to a year of rows on every request. Nothing needs the log.

### Option C — derive time from finished items only

This needs no new write. But a day of reading shows as nothing, and the owner asked for time.

### Option D — `navigator.sendBeacon`

A beacon cannot carry a timeout and sends no JSON content type by default. `fetch` with `keepalive` survives the page close the same way.

## Consequences

**Good**

- No new read on the home page, and no new collection or index.
- Old documents need no backfill: an absent map reads as no time.

**Bad**

- One write a minute per active learner costs more than the item writes alone.
- A learner can inflate their own time up to 24 hours a day. The map is private, so this harms only that learner.
- Time on the home page and the profile does not count, because those pages are not inside a course.

## When to revisit

- A feature needs time across learners, such as a leaderboard. That needs a separate, denormalised collection.
- The write rate becomes a cost problem. Then report every 5 minutes instead.
