import { InlineText } from '@/components/course/InlineText';
import { type Block, type CalloutKind, parseMarkdown } from '@/lib/course/markdown';
import { cn } from '@/lib/utils';

export interface ProseProps {
  /** Text in the course Markdown dialect. See `lib/course/markdown.ts`. */
  source: string;
  className?: string;
}

/**
 * Renders lesson and problem text with the design tokens. A Server Component:
 * the parsing runs at build or request time and ships no script.
 *
 * Code blocks and tables scroll inside their own box, so a long line never
 * makes the page scroll sideways on a phone.
 */
export function Prose({ source, className }: ProseProps) {
  const blocks = parseMarkdown(source);
  return (
    <div className={cn('flex min-w-0 flex-col gap-4', className)}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

const CALLOUT_STYLE: Record<CalloutKind, { label: string; className: string }> = {
  senior: { label: 'Senior signal', className: 'bg-grape' },
  trap: { label: 'Trap', className: 'bg-peach' },
  tip: { label: 'Tip', className: 'bg-soda' },
  example: { label: 'Example', className: 'bg-butter' },
};

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'heading':
      return block.level === 2 ? (
        <h2 className="text-heading font-display mt-4">
          <InlineText text={block.text} />
        </h2>
      ) : (
        <h3 className="text-body mt-2 font-bold">
          <InlineText text={block.text} />
        </h3>
      );
    case 'paragraph':
      return (
        <p className="max-w-prose">
          <InlineText text={block.text} />
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          className={cn(
            'flex max-w-prose flex-col gap-2 pl-6',
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
        <figure className="flex min-w-0 flex-col gap-1">
          {block.lang === 'text' ? null : (
            <figcaption className="text-small text-ink-soft">{block.lang.toUpperCase()}</figcaption>
          )}
          <pre className="bg-sunken border-line rounded-input overflow-x-auto border-2 p-4 font-mono text-small">
            <code>{block.code}</code>
          </pre>
        </figure>
      );
    case 'table':
      return (
        <div className="border-line rounded-input overflow-x-auto border-2">
          <table className="w-full min-w-max border-collapse text-left text-small">
            <thead className="bg-sunken">
              <tr>
                {block.head.map((cell, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="border-line border-b-2 px-3 py-2 font-bold"
                  >
                    <InlineText text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-surface">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index} className="border-line border-t-2 px-3 py-2 align-top">
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
            'border-line rounded-card flex max-w-prose flex-col gap-2 border-2 p-4',
            style.className,
          )}
        >
          <p className="font-bold">
            {style.label}
            {block.title !== '' ? `: ${block.title}` : ''}
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
