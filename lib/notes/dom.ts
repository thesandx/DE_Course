/**
 * Reads the notes editor's document, or pasted HTML, into note blocks.
 *
 * The editor is a `contenteditable` element. The browser adds whatever markup
 * its editing commands produce (`<b>` in one browser, a styled `<span>` in
 * another), and a paste brings markup from anywhere. This reader keeps only
 * what the notes format can say: headings, paragraphs, lists, checklists,
 * quotes, code, and bold, italic, underline, strike, highlight and inline
 * code. Everything else becomes its text. Scripts, styles, images and
 * attributes never survive, because nothing here copies them.
 *
 * Pure apart from reading the nodes it is given, so it runs in jsdom tests.
 */

import {
  type Block,
  type HighlightColor,
  type Inline,
  isHighlightColor,
  type ListBlock,
  type ListItem,
  normalizeInline,
  serializeNote,
  trimInline,
} from '@/lib/notes/markdown';

const SKIP = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'NOSCRIPT',
  'IFRAME',
  'OBJECT',
  'SVG',
  'IMG',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'HEAD',
  'META',
  'LINK',
  'TITLE',
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
]);

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'NAV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'HR',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TD',
  'TH',
  'DL',
  'DT',
  'DD',
  'FIGURE',
  'BODY',
]);

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === 1;
}

function hasBlockChild(element: Element): boolean {
  return Array.from(element.children).some((child) => BLOCK_TAGS.has(child.tagName));
}

/** The nearest of the four highlight colours to a CSS colour, or null for none. */
export function colorFromCss(css: string): HighlightColor | null {
  const value = css.trim().toLowerCase();
  if (value === '' || value === 'transparent' || value === 'initial' || value === 'inherit') {
    return null;
  }
  const rgb = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/.exec(value);
  let r: number;
  let g: number;
  let b: number;
  if (rgb !== null) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return null;
    r = Number(rgb[1]);
    g = Number(rgb[2]);
    b = Number(rgb[3]);
  } else {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1];
    if (hex === undefined) return 'yellow';
    const full = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // White or near grey is "no highlight": pasted text often carries a page background.
  if (max - min < 24) return null;
  let hue: number;
  if (max === r) hue = ((g - b) / (max - min)) * 60;
  else if (max === g) hue = (2 + (b - r) / (max - min)) * 60;
  else hue = (4 + (r - g) / (max - min)) * 60;
  if (hue < 0) hue += 360;
  if (hue >= 30 && hue < 75) return 'yellow';
  if (hue >= 75 && hue < 190) return 'green';
  if (hue >= 190 && hue < 290) return 'purple';
  return hue < 30 && hue >= 15 ? 'yellow' : 'pink';
}

type Wrapper = 'bold' | 'italic' | 'underline' | 'strike';

/** What an element's tag and inline style say about formatting. */
function formatsOf(element: HTMLElement): { wrappers: Wrapper[]; mark: HighlightColor | null } {
  const wrappers: Wrapper[] = [];
  const tag = element.tagName;
  const style = element.style;
  const weight = style.fontWeight;
  const boldTag = tag === 'B' || tag === 'STRONG';
  // Google Docs wraps a whole paste in <b style="font-weight:normal">.
  if (
    (boldTag && weight !== 'normal' && weight !== '400') ||
    weight === 'bold' ||
    Number(weight) >= 600
  ) {
    wrappers.push('bold');
  }
  if (tag === 'I' || tag === 'EM' || style.fontStyle === 'italic') wrappers.push('italic');
  const decoration = `${style.textDecoration} ${style.textDecorationLine}`;
  if (tag === 'U' || tag === 'INS' || decoration.includes('underline')) wrappers.push('underline');
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || decoration.includes('line-through')) {
    wrappers.push('strike');
  }
  let mark: HighlightColor | null = null;
  if (tag === 'MARK') {
    const color = element.getAttribute('data-color') ?? '';
    mark = isHighlightColor(color) ? color : 'yellow';
  } else if (style.backgroundColor !== '') {
    mark = colorFromCss(style.backgroundColor);
  }
  return { wrappers, mark };
}

function textOf(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (!isElement(node)) return '';
  if (node.tagName === 'BR') return '\n';
  if (SKIP.has(node.tagName)) return '';
  const inner = Array.from(node.childNodes).map(textOf).join('');
  return BLOCK_TAGS.has(node.tagName) && !inner.endsWith('\n') ? `${inner}\n` : inner;
}

