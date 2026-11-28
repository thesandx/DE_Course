/**
 * Request and storage contracts for notes. The API routes validate with these.
 */

import { z } from 'zod';

import { isAssistantModel } from '@/lib/assistant/models';
import {
  CONTEXT_CHARS,
  HIGHLIGHT_SCOPE_PATTERN,
  MAX_HIGHLIGHT_CHARS,
  MAX_HIGHLIGHTS,
} from '@/lib/notes/highlights';
import {
  FORMAT_MODES,
  MAX_FORMAT_INSTRUCTION,
  MAX_NOTE_CHARS,
  needsNote,
} from '@/lib/notes/limits';
import { HIGHLIGHT_COLORS } from '@/lib/notes/markdown';
import { NOTE_KEY_PATTERN } from '@/lib/notes/targets';

export const noteKeySchema = z.string().regex(NOTE_KEY_PATTERN, 'Name a chapter that takes notes.');

/** The body of `PUT /api/notes`. */
export const saveNoteSchema = z
  .object({
    key: noteKeySchema,
    markdown: z.string().max(MAX_NOTE_CHARS, `Keep a note under ${MAX_NOTE_CHARS} characters.`),
    /** When the learner last typed, on their device (ISO 8601). The newer edit wins. */
    editedAt: z.iso.datetime(),
  })
  .strict();

export type SaveNoteInput = z.infer<typeof saveNoteSchema>;

/** The body of `POST /api/notes/format`. */
export const formatNoteSchema = z
  .object({
    key: noteKeySchema,
    markdown: z
      .string()
      .trim()
      .max(MAX_NOTE_CHARS, `Keep a note under ${MAX_NOTE_CHARS} characters.`),
    mode: z.enum(FORMAT_MODES),
    instruction: z.string().trim().max(MAX_FORMAT_INSTRUCTION).optional(),
    model: z.string().refine(isAssistantModel, 'Pick a model from the list.'),
  })
  .strict()
  .refine((input) => !needsNote(input.mode) || input.markdown !== '', {
    message: 'Write a note first, then ask Pip to format it.',
    path: ['markdown'],
  })
  .refine((input) => input.mode !== 'custom' || (input.instruction ?? '') !== '', {
    message: 'Tell Pip how to format the note.',
    path: ['instruction'],
  });

export type FormatNoteInput = z.infer<typeof formatNoteSchema>;

/** One highlight on the course text. See `lib/notes/highlights.ts`. */
export const textHighlightSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9]{8,32}$/),
    scope: z.string().regex(HIGHLIGHT_SCOPE_PATTERN),
    text: z.string().min(1).max(MAX_HIGHLIGHT_CHARS),
    prefix: z.string().max(CONTEXT_CHARS),
    suffix: z.string().max(CONTEXT_CHARS),
    color: z.enum(HIGHLIGHT_COLORS),
    at: z.iso.datetime(),
  })
  .strict();

export const textHighlightsSchema = z
  .array(textHighlightSchema)
  .max(MAX_HIGHLIGHTS, `Keep under ${MAX_HIGHLIGHTS} highlights on one page.`);

/** The body of `PUT /api/notes/highlights`: every highlight on one page. */
export const saveHighlightsSchema = z
  .object({
    key: noteKeySchema,
    items: textHighlightsSchema,
    /** When the learner last changed a highlight, on their device. The newer change wins. */
    editedAt: z.iso.datetime(),
  })
  .strict();

export type SaveHighlightsInput = z.infer<typeof saveHighlightsSchema>;
