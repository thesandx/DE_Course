'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { readBlocks } from '@/lib/notes/dom';
import {
  blocksToHtml,
  escapeHtml,
  HIGHLIGHT_COLORS,
  type HighlightColor,
  inlineToHtml,
  parseNote,
  serializeNote,
  trimInline,
} from '@/lib/notes/markdown';
import { cn } from '@/lib/utils';

import { HIGHLIGHT_SWATCH, ToolIcon, type ToolIconName } from './ToolIcon';

export interface NoteEditorHandle {
  /** Replaces the whole note. Undo brings the old one back. */
  replace: (markdown: string) => void;
  /** Adds text from the lesson as a quote at the end of the note. */
  appendQuote: (text: string) => void;
  focus: () => void;
}

export interface NoteEditorProps {
  /** The note to start with. The editor is uncontrolled after that. */
  initial: string;
  /** Called with the note's Markdown a moment after each change. */
  onChange: (markdown: string) => void;
  /** Names the editor for screen readers, such as "My notes for Window functions". */
  label: string;
  placeholder?: string;
  /** Taller writing area, for the full-screen mode. */
  tall?: boolean;
  ref?: React.Ref<NoteEditorHandle>;
}

interface Snapshot {
  html: string;
  caret: number | null;
}

interface ToolState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  mark: boolean;
  block: string;
  list: 'bullet' | 'number' | 'check' | null;
}

const EMPTY_STATE: ToolState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  mark: false,
  block: 'P',
  list: null,
};

const EMPTY_HTML = '<p><br></p>';
const HISTORY_LIMIT = 200;
const TYPING_PAUSE_MS = 700;
const CHANGE_DELAY_MS = 300;

/** Typed at the start of a line, then a space: the line becomes this block. */
const SHORTCUTS: Readonly<Record<string, string>> = {
  '#': 'h1',
  '##': 'h2',
  '###': 'h3',
  '-': 'bullet',
  '*': 'bullet',
  '1.': 'number',
  '[]': 'check',
  '[ ]': 'check',
  '>': 'quote',
  '```': 'codeblock',
};

const BLOCK_SELECTOR = 'h2,h3,h4,p,blockquote,pre,li,div';
const HEADING_TAG: Readonly<Record<string, string>> = { h1: 'h2', h2: 'h3', h3: 'h4' };

function exec(command: string, value?: string): void {
  // execCommand is deprecated but is still the only way to edit rich text that
  // every browser implements, and it is what the native editing keys use.
  document.execCommand(command, false, value);
}

function currentRange(root: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return root.contains(range.commonAncestorContainer) ? range : null;
}

function closestIn(node: Node | null, selector: string, root: HTMLElement): HTMLElement | null {
  let element: Element | null =
    node === null ? null : node.nodeType === 1 ? (node as Element) : node.parentElement;
  while (element !== null && element !== root) {
    if (element.matches(selector)) return element as HTMLElement;
    element = element.parentElement;
  }
  return null;
}

function caretOffset(root: HTMLElement): number | null {
  const range = currentRange(root);
  if (range === null) return null;
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.endContainer, range.endOffset);
  return before.toString().length;
}

function placeCaret(root: HTMLElement, offset: number | null): void {
  const selection = window.getSelection();
  if (selection === null) return;
  const range = document.createRange();
  let left = offset ?? Number.MAX_SAFE_INTEGER;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let placed = false;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (left <= node.length) {
      range.setStart(node, left);
      placed = true;
      break;
    }
    left -= node.length;
  }
  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function unwrap(element: Element): void {
  const parent = element.parentNode;
  if (parent === null) return;
  while (element.firstChild !== null) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

/** Wraps every piece of text inside `range` in a fresh element. Works across blocks. */
function wrapText(range: Range, root: HTMLElement, make: () => HTMLElement): HTMLElement[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const pieces: Array<{ node: Text; start: number; end: number }> = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!range.intersectsNode(node) || closestIn(node, 'pre', root) !== null) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) pieces.push({ node, start, end });
  }
  return pieces.map(({ node, start, end }) => {
    if (end < node.length) node.splitText(end);
    const target = start > 0 ? node.splitText(start) : node;
    const wrapper = make();
    target.parentNode?.insertBefore(wrapper, target);
    wrapper.appendChild(target);
    return wrapper;
  });
}

