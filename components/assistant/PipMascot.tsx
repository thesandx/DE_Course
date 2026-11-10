import { cn } from '@/lib/utils';

export type PipMood = 'happy' | 'thinking' | 'wow' | 'sleepy';

export interface PipMascotProps {
  mood?: PipMood;
  /** Rendered size in px. */
  size?: number;
  /** Blink every few seconds. Only on the big mascot, never on a small avatar. */
  blink?: boolean;
  /** Accessible description. Omit when the mascot is decoration next to text. */
  label?: string;
  className?: string;
}

/**
 * Pip, the AI doubt helper: a round mochi robot in the brand gradient, with a
 * light visor, the Mochi eyes and blush, and an antenna with a gold spark that
 * glows while Pip thinks.
 *
 * The visor and eyes use the `night` and `on-night` colours, which stay the
 * same in both modes, so Pip looks the same in light and dark.
 */
export function PipMascot({
  mood = 'happy',
  size = 48,
  blink = false,
  label,
  className,
}: PipMascotProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  const eyeRadius = mood === 'wow' ? 3.8 : 3.2;
  // Thinking, Pip looks up and to the side, as people do.
  const look = mood === 'thinking' ? { x: 1.6, y: -1.6 } : { x: 0, y: 0 };

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      {...a11y}
    >
      <defs>
        <linearGradient id="pip-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--color-brand)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-iris)' }} />
        </linearGradient>
      </defs>

      <ellipse cx="32" cy="60.5" rx="15" ry="2.5" className="fill-ink" opacity="0.1" />

      <path d="M32 13V6.5" className="stroke-iris" strokeWidth="2.4" strokeLinecap="round" />
      <circle
        cx="32"
        cy="5.5"
        r="4"
        className={cn('fill-gold', mood === 'thinking' && 'animate-breathe')}
        style={{ transformOrigin: '32px 5.5px', transformBox: 'view-box' }}
      />
      <circle cx="30.8" cy="4.3" r="1.2" className="fill-on-night" opacity="0.8" />

      <circle cx="8.5" cy="35" r="4.5" className="fill-iris" />
      <circle cx="55.5" cy="35" r="4.5" className="fill-brand" />

      <rect x="8" y="12" width="48" height="46" rx="21" fill="url(#pip-body)" />
      <path
        d="M17 20q6-5 14-5"
        className="stroke-on-night"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />

      <rect x="14.5" y="23" width="35" height="24" rx="12" className="fill-on-night" />

      <g
        className={cn(blink && mood !== 'sleepy' && 'animate-blink')}
        style={{ transformOrigin: '32px 34px', transformBox: 'view-box' }}
      >
        {mood === 'sleepy' ? (
          <>
            <path
              d="M22 34q3 3 6 0"
              className="stroke-night"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M36 34q3 3 6 0"
              className="stroke-night"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx={25 + look.x} cy={33.5 + look.y} r={eyeRadius} className="fill-night" />
            <circle cx={39 + look.x} cy={33.5 + look.y} r={eyeRadius} className="fill-night" />
            <circle cx={26.1 + look.x} cy={32.3 + look.y} r="1.1" className="fill-on-night" />
            <circle cx={40.1 + look.x} cy={32.3 + look.y} r="1.1" className="fill-on-night" />
          </>
        )}
      </g>

      <ellipse cx="20" cy="40" rx="3.2" ry="1.9" className="fill-blush" opacity="0.85" />
      <ellipse cx="44" cy="40" rx="3.2" ry="1.9" className="fill-blush" opacity="0.85" />

      {mood === 'wow' ? (
        <ellipse cx="32" cy="41" rx="2.2" ry="2.6" className="fill-night" />
      ) : mood === 'thinking' ? (
        <path d="M29.5 41.5h5" className="stroke-night" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <path
          d="M28.5 39.5q3.5 3.6 7 0"
          className="stroke-night"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
