/**
 * The course Markdown dialect: a small, strict subset that lesson and problem
 * text is written in. It is parsed into blocks here, and
 * `components/course/Prose.tsx` renders the blocks with the design tokens.
 *
 * Why a dialect and not a Markdown library: rule 8 (no unnecessary
 * dependencies), and the content is ours, so it needs only what we write.
 * The two differences from Markdown keep the content inside TypeScript
 * template literals without escaping:
 *
 *   - Inline code is «code», not backticks.
 *   - Code fences are ~~~lang, not triple backticks.
 *
 * Supported blocks: `## heading`, `### heading`, paragraphs, `- ` lists,
 * `1. ` lists, ~~~ code fences, `| a | b |` tables (second row is the rule),
 * and callouts: `> [!senior] Title` followed by `> ` lines.
 * Supported inline: «code» and **bold**.
 */

export type CalloutKind = 'senior' | 'trap' | 'tip' | 'example';

export type Block =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'callout'; tone: CalloutKind; title: string; body: string[] };

export type Inline =
  { kind: 'text'; text: string } | { kind: 'code'; text: string } | { kind: 'bold'; text: string };

const CALLOUT_KINDS: readonly CalloutKind[] = ['senior', 'trap', 'tip', 'example'];

function isCalloutKind(value: string): value is CalloutKind {
  return (CALLOUT_KINDS as readonly string[]).includes(value);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Removes the common leading indent, so content can be indented in source. */
function dedent(source: string): string[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.length - line.trimStart().length);
  const cut = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(cut));
}

export function parseMarkdown(source: string): Block[] {
  const lines = dedent(source);
  const blocks: Block[] = [];
  let i = 0;

  const at = (index: number): string => lines[index] ?? '';

  while (i < lines.length) {
    const line = at(i);
    const trimmed = line.trim();

    if (trimmed === '') {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('~~~')) {
      const lang = trimmed.slice(3).trim() || 'text';
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !at(i).trim().startsWith('~~~')) {
        code.push(at(i));
        i += 1;
      }
      i += 1; // the closing fence
      blocks.push({ kind: 'code', lang, code: code.join('\n').replace(/\s+$/, '') });
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
    if (heading?.[1] !== undefined && heading[2] !== undefined) {
      blocks.push({ kind: 'heading', level: heading[1].length === 2 ? 2 : 3, text: heading[2] });
      i += 1;
      continue;
    }

    const callout = /^>\s*\[!(\w+)\]\s*(.*)$/.exec(trimmed);
    if (callout?.[1] !== undefined && isCalloutKind(callout[1])) {
      const body: string[] = [];
      let paragraph: string[] = [];
      i += 1;
      while (i < lines.length && at(i).trim().startsWith('>')) {
        const text = at(i).trim().replace(/^>\s?/, '');
        if (text.trim() === '') {
          if (paragraph.length > 0) body.push(paragraph.join(' '));
          paragraph = [];
        } else {
          paragraph.push(text.trim());
        }
        i += 1;
      }
      if (paragraph.length > 0) body.push(paragraph.join(' '));
      blocks.push({ kind: 'callout', tone: callout[1], title: callout[2] ?? '', body });
      continue;
    }

    if (trimmed.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && at(i).trim().startsWith('|')) {
        const row = at(i).trim();
        if (!/^\|[\s:|-]+\|$/.test(row)) rows.push(splitRow(row));
        i += 1;
      }
      const [head = [], ...rest] = rows;
      blocks.push({ kind: 'table', head, rows: rest });
      continue;
    }

    const listItem = /^(-|\d+\.)\s+(.*)$/;
    const first = listItem.exec(trimmed);
    if (first?.[1] !== undefined) {
      const ordered = first[1] !== '-';
      const items: string[] = [];
      while (i < lines.length) {
        const current = at(i).trim();
        const match = listItem.exec(current);
        if (match?.[1] !== undefined && match[2] !== undefined && (match[1] !== '-') === ordered) {
          items.push(match[2]);
        } else if (
          current !== '' &&
          !listItem.test(current) &&
          items.length > 0 &&
          at(i).startsWith('  ')
        ) {
          // A wrapped continuation line, indented under its item.
          items[items.length - 1] = `${items[items.length - 1] ?? ''} ${current}`;
        } else {
          break;
        }
        i += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    // The first line always belongs to the paragraph. It matched no other
    // block (an unknown callout kind, say), so stopping on it would loop forever.
    const paragraph: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const current = at(i).trim();
      if (
        current === '' ||
        current.startsWith('~~~') ||
        current.startsWith('|') ||
        /^#{2,3}\s/.test(current) ||
        /^>\s*\[!/.test(current) ||
        /^(-|\d+\.)\s+/.test(current)
      ) {
        break;
      }
      paragraph.push(current);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

/** Splits a line into text, «code» and **bold** runs. Unclosed markers stay as text. */
export function parseInline(text: string): Inline[] {
  const runs: Inline[] = [];
  const pattern = /«([^»]+)»|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (match.index > last) runs.push({ kind: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) runs.push({ kind: 'code', text: match[1] });
    else if (match[2] !== undefined) runs.push({ kind: 'bold', text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ kind: 'text', text: text.slice(last) });
  return runs;
}

/** Plain text with the inline markers removed. For metadata and accessible names. */
export function stripInline(text: string): string {
  return parseInline(text)
    .map((run) => run.text)
    .join('');
}
