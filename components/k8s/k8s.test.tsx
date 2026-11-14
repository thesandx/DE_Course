import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LabProgress } from '@/components/gcp/LabProgress';
import { DOJO, dojoId, getLesson, getPort, lessonId, missionId } from '@/lib/course/k8s/catalog';
import { KUBECTL, ROSETTA } from '@/lib/course/k8s/cheatsheet';
import { summarizeK8s } from '@/lib/course/k8s/summary';
import { EMPTY_PROGRESS, type ProgressRecord } from '@/lib/course/progress';
import { k8sShellStats } from '@/lib/course/shell-stats';
import type { K8sPort } from '@/types/k8s';

import { Cheatsheet } from './Cheatsheet';
import { CommandDojo } from './CommandDojo';
import { K8sDashboard } from './K8sDashboard';
import { K8sLabStepCard } from './LabStepCard';
import { ManifestFile } from './ManifestFile';
import { PortCard } from './PortCard';
import { PortRoute } from './PortRoute';
import { Predict } from './Predict';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const TODAY = '2026-11-01';

function port(slug: string): K8sPort {
  const found = getPort(slug);
  if (found === undefined) throw new Error(`no port ${slug}`);
  return found;
}

function lessonsDone(slug: string): Record<string, string> {
  return Object.fromEntries(
    port(slug).lessons.map((lesson) => [lessonId(slug, lesson.slug), TODAY]),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('K8sDashboard', () => {
  function renderDashboard(progress: ProgressRecord) {
    return render(
      <K8sDashboard
        name="Sandeep Jha"
        progress={progress}
        summary={summarizeK8s(progress, TODAY)}
        today={TODAY}
      />,
    );
  }

  it('greets a new learner and sends them to the first lesson', () => {
    renderDashboard(EMPTY_PROGRESS);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hi, Sandeep');
    expect(screen.getByText(/Rank 1 · Deckhand/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sail on: Check the engine room/ })).toHaveAttribute(
      'href',
      '/k8s/ports/setup/engine-room',
    );
    expect(screen.getAllByRole('link', { name: /Port 00/ })[0]).toHaveAttribute(
      'href',
      '/k8s/ports/setup',
    );
  });

  it('counts a port the learner cleared and feeds the shell', () => {
    const progress: ProgressRecord = {
      done: { ...lessonsDone('setup'), [missionId('setup')]: TODAY, 'drill:setup': TODAY },
      days: { [TODAY]: 6 },
    };
    renderDashboard(progress);
    expect(screen.getByText('1 / 14')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sail on: Why Docker alone/ })).toBeInTheDocument();
    const summary = summarizeK8s(progress, TODAY);
    expect(k8sShellStats(summary)).toMatchObject({
      xp: summary.xp,
      streak: 1,
      levelLine: `Rank ${summary.rank.number} · ${summary.rank.title}`,
    });
  });
});

describe('PortCard and PortRoute', () => {
  it('shows a tile with the port code and its lesson count', () => {
    render(<PortCard port={port('workloads')} done={{}} next />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/k8s/ports/workloads');
    expect(link).toHaveTextContent('Port 02');
    expect(link).toHaveTextContent('Next port');
    expect(link).toHaveTextContent('0 of 4 lessons');
  });

  it('marks a cleared port', () => {
    const done = {
      ...lessonsDone('workloads'),
      [missionId('workloads')]: TODAY,
      'drill:workloads': TODAY,
    };
    render(<PortCard port={port('workloads')} done={done} />);
    expect(screen.getByRole('link')).toHaveTextContent('Cleared');
    expect(screen.getByRole('link')).toHaveTextContent('mission done · drill passed');
  });

  it('locks the drill until every lesson is done, then opens it', () => {
    const workloads = port('workloads');
    const { rerender } = render(<PortRoute port={workloads} done={{}} nextSlug="deployments" />);
    expect(screen.getByRole('link', { name: /Deployments/ })).toHaveTextContent('Next');
    expect(screen.getByRole('link', { name: /Incident drill/ })).toHaveTextContent(
      '4 lessons to unlock',
    );
    expect(screen.getByRole('link', { name: /Mission/ })).toHaveAttribute(
      'href',
      '/k8s/ports/workloads/mission',
    );
    rerender(<PortRoute port={workloads} done={lessonsDone('workloads')} />);
    expect(screen.getByRole('link', { name: /Incident drill/ })).toHaveTextContent('+100 XP');
    expect(screen.getByRole('link', { name: /Deployments/ })).toHaveTextContent('Done');
  });

  it('has no drill at the capstone', () => {
    render(<PortRoute port={port('capstone')} done={{}} />);
    expect(screen.queryByRole('link', { name: /Incident drill/ })).not.toBeInTheDocument();
  });
});

describe('ManifestFile and Predict', () => {
  it('shows the file with a note per line, and folds a long file', () => {
    const file = {
      name: 'deploy.yaml',
      code: 'kind: Deployment\nreplicas: 3',
      notes: [['replicas: 3', 'Keep **three** pods.']] as const,
    };
    const { rerender } = render(<ManifestFile file={file} />);
    expect(screen.getByText('replicas: 3', { selector: 'li code' })).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
    rerender(<ManifestFile file={{ ...file, collapsed: true }} />);
    expect(screen.getByText('2 lines')).toBeInTheDocument();
  });

  it('hides the work until the learner predicts, and takes one pick only', () => {
    render(
      <Predict
        question={{
          prompt: 'What happens?',
          options: ['It heals', 'It dies'],
          answers: [0],
          why: 'A controller owns it.',
        }}
      >
        <p>kubectl get pods</p>
      </Predict>,
    );
    expect(screen.queryByText('kubectl get pods')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /It dies/ }));
    expect(screen.getByText(/Good to find out now/)).toBeInTheDocument();
    expect(screen.getByText('kubectl get pods')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /It heals/ }));
    expect(screen.queryByText(/You called it/)).not.toBeInTheDocument();
  });
});

