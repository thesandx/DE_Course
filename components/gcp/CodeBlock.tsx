import { cn } from '@/lib/utils';

import { CopyButton } from './CopyButton';

export interface CodeBlockProps {
  /** The label in the title bar, such as "Cloud Shell" or "SQL". */
  label: string;
  code: string;
  className?: string;
}

/**
 * Commands or SQL to paste, in the same dark frame as a lesson's code block,
 * with a copy button. Long lines scroll inside the block, never the page.
 */
export function CodeBlock({ label, code, className }: CodeBlockProps) {
  return (
    <figure
      className={cn('bg-night-deep rounded-card flex min-w-0 flex-col overflow-hidden', className)}
    >
      <figcaption className="border-night-line text-micro text-on-night-soft flex items-center gap-1.5 border-b py-1.5 pr-1.5 pl-4 font-mono">
        <span aria-hidden="true" className="bg-hard-bar size-2.5 rounded-full" />
        <span aria-hidden="true" className="bg-medium-bar size-2.5 rounded-full" />
        <span aria-hidden="true" className="bg-easy-bar size-2.5 rounded-full" />
        <span className="ml-2 grow">{label}</span>
        <CopyButton text={code} label={label} />
      </figcaption>
      <pre className="text-on-night text-small overflow-x-auto p-4 font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
