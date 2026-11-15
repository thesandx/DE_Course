'use client';

import { useState } from 'react';

import { Range, Segmented } from '@/components/k8s/sims/SimControls';
import { SimFrame, SimVerdict } from '@/components/k8s/sims/SimFrame';
import { Switch } from '@/components/ui/Switch';
import {
  PROBE_SCENARIOS,
  PROBE_SECONDS,
  type ProbeCheck,
  type ProbeScenario,
  probeVerdict,
  type ProcessState,
  runProbes,
  START_PROBES,
  toSpans,
} from '@/lib/course/k8s/sims/probes';
import { cn } from '@/lib/utils';

const SCENARIOS = (Object.keys(PROBE_SCENARIOS) as ProbeScenario[]).map((value) => ({
  value,
  label: PROBE_SCENARIOS[value],
}));

const PROCESS_LOOK: Readonly<Record<ProcessState, string>> = {
  boot: 'bg-medium-bar',
  ok: 'bg-easy-bar',
  hung: 'bg-hard-bar',
};

const MARKS = [0, 20, 40, 60, 80, 100, 120];

function at(second: number): string {
  return `${(second / PROBE_SECONDS) * 100}%`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro text-ink-soft font-semibold">{label}</span>
      <div className="bg-sunken border-line rounded-box relative h-5 overflow-hidden border">
        {children}
      </div>
    </div>
  );
}

function Checks({ checks, failed }: { checks: readonly ProbeCheck[]; failed: string }) {
  return checks.map((check) => (
    <span
      key={check.at}
      title={`${check.at} s: ${check.pass ? 'pass' : 'fail'}`}
      className={cn(
        'absolute top-1 size-2.5 -translate-x-1/2 rounded-full',
        check.pass ? 'bg-easy-bar' : failed,
      )}
      style={{ left: at(check.at) }}
    />
  ));
}

/**
 * The probes timeline: 120 seconds of one container. The learner picks what
 * the app does wrong and how patient liveness is, and sees when the pod gets
 * traffic and when the kubelet restarts it.
 */
export function ProbesSim() {
  const [settings, setSettings] = useState(START_PROBES);
  const run = runProbes(settings);
  const verdict = probeVerdict(settings, run);

  return (
    <SimFrame
      title="Probes timeline"
      intro="120 seconds in the life of one container, with the probe settings you pick."
    >
      <Segmented<ProbeScenario>
        label="What the app does"
        options={SCENARIOS}
        value={settings.scenario}
        onChange={(scenario) => setSettings({ ...settings, scenario })}
      />
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        <Range
          label="liveness periodSeconds"
          min={2}
          max={20}
          value={settings.livenessPeriod}
          onChange={(livenessPeriod) => setSettings({ ...settings, livenessPeriod })}
        />
        <Range
          label="liveness failureThreshold"
          min={1}
          max={10}
          value={settings.livenessThreshold}
          onChange={(livenessThreshold) => setSettings({ ...settings, livenessThreshold })}
        />
      </div>
      <Switch
        label="Add a startupProbe"
        hint="Every 5 s, up to 12 times: 60 s to finish the start."
        checked={settings.startup}
        onChange={(event) => setSettings({ ...settings, startup: event.target.checked })}
      />

      <div
        role="img"
        aria-label={`Timeline: ${verdict.restarts} restarts, ${verdict.serving} seconds in the Service.`}
        className="flex flex-col gap-3"
      >
        <Row label="Process: starting, healthy or stuck">
          {toSpans(run.process.slice(0, PROBE_SECONDS)).map((span) => (
            <span
              key={span.from}
              className={cn('absolute inset-y-0', PROCESS_LOOK[span.value])}
              style={{ left: at(span.from), width: at(span.to - span.from) }}
            />
          ))}
          {run.restarts.map((second) => (
            <span
              key={second}
              title={`Restart at ${second} s`}
              className="bg-ink absolute inset-y-0 w-0.5"
              style={{ left: at(second) }}
            />
          ))}
        </Row>
        <Row label="Ready: the pod gets traffic">
          {toSpans(run.ready.slice(0, PROBE_SECONDS))
            .filter((span) => span.value)
            .map((span) => (
              <span
                key={span.from}
                className="bg-brand absolute inset-y-0"
                style={{ left: at(span.from), width: at(span.to - span.from) }}
              />
            ))}
        </Row>
        <Row label="Liveness checks">
          <Checks checks={run.liveness} failed="bg-hard-bar" />
        </Row>
        <Row label={settings.startup ? 'Startup checks' : 'Startup checks: no startup probe'}>
          <Checks checks={run.startup} failed="bg-medium-bar" />
        </Row>
        <div className="text-micro text-ink-faint relative h-4 font-mono">
          {MARKS.map((second) => (
            <span
              key={second}
              className={cn(
                'absolute',
                second === 0
                  ? ''
                  : second === PROBE_SECONDS
                    ? '-translate-x-full'
                    : '-translate-x-1/2',
              )}
              style={{ left: at(second) }}
            >
              {second}s
            </span>
          ))}
        </div>
      </div>
      <p className="text-micro text-ink-faint">
        A thin line across the first row is a restart. A dot is one check: green passed.
      </p>

      <SimVerdict
        tone={verdict.tone}
        headline={`${verdict.restarts} ${verdict.restarts === 1 ? 'restart' : 'restarts'}, ${verdict.serving} s serving`}
        text={verdict.text}
      />
    </SimFrame>
  );
}
