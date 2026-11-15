/**
 * The probes simulator: 120 seconds in the life of one container, under the
 * probe settings the learner picks. The model follows the kubelet: a startup
 * probe holds the other two back, liveness restarts the container, and
 * readiness only takes the pod out of the Service. Pure.
 */

export type ProbeScenario = 'slow' | 'hang' | 'outage';

export interface ProbeSettings {
  scenario: ProbeScenario;
  /** A startup probe with «periodSeconds: 5» and «failureThreshold: 12». */
  startup: boolean;
  livenessPeriod: number;
  livenessThreshold: number;
}

export type ProcessState = 'boot' | 'ok' | 'hung';

export interface ProbeCheck {
  at: number;
  pass: boolean;
}

export interface ProbeRun {
  /** The seconds at which the kubelet restarted the container. */
  restarts: number[];
  /** One entry per second: is the pod in the Service? */
  ready: boolean[];
  /** One entry per second. */
  process: ProcessState[];
  liveness: ProbeCheck[];
  startup: ProbeCheck[];
}

export const PROBE_SECONDS = 120;

export const PROBE_SCENARIOS: Readonly<Record<ProbeScenario, string>> = {
  slow: 'Slow start (40 s)',
  hang: 'Deadlock after 45 s',
  outage: 'Database down, 30 s to 60 s',
};

export const START_PROBES: ProbeSettings = {
  scenario: 'slow',
  startup: false,
  livenessPeriod: 5,
  livenessThreshold: 3,
};

interface Behaviour {
  /** Seconds the process needs before it answers. */
  boot: number;
  /** Seconds after its start at which the process stops answering. */
  hang?: number;
  /** The clock seconds during which the database is down. */
  outage?: readonly [number, number];
}

const BEHAVIOUR: Readonly<Record<ProbeScenario, Behaviour>> = {
  slow: { boot: 40 },
  hang: { boot: 5, hang: 45 },
  outage: { boot: 5, outage: [30, 60] },
};

const READINESS_PERIOD = 5;
const READINESS_THRESHOLD = 2;
const STARTUP_PERIOD = 5;
const STARTUP_THRESHOLD = 12;

/** Runs the container for 120 seconds and records what the kubelet sees and does. */
export function runProbes(settings: ProbeSettings): ProbeRun {
  const behaviour = BEHAVIOUR[settings.scenario];
  const run: ProbeRun = { restarts: [], ready: [], process: [], liveness: [], startup: [] };

  let startedAt = 0;
  let started = !settings.startup;
  let isReady = false;
  let livenessFails = 0;
  let readinessFails = 0;
  let startupFails = 0;
  let livenessNext = settings.livenessPeriod;
  let readinessNext = READINESS_PERIOD;
  let startupNext = 0;

  const restart = (second: number): void => {
    run.restarts.push(second);
    startedAt = second;
    started = !settings.startup;
    isReady = false;
    livenessFails = 0;
    readinessFails = 0;
    startupFails = 0;
    livenessNext = settings.livenessPeriod;
    readinessNext = READINESS_PERIOD;
    startupNext = 0;
    run.ready.push(false);
  };

  for (let second = 0; second <= PROBE_SECONDS; second += 1) {
    const age = second - startedAt;
    const booted = age >= behaviour.boot;
    const hung = behaviour.hang !== undefined && age >= behaviour.hang;
    const healthy = booted && !hung;
    const databaseDown =
      behaviour.outage !== undefined &&
      second >= behaviour.outage[0] &&
      second < behaviour.outage[1];
    run.process.push(!booted ? 'boot' : hung ? 'hung' : 'ok');

    if (settings.startup && !started && age >= startupNext) {
      startupNext = age + STARTUP_PERIOD;
      run.startup.push({ at: second, pass: healthy });
      if (healthy) {
        started = true;
        livenessNext = age + settings.livenessPeriod;
        readinessNext = age;
      } else {
        startupFails += 1;
        if (startupFails >= STARTUP_THRESHOLD) {
          restart(second);
          continue;
        }
      }
    }

    if (started) {
      if (age >= livenessNext) {
        livenessNext = age + settings.livenessPeriod;
        run.liveness.push({ at: second, pass: healthy });
        if (healthy) {
          livenessFails = 0;
        } else {
          livenessFails += 1;
          if (livenessFails >= settings.livenessThreshold) {
            restart(second);
            continue;
          }
        }
      }
      if (age >= readinessNext) {
        readinessNext = age + READINESS_PERIOD;
        if (healthy && !databaseDown) {
          isReady = true;
          readinessFails = 0;
        } else {
          readinessFails += 1;
          if (readinessFails >= READINESS_THRESHOLD) isReady = false;
        }
      }
    }
    run.ready.push(isReady);
  }
  return run;
}

export interface Span<T> {
  value: T;
  /** The first second of the span. */
  from: number;
  /** The second after the last one. */
  to: number;
}

/** Joins equal neighbours, so a timeline draws a few bars and not 120. */
export function toSpans<T>(values: readonly T[]): Span<T>[] {
  const spans: Span<T>[] = [];
  values.forEach((value, index) => {
    const last = spans.at(-1);
    if (last !== undefined && last.value === value) last.to = index + 1;
    else spans.push({ value, from: index, to: index + 1 });
  });
  return spans;
}

export interface ProbeVerdict {
  tone: 'ok' | 'no';
  restarts: number;
  /** Seconds the pod was in the Service. */
  serving: number;
  text: string;
}

export function probeVerdict(settings: ProbeSettings, run: ProbeRun): ProbeVerdict {
  const restarts = run.restarts.length;
  const serving = run.ready.filter(Boolean).length;
  const patience = settings.livenessPeriod * settings.livenessThreshold;
  const base = { restarts, serving };

  if (settings.scenario === 'slow') {
    if (restarts > 0 && !settings.startup) {
      return {
        ...base,
        tone: 'no',
        text: `A restart loop. Liveness stops waiting after about ${patience} s, but the start needs 40 s, so the app never finishes its start. Turn on the startup probe, or make liveness more patient.`,
      };
    }
    return {
      ...base,
      tone: 'ok',
      text: settings.startup
        ? `The app starts and serves for ${serving} s. The startup probe held liveness back until the start finished.`
        : `The app starts and serves for ${serving} s. Liveness is patient enough for the 40 s start, but it is also slow to catch a real deadlock.`,
    };
  }
  if (settings.scenario === 'hang') {
    return restarts > 0
      ? {
          ...base,
          tone: 'ok',
          text: `The deadlock was caught: each restart came after about ${patience} s of failed checks. Readiness took the pod out of traffic first.`,
        }
      : {
          ...base,
          tone: 'no',
          text: 'No restart: the stuck pod stays out of traffic for ever. Only liveness turns a deadlock into a restart.',
        };
  }
  return restarts > 0
    ? {
        ...base,
        tone: 'no',
        text: 'The container restarted during an outage that a restart cannot repair.',
      }
    : {
        ...base,
        tone: 'ok',
        text: 'During the outage, readiness took the pod out of traffic and put it back afterwards. No restart: liveness checks only the process.',
      };
}
