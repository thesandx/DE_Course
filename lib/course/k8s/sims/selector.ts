/**
 * The labels and Services simulator: six pods with labels, and one Service
 * selector the learner edits. A pod is an endpoint when every selector label
 * matches and the pod is Ready. Pure.
 */

import { nextSeed, pickIndex } from '@/lib/course/k8s/sims/random';

export type LabelKey = 'app' | 'version' | 'env';
export type Labels = Readonly<Record<LabelKey, string>>;
/** An empty string means the selector does not use the key. */
export type Selector = Readonly<Record<LabelKey, string>>;

export interface SelectorPod {
  name: string;
  labels: Labels;
}

export const LABEL_KEYS: readonly LabelKey[] = ['app', 'version', 'env'];

export const LABEL_VALUES: Readonly<Record<LabelKey, readonly string[]>> = {
  app: ['tugboat', 'dinghy', 'redis'],
  version: ['v1', 'v2', 'v7'],
  env: ['prod', 'dev'],
};

export const SELECTOR_PODS: readonly SelectorPod[] = [
  { name: 'tugboat-a', labels: { app: 'tugboat', version: 'v1', env: 'prod' } },
  { name: 'tugboat-b', labels: { app: 'tugboat', version: 'v1', env: 'prod' } },
  { name: 'tugboat-c', labels: { app: 'tugboat', version: 'v2', env: 'prod' } },
  { name: 'tugboat-d', labels: { app: 'tugboat', version: 'v2', env: 'dev' } },
  { name: 'dinghy-e', labels: { app: 'dinghy', version: 'v1', env: 'prod' } },
  { name: 'redis-f', labels: { app: 'redis', version: 'v7', env: 'prod' } },
];

export const START_SELECTOR: Selector = { app: 'tugboat', version: '', env: '' };
export const REQUESTS_SENT = 30;

export type PodMatch = 'endpoint' | 'not-ready' | 'none';

function usedKeys(selector: Selector): LabelKey[] {
  return LABEL_KEYS.filter((key) => selector[key] !== '');
}

/** What the Service does with one pod. */
export function podMatch(selector: Selector, pod: SelectorPod, ready: boolean): PodMatch {
  const keys = usedKeys(selector);
  if (keys.length === 0) return 'none';
  if (!keys.every((key) => pod.labels[key] === selector[key])) return 'none';
  return ready ? 'endpoint' : 'not-ready';
}

/** The pods that get traffic. `notReady` holds the names of the pods that fail readiness. */
export function endpoints(selector: Selector, notReady: ReadonlySet<string>): SelectorPod[] {
  return SELECTOR_PODS.filter(
    (pod) => podMatch(selector, pod, !notReady.has(pod.name)) === 'endpoint',
  );
}

/** The Service manifest for the selector. */
export function selectorYaml(selector: Selector): string {
  const keys = usedKeys(selector);
  const lines =
    keys.length === 0
      ? ['  selector: {}   # no selector: the Service gets no endpoints']
      : ['  selector:', ...keys.map((key) => `    ${key}: ${selector[key]}`)];
  return [
    'kind: Service',
    'spec:',
    ...lines,
    '  ports:',
    '  - port: 80',
    '    targetPort: 8080',
  ].join('\n');
}

/** How many of the 30 requests each endpoint gets. The spread is random, as with kube-proxy. */
export function sendRequests(
  targets: readonly SelectorPod[],
  seed: number,
): Readonly<Record<string, number>> {
  const hits: Record<string, number> = {};
  if (targets.length === 0) return hits;
  let value = seed;
  for (let index = 0; index < REQUESTS_SENT; index += 1) {
    value = nextSeed(value);
    const pod = targets[pickIndex(value, targets.length)];
    if (pod !== undefined) hits[pod.name] = (hits[pod.name] ?? 0) + 1;
  }
  return hits;
}

export interface SelectorVerdict {
  tone: 'ok' | 'meh' | 'no';
  count: number;
  text: string;
}

export function selectorVerdict(
  selector: Selector,
  notReady: ReadonlySet<string>,
): SelectorVerdict {
  const targets = endpoints(selector, notReady);
  const count = targets.length;
  if (usedKeys(selector).length === 0) {
    return { tone: 'no', count, text: 'A Service with an empty selector gets no endpoints.' };
  }
  if (count === 0) {
    return {
      tone: 'no',
      count,
      text: 'Requests fail with **connection refused**: no Ready pod matches.',
    };
  }
  if (targets.some((pod) => pod.labels.app !== targets[0]?.labels.app)) {
    return {
      tone: 'meh',
      count,
      text: 'Be careful: this selector puts different apps behind one name.',
    };
  }
  return {
    tone: 'ok',
    count,
    text: 'Traffic spreads across these pods. Clear **Ready** on a pod: it leaves the Service, but it is not deleted.',
  };
}
