import type { LucideIcon } from "lucide-react";
import { BarChart3, Gauge, ListChecks, TrendingUp } from "lucide-react";
import type { WeeklyTrainingSummary } from "@/lib/dashboard/types";

interface StatCard {
  label: string;
  value: string;
  icon: LucideIcon;
}

/**
 * The desktop dashboard's "This Week" cluster (mockups Ellis shared) — sits
 * beside the Active Program card at lg+ (see dashboard/page.tsx). Distinct
 * from DashboardSnapshot (the mobile-first, all-time stat row further down
 * this same page — streak/sessions/programs/completion%): this is real
 * last-7-days training volume, not lifetime totals, and only renders in the
 * desktop grid.
 *
 * Every number here is real, not estimated — see getWeeklyTrainingSummary's
 * own doc comment for exactly what each one reads from (logged_sets'
 * performed_weight/reps/rpe, the athlete's own reported performance).
 * Deliberately no "Duration" card to match the mockup's 4th stat: this app
 * doesn't persist a workout's total elapsed time anywhere once it's
 * finished (training_mode_sessions, the only place a start time lives, gets
 * deleted at Finish Workout — see that migration's own comment), so making
 * one up would be exactly the kind of invented number this codebase's own
 * copy conventions elsewhere explicitly avoid. Consistency% (already
 * computed for the Active Program card) fills the 4th slot instead, since
 * it's a real number this page already has in hand.
 */
export function ThisWeekStats({
  summary,
  consistencyPercent,
}: {
  summary: WeeklyTrainingSummary;
  consistencyPercent: number | null;
}) {
  const cards: StatCard[] = [
    {
      label: "Workouts",
      value:
        summary.workoutsScheduledThisWeek != null
          ? `${summary.workoutsThisWeek}/${summary.workoutsScheduledThisWeek}`
          : String(summary.workoutsThisWeek),
      icon: ListChecks,
    },
    { label: "Volume", value: `${summary.volumeThisWeekKg.toLocaleString()} kg`, icon: BarChart3 },
    { label: "Avg RPE", value: summary.avgRpeThisWeek != null ? String(summary.avgRpeThisWeek) : "—", icon: Gauge },
  ];
  if (consistencyPercent != null) {
    cards.push({ label: "Consistency", value: `${consistencyPercent}%`, icon: TrendingUp });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
          <card.icon className="size-4 text-primary" />
          <span className="text-xl font-semibold tabular-nums text-foreground">{card.value}</span>
          <span className="text-xs text-muted-foreground">{card.label}</span>
        </div>
      ))}
    </div>
  );
}
