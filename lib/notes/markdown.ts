/**
 * The notes format: a small Markdown dialect, its parser, its writer and an
 * HTML renderer.
 *
 * ## Why a dialect, and why store Markdown at all
 *
 * The learner never sees this text. They edit in a rich editor (bold,
 * highlight, code, lists, checklists), and the editor turns its document into
 * this Markdown on every change. Markdown is what the server stores and what
 * the AI reads and writes, for three reasons:
 *
 *   - It is safe by construction. The renderer below escapes every character
 *     of text, and it emits only the tags in this file. A note cannot carry a
 *     script, a style or an event handler into the page, whatever the browser
 *     or the model sent.
 *   - A model reads and writes it natively, so "tidy my notes" is one prompt.
 *   - It is readable as plain text in the "download my notes" file.
 *
 * Standard Markdown has no underline and no highlight, so the dialect adds
 * `++underline++` and `==highlight==` (with `=={green}colour==`). Checklists
 * are GitHub style: `- [ ] item` and `- [x] item`.
 *
 * Pure: no DOM, no I/O. The editor's DOM reader lives in `lib/notes/dom.ts`.
 */

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'pink', 'purple'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'break' }
  | { type: 'code'; text: string }
  | { type: 'bold' | 'italic' | 'underline' | 'strike'; children: Inline[] }
  | { type: 'mark'; color: HighlightColor; children: Inline[] };

export type WrapperType = 'bold' | 'italic' | 'underline' | 'strike' | 'mark';

export interface ListItem {
  content: Inline[];
  /** Only meaningful in a checklist. */
  checked: boolean;
  /** A nested list under this item, if any. */
  children: ListBlock | null;
}

export interface ListBlock {
  type: 'list';
  style: 'bullet' | 'number' | 'check';
  items: ListItem[];
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; content: Inline[] }
  | { type: 'paragraph'; content: Inline[] }
  | ListBlock
  | { type: 'quote'; content: Inline[] }
  | { type: 'code'; language: string; text: string }
  | { type: 'rule' };

export function isHighlightColor(value: string): value is HighlightColor {
  return (HIGHLIGHT_COLORS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* Inline parsing                                                      */
/* ------------------------------------------------------------------ */

const DELIMITERS: ReadonlyArray<readonly [string, WrapperType]> = [
  ['**', 'bold'],
  ['++', 'underline'],
  ['~~', 'strike'],
  ['==', 'mark'],
  ['*', 'italic'],
];

const PUNCTUATION = /[!-/:-@[-`{-~]/;

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char);
}

/** Index just past a code span that opens at `at`, or -1 when it never closes. */
function codeSpanEnd(source: string, at: number): number {
  const run = /^`+/.exec(source.slice(at))?.[0] ?? '`';
  const close = source.indexOf(run, at + run.length);
  return close < 0 ? -1 : close + run.length;
}

/** Where `delimiter` closes, scanning from `from`. -1 when it does not. */
function findClose(source: string, delimiter: string, from: number): number {
  for (let index = from; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '`') {
      const end = codeSpanEnd(source, index);
      if (end > 0) index = end - 1;
      continue;
    }
    if (!source.startsWith(delimiter, index)) continue;
    // Inside italic, a `**` is a bold run, not the italic's end.
    if (delimiter === '*' && source[index + 1] === '*') {
      index += 1;
      continue;
    }
    if (index > from && !isSpace(source[index - 1])) return index;
  }
  return -1;
}

/** Parses one run of inline text. A `\n` becomes a line break. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = '';
  const flush = (): void => {
    if (text !== '') out.push({ type: 'text', text });
    text = '';
  };

  let index = 0;
  while (index < source.length) {
    const char = source[index] ?? '';
    const next = source[index + 1];

    if (char === '\\' && next !== undefined && PUNCTUATION.test(next)) {
      text += next;
      index += 2;
      continue;
    }
    if (char === '\n') {
      flush();
      out.push({ type: 'break' });
      index += 1;
      continue;
    }
    if (char === '`') {
      const run = /^`+/.exec(source.slice(index))?.[0] ?? '`';
      const end = codeSpanEnd(source, index);
      if (end > 0 && end - run.length > index + run.length) {
        let code = source.slice(index + run.length, end - run.length);
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
        flush();
        out.push({ type: 'code', text: code });
        index = end;
        continue;
      }
      text += run;
      index += run.length;
      continue;
    }

    let matched = false;
    for (const [delimiter, type] of DELIMITERS) {
      if (!source.startsWith(delimiter, index)) continue;
      let start = index + delimiter.length;
      let color: HighlightColor = 'yellow';
      if (type === 'mark') {
        const tag = /^\{([a-z]+)\}/.exec(source.slice(start));
        if (tag !== null && isHighlightColor(tag[1] ?? '')) {
          color = tag[1] as HighlightColor;
          start += tag[0].length;
        }
      }
      if (isSpace(source[start])) continue;
      const end = findClose(source, delimiter, start);
      if (end <= start) continue;
      flush();
      const children = parseInline(source.slice(start, end));
      out.push(type === 'mark' ? { type, color, children } : { type, children });
      index = end + delimiter.length;
      matched = true;
      break;
    }
    if (matched) continue;

    text += char;
    index += 1;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ */
/* Block parsing                                                       */
/* ------------------------------------------------------------------ */

const FENCE = /^\s*(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(?:\[([ xX])\](?:\s+|$))?(.*)$/;

function indentOf(spaces: string): number {
  return spaces.replace(/\t/g, '    ').length;
}

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line)
  );
}

