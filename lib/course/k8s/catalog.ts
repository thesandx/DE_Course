/**
 * The Kubernetes course catalogue: the ports and their lessons, the
 * incidents, the flashcards, the sprint deck, the dojo, and the game rules
 * (item ids, XP, ranks, progress). Pure data and pure functions, like
 * `lib/course/gcp/catalog.ts` for the GCP course.
 *
 * The order of `PORTS` is the route and the study order.
 */

import { CARDS } from '@/lib/course/k8s/cards';
import { DOJO } from '@/lib/course/k8s/dojo';
import { INCIDENTS } from '@/lib/course/k8s/incidents';
import { port as capstone } from '@/lib/course/k8s/ports/capstone';
import { port as config } from '@/lib/course/k8s/ports/config';
import { port as data } from '@/lib/course/k8s/ports/data';
import { port as fundamentals } from '@/lib/course/k8s/ports/fundamentals';
import { port as gitops } from '@/lib/course/k8s/ports/gitops';
import { port as health } from '@/lib/course/k8s/ports/health';
import { port as helm } from '@/lib/course/k8s/ports/helm';
import { port as identity } from '@/lib/course/k8s/ports/identity';
import { port as netpol } from '@/lib/course/k8s/ports/netpol';
import { port as networking } from '@/lib/course/k8s/ports/networking';
import { port as security } from '@/lib/course/k8s/ports/security';
import { port as setup } from '@/lib/course/k8s/ports/setup';
import { port as storage } from '@/lib/course/k8s/ports/storage';
import { port as workloads } from '@/lib/course/k8s/ports/workloads';
import { SPRINT } from '@/lib/course/k8s/sprint';
import type { DoneMap } from '@/lib/course/progress';
import type { BankQuestion } from '@/types/gcp';
import type { Incident, K8sCard, K8sLesson, K8sPort } from '@/types/k8s';

export const PORTS: readonly K8sPort[] = [
  setup,
  fundamentals,
  workloads,
  networking,
  config,
  storage,
  health,
  security,
  netpol,
  identity,
  gitops,
  helm,
  data,
  capstone,
];

export { CARDS, DOJO, INCIDENTS, SPRINT };

// ── Item ids ────────────────────────────────────────────────────────────────
// Progress records store these ids. Do not rename a slug after release, do
// not reorder CARDS inside a port, and add new dojo tasks at the end.

export function lessonId(port: string, lesson: string): string {
  return `lesson:${port}:${lesson}`;
}

export function missionId(port: string): string {
  return `mission:${port}`;
}

export function drillId(port: string): string {
  return `drill:${port}`;
}

export function cardId(port: string, index: number): string {
  return `card:${port}:${index}`;
}

export function dojoId(index: number): string {
  return `dojo:${index}`;
}

/** Sprint milestones: reach this many correct answers in one 60-second run. */
export const SPRINT_TARGETS = [10, 20] as const;

export function sprintId(target: number): string {
  return `sprint:${target}`;
}

export const EXAM_PASS_ID = 'exam:pass';

// ── Game rules ──────────────────────────────────────────────────────────────

/** A lesson is worth a base amount plus a share per check. */
export const LESSON_BASE_XP = 30;
export const CHECK_XP = 10;
export const MISSION_XP = 60;
export const DRILL_XP = 100;
export const CARD_XP = 2;
export const DOJO_XP = 5;
export const SPRINT_XP: Readonly<Record<number, number>> = { 10: 25, 20: 50 };
export const EXAM_XP = 250;

/** A port drill passes at this share of correct answers. */
export const DRILL_PASS_RATIO = 0.7;
export const EXAM_PASS_RATIO = 0.8;
export const EXAM_QUESTIONS = 25;
export const SPRINT_SECONDS = 60;

/** XP the learner aims to earn each day. The dashboard ring fills toward it. */
export const DAILY_XP_GOAL = 100;

export interface Rank {
  number: number;
  title: string;
  from: number;
  to: number | null;
}

/**
 * The ranks of the voyage, scaled to this course's XP (about 4,500 in all),
 * so Admiral needs nearly everything.
 */
const RANKS: ReadonlyArray<{ title: string; from: number }> = [
  { title: 'Deckhand', from: 0 },
  { title: 'Able Seaman', from: 150 },
  { title: 'Bosun', from: 400 },
  { title: 'Third Mate', from: 800 },
  { title: 'Second Mate', from: 1300 },
  { title: 'First Mate', from: 1900 },
  { title: 'Captain', from: 2600 },
  { title: 'Harbor Master', from: 3300 },
  { title: 'Commodore', from: 3900 },
  { title: 'Admiral', from: 4400 },
];

export function rankFor(xp: number): Rank {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (xp >= rank.from) index = i;
  });
  const current = RANKS[index] ?? { title: 'Deckhand', from: 0 };
  const next = RANKS[index + 1];
  return { number: index + 1, title: current.title, from: current.from, to: next?.from ?? null };
}

// ── Lookups ─────────────────────────────────────────────────────────────────

export function getPort(slug: string): K8sPort | undefined {
  return PORTS.find((port) => port.slug === slug);
}

export interface LessonRef {
  port: K8sPort;
  lesson: K8sLesson;
  index: number;
}

export function getLesson(portSlug: string, lessonSlug: string): LessonRef | undefined {
  const port = getPort(portSlug);
  if (port === undefined) return undefined;
  const index = port.lessons.findIndex((lesson) => lesson.slug === lessonSlug);
  const lesson = port.lessons[index];
  return lesson === undefined ? undefined : { port, lesson, index };
}

