/**
 * What the signed-in shell shows for the course on screen: the streak, the
 * XP and the level line. Each course has its own tracker and its own ladder
 * (levels for DE, ranks for GCP), so each derives these numbers its own way
 * and the shell stays course-agnostic.
 */

import type { GcpSummary } from '@/lib/course/gcp/summary';
import type { LearnerSummary } from '@/lib/course/summary';

export interface ShellStats {
  streak: number;
  bestStreak: number;
  xp: number;
  /** XP where the next level or rank starts, or null at the top. */
  xpTarget: number | null;
  /** "Level 3 · Data engineer I" or "Rank 2 · Junior DE". */
  levelLine: string;
}

export function deShellStats(summary: LearnerSummary): ShellStats {
  return {
    streak: summary.streak,
    bestStreak: summary.bestStreak,
    xp: summary.xp,
    xpTarget: summary.level.to,
    levelLine: `Level ${summary.level.number} · ${summary.level.title}`,
  };
}

export function gcpShellStats(summary: GcpSummary): ShellStats {
  return {
    streak: summary.streak,
    bestStreak: summary.bestStreak,
    xp: summary.xp,
    xpTarget: summary.rank.to,
    levelLine: `Rank ${summary.rank.number} · ${summary.rank.title}`,
  };
}
