/**
 * The autoscaling simulator: traffic, the HorizontalPodAutoscaler, Pending
 * pods and the node autoscaler, one tick at a time. One tick is 15 seconds,
 * the period of the HPA. Each pod requests 500m and can use 1000m. Pure.
 */

export type TrafficProfile = 'calm' | 'spike' | 'ramp';

export interface AutoscaleConfig {
  profile: TrafficProfile;
  hpa: boolean;
  nodeAutoscaler: boolean;
  /** The HPA target, as a percent of the CPU request. */
  target: number;
}

export interface AutoscaleNode {
  id: number;
  /** Ticks with no pod on the node. */
  empty: number;
}

export interface AutoscaleSample {
  /** Millicores the traffic needs. */
  load: number;
  /** Millicores the running pods can use. */
  capacity: number;
  running: number;
  pending: number;
  nodes: number;
  /** CPU in use, as a percent of the requests. */
  utilisation: number;
}

export interface AutoscaleState {
  tick: number;
  desired: number;
  nodes: AutoscaleNode[];
  /** Nodes that are not Ready yet, with the ticks they still need. */
  provisioning: { id: number; left: number }[];
  pendingTicks: number;
  lowTicks: number;
  history: AutoscaleSample[];
  /** The newest event first. */
  log: string[];
}

export const TICK_SECONDS = 15;
export const POD_REQUEST = 500;
export const POD_LIMIT = 1000;
export const PODS_PER_NODE = 7;
export const AUTOSCALE_LAST_TICK = 60;
export const HISTORY_KEPT = 48;

export const TRAFFIC_PROFILES: Readonly<Record<TrafficProfile, string>> = {
  calm: 'Calm',
  spike: 'Sale spike',
  ramp: 'Slow climb',
};

export const START_AUTOSCALE: AutoscaleConfig = {
  profile: 'spike',
  hpa: true,
  nodeAutoscaler: true,
  target: 50,
};

const MIN_REPLICAS = 2;
const MAX_REPLICAS = 12;
const MAX_NODES = 6;
const NODE_BOOT_TICKS = 4;
/** Five minutes: the scale-down stabilisation window of the HPA. */
const SCALE_DOWN_TICKS = 20;
/** Three minutes of an empty node before the node autoscaler removes it. */
const NODE_IDLE_TICKS = 12;
const LOG_KEPT = 6;

/** The CPU the traffic needs at a tick, in millicores. */
export function demand(profile: TrafficProfile, tick: number): number {
  if (profile === 'calm') return 600;
  if (profile === 'spike') return tick < 6 ? 600 : tick < 34 ? 5200 : 900;
  return Math.min(600 + tick * 160, 7200);
}

export function startAutoscale(): AutoscaleState {
  return {
    tick: 0,
    desired: MIN_REPLICAS,
    nodes: [{ id: 1, empty: 0 }],
    provisioning: [],
    pendingTicks: 0,
    lowTicks: 0,
    history: [],
    log: [],
  };
}

function say(state: AutoscaleState, message: string): void {
  state.log = [`${state.tick * TICK_SECONDS} s: ${message}`, ...state.log].slice(0, LOG_KEPT);
}

/** The pods that have a node, and the pods that wait for one. */
export function podCounts(state: AutoscaleState): { running: number; pending: number } {
  const running = Math.min(state.desired, state.nodes.length * PODS_PER_NODE);
  return { running, pending: state.desired - running };
}

function utilisation(load: number, running: number): number {
  const perPod = running > 0 ? Math.min(load / running, POD_LIMIT) : 0;
  return Math.round((100 * perPod) / POD_REQUEST);
}

