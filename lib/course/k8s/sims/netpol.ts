/**
 * The NetworkPolicy simulator: seven policies in the namespace «shop», and
 * six connections to test. The model follows the real rules: a pod with no
 * policy accepts everything, policies only add allowed paths, and a
 * connection by name needs DNS first. Pure.
 */

export type PolicyId = 'di' | 'wa' | 'ad' | 'de' | 'dns' | 'we' | 'ae';
export type Workload = 'web' | 'api' | 'db' | 'intruder' | 'internet';

export interface Policy {
  id: PolicyId;
  name: string;
  does: string;
}

export const POLICIES: readonly Policy[] = [
  { id: 'di', name: 'default-deny-ingress', does: 'shop: no traffic comes in' },
  { id: 'wa', name: 'api-from-web', does: 'api accepts web on 8080' },
  { id: 'ad', name: 'db-from-api', does: 'db accepts api on 5432' },
  { id: 'de', name: 'default-deny-egress', does: 'shop: no traffic goes out' },
  { id: 'dns', name: 'allow-dns', does: 'shop can reach kube-dns on 53' },
  { id: 'we', name: 'web-egress-to-api', does: 'web can reach api' },
  { id: 'ae', name: 'api-egress-to-db', does: 'api can reach db' },
];

export type PolicyPreset = 'none' | 'deny' | 'trap' | 'zero';

export const POLICY_PRESETS: Readonly<
  Record<PolicyPreset, { label: string; on: readonly PolicyId[] }>
> = {
  none: { label: 'Flat network', on: [] },
  deny: { label: 'Deny all ingress', on: ['di'] },
  trap: { label: 'Deny egress (the trap)', on: ['di', 'wa', 'ad', 'de'] },
  zero: { label: 'Zero trust', on: ['di', 'wa', 'ad', 'de', 'dns', 'we', 'ae'] },
};

/** The connections the simulator tests. The first three are the real paths of the app. */
export const CONNECTIONS: ReadonlyArray<readonly [Workload, Workload]> = [
  ['web', 'api'],
  ['api', 'db'],
  ['web', 'db'],
  ['intruder', 'api'],
  ['intruder', 'db'],
  ['web', 'internet'],
];

const IN_SHOP: ReadonlySet<Workload> = new Set<Workload>(['web', 'api', 'db']);

type Active = ReadonlySet<PolicyId>;

/** True when one egress policy selects the pod. From then on, only listed traffic leaves it. */
function egressSelected(on: Active, source: Workload): boolean {
  if (!IN_SHOP.has(source)) return false;
  return (
    on.has('de') ||
    on.has('dns') ||
    (on.has('we') && source === 'web') ||
    (on.has('ae') && source === 'api')
  );
}

function dnsAllowed(on: Active, source: Workload): boolean {
  return !egressSelected(on, source) || on.has('dns');
}

function egressAllowed(on: Active, source: Workload, target: Workload): boolean {
  if (!egressSelected(on, source)) return true;
  if (on.has('we') && source === 'web' && target === 'api') return true;
  return on.has('ae') && source === 'api' && target === 'db';
}

function ingressAllowed(on: Active, source: Workload, target: Workload): boolean {
  if (!IN_SHOP.has(target)) return true;
  const selected =
    on.has('di') || (on.has('wa') && target === 'api') || (on.has('ad') && target === 'db');
  if (!selected) return true;
  if (on.has('wa') && target === 'api' && source === 'web') return true;
  return on.has('ad') && target === 'db' && source === 'api';
}

export interface ConnectionResult {
  verdict: 'ok' | 'dns' | 'blocked';
  why: string;
}

/** What happens when `source` opens a connection to `target` by name. */
export function testConnection(on: Active, source: Workload, target: Workload): ConnectionResult {
  if (!dnsAllowed(on, source)) {
    return { verdict: 'dns', why: 'The DNS lookup is blocked: bad address.' };
  }
  if (!egressAllowed(on, source, target)) {
    return { verdict: 'blocked', why: `Blocked by an egress policy on ${source}.` };
  }
  if (!ingressAllowed(on, source, target)) {
    return { verdict: 'blocked', why: `Blocked by an ingress policy on ${target}.` };
  }
  return { verdict: 'ok', why: 'Allowed.' };
}

export interface NetpolVerdict {
  tone: 'ok' | 'meh' | 'no';
  text: string;
}

/** Zero trust means: the two real paths work, and every other test fails. */
export function netpolVerdict(on: Active): NetpolVerdict {
  const results = CONNECTIONS.map(([source, target]) => testConnection(on, source, target));
  const realPaths = results.slice(0, 2);
  const others = results.slice(2);
  if (results.some((result) => result.verdict === 'dns')) {
    return {
      tone: 'no',
      text: 'The trap: egress is denied, so the DNS lookup fails before the app can connect. Add **allow-dns** first.',
    };
  }
  if (realPaths.some((result) => result.verdict !== 'ok')) {
    return { tone: 'no', text: 'A real path of the app is blocked. Add the allow rule for it.' };
  }
  if (others.every((result) => result.verdict === 'blocked')) {
    return {
      tone: 'ok',
      text: 'Zero trust: only web to api and api to db work. Each path has an egress rule and an ingress rule.',
    };
  }
  if (on.size === 0) {
    return { tone: 'meh', text: 'A flat network: every pod reaches every pod, the intruder too.' };
  }
  return {
    tone: 'meh',
    text: 'The app works, but a path that the app does not need is still open.',
  };
}
