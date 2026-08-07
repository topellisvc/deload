/**
 * Icon identifiers, not lucide component references — computeInsights runs
 * server-side (app/dashboard/page.tsx) and its return value crosses into a
 * "use client" component (DashboardContent -> EvidenceInsightsSection) as a
 * prop. A LucideIcon is a function/forwardRef object, and Next.js can only
 * pass plain serializable data across that boundary — passing the component
 * itself throws "Functions cannot be passed directly to Client Components."
 * EvidenceInsightsSection resolves these names to the real icon components
 * on the client side, where rendering JSX is fine.
 */
export type InsightIconName = "alert-circle" | "flame" | "trending-up" | "moon" | "party-popper";

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
  icon: InsightIconName;
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
      icon: "alert-circle",
      tone: "warning",
      message: `No workouts logged in ${input.daysSinceLastSession} days — time to get back on track.`,
    });
  }

  if (input.currentStreak >= 3) {
    insights.push({
      id: "streak",
      icon: "flame",
      tone: "positive",
      message: `You're on a ${input.currentStreak}-day streak. Keep it going.`,
    });
  }

  if (input.sessionsPrevious14Days > 0 && input.sessionsLast14Days > input.sessionsPrevious14Days) {
    insights.push({
      id: "consistency_improved",
      icon: "trending-up",
      tone: "positive",
      message: `Consistency is up — ${input.sessionsLast14Days} sessions in the last 2 weeks, vs ${input.sessionsPrevious14Days} the 2 weeks before.`,
    });
  }

  if (input.upcomingWeekLabel && /deload|recovery|rest/i.test(input.upcomingWeekLabel)) {
    insights.push({
      id: "recovery_week",
      icon: "moon",
      tone: "neutral",
      message: `${input.upcomingWeekLabel} is coming up next.`,
    });
  }

  if (input.completionPercent != null && input.completionPercent >= 80) {
    insights.push({
      id: "near_complete",
      icon: "party-popper",
      tone: "positive",
      message: `You're ${input.completionPercent}% of the way through your current program.`,
    });
  }

  return insights;
}