/** Fifteen seconds of the cluster. */
export function tickAutoscale(before: AutoscaleState, config: AutoscaleConfig): AutoscaleState {
  const state = structuredClone(before);
  const load = demand(config.profile, state.tick);
  let { running, pending } = podCounts(state);

  if (config.hpa) {
    const used = utilisation(load, running);
    const want = Math.max(
      MIN_REPLICAS,
      Math.min(MAX_REPLICAS, Math.ceil((running * used) / config.target) || MIN_REPLICAS),
    );
    if (want > state.desired) {
      say(
        state,
        `HPA: CPU is ${used}% of the request, above ${config.target}%. Scales from ${state.desired} to ${want} replicas.`,
      );
      state.desired = want;
      state.lowTicks = 0;
    } else if (want < state.desired) {
      state.lowTicks += 1;
      if (state.lowTicks >= SCALE_DOWN_TICKS) {
        say(state, `HPA: 5 minutes below the target. Scales down to ${want} replicas.`);
        state.desired = want;
        state.lowTicks = 0;
      }
    } else {
      state.lowTicks = 0;
    }
  }

  ({ running, pending } = podCounts(state));
  if (config.nodeAutoscaler) {
    for (const node of state.provisioning) node.left -= 1;
    for (const node of state.provisioning.filter((item) => item.left <= 0)) {
      state.nodes.push({ id: node.id, empty: 0 });
      say(state, `Node autoscaler: node-${node.id} is Ready.`);
    }
    state.provisioning = state.provisioning.filter((item) => item.left > 0);

    if (pending > 0) {
      state.pendingTicks += 1;
      const missing = Math.ceil(pending / PODS_PER_NODE) - state.provisioning.length;
      const total = state.nodes.length + state.provisioning.length;
      if (state.pendingTicks >= 2 && missing > 0 && total < MAX_NODES) {
        const id =
          Math.max(...state.nodes.map((n) => n.id), ...state.provisioning.map((n) => n.id)) + 1;
        state.provisioning.push({ id, left: NODE_BOOT_TICKS });
        say(
          state,
          `${pending} pods are Pending. The node autoscaler creates node-${id} (about 1 minute).`,
        );
      }
    } else {
      state.pendingTicks = 0;
    }

    const nodesInUse = Math.ceil(running / PODS_PER_NODE);
    state.nodes.forEach((node, index) => {
      node.empty = index >= nodesInUse && state.nodes.length > 1 ? node.empty + 1 : 0;
    });
    const idle = state.nodes.filter((node, index) => index > 0 && node.empty >= NODE_IDLE_TICKS);
    const last = idle.at(-1);
    if (last !== undefined) {
      state.nodes = state.nodes.filter((node) => node !== last);
      say(state, `Node autoscaler: node-${last.id} was empty for 3 minutes. Removed.`);
    }
  }

  ({ running, pending } = podCounts(state));
  state.history = [
    ...state.history,
    {
      load,
      capacity: running * POD_LIMIT,
      running,
      pending,
      nodes: state.nodes.length,
      utilisation: utilisation(load, running),
    },
  ].slice(-HISTORY_KEPT);
  state.tick += 1;
  return state;
}

export interface AutoscaleVerdict {
  tone: 'ok' | 'no';
  headline: string;
  text: string;
}

export function autoscaleVerdict(state: AutoscaleState, config: AutoscaleConfig): AutoscaleVerdict {
  const last = state.history.at(-1);
  const { running, pending } = podCounts(state);
  if (last === undefined) {
    return {
      tone: 'ok',
      headline: 'Ready',
      text: 'Press **Play**. The demand is in CPU cores. Each pod requests 0.5 and can use 1.',
    };
  }
  const headline = `${running} running, ${pending} pending, ${state.nodes.length} ${state.nodes.length === 1 ? 'node' : 'nodes'}`;
  if (last.load > last.capacity) {
    if (pending > 0) {
      return {
        tone: 'no',
        headline,
        text: `${pending} pods are Pending, and the demand is above what the running pods can serve: requests get slow. ${config.nodeAutoscaler ? 'The node autoscaler brings a node.' : 'Turn on the node autoscaler.'}`,
      };
    }
    return {
      tone: 'no',
      headline,
      text: `The demand is above the capacity. ${config.hpa ? 'The HPA reacts at its next check.' : 'With no HPA, nothing reacts.'}`,
    };
  }
  return {
    tone: 'ok',
    headline,
    text: `CPU is at ${last.utilisation}% of the requests.${pending > 0 ? ` ${pending} pods are Pending: no node has room for them.` : ''}${state.lowTicks > 0 ? ' The load fell. The HPA waits 5 minutes before it scales down.' : ''}`,
  };
}
