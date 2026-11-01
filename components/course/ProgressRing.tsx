import { cn } from '@/lib/utils';

export type RingTone = 'brand' | 'gold' | 'easy' | 'blue';
export type RingSurface = 'light' | 'night';

export interface ProgressRingProps {
  /** 0 to 1. */
  ratio: number;
  /** The accessible name, e.g. "SQL progress". */
  label: string;
  /** Pixel size of the square. */
  size?: number;
  /** Stroke width in pixels. */
  thickness?: number;
  /** The arc's colour. */
  tone?: RingTone;
  /** `night` draws the track for a dark band. */
  surface?: RingSurface;
  /**
   * `arc` draws a round-capped arc; `wedge` fills a pie slice, as the loop
   * readiness dials do.
   */
  shape?: 'arc' | 'wedge';
  /** What sits in the middle. Defaults to the percentage. */
  children?: React.ReactNode;
  className?: string;
}

const ARC: Record<RingTone, string> = {
  brand: 'stroke-brand',
  gold: 'stroke-gold',
  easy: 'stroke-easy-bar',
  blue: 'stroke-track-2',
};

const WEDGE: Record<RingTone, string> = {
  brand: 'fill-brand',
  gold: 'fill-gold',
  easy: 'fill-easy-bar',
  blue: 'fill-track-2',
};

/** The SVG path of a pie slice from 12 o'clock, clockwise. */
function wedgePath(size: number, ratio: number): string {
  const c = size / 2;
  const r = c;
  const angle = Math.min(ratio, 0.9999) * 2 * Math.PI;
  const x = c + r * Math.sin(angle);
  const y = c - r * Math.cos(angle);
  const large = angle > Math.PI ? 1 : 0;
  return `M ${c} ${c} L ${c} 0 A ${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

/**
 * A ring that fills with progress. The number in the middle carries the value
 * in words, so the ring is never the only signal. Static SVG: no script.
 */
export function ProgressRing({
  ratio,
  label,
  size = 88,
  thickness = 8,
  tone = 'brand',
  surface = 'light',
  shape = 'arc',
  children,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(clamped * 100);
  const track = surface === 'night' ? 'stroke-night-line' : 'stroke-sunken';

  return (
    <div
      role="img"
      aria-label={`${label}: ${percent} percent`}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {shape === 'wedge' ? (
          <>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2}
              className={surface === 'night' ? 'fill-night-line' : 'fill-sunken'}
            />
            {clamped > 0 && <path d={wedgePath(size, clamped)} className={WEDGE[tone]} />}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - thickness}
              className={surface === 'night' ? 'fill-night-raised' : 'fill-surface'}
            />
          </>
        ) : (
          <>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={thickness}
              className={cn(track, 'fill-none')}
            />
            {clamped > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - clamped)}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className={cn(ARC[tone], 'fill-none')}
              />
            )}
          </>
        )}
      </svg>
      <span className="font-display absolute text-center leading-none font-semibold">
        {children ?? `${percent}%`}
      </span>
    </div>
  );
}
