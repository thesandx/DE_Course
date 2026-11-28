import { describe, expect, it } from 'vitest';

import { ruleViolation, stripComments } from '@/lib/runner/code-rules';
import type { RunnableSpec } from '@/types/runner';

const base: RunnableSpec = {
  language: 'sql',
  task: '',
  starter: '',
  solution: '',
  cases: [{ name: 'Sample' }],
};

describe('ruleViolation', () => {
  it('passes code when the spec has no rules', () => {
    expect(ruleViolation(base, 'SELECT 1')).toBeNull();
  });

  it('fails code that uses a forbidden pattern, whatever the case', () => {
    const spec = {
      ...base,
      rules: [{ kind: 'forbid' as const, pattern: 'percentile_cont', message: 'No.' }],
    };
    expect(ruleViolation(spec, 'SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)')).toBe(
      'No.',
    );
    expect(ruleViolation(spec, 'SELECT AVG(x)')).toBeNull();
  });

  it('ignores a forbidden word in a comment', () => {
    const spec = {
      ...base,
      rules: [{ kind: 'forbid' as const, pattern: 'median', message: 'No.' }],
    };
    expect(ruleViolation(spec, '-- no MEDIAN here\nSELECT 1 /* or MEDIAN */')).toBeNull();
  });

  it('fails code that lacks a required pattern', () => {
    const spec = {
      ...base,
      rules: [{ kind: 'require' as const, pattern: 'balance\\s*-', message: 'Need it.' }],
    };
    expect(ruleViolation(spec, 'UPDATE w SET balance = 20')).toBe('Need it.');
    expect(ruleViolation(spec, 'UPDATE w SET balance = balance - 80')).toBeNull();
  });
});

describe('stripComments', () => {
  it('removes Python comments', () => {
    expect(stripComments('x = 1  # for loop\nfor_each = 2', 'python')).not.toContain('loop');
  });
});
