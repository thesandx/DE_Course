'use client';

import { useEffect, useState } from 'react';

import { InlineText } from '@/components/course/InlineText';
import { Range, Segmented } from '@/components/k8s/sims/SimControls';
import { SimFrame, SimLog } from '@/components/k8s/sims/SimFrame';
import { Button } from '@/components/ui/Button';
import {
  crashContainer,
  deletePod,
  deleteRandomPod,
  isLoopSettled,
  LOOP_MAX_REPLICAS,
  LOOP_MIN_REPLICAS,
  type LoopMode,
  type LoopPodState,
  loopSummary,
  scaleLoop,
  startLoop,
  tickLoop,
  toggleNode,
} from '@/lib/course/k8s/sims/loop';
import { cn } from '@/lib/utils';

const TICK_MS = 900;

const POD_LOOK: Readonly<Record<LoopPodState, { label: string; className: string }>> = {
  creating: { label: 'Creating', className: 'bg-medium-soft text-medium border-medium-bar' },
  running: { label: 'Running', className: 'bg-easy-soft text-easy border-easy-bar' },
  terminating: { label: 'Terminating', className: 'bg-hard-soft text-hard border-hard-bar' },
  restarting: { label: 'Restarting', className: 'bg-medium-soft text-medium border-medium-bar' },
  unknown: {
    label: 'Unknown',
    className: 'bg-sunken text-ink-soft border-line-strong border-dashed',
  },
};

const MODES = [
  { value: 'deploy', label: 'A Deployment' },
  { value: 'bare', label: 'A bare pod' },
] as const;

/**
 * The control loop: delete pods, crash containers and stop nodes, and see
 * which part of Kubernetes brings the workload back. A bare pod shows what
 * happens when no controller owns it.
 */
export function LoopSim() {
  const [state, setState] = useState(() => startLoop('deploy', 3));
  const settled = isLoopSettled(state);

  useEffect(() => {
    if (settled) return;
    const timer = setInterval(() => setState(tickLoop), TICK_MS);
    return () => clearInterval(timer);
  }, [settled]);

  return (
    <SimFrame
      title="Control loop"
      intro="Delete pods, crash a container and stop a node. Watch who brings them back."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented<LoopMode>
          label="Run tugboat as"
          options={MODES}
          value={state.mode}
          onChange={(mode) => setState(startLoop(mode, state.replicas))}
        />
        {state.mode === 'deploy' && (
          <Range
            label="replicas"
            min={LOOP_MIN_REPLICAS}
            max={LOOP_MAX_REPLICAS}
            value={state.replicas}
            onChange={(replicas) => setState(scaleLoop(state, replicas))}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setState(deleteRandomPod(state))}>
          Delete a pod
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setState(crashContainer(state))}>
          Crash a container
        </Button>
        {state.nodes.map((node, index) => (
          <Button
            key={node.name}
            size="sm"
            variant="secondary"
            onClick={() => setState(toggleNode(state, index))}
          >
            {node.up ? 'Stop' : 'Start'} {node.name}
          </Button>
        ))}
      </div>

      <ul className="grid gap-3 md:grid-cols-3">
        <li className="bg-sunken border-line rounded-input flex flex-col gap-1 border p-3">
          <span className="text-small font-semibold">kq-control-plane</span>
          <span className="text-micro text-ink-faint">Taint: NoSchedule. No app pods here.</span>
        </li>
        {state.nodes.map((node) => (
          <li
            key={node.name}
            className={cn(
              'rounded-input flex flex-col gap-2 border p-3',
              node.up ? 'bg-sunken border-line' : 'bg-hard-soft border-hard-bar border-dashed',
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-small font-semibold">{node.name}</span>
              <span className={cn('text-micro font-semibold', node.up ? 'text-easy' : 'text-hard')}>
                {node.up ? 'Ready' : 'NotReady'}
              </span>
            </span>
            <span className="flex flex-wrap gap-2">
              {state.pods
                .filter((pod) => pod.node === node.name)
                .map((pod) => (
                  <button
                    key={pod.id}
                    type="button"
                    aria-label={`Delete pod ${pod.id}, ${POD_LOOK[pod.state].label}${pod.restarts > 0 ? `, restarts ${pod.restarts}` : ''}`}
                    onClick={() => setState(deletePod(state, pod.id))}
                    className={cn(
                      'rounded-input animate-pop flex min-h-11 flex-col items-start justify-center border px-2.5 py-1 text-left',
                      POD_LOOK[pod.state].className,
                    )}
                  >
                    <span className="text-micro font-mono font-semibold">
                      {pod.id.split('-').at(-1)}
                    </span>
                    <span className="text-micro">
                      {POD_LOOK[pod.state].label}
                      {pod.restarts > 0 && `, restarts ${pod.restarts}`}
                    </span>
                  </button>
                ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-micro text-ink-faint">Select a pod to delete it.</p>

      <SimLog events={state.log} />
      <p aria-live="polite" className="text-small bg-sunken rounded-input text-ink-soft p-3">
        <InlineText text={loopSummary(state)} />
      </p>
    </SimFrame>
  );
}
