/**
 * The lesson diagrams of the Kubernetes course. One picture per lesson, keyed
 * by `<port>/<lesson>`. Pure data. The rules for writing a diagram are in
 * `lib/course/gcp/README.md` > Diagrams.
 */

import { DIAGRAMS as build } from '@/lib/course/k8s/diagrams/build';
import { DIAGRAMS as operate } from '@/lib/course/k8s/diagrams/operate';
import { DIAGRAMS as run } from '@/lib/course/k8s/diagrams/run';
import type { K8sDiagram } from '@/types/k8s';

export const DIAGRAMS: Readonly<Record<string, K8sDiagram>> = { ...build, ...run, ...operate };

/** The picture of one lesson, or undefined when the lesson has none. */
export function lessonDiagram(port: string, lesson: string): K8sDiagram | undefined {
  return DIAGRAMS[`${port}/${lesson}`];
}
