import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'night' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/**
 * The button classes, exported so a `next/link` can look exactly like a
 * button: `<Link className={buttonStyles({ variant: 'primary' })} />`.
 */
export function buttonStyles({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-pill text-center font-semibold select-none',
    'disabled:bg-sunken disabled:text-ink-faint disabled:cursor-not-allowed disabled:border-transparent disabled:shadow-none',
    'aria-disabled:bg-sunken aria-disabled:text-ink-faint aria-disabled:shadow-none',
    size === 'sm' && 'min-h-11 px-4 text-small md:min-h-9',
    size === 'md' && 'min-h-11 px-5 text-body',
    size === 'lg' && 'min-h-12 px-6 text-body',
    variant === 'primary' && 'squish bg-brand text-on-night shadow-glow hover:bg-brand-hover',
    variant === 'secondary' &&
      'squish border-line-strong bg-surface text-ink hover:border-ink-faint border',
    variant === 'dark' && 'squish bg-ink text-on-ink shadow-raised',
    variant === 'night' &&
      'squish border-night-line bg-night-raised text-on-night hover:border-on-night-soft border',
    variant === 'quiet' &&
      'text-ink decoration-brand underline decoration-2 underline-offset-4 hover:decoration-4',
    block && 'w-full',
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, 'className'> {}

/**
 * One primary Button per screen. The label is a verb phrase that says what
 * happens: "Create room", "Join game", "Save name". No trailing arrows.
 */
export function Button({ variant, size, block, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({
        ...(variant && { variant }),
        ...(size && { size }),
        ...(block !== undefined && { block }),
        ...(className !== undefined && { className }),
      })}
      {...rest}
    />
  );
}
