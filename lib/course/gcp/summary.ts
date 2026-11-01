/**
 * One GCP learner's numbers, derived once per page: XP and rank, streaks,
 * today's XP toward the daily goal, stations and bosses done, readiness and
 * recent activity. Pure, like `lib/course/summary.ts` for the DE course.
 */

import {
  allStations,
  bossId,
  CARDS,
  DAILY_XP_GOAL,
  examReadiness,
  gcpTotalXp,
  gcpXpForItem,
  getLine,
  LINES,
  MOCK_PASS_ID,
  type Rank,
  rankFor,
  stationId,
} from '@/lib/course/gcp/catalog';
import {
  activityGrid,
  bestStreak,
  type ProgressRecord,
  streak,
  xpOnDay,
} from '@/lib/course/progress';
import { CALENDAR_WEEKS } from '@/lib/course/summary';

export interface GcpRecentItem {
  id: string;
  title: string;
  href: string;
  day: string;
  xp: number;
}

export interface GcpSummary {
  xp: number;
  rank: Rank;
  /** 0 to 1: progress from this rank to the next. 1 at the top rank. */
  rankRatio: number;
  streak: number;
  bestStreak: number;
  xpToday: number;
  dailyGoal: number;
  stationsDone: number;
  stationsTotal: number;
  bossesBeaten: number;
  linesTotal: number;
  cardsKnown: number;
  cardsTotal: number;
  mockPassed: boolean;
  /** 0 to 1, weighted by each domain's share of the exam. */
  readiness: number;
  activeDays: number;
  recent: GcpRecentItem[];
}

/** The title and link for a GCP item id, or undefined for ids not worth listing. */
function describe(id: string): { title: string; href: string } | undefined {
  const [kind, first] = id.split(':');
  if (kind === 'station' && first !== undefined) {
    const ref = allStations().find((item) => item.station.slug === first);
    return ref && { title: ref.station.title, href: `/gcp/lines/${ref.line.slug}/${first}` };
  }
  if (kind === 'boss' && first !== undefined) {
    const line = getLine(first);
    return line && { title: `Boss beaten: ${line.boss.title}`, href: `/gcp/lines/${first}/boss` };
  }
  if (id === MOCK_PASS_ID) return { title: 'Mock exam passed', href: '/gcp/practice/mock' };
  return undefined;
}

export function summarizeGcp(record: ProgressRecord, today: string, recentCount = 4): GcpSummary {
  const xp = gcpTotalXp(record.done);
  const rank = rankFor(xp);
  const rankRatio = rank.to === null ? 1 : (xp - rank.from) / (rank.to - rank.from);
  const grid = activityGrid(record.days, today, CALENDAR_WEEKS).flat();
  const ids = Object.keys(record.done);

  const recent = Object.entries(record.done)
    .sort(([idA, dayA], [idB, dayB]) => dayB.localeCompare(dayA) || idA.localeCompare(idB))
    .flatMap(([id, day]) => {
      const item = describe(id);
      return item === undefined ? [] : [{ id, day, xp: gcpXpForItem(id), ...item }];
    })
    .slice(0, recentCount);

  return {
    xp,
    rank,
    rankRatio,
    streak: streak(record.days, today),
    bestStreak: bestStreak(record.days),
    xpToday: xpOnDay(record, today, gcpXpForItem),
    dailyGoal: DAILY_XP_GOAL,
    stationsDone: allStations().filter(
      (ref) => record.done[stationId(ref.station.slug)] !== undefined,
    ).length,
    stationsTotal: allStations().length,
    bossesBeaten: LINES.filter((line) => record.done[bossId(line.slug)] !== undefined).length,
    linesTotal: LINES.length,
    cardsKnown: ids.filter((id) => id.startsWith('card:') && gcpXpForItem(id) > 0).length,
    cardsTotal: CARDS.length,
    mockPassed: record.done[MOCK_PASS_ID] !== undefined,
    readiness: examReadiness(record.done),
    activeDays: grid.filter((cell) => cell.count > 0).length,
    recent,
  };
}
