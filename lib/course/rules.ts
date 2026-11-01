/**
 * The per-course rules the server needs: which item ids a course has, and
 * what each is worth. The progress API checks every id against these, so a
 * client can only record items that exist, and XP always comes from here.
 *
 * Server-side use only in practice: it imports every catalogue. Client
 * components read `lib/course/courses.ts` instead.
 */

import { isKnownItem, xpForItem } from '@/lib/course/catalog';
import type { CourseSlug } from '@/lib/course/courses';
import { gcpXpForItem, isKnownGcpItem } from '@/lib/course/gcp/catalog';
import type { DoneMap } from '@/lib/course/progress';

export interface CourseRules {
  isKnownItem: (itemId: string) => boolean;
  xpForItem: (itemId: string) => number;
}

export const COURSE_RULES: Readonly<Record<CourseSlug, CourseRules>> = {
  de: { isKnownItem, xpForItem },
  gcp: { isKnownItem: isKnownGcpItem, xpForItem: gcpXpForItem },
};

export function courseXp(course: CourseSlug, done: DoneMap): number {
  const { xpForItem: xpFor } = COURSE_RULES[course];
  return Object.keys(done).reduce((sum, id) => sum + xpFor(id), 0);
}
