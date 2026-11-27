import { type CodeLanguage, highlight, type Token, type TokenType } from '@/lib/code-highlight';
import { cn } from '@/lib/utils';

/** The colour of each kind of token, on the `night-deep` code surface. */
export const TOKEN_CLASS: Record<TokenType, string> = {
  keyword: 'text-code-keyword',
  function: 'text-code-function',
  string: 'text-code-string',
  number: 'text-code-number',
  comment: 'text-code-comment italic',
  constant: 'text-code-constant',
  operator: 'text-code-operator',
  decorator: 'text-code-decorator',
  plain: '',
};

/** Spans for a run of tokens. Plain text stays a bare string. */
export function CodeTokens({ tokens }: { tokens: readonly Token[] }) {
  return tokens.map((token, index) =>
    token.type === 'plain' ? (
      <span key={index}>{token.text}</span>
    ) : (
      <span key={index} className={TOKEN_CLASS[token.type]}>
        {token.text}
      </span>
    ),
  );
}

const HIGHLIGHTED = new Set<string>(['sql', 'python', 'pyspark']);

function codeLanguage(lang: string): CodeLanguage | null {
  if (!HIGHLIGHTED.has(lang)) return null;
  return lang === 'sql' ? 'sql' : 'python';
}

export interface CodeBlockProps {
  code: string;
  /** `sql`, `python` or `pyspark` get syntax colours; anything else shows as plain text. */
  lang: string;
  /** Shown in the title bar. Default: the language, unless it is `text`. */
  title?: string;
  className?: string;
}

/**
 * Read-only code on the dark code surface, with the window dots of an editor
 * and syntax colours for SQL and Python. Lessons, model answers and the
 * runnable editor's sample inputs use it, so code looks the same everywhere.
 */
export function CodeBlock({ code, lang, title, className }: CodeBlockProps) {
  const language = codeLanguage(lang);
  const caption = title ?? (lang === 'text' ? '' : lang.toUpperCase());
  return (
    <figure
      className={cn('bg-night-deep rounded-card flex min-w-0 flex-col overflow-hidden', className)}
    >
      <figcaption className="border-night-line text-micro text-on-night-soft flex items-center gap-1.5 border-b px-4 py-2.5 font-mono">
        <span aria-hidden="true" className="bg-hard-bar size-2.5 rounded-full" />
        <span aria-hidden="true" className="bg-medium-bar size-2.5 rounded-full" />
        <span aria-hidden="true" className="bg-easy-bar size-2.5 rounded-full" />
        {caption !== '' ? <span className="ml-2">{caption}</span> : null}
      </figcaption>
      <pre className="text-on-night text-small overflow-x-auto p-4 font-mono leading-relaxed">
        <code>{language === null ? code : <CodeTokens tokens={highlight(code, language)} />}</code>
      </pre>
    </figure>
  );
}
