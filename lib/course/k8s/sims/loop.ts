/**
 * The control loop simulator: a Deployment or a bare pod on two worker nodes.
 * The learner deletes pods, crashes containers and stops nodes, and the model
 * shows which part of Kubernetes repairs each failure. Pure: every function
 * returns a new state.
 */

import { nextSeed, pickIndex, podSuffix } from '@/lib/course/k8s/sims/random';

export type LoopMode = 'deploy' | 'bare';
export type LoopPodState = 'creating' | 'running' | 'terminating' | 'restarting' | 'unknown';

export interface LoopPod {
  id: string;
  node: string;
  state: LoopPodState;
  /** Ticks in the current state. */
  age: number;
  restarts: number;
}

export interface LoopNode {
  name: string;
  up: boolean;
  /** Ticks since the node stopped. */
  downFor: number;
}

export interface LoopState {
  mode: LoopMode;
  replicas: number;
  nodes: LoopNode[];
  pods: LoopPod[];
  /** The newest event first. */
  log: string[];
  seed: number;
}

export const LOOP_MIN_REPLICAS = 1;
export const LOOP_MAX_REPLICAS = 8;

const REPLICA_SET = '7c9d8f6b5';
const LOG_KEPT = 7;
/** One tick stands for one minute here: the node controller waits five. */
const EVICT_AFTER_TICKS = 5;

function say(state: LoopState, message: string): void {
  state.log = [message, ...state.log].slice(0, LOG_KEPT);
}

function isLive(pod: LoopPod): boolean {
  return pod.state !== 'terminating';
}

/** The running node with the fewest pods, or `null` when every node is down. */
function place(state: LoopState): string | null {
  let best: { name: string; count: number } | null = null;
  for (const node of state.nodes) {
    if (!node.up) continue;
    const count = state.pods.filter((pod) => pod.node === node.name && isLive(pod)).length;
    if (best === null || count < best.count) best = { name: node.name, count };
  }
  return best?.name ?? null;
}

function newPod(state: LoopState, node: string, podState: LoopPodState): LoopPod {
  state.seed = nextSeed(state.seed);
  const id =
    state.mode === 'deploy' ? `tugboat-${REPLICA_SET}-${podSuffix(state.seed)}` : 'tugboat';
  return { id, node, state: podState, age: 0, restarts: 0 };
}

/** A new cluster with every node up and the workload running. */
export function startLoop(mode: LoopMode, replicas: number, seed = 7): LoopState {
  const state: LoopState = {
    mode,
    replicas,
    nodes: [
      { name: 'kq-worker', up: true, downFor: 0 },
      { name: 'kq-worker2', up: true, downFor: 0 },
    ],
    pods: [],
    log: [],
    seed,
  };
  if (mode === 'deploy') {
    for (let index = 0; index < replicas; index += 1) {
      state.pods.push(newPod(state, place(state) ?? 'kq-worker', 'running'));
    }
    say(state, `Deployment tugboat: ReplicaSet tugboat-${REPLICA_SET} keeps ${replicas} pods.`);
  } else {
    state.pods.push(newPod(state, 'kq-worker', 'running'));
    say(state, 'Bare pod tugboat created. No controller owns it.');
  }
  return state;
}

/** One turn of the control loops: the kubelet, the node controller and the ReplicaSet. */
export function tickLoop(before: LoopState): LoopState {
  const state = structuredClone(before);

  state.pods = state.pods.filter((pod) => pod.state !== 'terminating' || pod.age < 1);
  for (const pod of state.pods) {
    pod.age += 1;
    if ((pod.state === 'creating' || pod.state === 'restarting') && pod.age > 1) {
      pod.state = 'running';
    }
  }

  for (const node of state.nodes) {
    if (node.up) continue;
    node.downFor += 1;
    const here = state.pods.filter((pod) => pod.node === node.name && isLive(pod));
    for (const pod of here) pod.state = 'unknown';
    if (node.downFor === EVICT_AFTER_TICKS) {
      for (const pod of here) {
        say(state, `Node controller: ${node.name} is unreachable for 5 minutes. Evicts ${pod.id}.`);
      }
      state.pods = state.pods.filter((pod) => !here.includes(pod));
    }
  }

  if (state.mode === 'deploy') {
    const live = state.pods.filter(isLive);
    if (live.length < state.replicas) {
      for (let have = live.length; have < state.replicas; have += 1) {
        const node = place(state);
        if (node === null) {
          say(state, 'Scheduler: no node is available. The pod stays Pending.');
          break;
        }
        const pod = newPod(state, node, 'creating');
        state.pods.push(pod);
        say(
          state,
          `ReplicaSet: wants ${state.replicas}, has ${have}. Creates ${pod.id} on ${node}.`,
        );
      }
    } else if (live.length > state.replicas) {
      for (const pod of live.slice(state.replicas)) {
        pod.state = 'terminating';
        pod.age = 0;
        say(state, `ReplicaSet: wants ${state.replicas}, has ${live.length}. Deletes ${pod.id}.`);
      }
    }
  }
  return state;
}

