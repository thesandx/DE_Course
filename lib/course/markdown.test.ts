import { describe, expect, it } from 'vitest';

import { parseInline, parseMarkdown, stripInline } from './markdown';

describe('parseMarkdown', () => {
  it('removes the common indent and reads headings and paragraphs', () => {
    const blocks = parseMarkdown(`
      ## Window functions

      A window function keeps every row.
      It adds a value per row.

      ### Frames
    `);
    expect(blocks).toEqual([
      { kind: 'heading', level: 2, text: 'Window functions' },
      { kind: 'paragraph', text: 'A window function keeps every row. It adds a value per row.' },
      { kind: 'heading', level: 3, text: 'Frames' },
    ]);
  });

  it('reads lists, with wrapped lines joined to their item', () => {
    const blocks = parseMarkdown(`
      - first item
        continues here
      - second item

      1. one
      2. two
    `);
    expect(blocks).toEqual([
      { kind: 'list', ordered: false, items: ['first item continues here', 'second item'] },
      { kind: 'list', ordered: true, items: ['one', 'two'] },
    ]);
  });

  it('keeps code fences verbatim, with their language', () => {
    const blocks = parseMarkdown(`
      ~~~sql
      SELECT 1
        FROM t;
      ~~~

      ~~~
      plain
      ~~~
    `);
    expect(blocks).toEqual([
      { kind: 'code', lang: 'sql', code: 'SELECT 1\n  FROM t;' },
      { kind: 'code', lang: 'text', code: 'plain' },
    ]);
  });

  it('reads tables and skips the rule row', () => {
    const blocks = parseMarkdown(`
      | Setting | Effect |
      |---|:---:|
      | acks=all | Durable |
    `);
    expect(blocks).toEqual([
      { kind: 'table', head: ['Setting', 'Effect'], rows: [['acks=all', 'Durable']] },
    ]);
  });

  it('reads callouts with paragraphs split by blank quote lines', () => {
    const blocks = parseMarkdown(`
      > [!trap] Watch out
      > Line one
      > continues.
      >
      > Second paragraph.
    `);
    expect(blocks).toEqual([
      {
        kind: 'callout',
        tone: 'trap',
        title: 'Watch out',
        body: ['Line one continues.', 'Second paragraph.'],
      },
    ]);
  });

  it('treats an unknown callout kind as a paragraph', () => {
    const blocks = parseMarkdown('> [!danger] Nope');
    expect(blocks).toEqual([{ kind: 'paragraph', text: '> [!danger] Nope' }]);
  });

  it('returns nothing for empty input', () => {
    expect(parseMarkdown('   \n  ')).toEqual([]);
  });
});

describe('parseInline', () => {
  it('splits text, code and bold runs', () => {
    expect(parseInline('Use «acks=all» for **durable** writes')).toEqual([
      { kind: 'text', text: 'Use ' },
      { kind: 'code', text: 'acks=all' },
      { kind: 'text', text: ' for ' },
      { kind: 'bold', text: 'durable' },
      { kind: 'text', text: ' writes' },
    ]);
  });

  it('leaves unclosed markers as text', () => {
    expect(parseInline('a «b')).toEqual([{ kind: 'text', text: 'a «b' }]);
  });

  it('strips markers for plain text', () => {
    expect(stripInline('The «ROW_NUMBER» trick is **fast**')).toBe('The ROW_NUMBER trick is fast');
  });
});
