/**
 * The rolling update simulator: one Deployment that moves from one image
 * version to the next inside the limits of «maxSurge» and «maxUnavailable».
 * Version v3 names an image that does not exist, so its pods never get Ready.
 * Pure: every function returns a new state.
 */

export type RolloutVersion = 'v1' | 'v2' | 'v3';
export type RolloutPodState = 'ready' | 'starting' | 'failed' | 'terminating';

export interface RolloutPod {
  id: number;
  version: RolloutVersion;
  state: RolloutPodState;
}

export interface RolloutState {
  replicas: number;
  surge: number;
  unavailable: number;
  pods: RolloutPod[];
  target: RolloutVersion;
  /** The versions deployed so far. The last one is the target. */
  history: RolloutVersion[];
  steps: number;
  /** Steps in a row that changed nothing. */
  stuck: number;
  message: string;
  nextId: number;
}

export const ROLLOUT_VERSIONS: readonly RolloutVersion[] = ['v1', 'v2', 'v3'];
export const ROLLOUT_MAX_REPLICAS = 8;
export const ROLLOUT_MAX_SURGE = 3;

const INVALID =
  'Not valid: «maxSurge» and «maxUnavailable» cannot both be 0. The rollout could not move.';

/** The image of v3 does not exist. */
function isGood(version: RolloutVersion): boolean {
  return version !== 'v3';
}

function signature(pods: readonly RolloutPod[]): string {
  return pods.map((pod) => `${pod.version}:${pod.state}`).join(',');
}

function limits(state: RolloutState): string {
  const ready = state.pods.filter((pod) => pod.state === 'ready').length;
  const total = state.pods.filter((pod) => pod.state !== 'terminating').length;
  return `${ready} Ready, ${total} pods in total. The limits: at least ${state.replicas - state.unavailable} Ready, at most ${state.replicas + state.surge} pods.`;
}

/** A Deployment in its steady state: every pod runs v1. */
export function startRollout(replicas: number, surge: number, unavailable: number): RolloutState {
  return {
    replicas,
    surge,
    unavailable: Math.min(unavailable, replicas),
    pods: Array.from({ length: replicas }, (_, id) => ({ id, version: 'v1', state: 'ready' })),
    target: 'v1',
    history: ['v1'],
    steps: 0,
    stuck: 0,
    message: `Steady state: ${replicas} pods of v1.`,
    nextId: replicas,
  };
}

/** True when every pod runs the target version and is Ready. */
export function isRolloutDone(state: RolloutState): boolean {
  return (
    state.pods.length === state.replicas &&
    state.pods.every((pod) => pod.version === state.target && pod.state === 'ready')
  );
}

/** True when another step changes nothing: the rollout is done, or it cannot move. */
export function isRolloutSettled(state: RolloutState): boolean {
  return isRolloutDone(state) || state.stuck >= 2 || (state.surge === 0 && state.unavailable === 0);
}

/** `kubectl set image`: a new target version. */
export function deployVersion(before: RolloutState, version: RolloutVersion): RolloutState {
  if (before.surge === 0 && before.unavailable === 0) return { ...before, message: INVALID };
  return {
    ...before,
    target: version,
    history: [...before.history, version],
    steps: 0,
    stuck: 0,
    message: `kubectl set image deployment/tugboat tugboat=tugboat:${version}${isGood(version) ? '' : ' (this image does not exist)'}`,
  };
}

/** `kubectl rollout undo`: back to the version before the target. */
export function undoRollout(before: RolloutState): RolloutState {
  const history = before.history.slice(0, -1);
  const target = history.at(-1);
  if (target === undefined) return before;
  return {
    ...before,
    target,
    history,
    steps: 0,
    stuck: 0,
    message: `kubectl rollout undo: back to ${target}.`,
  };
}

/** New limits for the strategy. The pods stay as they are. */
export function setStrategy(
  before: RolloutState,
  surge: number,
  unavailable: number,
): RolloutState {
  return { ...before, surge, unavailable: Math.min(unavailable, before.replicas) };
}

/** One pass of the Deployment controller. */
export function stepRollout(before: RolloutState): RolloutState {
  if (before.surge === 0 && before.unavailable === 0) return { ...before, message: INVALID };
  const state = structuredClone(before);
  const signatureBefore = signature(state.pods);

  state.pods = state.pods.filter((pod) => pod.state !== 'terminating');
  for (const pod of state.pods) {
    if (pod.state === 'starting') pod.state = isGood(pod.version) ? 'ready' : 'failed';
  }

  const old = state.pods.filter((pod) => pod.version !== state.target);
  for (const pod of old) if (pod.state !== 'ready') pod.state = 'terminating';

  const ready = state.pods.filter((pod) => pod.state === 'ready').length;
  const removable = Math.max(0, ready - (state.replicas - state.unavailable));
  for (const pod of old.filter((item) => item.state === 'ready').slice(0, removable)) {
    pod.state = 'terminating';
  }

  const live = state.pods.filter((pod) => pod.state !== 'terminating');
  const fresh = live.filter((pod) => pod.version === state.target);
  const room = state.replicas + state.surge - live.length;
  const add = Math.min(room, state.replicas - fresh.length);
  for (let index = 0; index < add; index += 1) {
    state.pods.push({ id: state.nextId, version: state.target, state: 'starting' });
    state.nextId += 1;
  }
  // After a scale-down of the limits there can be too many pods of the target.
  for (const pod of fresh.slice(state.replicas)) pod.state = 'terminating';

  state.steps += 1;
  if (isRolloutDone(state)) {
    state.stuck = 0;
    state.message = `The rollout is complete: all ${state.replicas} pods run ${state.target}.`;
  } else if (signatureBefore === signature(state.pods)) {
    state.stuck += 1;
    if (state.stuck >= 2) {
      state.message =
        'The rollout is stuck. The new pods never get Ready, so the controller may not remove the old ones. After «progressDeadlineSeconds» (600 s) the Deployment reports **ProgressDeadlineExceeded**. Press Undo.';
    }
  } else {
    state.stuck = 0;
    state.message = `Step ${state.steps}: ${limits(state)}`;
  }
  return state;
}