function selectNodes(first: Node, last: Node): void {
  const selection = window.getSelection();
  if (selection === null) return;
  const range = document.createRange();
  range.setStartBefore(first);
  range.setEndAfter(last);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeAtStart(element: HTMLElement): void {
  const selection = window.getSelection();
  if (selection === null) return;
  const range = document.createRange();
  range.setStart(element, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Turns one paragraph into the block a Markdown shortcut names, keeping its
 * text. Done by hand, not with execCommand, because browsers disagree on
 * what a list command does to a paragraph (Chrome can nest the list inside it).
 */
function convertBlock(block: HTMLElement, kind: string): void {
  const heading = HEADING_TAG[kind];
  const tag = heading ?? (kind === 'quote' ? 'blockquote' : kind === 'codeblock' ? 'pre' : null);
  let target: HTMLElement;
  let host: HTMLElement;
  if (tag !== null) {
    target = document.createElement(tag);
    host = target;
  } else {
    const ordered = kind === 'number';
    const previous = block.previousElementSibling;
    const sameList =
      previous !== null &&
      previous.tagName === (ordered ? 'OL' : 'UL') &&
      (previous.getAttribute('data-type') === 'check') === (kind === 'check');
    const list = sameList
      ? (previous as HTMLElement)
      : document.createElement(ordered ? 'ol' : 'ul');
    if (kind === 'check') list.setAttribute('data-type', 'check');
    host = document.createElement('li');
    if (kind === 'check') host.setAttribute('data-checked', 'false');
    list.appendChild(host);
    target = list;
  }
  while (block.firstChild !== null) host.appendChild(block.firstChild);
  if ((host.textContent ?? '') === '' && host.querySelector('br') === null) host.innerHTML = '<br>';
  if (target === block.previousElementSibling) block.remove();
  else block.replaceWith(target);
  placeAtStart(host);
}

function isEmptyDoc(root: HTMLElement): boolean {
  return (root.textContent ?? '').trim() === '' && root.querySelector('hr,li') === null;
}

interface Tool {
  icon: ToolIconName;
  label: string;
  keys?: string;
  active?: boolean;
  disabled?: boolean;
}

function ToolButton({ tool, onRun }: { tool: Tool; onRun: (id: ToolIconName) => void }) {
  return (
    <button
      type="button"
      title={tool.keys === undefined ? tool.label : `${tool.label} (${tool.keys})`}
      aria-label={tool.label}
      aria-pressed={tool.active}
      disabled={tool.disabled}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => onRun(tool.icon)}
      className={cn(
        'press rounded-input inline-grid size-11 shrink-0 place-items-center md:size-9',
        tool.active === true
          ? 'bg-ink text-on-ink'
          : 'text-ink-soft hover:bg-sunken hover:text-ink',
        'disabled:text-line-strong disabled:hover:bg-transparent',
      )}
    >
      <ToolIcon name={tool.icon} className="size-5 md:size-4.5" />
    </button>
  );
}

/**
 * The notes editor: a rich text box that feels like a notes app. Bold,
 * italic, underline, strike, four highlight colours, inline code, code
 * blocks, headings, bullet, numbered and check lists, and quotes, from the
 * toolbar, from the usual keyboard shortcuts, or by typing Markdown at the
 * start of a line (`- `, `1. `, `[] `, `## `, `> `, ``` ``` ```).
 *
 * The document is plain HTML in a `contenteditable` element. Every change is
 * read back into the notes Markdown (`lib/notes/dom.ts`), which is what is
 * saved, so whatever markup the browser or a paste adds never reaches the
 * server. Undo and redo are the editor's own, so they cover the toolbar, the
 * highlighter and an applied Pip format, not only typing.
 */
export function NoteEditor({
  initial,
  onChange,
  label,
  placeholder,
  tall = false,
  ref,
}: NoteEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const history = useRef<{ stack: Snapshot[]; index: number }>({ stack: [], index: -1 });
  const typing = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  const [tools, setTools] = useState<ToolState>(EMPTY_STATE);
  const [empty, setEmpty] = useState(initial.trim() === '');
  const [color, setColor] = useState<HighlightColor>('yellow');
  const [palette, setPalette] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const syncHistoryFlags = useCallback(() => {
    const { stack, index } = history.current;
    setCanUndo(index > 0 || typing.current);
    setCanRedo(index < stack.length - 1);
  }, []);

  const emit = useCallback((now = false) => {
    const element = rootRef.current;
    if (element === null) return;
    setEmpty(isEmptyDoc(element));
    if (changeTimer.current !== null) clearTimeout(changeTimer.current);
    const send = (): void => onChangeRef.current(serializeNote(readBlocks(element)));
    if (now) send();
    else changeTimer.current = setTimeout(send, CHANGE_DELAY_MS);
  }, []);

  const commit = useCallback(() => {
    const element = rootRef.current;
    if (element === null) return;
    const { stack, index } = history.current;
    const html = element.innerHTML;
    if (stack[index]?.html === html) {
      syncHistoryFlags();
      return;
    }
    const next = [...stack.slice(0, index + 1), { html, caret: caretOffset(element) }].slice(
      -HISTORY_LIMIT,
    );
    history.current = { stack: next, index: next.length - 1 };
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const flushTyping = useCallback(() => {
    if (typingTimer.current !== null) clearTimeout(typingTimer.current);
    if (typing.current) {
      typing.current = false;
      commit();
    }
  }, [commit]);

  const refreshTools = useCallback(() => {
    const element = rootRef.current;
    if (element === null) return;
    const range = currentRange(element);
    if (range === null) return;
    savedRange.current = range.cloneRange();
    const anchor = range.startContainer;
    const list = closestIn(anchor, 'ul,ol', element);
    const block = closestIn(anchor, 'h2,h3,h4,blockquote,pre', element);
    const state = (command: string): boolean => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    setTools({
      bold: state('bold'),
      italic: state('italic'),
      underline: state('underline'),
      strike: state('strikeThrough'),
      code: closestIn(anchor, 'code', element) !== null,
      mark: closestIn(anchor, 'mark', element) !== null,
      block: block?.tagName ?? 'P',
      list:
        list === null
          ? null
          : list.tagName === 'OL'
            ? 'number'
            : list.getAttribute('data-type') === 'check'
              ? 'check'
              : 'bullet',
    });
  }, []);

  const tidyDocument = useCallback(() => {
    const element = rootRef.current;
    if (element === null) return;
    if (element.innerHTML.trim() === '' || element.innerHTML === '<br>')
      element.innerHTML = EMPTY_HTML;
    for (const item of Array.from(
      element.querySelectorAll('ul[data-type="check"] > li:not([data-checked])'),
    )) {
      item.setAttribute('data-checked', 'false');
    }
    // A block inside a paragraph is invalid, and some browsers make one.
    for (const paragraph of Array.from(element.querySelectorAll('p'))) {
      if (
        paragraph.querySelector(
          ':scope > ul, :scope > ol, :scope > blockquote, :scope > pre, :scope > h2, :scope > h3, :scope > h4, :scope > p',
        ) !== null
      ) {
        paragraph.replaceWith(...Array.from(paragraph.childNodes));
      }
    }
    // A code block, quote or divider at the very end needs a line after it,
    // or the caret cannot leave it.
    const last = element.lastElementChild;
    if (last !== null && ['PRE', 'HR', 'BLOCKQUOTE'].includes(last.tagName)) {
      element.insertAdjacentHTML('beforeend', EMPTY_HTML);
    }
  }, []);

  /** Runs an editing step as one undoable change. */
  const run = useCallback(
    (step: (element: HTMLElement) => void) => {
      const element = rootRef.current;
      if (element === null) return;
      if (document.activeElement !== element) element.focus({ preventScroll: true });
      const selection = window.getSelection();
      if (currentRange(element) === null && savedRange.current !== null && selection !== null) {
        selection.removeAllRanges();
        selection.addRange(savedRange.current);
      }
      flushTyping();
      step(element);
      tidyDocument();
      commit();
      emit();
      refreshTools();
    },
    [commit, emit, flushTyping, refreshTools, tidyDocument],
  );

  const restore = useCallback(
    (snapshot: Snapshot | undefined) => {
      const element = rootRef.current;
      if (element === null || snapshot === undefined) return;
      element.innerHTML = snapshot.html;
      element.focus({ preventScroll: true });
      placeCaret(element, snapshot.caret);
      syncHistoryFlags();
      emit(true);
      refreshTools();
    },
    [emit, refreshTools, syncHistoryFlags],
  );

  const undo = useCallback(() => {
    flushTyping();
    const { stack, index } = history.current;
    if (index <= 0) return;
    history.current = { stack, index: index - 1 };
    restore(stack[index - 1]);
  }, [flushTyping, restore]);

  const redo = useCallback(() => {
    flushTyping();
    const { stack, index } = history.current;
    if (index >= stack.length - 1) return;
    history.current = { stack, index: index + 1 };
    restore(stack[index + 1]);
  }, [flushTyping, restore]);

  // Load the starting note once.
  useEffect(() => {
    const element = rootRef.current;
    if (element === null) return;
    element.innerHTML = blocksToHtml(parseNote(initial)) || EMPTY_HTML;
    tidyDocument();
    history.current = { stack: [{ html: element.innerHTML, caret: null }], index: 0 };
    syncHistoryFlags();
    try {
      exec('defaultParagraphSeparator', 'p');
      exec('styleWithCSS', 'false');
    } catch {
      // An old browser without these keeps its own defaults; the reader copes with both.
    }
    // The editor is uncontrolled: `initial` is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on mount
  }, []);

  useEffect(() => {
    const editorElement = rootRef.current;
    const onSelection = (): void => {
      const element = rootRef.current;
      if (element !== null && currentRange(element) !== null) refreshTools();
    };
    document.addEventListener('selectionchange', onSelection);
    return () => {
      document.removeEventListener('selectionchange', onSelection);
      if (typingTimer.current !== null) clearTimeout(typingTimer.current);
      if (changeTimer.current !== null) {
        // Send the last change instead of dropping it.
        clearTimeout(changeTimer.current);
        if (editorElement !== null) onChangeRef.current(serializeNote(readBlocks(editorElement)));
      }
    };
  }, [refreshTools]);

  /* ---------------------------------------------------------------- */
  /* Commands                                                          */
  /* ---------------------------------------------------------------- */

  const setBlock = useCallback((element: HTMLElement, tag: string) => {
    const range = currentRange(element);
    const current = closestIn(range?.startContainer ?? null, 'h2,h3,h4,blockquote,pre', element);
    exec('formatBlock', current?.tagName.toLowerCase() === tag ? '<p>' : `<${tag}>`);
  }, []);

  const toggleList = useCallback((element: HTMLElement, style: 'bullet' | 'number' | 'check') => {
    const range = currentRange(element);
    const list = closestIn(range?.startContainer ?? null, 'ul,ol', element);
    const isCheck = list?.getAttribute('data-type') === 'check';
    const makeCheck = (target: Element | null): void => {
      if (target === null) return;
      target.setAttribute('data-type', 'check');
      for (const item of Array.from(target.children)) {
        if (item.tagName === 'LI' && !item.hasAttribute('data-checked'))
          item.setAttribute('data-checked', 'false');
      }
    };
    if (style === 'number') {
      exec('insertOrderedList');
      return;
    }
    if (style === 'bullet') {
      if (list?.tagName === 'UL' && isCheck) {
        list.removeAttribute('data-type');
        for (const item of Array.from(list.children)) item.removeAttribute('data-checked');
        return;
      }
      exec('insertUnorderedList');
      return;
    }
    if (list?.tagName === 'UL' && isCheck) {
      exec('insertUnorderedList');
      return;
    }
    if (list?.tagName === 'UL') {
      makeCheck(list);
      return;
    }
    exec('insertUnorderedList');
    makeCheck(closestIn(currentRange(element)?.startContainer ?? null, 'ul', element));
  }, []);

  const highlight = useCallback(
    (next: HighlightColor | null) => {
      setPalette(false);
      if (next !== null) setColor(next);
      run((element) => {
        const range = currentRange(element);
        if (range === null) return;
        const marks = Array.from(element.querySelectorAll('mark')).filter((mark) =>
          range.intersectsNode(mark),
        );
        if (next === null || (range.collapsed && marks.length > 0)) {
          marks.forEach(unwrap);
          return;
        }
        if (range.collapsed) return;
        // Re-colouring: a mark already inside the selection takes the new colour.
        const outer = closestIn(range.commonAncestorContainer, 'mark', element);
        if (outer !== null) {
          outer.setAttribute('data-color', next);
          return;
        }
        marks.forEach(unwrap);
        const fresh = currentRange(element) ?? range;
        const wrapped = wrapText(fresh, element, () => {
          const mark = document.createElement('mark');
          mark.setAttribute('data-color', next);
          return mark;
        });
        const first = wrapped[0];
        const last = wrapped[wrapped.length - 1];
        if (first !== undefined && last !== undefined) selectNodes(first, last);
      });
    },
    [run],
  );

  const toggleMarkButton = useCallback(() => {
    const element = rootRef.current;
    const range = element === null ? null : currentRange(element);
    const inside =
      element !== null &&
      range !== null &&
      closestIn(range.startContainer, 'mark', element) !== null;
    highlight(inside ? null : color);
  }, [color, highlight]);

  const inlineCode = useCallback(() => {
    run((element) => {
      const range = currentRange(element);
      if (range === null) return;
      const existing = closestIn(range.startContainer, 'code', element);
      if (existing !== null) {
        unwrap(existing);
        return;
      }
      if (range.collapsed) {
        exec('insertHTML', '<code>code</code>&#8203;');
        return;
      }
      const wrapped = wrapText(range, element, () => document.createElement('code'));
      const first = wrapped[0];
      const last = wrapped[wrapped.length - 1];
      if (first !== undefined && last !== undefined) selectNodes(first, last);
    });
  }, [run]);

  const clearFormat = useCallback(() => {
    run((element) => {
      const range = currentRange(element);
      if (range === null) return;
      exec('removeFormat');
      for (const node of Array.from(element.querySelectorAll('mark,code,strong,em,u,s,b,i'))) {
        if (range.intersectsNode(node)) unwrap(node);
      }
      if (closestIn(range.startContainer, 'h2,h3,h4,blockquote,pre', element) !== null)
        exec('formatBlock', '<p>');
    });
  }, [run]);

  const applyShortcut = useCallback(
    (element: HTMLElement, kind: string) => {
      if (kind in HEADING_TAG) setBlock(element, HEADING_TAG[kind] ?? 'h2');
      else if (kind === 'bullet' || kind === 'number' || kind === 'check')
        toggleList(element, kind);
      else if (kind === 'quote') setBlock(element, 'blockquote');
      else if (kind === 'codeblock') setBlock(element, 'pre');
    },
    [setBlock, toggleList],
  );

  useImperativeHandle(
    ref,
    () => ({
      replace(markdown: string) {
        run((element) => {
          element.innerHTML = blocksToHtml(parseNote(markdown)) || EMPTY_HTML;
          placeCaret(element, null);
        });
      },
      appendQuote(text: string) {
        run((element) => {
          if (isEmptyDoc(element)) element.innerHTML = '';
          const lines = text.trim().split(/\n+/).map(escapeHtml).join('<br>');
          element.insertAdjacentHTML('beforeend', `<blockquote>${lines}</blockquote>${EMPTY_HTML}`);
          placeCaret(element, null);
          element.lastElementChild?.scrollIntoView({ block: 'nearest' });
        });
      },
      focus() {
        rootRef.current?.focus();
      },
    }),
    [run],
  );

  /* ---------------------------------------------------------------- */
  /* Events                                                            */
  /* ---------------------------------------------------------------- */

  function onInput(event: React.FormEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const native = event.nativeEvent as InputEvent;
    if (native.inputType === 'insertParagraph') {
      // A new item in a checklist starts unticked, whatever the browser copied.
      const item = closestIn(
        currentRange(element)?.startContainer ?? null,
        'ul[data-type="check"] > li',
        element,
      );
      if (item !== null) item.setAttribute('data-checked', 'false');
    }
    tidyDocument();
    typing.current = true;
    setCanUndo(true);
    if (typingTimer.current !== null) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typing.current = false;
      commit();
    }, TYPING_PAUSE_MS);
    emit();
  }

  function onBeforeInput(event: React.FormEvent<HTMLDivElement>) {
    const type = (event.nativeEvent as InputEvent).inputType;
    if (type === 'historyUndo') {
      event.preventDefault();
      undo();
    } else if (type === 'historyRedo') {
      event.preventDefault();
      redo();
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (mod && !event.altKey) {
      const shortcut = (): (() => void) | null => {
        if (key === 'z') return event.shiftKey ? redo : undo;
        if (key === 'y') return redo;
        if (key === 'b') return () => run(() => exec('bold'));
        if (key === 'i') return () => run(() => exec('italic'));
        if (key === 'u') return () => run(() => exec('underline'));
        if (key === 'e') return inlineCode;
        if (event.shiftKey && key === 'x') return () => run(() => exec('strikeThrough'));
        if (event.shiftKey && key === 'h') return () => highlight(color);
        if (event.shiftKey && event.code === 'Digit7')
          return () => run((root) => toggleList(root, 'number'));
        if (event.shiftKey && event.code === 'Digit8')
          return () => run((root) => toggleList(root, 'bullet'));
        if (event.shiftKey && event.code === 'Digit9')
          return () => run((root) => toggleList(root, 'check'));
        return null;
      };
      const action = shortcut();
      if (action !== null) {
        event.preventDefault();
        action();
      }
      return;
    }

    const range = currentRange(element);
    if (range === null) return;

    if (event.key === 'Tab' && closestIn(range.startContainer, 'li', element) !== null) {
      event.preventDefault();
      run(() => exec(event.shiftKey ? 'outdent' : 'indent'));
      return;
    }

    const quote = closestIn(range.startContainer, 'blockquote', element);
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      quote !== null &&
      (quote.textContent ?? '').trim() === ''
    ) {
      // Enter on an empty quote line leaves the quote, as in a notes app.
      event.preventDefault();
      run(() => {
        const line = document.createElement('p');
        line.innerHTML = '<br>';
        quote.replaceWith(line);
        placeAtStart(line);
      });
      return;
    }

    const pre = closestIn(range.startContainer, 'pre', element);
    if (event.key === 'Enter' && pre !== null && !event.shiftKey) {
      event.preventDefault();
      const after = document.createRange();
      after.selectNodeContents(pre);
      after.setStart(range.endContainer, range.endOffset);
      const atEnd = after.toString() === '';
      const text = pre.textContent ?? '';
      if (atEnd && text.endsWith('\n\n')) {
        // Enter on two empty lines at the end leaves the code block.
        run(() => {
          pre.textContent = text.replace(/\n+$/, '');
          pre.insertAdjacentHTML('afterend', EMPTY_HTML);
          const next = pre.nextElementSibling;
          if (next !== null) {
            const caret = document.createRange();
            caret.setStart(next, 0);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(caret);
          }
        });
        return;
      }
      exec('insertText', atEnd && !text.endsWith('\n') ? '\n\n' : '\n');
      if (atEnd && !text.endsWith('\n')) {
        // A trailing newline is invisible, so the first Enter adds two and steps back one.
        const selection = window.getSelection();
        selection?.modify('move', 'backward', 'character');
      }
      return;
    }

    if (event.key === ' ' && range.collapsed && !event.shiftKey) {
      const block = closestIn(range.startContainer, BLOCK_SELECTOR, element);
      if (block !== null && !['P', 'DIV'].includes(block.tagName)) return;
      const container = block ?? element;
      const before = document.createRange();
      before.setStart(container, 0);
      before.setEnd(range.startContainer, range.startOffset);
      const kind = SHORTCUTS[before.toString()];
      if (kind === undefined) return;
      event.preventDefault();
      run((root) => {
        if (block === null) {
          // Text straight in the editor, outside any block: let the browser convert it.
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(before);
          exec('delete');
          applyShortcut(root, kind);
          return;
        }
        before.deleteContents();
        convertBlock(block, kind);
      });
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as Element;
    const item = target.closest('li');
    if (item === null || item.parentElement?.getAttribute('data-type') !== 'check') return;
    const box = item.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(item).fontSize) || 15;
    // The tick box sits in the item's left padding (see .note-doc in globals.css).
    if (event.clientX - box.left > fontSize * 1.75) return;
    event.preventDefault();
    flushTyping();
    item.setAttribute(
      'data-checked',
      item.getAttribute('data-checked') === 'true' ? 'false' : 'true',
    );
    commit();
    emit();
  }

  function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    flushTyping();
    if (html !== '') {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const blocks = readBlocks(parsed.body);
      const only = blocks[0];
      const markup =
        blocks.length === 1 && only?.type === 'paragraph'
          ? inlineToHtml(trimInline(only.content))
          : blocksToHtml(blocks);
      if (markup !== '') exec('insertHTML', markup);
    } else if (text !== '') {
      exec('insertText', text);
    }
    tidyDocument();
    commit();
    emit();
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    // Notes hold text. A dropped image or file would only be lost on save.
    if (event.dataTransfer.files.length > 0) event.preventDefault();
  }

  /* ---------------------------------------------------------------- */
  /* Toolbar                                                           */
  /* ---------------------------------------------------------------- */

  const groups: Tool[][] = [
    [
      { icon: 'undo', label: 'Undo', keys: '⌘Z', disabled: !canUndo },
      { icon: 'redo', label: 'Redo', keys: '⌘⇧Z', disabled: !canRedo },
    ],
    [
      {
        icon: 'h1',
        label: 'Heading',
        keys: '# space',
        active: tools.block === 'H2',
      },
      {
        icon: 'h2',
        label: 'Subheading',
        keys: '## space',
        active: tools.block === 'H3',
      },
    ],
    [
      {
        icon: 'bold',
        label: 'Bold',
        keys: '⌘B',
        active: tools.bold,
      },
      {
        icon: 'italic',
        label: 'Italic',
        keys: '⌘I',
        active: tools.italic,
      },
      {
        icon: 'underline',
        label: 'Underline',
        keys: '⌘U',
        active: tools.underline,
      },
      {
        icon: 'strike',
        label: 'Strikethrough',
        keys: '⌘⇧X',
        active: tools.strike,
      },
    ],
    [
      {
        icon: 'bullets',
        label: 'Bulleted list',
        keys: '- space',
        active: tools.list === 'bullet',
      },
      {
        icon: 'numbers',
        label: 'Numbered list',
        keys: '1. space',
        active: tools.list === 'number',
      },
      {
        icon: 'checklist',
        label: 'Checklist',
        keys: '[] space',
        active: tools.list === 'check',
      },
    ],
    [
      { icon: 'code', label: 'Inline code', keys: '⌘E', active: tools.code },
      {
        icon: 'codeblock',
        label: 'Code block',
        keys: '``` space',
        active: tools.block === 'PRE',
      },
      {
        icon: 'quote',
        label: 'Quote',
        keys: '> space',
        active: tools.block === 'BLOCKQUOTE',
      },
      { icon: 'clear', label: 'Clear formatting' },
    ],
  ];

  function perform(id: ToolIconName) {
    switch (id) {
      case 'undo':
        undo();
        return;
      case 'redo':
        redo();
        return;
      case 'h1':
        run((element) => setBlock(element, 'h2'));
        return;
      case 'h2':
        run((element) => setBlock(element, 'h3'));
        return;
      case 'bold':
        run(() => exec('bold'));
        return;
      case 'italic':
        run(() => exec('italic'));
        return;
      case 'underline':
        run(() => exec('underline'));
        return;
      case 'strike':
        run(() => exec('strikeThrough'));
        return;
      case 'bullets':
        run((element) => toggleList(element, 'bullet'));
        return;
      case 'numbers':
        run((element) => toggleList(element, 'number'));
        return;
      case 'checklist':
        run((element) => toggleList(element, 'check'));
        return;
      case 'code':
        inlineCode();
        return;
      case 'codeblock':
        run((element) => setBlock(element, 'pre'));
        return;
      case 'quote':
        run((element) => setBlock(element, 'blockquote'));
        return;
      case 'clear':
        clearFormat();
        return;
      default:
        return;
    }
  }

  const [history0, blocks0, ...rest] = groups;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="border-line bg-surface sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5"
      >
        {history0?.map((tool) => (
          <ToolButton key={tool.icon} tool={tool} onRun={perform} />
        ))}
        <span aria-hidden="true" className="bg-line mx-1 h-6 w-px shrink-0" />
        {blocks0?.map((tool) => (
          <ToolButton key={tool.icon} tool={tool} onRun={perform} />
        ))}
        <span aria-hidden="true" className="bg-line mx-1 h-6 w-px shrink-0" />
        {rest[0]?.map((tool) => (
          <ToolButton key={tool.icon} tool={tool} onRun={perform} />
        ))}
        <span aria-hidden="true" className="bg-line mx-1 h-6 w-px shrink-0" />
        <div className="relative flex shrink-0 items-center">
          <button
            type="button"
            title="Highlight (⌘⇧H)"
            aria-label="Highlight"
            aria-pressed={tools.mark}
            onPointerDown={(event) => event.preventDefault()}
            onClick={toggleMarkButton}
            className={cn(
              'press rounded-input inline-grid size-11 place-items-center md:size-9',
              tools.mark ? 'bg-ink text-on-ink' : 'text-ink-soft hover:bg-sunken hover:text-ink',
            )}
          >
            <ToolIcon name="highlight" className="size-5 md:size-4.5" swatch={color} />
          </button>
          <button
            type="button"
            aria-label="Highlight colours"
            aria-expanded={palette}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => setPalette((open) => !open)}
            className="text-ink-faint hover:text-ink rounded-input inline-grid h-11 w-6 place-items-center md:h-9"
          >
            <ToolIcon name="caret" className="size-3.5" />
          </button>
        </div>
        {rest.slice(1).map((group, index) => (
          <span key={index} className="contents">
            <span aria-hidden="true" className="bg-line mx-1 h-6 w-px shrink-0" />
            {group.map((tool) => (
              <ToolButton key={tool.icon} tool={tool} onRun={perform} />
            ))}
          </span>
        ))}
      </div>

      {palette && (
        <div
          role="group"
          aria-label="Highlight colour"
          className="border-line bg-surface animate-rise-in flex flex-wrap items-center gap-2 border-b px-3 py-2"
        >
          {HIGHLIGHT_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Highlight ${swatch}`}
              aria-pressed={swatch === color}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => highlight(swatch)}
              className={cn(
                'press text-small text-ink inline-flex min-h-11 items-center gap-2 rounded-pill border px-3 font-semibold capitalize md:min-h-9',
                swatch === color ? 'border-ink' : 'border-line',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('size-4 rounded-full', HIGHLIGHT_SWATCH[swatch])}
              />
              {swatch}
            </button>
          ))}
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => highlight(null)}
            className="text-small text-ink-soft hover:text-ink min-h-11 px-2 font-semibold md:min-h-9"
          >
            Remove highlight
          </button>
        </div>
      )}

      <div
        ref={rootRef}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-empty={empty ? 'true' : 'false'}
        data-placeholder={placeholder ?? 'Write your notes…'}
        onInput={onInput}
        onBeforeInput={onBeforeInput}
        onKeyDown={onKeyDown}
        onKeyUp={refreshTools}
        onMouseUp={refreshTools}
        onPointerDown={onPointerDown}
        onPaste={onPaste}
        onDrop={onDrop}
        onBlur={() => {
          flushTyping();
          emit(true);
        }}
        className={cn(
          'note-doc text-body text-ink min-w-0 flex-1 overflow-y-auto px-4 py-4 outline-none sm:px-5',
          tall ? 'min-h-0' : 'max-h-screen min-h-48',
        )}
      />
    </div>
  );
}
