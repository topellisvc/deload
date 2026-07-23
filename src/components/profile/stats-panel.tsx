import { CalendarDays, ClipboardList, TrendingUp, Users } from "lucide-react";
import type { ProfileStats } from "@/lib/profile/queries";
import type { UserRole } from "@/lib/supabase/types";

function formatMemberSince(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

interface StatsPanelProps {
  stats: ProfileStats;
  role: UserRole;
  createdAt: string;
}

/**
 * Read-only counts pulled from existing tables (programs, session_logs,
 * coach_clients) rather than anything tracked separately — no new state
 * to keep in sync, this is just a different view of data that already
 * exists.
 */
export function StatsPanel({ stats, role, createdAt }: StatsPanelProps) {
  const items = [
    { icon: ClipboardList, label: "Programs", value: stats.programCount },
    { icon: TrendingUp, label: "Sessions logged", value: stats.sessionCount },
    ...(role === "coach" && stats.activeClientCount !== null
      ? [{ icon: Users, label: "Active clients", value: stats.activeClientCount }]
      : []),
    { icon: CalendarDays, label: "Member since", value: formatMemberSince(createdAt) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
  );
}
