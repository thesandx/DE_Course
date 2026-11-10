/**
 * How each loop guide looks: its dark card surface and the colour of its
 * readiness dial. The class names are literal so Tailwind can read them.
 *
 * This module has no course content, so a client component can import it
 * without shipping the catalogue.
 */

import type { Company } from '@/types/course';

export interface CompanyMeta {
  /** The short name for filters and tags. */
  name: string;
  /** The night surface of the guide's card and header. */
  surface: 'bg-night-violet' | 'bg-night-glow' | 'bg-night-soft';
  /** The readiness dial's colour. */
  ring: 'brand' | 'gold' | 'easy' | 'blue';
}

export const COMPANY_META: Readonly<Record<Company, CompanyMeta>> = {
  uber: { name: 'Uber', surface: 'bg-night-violet', ring: 'easy' },
  google: { name: 'Google', surface: 'bg-night-glow', ring: 'blue' },
  amazon: { name: 'Amazon', surface: 'bg-night-soft', ring: 'gold' },
  microsoft: { name: 'Microsoft', surface: 'bg-night-violet', ring: 'blue' },
  meta: { name: 'Meta', surface: 'bg-night-glow', ring: 'brand' },
  flipkart: { name: 'Flipkart', surface: 'bg-night-soft', ring: 'gold' },
  walmart: { name: 'Walmart', surface: 'bg-night-violet', ring: 'blue' },
  phonepe: { name: 'PhonePe', surface: 'bg-night-glow', ring: 'brand' },
  swiggy: { name: 'Swiggy', surface: 'bg-night-soft', ring: 'easy' },
};

/** Every company slug, in the order the pages show them. */
export const COMPANY_SLUGS = Object.keys(COMPANY_META) as readonly Company[];
