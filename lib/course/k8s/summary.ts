/**
 * One Kubernetes learner's numbers, derived once per page: XP and rank,
 * streaks, today's XP toward the daily goal, lessons, missions and drills
 * done, the progress along the route and recent activity. Pure, like
 * `lib/course/gcp/summary.ts` for the GCP course.
 */

import {
  allLessons,
  CARDS,
  DAILY_XP_GOAL,
  DOJO,
  drillId,
  EXAM_PASS_ID,
  getLesson,
  getPort,
  hasDrill,
  k8sTotalXp,
  k8sXpForItem,
  lessonHref,
  lessonId,
  missionId,
  portCode,
  portProgress,
  PORTS,
  type Rank,
  rankFor,
  voyageProgress,
} from '@/lib/course/k8s/catalog';
import {
  activityGrid,
  bestStreak,
  type ProgressRecord,
  streak,
  xpOnDay,
} from '@/lib/course/progress';
import { CALENDAR_WEEKS } from '@/lib/course/summary';

export interface K8sRecentItem {
  id: string;
  title: string;
  href: string;
  day: string;
  xp: number;
}

export interface K8sSummary {
  xp: number;
  rank: Rank;
  /** 0 to 1: progress from this rank to the next. 1 at the top rank. */
  rankRatio: number;
  streak: number;
  bestStreak: number;
  xpToday: number;
  dailyGoal: number;
  lessonsDone: number;
  lessonsTotal: number;
  missionsDone: number;
  drillsPassed: number;
  drillsTotal: number;
  portsCleared: number;
  portsTotal: number;
  cardsKnown: number;
  cardsTotal: number;
  dojoSolved: number;
  dojoTotal: number;
  examPassed: boolean;
  /** 0 to 1: the mean progress of the ports. */
  voyage: number;
  activeDays: number;
  recent: K8sRecentItem[];
}

/** The title and link for an item id, or undefined for ids not worth listing. */
function describe(id: string): { title: string; href: string } | undefined {
  const [kind, first, second] = id.split(':');
  if (first === undefined) return undefined;
  if (kind === 'lesson' && second !== undefined) {
    const ref = getLesson(first, second);
    return ref && { title: ref.lesson.title, href: lessonHref(first, second) };
  }
  const port = getPort(first);
  if (kind === 'mission' && port !== undefined) {
    return { title: `Mission done: ${port.mission.title}`, href: `/k8s/ports/${first}/mission` };
  }
  if (kind === 'drill' && port !== undefined) {
    return { title: `Incident drill passed: ${portCode(port)}`, href: `/k8s/ports/${first}/drill` };
  }
  if (id === EXAM_PASS_ID) return { title: 'Final exam passed', href: '/k8s/practice/exam' };
  return undefined;
}

export function summarizeK8s(record: ProgressRecord, today: string, recentCount = 4): K8sSummary {
  const xp = k8sTotalXp(record.done);
  const rank = rankFor(xp);
  const rankRatio = rank.to === null ? 1 : (xp - rank.from) / (rank.to - rank.from);
  const grid = activityGrid(record.days, today, CALENDAR_WEEKS).flat();
  const ids = Object.keys(record.done).filter((id) => k8sXpForItem(id) > 0);

  const recent = Object.entries(record.done)
    .sort(([idA, dayA], [idB, dayB]) => dayB.localeCompare(dayA) || idA.localeCompare(idB))
    .flatMap(([id, day]) => {
      const item = describe(id);
      return item === undefined ? [] : [{ id, day, xp: k8sXpForItem(id), ...item }];
    })
    .slice(0, recentCount);

  return {
    xp,
    rank,
    rankRatio,
    streak: streak(record.days, today),
    bestStreak: bestStreak(record.days),
    xpToday: xpOnDay(record, today, k8sXpForItem),
    dailyGoal: DAILY_XP_GOAL,
    lessonsDone: allLessons().filter(
      (ref) => record.done[lessonId(ref.port.slug, ref.lesson.slug)] !== undefined,
    ).length,
    lessonsTotal: allLessons().length,
    missionsDone: PORTS.filter((port) => record.done[missionId(port.slug)] !== undefined).length,
    drillsPassed: PORTS.filter((port) => record.done[drillId(port.slug)] !== undefined).length,
    drillsTotal: PORTS.filter((port) => hasDrill(port.slug)).length,
    portsCleared: PORTS.filter((port) => portProgress(port, record.done).cleared).length,
    portsTotal: PORTS.length,
    cardsKnown: ids.filter((id) => id.startsWith('card:')).length,
    cardsTotal: CARDS.length,
    dojoSolved: ids.filter((id) => id.startsWith('dojo:')).length,
    dojoTotal: DOJO.length,
    examPassed: record.done[EXAM_PASS_ID] !== undefined,
    voyage: voyageProgress(record.done),
    activeDays: grid.filter((cell) => cell.count > 0).length,
    recent,
  };
}
