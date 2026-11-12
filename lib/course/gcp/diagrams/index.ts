/**
 * The concept diagrams of the GCP course, from every line. Pure data. The
 * rules for writing a diagram are in `lib/course/gcp/README.md` > Diagrams.
 */

import { DIAGRAMS as analysis } from '@/lib/course/gcp/diagrams/analysis';
import { DIAGRAMS as design } from '@/lib/course/gcp/diagrams/design';
import { DIAGRAMS as ingest } from '@/lib/course/gcp/diagrams/ingest';
import { DIAGRAMS as operations } from '@/lib/course/gcp/diagrams/operations';
import { DIAGRAMS as storage } from '@/lib/course/gcp/diagrams/storage';
import type { GcpDiagram } from '@/types/gcp';

export const DIAGRAMS: Readonly<Record<string, readonly GcpDiagram[]>> = {
  ...design,
  ...ingest,
  ...storage,
  ...analysis,
  ...operations,
};

/** The diagrams of one concept, in file order. `concept` is 1-based. */
export function conceptDiagrams(station: string, concept: number): readonly GcpDiagram[] {
  return (DIAGRAMS[station] ?? []).filter((diagram) => diagram.concept === concept);
}