/** `kubectl delete pod <id>`. */
export function deletePod(before: LoopState, id: string): LoopState {
  const state = structuredClone(before);
  const pod = state.pods.find((item) => item.id === id);
  if (pod === undefined || !isLive(pod)) return before;
  pod.state = 'terminating';
  pod.age = 0;
  say(state, `You: kubectl delete pod ${pod.id}`);
  return state;
}

/** Deletes one live pod, chosen by the seed. */
export function deleteRandomPod(before: LoopState): LoopState {
  const live = before.pods.filter(isLive);
  const seed = nextSeed(before.seed);
  const pod = live[pickIndex(seed, live.length)];
  if (pod === undefined) return before;
  return deletePod({ ...before, seed }, pod.id);
}

/** The process in one running container exits. The kubelet restarts it in place. */
export function crashContainer(before: LoopState): LoopState {
  const state = structuredClone(before);
  const running = state.pods.filter((pod) => pod.state === 'running');
  state.seed = nextSeed(state.seed);
  const pod = running[pickIndex(state.seed, running.length)];
  if (pod === undefined) return before;
  pod.state = 'restarting';
  pod.age = 0;
  pod.restarts += 1;
  say(
    state,
    `kubelet on ${pod.node}: the container in ${pod.id} exited with code 1. Restarted in place (RESTARTS ${pod.restarts}).`,
  );
  return state;
}

/** Stops a running node, or starts a stopped one. */
export function toggleNode(before: LoopState, index: number): LoopState {
  const state = structuredClone(before);
  const node = state.nodes[index];
  if (node === undefined) return before;
  node.up = !node.up;
  node.downFor = 0;
  if (node.up) {
    for (const pod of state.pods) {
      if (pod.node === node.name && pod.state === 'unknown') pod.state = 'running';
    }
    say(state, `You: docker start ${node.name}. The node is Ready again. Pods do not move back.`);
  } else {
    say(state, `You: docker stop ${node.name}. The node is NotReady and its pods show Unknown.`);
  }
  return state;
}

/** `kubectl scale deployment tugboat --replicas=<n>`. */
export function scaleLoop(before: LoopState, replicas: number): LoopState {
  const state = structuredClone(before);
  state.replicas = Math.min(LOOP_MAX_REPLICAS, Math.max(LOOP_MIN_REPLICAS, replicas));
  say(state, `You: kubectl scale deployment tugboat --replicas=${state.replicas}`);
  return state;
}

/** One sentence on the state, in the course inline dialect. */
export function loopSummary(state: LoopState): string {
  if (state.mode === 'deploy') {
    const running = state.pods.filter((pod) => pod.state === 'running').length;
    return `**Desired ${state.replicas}, running ${running}.** The ReplicaSet controller compares the two numbers after every change and repairs the difference.`;
  }
  if (state.pods.length > 0) {
    return '**One bare pod.** The kubelet restarts a crashed container in place. A deleted pod does not come back.';
  }
  return '**No pods.** Nothing made a new one, because a bare pod has no owner. Change to a Deployment to compare.';
}

/** True when another tick changes nothing, so the simulator can stop its clock. */
export function isLoopSettled(state: LoopState): boolean {
  if (state.pods.some((pod) => pod.state !== 'running' && pod.state !== 'unknown')) return false;
  // A stopped node still counts down to the eviction of its pods.
  if (state.nodes.some((node) => !node.up && state.pods.some((pod) => pod.node === node.name))) {
    return false;
  }
  if (state.mode === 'bare') return true;
  return state.pods.length === state.replicas || state.nodes.every((node) => !node.up);
}
