import { describe, expect, it } from 'vitest';

import {
  autoscaleVerdict,
  demand,
  podCounts,
  START_AUTOSCALE,
  startAutoscale,
  tickAutoscale,
} from '@/lib/course/k8s/sims/autoscale';
import {
  crashContainer,
  deletePod,
  deleteRandomPod,
  isLoopSettled,
  type LoopState,
  loopSummary,
  scaleLoop,
  startLoop,
  tickLoop,
  toggleNode,
} from '@/lib/course/k8s/sims/loop';
import {
  CONNECTIONS,
  netpolVerdict,
  POLICY_PRESETS,
  type PolicyId,
  testConnection,
} from '@/lib/course/k8s/sims/netpol';
import {
  PROBE_SECONDS,
  probeVerdict,
  runProbes,
  START_PROBES,
  toSpans,
} from '@/lib/course/k8s/sims/probes';
import { nextSeed, pickIndex, podSuffix } from '@/lib/course/k8s/sims/random';
import {
  canI,
  isMissionSolved,
  missionRows,
  RBAC_MISSIONS,
  type RbacSetup,
  rbacYaml,
  START_RBAC,
  toggled,
} from '@/lib/course/k8s/sims/rbac';
import { evaluatePod, RESOURCE_PRESETS } from '@/lib/course/k8s/sims/resources';
import {
  deployVersion,
  isRolloutDone,
  isRolloutSettled,
  type RolloutState,
  setStrategy,
  startRollout,
  stepRollout,
  undoRollout,
} from '@/lib/course/k8s/sims/rollout';
import {
  endpoints,
  podMatch,
  REQUESTS_SENT,
  SELECTOR_PODS,
  selectorVerdict,
  selectorYaml,
  sendRequests,
  START_SELECTOR,
} from '@/lib/course/k8s/sims/selector';

function ticks(state: LoopState, count: number): LoopState {
  let next = state;
  for (let index = 0; index < count; index += 1) next = tickLoop(next);
  return next;
}

function steps(state: RolloutState, count: number): RolloutState {
  let next = state;
  for (let index = 0; index < count; index += 1) next = stepRollout(next);
  return next;
}

describe('random', () => {
  it('gives the same values for the same seed', () => {
    expect(nextSeed(7)).toBe(nextSeed(7));
    expect(podSuffix(7)).toBe(podSuffix(7));
    expect(podSuffix(7)).toMatch(/^[a-z0-9]{5}$/);
    expect(podSuffix(7)).not.toBe(podSuffix(8));
  });

  it('keeps an index inside the list', () => {
    expect(pickIndex(2 ** 32 - 1, 3)).toBe(2);
    expect(pickIndex(0, 3)).toBe(0);
    expect(pickIndex(5, 0)).toBe(0);
  });
});

