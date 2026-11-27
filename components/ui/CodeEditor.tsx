'use client';

import { type KeyboardEvent, useMemo, useRef } from 'react';

import { CodeTokens } from '@/components/ui/CodeBlock';
import { type CodeLanguage, highlightLines } from '@/lib/code-highlight';
import { cn } from '@/lib/utils';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  /** The accessible name: "SQL editor". */
  label: string;
  /** Ctrl or Cmd + Enter. */
  onRun?: () => void;
  /** Ctrl or Cmd + Shift + Enter. */
  onSubmit?: () => void;
  onFocus?: () => void;
  /** The editor is at least this many lines tall. Default 10. */
  minLines?: number;
  /** A 1-based line to mark, such as the line an error points at. */
  errorLine?: number | null;
  /** The id of the text that describes the editor, such as its keyboard keys. */
  describedBy?: string;
  className?: string;
}

const ZERO_WIDTH_SPACE = '​';

function indentUnit(language: CodeLanguage): string {
  return language === 'python' ? '    ' : '  ';
}

function commentMarker(language: CodeLanguage): string {
  return language === 'python' ? '# ' : '-- ';
}

/**
 * Replaces a range of the textarea's text. `execCommand` keeps the browser's
 * undo history, so Ctrl+Z undoes an indent like any typing. Where it is
 * missing (jsdom, an old browser), `setRangeText` and an input event do the
 * same edit without undo.
 */
