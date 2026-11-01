import { cn } from '@/lib/utils';

export interface PageHeadingProps {
  /** The small uppercase label above the title. */
  eyebrow?: string;
  /** The page's `h1`. */
  title: string;
  /** One or two sentences under the title. */
  children?: React.ReactNode;
  /** A slot on the right from `sm` up: one action or a stat. */
  end?: React.ReactNode;
  className?: string;
}

/** The heading of a signed-in list page: eyebrow, title, a lead line, one optional action. */
export function PageHeading({ eyebrow, title, children, end, className }: PageHeadingProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow !== undefined && <p className="eyebrow text-brand-deep">{eyebrow}</p>}
        <h1 className="text-display">{title}</h1>
        {children !== undefined && <div className="text-ink-soft max-w-2xl">{children}</div>}
      </div>
      {end !== undefined && <div className="shrink-0">{end}</div>}
    </header>
  );
}