/** Every lesson with its port, in study order. */
export function allLessons(): LessonRef[] {
  return PORTS.flatMap((port) => port.lessons.map((lesson, index) => ({ port, lesson, index })));
}

/** "Port 03", the way the route names a port. */
export function portCode(port: K8sPort): string {
  return `Port ${String(port.number).padStart(2, '0')}`;
}

export function incidentsFor(portSlug: string): Incident[] {
  return INCIDENTS.filter((incident) => incident.port === portSlug);
}

/** True when the port ends with an incident drill. A port with no incidents has none. */
export function hasDrill(portSlug: string): boolean {
  return incidentsFor(portSlug).length > 0;
}

/** An incident as a quiz question. The quiz shows `code` above the prompt. */
export function incidentQuestion(incident: Incident): BankQuestion {
  return {
    station: incident.port,
    prompt: `**${incident.title}.** ${incident.prompt}`,
    options: incident.options,
    answers: incident.answers,
    why: incident.why,
    code: incident.code,
  };
}

/**
 * The questions the final exam draws from for one port: the choice checks of
 * its lessons and its incidents.
 */
export function examQuestionsFor(portSlug: string): BankQuestion[] {
  const port = getPort(portSlug);
  if (port === undefined) return [];
  const checks = port.lessons.flatMap((lesson) =>
    lesson.checks.flatMap((check) =>
      check.type === 'choice'
        ? [
            {
              station: port.slug,
              prompt: check.prompt,
              options: check.options,
              answers: check.answers,
              why: check.why,
            },
          ]
        : [],
    ),
  );
  return [...checks, ...incidentsFor(portSlug).map(incidentQuestion)];
}

export interface IndexedCard extends K8sCard {
  id: string;
}

/** The cards of one port, or of every port, each with its progress id. */
export function cardsFor(portSlug?: string): IndexedCard[] {
  const counters: Record<string, number> = {};
  const all = CARDS.map((card) => {
    const index = counters[card.port] ?? 0;
    counters[card.port] = index + 1;
    return { ...card, id: cardId(card.port, index) };
  });
  return portSlug === undefined ? all : all.filter((card) => card.port === portSlug);
}

export function lessonXp(lesson: K8sLesson): number {
  return LESSON_BASE_XP + CHECK_XP * lesson.checks.length;
}

function isIndex(text: string, length: number): boolean {
  const index = Number(text);
  return Number.isInteger(index) && String(index) === text && index >= 0 && index < length;
}

/** XP for one item id, or 0 for an id the catalogue does not know. */
export function k8sXpForItem(itemId: string): number {
  const [kind, first, second, extra] = itemId.split(':');
  if (first === undefined || extra !== undefined) return 0;
  if (kind === 'lesson' && second !== undefined) {
    const ref = getLesson(first, second);
    return ref === undefined ? 0 : lessonXp(ref.lesson);
  }
  if (kind === 'card' && second !== undefined) {
    return isIndex(second, cardsFor(first).length) ? CARD_XP : 0;
  }
  if (second !== undefined) return 0;
  if (kind === 'mission') return getPort(first) === undefined ? 0 : MISSION_XP;
  if (kind === 'drill') return hasDrill(first) ? DRILL_XP : 0;
  if (kind === 'dojo') return isIndex(first, DOJO.length) ? DOJO_XP : 0;
  if (kind === 'sprint') return SPRINT_XP[Number(first)] ?? 0;
  if (itemId === EXAM_PASS_ID) return EXAM_XP;
  return 0;
}

export function isKnownK8sItem(itemId: string): boolean {
  return k8sXpForItem(itemId) > 0;
}

export function k8sTotalXp(done: DoneMap): number {
  return Object.keys(done).reduce((sum, id) => sum + k8sXpForItem(id), 0);
}

// ── Progress ────────────────────────────────────────────────────────────────

export interface PortProgress {
  lessonsDone: number;
  lessonsTotal: number;
  missionDone: boolean;
  drillPassed: boolean;
  /** The drill opens once every lesson at the port is done. */
  drillOpen: boolean;
  /** True when the lessons, the mission and the drill are all done. */
  cleared: boolean;
  /** 0 to 1: lessons, the mission and the drill, each counting as one step. */
  ratio: number;
}

export function portProgress(port: K8sPort, done: DoneMap): PortProgress {
  const lessonsDone = port.lessons.filter(
    (lesson) => done[lessonId(port.slug, lesson.slug)] !== undefined,
  ).length;
  const drill = hasDrill(port.slug);
  const missionDone = done[missionId(port.slug)] !== undefined;
  const drillPassed = done[drillId(port.slug)] !== undefined;
  const total = port.lessons.length + 1 + (drill ? 1 : 0);
  const steps = lessonsDone + (missionDone ? 1 : 0) + (drill && drillPassed ? 1 : 0);
  return {
    lessonsDone,
    lessonsTotal: port.lessons.length,
    missionDone,
    drillPassed,
    drillOpen: lessonsDone === port.lessons.length,
    cleared: steps === total,
    ratio: steps / total,
  };
}

/** How far along the route the learner is: the mean progress of the ports. 0 to 1. */
export function voyageProgress(done: DoneMap): number {
  return PORTS.reduce((sum, port) => sum + portProgress(port, done).ratio, 0) / PORTS.length;
}

/** The first unfinished lesson in study order, or undefined when all are done. */
export function nextLesson(done: DoneMap): LessonRef | undefined {
  return allLessons().find((ref) => done[lessonId(ref.port.slug, ref.lesson.slug)] === undefined);
}

export function lessonHref(port: string, lesson: string): string {
  return `/k8s/ports/${port}/${lesson}`;
}
