import { describe, expect, it } from 'vitest';

import { buildFormatMessages, unwrapAnswer } from '@/lib/notes/format';
import type { NoteTarget } from '@/lib/notes/targets';

const TARGET: NoteTarget = {
  key: 'de:lesson:sql:window-functions',
  course: 'de',
  kind: 'lesson',
  title: 'Window functions',
  group: 'SQL',
  href: '/de/tracks/sql/window-functions',
};

describe('buildFormatMessages', () => {
  it('sends the rules as the system prompt and the note as the learner’s message', () => {
    const [system, user] = buildFormatMessages(TARGET, 'rn = 1 dedup', 'tidy', undefined);
    expect(system?.role).toBe('system');
    expect(system?.content).toContain('Window functions');
    expect(system?.content).toContain('==highlight==');
    expect(user).toEqual({ role: 'user', content: 'MY NOTES:\nrn = 1 dedup' });
  });

  it('adds the learner’s own instruction only in custom mode', () => {
    const custom = buildFormatMessages(TARGET, 'x', 'custom', 'make a checklist');
    expect(custom[1]?.content).toContain('HOW I WANT IT: make a checklist');
    const tidy = buildFormatMessages(TARGET, 'x', 'tidy', 'make a checklist');
    expect(tidy[1]?.content).not.toContain('HOW I WANT IT');
  });

  it('asks for a revision sheet in revise mode', () => {
    expect(buildFormatMessages(TARGET, 'x', 'revise', undefined)[0]?.content).toContain(
      'Test yourself',
    );
  });
});

describe('unwrapAnswer', () => {
  it('removes a fence around the whole answer, closed or still streaming', () => {
    expect(unwrapAnswer('```markdown\n# Notes\n- a\n```')).toBe('# Notes\n- a');
    expect(unwrapAnswer('```md\n# Notes\n- a')).toBe('# Notes\n- a');
  });

  it('keeps an answer without a fence, and fences inside it', () => {
    expect(unwrapAnswer('# Notes\n\n```sql\nSELECT 1\n```')).toBe(
      '# Notes\n\n```sql\nSELECT 1\n```',
    );
  });
});
