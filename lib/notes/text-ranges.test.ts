import { describe, expect, it } from 'vitest';

import { offsetOf, rangeOf, textMapOf } from '@/lib/notes/text-ranges';

function section(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

describe('textMapOf', () => {
  it('joins the text nodes and leaves out controls', () => {
    const root = section(
      '<p>Use <b>ROW_NUMBER</b> once.</p><button>Copy</button><div data-no-highlight>skip</div><p>End</p>',
    );
    expect(textMapOf(root).text).toBe('Use ROW_NUMBER once.End');
  });
});

describe('offsetOf and rangeOf', () => {
  it('turns a selection into offsets and back', () => {
    const root = section('<p>Use <b>ROW_NUMBER</b> once.</p>');
    const map = textMapOf(root);
    const bold = root.querySelector('b')?.firstChild;
    if (!bold) throw new Error('no bold text');
    expect(offsetOf(map, bold, 3)).toBe(7);
    // An element boundary: before the <b> element.
    const paragraph = root.querySelector('p');
    if (!paragraph) throw new Error('no paragraph');
    expect(offsetOf(map, paragraph, 1)).toBe(4);
    expect(offsetOf(map, root, 1)).toBe(map.text.length);

    const range = rangeOf(map, 4, 19);
    expect(range?.toString()).toBe('ROW_NUMBER once');
    expect(rangeOf(map, 5, 5)).toBeNull();
    expect(rangeOf(map, 0, 999)).toBeNull();
  });
});