/** Reads inline content. Block elements inside it become line breaks. */
function readInline(nodes: readonly Node[]): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    if (node.nodeType === 3) {
      const text = (node.nodeValue ?? '').replace(/ /g, ' ').replace(/[\t\n\r ]+/g, ' ');
      if (text !== '') out.push({ type: 'text', text });
      continue;
    }
    if (!isElement(node) || SKIP.has(node.tagName)) continue;
    const tag = node.tagName;
    if (tag === 'BR') {
      out.push({ type: 'break' });
      continue;
    }
    if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP' || tag === 'TT') {
      const text = (node.textContent ?? '').replace(/ /g, ' ');
      if (text !== '') out.push({ type: 'code', text });
      continue;
    }
    if (tag === 'UL' || tag === 'OL') continue;
    let children = readInline(Array.from(node.childNodes));
    if (BLOCK_TAGS.has(tag)) {
      if (out.length > 0 && out[out.length - 1]?.type !== 'break') out.push({ type: 'break' });
      out.push(...trimInline(children));
      continue;
    }
    const { wrappers, mark } = formatsOf(node);
    for (const wrapper of wrappers) children = [{ type: wrapper, children }];
    if (mark !== null) children = [{ type: 'mark', color: mark, children }];
    out.push(...children);
  }
  return out;
}

function clean(nodes: readonly Inline[]): Inline[] {
  return trimInline(normalizeInline(nodes));
}

function readList(element: Element): ListBlock {
  const check = element.getAttribute('data-type') === 'check';
  const list: ListBlock = {
    type: 'list',
    style: check ? 'check' : element.tagName === 'OL' ? 'number' : 'bullet',
    items: [],
  };
  for (const child of Array.from(element.children)) {
    if (child.tagName === 'UL' || child.tagName === 'OL') {
      // Chrome's indent command puts a nested list straight inside the list,
      // after the item it belongs to.
      const nested = readList(child);
      const last = list.items[list.items.length - 1];
      if (last === undefined) list.items.push(...nested.items);
      else if (last.children === null) last.children = nested;
      else last.children.items.push(...nested.items);
      continue;
    }
    const nested = Array.from(child.children).filter(
      (grand) => grand.tagName === 'UL' || grand.tagName === 'OL',
    );
    const item: ListItem = {
      content: clean(readInline(Array.from(child.childNodes))),
      checked: child.getAttribute('data-checked') === 'true',
      children: null,
    };
    for (const sub of nested) {
      const read = readList(sub);
      if (item.children === null) item.children = read;
      else item.children.items.push(...read.items);
    }
    list.items.push(item);
  }
  return list;
}

/** Reads the block structure under `root`. */
export function readBlocks(root: Node): Block[] {
  const blocks: Block[] = [];
  let pending: Node[] = [];
  const flush = (): void => {
    const content = clean(readInline(pending));
    if (content.length > 0) blocks.push({ type: 'paragraph', content });
    pending = [];
  };

  for (const node of Array.from(root.childNodes)) {
    if (!isElement(node)) {
      pending.push(node);
      continue;
    }
    const tag = node.tagName;
    if (SKIP.has(tag)) continue;
    if (!BLOCK_TAGS.has(tag)) {
      pending.push(node);
      continue;
    }
    flush();

    if (/^H[1-6]$/.test(tag)) {
      // The editor writes level 1 as <h2> (the page owns <h1>), so h1 and h2 are both level 1.
      const n = Number(tag.slice(1));
      const level = n <= 2 ? 1 : n === 3 ? 2 : 3;
      const content = clean(readInline(Array.from(node.childNodes)));
      if (content.length > 0) blocks.push({ type: 'heading', level, content });
    } else if (tag === 'UL' || tag === 'OL') {
      const list = readList(node);
      if (list.items.length > 0) blocks.push(list);
    } else if (tag === 'BLOCKQUOTE') {
      const content = clean(readInline(Array.from(node.childNodes)));
      if (content.length > 0) blocks.push({ type: 'quote', content });
    } else if (tag === 'PRE') {
      const text = textOf(node).replace(/ /g, ' ').replace(/\n$/, '');
      if (text.trim() !== '') {
        blocks.push({ type: 'code', language: node.getAttribute('data-lang') ?? '', text });
      }
    } else if (tag === 'HR') {
      blocks.push({ type: 'rule' });
    } else if (tag === 'LI') {
      const content = clean(readInline(Array.from(node.childNodes)));
      if (content.length > 0) {
        blocks.push({
          type: 'list',
          style: 'bullet',
          items: [{ content, checked: false, children: null }],
        });
      }
    } else if (hasBlockChild(node)) {
      blocks.push(...readBlocks(node));
    } else {
      const content = clean(readInline(Array.from(node.childNodes)));
      if (content.length > 0) blocks.push({ type: 'paragraph', content });
    }
  }
  flush();
  return blocks;
}

/** The note's Markdown for the editor's document, or for pasted HTML. */
export function domToMarkdown(root: Node): string {
  return serializeNote(readBlocks(root));
}
