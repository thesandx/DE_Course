/**
 * Splits SQL or Python source into coloured tokens for the code editor and
 * the code blocks in lessons. A small scanner, not a parser: it knows
 * strings, comments, numbers, keywords and calls, which is what a reader
 * needs to scan code. Joining the tokens' text gives back the source exactly.
 */

export type TokenType =
  | 'keyword'
  | 'function'
  | 'string'
  | 'number'
  | 'comment'
  | 'constant'
  | 'operator'
  | 'decorator'
  | 'plain';

export interface Token {
  type: TokenType;
  text: string;
}

export type CodeLanguage = 'sql' | 'python';

const SQL_KEYWORDS = new Set(
  `add all alter analyze and any array as asc begin between by cascade case cast check collate column commit
  constraint create cross cube current_date current_timestamp cursor declare default delete desc distinct do drop
  else end except exists explain extract filter first following for foreign from full function grant group grouping
  having if ilike in index inner insert intersect interval into is join key language last lateral left like limit
  local materialized matched merge natural not nothing nulls of offset on only or order outer over partition
  preceding primary procedure range recursive references refresh replace returning returns right rollback rollup
  row rows savepoint schema select sequence set sets similar some table temp temporary then to transaction trigger
  truncate unbounded union unique unlogged update using vacuum values view when where window with within without
  bigint boolean char date decimal double float int integer jsonb json numeric precision real serial smallint text
  time timestamp timestamptz varchar zone`
    .split(/\s+/)
    .filter(Boolean),
);

const SQL_CONSTANTS = new Set(['null', 'true', 'false']);

const PYTHON_KEYWORDS = new Set(
  `and as assert async await break class continue def del elif else except finally for from global if import in is
  lambda match case nonlocal not or pass raise return try while with yield`
    .split(/\s+/)
    .filter(Boolean),
);

const PYTHON_CONSTANTS = new Set(['True', 'False', 'None', 'self', 'cls']);

const PYTHON_BUILTINS = new Set(
  `abs all any bool dict enumerate filter float frozenset getattr hasattr int isinstance iter len list map max min
  next object open print range repr reversed round set sorted str sum super tuple type zip`
    .split(/\s+/)
    .filter(Boolean),
);

/** The patterns tried at each position, first match wins. */
interface Rule {
  type: TokenType;
  pattern: RegExp;
}

const SQL_RULES: readonly Rule[] = [
  { type: 'comment', pattern: /--[^\n]*/y },
  { type: 'comment', pattern: /\/\*[\s\S]*?(?:\*\/|$)/y },
  { type: 'string', pattern: /\$([A-Za-z_]\w*)?\$[\s\S]*?(?:\$\1\$|$)/y },
  { type: 'string', pattern: /[Ee]?'(?:[^']|'')*(?:'|$)/y },
  { type: 'plain', pattern: /"(?:[^"]|"")*(?:"|$)/y },
  { type: 'number', pattern: /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
  { type: 'operator', pattern: /::|\|\||<=|>=|<>|!=|->>|->|[=<>+\-*/%]/y },
];

const PYTHON_RULES: readonly Rule[] = [
  { type: 'comment', pattern: /#[^\n]*/y },
  {
    type: 'string',
    pattern: /(?:[rRbBuUfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$))/y,
  },
  {
    type: 'string',
    pattern: /(?:[rRbBuUfF]{1,2})?(?:"(?:\\.|[^"\\\n])*(?:"|$)|'(?:\\.|[^'\\\n])*(?:'|$))/my,
  },
  { type: 'decorator', pattern: /@[A-Za-z_][\w.]*/y },
  {
    type: 'number',
    pattern: /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?j?)\b/y,
  },
  { type: 'operator', pattern: /\*\*|\/\/|==|!=|<=|>=|->|:=|[=<>+\-*/%&|^~]/y },
];

const WORD = /[A-Za-z_][\w$]*/y;

function classifyWord(
  word: string,
  language: CodeLanguage,
  next: string,
  previous: string,
): TokenType {
  if (language === 'sql') {
    const lower = word.toLowerCase();
    if (SQL_CONSTANTS.has(lower)) return 'constant';
    if (next === '(' && !SQL_KEYWORDS.has(lower)) return 'function';
    if (SQL_KEYWORDS.has(lower)) return 'keyword';
    if (next === '(') return 'function';
    return 'plain';
  }
  if (PYTHON_CONSTANTS.has(word)) return 'constant';
  if (PYTHON_KEYWORDS.has(word)) return 'keyword';
  if (previous === 'def' || previous === 'class') return 'function';
  if (next === '(' || PYTHON_BUILTINS.has(word)) return 'function';
  return 'plain';
}

/** Merges neighbours of the same type, so a long line renders few spans. */
function push(tokens: Token[], type: TokenType, text: string): void {
  const last = tokens[tokens.length - 1];
  if (last !== undefined && last.type === type) last.text += text;
  else tokens.push({ type, text });
}

export function highlight(code: string, language: CodeLanguage): Token[] {
  const rules = language === 'sql' ? SQL_RULES : PYTHON_RULES;
  const tokens: Token[] = [];
  let previousWord = '';
  let index = 0;
  while (index < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.pattern.lastIndex = index;
      const match = rule.pattern.exec(code);
      if (match !== null && match[0] !== '') {
        // A number glued to a word, as in `col1`, is part of the word.
        if (rule.type === 'number' && index > 0 && /[\w$]/.test(code[index - 1] ?? '')) break;
        push(tokens, rule.type, match[0]);
        index += match[0].length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    WORD.lastIndex = index;
    const word = WORD.exec(code);
    if (word !== null) {
      const text = word[0];
      const after = code.slice(index + text.length).match(/^\s*(.)/)?.[1] ?? '';
      push(tokens, classifyWord(text, language, after, previousWord), text);
      previousWord = text;
      index += text.length;
      continue;
    }
    const char = code[index] ?? '';
    if (!/\s/.test(char)) previousWord = '';
    push(tokens, 'plain', char);
    index += 1;
  }
  return tokens;
}

/** The tokens of each line, for an editor that numbers its lines. */
export function highlightLines(code: string, language: CodeLanguage): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of highlight(code, language)) {
    const parts = token.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part !== '') lines[lines.length - 1]?.push({ type: token.type, text: part });
    });
  }
  return lines;
}