describe('K8sLabStepCard', () => {
  it('writes the file of a step, shows the output and keeps the tick', () => {
    const ref = getLesson('workloads', 'deployments');
    if (ref === undefined) throw new Error('no lesson');
    const index = ref.lesson.lab.findIndex((step) => step.file !== undefined);
    const step = ref.lesson.lab[index];
    if (step === undefined) throw new Error('no file step');
    render(
      <LabProgress station="k8s-test">
        <ol>
          <K8sLabStepCard
            id="step-1"
            number={1}
            port={ref.port}
            lesson={ref.lesson}
            step={step}
            fill="bg-track-1"
          />
          <K8sLabStepCard
            id="step-2"
            number={2}
            port={ref.port}
            lesson={ref.lesson}
            step={{
              text: 'Break it.',
              code: 'kubectl delete pod x',
              output: 'pod "x" deleted',
              breakIt: true,
              secondTerminal: true,
            }}
            fill="bg-track-1"
          />
        </ol>
      </LabProgress>,
    );
    expect(screen.getByText(new RegExp(`writes ${step.file ?? ''}`))).toBeInTheDocument();
    expect(screen.getByText('Break it')).toBeInTheDocument();
    expect(screen.getAllByText('Terminal 2').length).toBeGreaterThan(0);
    expect(screen.getByText('pod "x" deleted')).toBeInTheDocument();
    const tick = screen.getAllByRole('checkbox', { name: 'I did this step' })[0] as HTMLElement;
    fireEvent.click(tick);
    expect(tick).toBeChecked();
  });
});

describe('CommandDojo', () => {
  const ids = DOJO.map((_, index) => dojoId(index));
  const first = DOJO[0];

  it('coaches a wrong command, then accepts the answer and saves it once', async () => {
    if (first === undefined) throw new Error('no task');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<CommandDojo tasks={DOJO} ids={ids} solved={[]} xpPerTask={5} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(first.task);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'docker ps' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(screen.getByText('Not quite.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(screen.getByText(/It starts with/)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: first.answer } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText(/Correct\./)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)) as unknown;
    expect(body).toMatchObject({ course: 'k8s', itemId: 'dojo:0' });

    fireEvent.click(screen.getByRole('button', { name: 'Next task' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(DOJO[1]?.task ?? '');
  });

  it('starts at the first unsolved task, shows an answer on request and skips', () => {
    if (first === undefined) throw new Error('no task');
    render(<CommandDojo tasks={DOJO} ids={ids} solved={[dojoId(0)]} xpPerTask={5} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(DOJO[1]?.task ?? '');
    fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    expect(screen.getByText(DOJO[1]?.answer ?? '')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(DOJO[2]?.task ?? '');
  });
});

describe('Cheatsheet', () => {
  it('filters both lists as the learner types', () => {
    render(<Cheatsheet rosetta={ROSETTA} groups={KUBECTL} />);
    expect(screen.getByRole('heading', { name: 'Docker to Kubernetes' })).toBeInTheDocument();
    const before = screen.getAllByRole('listitem').length;
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'rollout' } });
    const after = screen.getAllByRole('listitem');
    expect(after.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThan(before);
    for (const item of after) expect(item.textContent.toLowerCase()).toContain('rollout');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz-nothing' } });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });
});
