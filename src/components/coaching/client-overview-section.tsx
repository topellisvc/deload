import { Activity, ClipboardList, Users } from "lucide-react";
import type { CoachingDashboardData } from "@/lib/coaching/types";

/** The "Client Overview" stat row — reuses getCoachingDashboard's data
 * (already fetched for the client list below it), no separate query. */
export function ClientOverviewSection({ data }: { data: CoachingDashboardData }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Client overview</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-4">
          <Users className="size-4 text-primary" />
          <span className="text-xl font-semibold tabular-nums text-foreground">{data.activeClientCount}</span>
          <span className="text-xs text-muted-foreground">Active clients</span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-4">
          <ClipboardList className="size-4 text-primary" />
          <span className="text-xl font-semibold tabular-nums text-foreground">{data.pendingInviteCount}</span>
          <span className="text-xs text-muted-foreground">Pending invitations</span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-4">
          <Activity className="size-4 text-primary" />
          <span className="text-xl font-semibold tabular-nums text-foreground">{data.recentActivity.length}</span>
          <span className="text-xs text-muted-foreground">Recently active athletes</span>
        </div>
      </div>
    </div>
  );
}
