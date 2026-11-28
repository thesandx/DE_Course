import type { RunnableSpec, RunnerLanguage } from '@/types/runner';

/**
 * Checks the rules a spec puts on the code itself. Some mistakes give the
 * right rows on every test: a banned PERCENTILE_CONT, a Python loop where the
 * task asks for vectorised pandas, or a balance read before the UPDATE, which
 * is a lost update only when two requests race. A rule catches those. Pure,
 * so the browser and the tests share it.
 */

/** Removes comments, so a rule never fires on an explanation. */
export function stripComments(code: string, language: RunnerLanguage): string {
  if (language === 'sql') {
    return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
  }
  return code.replace(/#[^\n]*/g, ' ');
}

/** The message of the first rule the code breaks, or null when it keeps them all. */
export function ruleViolation(spec: RunnableSpec, code: string): string | null {
  const rules = spec.rules ?? [];
  if (rules.length === 0) return null;
  const bare = stripComments(code, spec.language);
  for (const rule of rules) {
    const matches = new RegExp(rule.pattern, 'i').test(bare);
    if (rule.kind === 'forbid' ? matches : !matches) return rule.message;
  }
  return null;
}
