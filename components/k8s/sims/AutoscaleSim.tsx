'use client';

import { useEffect, useState } from 'react';

import { Range, Segmented } from '@/components/k8s/sims/SimControls';
import { SimFrame, SimLog, SimVerdict } from '@/components/k8s/sims/SimFrame';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
  AUTOSCALE_LAST_TICK,
  type AutoscaleSample,
  autoscaleVerdict,
  HISTORY_KEPT,
  podCounts,
  PODS_PER_NODE,
  START_AUTOSCALE,
  startAutoscale,
  tickAutoscale,
  TRAFFIC_PROFILES,
  type TrafficProfile,
} from '@/lib/course/k8s/sims/autoscale';

const TICK_MS = 500;
/** The top of the chart, in millicores. */
const CHART_TOP = 12000;

const PROFILES = (Object.keys(TRAFFIC_PROFILES) as TrafficProfile[]).map((value) => ({
  value,
  label: TRAFFIC_PROFILES[value],
}));

function line(history: readonly AutoscaleSample[], key: 'load' | 'capacity'): string {
  return history
    .map((sample, index) => `${index},${100 - Math.min(100, (sample[key] / CHART_TOP) * 100)}`)
    .join(' ');
}

function Dots({ count, className }: { count: number; className: string }) {
  return (
    <span className="flex flex-wrap gap-1">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={`${className} size-3 rounded-full`} />
      ))}
    </span>
  );
}

/**
 * The autoscaling chain: traffic rises, the HPA asks for pods, the pods are
 * Pending, and the node autoscaler adds a node. The learner turns each
 * autoscaler off to see what the other one cannot do alone.
 */
export function AutoscaleSim() {
  const [config, setConfig] = useState(START_AUTOSCALE);
  const [state, setState] = useState(startAutoscale);
  const [playing, setPlaying] = useState(false);
  const running = playing && state.tick < AUTOSCALE_LAST_TICK;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setState((before) => tickAutoscale(before, config)), TICK_MS);
    return () => clearInterval(timer);
  }, [running, config]);

  const pods = podCounts(state);
  const verdict = autoscaleVerdict(state, config);

  return (
    <SimFrame
      title="Autoscaling chain"
      intro="Traffic, the HPA, Pending pods and the node autoscaler. One step is 15 seconds."
    >
      <Segmented<TrafficProfile>
        label="Traffic"
        options={PROFILES}
        value={config.profile}
        onChange={(profile) => {
          setPlaying(false);
          setConfig({ ...config, profile });
          setState(startAutoscale());
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Switch
            label="HorizontalPodAutoscaler"
            checked={config.hpa}
            onChange={(event) => setConfig({ ...config, hpa: event.target.checked })}
          />
          <Range
            label="Target CPU"
            min={30}
            max={90}
            step={5}
            value={config.target}
            display={`${config.target}%`}
            disabled={!config.hpa}
            onChange={(target) => setConfig({ ...config, target })}
          />
        </div>
        <Switch
          label="Node autoscaler"
          hint={`Each node has room for ${PODS_PER_NODE} pods of 500m.`}
          checked={config.nodeAutoscaler}
          onChange={(event) => setConfig({ ...config, nodeAutoscaler: event.target.checked })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={state.tick >= AUTOSCALE_LAST_TICK}
          onClick={() => setPlaying(!running)}
        >
          {running ? 'Pause' : 'Play'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setState(tickAutoscale(state, config))}
        >
          Step 15 s
        </Button>
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            setPlaying(false);
            setState(startAutoscale());
          }}
        >
          Reset
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="grid grid-cols-2 gap-2 self-start">
          {state.nodes.map((node, index) => {
            const here = Math.max(0, Math.min(PODS_PER_NODE, pods.running - index * PODS_PER_NODE));
            return (
              <li
                key={node.id}
                className="bg-sunken border-line rounded-input flex flex-col gap-1.5 border p-3"
              >
                <span className="text-small font-semibold">node-{node.id}</span>
                <Dots count={here} className="bg-easy-bar" />
                <span className="text-micro text-ink-faint">{here} pods</span>
              </li>
            );
          })}
          {state.provisioning.map((node) => (
            <li
              key={node.id}
              className="border-line-strong rounded-input flex flex-col gap-1.5 border border-dashed p-3"
            >
              <span className="text-small font-semibold">node-{node.id}</span>
              <span className="text-micro text-ink-faint">Starting</span>
            </li>
          ))}
          {pods.pending > 0 && (
            <li className="bg-medium-soft border-medium-bar rounded-input flex flex-col gap-1.5 border p-3">
              <span className="text-small text-medium font-semibold">Pending</span>
              <Dots count={pods.pending} className="bg-medium-bar" />
              <span className="text-micro text-medium">{pods.pending} pods</span>
            </li>
          )}
        </ul>

        <figure className="flex flex-col gap-2">
          <figcaption className="text-micro flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-hard font-semibold">Dashed: CPU the traffic needs</span>
            <span className="text-brand-deep font-semibold">Solid: CPU the running pods have</span>
          </figcaption>
          <svg
            viewBox={`0 0 ${HISTORY_KEPT - 1} 100`}
            preserveAspectRatio="none"
            role="img"
            aria-label="The demand and the capacity over time, from 0 to 12 CPU cores"
            className="bg-sunken border-line rounded-input h-36 w-full border"
          >
            <line x1="0" x2={HISTORY_KEPT - 1} y1="50" y2="50" className="stroke-line" />
            <polyline
              points={line(state.history, 'capacity')}
              fill="none"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              className="stroke-brand"
            />
            <polyline
              points={line(state.history, 'load')}
              fill="none"
              strokeWidth="2"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
              className="stroke-hard"
            />
          </svg>
          <span className="text-micro text-ink-faint">
            The middle line is 6 cores. The top is 12 cores.
          </span>
        </figure>
      </div>

      <SimLog events={state.log} />
      <SimVerdict tone={verdict.tone} headline={verdict.headline} text={verdict.text} />
    </SimFrame>
  );
}