interface RawItem {
  indent: number;
  ordered: boolean;
  check: boolean | null;
  lines: string[];
}

function newList(raw: RawItem): ListBlock {
  return {
    type: 'list',
    style: raw.check !== null ? 'check' : raw.ordered ? 'number' : 'bullet',
    items: [],
  };
}

function buildList(raws: readonly RawItem[]): ListBlock {
  const first = raws[0];
  if (first === undefined) return { type: 'list', style: 'bullet', items: [] };
  const root = newList(first);
  const stack: Array<{ indent: number; list: ListBlock }> = [{ indent: first.indent, list: root }];

  for (const raw of raws) {
    while (stack.length > 1 && raw.indent < (stack[stack.length - 1]?.indent ?? 0)) stack.pop();
    let top = stack[stack.length - 1] ?? stack[0];
    if (top === undefined) break;
    const parent = top.list.items[top.list.items.length - 1];
    if (raw.indent > top.indent && parent !== undefined) {
      if (parent.children === null) parent.children = newList(raw);
      top = { indent: raw.indent, list: parent.children };
      stack.push(top);
    }
    top.list.items.push({
      content: parseInline(raw.lines.join('\n').trim()),
      checked: raw.check === true,
      children: null,
    });
  }
  return root;
}

/** Parses a note's Markdown into blocks. Anything it does not know is text. */
export function parseNote(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence !== null) {
      const marker = (fence[1] ?? '```').slice(0, 3);
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').trim().startsWith(marker)) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      index += 1;
      blocks.push({ type: 'code', language: fence[2] ?? '', text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      const hashes = (heading[1] ?? '#').length;
      const level = hashes <= 1 ? 1 : hashes === 2 ? 2 : 3;
      blocks.push({ type: 'heading', level, content: parseInline(heading[2] ?? '') });
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] ?? '')) {
        body.push(QUOTE.exec(lines[index] ?? '')?.[1] ?? '');
        index += 1;
      }
      blocks.push({ type: 'quote', content: parseInline(body.join('\n').trim()) });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const raws: RawItem[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? '';
        const item = LIST_ITEM.exec(current);
        if (item !== null) {
          const check = item[3];
          raws.push({
            indent: indentOf(item[1] ?? ''),
            ordered: /\d/.test(item[2] ?? ''),
            check: check === undefined ? null : check !== ' ',
            lines: [item[4] ?? ''],
          });
          index += 1;
          continue;
        }
        const last = raws[raws.length - 1];
        if (current.trim() === '') {
          // A blank line between items keeps the list going ("loose" lists).
          // A list of another kind after the blank line is a new list.
          const after = LIST_ITEM.exec(lines[index + 1] ?? '');
          const first = raws[0];
          if (
            after !== null &&
            first !== undefined &&
            /\d/.test(after[2] ?? '') === first.ordered &&
            (after[3] !== undefined) === (first.check !== null)
          ) {
            index += 1;
            continue;
          }
          break;
        }
        // An indented line under an item continues that item.
        if (/^\s+\S/.test(current) && last !== undefined && !startsBlock(current.trim())) {
          last.lines.push(current.trim());
          index += 1;
          continue;
        }
        break;
      }
      blocks.push(buildList(raws));
      continue;
    }

    const body: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? '';
      if (current.trim() === '' || (body.length > 0 && startsBlock(current))) break;
      body.push(current.trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: parseInline(body.join('\n')) });
  }

  return blocks;
}

/* ------------------------------------------------------------------ */
/* Normalising inline runs                                             */
/* ------------------------------------------------------------------ */

function sameWrapper(a: Inline, b: Inline): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'mark' && b.type === 'mark') return a.color === b.color;
  return a.type === 'bold' || a.type === 'italic' || a.type === 'underline' || a.type === 'strike';
}

/**
 * Tidies a run: joins neighbouring text, merges neighbouring wrappers of the
 * same kind, drops empty wrappers and flattens a wrapper inside its own kind.
 * Without the merge, `==a====b==` would be ambiguous to read back.
 */
