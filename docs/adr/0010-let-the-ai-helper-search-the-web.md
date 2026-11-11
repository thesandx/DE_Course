# ADR-0010: Let the AI helper search the web, with one Exa search per answer

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** repository owner

## Context

Pip, the AI doubt helper ([ADR-0009](./0009-answer-learner-doubts-through-openrouter.md)), knows only the page text and the model's training data. Learners ask about new releases, current limits, prices and vendor docs. The model cannot answer those questions correctly without fresh data. The owner asked for Pip to search the internet.

Constraints:

- A search costs money on every answer. The cost must be small and known.
- Every model in the dropdown must be able to search, not only some.
- Web pages are untrusted text. They must not change Pip's rules.
- The learner must see where a fact came from.

## Decision

We will use OpenRouter's `web` plugin with the Exa engine and 5 results. The learner turns it on with the "Web" button in the panel. It is off by default, and the browser remembers the choice.

- `askSchema` takes an optional `webSearch` flag. The route passes it to `streamAnswer`, which adds `plugins: [{ id: 'web', engine: 'exa', max_results: 5 }]` to the request.
- The system prompt tells the model to cite with Markdown links, to prefer the page for course facts, and to ignore instructions inside the results.
- OpenRouter returns `url_citation` annotations. The server collects them and sends them after the answer, as a trailer that starts with the ASCII record separator (`lib/assistant/sources.ts`). The panel lists them under the answer as links.
- `parseInline` now reads `[text](https://…)` links. It accepts only `http` and `https`, so a `javascript:` URL stays plain text.

## Alternatives considered

### Option A — the `web` plugin with Exa (chosen)

One fixed price for every model: about $0.007 per search for up to 10 results (OpenRouter pricing, November 2026). The results also add prompt tokens, about 2,000–4,000 per answer. Streaming and annotations work on the chat completions endpoint the helper already uses.

### Option B — the model's native search (`engine: "native"`)

Rejected. Only some models have it (no DeepSeek or Qwen). The price is different per vendor and can be higher, for example Anthropic charges per search plus the result tokens.

### Option C — the `openrouter:web_search` server tool

Rejected for now. It is in beta, and its documentation shows the Responses API, not the streaming chat completions endpoint. The model can also search several times in one answer, so the cost is not fixed. OpenRouter calls the plugin deprecated in favour of this tool. Move to it when it is stable on chat completions.

### Option D — web search always on

Rejected. Most doubts are about the page, and a search adds cost and delay to each one.

## Consequences

- An answer with web search costs about $0.01–0.02 more than one without. The per-learner rate limit and the credit limit on the OpenRouter key still cap the spend.
- If OpenRouter removes the `web` plugin, web answers fail with the usual "could not answer" message. Then move to Option C.
- Course Markdown can now hold web links. They open in a new tab.
