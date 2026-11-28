'use client';

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useTextHighlights } from '@/hooks/useTextHighlights';
import {
  anchorFor,
  DEFAULT_TEXT_HIGHLIGHT,
  locateHighlight,
  MAX_HIGHLIGHT_CHARS,
  MAX_HIGHLIGHTS,
  newHighlightId,
  spansOverlap,
  type TextHighlight,
  type TextSpan,
  trimSpan,
} from '@/lib/notes/highlights';
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/lib/notes/markdown';
import { offsetOf, rangeOf, textMapOf } from '@/lib/notes/text-ranges';
import { cn } from '@/lib/utils';

import { HIGHLIGHT_SWATCH, ToolIcon } from './ToolIcon';

/**
 * Lets the learner highlight the course text, like a marker on a printed
 * page: select a passage and a small bar offers "Highlight"; tap a highlight
 * and the bar offers other colours and "Remove".
 *
 * The highlights are drawn with the CSS Custom Highlight API
 * (`CSS.highlights` and `::highlight()` in `styles/globals.css`), so the
 * server-rendered lesson is never changed: no `<mark>` is wrapped round
 * React's text nodes. A browser without the API shows the text as before,
 * with no bar. See ADR-0018.
 */

export interface TextHighlighterProps {
  /** The chapter, as for its note, such as `de:lesson:sql:window-functions`. */
  noteKey: string;
  /** The section of the page, unique on the page, such as `body` or `answer`. */
  scope: string;
  children: ReactNode;
  className?: string;
}

/** The color order in the bar: the bright marker first. */
const BAR_COLORS: readonly HighlightColor[] = [
  DEFAULT_TEXT_HIGHLIGHT,
  ...HIGHLIGHT_COLORS.filter((color) => color !== DEFAULT_TEXT_HIGHLIGHT),
];

interface Located {
  item: TextHighlight;
  span: TextSpan;
  range: Range;
}

type Bar =
  { mode: 'new'; span: TextSpan; range: Range } | { mode: 'existing'; id: string; range: Range };

/* -------------------------------------------------------------------- */
/* One registry for the page: every section adds its ranges, per colour. */
/* -------------------------------------------------------------------- */

const painted = new Map<string, { color: HighlightColor; range: Range }[]>();

function supported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';
}

function paint(): void {
  if (!supported()) return;
  for (const color of HIGHLIGHT_COLORS) {
    const ranges = [...painted.values()].flat().flatMap((entry) => {
      return entry.color === color ? [entry.range] : [];
    });
    const name = `text-hl-${color}`;
    if (ranges.length === 0) CSS.highlights.delete(name);
    else CSS.highlights.set(name, new Highlight(...ranges));
  }
}

function insideOf(root: Element, node: Node | null): boolean {
  return node !== null && root.contains(node);
}

