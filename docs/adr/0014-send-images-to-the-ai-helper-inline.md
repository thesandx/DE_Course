# ADR-0014: Send images to the AI helper inline, not through the bucket

- **Status:** Accepted
- **Date:** 2026-11-15
- **Deciders:** repository owner
- **Extends:** [ADR-0009](./0009-answer-learner-doubts-through-openrouter.md). ADR-0009 stays in force.

## Context

The owner wants to attach images in the AI helper's chat. Typical images are a screenshot of an error, a query plan, a diagram or a photo of handwritten notes.

The app already has a file upload path: a signed upload URL to Cloud Storage, then `finalizeUpload` (trap 14). The question is whether a chat image goes through it.

## Decision

We will send each image inline in the `POST /api/assistant` body, as a JPEG data URL. We will not store it.

- The browser shrinks each image to at most 1,600 px on its longest side, as JPEG. A phone photo of about 4 MB becomes about 300 KB (`hooks/useImageAttachments.ts`).
- A question carries at most 3 images. One request carries at most 4 images; the panel drops the oldest ones first (`messagesToSend` in `lib/assistant/chat.ts`).
- The server accepts only `data:image/(png|jpeg|webp|gif);base64,...` up to about 1.5 MB each. It refuses a URL, an SVG and any other type.
- The server refuses images for a model without image input. Each row in `lib/assistant/models.ts` has an `images` flag. All nine models read images today.
- The session storage copy of the chat keeps only the number of images, not the images.
- The system prompt treats text inside an image as material, not as instructions.

## Alternatives considered

### Option A — inline data URL (chosen)

One request, no storage, no cleanup. The image goes to the model once. Nothing outlives the chat, so there is no new privacy question.

### Option B — signed upload to the bucket, then a signed read URL to OpenRouter

Rejected. It adds two round trips, a `tmp/` object to finalise and delete, and a URL that a third party fetches. Storage adds nothing, because the chat is not kept.

### Option C — send the original file

Rejected. A phone photo can be 5–10 MB. That is slow on mobile data and costs more image tokens, with no gain in what the model reads.

## Consequences

- After a page reload, the chat shows "1 image attached" in place of the image. A follow-up question then does not see the image.
- Each image adds about 1,500 input tokens to a question. The rate limit in ADR-0009 still applies.
- A model added later without image input needs `images: false`. The photo button then hides for it.
