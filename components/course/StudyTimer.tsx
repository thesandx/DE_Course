'use client';

import { useStudyTimer } from '@/hooks/useStudyTimer';

/**
 * Renders nothing. While a course page is open, it counts the learner's study
 * time for the streak map on the home page. A leaf, so the shell stays a
 * Server Component.
 */
export function StudyTimer() {
  useStudyTimer();
  return null;
}
