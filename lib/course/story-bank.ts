import { z } from 'zod';

/**
 * The behavioral story bank: the themes loops ask about, the shape of one
 * story, and a pure check of how interview-ready a story sounds.
 *
 * In `lib/` because both sides need it. The API route validates with the
 * schema, and the editor shows the same rules and the strength checks as the
 * learner types. A Client Component imports the schema only with a dynamic
 * `import()`, so zod stays out of the first load; the themes and the checks
 * below do not use zod, and live in `story-bank-themes.ts`.
 */

export { STORY_THEMES, type StoryTheme, type StoryThemeSlug } from '@/lib/course/story-bank-themes';
import { STORY_THEME_SLUGS } from '@/lib/course/story-bank-themes';

/** At most this many stories per learner. Eight to ten cover a loop; twelve leaves room. */
export const MAX_STORIES = 12;

/** Characters per STAR field. About 300 words, longer than a spoken answer needs. */
export const MAX_FIELD_LENGTH = 2000;

const field = z
  .string()
  .trim()
  .max(MAX_FIELD_LENGTH, `Keep this under ${MAX_FIELD_LENGTH} characters.`);

/** The body of a save: what the learner writes. The server owns the id and the time. */
export const storyInputSchema = z
  .object({
    /** Absent for a new story. */
    id: z.uuid().optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Give the story a short title.')
      .max(120, 'Keep the title under 120 characters.'),
    themes: z
      .array(z.enum(STORY_THEME_SLUGS))
      .min(1, 'Pick at least one theme.')
      .max(4, 'Pick at most four themes. A story that fits everything fits nothing well.')
      .refine((themes) => new Set(themes).size === themes.length, 'Pick each theme once.'),
    situation: field,
    task: field,
    action: field,
    result: field,
    reflection: field,
  })
  .strict();

export type StoryInput = z.infer<typeof storyInputSchema>;

/** A stored story: the input plus the id and the last save time (ISO 8601). */
export const storySchema = storyInputSchema.extend({
  id: z.uuid(),
  updatedAt: z.iso.datetime(),
});

export type Story = z.infer<typeof storySchema>;
