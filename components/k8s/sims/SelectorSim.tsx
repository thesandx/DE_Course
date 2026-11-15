'use client';

import { useState } from 'react';

import { CodeBlock } from '@/components/gcp/CodeBlock';
import { SimFrame, SimVerdict } from '@/components/k8s/sims/SimFrame';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import {
  endpoints,
  LABEL_KEYS,
  LABEL_VALUES,
  type PodMatch,
  podMatch,
  REQUESTS_SENT,
  SELECTOR_PODS,
  selectorVerdict,
  selectorYaml,
  sendRequests,
  START_SELECTOR,
} from '@/lib/course/k8s/sims/selector';
import { cn } from '@/lib/utils';

const MATCH_LOOK: Readonly<Record<PodMatch, { label: string; card: string; text: string }>> = {
  endpoint: { label: 'Endpoint', card: 'bg-easy-soft border-easy-bar', text: 'text-easy' },
  'not-ready': {
    label: 'Matches, not Ready',
    card: 'bg-medium-soft border-medium-bar',
    text: 'text-medium',
  },
  none: { label: 'Not selected', card: 'bg-sunken border-line', text: 'text-ink-faint' },
};

/**
 * Labels and Services: edit the selector of a Service and see which pods
 * become its endpoints. A pod that fails readiness leaves the Service but
 * stays in the cluster.
 */
export function SelectorSim() {
  const [selector, setSelector] = useState(START_SELECTOR);
  const [notReady, setNotReady] = useState<ReadonlySet<string>>(new Set());
  const [sent, setSent] = useState(0);
  const [hits, setHits] = useState<Readonly<Record<string, number>> | null>(null);
  const verdict = selectorVerdict(selector, notReady);

  return (
    <SimFrame
      title="Labels and Services"
      intro="Change the selector of the Service and see which pods get traffic."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {LABEL_KEYS.map((key) => (
          <Select
            key={key}
            label={`selector: ${key}`}
            placeholder="(not used)"
            value={selector[key]}
            options={LABEL_VALUES[key].map((value) => ({ value, label: value }))}
            onChange={(event) => {
              setSelector({ ...selector, [key]: event.target.value });
              setHits(null);
            }}
          />
        ))}
      </div>

      <CodeBlock label="service.yaml" code={selectorYaml(selector)} />

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SELECTOR_PODS.map((pod) => {
          const match = podMatch(selector, pod, !notReady.has(pod.name));
          const look = MATCH_LOOK[match];
          const count = hits?.[pod.name] ?? 0;
          return (
            <li
              key={pod.name}
              className={cn('rounded-input flex flex-col gap-2 border p-3', look.card)}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-small font-mono font-semibold">{pod.name}</span>
                <span className={cn('text-micro font-semibold', look.text)}>{look.label}</span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {LABEL_KEYS.map((key) => (
                  <span
                    key={key}
                    className={cn(
                      'rounded-pill text-micro border px-2 py-0.5 font-mono',
                      selector[key] !== '' && selector[key] === pod.labels[key]
                        ? 'bg-ink text-on-ink border-ink'
                        : 'bg-surface border-line text-ink-soft',
                    )}
                  >
                    {key}={pod.labels[key]}
                  </span>
                ))}
              </span>
              <Checkbox
                label="Ready"
                checked={!notReady.has(pod.name)}
                onChange={(event) => {
                  const next = new Set(notReady);
                  if (event.target.checked) next.delete(pod.name);
                  else next.add(pod.name);
                  setNotReady(next);
                  setHits(null);
                }}
              />
              {hits !== null && count > 0 && (
                <span className="flex items-center gap-2">
                  <span className="bg-surface rounded-pill h-2 flex-1 overflow-hidden">
                    <span
                      className="bg-easy-bar block h-full"
                      style={{ width: `${(count / REQUESTS_SENT) * 100}%` }}
                    />
                  </span>
                  <span className="text-micro font-mono">{count} requests</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div>
        <Button
          size="sm"
          onClick={() => {
            setHits(sendRequests(endpoints(selector, notReady), sent + 1));
            setSent(sent + 1);
          }}
        >
          Send {REQUESTS_SENT} requests
        </Button>
      </div>

      <SimVerdict
        tone={verdict.tone}
        headline={`${verdict.count} ${verdict.count === 1 ? 'endpoint' : 'endpoints'}`}
        text={verdict.text}
      />
    </SimFrame>
  );
}
