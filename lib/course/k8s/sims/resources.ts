/**
 * The requests and limits simulator: one pod on a node of 4 CPU and 8 GiB
 * that already runs neighbours. The model answers four questions: does the
 * pod schedule, is it throttled, is it killed, and does it hurt the node. Pure.
 */

export interface PodResources {
  /** Millicores. */
  cpuRequest: number;
  cpuLimit: number;
  cpuWanted: number;
  /** Mebibytes. */
  memoryRequest: number;
  memoryLimit: number;
  memoryUsed: number;
  hasCpuLimit: boolean;
  hasMemoryLimit: boolean;
}

export type ResourcePreset = 'good' | 'rogue' | 'leak' | 'throttle' | 'big';

export const NODE = { cpu: 4000, memory: 8192 } as const;
export const NEIGHBOURS = {
  cpuRequest: 1500,
  memoryRequest: 3072,
  cpuUsed: 1200,
  memoryUsed: 2600,
} as const;

export const RESOURCE_PRESETS: Readonly<
  Record<ResourcePreset, { label: string; pod: PodResources }>
> = {
  good: {
    label: 'Good citizen',
    pod: {
      cpuRequest: 250,
      memoryRequest: 256,
      cpuLimit: 1000,
      memoryLimit: 512,
      cpuWanted: 300,
      memoryUsed: 300,
      hasCpuLimit: true,
      hasMemoryLimit: true,
    },
  },
  rogue: {
    label: 'No limits at all',
    pod: {
      cpuRequest: 0,
      memoryRequest: 0,
      cpuLimit: 1000,
      memoryLimit: 512,
      cpuWanted: 3500,
      memoryUsed: 6200,
      hasCpuLimit: false,
      hasMemoryLimit: false,
    },
  },
  leak: {
    label: 'Memory leak',
    pod: {
      cpuRequest: 250,
      memoryRequest: 256,
      cpuLimit: 1000,
      memoryLimit: 512,
      cpuWanted: 300,
      memoryUsed: 700,
      hasCpuLimit: true,
      hasMemoryLimit: true,
    },
  },
  throttle: {
    label: 'Tight CPU limit',
    pod: {
      cpuRequest: 100,
      memoryRequest: 128,
      cpuLimit: 200,
      memoryLimit: 256,
      cpuWanted: 900,
      memoryUsed: 150,
      hasCpuLimit: true,
      hasMemoryLimit: true,
    },
  },
  big: {
    label: 'Too big to schedule',
    pod: {
      cpuRequest: 3000,
      memoryRequest: 2048,
      cpuLimit: 3000,
      memoryLimit: 2048,
      cpuWanted: 500,
      memoryUsed: 500,
      hasCpuLimit: true,
      hasMemoryLimit: true,
    },
  },
};

export type QosClass = 'BestEffort' | 'Burstable' | 'Guaranteed';

export interface ResourceOutcome {
  qos: QosClass;
  scheduled: boolean;
  throttled: boolean;
  oomKilled: boolean;
  /** The node is almost out of memory, so the kubelet evicts pods. */
  memoryPressure: boolean;
  /** The pod takes CPU that the neighbours wanted. */
  cpuStarved: boolean;
  /** What the pod really gets, for the bars. */
  cpuGot: number;
  memoryGot: number;
  tone: 'ok' | 'meh' | 'no';
  text: string;
}

export function evaluatePod(pod: PodResources): ResourceOutcome {
  const hasRequest = pod.cpuRequest > 0 || pod.memoryRequest > 0;
  const hasLimit = pod.hasCpuLimit || pod.hasMemoryLimit;
  const qos: QosClass =
    !hasRequest && !hasLimit
      ? 'BestEffort'
      : pod.hasCpuLimit &&
          pod.hasMemoryLimit &&
          pod.cpuRequest === pod.cpuLimit &&
          pod.memoryRequest === pod.memoryLimit
        ? 'Guaranteed'
        : 'Burstable';

  const cpuFits = NEIGHBOURS.cpuRequest + pod.cpuRequest <= NODE.cpu;
  const memoryFits = NEIGHBOURS.memoryRequest + pod.memoryRequest <= NODE.memory;
  const scheduled = cpuFits && memoryFits;
  const throttled = scheduled && pod.hasCpuLimit && pod.cpuWanted > pod.cpuLimit;
  const oomKilled = scheduled && pod.hasMemoryLimit && pod.memoryUsed > pod.memoryLimit;
  const memoryPressure =
    scheduled && !oomKilled && NEIGHBOURS.memoryUsed + pod.memoryUsed > NODE.memory * 0.95;
  const cpuStarved = scheduled && !pod.hasCpuLimit && NEIGHBOURS.cpuUsed + pod.cpuWanted > NODE.cpu;

  const flags = { qos, scheduled, throttled, oomKilled, memoryPressure, cpuStarved };
  const got = {
    cpuGot:
      !scheduled || oomKilled
        ? 0
        : pod.hasCpuLimit
          ? Math.min(pod.cpuWanted, pod.cpuLimit)
          : pod.cpuWanted,
    memoryGot: !scheduled ? 0 : oomKilled ? pod.memoryLimit : pod.memoryUsed,
  };

  if (!scheduled) {
    return {
      ...flags,
      ...got,
      tone: 'no',
      text: `Pending: «0/1 nodes are available: Insufficient ${cpuFits ? 'memory' : 'cpu'}». The scheduler counts only requests, and the neighbours already reserve ${NEIGHBOURS.cpuRequest}m and ${NEIGHBOURS.memoryRequest}Mi. On GKE the node autoscaler adds a node.`,
    };
  }
  if (oomKilled) {
    return {
      ...flags,
      ...got,
      tone: 'no',
      text: `The app wants ${pod.memoryUsed}Mi, but the limit is ${pod.memoryLimit}Mi. The kernel kills it (**OOMKilled**, exit code 137) and the kubelet restarts it, again and again while the usage stays.`,
    };
  }
  if (memoryPressure) {
    return {
      ...flags,
      ...got,
      tone: 'no',
      text: 'There is no memory limit and the node is almost out of memory. The kubelet starts to evict pods: BestEffort first, then pods that use more than their requests.',
    };
  }
  if (cpuStarved) {
    return {
      ...flags,
      ...got,
      tone: 'meh',
      text: 'There is no CPU limit, so the pod takes CPU that the neighbours wanted. CPU is shared by request weight: the neighbours get slow, they do not crash.',
    };
  }
  if (throttled) {
    return {
      ...flags,
      ...got,
      tone: 'meh',
      text: `The app wants ${pod.cpuWanted}m, but the limit is ${pod.cpuLimit}m, so it runs about ${(pod.cpuWanted / pod.cpuLimit).toFixed(1)} times slower. A CPU limit throttles. It never kills.`,
    };
  }
  return {
    ...flags,
    ...got,
    tone: 'ok',
    text: 'The requests reserve what the pod needs, the limits protect the neighbours, and the usage stays inside both.',
  };
}