export function normalizeInline(
  nodes: readonly Inline[],
  inside: ReadonlySet<string> = new Set(),
): Inline[] {
  const out: Inline[] = [];
  for (const node of nodes) {
    let current: Inline[] = [node];
    if (
      node.type === 'mark' ||
      node.type === 'bold' ||
      node.type === 'italic' ||
      node.type === 'underline' ||
      node.type === 'strike'
    ) {
      const key = node.type;
      const children = normalizeInline(node.children, new Set([...inside, key]));
      if (children.length === 0) continue;
      current = inside.has(key) ? children : [{ ...node, children }];
    } else if (node.type === 'text' && node.text === '') {
      continue;
    } else if (node.type === 'code' && node.text === '') {
      continue;
    }

    for (const item of current) {
      const last = out[out.length - 1];
      if (last?.type === 'text' && item.type === 'text') {
        out[out.length - 1] = { type: 'text', text: last.text + item.text };
      } else if (
        last !== undefined &&
        'children' in last &&
        'children' in item &&
        sameWrapper(last, item)
      ) {
        out[out.length - 1] = {
          ...last,
          children: normalizeInline([...last.children, ...item.children], inside),
        } as Inline;
      } else {
        out.push(item);
      }
    }
  }
  return out;
}

/** Drops line breaks and spaces at both ends of a run. */
export function trimInline(nodes: readonly Inline[]): Inline[] {
  const out = [...nodes];
  while (out[0]?.type === 'break') out.shift();
  while (out[out.length - 1]?.type === 'break') out.pop();
  const first = out[0];
  if (first?.type === 'text') out[0] = { type: 'text', text: first.text.replace(/^\s+/, '') };
  const last = out[out.length - 1];
  if (last?.type === 'text')
    out[out.length - 1] = { type: 'text', text: last.text.replace(/\s+$/, '') };
  return out.filter((node) => node.type !== 'text' || node.text !== '');
}

/* ------------------------------------------------------------------ */
/* Writing Markdown                                                    */
/* ------------------------------------------------------------------ */

function escapeText(text: string): string {
  return text.replace(/[\\`*]/g, '\\$&').replace(/([=+~])(?=\1)/g, '\\$1');
}

/** Moves spaces at a wrapper's edges outside it: `** a**` would not read back. */
function edgeSpaces(inner: string): { lead: string; body: string; trail: string } {
  const lead = /^\s*/.exec(inner)?.[0] ?? '';
  const trail = /\s*$/.exec(inner.slice(lead.length))?.[0] ?? '';
  return { lead, body: inner.slice(lead.length, inner.length - trail.length), trail };
}

const WRAP: Readonly<Record<Exclude<WrapperType, 'mark'>, string>> = {
  bold: '**',
  italic: '*',
  underline: '++',
  strike: '~~',
};

function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

export function serializeInline(nodes: readonly Inline[]): string {
  return nodes
    .map((node): string => {
      switch (node.type) {
        case 'text':
          return escapeText(node.text);
        case 'break':
          return '\n';
        case 'code':
          return codeSpan(node.text);
        case 'mark': {
          const { lead, body, trail } = edgeSpaces(serializeInline(node.children));
          if (body === '') return lead + trail;
          const tag = node.color === 'yellow' ? '' : `{${node.color}}`;
          const safe = tag === '' && body.startsWith('{') ? `\\${body}` : body;
          return `${lead}==${tag}${safe}==${trail}`;
        }
        default: {
          const { lead, body, trail } = edgeSpaces(serializeInline(node.children));
          if (body === '') return lead + trail;
          const mark = WRAP[node.type];
          return `${lead}${mark}${body}${mark}${trail}`;
        }
      }
    })
    .join('');
}

/** Escapes what would make a paragraph line read back as another block. */
function guardLine(line: string): string {
  const numbered = /^(\s*\d{1,9})([.)])(\s)/.exec(line);
  if (numbered !== null) return `${numbered[1]}\\${line.slice((numbered[1] ?? '').length)}`;
  if (/^\s*(#{1,6}\s|>|[-+]\s|```|~~~)/.test(line) || RULE.test(line)) {
    const lead = /^\s*/.exec(line)?.[0] ?? '';
    return `${lead}\\${line.slice(lead.length)}`;
  }
  return line;
}

