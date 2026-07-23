import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { getInitials } from "@/lib/utils";
import type { CoachingClientSummary } from "@/lib/coaching/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Every active athlete, as cards — name (email; no separate display name
 * reliably set across the app), last workout logged, current active
 * program (from this coach, if any — see getCoachingDashboard's comment
 * on why it's null otherwise), and a "needs attention" flag standing in
 * for "training status." Selecting one opens /coaching/athletes/[id].
 */
export function ClientListSection({ clients }: { clients: CoachingClientSummary[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Your athletes</h2>
      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No athletes yet. Invite one to get started.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/coaching/athletes/${client.clientId}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
              >
                {getInitials(null, client.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{client.email}</p>
                <p className="truncate text-xs text-muted-foreground">{client.activeProgramName ?? "No active program"}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {client.needsAttention && <AlertTriangle className="size-3 shrink-0 text-danger" />}
                  {client.lastActivityOn ? `Last workout ${formatDate(client.lastActivityOn)}` : "No workouts logged"}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
