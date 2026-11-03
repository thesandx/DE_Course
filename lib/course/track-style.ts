/**
 * Each track's hue, as literal class names. Tailwind only generates classes
 * it can read in the source, so the names are spelled out here once instead
 * of assembled from a number at runtime.
 *
 * The hue follows the track's place in the study order: track 1 is gold,
 * track 2 blue, and so on. See `--color-track-*` in styles/globals.css.
 */

import { TRACKS } from '@/lib/course/catalog';

export interface TrackStyle {
  /** 1-based position in the study order, shown as "TRACK 01". */
  number: number;
  /** A filled bar or dot. */
  fill: string;
  /** The left rail on a list row. */
  rail: string;
  /** The top edge on a tile. */
  edge: string;
}

const STYLES: readonly Omit<TrackStyle, 'number'>[] = [
  { fill: 'bg-track-1', rail: 'border-l-track-1', edge: 'border-t-track-1' },
  { fill: 'bg-track-2', rail: 'border-l-track-2', edge: 'border-t-track-2' },
  { fill: 'bg-track-3', rail: 'border-l-track-3', edge: 'border-t-track-3' },
  { fill: 'bg-track-4', rail: 'border-l-track-4', edge: 'border-t-track-4' },
  { fill: 'bg-track-5', rail: 'border-l-track-5', edge: 'border-t-track-5' },
  { fill: 'bg-track-6', rail: 'border-l-track-6', edge: 'border-t-track-6' },
  { fill: 'bg-track-7', rail: 'border-l-track-7', edge: 'border-t-track-7' },
  { fill: 'bg-track-8', rail: 'border-l-track-8', edge: 'border-t-track-8' },
  { fill: 'bg-track-9', rail: 'border-l-track-9', edge: 'border-t-track-9' },
  { fill: 'bg-track-10', rail: 'border-l-track-10', edge: 'border-t-track-10' },
  { fill: 'bg-track-11', rail: 'border-l-track-11', edge: 'border-t-track-11' },
  { fill: 'bg-track-12', rail: 'border-l-track-12', edge: 'border-t-track-12' },
  { fill: 'bg-track-13', rail: 'border-l-track-13', edge: 'border-t-track-13' },
  { fill: 'bg-track-14', rail: 'border-l-track-14', edge: 'border-t-track-14' },
  { fill: 'bg-track-15', rail: 'border-l-track-15', edge: 'border-t-track-15' },
  { fill: 'bg-track-16', rail: 'border-l-track-16', edge: 'border-t-track-16' },
];

export function trackStyle(slug: string): TrackStyle {
  const index = Math.max(
    TRACKS.findIndex((track) => track.slug === slug),
    0,
  );
  const style = STYLES[index % STYLES.length] ?? STYLES[0];
  return { number: index + 1, ...(style ?? { fill: '', rail: '', edge: '' }) };
}

/** "01", "02" … "11". */
export function trackNumber(slug: string): string {
  return String(trackStyle(slug).number).padStart(2, '0');
}
