/**
 * The GCP course catalogue: lines, stations, the question bank, flashcards,
 * the sprint deck, and the game rules (item ids, XP, ranks, readiness).
 * Pure data and pure functions, like `lib/course/catalog.ts` for the DE course.
 *
 * The order of `LINES` is the exam guide's domain order and the study order.
 */

import { CARDS } from '@/lib/course/gcp/cards';
import { line as analysis } from '@/lib/course/gcp/lines/analysis';
import { line as design } from '@/lib/course/gcp/lines/design';
import { line as ingest } from '@/lib/course/gcp/lines/ingest';
import { line as operations } from '@/lib/course/gcp/lines/operations';
import { line as storage } from '@/lib/course/gcp/lines/storage';
import { QUESTIONS } from '@/lib/course/gcp/questions';
import { SPRINT } from '@/lib/course/gcp/sprint';
import type { DoneMap } from '@/lib/course/progress';
import type { BankQuestion, Flashcard, GcpLine, GcpStation } from '@/types/gcp';

export const LINES: readonly GcpLine[] = [design, ingest, storage, analysis, operations];

export { CARDS, QUESTIONS, SPRINT };

// ── Item ids ────────────────────────────────────────────────────────────────
// Progress records store these ids. Do not rename a slug after release, and
// do not reorder CARDS: a card's id is its position in its line's deck.

export function stationId(station: string): string {
  return `station:${station}`;
}

export function bossId(line: string): string {
  return `boss:${line}`;
}

export function cardId(line: string, index: number): string {
  return `card:${line}:${index}`;
}

/** Sprint milestones: reach this many correct answers in one 60-second run. */
export const SPRINT_TARGETS = [10, 20] as const;

export function sprintId(target: number): string {
  return `sprint:${target}`;
}

export const MOCK_PASS_ID = 'mock:pass';

// ── Game rules ──────────────────────────────────────────────────────────────

/** A station is worth a base amount plus a share per key point it checks. */
export const STATION_BASE_XP = 30;
export const KEY_POINT_XP = 10;
export const BOSS_XP = 100;
export const CARD_XP = 2;
export const SPRINT_XP: Readonly<Record<number, number>> = { 10: 25, 20: 50 };
export const MOCK_XP = 250;

/** Boss rounds and the mock exam pass at this share of correct answers. */
export const PASS_RATIO = 0.7;
export const BOSS_QUESTIONS = 10;
export const MOCK_QUESTIONS = 50;
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
 * The lab's ranks, scaled to this course's XP (about 2,100 in all), so the
 * top rank needs nearly everything: every station, boss and the mock exam.
 */
const RANKS: ReadonlyArray<{ title: string; from: number }> = [
  { title: 'Trainee', from: 0 },
  { title: 'Junior DE', from: 150 },
  { title: 'Data Engineer', from: 400 },
  { title: 'Senior DE', from: 750 },
  { title: 'Staff DE', from: 1150 },
  { title: 'Principal DE', from: 1600 },
  { title: 'Exam-ready', from: 2000 },
];

export function rankFor(xp: number): Rank {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (xp >= rank.from) index = i;
  });
  const current = RANKS[index] ?? { title: 'Trainee', from: 0 };
  const next = RANKS[index + 1];
  return { number: index + 1, title: current.title, from: current.from, to: next?.from ?? null };
}

// ── Lookups ─────────────────────────────────────────────────────────────────

export function getLine(slug: string): GcpLine | undefined {
  return LINES.find((line) => line.slug === slug);
}

export interface StationRef {
  line: GcpLine;
  station: GcpStation;
  index: number;
}

export function getStation(lineSlug: string, stationSlug: string): StationRef | undefined {
  const line = getLine(lineSlug);
  if (line === undefined) return undefined;
  const index = line.stations.findIndex((station) => station.slug === stationSlug);
  const station = line.stations[index];
  return station === undefined ? undefined : { line, station, index };
}