describe('the control loop', () => {
  it('starts a Deployment with its replicas spread over the nodes', () => {
    const state = startLoop('deploy', 4);
    expect(state.pods).toHaveLength(4);
    expect(state.pods.filter((pod) => pod.node === 'kq-worker')).toHaveLength(2);
    expect(isLoopSettled(state)).toBe(true);
    expect(loopSummary(state)).toContain('Desired 4, running 4');
  });

  it('replaces a deleted pod of a Deployment', () => {
    const start = startLoop('deploy', 3);
    const first = start.pods[0]?.id ?? '';
    const deleted = deletePod(start, first);
    expect(deleted.log[0]).toBe(`You: kubectl delete pod ${first}`);
    expect(isLoopSettled(deleted)).toBe(false);

    const healed = ticks(deleted, 4);
    expect(healed.pods).toHaveLength(3);
    expect(healed.pods.every((pod) => pod.state === 'running')).toBe(true);
    expect(healed.pods.some((pod) => pod.id === first)).toBe(false);
    expect(healed.log.some((line) => line.startsWith('ReplicaSet: wants 3, has 2'))).toBe(true);
    expect(isLoopSettled(healed)).toBe(true);
  });

  it('does not bring a deleted bare pod back', () => {
    const gone = ticks(deleteRandomPod(startLoop('bare', 3)), 4);
    expect(gone.pods).toHaveLength(0);
    expect(loopSummary(gone)).toContain('No pods');
    expect(isLoopSettled(gone)).toBe(true);
  });

  it('restarts a crashed container in place, also for a bare pod', () => {
    const crashed = crashContainer(startLoop('bare', 1));
    expect(crashed.pods[0]).toMatchObject({ id: 'tugboat', state: 'restarting', restarts: 1 });
    const back = ticks(crashed, 2);
    expect(back.pods[0]).toMatchObject({ id: 'tugboat', state: 'running', restarts: 1 });
    expect(loopSummary(back)).toContain('One bare pod');
  });

  it('evicts the pods of a stopped node after five ticks and makes new ones', () => {
    const stopped = toggleNode(startLoop('deploy', 4), 0);
    const soon = ticks(stopped, 2);
    expect(soon.pods.filter((pod) => pod.state === 'unknown')).toHaveLength(2);
    expect(soon.pods).toHaveLength(4);

    const later = ticks(stopped, 8);
    expect(later.pods).toHaveLength(4);
    expect(later.pods.every((pod) => pod.node === 'kq-worker2')).toBe(true);
    expect(later.log.some((line) => line.startsWith('Node controller'))).toBe(true);
  });

  it('gives the pods back to a node that starts again in time', () => {
    const stopped = ticks(toggleNode(startLoop('deploy', 2), 0), 2);
    const started = toggleNode(stopped, 0);
    expect(started.pods.every((pod) => pod.state === 'running')).toBe(true);
    expect(started.log[0]).toContain('docker start kq-worker');
  });

  it('keeps pods Pending when no node is up', () => {
    let state = toggleNode(toggleNode(startLoop('deploy', 2), 0), 1);
    state = ticks(state, 6);
    expect(state.pods).toHaveLength(0);
    expect(state.log[0]).toContain('no node is available');
    expect(isLoopSettled(state)).toBe(true);
  });

  it('scales down and up, inside the limits', () => {
    const down = ticks(scaleLoop(startLoop('deploy', 4), 2), 3);
    expect(down.pods).toHaveLength(2);
    expect(scaleLoop(down, 99).replicas).toBe(8);
    expect(scaleLoop(down, 0).replicas).toBe(1);
  });

  it('ignores an action that has no target', () => {
    const state = startLoop('deploy', 1);
    expect(deletePod(state, 'no-such-pod')).toBe(state);
    expect(toggleNode(state, 9)).toBe(state);
    const empty = ticks(deleteRandomPod(startLoop('bare', 1)), 3);
    expect(crashContainer(empty)).toBe(empty);
    expect(deleteRandomPod(empty)).toBe(empty);
  });
});

