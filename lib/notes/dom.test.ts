import { describe, expect, it } from 'vitest';

import { colorFromCss, domToMarkdown } from '@/lib/notes/dom';
import { blocksToHtml, parseNote } from '@/lib/notes/markdown';

function fromHtml(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  return domToMarkdown(root);
}

describe('domToMarkdown', () => {
  it('reads what the editor draws back into the same note', () => {
    const note = [
      '# Heading',
      '',
      'Text with ==highlight==, =={purple}colour==, **bold** and `code`.',
      '',
      '- [ ] todo',
      '- [x] done',
      '',
      '```python',
      'print(1)',
      '```',
    ].join('\n');
    expect(fromHtml(blocksToHtml(parseNote(note)))).toBe(note);
  });

  it('reads the markup browsers add while editing', () => {
    expect(
      fromHtml(
        '<div>plain <b>bold</b> <i>it</i> <span style="font-weight: 700">heavy</span> <span style="background-color: rgb(204, 239, 229)">green</span></div><div><br></div><div>next&nbsp;line</div>',
      ),
    ).toBe('plain **bold** *it* **heavy** =={green}green==\n\nnext line');
  });

  it('treats Google Docs’ normal-weight <b> wrapper as plain text', () => {
    expect(fromHtml('<b style="font-weight:normal"><p>Hello</p></b>')).toBe('Hello');
  });

  it('attaches a list Chrome nested straight inside a list to the item before it', () => {
    expect(fromHtml('<ul><li>a</li><ul><li>b</li></ul><li>c</li></ul>')).toBe('- a\n  - b\n- c');
  });

  it('drops scripts, styles and images, and keeps nothing but text from unknown tags', () => {
    expect(
      fromHtml(
        '<p>safe<script>alert(1)</script><style>p{}</style><img src="x"> <a href="javascript:x">link</a></p>',
      ),
    ).toBe('safe link');
  });

  it('reads line breaks inside a code block', () => {
    expect(fromHtml('<pre>a<br>b</pre>')).toBe('```\na\nb\n```');
  });

  it('reads pasted headings at any level', () => {
    expect(fromHtml('<h1>A</h1><h3>B</h3><h5>C</h5>')).toBe('# A\n\n## B\n\n### C');
  });
});

describe('colorFromCss', () => {
  it('maps a colour to the nearest highlight', () => {
    expect(colorFromCss('rgb(255, 233, 168)')).toBe('yellow');
    expect(colorFromCss('#ccefe5')).toBe('green');
    expect(colorFromCss('rgb(227, 221, 255)')).toBe('purple');
    expect(colorFromCss('rgb(255, 228, 236)')).toBe('pink');
  });

  it('treats white, grey and transparent as no highlight', () => {
    expect(colorFromCss('rgb(255, 255, 255)')).toBeNull();
    expect(colorFromCss('transparent')).toBeNull();
    expect(colorFromCss('rgba(255, 0, 0, 0)')).toBeNull();
  });
});
