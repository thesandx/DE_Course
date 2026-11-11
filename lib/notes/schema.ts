/**
 * Request and storage contracts for notes. The API routes validate with these.
 */

import { z } from 'zod';

import { isAssistantModel } from '@/lib/assistant/models';
import { FORMAT_MODES, MAX_FORMAT_INSTRUCTION, MAX_NOTE_CHARS } from '@/lib/notes/limits';
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
      .min(1, 'Write a note first, then ask Pip to format it.')
      .max(MAX_NOTE_CHARS, `Keep a note under ${MAX_NOTE_CHARS} characters.`),
    mode: z.enum(FORMAT_MODES),
    instruction: z.string().trim().max(MAX_FORMAT_INSTRUCTION).optional(),
    model: z.string().refine(isAssistantModel, 'Pick a model from the list.'),
  })
  .strict()
  .refine((input) => input.mode !== 'custom' || (input.instruction ?? '') !== '', {
    message: 'Tell Pip how to format the note.',
    path: ['instruction'],
  });

export type FormatNoteInput = z.infer<typeof formatNoteSchema>;
