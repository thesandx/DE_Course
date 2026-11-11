import { describe, expect, it } from 'vitest';

import {
  type Block,
  blocksToHtml,
  noteToPlainText,
  parseInline,
  parseNote,
  serializeNote,
} from '@/lib/notes/markdown';

function roundTrip(markdown: string): string {
  return serializeNote(parseNote(markdown));
}

describe('parseInline', () => {
  it('reads bold, italic, underline, strike, highlight and code', () => {
    expect(parseInline('**b** *i* ++u++ ~~s~~ ==m== `c`')).toEqual([
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'i' }] },
      { type: 'text', text: ' ' },
      { type: 'underline', children: [{ type: 'text', text: 'u' }] },
      { type: 'text', text: ' ' },
      { type: 'strike', children: [{ type: 'text', text: 's' }] },
      { type: 'text', text: ' ' },
      { type: 'mark', color: 'yellow', children: [{ type: 'text', text: 'm' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'c' },
    ]);
  });

  it('reads a highlight colour', () => {
    expect(parseInline('=={green}key term==')).toEqual([
      { type: 'mark', color: 'green', children: [{ type: 'text', text: 'key term' }] },
    ]);
  });

  it('nests formatting', () => {
    expect(parseInline('==a **b** c==')).toEqual([
      {
        type: 'mark',
        color: 'yellow',
        children: [
          { type: 'text', text: 'a ' },
          { type: 'bold', children: [{ type: 'text', text: 'b' }] },
          { type: 'text', text: ' c' },
        ],
      },
    ]);
  });

  it('leaves unmatched or spaced markers as text', () => {
    expect(parseInline('a == b and 2 * 3 * 4 and C++')).toEqual([
      { type: 'text', text: 'a == b and 2 * 3 * 4 and C++' },
    ]);
  });

  it('keeps markers inside code as text', () => {
    expect(parseInline('`a ** b`')).toEqual([{ type: 'code', text: 'a ** b' }]);
  });

  it('reads escapes', () => {
    expect(parseInline('\\*not italic\\*')).toEqual([{ type: 'text', text: '*not italic*' }]);
  });
});

describe('parseNote', () => {
  it('reads headings, lists, checklists, quotes, code and rules', () => {
    const blocks = parseNote(
      [
        '# Title',
        '## Sub',
        '### Small',
        '',
        '- one',
        '  - nested',
        '- two',
        '',
        '1. first',
        '2. second',
        '',
        '- [ ] todo',
        '- [x] done',
        '',
        '> quoted',
        '',
        '```sql',
        'SELECT 1;',
        '```',
        '',
        '---',
      ].join('\n'),
    );
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'heading',
      'heading',
      'list',
      'list',
      'list',
      'quote',
      'code',
      'rule',
    ]);
    const bullets = blocks[3] as Extract<Block, { type: 'list' }>;
    expect(bullets.style).toBe('bullet');
    expect(bullets.items[0]?.children?.items).toHaveLength(1);
    const checks = blocks[5] as Extract<Block, { type: 'list' }>;
    expect(checks.style).toBe('check');
    expect(checks.items.map((item) => item.checked)).toEqual([false, true]);
    expect(blocks[7]).toEqual({ type: 'code', language: 'sql', text: 'SELECT 1;' });
  });

  it('keeps line breaks inside a paragraph', () => {
    expect(parseNote('line one\nline two')).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'line one' },
          { type: 'break' },
          { type: 'text', text: 'line two' },
        ],
      },
    ]);
  });

  it('reads a code fence that never closes, as models sometimes write', () => {
    expect(parseNote('```\nx = 1')).toEqual([{ type: 'code', language: '', text: 'x = 1' }]);
  });
});

describe('serializeNote', () => {
  it('round-trips the whole dialect', () => {
    const note = [
      '# Window functions',
      '',
      'Use ==ROW_NUMBER== for **dedup**, *not* ++DISTINCT++ or ~~GROUP BY~~.',
      '',
      '- Partition by the key',
      '  - then order by =={pink}updated_at== desc',
      '- Keep `rn = 1`',
      '',
      '1. Write the CTE',
      '2. Filter',
      '',
      '- [ ] Practise LAG',
      '- [x] Read the lesson',
      '',
      '> Interviewers love QUALIFY',
      '',
      '```sql',
      'SELECT *',
      'FROM t',
      '```',
      '',
      '---',
    ].join('\n');
    expect(roundTrip(note)).toBe(note);
  });

  it('escapes text that would read back as formatting', () => {
    const blocks: Block[] = [
      { type: 'paragraph', content: [{ type: 'text', text: 'a == b, 2*3, C++ and ~~x' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '- not a list' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '1. not numbered' }] },
    ];
    const markdown = serializeNote(blocks);
    expect(parseNote(markdown)).toEqual(blocks);
  });

  it('moves spaces outside a wrapper so it reads back', () => {
    const markdown = serializeNote([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'a' },
          { type: 'bold', children: [{ type: 'text', text: ' b ' }] },
          { type: 'text', text: 'c' },
        ],
      },
    ]);
    expect(markdown).toBe('a **b** c');
  });

  it('fences inline code that holds a backtick', () => {
    const markdown = serializeNote([
      { type: 'paragraph', content: [{ type: 'code', text: 'a`b' }] },
    ]);
    expect(parseNote(markdown)).toEqual([
      { type: 'paragraph', content: [{ type: 'code', text: 'a`b' }] },
    ]);
  });

  it('drops empty blocks', () => {
    expect(serializeNote([{ type: 'paragraph', content: [{ type: 'break' }] }])).toBe('');
  });
});

describe('blocksToHtml', () => {
  it('escapes every character of text, so a note cannot inject markup', () => {
    const html = blocksToHtml(
      parseNote('<img src=x onerror=alert(1)> ==<script>==\n\n```\n</pre><script>\n```'),
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
  });

  it('draws a checklist with its ticks', () => {
    expect(blocksToHtml(parseNote('- [x] done\n- [ ] todo'))).toBe(
      '<ul data-type="check"><li data-checked="true">done</li><li data-checked="false">todo</li></ul>',
    );
  });

  it('gives an empty note nothing to draw', () => {
    expect(blocksToHtml(parseNote(''))).toBe('');
  });
});

describe('noteToPlainText', () => {
  it('keeps the words and drops the marks', () => {
    expect(
      noteToPlainText(parseNote('## Joins\n\n- ==broadcast== **small** side\n\n```\nx\n```')),
    ).toBe('Joins\nbroadcast small side\nx');
  });
});
