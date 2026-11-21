/**
 * The notes feature's limits and names, shared by the browser and the server.
 *
 * No zod and no catalogue here, so a Client Component can import it without
 * pulling either into the first load.
 */

/** The longest note, in characters of its Markdown. About 3,000 words. */
export const MAX_NOTE_CHARS = 20_000;

/** The longest custom instruction a learner can give Pip for formatting. */
export const MAX_FORMAT_INSTRUCTION = 300;

/**
 * The ways Pip can help with a note. `summary` writes new notes from the
 * chapter itself and adds them under the learner's own; the others rewrite
 * the learner's note.
 */
export const FORMAT_MODES = ['summary', 'tidy', 'revise', 'custom'] as const;
export type FormatMode = (typeof FORMAT_MODES)[number];

export const FORMAT_MODE_LABELS: Readonly<Record<FormatMode, { label: string; note: string }>> = {
  summary: {
    label: 'Revision notes',
    note: 'Pip summarises this chapter for quick revision. Added under your notes.',
  },
  tidy: { label: 'Tidy up', note: 'Headings, bullets, key terms highlighted. Keeps every point.' },
  revise: { label: 'Revision sheet', note: 'Short key points, then questions to test yourself.' },
  custom: { label: 'My way', note: 'Tell Pip how you want it.' },
};

/** True for the modes that rewrite the learner's own note, and so need one. */
export function needsNote(mode: FormatMode): boolean {
  return mode !== 'summary';
}

/** The largest image a note takes, after the browser shrinks it to a JPEG. */
export const MAX_NOTE_IMAGE_BYTES = 1_500_000;

/** The longest side of a note image after shrinking. Enough to read a screenshot of code. */
export const NOTE_IMAGE_MAX_SIDE = 1_600;

/** The `localStorage` key prefix for the copy of a note kept on this device. */
export const LOCAL_NOTE_PREFIX = 'loop-ready-note:';
