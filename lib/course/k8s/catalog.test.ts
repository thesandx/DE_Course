import { describe, expect, it } from 'vitest';

import { parseInline, parseMarkdown } from '@/lib/course/markdown';
import { EMPTY_PROGRESS, type ProgressRecord } from '@/lib/course/progress';

import {
  allLessons,
  cardId,
  CARDS,
  cardsFor,
  DOJO,
  dojoId,
  drillId,
  EXAM_PASS_ID,
  EXAM_QUESTIONS,
  examQuestionsFor,
  getLesson,
  getPort,
  hasDrill,
  incidentQuestion,
  INCIDENTS,
  incidentsFor,
  isKnownK8sItem,
  k8sTotalXp,
  k8sXpForItem,
  lessonId,
  lessonXp,
  missionId,
  nextLesson,
  portCode,
  portProgress,
  PORTS,
  rankFor,
  SPRINT,
  sprintId,
  voyageProgress,
} from './catalog';
import { KUBECTL, ROSETTA } from './cheatsheet';
import { commandHint, isCommandRight, normalizeCommand } from './dojo-check';
import { fileCommand, missionTicks, stepFile, stepPlace, stepTick } from './lab';
import { summarizeK8s } from './summary';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TODAY = '2026-11-01';

/** True when the text has no HTML tag or entity left over from the source page. */
function clean(text: string): boolean {
  return (
    !/<\/?(p|b|i|em|strong|code|ul|ol|li|h4|table|tr|td|th|div|span|br)[\s>/]/.test(text) &&
    !/&(amp|lt|gt|nbsp|quot|#\d+);/.test(text)
  );
}

function allDone(): ProgressRecord {
  const ids = [
    ...allLessons().map((ref) => lessonId(ref.port.slug, ref.lesson.slug)),
    ...PORTS.map((port) => missionId(port.slug)),
    ...PORTS.filter((port) => hasDrill(port.slug)).map((port) => drillId(port.slug)),
    ...cardsFor().map((card) => card.id),
    ...DOJO.map((_, index) => dojoId(index)),
    sprintId(10),
    sprintId(20),
    EXAM_PASS_ID,
  ];
  return { done: Object.fromEntries(ids.map((id) => [id, TODAY])), days: { [TODAY]: ids.length } };
}

describe('Kubernetes catalogue integrity', () => {
  it('has 14 ports in route order with unique, URL-safe slugs', () => {
    expect(PORTS).toHaveLength(14);
    expect(PORTS.map((port) => port.number)).toEqual(PORTS.map((_, index) => index));
    expect(new Set(PORTS.map((port) => port.slug)).size).toBe(14);
    for (const port of PORTS) {
      expect(port.slug).toMatch(SLUG);
      expect(port.dir, port.slug).toMatch(/^[a-z0-9_-]+$/);
      expect(port.cleanup.trim(), port.slug).not.toBe('');
      expect(port.mission.tasks.length, port.slug).toBeGreaterThan(0);
      expect(port.mission.solution.trim(), port.slug).not.toBe('');
    }
    expect(portCode(PORTS[3] ?? PORTS[0]!)).toBe('Port 03');
  });

  it('has 45 lessons with slugs that do not clash with the mission and drill routes', () => {
    const lessons = allLessons();
    expect(lessons).toHaveLength(45);
    for (const port of PORTS) {
      const slugs = port.lessons.map((lesson) => lesson.slug);
      expect(new Set(slugs).size, port.slug).toBe(slugs.length);
      for (const slug of slugs) {
        expect(slug).toMatch(SLUG);
        expect(['mission', 'drill']).not.toContain(slug);
      }
    }
  });

  it('gives every lesson a story, a body and at least one check with real answers', () => {
    for (const { lesson } of allLessons()) {
      expect(lesson.pain.length, lesson.slug).toBeGreaterThan(20);
      expect(lesson.fix.length, lesson.slug).toBeGreaterThan(20);
      expect(parseMarkdown(lesson.body).length, lesson.slug).toBeGreaterThan(0);
      expect(lesson.checks.length, lesson.slug).toBeGreaterThan(0);
      for (const check of lesson.checks) {
        if (check.type === 'choice') {
          expect(check.answers.length, check.prompt).toBeGreaterThan(0);
          for (const answer of check.answers) expect(check.options[answer]).toBeDefined();
          expect(new Set(check.options).size, check.prompt).toBe(check.options.length);
        } else if (check.type === 'match') {
          expect(check.pairs.length, check.prompt).toBeGreaterThan(1);
          const rights = check.pairs.map(([, right]) => right);
          expect(new Set(rights).size, check.prompt).toBe(rights.length);
        } else {
          expect(check.steps.length, check.prompt).toBeGreaterThan(1);
        }
      }
    }
  });

  it('has lab steps that name real files and predictions with real answers', () => {
    for (const { lesson } of allLessons()) {
      const names = lesson.files.map((file) => file.name);
      expect(new Set(names).size, lesson.slug).toBe(names.length);
      for (const step of lesson.lab) {
        expect(step.text.trim(), lesson.slug).not.toBe('');
        if (step.file !== undefined)
          expect(names, `${lesson.slug}: ${step.file}`).toContain(step.file);
        if (step.predict !== undefined) {
          for (const answer of step.predict.answers) {
            expect(step.predict.options[answer], step.predict.prompt).toBeDefined();
          }
        }
      }
    }
  });

  it('notes only lines that are in the file', () => {
    for (const { lesson } of allLessons()) {
      for (const file of lesson.files) {
        for (const [line] of file.notes) {
          expect(file.code.includes(line), `${lesson.slug} ${file.name}: ${line}`).toBe(true);
        }
      }
    }
  });

  it('has 76 incidents on real ports, each with a real answer and output to read', () => {
    expect(INCIDENTS).toHaveLength(76);
    for (const incident of INCIDENTS) {
      expect(getPort(incident.port), incident.title).toBeDefined();
      expect(incident.code.trim(), incident.title).not.toBe('');
      expect(incident.answers.length, incident.title).toBeGreaterThan(0);
      for (const answer of incident.answers) expect(incident.options[answer]).toBeDefined();
      expect(new Set(incident.options).size, incident.title).toBe(incident.options.length);
    }
    expect(hasDrill('capstone')).toBe(false);
    for (const port of PORTS.filter((item) => item.slug !== 'capstone')) {
      expect(incidentsFor(port.slug).length, port.slug).toBeGreaterThanOrEqual(4);
    }
    const first = INCIDENTS[0];
    if (first !== undefined) {
      expect(incidentQuestion(first)).toMatchObject({ station: first.port, code: first.code });
    }
  });

  it('has enough exam questions for a full exam', () => {
    const total = PORTS.reduce((sum, port) => sum + examQuestionsFor(port.slug).length, 0);
    expect(total).toBeGreaterThanOrEqual(EXAM_QUESTIONS * 3);
    expect(examQuestionsFor('nowhere')).toEqual([]);
  });

  it('has cards, sprint rounds and cheatsheet rows that are complete', () => {
    expect(CARDS).toHaveLength(70);
    for (const card of CARDS) expect(getPort(card.port), card.front).toBeDefined();
    expect(cardsFor('data').map((card) => card.id)[0]).toBe(cardId('data', 0));
    expect(SPRINT).toHaveLength(52);
    for (const round of SPRINT) {
      const options = [round.answer, ...round.distractors];
      expect(new Set(options).size, round.scenario).toBe(options.length);
      expect(options.length, round.scenario).toBeGreaterThanOrEqual(3);
    }
    expect(ROSETTA.length).toBeGreaterThan(10);
    expect(KUBECTL.flatMap((group) => group.items).length).toBeGreaterThan(20);
  });

  it('carries no HTML over from the source page', () => {
    const texts: string[] = [];
    for (const port of PORTS) {
      texts.push(port.title, port.tag, port.story, port.mission.brief, ...port.mission.tasks);
      for (const lesson of port.lessons) {
        texts.push(lesson.title, lesson.pain, lesson.fix, lesson.body, lesson.note ?? '');
        for (const step of lesson.lab) texts.push(step.text, step.predict?.prompt ?? '');
        for (const check of lesson.checks) texts.push(check.prompt, check.why);
        for (const file of lesson.files) texts.push(...file.notes.map(([, note]) => note));
      }
    }
    for (const incident of INCIDENTS)
      texts.push(incident.prompt, incident.why, ...incident.options);
    for (const card of CARDS) texts.push(card.front, card.back);
    for (const text of texts) expect(clean(text), text.slice(0, 80)).toBe(true);
  });

  it('parses every lesson body with closed inline markers', () => {
    for (const { lesson } of allLessons()) {
      for (const block of parseMarkdown(lesson.body)) {
        if (block.kind !== 'paragraph') continue;
        const plain = parseInline(block.text)
          .filter((run) => run.kind === 'text')
          .map((run) => run.text)
          .join('');
        expect(plain.includes('**'), `${lesson.slug}: ${block.text.slice(0, 60)}`).toBe(false);
        expect(/[«»]/.test(plain), `${lesson.slug}: ${block.text.slice(0, 60)}`).toBe(false);
      }
    }
  });
});

describe('the kubectl dojo', () => {
  it('accepts its own answer for every task, and the k alias', () => {
    expect(DOJO).toHaveLength(36);
    for (const task of DOJO) {
      expect(isCommandRight(task, task.answer), task.task).toBe(true);
      expect(isCommandRight(task, `$  ${task.answer.replace(/^kubectl /, 'k ')}`), task.task).toBe(
        true,
      );
      for (const pattern of task.need) expect(() => new RegExp(pattern)).not.toThrow();
    }
  });

  it('rejects an empty or a wrong command and hints a little more each try', () => {
    const task = DOJO[0];
    if (task === undefined) throw new Error('no dojo task');
    expect(isCommandRight(task, '   ')).toBe(false);
    expect(isCommandRight(task, 'docker ps')).toBe(false);
    expect(normalizeCommand('  $ k   get  pods ')).toBe('kubectl get pods');
    expect(commandHint(task, 0)).toBe(task.answer.split(' ')[0]);
    expect(commandHint(task, 9).split(' ').length).toBeLessThanOrEqual(3);
  });
});

describe('lab helpers', () => {
  it('writes a file with a quoted heredoc in the folder of the port', () => {
    const command = fileCommand(
      { dir: '05-config' },
      {
        name: 'base/kustomization.yaml',
        code: 'resources:\n  - deploy.yaml',
        notes: [],
      },
    );
    expect(command).toContain('mkdir -p ~/kube-quest/05-config/base && cd ~/kube-quest/05-config');
    expect(command).toContain("cat <<'EOF' > base/kustomization.yaml");
    expect(command.endsWith('\nEOF')).toBe(true);
    expect(fileCommand({ dir: 'x' }, { name: 'a.yaml', code: 'a', notes: [] })).toContain(
      'mkdir -p ~/kube-quest/x && cd',
    );
  });

  it('finds the file of a step and names where a step runs', () => {
    const ref = allLessons().find((item) =>
      item.lesson.lab.some((step) => step.file !== undefined),
    );
    const step = ref?.lesson.lab.find((item) => item.file !== undefined);
    if (ref === undefined || step === undefined) throw new Error('no file step');
    expect(stepFile(ref.lesson, step)?.name).toBe(step.file);
    expect(stepFile(ref.lesson, { text: 'x' })).toBeUndefined();
    expect(stepPlace({ text: 'x' })).toBe('Terminal');
    expect(stepPlace({ text: 'x', secondTerminal: true })).toBe('Terminal 2');
    expect(stepPlace({ text: 'x', cloud: true })).toMatch(/Cloud Shell/);
    expect(stepPlace({ text: 'x', windowsFile: true })).toMatch(/Windows/);
    expect(stepTick(0)).toBe('step-1');
    const port = PORTS[0];
    if (port === undefined) throw new Error('no port');
    expect(missionTicks(port).tasks).toHaveLength(port.mission.tasks.length);
    expect(missionTicks(port).cleanup).toBe('cleanup');
  });
});

describe('Kubernetes game rules', () => {
  it('prices every kind of item and nothing else', () => {
    const ref = getLesson('workloads', 'deployments');
    if (ref === undefined) throw new Error('no lesson');
    expect(k8sXpForItem('lesson:workloads:deployments')).toBe(lessonXp(ref.lesson));
    expect(k8sXpForItem('mission:workloads')).toBe(60);
    expect(k8sXpForItem('drill:workloads')).toBe(100);
    expect(k8sXpForItem('drill:capstone')).toBe(0);
    expect(k8sXpForItem('card:workloads:0')).toBe(2);
    expect(k8sXpForItem('card:workloads:999')).toBe(0);
    expect(k8sXpForItem('card:workloads:01')).toBe(0);
    expect(k8sXpForItem('dojo:0')).toBe(5);
    expect(k8sXpForItem(`dojo:${DOJO.length}`)).toBe(0);
    expect(k8sXpForItem('sprint:10')).toBe(25);
    expect(k8sXpForItem('sprint:15')).toBe(0);
    expect(k8sXpForItem(EXAM_PASS_ID)).toBe(250);
    for (const id of ['lesson:workloads:nope', 'mission:nope', 'station:x', 'exam', 'a:b:c:d']) {
      expect(isKnownK8sItem(id), id).toBe(false);
    }
    expect(getLesson('nope', 'x')).toBeUndefined();
  });

  it('needs nearly all the XP for the top rank', () => {
    const total = k8sTotalXp(allDone().done);
    expect(rankFor(0)).toMatchObject({ number: 1, title: 'Deckhand', to: 150 });
    expect(rankFor(total)).toMatchObject({ title: 'Admiral', to: null });
    expect(rankFor(Math.round(total * 0.85)).title).not.toBe('Admiral');
  });

  it('opens the drill after the lessons and clears a port after all three parts', () => {
    const port = getPort('security');
    if (port === undefined) throw new Error('no port');
    expect(portProgress(port, {})).toMatchObject({ drillOpen: false, cleared: false, ratio: 0 });
    const lessons = Object.fromEntries(
      port.lessons.map((lesson) => [lessonId(port.slug, lesson.slug), TODAY]),
    );
    expect(portProgress(port, lessons)).toMatchObject({ drillOpen: true, cleared: false });
    const all = { ...lessons, [missionId(port.slug)]: TODAY, [drillId(port.slug)]: TODAY };
    expect(portProgress(port, all)).toMatchObject({ cleared: true, ratio: 1 });
    expect(voyageProgress({})).toBe(0);
    expect(voyageProgress(allDone().done)).toBe(1);
    expect(nextLesson({})?.lesson.slug).toBe(PORTS[0]?.lessons[0]?.slug);
    expect(nextLesson(allDone().done)).toBeUndefined();
  });
});

describe('summarizeK8s', () => {
  it('starts a new learner at zero', () => {
    const summary = summarizeK8s(EMPTY_PROGRESS, TODAY);
    expect(summary).toMatchObject({
      xp: 0,
      streak: 0,
      lessonsDone: 0,
      lessonsTotal: 45,
      portsCleared: 0,
      portsTotal: 14,
      examPassed: false,
      voyage: 0,
    });
    expect(summary.rank.title).toBe('Deckhand');
    expect(summary.recent).toEqual([]);
  });

  it('counts everything for a learner who finished the course', () => {
    const summary = summarizeK8s(allDone(), TODAY);
    expect(summary).toMatchObject({
      lessonsDone: 45,
      missionsDone: 14,
      drillsPassed: 13,
      drillsTotal: 13,
      portsCleared: 14,
      cardsKnown: 70,
      dojoSolved: 36,
      examPassed: true,
      voyage: 1,
      streak: 1,
    });
    expect(summary.rank.title).toBe('Admiral');
    expect(summary.recent.length).toBeGreaterThan(0);
  });
});