function serializeList(list: ListBlock, indent: string): string {
  return list.items
    .map((item, index) => {
      const marker =
        list.style === 'number'
          ? `${index + 1}. `
          : list.style === 'check'
            ? `- [${item.checked ? 'x' : ' '}] `
            : '- ';
      const pad = indent + ' '.repeat(list.style === 'check' ? 2 : marker.length);
      const [first = '', ...rest] = serializeInline(trimInline(item.content)).split('\n');
      const lines = [
        `${indent}${marker}${first}`.trimEnd(),
        ...rest.map((line) => `${pad}${guardLine(line)}`),
      ];
      if (item.children !== null && item.children.items.length > 0) {
        lines.push(serializeList(item.children, pad));
      }
      return lines.join('\n');
    })
    .join('\n');
}

function serializeBlock(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${serializeInline(trimInline(block.content)).replace(/\n/g, ' ')}`;
    case 'paragraph':
      return serializeInline(trimInline(block.content)).split('\n').map(guardLine).join('\n');
    case 'quote':
      return serializeInline(trimInline(block.content))
        .split('\n')
        .map((line) => `> ${line}`.trimEnd())
        .join('\n');
    case 'code': {
      const longest = Math.max(2, ...(block.text.match(/^`{3,}/gm) ?? []).map((run) => run.length));
      const fence = '`'.repeat(longest + 1);
      return `${fence}${block.language}\n${block.text.replace(/\n+$/, '')}\n${fence}`;
    }
    case 'rule':
      return '---';
    case 'list':
      return serializeList(block, '');
  }
}

function isEmptyBlock(block: Block): boolean {
  if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'quote') {
    return trimInline(block.content).length === 0;
  }
  if (block.type === 'list') return block.items.length === 0;
  return false;
}

/** Writes blocks as the notes dialect. The inverse of `parseNote`. */
export function serializeNote(blocks: readonly Block[]): string {
  return blocks
    .filter((block) => !isEmptyBlock(block))
    .map(serializeBlock)
    .join('\n\n')
    .trim();
}

/* ------------------------------------------------------------------ */
/* HTML, for the editor                                                */
/* ------------------------------------------------------------------ */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TAG: Readonly<Record<Exclude<WrapperType, 'mark'>, string>> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
};

export function inlineToHtml(nodes: readonly Inline[]): string {
  return nodes
    .map((node): string => {
      switch (node.type) {
        case 'text':
          return escapeHtml(node.text);
        case 'break':
          return '<br>';
        case 'code':
          return `<code>${escapeHtml(node.text)}</code>`;
        case 'mark':
          return `<mark data-color="${node.color}">${inlineToHtml(node.children)}</mark>`;
        default:
          return `<${TAG[node.type]}>${inlineToHtml(node.children)}</${TAG[node.type]}>`;
      }
    })
    .join('');
}

function lineHtml(nodes: readonly Inline[]): string {
  const html = inlineToHtml(trimInline(nodes));
  // An empty block still needs a line the caret can sit on.
  return html === '' ? '<br>' : html;
}

function listToHtml(list: ListBlock): string {
  const items = list.items
    .map((item) => {
      const checked = list.style === 'check' ? ` data-checked="${item.checked}"` : '';
      const children = item.children === null ? '' : listToHtml(item.children);
      return `<li${checked}>${lineHtml(item.content)}${children}</li>`;
    })
    .join('');
  if (list.style === 'number') return `<ol>${items}</ol>`;
  return list.style === 'check' ? `<ul data-type="check">${items}</ul>` : `<ul>${items}</ul>`;
}

/** The editor's HTML for some blocks. Every text character is escaped. */
export function blocksToHtml(blocks: readonly Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return `<h${block.level + 1}>${lineHtml(block.content)}</h${block.level + 1}>`;
        case 'paragraph':
          return `<p>${lineHtml(block.content)}</p>`;
        case 'quote':
          return `<blockquote>${lineHtml(block.content)}</blockquote>`;
        case 'code':
          return `<pre data-lang="${escapeHtml(block.language)}">${escapeHtml(block.text) || '<br>'}</pre>`;
        case 'rule':
          return '<hr>';
        case 'list':
          return listToHtml(block);
      }
    })
    .join('');
}

/* ------------------------------------------------------------------ */
/* Plain text, for search and previews                                 */
/* ------------------------------------------------------------------ */

function inlineText(nodes: readonly Inline[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.text;
      if (node.type === 'break') return ' ';
      return inlineText(node.children);
    })
    .join('');
}

function listText(list: ListBlock): string[] {
  return list.items.flatMap((item) => [
    inlineText(item.content),
    ...(item.children === null ? [] : listText(item.children)),
  ]);
}

/** The words of a note, without any formatting marks. */
export function noteToPlainText(blocks: readonly Block[]): string {
  return blocks
    .flatMap((block) => {
      switch (block.type) {
        case 'heading':
        case 'paragraph':
        case 'quote':
          return [inlineText(block.content)];
        case 'code':
          return [block.text];
        case 'rule':
          return [];
        case 'list':
          return listText(block);
      }
    })
    .join('\n')
    .trim();
}
