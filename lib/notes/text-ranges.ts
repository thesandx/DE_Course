/**
 * Maps between a section of the page and the plain text a highlight is
 * anchored in (see `lib/notes/highlights.ts`).
 *
 * The text is the section's text nodes joined in document order. Text inside
 * a control (a button, an input, an editor) or inside `[data-no-highlight]`
 * is left out, so a highlight never lands on something the learner types in
 * or presses.
 */

const SKIP_SELECTOR =
  'button, input, textarea, select, script, style, svg, [contenteditable="true"], [data-no-highlight]';

export interface TextSegment {
  node: Text;
  start: number;
}

export interface TextMap {
  text: string;
  segments: TextSegment[];
}

/** The section's text and where each text node starts in it. */
export function textMapOf(root: Element): TextMap {
  const segments: TextSegment[] = [];
  let text = '';
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const skipped = node.parentElement?.closest(SKIP_SELECTOR) ?? null;
      return skipped !== null && root.contains(skipped)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const value = node.nodeValue ?? '';
    if (value === '') continue;
    segments.push({ node: node as Text, start: text.length });
    text += value;
  }
  return { text, segments };
}

/** The text offset of a DOM boundary point, such as a selection's start. */
export function offsetOf(map: TextMap, container: Node, offset: number): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const segment = map.segments.find((entry) => entry.node === container);
    if (segment !== undefined) return segment.start + offset;
  }
  const point = container.ownerDocument?.createRange();
  if (point === undefined) return map.text.length;
  point.setStart(container, offset);
  point.collapse(true);
  // The first text node at or after the point starts the offset.
  for (const segment of map.segments) {
    if (point.comparePoint(segment.node, 0) >= 0) return segment.start;
  }
  return map.text.length;
}

/** A DOM range over the text `start..end`, or null when the map does not cover it. */
export function rangeOf(map: TextMap, start: number, end: number): Range | null {
  if (start >= end) return null;
  let from: TextSegment | undefined;
  let to: TextSegment | undefined;
  for (const segment of map.segments) {
    const length = segment.node.nodeValue?.length ?? 0;
    if (from === undefined && start < segment.start + length) from = segment;
    if (end <= segment.start + length) {
      to = segment;
      break;
    }
  }
  if (from === undefined || to === undefined) return null;
  const range = from.node.ownerDocument.createRange();
  range.setStart(from.node, Math.max(0, start - from.start));
  range.setEnd(to.node, end - to.start);
  return range;
}
