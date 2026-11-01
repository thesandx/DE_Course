import { InlineText } from '@/components/course/InlineText';
import { type Block, type CalloutKind, parseMarkdown } from '@/lib/course/markdown';
import { cn } from '@/lib/utils';

export interface ProseProps {
  /** Text in the course Markdown dialect. See `lib/course/markdown.ts`. */
  source: string;
  /**
   * Splits the text at each `##` heading into numbered section cards, each
   * with its own hue on the number and the left rail. The lesson page uses it.
   */
  sectioned?: boolean;
  className?: string;
}

/** Section hues, in order. They repeat after the fifth section. */
const SECTION_HUES: readonly { badge: string; rail: string }[] = [
  { badge: 'bg-brand', rail: 'border-l-brand' },
  { badge: 'bg-iris', rail: 'border-l-iris' },
  { badge: 'bg-track-2', rail: 'border-l-track-2' },
  { badge: 'bg-track-5', rail: 'border-l-track-5' },
  { badge: 'bg-gold-deep', rail: 'border-l-gold-deep' },
];

interface Section {
  title: string | null;
  /** 1 for the first `##` section. Zero for text before the first heading. */
  number: number;
  blocks: Block[];
}

/** Groups blocks under their `##` heading. Text before the first heading has no title. */
function toSections(blocks: readonly Block[]): Section[] {
  const sections: Section[] = [];
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 2) {
      const number = sections.filter((section) => section.title !== null).length + 1;
      sections.push({ title: block.text, number, blocks: [] });
    } else {
      const last = sections[sections.length - 1];
      if (last === undefined) sections.push({ title: null, number: 0, blocks: [block] });
      else last.blocks.push(block);
    }
  }
  return sections;
}

/**
 * Renders lesson and problem text with the design tokens. A Server Component:
 * the parsing runs at build or request time and ships no script.
 *
 * Code blocks and tables scroll inside their own box, so a long line never
 * makes the page scroll sideways on a phone.
 */
export function Prose({ source, sectioned = false, className }: ProseProps) {
  const blocks = parseMarkdown(source);
  if (sectioned) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-4', className)}>
        {toSections(blocks).map((section, index) => {
          if (section.title === null) {
            return (
              <div
                key={index}
                className="bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-4 border p-5 sm:p-6"
              >
                {section.blocks.map((block, blockIndex) => (
                  <BlockView key={blockIndex} block={block} />
                ))}
              </div>
            );
          }
          const { number } = section;
          const hue = SECTION_HUES[(number - 1) % SECTION_HUES.length] ?? SECTION_HUES[0];
          return (
            <section
              key={index}
              className={cn(
                'bg-surface border-line rounded-card shadow-card flex min-w-0 flex-col gap-4 border border-l-4 p-5 sm:p-6',
                hue?.rail,
              )}
            >
              <h2 className="text-title flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'text-on-night text-small rounded-box inline-grid size-8 shrink-0 place-items-center font-mono font-semibold',
                    hue?.badge,
                  )}
                >
                  {String(number).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <InlineText text={section.title} />
                </span>
              </h2>
              {section.blocks.map((block, blockIndex) => (
                <BlockView key={blockIndex} block={block} />
              ))}
            </section>
          );
        })}
      </div>
    );
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-4', className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

const CALLOUT_STYLE: Record<CalloutKind, { label: string; className: string; accent: string }> = {
  senior: {
    label: 'Senior signal',
    className: 'bg-night-glow text-on-night border-transparent',
    accent: 'text-gold',
  },
  trap: {
    label: 'Trap',
    className: 'bg-hard-soft border-l-hard-bar border-l-4',
    accent: 'text-hard',
  },
  tip: {
    label: 'Tip',
    className: 'bg-easy-soft border-l-easy-bar border-l-4',
    accent: 'text-easy',
  },
  example: {
    label: 'Example',
    className: 'bg-medium-soft border-l-medium-bar border-l-4',
    accent: 'text-medium',
  },
};

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'heading':
      return block.level === 2 ? (
        <h2 className="text-title mt-4">
          <InlineText text={block.text} />
        </h2>
      ) : (
        <h3 className="text-heading mt-2">
          <InlineText text={block.text} />
        </h3>
      );
    case 'paragraph':
      return (
        <p className="text-ink-soft max-w-prose leading-relaxed">
          <InlineText text={block.text} />
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          className={cn(
            'text-ink-soft marker:text-ink-faint flex max-w-prose flex-col gap-2 pl-6',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, index) => (
            <li key={index}>
              <InlineText text={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'code':
      return (
        <figure className="bg-night-deep rounded-card flex min-w-0 flex-col overflow-hidden">
          <figcaption className="border-night-line text-micro text-on-night-soft flex items-center gap-1.5 border-b px-4 py-2.5 font-mono">
            <span aria-hidden="true" className="bg-hard-bar size-2.5 rounded-full" />
            <span aria-hidden="true" className="bg-medium-bar size-2.5 rounded-full" />
            <span aria-hidden="true" className="bg-easy-bar size-2.5 rounded-full" />
            {block.lang === 'text' ? null : (
              <span className="ml-2">{block.lang.toUpperCase()}</span>
            )}
          </figcaption>
          <pre className="text-on-night text-small overflow-x-auto p-4 font-mono leading-relaxed">
            <code>{block.code.replace(/^\s*\n/, '')}</code>
          </pre>
        </figure>
      );
    case 'table':
      return (
        <div className="border-line rounded-input overflow-x-auto border">
          <table className="text-small w-full min-w-max border-collapse text-left">
            <thead className="bg-sunken text-ink-faint">
              <tr>
                {block.head.map((cell, index) => (
                  <th key={index} scope="col" className="border-line eyebrow border-b px-3 py-2.5">
                    <InlineText text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-surface">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={cn(
                        'border-line border-t px-3 py-2.5 align-top',
                        index === 0 && 'font-semibold',
                      )}
                    >
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'callout': {
      const style = CALLOUT_STYLE[block.tone];
      return (
        <aside
          className={cn(
            'border-line rounded-card flex flex-col gap-2 border p-4 sm:p-5',
            style.className,
          )}
        >
          <p className="flex flex-col gap-0.5">
            <span className={cn('eyebrow', style.accent)}>{style.label}</span>
            {block.title !== '' ? <span className="text-heading">{block.title}</span> : null}
          </p>
          {block.body.map((paragraph, index) => (
            <p key={index}>
              <InlineText text={paragraph} />
            </p>
          ))}
        </aside>
      );
    }
  }
}
