# ADR-0019: Grade written mock answers with Pip, and credit only quoted evidence

- **Status:** Accepted
- **Date:** 2026-11-28
- **Deciders:** repository owner

## Context

A timed mock (ADR-0017) scores a question with tests mostly from its tests. A written question, such as a design, modeling, concept or behavioral question, scored only from the signals that the learner ticked after reading the model answer.

The course review of 2026-11-28 found that this is the main reason the staff score stayed flat. A learner who grades themselves is generous, and nothing asks the follow-up questions that decide a real design or behavioral round.

The doubt helper Pip already calls OpenRouter from the server (ADR-0009). The owner asked for Pip to grade written mock answers and to ask follow-ups.

## Decision

We will let Pip grade a written mock answer in the review of its round:

- `POST /api/mock/grade` takes the problem slug, the learner's answer and the model from the allowlist. It needs a session (`requireUser()`) and has a rate limit of 30 grades in 10 minutes for each learner.
- The server reads the problem's text, model answer and signals from the catalogue. The request never carries them.
- Pip answers in JSON: the signals it credits, with a short exact quote from the answer for each, one follow-up question and a short summary.
- `parseGrade` in `lib/assistant/grade.ts` keeps a signal only when its quote is in the learner's own words, after case, quotes and spaces are normalised. A grade can give credit only for what the learner wrote.
- The learner can answer the follow-up once. Pip then grades the answer and the reply together, and that grade is final.
- The grade goes into the mock session in the browser, as `pip` on the question's record. Pip's signals replace the learner's ticks, and the ticks are locked. The score and the verdict use them.
- Problems with tests are not graded by Pip. Their tests grade them.
- When the server has no OpenRouter key, the review hides Pip and the learner ticks the signals as before.

## Alternatives considered

### Option A — Pip grades, and evidence is checked on the server (chosen)

The grade is tied to the learner's words, and a model that invents a quote gives no credit. The learner sees each credited signal with its quote, so a grade can be checked by eye.

### Option B — Pip grades, and its list is trusted

Simpler, but a model can credit a signal that the answer does not show. The learner then trusts a score that is wrong in their favour, which is the problem we want to fix.

### Option C — keep self-grading, and show the follow-ups only

No cost, but no change to the flaw that the review found.

## Consequences

**Good**

- A written round scores from evidence, not from the learner's opinion.
- The follow-up makes the learner defend the weakest part of the answer, as in a real round.
- No new collection, and the mock state stays in the browser.

**Bad**

- Each grade costs a model call: two at most for each written question.
- A strict quote check can miss a signal that the learner showed in other words. The summary and the follow-up still tell them what was missing.
- A grade depends on the model the learner picked. A cheap model grades less well.

**Neutral**

- A loop that was graded by Pip and one that was ticked by hand give scores on the same scale, so the history compares them.
