# ADR-0015: Keep note images in the bucket, and send them through the server

- **Status:** Accepted
- **Date:** 2026-11-21
- **Deciders:** repository owner
- **Extends:** [ADR-0011](./0011-keep-chapter-notes-as-markdown-on-the-device-first.md). ADR-0011 stays in force.

## Context

The owner wants to add images to chapter notes: a screenshot of a query plan, a diagram, a photo of a whiteboard. A note is Markdown in one Firestore document of at most 20,000 characters (ADR-0011). An image does not fit in it.

The template's upload recipe is a signed PUT URL straight to Cloud Storage, then `finalizeUpload` (trap 14). That recipe needs the app's origins in `cloud/storage-cors.json`, which is empty today, and three requests per file.

## Decision

We will keep each note image in the app bucket, and the browser will send it through the app server.

- **Shrink first.** The browser shrinks every image to a JPEG of at most 1,600 px on its longest side (`hooks/useNoteImageUpload.ts`). A phone photo of about 4 MB becomes about 300 KB. The ceiling is 1.5 MB.
- **One request.** `POST /api/notes/images` takes the JPEG bytes. It needs a session. The server checks the type, the size and the JPEG signature, and then writes the object itself (`services/note-image.service.ts`). Nothing unchecked lands, so the `tmp/` quarantine is not needed.
- **Path.** `note-images/<uid>/<id>.jpg`. The id is 18 random bytes, so it is not sequential and not guessable. The uid comes from the session.
- **The note stores the id only.** The line is `![caption](/api/notes/images/<id>)`. The parser accepts no other image URL, so a note never loads a picture from another site.
- **Read.** `GET /api/notes/images/<id>` reads the uid from the session and answers with a redirect to a signed URL of 30 minutes. A learner can only load images from their own folder, whatever id a note names.
- **Pip.** When a question names the learner's notes, the route attaches up to 2 note images by signed URL. The format prompt keeps every image line in place.
- **Limits.** 5 images per add, and 40 uploads per learner per 10 minutes per instance.

## Alternatives considered

### Option A: through the server (chosen)

One request, no CORS rule, and the server sees every byte before it stores it. The cost is a few hundred kilobytes through Cloud Run per image. That is far under the 32 MiB request limit.

### Option B: the signed upload recipe

Rejected for now. It needs a CORS change and a bootstrap run before the first upload, and three requests per image. It is the right choice for large files, and the code for it stays in `services/storage.service.ts`.

### Option C: base64 in the note

Rejected. One image would use most of the 20,000 characters, and every save would send it again.

## Consequences

- An image needs a connection. The text of a note is still saved on the device first; an image is not.
- Removing an image from a note does not delete the object. The objects are small. A cleanup job can delete objects that no note names, later, with a dry run first (`docs/data-recovery.md`).
- Sign-out does not remove images, because they are not on the device. They are private to the learner's uid.
