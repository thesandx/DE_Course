import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AutoscaleSim } from '@/components/k8s/sims/AutoscaleSim';
import { LoopSim } from '@/components/k8s/sims/LoopSim';
import { NetpolSim } from '@/components/k8s/sims/NetpolSim';
import { ProbesSim } from '@/components/k8s/sims/ProbesSim';
import { RbacSim } from '@/components/k8s/sims/RbacSim';
import { ResourcesSim } from '@/components/k8s/sims/ResourcesSim';
import { RolloutSim } from '@/components/k8s/sims/RolloutSim';
import { SelectorSim } from '@/components/k8s/sims/SelectorSim';
import { Simulator } from '@/components/k8s/sims/Simulator';
import { PORTS } from '@/lib/course/k8s/catalog';

afterEach(() => {
  vi.useRealTimers();
});

function press(name: string | RegExp): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

function slide(name: string, value: number): void {
  fireEvent.change(screen.getByRole('slider', { name }), { target: { value: String(value) } });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Simulator', () => {
  it('has a component for every simulator a lesson names', () => {
    const ids = PORTS.flatMap((port) => port.lessons.flatMap((lesson) => lesson.sim ?? []));
    expect(ids).toHaveLength(8);
    for (const id of ids) {
      const { unmount } = render(<Simulator id={id} />);
      expect(screen.getByRole('region', { name: /^Simulator: / })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('LoopSim', () => {
  it('brings a deleted pod of a Deployment back', () => {
    vi.useFakeTimers();
    render(<LoopSim />);
    expect(screen.getAllByRole('button', { name: /^Delete pod / })).toHaveLength(3);

    press('Delete a pod');
    expect(screen.getByRole('button', { name: /Terminating$/ })).toBeInTheDocument();
    advance(4000);
    expect(screen.getAllByRole('button', { name: /, Running$/ })).toHaveLength(3);
    expect(screen.getByText(/ReplicaSet: wants 3, has 2/)).toBeInTheDocument();
  });

  it('does not bring a bare pod back', () => {
    vi.useFakeTimers();
    render(<LoopSim />);
    press('A bare pod');
    expect(screen.queryByRole('slider', { name: 'replicas' })).not.toBeInTheDocument();
    press('Delete pod tugboat, Running');
    advance(3000);
    expect(screen.getByText('No pods.')).toBeInTheDocument();
  });

  it('scales, crashes a container and stops a node', () => {
    vi.useFakeTimers();
    render(<LoopSim />);
    slide('replicas', 5);
    advance(3000);
    expect(screen.getAllByRole('button', { name: /^Delete pod / })).toHaveLength(5);

    press('Crash a container');
    expect(screen.getByRole('button', { name: /Restarting, restarts 1$/ })).toBeInTheDocument();

    press('Stop kq-worker');
    expect(screen.getByText('NotReady')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start kq-worker' })).toBeInTheDocument();
  });
});

describe('RolloutSim', () => {
  it('rolls to v2 step by step', () => {
    render(<RolloutSim />);
    press('Deploy v2');
    expect(screen.getByText(/tugboat:v2/)).toBeInTheDocument();
    for (let index = 0; index < 10; index += 1) press('Step');
    expect(screen.getByText('The rollout is complete: all 4 pods run v2.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('plays a broken release until it is stuck, then undoes it', () => {
    vi.useFakeTimers();
    render(<RolloutSim />);
    press('Deploy broken v3');
    press('Play');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    advance(6000);
    expect(screen.getByText('ImagePullBackOff')).toBeInTheDocument();
    expect(screen.getByText(/The rollout is stuck/)).toBeInTheDocument();

    press('Undo');
    expect(screen.getByText('kubectl rollout undo: back to v1.')).toBeInTheDocument();
  });

  it('refuses a strategy with both limits at 0, and resets', () => {
    render(<RolloutSim />);
    slide('maxSurge', 0);
    press('Deploy v2');
    expect(screen.getByText(/cannot both be 0/)).toBeInTheDocument();
    slide('maxUnavailable', 2);
    slide('replicas', 6);
    expect(screen.getByText('Steady state: 6 pods of v1.')).toBeInTheDocument();
    press('Reset');
    expect(screen.getAllByText('Ready')).toHaveLength(6);
  });
});

describe('SelectorSim', () => {
  it('shows the endpoints of the selector and sends requests to them', () => {
    render(<SelectorSim />);
    expect(screen.getByText('4 endpoints')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('selector: version'), { target: { value: 'v2' } });
    expect(screen.getByText('2 endpoints')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Ready' })[2] as HTMLElement);
    expect(screen.getByText('1 endpoint')).toBeInTheDocument();
    expect(screen.getByText('Matches, not Ready')).toBeInTheDocument();

    press('Send 30 requests');
    expect(screen.getByText('30 requests')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Ready' })[2] as HTMLElement);
    expect(screen.getByText('2 endpoints')).toBeInTheDocument();
    expect(screen.queryByText('30 requests')).not.toBeInTheDocument();
  });
});

describe('ProbesSim', () => {
  it('turns a restart loop into a clean start with a startup probe', () => {
    render(<ProbesSim />);
    expect(screen.getByText(/A restart loop/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: /Add a startupProbe/ }));
    expect(screen.getByText(/0 restarts, \d+ s serving/)).toBeInTheDocument();
    expect(screen.getByText('Startup checks')).toBeInTheDocument();
  });

  it('follows the scenario and the liveness settings', () => {
    render(<ProbesSim />);
    press('Deadlock after 45 s');
    expect(screen.getByText(/The deadlock was caught/)).toBeInTheDocument();
    slide('liveness periodSeconds', 20);
    slide('liveness failureThreshold', 10);
    expect(screen.getByText(/No restart: the stuck pod/)).toBeInTheDocument();
    press('Database down, 30 s to 60 s');
    expect(screen.getByText(/readiness took the pod out of traffic/)).toBeInTheDocument();
  });
});

describe('ResourcesSim', () => {
  it('shows the result of each case', () => {
    render(<ResourcesSim />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Burstable')).toBeInTheDocument();

    press('Memory leak');
    expect(screen.getByText('OOMKilled, exit code 137')).toBeInTheDocument();
    press('Tight CPU limit');
    expect(screen.getByText('CPU throttled')).toBeInTheDocument();
    press('Too big to schedule');
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.queryByText('Memory')).not.toBeInTheDocument();
    press('No limits at all');
    expect(screen.getByText('Node memory pressure')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'CPU limit' })).toBeDisabled();
  });

  it('follows the sliders and the limit checkboxes', () => {
    render(<ResourcesSim />);
    slide('Memory the app uses', 1024);
    expect(screen.getByText('OOMKilled, exit code 137')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Set a memory limit' }));
    expect(screen.queryByText('OOMKilled, exit code 137')).not.toBeInTheDocument();
    slide('Memory limit', 2048);
    slide('Memory request', 512);
    slide('CPU request', 500);
    slide('CPU limit', 500);
    slide('CPU the app wants', 2000);
    expect(screen.getByText('CPU throttled')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Set a CPU limit' }));
    expect(screen.queryByText('CPU throttled')).not.toBeInTheDocument();
  });
});

describe('AutoscaleSim', () => {
  it('steps through a spike and resets', () => {
    render(<AutoscaleSim />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    for (let index = 0; index < 12; index += 1) press('Step 15 s');
    expect(screen.getAllByText(/HPA: CPU is \d+% of the request/).length).toBeGreaterThan(0);
    expect(screen.getByText(/The node autoscaler creates node-2/)).toBeInTheDocument();

    press('Reset');
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('plays, pauses and follows the switches', () => {
    vi.useFakeTimers();
    render(<AutoscaleSim />);
    fireEvent.click(screen.getByRole('switch', { name: /Node autoscaler/ }));
    slide('Target CPU', 40);
    press('Play');
    advance(8000);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    press('Pause');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'HorizontalPodAutoscaler' }));
    expect(screen.getByRole('slider', { name: 'Target CPU' })).toBeDisabled();
    press('Calm');
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});

describe('NetpolSim', () => {
  function result(connection: string): string {
    const row = screen.getByText(connection).closest('li');
    if (row === null) throw new Error(`no row for ${connection}`);
    return row.textContent ?? '';
  }

  it('starts flat, then follows the presets', () => {
    render(<NetpolSim />);
    expect(result('intruder to db')).toContain('Allowed');
    expect(screen.getByText('Too open')).toBeInTheDocument();

    press('Deny egress (the trap)');
    expect(result('web to api')).toContain('DNS fails');
    expect(screen.getByText('Broken')).toBeInTheDocument();

    press('Zero trust');
    expect(result('web to api')).toContain('Allowed');
    expect(result('intruder to db')).toContain('Blocked');
    expect(screen.getByText('Zero trust', { selector: 'strong' })).toBeInTheDocument();
  });

  it('follows one policy at a time', () => {
    render(<NetpolSim />);
    fireEvent.click(screen.getByRole('checkbox', { name: /default-deny-ingress/ }));
    expect(result('web to api')).toContain('Blocked by an ingress policy on api.');
    fireEvent.click(screen.getByRole('checkbox', { name: /api-from-web/ }));
    expect(result('web to api')).toContain('Allowed');
    fireEvent.click(screen.getByRole('checkbox', { name: /default-deny-ingress/ }));
    expect(result('intruder to db')).toContain('Allowed');
  });
});

describe('RbacSim', () => {
  function toggle(rule: number, group: 'resources' | 'verbs', value: string): void {
    const fieldset = screen.getByRole('group', { name: `Rule ${rule}` });
    const toggles = within(fieldset).getByRole('group', { name: group });
    fireEvent.click(within(toggles).getByRole('button', { name: value }));
  }

  it('solves the first mission with two rules', () => {
    render(<RbacSim />);
    expect(screen.getByText('4 of 7 checks')).toBeInTheDocument();
    toggle(1, 'resources', 'deployments');
    toggle(1, 'verbs', 'get');
    toggle(1, 'verbs', 'patch');
    toggle(2, 'resources', 'pods');
    toggle(2, 'verbs', 'list');
    expect(screen.getByText('7 of 7 checks')).toBeInTheDocument();
    expect(screen.getByText(/least privilege/)).toBeInTheDocument();

    toggle(1, 'verbs', 'delete');
    expect(screen.getByText('6 of 7 checks')).toBeInTheDocument();
  });

  it('refuses a ClusterRoleBinding to a Role, and changes the mission', () => {
    render(<RbacSim />);
    press('ClusterRoleBinding');
    expect(screen.getByText('Not valid')).toBeInTheDocument();
    press('ClusterRole');
    expect(screen.queryByText('Not valid')).not.toBeInTheDocument();

    press('3. Batch operator');
    expect(screen.getByText(/etl-runner/)).toBeInTheDocument();
    const rule = screen.getByRole('group', { name: 'Rule 1' });
    fireEvent.change(within(rule).getByLabelText('apiGroups'), { target: { value: 'batch' } });
    toggle(1, 'resources', 'jobs');
    toggle(1, 'verbs', 'create');
    toggle(2, 'resources', 'pods');
    toggle(2, 'verbs', 'list');
    expect(screen.getByText('6 of 6 checks')).toBeInTheDocument();
  });
});