/** Every station with its line, in study order. */
export function allStations(): StationRef[] {
  return LINES.flatMap((line) => line.stations.map((station, index) => ({ line, station, index })));
}

function findStation(stationSlug: string): StationRef | undefined {
  return allStations().find((ref) => ref.station.slug === stationSlug);
}

export function lineOfStation(stationSlug: string): GcpLine | undefined {
  return findStation(stationSlug)?.line;
}

export function questionsForLine(lineSlug: string): BankQuestion[] {
  const line = getLine(lineSlug);
  if (line === undefined) return [];
  const slugs = new Set(line.stations.map((station) => station.slug));
  return QUESTIONS.filter((question) => slugs.has(question.station));
}

export interface IndexedCard extends Flashcard {
  id: string;
}

/** The cards of one line, or of every line, each with its progress id. */
export function cardsFor(lineSlug?: string): IndexedCard[] {
  const counters: Record<string, number> = {};
  const all = CARDS.map((card) => {
    const index = counters[card.line] ?? 0;
    counters[card.line] = index + 1;
    return { ...card, id: cardId(card.line, index) };
  });
  return lineSlug === undefined ? all : all.filter((card) => card.line === lineSlug);
}

export function stationXp(station: GcpStation): number {
  return STATION_BASE_XP + KEY_POINT_XP * station.keyPoints.length;
}

/** XP for one item id, or 0 for an id the catalogue does not know. */
export function gcpXpForItem(itemId: string): number {
  const [kind, first, second] = itemId.split(':');
  if (first === undefined) return 0;
  if (kind === 'station') {
    const ref = findStation(first);
    return ref === undefined || second !== undefined ? 0 : stationXp(ref.station);
  }
  if (kind === 'boss') return getLine(first) === undefined || second !== undefined ? 0 : BOSS_XP;
  if (kind === 'card' && second !== undefined) {
    const index = Number(second);
    return Number.isInteger(index) &&
      String(index) === second &&
      cardsFor(first)[index] !== undefined
      ? CARD_XP
      : 0;
  }
  if (kind === 'sprint' && second === undefined) return SPRINT_XP[Number(first)] ?? 0;
  if (itemId === MOCK_PASS_ID) return MOCK_XP;
  return 0;
}

export function isKnownGcpItem(itemId: string): boolean {
  return gcpXpForItem(itemId) > 0;
}

export function gcpTotalXp(done: DoneMap): number {
  return Object.keys(done).reduce((sum, id) => sum + gcpXpForItem(id), 0);
}

// ── Progress ────────────────────────────────────────────────────────────────

export interface LineProgress {
  stationsDone: number;
  stationsTotal: number;
  bossBeaten: boolean;
  /** The boss round opens once every station on the line is done. */
  bossOpen: boolean;
  /** 0 to 1: stations and the boss, the boss counting as one station. */
  ratio: number;
}

export function lineProgress(line: GcpLine, done: DoneMap): LineProgress {
  const stationsDone = line.stations.filter(
    (station) => done[stationId(station.slug)] !== undefined,
  ).length;
  const bossBeaten = done[bossId(line.slug)] !== undefined;
  const total = line.stations.length + 1;
  return {
    stationsDone,
    stationsTotal: line.stations.length,
    bossBeaten,
    bossOpen: stationsDone === line.stations.length,
    ratio: (stationsDone + (bossBeaten ? 1 : 0)) / total,
  };
}

/** Exam readiness: line progress weighted by each domain's share of the exam. 0 to 1. */
export function examReadiness(done: DoneMap): number {
  const weights = LINES.reduce((sum, line) => sum + line.weight, 0);
  const weighted = LINES.reduce(
    (sum, line) => sum + line.weight * lineProgress(line, done).ratio,
    0,
  );
  return weights === 0 ? 0 : weighted / weights;
}

/** The first unfinished station in study order, or undefined when all are done. */
export function nextStation(done: DoneMap): StationRef | undefined {
  return allStations().find((ref) => done[stationId(ref.station.slug)] === undefined);
}
