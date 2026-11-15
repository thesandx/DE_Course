/**
 * The RBAC puzzle: the learner builds a role and a binding, and a table of
 * «kubectl auth can-i» checks shows if they grant exactly what the mission
 * needs. Pure.
 */

export type RoleKind = 'Role' | 'ClusterRole';
export type BindingKind = 'RoleBinding' | 'ClusterRoleBinding';
export type ApiGroup = '' | 'apps' | 'batch';

export const RESOURCE_GROUPS = {
  pods: '',
  'pods/log': '',
  'pods/exec': '',
  secrets: '',
  configmaps: '',
  deployments: 'apps',
  jobs: 'batch',
} as const satisfies Record<string, ApiGroup>;

export type RbacResource = keyof typeof RESOURCE_GROUPS;

export const RBAC_RESOURCES = Object.keys(RESOURCE_GROUPS) as RbacResource[];
export const RBAC_VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'] as const;
export type RbacVerb = (typeof RBAC_VERBS)[number];

export const API_GROUPS: ReadonlyArray<{ value: ApiGroup; label: string }> = [
  { value: '', label: '"" (core)' },
  { value: 'apps', label: 'apps' },
  { value: 'batch', label: 'batch' },
];

export interface RbacRule {
  group: ApiGroup;
  resources: RbacResource[];
  verbs: RbacVerb[];
}

export interface RbacSetup {
  kind: RoleKind;
  binding: BindingKind;
  rules: RbacRule[];
}

export type RbacCheck = readonly [verb: RbacVerb, resource: RbacResource, namespace: string];

export interface RbacMission {
  name: string;
  brief: string;
  allow: readonly RbacCheck[];
  deny: readonly RbacCheck[];
}

export const RBAC_MISSIONS: readonly RbacMission[] = [
  {
    name: 'CI deployer',
    brief: '«ci-bot» can update Deployments and read pods in «team-a». Nothing else.',
    allow: [
      ['patch', 'deployments', 'team-a'],
      ['get', 'deployments', 'team-a'],
      ['list', 'pods', 'team-a'],
    ],
    deny: [
      ['get', 'secrets', 'team-a'],
      ['delete', 'deployments', 'team-a'],
      ['patch', 'deployments', 'default'],
      ['create', 'pods/exec', 'team-a'],
    ],
  },
  {
    name: 'Log reader',
    brief:
      '«support» can read pods and their logs in «team-a». It must not exec into them or read Secrets.',
    allow: [
      ['list', 'pods', 'team-a'],
      ['get', 'pods/log', 'team-a'],
    ],
    deny: [
      ['create', 'pods/exec', 'team-a'],
      ['get', 'secrets', 'team-a'],
      ['list', 'pods', 'default'],
      ['delete', 'pods', 'team-a'],
    ],
  },
  {
    name: 'Batch operator',
    brief: '«etl-runner» can create Jobs and list pods in every namespace.',
    allow: [
      ['create', 'jobs', 'team-a'],
      ['create', 'jobs', 'default'],
      ['list', 'pods', 'default'],
    ],
    deny: [
      ['delete', 'deployments', 'team-a'],
      ['get', 'secrets', 'default'],
      ['delete', 'jobs', 'default'],
    ],
  },
];

export const START_RBAC: RbacSetup = {
  kind: 'Role',
  binding: 'RoleBinding',
  rules: [
    { group: 'apps', resources: [], verbs: [] },
    { group: '', resources: [], verbs: [] },
  ],
};

/** A ClusterRoleBinding can name only a ClusterRole. */
export function isSetupValid(setup: RbacSetup): boolean {
  return !(setup.kind === 'Role' && setup.binding === 'ClusterRoleBinding');
}

/** The answer of `kubectl auth can-i <verb> <resource> -n <namespace>`. */
export function canI(setup: RbacSetup, [verb, resource, namespace]: RbacCheck): boolean {
  if (!isSetupValid(setup)) return false;
  // A RoleBinding grants in its own namespace only, also when it names a ClusterRole.
  if (setup.binding === 'RoleBinding' && namespace !== 'team-a') return false;
  return setup.rules.some(
    (rule) =>
      rule.group === RESOURCE_GROUPS[resource] &&
      rule.resources.includes(resource) &&
      rule.verbs.includes(verb),
  );
}

export interface RbacRow {
  check: RbacCheck;
  expected: boolean;
  actual: boolean;
}

export function missionRows(setup: RbacSetup, mission: RbacMission): RbacRow[] {
  const row = (check: RbacCheck, expected: boolean): RbacRow => ({
    check,
    expected,
    actual: canI(setup, check),
  });
  return [
    ...mission.allow.map((check) => row(check, true)),
    ...mission.deny.map((check) => row(check, false)),
  ];
}

/** True when every check gives the answer the mission needs. */
export function isMissionSolved(setup: RbacSetup, mission: RbacMission): boolean {
  return isSetupValid(setup) && missionRows(setup, mission).every((r) => r.expected === r.actual);
}

function quoted(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(', ');
}

/** The role and the binding as manifests. */
export function rbacYaml(setup: RbacSetup): string {
  const meta = (namespaced: boolean): string =>
    namespaced ? 'metadata: {name: puzzle, namespace: team-a}' : 'metadata: {name: puzzle}';
  const lines = [`kind: ${setup.kind}`, meta(setup.kind === 'Role'), 'rules:'];
  for (const rule of setup.rules) {
    if (rule.resources.length === 0 && rule.verbs.length === 0) continue;
    lines.push(
      `- apiGroups: ["${rule.group}"]`,
      `  resources: [${quoted(rule.resources)}]`,
      `  verbs: [${quoted(rule.verbs)}]`,
    );
  }
  lines.push(
    '---',
    `kind: ${setup.binding}`,
    meta(setup.binding === 'RoleBinding'),
    `roleRef: {kind: ${setup.kind}, name: puzzle}`,
  );
  return lines.join('\n');
}

/** A copy of `values` with `value` added or removed, in the order of `order`. */
export function toggled<T>(values: readonly T[], value: T, order: readonly T[]): T[] {
  const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  return order.filter((item) => next.includes(item));
}
