'use client';

import { useState } from 'react';

import { Range } from '@/components/k8s/sims/SimControls';
import { SIM_TONE, SimFrame, SimVerdict } from '@/components/k8s/sims/SimFrame';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  evaluatePod,
  NEIGHBOURS,
  NODE,
  type PodResources,
  RESOURCE_PRESETS,
  type ResourcePreset,
} from '@/lib/course/k8s/sims/resources';
import { cn } from '@/lib/utils';

const PRESETS = Object.keys(RESOURCE_PRESETS) as ResourcePreset[];

const HEADLINE = { ok: 'Healthy', meh: 'Degraded', no: 'Problem' } as const;

interface UsageBarProps {
  label: string;
  unit: string;
  capacity: number;
  neighbours: number;
  pod: number;
}

function UsageBar({ label, unit, capacity, neighbours, pod }: UsageBarProps) {
  const over = neighbours + pod > capacity;
  const share = (value: number): number => Math.min(100, (value / capacity) * 100);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-small font-semibold">{label}</span>
      <span className="bg-sunken border-line rounded-pill flex h-4 overflow-hidden border">
        <span className="bg-ink-faint h-full" style={{ width: `${share(neighbours)}%` }} />
        <span
          className={cn('h-full', over ? 'bg-hard-bar' : 'bg-brand')}
          style={{ width: `${Math.min(share(pod), 100 - share(neighbours))}%` }}
        />
      </span>
      <span className="text-micro text-ink-soft">
        Node {capacity}
        {unit}. Neighbours use {neighbours}
        {unit}. Your pod uses {pod}
        {unit}.{over && <strong className="text-hard"> Above the node capacity.</strong>}
      </span>
    </div>
  );
}

/**
 * Requests and limits: one pod on a node that already runs neighbours. The
 * sliders set what the pod asks for, what it may use, and what the app really
 * wants. The result shows Pending, throttling, OOMKilled and node pressure.
 */
export function ResourcesSim() {
  const [pod, setPod] = useState<PodResources>(RESOURCE_PRESETS.good.pod);
  const outcome = evaluatePod(pod);
  const set = (change: Partial<PodResources>): void => setPod({ ...pod, ...change });

  return (
    <SimFrame
      title="Requests and limits"
      intro="One pod on a node of 4 CPU and 8 GiB that already runs neighbours."
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-small text-ink-soft font-semibold">Try a case</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPod(RESOURCE_PRESETS[preset].pod)}
              className="bg-surface border-line text-ink-soft hover:text-ink rounded-pill text-small min-h-11 border px-4 font-semibold"
            >
              {RESOURCE_PRESETS[preset].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Range
            label="CPU request"
            min={0}
            max={NODE.cpu}
            step={50}
            value={pod.cpuRequest}
            display={`${pod.cpuRequest}m`}
            onChange={(cpuRequest) => set({ cpuRequest })}
          />
          <Range
            label="CPU limit"
            min={100}
            max={NODE.cpu}
            step={50}
            value={pod.cpuLimit}
            display={pod.hasCpuLimit ? `${pod.cpuLimit}m` : 'none'}
            disabled={!pod.hasCpuLimit}
            onChange={(cpuLimit) => set({ cpuLimit })}
          />
          <Checkbox
            label="Set a CPU limit"
            checked={pod.hasCpuLimit}
            onChange={(event) => set({ hasCpuLimit: event.target.checked })}
          />
          <Range
            label="CPU the app wants"
            min={0}
            max={NODE.cpu}
            step={50}
            value={pod.cpuWanted}
            display={`${pod.cpuWanted}m`}
            onChange={(cpuWanted) => set({ cpuWanted })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Range
            label="Memory request"
            min={0}
            max={NODE.memory}
            step={64}
            value={pod.memoryRequest}
            display={`${pod.memoryRequest}Mi`}
            onChange={(memoryRequest) => set({ memoryRequest })}
          />
          <Range
            label="Memory limit"
            min={64}
            max={NODE.memory}
            step={64}
            value={pod.memoryLimit}
            display={pod.hasMemoryLimit ? `${pod.memoryLimit}Mi` : 'none'}
            disabled={!pod.hasMemoryLimit}
            onChange={(memoryLimit) => set({ memoryLimit })}
          />
          <Checkbox
            label="Set a memory limit"
            checked={pod.hasMemoryLimit}
            onChange={(event) => set({ hasMemoryLimit: event.target.checked })}
          />
          <Range
            label="Memory the app uses"
            min={0}
            max={NODE.memory}
            step={64}
            value={pod.memoryUsed}
            display={`${pod.memoryUsed}Mi`}
            onChange={(memoryUsed) => set({ memoryUsed })}
          />
        </div>
      </div>

      {outcome.scheduled && (
        <div className="flex flex-col gap-3">
          <UsageBar
            label="CPU"
            unit="m"
            capacity={NODE.cpu}
            neighbours={NEIGHBOURS.cpuUsed}
            pod={outcome.cpuGot}
          />
          <UsageBar
            label="Memory"
            unit="Mi"
            capacity={NODE.memory}
            neighbours={NEIGHBOURS.memoryUsed}
            pod={outcome.memoryGot}
          />
        </div>
      )}

      <ul className="text-small flex flex-wrap gap-2">
        <li className="bg-sunken border-line rounded-pill border px-3 py-1">
          QoS class: <strong>{outcome.qos}</strong>
        </li>
        <li
          className={cn(
            'rounded-pill px-3 py-1 font-semibold',
            SIM_TONE[outcome.scheduled ? 'ok' : 'no'],
          )}
        >
          {outcome.scheduled ? 'Scheduled' : 'Pending'}
        </li>
        {outcome.throttled && (
          <li className={cn('rounded-pill px-3 py-1 font-semibold', SIM_TONE.meh)}>
            CPU throttled
          </li>
        )}
        {outcome.oomKilled && (
          <li className={cn('rounded-pill px-3 py-1 font-semibold', SIM_TONE.no)}>
            OOMKilled, exit code 137
          </li>
        )}
        {outcome.memoryPressure && (
          <li className={cn('rounded-pill px-3 py-1 font-semibold', SIM_TONE.no)}>
            Node memory pressure
          </li>
        )}
      </ul>

      <SimVerdict tone={outcome.tone} headline={HEADLINE[outcome.tone]} text={outcome.text} />
    </SimFrame>
  );
}
