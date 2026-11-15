'use client';

import { useState } from 'react';

import { SIM_TONE, SimFrame, SimVerdict } from '@/components/k8s/sims/SimFrame';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  type ConnectionResult,
  CONNECTIONS,
  netpolVerdict,
  POLICIES,
  POLICY_PRESETS,
  type PolicyId,
  type PolicyPreset,
  testConnection,
} from '@/lib/course/k8s/sims/netpol';
import { cn } from '@/lib/utils';

const PRESETS = Object.keys(POLICY_PRESETS) as PolicyPreset[];

const RESULT_LOOK: Readonly<
  Record<ConnectionResult['verdict'], { label: string; tone: 'ok' | 'meh' | 'no' }>
> = {
  ok: { label: 'Allowed', tone: 'ok' },
  dns: { label: 'DNS fails', tone: 'meh' },
  blocked: { label: 'Blocked', tone: 'no' },
};

const HEADLINE = { ok: 'Zero trust', meh: 'Too open', no: 'Broken' } as const;

function Workload({ name, note }: { name: string; note: string }) {
  return (
    <span className="bg-surface border-line-strong rounded-input flex flex-col border px-3 py-1.5">
      <span className="text-small font-mono font-semibold">{name}</span>
      <span className="text-micro text-ink-faint">{note}</span>
    </span>
  );
}

/**
 * The NetworkPolicy firewall: turn policies on in the namespace «shop» and
 * see which connections still work. The egress preset shows the DNS trap.
 */
export function NetpolSim() {
  const [on, setOn] = useState<ReadonlySet<PolicyId>>(new Set());
  const verdict = netpolVerdict(on);

  return (
    <SimFrame
      title="NetworkPolicy firewall"
      intro="Turn policies on in the namespace shop and see which connections still work."
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-small text-ink-soft font-semibold">Start from</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setOn(new Set(POLICY_PRESETS[preset].on))}
              className="bg-surface border-line text-ink-soft hover:text-ink rounded-pill text-small min-h-11 border px-4 font-semibold"
            >
              {POLICY_PRESETS[preset].label}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <legend className="text-small text-ink-soft pb-1 font-semibold">Policies</legend>
        {POLICIES.map((policy) => (
          <Checkbox
            key={policy.id}
            label={policy.name}
            hint={policy.does}
            checked={on.has(policy.id)}
            onChange={(event) => {
              const next = new Set(on);
              if (event.target.checked) next.add(policy.id);
              else next.delete(policy.id);
              setOn(next);
            }}
          />
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border-line-strong rounded-input flex flex-col gap-2 border border-dashed p-3 sm:col-span-2">
          <span className="eyebrow text-ink-faint">Namespace shop</span>
          <span className="flex flex-wrap gap-2">
            <Workload name="web" note="The front end" />
            <Workload name="api" note="Port 8080" />
            <Workload name="db" note="Port 5432" />
          </span>
        </div>
        <div className="border-line rounded-input flex flex-col gap-2 border border-dashed p-3">
          <span className="eyebrow text-ink-faint">Outside shop</span>
          <span className="flex flex-wrap gap-2">
            <Workload name="intruder" note="Another namespace" />
            <Workload name="internet" note="Outside the cluster" />
          </span>
        </div>
      </div>

      <ul className="border-line rounded-input divide-line divide-y border">
        {CONNECTIONS.map(([source, target]) => {
          const result = testConnection(on, source, target);
          const look = RESULT_LOOK[result.verdict];
          return (
            <li
              key={`${source}-${target}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3"
            >
              <span className="text-small min-w-40 font-mono font-semibold">
                {source} to {target}
              </span>
              <span
                className={cn(
                  'rounded-pill text-micro px-2.5 py-0.5 font-semibold',
                  SIM_TONE[look.tone],
                )}
              >
                {look.label}
              </span>
              <span className="text-micro text-ink-soft">{result.why}</span>
            </li>
          );
        })}
      </ul>

      <SimVerdict tone={verdict.tone} headline={HEADLINE[verdict.tone]} text={verdict.text} />
    </SimFrame>
  );
}