describe('the rolling update', () => {
  it('moves to a good version and never goes below the Ready limit', () => {
    let state = deployVersion(startRollout(4, 1, 0), 'v2');
    expect(state.message).toContain('tugboat:v2');
    for (let index = 0; index < 20 && !isRolloutDone(state); index += 1) {
      state = stepRollout(state);
      const ready = state.pods.filter((pod) => pod.state === 'ready').length;
      const live = state.pods.filter((pod) => pod.state !== 'terminating').length;
      expect(ready).toBeGreaterThanOrEqual(4);
      expect(live).toBeLessThanOrEqual(5);
    }
    expect(isRolloutDone(state)).toBe(true);
    expect(state.message).toContain('all 4 pods run v2');
    expect(isRolloutSettled(state)).toBe(true);
  });

  it('stops on a broken version and keeps the old pods', () => {
    const state = steps(deployVersion(startRollout(4, 1, 0), 'v3'), 6);
    expect(state.pods.filter((pod) => pod.version === 'v1' && pod.state === 'ready')).toHaveLength(
      4,
    );
    expect(state.pods.filter((pod) => pod.state === 'failed')).toHaveLength(1);
    expect(state.message).toContain('ProgressDeadlineExceeded');
    expect(isRolloutSettled(state)).toBe(true);
  });

  it('comes back with an undo', () => {
    const broken = steps(deployVersion(startRollout(3, 1, 1), 'v3'), 5);
    const undone = undoRollout(broken);
    expect(undone.target).toBe('v1');
    expect(undone.message).toContain('back to v1');
    expect(isRolloutDone(steps(undone, 6))).toBe(true);
  });

  it('has nothing to undo at the first version', () => {
    const state = startRollout(2, 1, 0);
    expect(undoRollout(state)).toBe(state);
  });

  it('refuses a strategy that cannot move', () => {
    const frozen = setStrategy(startRollout(3, 1, 0), 0, 0);
    expect(deployVersion(frozen, 'v2').message).toContain('cannot both be 0');
    expect(stepRollout(frozen).message).toContain('cannot both be 0');
    expect(isRolloutSettled(frozen)).toBe(true);
  });

  it('caps maxUnavailable at the replica count', () => {
    expect(startRollout(2, 0, 3).unavailable).toBe(2);
    expect(setStrategy(startRollout(2, 1, 0), 1, 3).unavailable).toBe(2);
  });

  it('rolls with maxUnavailable only: fewer pods, never more', () => {
    let state = deployVersion(startRollout(4, 0, 2), 'v2');
    for (let index = 0; index < 20 && !isRolloutDone(state); index += 1) {
      state = stepRollout(state);
      expect(state.pods.filter((pod) => pod.state !== 'terminating').length).toBeLessThanOrEqual(4);
    }
    expect(isRolloutDone(state)).toBe(true);
  });
});

describe('labels and Services', () => {
  const allReady = new Set<string>();

  it('selects the pods that carry every label of the selector', () => {
    expect(endpoints(START_SELECTOR, allReady).map((pod) => pod.name)).toEqual([
      'tugboat-a',
      'tugboat-b',
      'tugboat-c',
      'tugboat-d',
    ]);
    const narrow = { app: 'tugboat', version: 'v2', env: 'prod' };
    expect(endpoints(narrow, allReady).map((pod) => pod.name)).toEqual(['tugboat-c']);
  });

  it('drops a pod that is not Ready, but still matches it', () => {
    const pod = SELECTOR_PODS[0];
    if (pod === undefined) throw new Error('no pod');
    expect(podMatch(START_SELECTOR, pod, false)).toBe('not-ready');
    expect(endpoints(START_SELECTOR, new Set(['tugboat-a']))).toHaveLength(3);
  });

  it('gives a Service with no selector no endpoints', () => {
    const empty = { app: '', version: '', env: '' };
    expect(endpoints(empty, allReady)).toHaveLength(0);
    expect(selectorVerdict(empty, allReady).tone).toBe('no');
    expect(selectorYaml(empty)).toContain('selector: {}');
  });

  it('writes the selector as YAML', () => {
    expect(selectorYaml({ app: 'redis', version: '', env: 'prod' })).toContain(
      '  selector:\n    app: redis\n    env: prod\n',
    );
  });

  it('judges the selector', () => {
    expect(selectorVerdict(START_SELECTOR, allReady)).toMatchObject({ tone: 'ok', count: 4 });
    expect(selectorVerdict({ app: '', version: 'v1', env: '' }, allReady).tone).toBe('meh');
    expect(selectorVerdict({ app: 'redis', version: 'v1', env: '' }, allReady).text).toContain(
      'connection refused',
    );
  });

  it('spreads 30 requests over the endpoints only', () => {
    const targets = endpoints(START_SELECTOR, allReady);
    const hits = sendRequests(targets, 1);
    expect(Object.values(hits).reduce((sum, count) => sum + count, 0)).toBe(REQUESTS_SENT);
    expect(Object.keys(hits).every((name) => name.startsWith('tugboat-'))).toBe(true);
    expect(sendRequests([], 1)).toEqual({});
  });
});

