/**
 * The check of the kubectl dojo. Pure, so the same rule runs in the browser
 * and in the tests.
 */

import type { DojoTask } from '@/types/k8s';

/** A typed command as the check reads it: no prompt, single spaces, and `k` as `kubectl`. */
export function normalizeCommand(typed: string): string {
  return typed
    .trim()
    .replace(/^\$\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/^k /, 'kubectl ');
}

/** True when the typed command matches every pattern of the task. */
export function isCommandRight(task: DojoTask, typed: string): boolean {
  const command = normalizeCommand(typed);
  if (command === '') return false;
  return task.need.every((pattern) => new RegExp(pattern).test(command));
}

/** A hint that grows with each wrong try: the first words of one answer. */
export function commandHint(task: DojoTask, tries: number): string {
  return task.answer
    .split(' ')
    .slice(0, Math.min(3, 1 + tries))
    .join(' ');
}
