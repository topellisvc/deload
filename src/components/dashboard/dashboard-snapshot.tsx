import type { LucideIcon } from "lucide-react";
import { ClipboardList, Flame, ListChecks, Target, TrendingUp } from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard/types";

interface StatCard {
  label: string;
  value: string;
  icon: LucideIcon;
}

/**
 * Compact glance-and-move-on cards. Completion % and consistency % only
 * appear once there's an active program to measure them against — the
 * three account-wide stats (streak/sessions/programs) always show, since
 * those exist independent of any one program.
 */
export function DashboardSnapshot({ stats }: { stats: DashboardStats }) {
  const cards: StatCard[] = [
    { label: "Current streak", value: `${stats.currentStreak} ${stats.currentStreak === 1 ? "day" : "days"}`, icon: Flame },
    { label: "Sessions logged", value: String(stats.sessionCount), icon: ListChecks },
    { label: "Programs created", value: String(stats.programsCreated), icon: ClipboardList },
  ];
  if (stats.completionPercent != null) {
    cards.push({ label: "Program completion", value: `${stats.completionPercent}%`, icon: Target });
  }
  if (stats.consistencyPercent != null) {
    cards.push({ label: "Consistency", value: `${stats.consistencyPercent}%`, icon: TrendingUp });
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
