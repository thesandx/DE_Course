/**
 * The `--color-track-*` hues as literal class names. Tailwind only generates
 * classes it can read in the source, so the names are spelled out here once
 * instead of assembled from a number at runtime. Courses and GCP lines pick
 * a hue by number; DE tracks use `track-style.ts`, which follows study order.
 */

export interface HueStyle {
  /** A filled bar, dot or badge. */
  fill: string;
  /** Text in the hue. Use only on a large label or an icon, not body text. */
  text: string;
  /** The left rail on a list row. */
  rail: string;
  /** The top edge on a tile. */
  edge: string;
  /** A 1px outline in the hue. */
  border: string;
}

const HUES: Readonly<Record<number, HueStyle>> = {
  1: {
    fill: 'bg-track-1',
    text: 'text-track-1',
    rail: 'border-l-track-1',
    edge: 'border-t-track-1',
    border: 'border-track-1',
  },
  2: {
    fill: 'bg-track-2',
    text: 'text-track-2',
    rail: 'border-l-track-2',
    edge: 'border-t-track-2',
    border: 'border-track-2',
  },
  3: {
    fill: 'bg-track-3',
    text: 'text-track-3',
    rail: 'border-l-track-3',
    edge: 'border-t-track-3',
    border: 'border-track-3',
  },
  4: {
    fill: 'bg-track-4',
    text: 'text-track-4',
    rail: 'border-l-track-4',
    edge: 'border-t-track-4',
    border: 'border-track-4',
  },
  5: {
    fill: 'bg-track-5',
    text: 'text-track-5',
    rail: 'border-l-track-5',
    edge: 'border-t-track-5',
    border: 'border-track-5',
  },
  6: {
    fill: 'bg-track-6',
    text: 'text-track-6',
    rail: 'border-l-track-6',
    edge: 'border-t-track-6',
    border: 'border-track-6',
  },
  7: {
    fill: 'bg-track-7',
    text: 'text-track-7',
    rail: 'border-l-track-7',
    edge: 'border-t-track-7',
    border: 'border-track-7',
  },
};

export function hueStyle(hue: number): HueStyle {
  return HUES[hue] ?? (HUES[2] as HueStyle);
}