describe('the probes timeline', () => {
  it('records one entry for each second', () => {
    const run = runProbes(START_PROBES);
    expect(run.ready).toHaveLength(PROBE_SECONDS + 1);
    expect(run.process).toHaveLength(PROBE_SECONDS + 1);
  });

  it('loops on a slow start when liveness is not patient', () => {
    const run = runProbes(START_PROBES);
    expect(run.restarts.length).toBeGreaterThan(2);
    expect(run.ready.some(Boolean)).toBe(false);
    expect(probeVerdict(START_PROBES, run)).toMatchObject({ tone: 'no', serving: 0 });
  });

  it('survives a slow start with a startup probe', () => {
    const settings = { ...START_PROBES, startup: true };
    const run = runProbes(settings);
    expect(run.restarts).toHaveLength(0);
    expect(run.startup.at(-1)).toEqual({ at: 40, pass: true });
    expect(run.ready[45]).toBe(true);
    expect(probeVerdict(settings, run).text).toContain('startup probe held liveness back');
  });

  it('survives a slow start with a patient liveness probe', () => {
    const settings = { ...START_PROBES, livenessPeriod: 10, livenessThreshold: 5 };
    const verdict = probeVerdict(settings, runProbes(settings));
    expect(verdict.tone).toBe('ok');
    expect(verdict.text).toContain('slow to catch');
  });

  it('restarts a deadlocked container', () => {
    const settings = { ...START_PROBES, scenario: 'hang' as const };
    const run = runProbes(settings);
    expect(run.restarts[0]).toBe(55);
    expect(run.process[50]).toBe('hung');
    expect(probeVerdict(settings, run).tone).toBe('ok');
  });

  it('never restarts a deadlock when liveness is too patient', () => {
    const settings = {
      ...START_PROBES,
      scenario: 'hang' as const,
      livenessPeriod: 20,
      livenessThreshold: 10,
    };
    const run = runProbes(settings);
    expect(run.restarts).toHaveLength(0);
    expect(probeVerdict(settings, run).tone).toBe('no');
  });

  it('takes the pod out of traffic during an outage, with no restart', () => {
    const settings = { ...START_PROBES, scenario: 'outage' as const };
    const run = runProbes(settings);
    expect(run.restarts).toHaveLength(0);
    expect(run.ready[25]).toBe(true);
    expect(run.ready[45]).toBe(false);
    expect(run.ready[70]).toBe(true);
    expect(probeVerdict(settings, run).tone).toBe('ok');
  });

  it('joins equal neighbours into spans', () => {
    expect(toSpans(['a', 'a', 'b', 'a'])).toEqual([
      { value: 'a', from: 0, to: 2 },
      { value: 'b', from: 2, to: 3 },
      { value: 'a', from: 3, to: 4 },
    ]);
    expect(toSpans([])).toEqual([]);
  });
});

describe('requests and limits', () => {
  it('judges each preset', () => {
    expect(evaluatePod(RESOURCE_PRESETS.good.pod)).toMatchObject({
      tone: 'ok',
      qos: 'Burstable',
      scheduled: true,
    });
    expect(evaluatePod(RESOURCE_PRESETS.rogue.pod)).toMatchObject({
      tone: 'no',
      qos: 'BestEffort',
      memoryPressure: true,
    });
    expect(evaluatePod(RESOURCE_PRESETS.leak.pod)).toMatchObject({
      tone: 'no',
      oomKilled: true,
      memoryGot: 512,
      cpuGot: 0,
    });
    expect(evaluatePod(RESOURCE_PRESETS.throttle.pod)).toMatchObject({
      tone: 'meh',
      throttled: true,
      cpuGot: 200,
    });
    expect(evaluatePod(RESOURCE_PRESETS.big.pod)).toMatchObject({
      tone: 'no',
      scheduled: false,
      qos: 'Guaranteed',
    });
  });

  it('names the resource that does not fit', () => {
    expect(evaluatePod(RESOURCE_PRESETS.big.pod).text).toContain('Insufficient cpu');
    const wide = { ...RESOURCE_PRESETS.good.pod, memoryRequest: 6000 };
    expect(evaluatePod(wide).text).toContain('Insufficient memory');
  });

  it('sees a pod with no CPU limit take the CPU of its neighbours', () => {
    const greedy = { ...RESOURCE_PRESETS.good.pod, hasCpuLimit: false, cpuWanted: 3500 };
    expect(evaluatePod(greedy)).toMatchObject({ tone: 'meh', cpuStarved: true, cpuGot: 3500 });
  });
});