function hits(range: Range, x: number, y: number): boolean {
  return Array.from(range.getClientRects()).some(
    (rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
  );
}

export function TextHighlighter({ noteKey, scope, children, className }: TextHighlighterProps) {
  const instance = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const located = useRef<Located[]>([]);
  const { items, save } = useTextHighlights(noteKey);
  const [enabled, setEnabled] = useState(false);
  const [bar, setBar] = useState<Bar | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- CSS.highlights exists only in the browser, and the server render must match the first client render
    setEnabled(supported());
  }, []);

  // Find each highlight in this section's text, and paint it. Again when the
  // section's DOM changes, such as an answer that opens.
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || root === null) return;
    const mine = items.filter((item) => item.scope === scope);
    let frame = 0;
    const locate = (): void => {
      const map = textMapOf(root);
      located.current = mine.flatMap((item): Located[] => {
        const span = locateHighlight(map.text, item);
        const range = span === null ? null : rangeOf(map, span.start, span.end);
        return span === null || range === null ? [] : [{ item, span, range }];
      });
      painted.set(
        instance,
        located.current.map(({ item, range }) => ({ color: item.color, range })),
      );
      paint();
    };
    locate();
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(locate);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      painted.delete(instance);
      paint();
    };
  }, [enabled, instance, items, scope]);

  // A selection inside the section opens the bar.
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || root === null) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = (): void => {
      const selection = window.getSelection();
      if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
        setBar((current) => (current?.mode === 'new' ? null : current));
        return;
      }
      const range = selection.getRangeAt(0);
      if (!insideOf(root, range.startContainer) || !insideOf(root, range.endContainer)) {
        setBar((current) => (current?.mode === 'new' ? null : current));
        return;
      }
      const map = textMapOf(root);
      const span = trimSpan(
        map.text,
        offsetOf(map, range.startContainer, range.startOffset),
        offsetOf(map, range.endContainer, range.endOffset),
      );
      if (span === null) return;
      setBar({ mode: 'new', span, range: range.cloneRange() });
    };
    const onChange = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(check, 180);
    };
    document.addEventListener('selectionchange', onChange);
    return () => {
      document.removeEventListener('selectionchange', onChange);
      if (timer !== null) clearTimeout(timer);
    };
  }, [enabled]);

  // Keep the bar next to its text while the page scrolls.
  useEffect(() => {
    if (bar === null) return;
    const place = (): void => {
      const rect = bar.range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setBar(null);
        return;
      }
      const below = rect.bottom + 10;
      // Under the text, so the phone's own copy menu above it stays clear.
      const top = below + 56 > window.innerHeight ? Math.max(8, rect.top - 62) : below;
      const half = Math.min(170, window.innerWidth / 2 - 8);
      const left = Math.min(
        Math.max(rect.left + rect.width / 2, half + 8),
        window.innerWidth - half - 8,
      );
      setPosition({ top, left });
    };
    place();
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setBar(null);
    };
    const away = (event: PointerEvent): void => {
      const target = event.target as Node | null;
      if (target === null || barRef.current?.contains(target) || rootRef.current?.contains(target))
        return;
      setBar(null);
    };
    window.addEventListener('scroll', place, { passive: true, capture: true });
    window.addEventListener('resize', place);
    window.addEventListener('keydown', close);
    document.addEventListener('pointerdown', away);
    return () => {
      window.removeEventListener('scroll', place, { capture: true });
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', away);
    };
  }, [bar]);

  // A tap on a highlight opens the bar for it.
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const selection = window.getSelection();
      if (selection !== null && !selection.isCollapsed) return;
      const hit = located.current.find(({ range }) => hits(range, event.clientX, event.clientY));
      setBar(hit === undefined ? null : { mode: 'existing', id: hit.item.id, range: hit.range });
    },
    [enabled],
  );

  function add(color: HighlightColor): void {
    if (bar?.mode !== 'new' || rootRef.current === null) return;
    const map = textMapOf(rootRef.current);
    const span = bar.span;
    // A new highlight replaces any it overlaps, so marks never stack.
    const covered = new Set(
      located.current.filter((entry) => spansOverlap(entry.span, span)).map(({ item }) => item.id),
    );
    const next = items.filter((item) => !covered.has(item.id));
    if (next.length >= MAX_HIGHLIGHTS) return;
    next.push({
      id: newHighlightId(),
      scope,
      ...anchorFor(map.text, span),
      color,
      at: new Date().toISOString(),
    });
    save(next);
    window.getSelection()?.removeAllRanges();
    setBar(null);
  }

  function recolor(color: HighlightColor): void {
    if (bar?.mode !== 'existing') return;
    save(items.map((item) => (item.id === bar.id ? { ...item, color } : item)));
    setBar(null);
  }

  function remove(): void {
    if (bar?.mode !== 'existing') return;
    save(items.filter((item) => item.id !== bar.id));
    setBar(null);
  }

  const tooLong = bar?.mode === 'new' && bar.span.end - bar.span.start > MAX_HIGHLIGHT_CHARS;
  const full = bar?.mode === 'new' && items.length >= MAX_HIGHLIGHTS;
  const current =
    bar?.mode === 'existing' ? items.find((item) => item.id === bar.id)?.color : undefined;

  return (
    <div ref={rootRef} onClick={onClick} className={className} data-highlight-scope={scope}>
      {children}
      {enabled &&
        bar !== null &&
        position !== null &&
        createPortal(
          <div
            ref={barRef}
            role="toolbar"
            aria-label={bar.mode === 'new' ? 'Highlight the selected text' : 'Change the highlight'}
            style={{ top: position.top, left: position.left }}
            className="bg-night text-on-night rounded-pill shadow-float animate-rise-in border-night-line fixed z-50 flex -translate-x-1/2 items-center gap-1 border p-1"
            onPointerDown={(event) => event.preventDefault()}
          >
            {tooLong || full ? (
              <p className="text-small px-3 py-2 font-semibold">
                {full
                  ? `This page has ${MAX_HIGHLIGHTS} highlights. Remove one first.`
                  : 'Select a shorter passage to highlight.'}
              </p>
            ) : (
              <>
                {bar.mode === 'new' && (
                  <button
                    type="button"
                    onClick={() => add(DEFAULT_TEXT_HIGHLIGHT)}
                    className="press text-small hover:bg-night-raised rounded-pill inline-flex min-h-11 items-center gap-2 px-3 font-semibold"
                  >
                    <ToolIcon name="highlight" className="size-5" swatch={DEFAULT_TEXT_HIGHLIGHT} />
                    Highlight
                  </button>
                )}
                <span role="group" aria-label="Colours" className="flex items-center">
                  {BAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Highlight ${color}`}
                      aria-pressed={color === current}
                      onClick={() => (bar.mode === 'new' ? add(color) : recolor(color))}
                      className="press hover:bg-night-raised grid size-11 place-items-center rounded-full"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-5 rounded-full border',
                          HIGHLIGHT_SWATCH[color],
                          color === current ? 'border-on-night' : 'border-night-line',
                        )}
                      />
                    </button>
                  ))}
                </span>
                {bar.mode === 'existing' && (
                  <button
                    type="button"
                    onClick={remove}
                    className="press text-small hover:bg-night-raised rounded-pill inline-flex min-h-11 items-center gap-2 px-3 font-semibold"
                  >
                    <ToolIcon name="clear" className="size-5" />
                    Remove
                  </button>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
