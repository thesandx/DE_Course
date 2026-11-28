# ADR-0017: Keep timed mock loops in the browser's storage

- **Status:** Accepted
- **Date:** 2026-11-27
- **Deciders:** repository owner

## Context

The owner wants the DE course to prepare a learner for senior and staff interview loops. A timed mock runs a whole loop: up to six rounds and up to six hours. Each round has a clock, one to three questions, hints, an editor or a draft box, and a review where the learner ticks the signals that the answer covered. The end is a scorecard with a hiring verdict.

A learner can refresh the page, close the tab, or come back the next day. The mock must resume where it was, with the clock.

The state of a mock is:

- The loop and the seed, which pick the questions.
- For each round: when it started and ended, the pauses, and the time-out.
- For each question: the hints taken, the best Submit, and the ticked signals.
- The learner's code and drafts. These can be long.

## Decision

We will keep the state of a mock in the browser's `localStorage`, and nothing in Firestore:

- The session is under `mock:<loop>:<seed>`. Its zod schema is in `lib/course/mock-session.ts`. A saved session that does not parse, or that does not match the questions of its seed, is ignored.
- The code and the drafts of a session are under `mock:<loop>:<seed>:code:<slug>` and `mock:<loop>:<seed>:draft:<slug>`. "Retry these questions" removes them.
- The last 20 scorecards are under `mock:history`.
- The seed is in the URL (`/de/mock/<loop>?seed=<n>`), so a URL always shows the same questions. Without a seed, the server picks one whose questions the learner has mostly not solved, from the learner's progress, and redirects.
- A mock does not change progress or XP. A mock is practice under the clock, and a problem counts as solved only on its own page.

## Alternatives considered

### Option A — browser storage (chosen)

No write goes to the server for a hint, a Submit or a tick. A refresh resumes at once, with the clock. There is no new collection, schema migration, route or index. The data stays private to the device.

### Option B — a Firestore collection of sessions

A `mock-sessions/{id}` document per mock, owned by the learner's uid, would resume on another device and keep the history across devices. But it needs write routes behind `requireUser()`, an ownership check, a schema and a retention policy. Code and drafts change on each keystroke, so they would need their own writes, with a delay to group the keystrokes. We can add this later without a change to the screens, because the session is already a plain, validated object.

### Option C — the state in the URL

The URL could carry the whole state, so a learner could share it. But code and drafts do not fit in a URL, and the URL would change on each keystroke.

## Consequences

**Good**

- No cost and no new server code.
- A refresh or a closed tab resumes the mock, with the clock.
- The transitions are pure functions, tested without timers or a browser.

**Bad**

- A mock does not move between devices. A learner who starts on a laptop cannot finish on a phone.
- Clearing site data removes the mocks and the history.
- When storage is blocked, as in some private windows, the mock lives in memory only, and a refresh starts it again.
- The clock runs while the learner is away, unless they pause it. This is on purpose, as in a real loop, and the briefing says so.

**Neutral**

- The scorecard history is for the learner on this device only. The readiness dials on the dashboard do not use it.

## Revisit when

- Learners ask to resume a mock on another device, or to keep the history when they change device.
- The owner wants mock scores in the readiness dials or in XP.

## References

- `lib/course/mock.ts`, `lib/course/mock-session.ts`, `lib/course/mock-score.ts`
- `hooks/useMockSession.ts`, `components/mock/`
- `lib/course/README.md` > Timed mock loops
