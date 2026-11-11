import type { HighlightColor } from '@/lib/notes/markdown';
import { cn } from '@/lib/utils';

/**
 * The notes toolbar's icons. Same 24px grid and stroke as `Icon`, kept apart
 * because only the editor draws them.
 */
export type ToolIconName =
  | 'undo'
  | 'redo'
  | 'h1'
  | 'h2'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'bullets'
  | 'numbers'
  | 'checklist'
  | 'code'
  | 'codeblock'
  | 'quote'
  | 'clear'
  | 'highlight'
  | 'caret'
  | 'expand'
  | 'collapse'
  | 'clip'
  | 'cloud'
  | 'device'
  | 'download';

/** The fill for each highlight colour. The same tokens as `mark` in the note text. */
export const HIGHLIGHT_SWATCH: Readonly<Record<HighlightColor, string>> = {
  yellow: 'bg-butter',
  green: 'bg-soda',
  pink: 'bg-brand-soft',
  purple: 'bg-grape',
};

const PATHS: Record<Exclude<ToolIconName, 'highlight'>, React.ReactNode> = {
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13" />,
  h1: (
    <>
      <path d="M4 6v12M12 6v12M4 12h8" />
      <path d="M16.5 9.5L19 8v10" />
    </>
  ),
  h2: (
    <>
      <path d="M4 6v12M12 6v12M4 12h8" />
      <path d="M15.5 10a2.2 2.2 0 014.4.3c0 1.9-4.4 4.2-4.4 7.7h4.6" />
    </>
  ),
  bold: <path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" strokeWidth="2.4" />,
  italic: <path d="M10 5h8M6 19h8M14 5l-4 14" />,
  underline: <path d="M7 4v7a5 5 0 0010 0V4M5 20h14" />,
  strike: (
    <path d="M17 7.5C16 5.6 14.3 5 12 5c-3 0-4.8 1.4-4.8 3.4 0 4.5 9.8 2.6 9.8 7.4 0 2-2 3.2-5 3.2-2.6 0-4.4-.9-5.3-2.8M4 12h16" />
  ),
  bullets: (
    <>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M5 6h.01M5 12h.01M5 18h.01" strokeWidth="3.2" />
    </>
  ),
  numbers: (
    <>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4.5 4.5L6 4v5M4 14.2a1.4 1.4 0 012.7.4c0 1-2.7 2-2.7 3.4h2.9" strokeWidth="1.6" />
    </>
  ),
  checklist: (
    <>
      <rect x="3.5" y="4" width="6" height="6" rx="1.5" />
      <path d="M5 7l1.2 1.2L8.4 5.8" strokeWidth="1.6" />
      <rect x="3.5" y="14" width="6" height="6" rx="1.5" />
      <path d="M13 7h7M13 17h7" />
    </>
  ),
  code: <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />,
  codeblock: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9.5 9.5L7 12l2.5 2.5M14.5 9.5L17 12l-2.5 2.5" />
    </>
  ),
  quote: (
    <path d="M6 17c-1.2-1-2-2.5-2-4.4C4 9.6 6 7.6 8.6 7l.4 1.3C7.3 9 6.6 10 6.5 11.3H9V17zM15 17c-1.2-1-2-2.5-2-4.4 0-3 2-5 4.6-5.6l.4 1.3c-1.7.7-2.4 1.7-2.5 3H18V17z" />
  ),
  clear: (
    <>
      <path d="M7 5h11M12.5 5L9 19M4 20l16-16" />
    </>
  ),
  caret: <path d="M6 9l6 6 6-6" strokeWidth="2.6" />,
  expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />,
  collapse: <path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" />,
  clip: (
    <path d="M16 6.5l-7.4 7.4a2 2 0 002.8 2.8l8-8a3.8 3.8 0 00-5.4-5.4l-8.2 8.2a5.6 5.6 0 007.9 7.9L20 13" />
  ),
  cloud: <path d="M7 18h10.5a4 4 0 00.6-8 6 6 0 00-11.6 1.5A3.3 3.3 0 007 18z" />,
  device: (
    <>
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
};

export interface ToolIconProps {
  name: ToolIconName;
  className?: string;
  /** For `highlight`: the colour under the pen. */
  swatch?: HighlightColor;
}

export function ToolIcon({ name, className, swatch = 'yellow' }: ToolIconProps) {
  if (name === 'highlight') {
    return (
      <span aria-hidden="true" className={cn('relative inline-grid place-items-center', className)}>
        <svg
          viewBox="0 0 24 24"
          className="size-full"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4.5l5 5-8 8H6.5v-5zM4 21h7" />
        </svg>
        <span
          className={cn('absolute right-0 bottom-0 size-2 rounded-full', HIGHLIGHT_SWATCH[swatch])}
        />
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
