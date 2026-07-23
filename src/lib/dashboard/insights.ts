import type { LucideIcon } from "lucide-react";
import { AlertCircle, Flame, Moon, PartyPopper, TrendingUp } from "lucide-react";

export interface InsightInput {
  currentStreak: number;
  sessionsLast14Days: number;
  sessionsPrevious14Days: number;
  /** Null if the user has never logged a session. */
  daysSinceLastSession: number | null;
  completionPercent: number | null;
  /** Label of the week right after "today's" week in the active program, if any. */
  upcomingWeekLabel: string | null;
}

export interface Insight {
  id: string;
  icon: LucideIcon;
  tone: "positive" | "neutral" | "warning";
  message: string;
}

/**
 * Every insight is a pure function of stats that already exist elsewhere
 * on the dashboard (streak, session counts, completion %) — there's no
 * separate insights table to keep in sync, and nothing here is tracked
 * twice. Deliberately limited to things this schema can actually compute:
 * session_logs only records that a day was done, not the weights/reps
 * performed, so a claim like "bench volume increased" isn't something we
 * can honestly derive yet, even though it's a natural example insight to
 * want. "Only use statistics that already exist or can be calculated
 * efficiently" per spec. When real AI-generated insights replace this,
 * they only need to produce the same Insight[] shape — no caller changes.
 */
export function computeInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];

  if (input.daysSinceLastSession != null && input.daysSinceLastSession >= 7) {
    insights.push({
      id: "inactive",
      icon: AlertCircle,
      tone: "warning",
      message: `No workouts logged in ${input.daysSinceLastSession} days — time to get back on track.`,
    });
  }

  if (input.currentStreak >= 3) {
    insights.push({
      id: "streak",
      icon: Flame,
      tone: "positive",
      message: `You're on a ${input.currentStreak}-day streak. Keep it going.`,
    });
  }

  if (input.sessionsPrevious14Days > 0 && input.sessionsLast14Days > input.sessionsPrevious14Days) {
    insights.push({
      id: "consistency_improved",
      icon: TrendingUp,
      tone: "positive",
      message: `Consistency is up — ${input.sessionsLast14Days} sessions in the last 2 weeks, vs ${input.sessionsPrevious14Days} the 2 weeks before.`,
    });
  }

  if (input.upcomingWeekLabel && /deload|recovery|rest/i.test(input.upcomingWeekLabel)) {
    insights.push({
      id: "recovery_week",
      icon: Moon,
      tone: "neutral",
      message: `${input.upcomingWeekLabel} is coming up next.`,
    });
  }

  if (input.completionPercent != null && input.completionPercent >= 80) {
    insights.push({
      id: "near_complete",
      icon: PartyPopper,
      tone: "positive",
      message: `You're ${input.completionPercent}% of the way through your current program.`,
    });
  }

  return insights;
}
