'use client';

import { useEffect, useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { Range } from '@/components/k8s/sims/SimControls';
import { SimFrame } from '@/components/k8s/sims/SimFrame';
import { Button } from '@/components/ui/Button';
import {
  deployVersion,
  isRolloutSettled,
  ROLLOUT_MAX_REPLICAS,
  ROLLOUT_MAX_SURGE,
  ROLLOUT_VERSIONS,
  type RolloutPodState,
  setStrategy,
  startRollout,
  stepRollout,
  undoRollout,
} from '@/lib/course/k8s/sims/rollout';
import { cn } from '@/lib/utils';

const STEP_MS = 900;

const POD_LOOK: Readonly<Record<RolloutPodState, { label: string; className: string }>> = {
  ready: { label: 'Ready', className: 'bg-easy-soft text-easy border-easy-bar' },
  starting: { label: 'Starting', className: 'bg-medium-soft text-medium border-medium-bar' },
  failed: { label: 'ImagePullBackOff', className: 'bg-hard-soft text-hard border-hard-bar' },
  terminating: {
    label: 'Terminating',
    className: 'bg-sunken text-ink-faint border-line-strong border-dashed',
  },
};

/**
 * The rolling update: set «maxSurge» and «maxUnavailable», ship a good
 * version or a broken one, and step through what the Deployment controller
 * does. A broken version stops the rollout and keeps the old pods serving.
 */
export function RolloutSim() {
  const [state, setState] = useState(() => startRollout(4, 1, 0));
  const [playing, setPlaying] = useState(false);
  const settled = isRolloutSettled(state);
  const running = playing && !settled;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setState(stepRollout), STEP_MS);
    return () => clearInterval(timer);
  }, [running]);

  const versions = ROLLOUT_VERSIONS.filter(
    (version) => version === state.target || state.pods.some((pod) => pod.version === version),
  );

  return (
    <SimFrame
      title="Rolling update"
      intro="Set the two limits, then ship a good release or a broken one."
    >
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-3">
        <Range
          label="replicas"
          min={1}
          max={ROLLOUT_MAX_REPLICAS}
          value={state.replicas}
          onChange={(replicas) => {
            setPlaying(false);
            setState(startRollout(replicas, state.surge, state.unavailable));
          }}
        />
        <Range
          label="maxSurge"
          min={0}
          max={ROLLOUT_MAX_SURGE}
          value={state.surge}
          onChange={(surge) => setState(setStrategy(state, surge, state.unavailable))}
        />
        <Range
          label="maxUnavailable"
          min={0}
          max={ROLLOUT_MAX_SURGE}
          value={state.unavailable}
          onChange={(unavailable) => setState(setStrategy(state, state.surge, unavailable))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setState(deployVersion(state, 'v2'))}>
          Deploy v2
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setState(deployVersion(state, 'v3'))}>
          Deploy broken v3
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setState(stepRollout(state))}>
          Step
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={settled}
          onClick={() => setPlaying(!running)}
        >
          {running ? 'Pause' : 'Play'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setState(undoRollout(state))}>
          Undo
        </Button>
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            setPlaying(false);
            setState(startRollout(state.replicas, state.surge, state.unavailable));
          }}
        >
          Reset
        </Button>
      </div>

      <ul className="flex flex-col gap-3">
        {versions.map((version) => {
          const pods = state.pods.filter((pod) => pod.version === version);
          return (
            <li
              key={version}
              className="bg-sunken border-line rounded-input flex flex-col gap-2 border p-3"
            >
              <span className="text-small font-semibold">
                ReplicaSet {version}
                {version === state.target && (
                  <span className="text-brand-deep font-normal"> (target)</span>
                )}
              </span>
              <span className="flex flex-wrap gap-2">
                {pods.length === 0 && <span className="text-micro text-ink-faint">0 pods</span>}
                {pods.map((pod) => (
                  <span
                    key={pod.id}
                    className={cn(
                      'rounded-input animate-pop text-micro flex flex-col border px-2.5 py-1',
                      POD_LOOK[pod.state].className,
                    )}
                  >
                    <span className="font-mono font-semibold">{version}</span>
                    {POD_LOOK[pod.state].label}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>

      <p aria-live="polite" className="text-small bg-sunken rounded-input text-ink-soft p-3">
        <InlineText text={state.message} />
      </p>
    </SimFrame>
  );
}