describe('the autoscaling chain', () => {
  function run(config = START_AUTOSCALE, count = 60) {
    let state = startAutoscale();
    for (let index = 0; index < count; index += 1) state = tickAutoscale(state, config);
    return state;
  }

  it('gives the demand of each traffic profile', () => {
    expect(demand('calm', 30)).toBe(600);
    expect(demand('spike', 0)).toBe(600);
    expect(demand('spike', 10)).toBe(5200);
    expect(demand('spike', 40)).toBe(900);
    expect(demand('ramp', 1000)).toBe(7200);
  });

  it('stays on one node when traffic is calm', () => {
    const state = run({ ...START_AUTOSCALE, profile: 'calm' });
    // 600m on two pods is 60% of the request, so the HPA adds one pod and stops.
    expect(podCounts(state)).toEqual({ running: 3, pending: 0 });
    expect(state.nodes).toHaveLength(1);
    expect(state.log).toHaveLength(1);
  });

  it('scales pods, then nodes, on a spike, and comes back down', () => {
    const peak = run(START_AUTOSCALE, 30);
    expect(peak.desired).toBeGreaterThan(7);
    expect(peak.nodes.length).toBeGreaterThan(1);
    expect(podCounts(peak).pending).toBe(0);
    expect(autoscaleVerdict(peak, START_AUTOSCALE).tone).toBe('ok');

    const end = run(START_AUTOSCALE, 80);
    expect(end.desired).toBeLessThan(peak.desired);
    expect(end.history).toHaveLength(48);
  });

  it('leaves pods Pending with no node autoscaler', () => {
    const config = { ...START_AUTOSCALE, nodeAutoscaler: false };
    const spike = run(config, 20);
    expect(spike.nodes).toHaveLength(1);
    expect(podCounts(spike).pending).toBeGreaterThan(0);
    expect(autoscaleVerdict(spike, config).text).toContain('no node has room');

    const climb = { ...config, profile: 'ramp' as const };
    const state = run(climb, 50);
    const verdict = autoscaleVerdict(state, climb);
    expect(verdict.tone).toBe('no');
    expect(verdict.text).toContain('Turn on the node autoscaler');
  });

  it('does nothing with no HPA', () => {
    const config = { ...START_AUTOSCALE, hpa: false };
    const state = run(config, 20);
    expect(state.desired).toBe(2);
    expect(autoscaleVerdict(state, config).text).toContain('With no HPA');
  });

  it('asks the learner to press Play at the start', () => {
    expect(autoscaleVerdict(startAutoscale(), START_AUTOSCALE).headline).toBe('Ready');
  });
});

describe('the NetworkPolicy firewall', () => {
  const preset = (name: keyof typeof POLICY_PRESETS): Set<PolicyId> =>
    new Set(POLICY_PRESETS[name].on);
  const verdicts = (on: Set<PolicyId>): string[] =>
    CONNECTIONS.map(([source, target]) => testConnection(on, source, target).verdict);

  it('allows everything on a flat network', () => {
    expect(verdicts(preset('none'))).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
    expect(netpolVerdict(preset('none')).tone).toBe('meh');
  });

  it('blocks every path into shop with a default deny', () => {
    expect(verdicts(preset('deny'))).toEqual([
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'ok',
    ]);
    expect(netpolVerdict(preset('deny')).text).toContain('real path');
  });

  it('breaks DNS when egress is denied with no DNS rule', () => {
    const on = preset('trap');
    expect(testConnection(on, 'web', 'api')).toEqual({
      verdict: 'dns',
      why: 'The DNS lookup is blocked: bad address.',
    });
    expect(testConnection(on, 'intruder', 'api').verdict).toBe('blocked');
    expect(netpolVerdict(on).text).toContain('allow-dns');
  });

  it('opens only the two real paths with zero trust', () => {
    expect(verdicts(preset('zero'))).toEqual([
      'ok',
      'ok',
      'blocked',
      'blocked',
      'blocked',
      'blocked',
    ]);
    expect(netpolVerdict(preset('zero')).tone).toBe('ok');
    expect(testConnection(preset('zero'), 'web', 'db').why).toContain('egress policy on web');
  });

  it('says when the app works but a path is still open', () => {
    const on = new Set<PolicyId>(['di', 'wa', 'ad']);
    expect(verdicts(on)).toEqual(['ok', 'ok', 'blocked', 'blocked', 'blocked', 'ok']);
    expect(netpolVerdict(on).text).toContain('still open');
  });
});

