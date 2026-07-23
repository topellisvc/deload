import { CalendarDays, ClipboardList, Flame, TrendingUp, Users } from "lucide-react";
import type { ProfileStats } from "@/lib/profile/queries";
import type { UserRole } from "@/lib/supabase/types";

interface StatsPanelProps {
  stats: ProfileStats;
  role: UserRole;
}

/**
 * Read-only counts pulled from existing tables (programs, session_logs,
 * coach_clients) rather than anything tracked separately — no new state
 * to keep in sync, this is just a different view of data that already
 * exists. Streak and weeks-active are derived in getMyStats from the
 * same session_logs date list, not separate queries. "Member since"
 * lives in ProfileHeader instead of here — no need to show it twice.
 */
export function StatsPanel({ stats, role }: StatsPanelProps) {
  const items = [
    { icon: ClipboardList, label: "Programs created", value: stats.programsCreated },
    { icon: TrendingUp, label: "Sessions logged", value: stats.sessionCount },
    { icon: Flame, label: "Current streak", value: `${stats.currentStreak}d` },
    { icon: CalendarDays, label: "Weeks active", value: stats.totalWeeksActive },
    ...(role === "coach" && stats.activeClientCount !== null
      ? [{ icon: Users, label: "Active clients", value: stats.activeClientCount }]
      : []),
  ];

  return (
    <div>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Activity</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex flex-col gap-2 rounded-xl bg-muted p-4">
              <Icon className="size-4 text-muted-foreground" />
              <span className="text-xl font-semibold tabular-nums text-foreground">{item.value}</span>
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
