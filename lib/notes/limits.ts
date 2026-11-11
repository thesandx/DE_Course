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

/** The ways Pip can format a note. */
export const FORMAT_MODES = ['tidy', 'revise', 'custom'] as const;
export type FormatMode = (typeof FORMAT_MODES)[number];

export const FORMAT_MODE_LABELS: Readonly<Record<FormatMode, { label: string; note: string }>> = {
  tidy: { label: 'Tidy up', note: 'Headings, bullets, key terms highlighted. Keeps every point.' },
  revise: { label: 'Revision sheet', note: 'Short key points, then questions to test yourself.' },
  custom: { label: 'My way', note: 'Tell Pip how you want it.' },
};

/** The `localStorage` key prefix for the copy of a note kept on this device. */
export const LOCAL_NOTE_PREFIX = 'loop-ready-note:';
