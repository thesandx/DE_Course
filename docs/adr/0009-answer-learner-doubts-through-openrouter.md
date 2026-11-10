# ADR-0009: Answer learner doubts with an AI helper through OpenRouter, on the server

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** repository owner

## Context

The owner wants a friendly AI helper on every section of the course. A learner asks a doubt on a lesson, a problem or a lab, and gets an explanation about that page. The owner has an OpenRouter account and wants to pick the model from a dropdown.

Constraints:

- The OpenRouter key spends money. It must not reach the browser or the repository.
- Each answer must know which page the learner is on.
- A runaway client must not spend the credit.

## Decision

We will call OpenRouter only from the server, in `services/openrouter.service.ts`. The browser posts to `POST /api/assistant`, which needs a session.

- The key is the `OPENROUTER_API_KEY` secret. Secret Manager supplies it at runtime. `deploy.yml` mounts it only when the `OPENROUTER_SECRET` repository variable names the secret. Without it, the helper says it is not set up.
- The browser sends the page path, not the page text. `lib/assistant/context.ts` reads the lesson, problem, lab or station text from the catalogue and puts it in the system prompt.
- The model dropdown is an allowlist in `lib/assistant/models.ts`. The server refuses any other model id.
- Each learner gets 30 questions in 10 minutes per instance (`lib/assistant/rate-limit.ts`), and one answer is capped at 1,200 tokens.
- The answer streams back as plain text. The panel renders it with `Prose`, after it converts standard Markdown to the course dialect.
- The chat is not stored on the server. The browser keeps it per page for the session.

## Alternatives considered

### Option A — server route to OpenRouter (chosen)

One key, one place that spends money, and one place to limit it. OpenRouter gives every major model through one API, so the dropdown needs no new code per vendor.

### Option B — let the browser call OpenRouter

Rejected. The key would ship in the bundle, and anyone could spend the credit.

### Option C — one vendor SDK, such as the Anthropic or OpenAI SDK

Rejected. It adds a dependency and ties the dropdown to one vendor. `fetch` is enough for one streaming endpoint.

### Option D — store chats in Firestore

Rejected for now. A doubt is short-lived. Storage adds a collection, a privacy question and cost, for little gain. Add it later if learners ask for a history.

## Consequences

- The helper is off until an operator creates the secret and sets `OPENROUTER_SECRET`. The steps are in `cloud/environment-variables.md`.
- The rate limit is per instance, so the worst case is the limit times `MAX_INSTANCES`. Set a credit limit on the OpenRouter key as the hard cap.
- Model ids change over time. Update `lib/assistant/models.ts` when OpenRouter retires a model.
