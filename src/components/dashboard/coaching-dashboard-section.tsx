import Link from "next/link";
import { AlertTriangle, PlusCircle, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CoachingDashboardData } from "@/lib/dashboard/types";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Only rendered when the signed-in user coaches athletes — a coach can
 * also be an athlete, so this sits alongside the rest of the dashboard,
 * never replacing it. "Open client" from the spec became "View clients"
 * here: there's no per-client detail route in this app yet (/clients is
 * the whole roster), so a button literally called "Open client" with
 * nowhere specific to go would be a fake affordance.
 */
export function CoachingDashboardSection({ data }: { data: CoachingDashboardData }) {
  const hasAnyClients = data.activeClientCount > 0 || data.pendingInviteCount > 0;
  const needingAttention = data.clients.filter((c) => c.needsAttention);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Coaching</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/clients">
            <Button variant="outline" size="sm">
              <UserPlus className="size-3.5" />
              Invite athlete
            </Button>
          </Link>
          <Link href="/clients">
            <Button variant="outline" size="sm">
              <Users className="size-3.5" />
              View clients
            </Button>
          </Link>
          <Link href="/programs">
            <Button variant="outline" size="sm">
              <PlusCircle className="size-3.5" />
              Create program
            </Button>
          </Link>
        </div>
      </div>

      {!hasAnyClients ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Users className="size-6 text-muted-foreground" />
          <p className="text-sm text-foreground">No clients yet.</p>
          <p className="text-sm text-muted-foreground">Invite your first athlete to start coaching them here.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-background p-3.5">
              <p className="text-xl font-semibold tabular-nums text-foreground">{data.activeClientCount}</p>
              <p className="text-xs text-muted-foreground">Active clients</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3.5">
              <p className="text-xl font-semibold tabular-nums text-foreground">{data.pendingInviteCount}</p>
              <p className="text-xs text-muted-foreground">Pending invitations</p>
            </div>
          </div>

          {needingAttention.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="size-3.5 text-danger" />
                Needs attention
              </h3>
              <ul className="flex flex-col divide-y divide-border">
                {needingAttention.map((client) => (
                  <li key={client.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="text-sm text-foreground">{client.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {client.lastActivityOn ? `Last active ${formatWhen(client.lastActivityOn)}` : "No activity yet"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recent athlete activity
            </h3>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No client activity logged yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {data.recentActivity.map((activity, i) => (
                  <li
                    key={`${activity.clientEmail}-${i}`}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm text-foreground">{activity.clientEmail}</span>
                    <span className="text-xs text-muted-foreground">{formatWhen(activity.performedOn)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
