import { cn } from '@/lib/utils';

export interface ProgressRingProps {
  /** 0 to 1. */
  ratio: number;
  /** The accessible name, e.g. "SQL progress". */
  label: string;
  /** Pixel size of the square. */
  size?: number;
  /** What sits in the middle. Defaults to the percentage. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * A ring that fills with progress. The number in the middle carries the value
 * in words, so the ring is never the only signal. Static SVG: no script.
 */
export function ProgressRing({ ratio, label, size = 88, children, className }: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const stroke = 8;
  const radius = (size - stroke) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(clamped * 100);

  return (
    <div
      role="img"
      aria-label={`${label}: ${percent} percent`}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke + 4}
          className="stroke-line fill-surface"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="stroke-sunken fill-none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="stroke-brand fill-none"
        />
      </svg>
      <span className="font-display absolute text-center leading-none">
        {children ?? `${percent}%`}
      </span>
    </div>
  );
}