function replaceRange(
  area: HTMLTextAreaElement,
  from: number,
  to: number,
  text: string,
  selection?: readonly [number, number],
): void {
  area.focus();
  area.setSelectionRange(from, to);
  const done =
    typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
  if (!done) {
    area.setRangeText(text, from, to, 'end');
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (selection !== undefined) area.setSelectionRange(selection[0], selection[1]);
}

/** The start of the first selected line and the end of the last one. */
function lineBlock(value: string, start: number, end: number): [number, number] {
  const blockStart = value.lastIndexOf('\n', start - 1) + 1;
  // A selection that ends at the start of a line does not take that line.
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const newline = value.indexOf('\n', last);
  return [blockStart, newline === -1 ? value.length : newline];
}

function indent(area: HTMLTextAreaElement, unit: string): void {
  const { value, selectionStart: start, selectionEnd: end } = area;
  if (!value.slice(start, end).includes('\n')) {
    replaceRange(area, start, end, unit);
    return;
  }
  const [from, to] = lineBlock(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const text = lines.map((line) => unit + line).join('\n');
  replaceRange(area, from, to, text, [start + unit.length, end + unit.length * lines.length]);
}

function dedent(area: HTMLTextAreaElement, unit: string): void {
  const { value, selectionStart: start, selectionEnd: end } = area;
  const [from, to] = lineBlock(value, start, end);
  let removedFirst = 0;
  let removed = 0;
  const lines = value
    .slice(from, to)
    .split('\n')
    .map((line, index) => {
      const cut = Math.min(unit.length, /^ */.exec(line)?.[0].length ?? 0);
      if (index === 0) removedFirst = cut;
      removed += cut;
      return line.slice(cut);
    });
  if (removed === 0) return;
  replaceRange(area, from, to, lines.join('\n'), [
    Math.max(from, start - removedFirst),
    Math.max(from, end - removed),
  ]);
}

const PYTHON_DEDENT_AFTER = /^\s*(return|pass|break|continue|raise)\b/;

function newline(area: HTMLTextAreaElement, unit: string, language: CodeLanguage): void {
  const { value, selectionStart: start, selectionEnd: end } = area;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const line = value.slice(lineStart, start);
  let lead = /^[ \t]*/.exec(line)?.[0] ?? '';
  const trimmed = line.trimEnd();
  if ((language === 'python' && trimmed.endsWith(':')) || /[([{]$/.test(trimmed)) {
    lead += unit;
  } else if (language === 'python' && PYTHON_DEDENT_AFTER.test(line)) {
    lead = lead.slice(0, Math.max(0, lead.length - unit.length));
  }
  replaceRange(area, start, end, `\n${lead}`);
}

function toggleComment(area: HTMLTextAreaElement, marker: string): void {
  const { value, selectionStart: start, selectionEnd: end } = area;
  const [from, to] = lineBlock(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const filled = lines.filter((line) => line.trim() !== '');
  const bare = marker.trimEnd();
  const commented = filled.length > 0 && filled.every((line) => line.trimStart().startsWith(bare));
  const column = Math.min(...filled.map((line) => /^ */.exec(line)?.[0].length ?? 0));
  const text = lines
    .map((line) => {
      if (line.trim() === '') return line;
      if (commented) {
        const at = line.indexOf(bare);
        const cut = line.startsWith(marker, at) ? marker.length : bare.length;
        return line.slice(0, at) + line.slice(at + cut);
      }
      return line.slice(0, column) + marker + line.slice(column);
    })
    .join('\n');
  replaceRange(area, from, to, text, [from, from + text.length]);
}

/** Backspace in the indentation deletes back to the previous indent stop. */
function backspace(area: HTMLTextAreaElement, unit: string): boolean {
  const { value, selectionStart: start, selectionEnd: end } = area;
  if (start !== end) return false;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lead = value.slice(lineStart, start);
  if (lead.length < 2 || !/^ +$/.test(lead)) return false;
  const cut = lead.length % unit.length || unit.length;
  replaceRange(area, start - cut, start, '');
  return true;
}

/**
 * A code editor without a dependency: a plain textarea, transparent, over a
 * highlighted copy of its text (see `.code-editor` in styles/globals.css).
 * The browser keeps doing what it does best: the caret, selection, undo,
 * the phone keyboard, spell check off. This adds colours, line numbers and
 * the keys a programmer expects:
 *
 * - Tab and Shift+Tab indent and dedent (Esc, then Tab, leaves the editor).
 * - Enter keeps the indentation, and indents after `:` or an open bracket.
 * - Ctrl or Cmd + / toggles a comment; + Enter runs; + Shift + Enter submits.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  label,
  onRun,
  onSubmit,
  onFocus,
  minLines = 10,
  errorLine = null,
  describedBy,
  className,
}: CodeEditorProps) {
  const lines = useMemo(() => highlightLines(value, language), [value, language]);
  // Esc lets the next Tab move focus on, so a keyboard user is never trapped.
  const escaped = useRef(false);
  const unit = indentUnit(language);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    const area = event.currentTarget;
    const command = event.metaKey || event.ctrlKey;
    if (event.key === 'Escape') {
      escaped.current = true;
      return;
    }
    if (event.key === 'Tab' && !command && !event.altKey) {
      if (escaped.current) {
        escaped.current = false;
        return;
      }
      event.preventDefault();
      if (event.shiftKey) dedent(area, unit);
      else indent(area, unit);
      return;
    }
    escaped.current = false;
    if (event.key === 'Enter' && command) {
      event.preventDefault();
      if (event.shiftKey) onSubmit?.();
      else onRun?.();
      return;
    }
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.altKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      newline(area, unit, language);
      return;
    }
    if (event.key === '/' && command) {
      event.preventDefault();
      toggleComment(area, commentMarker(language));
      return;
    }
    if (event.key === 'Backspace' && !command && !event.altKey && backspace(area, unit)) {
      event.preventDefault();
    }
  }

  return (
    <div className={cn('code-editor bg-night-deep rounded-input', className)}>
      <pre aria-hidden="true" className="code-editor-view">
        {lines.map((tokens, index) => (
          <div
            key={index}
            className="code-editor-line"
            {...(errorLine === index + 1 ? { 'data-error': 'true' } : {})}
          >
            {tokens.length === 0 ? ZERO_WIDTH_SPACE : <CodeTokens tokens={tokens} />}
          </div>
        ))}
        {Array.from({ length: Math.max(0, minLines - lines.length) }, (_, index) => (
          <div key={`filler-${index}`} className="code-editor-filler">
            {ZERO_WIDTH_SPACE}
          </div>
        ))}
      </pre>
      <textarea
        aria-label={label}
        aria-describedby={describedBy}
        className="code-editor-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        translate="no"
        wrap="soft"
        data-gramm="false"
        data-enable-grammarly="false"
      />
    </div>
  );
}