describe('the RBAC puzzle', () => {
  const [deployer, reader, batch] = RBAC_MISSIONS;
  if (deployer === undefined || reader === undefined || batch === undefined) {
    throw new Error('missions are missing');
  }

  const deployerSetup: RbacSetup = {
    kind: 'Role',
    binding: 'RoleBinding',
    rules: [
      { group: 'apps', resources: ['deployments'], verbs: ['get', 'patch'] },
      { group: '', resources: ['pods'], verbs: ['get', 'list'] },
    ],
  };

  it('grants nothing at the start', () => {
    expect(missionRows(START_RBAC, deployer).every((row) => !row.actual)).toBe(true);
    expect(isMissionSolved(START_RBAC, deployer)).toBe(false);
  });

  it('solves the deployer mission with a Role in team-a', () => {
    expect(isMissionSolved(deployerSetup, deployer)).toBe(true);
    expect(canI(deployerSetup, ['patch', 'deployments', 'default'])).toBe(false);
  });

  it('needs the right API group', () => {
    const wrongGroup: RbacSetup = {
      ...deployerSetup,
      rules: [{ group: '', resources: ['deployments'], verbs: ['patch'] }],
    };
    expect(canI(wrongGroup, ['patch', 'deployments', 'team-a'])).toBe(false);
  });

  it('solves the log reader mission without exec', () => {
    const setup: RbacSetup = {
      kind: 'Role',
      binding: 'RoleBinding',
      rules: [{ group: '', resources: ['pods', 'pods/log'], verbs: ['get', 'list'] }],
    };
    expect(isMissionSolved(setup, reader)).toBe(true);
  });

  it('needs a ClusterRoleBinding for every namespace', () => {
    const rules: RbacSetup['rules'] = [
      { group: 'batch', resources: ['jobs'], verbs: ['create'] },
      { group: '', resources: ['pods'], verbs: ['list'] },
    ];
    const inOneNamespace: RbacSetup = { kind: 'ClusterRole', binding: 'RoleBinding', rules };
    expect(isMissionSolved(inOneNamespace, batch)).toBe(false);
    expect(isMissionSolved({ ...inOneNamespace, binding: 'ClusterRoleBinding' }, batch)).toBe(true);
  });

  it('refuses a ClusterRoleBinding to a Role', () => {
    const invalid: RbacSetup = { ...deployerSetup, binding: 'ClusterRoleBinding' };
    expect(canI(invalid, ['list', 'pods', 'team-a'])).toBe(false);
    expect(isMissionSolved(invalid, deployer)).toBe(false);
  });

  it('writes the role and the binding as YAML', () => {
    const yaml = rbacYaml(deployerSetup);
    expect(yaml).toContain('kind: Role\nmetadata: {name: puzzle, namespace: team-a}');
    expect(yaml).toContain(
      '- apiGroups: ["apps"]\n  resources: ["deployments"]\n  verbs: ["get", "patch"]',
    );
    expect(yaml).toContain('roleRef: {kind: Role, name: puzzle}');
    expect(rbacYaml({ ...START_RBAC, kind: 'ClusterRole' })).toContain(
      'kind: ClusterRole\nmetadata: {name: puzzle}\nrules:\n---',
    );
  });

  it('adds and removes a value in a fixed order', () => {
    expect(toggled(['c'], 'a', ['a', 'b', 'c'])).toEqual(['a', 'c']);
    expect(toggled(['a', 'c'], 'c', ['a', 'b', 'c'])).toEqual(['a']);
  });
});
