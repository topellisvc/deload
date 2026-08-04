import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import type { CoachingClientSummary } from "@/lib/coaching/types";

/** `iso` is a plain "YYYY-MM-DD" date (session_logs.performed_on), not a
 * timestamp — so this reads as day-granularity ("Today"/"3 days ago"),
 * never fake hour/minute precision the underlying data doesn't have.
 * Date.UTC-anchored, same pattern as weekly-volume-chart.tsx's
 * weekdayLabel, so it can't drift a day off depending on the viewer's own
 * timezone offset. */
function relativeDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today - target) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(target).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * One page of "Your athletes" rows for AthletesShell's Clients tab — a
 * single-column list (not the old 2-up grid) now that this lives in a
 * ~380px sidebar rather than a full-width card, and `selectedId` picks out
 * whichever athlete's detail panel is currently open beside it, mirroring
 * how a mail client highlights the open thread in its list. Pagination,
 * search, and the tab bar around this all live in AthletesShell — this
 * component only ever renders the one page of clients it's handed.
 */
export function ClientListSection({ clients, selectedId }: { clients: CoachingClientSummary[]; selectedId?: string | null }) {
  if (clients.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">No athletes match.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {clients.map((client) => {
        const selected = client.clientId === selectedId;
        return (
          <li key={client.id}>
            <Link
              href={`/coaching/athletes/${client.clientId}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary"
              )}
            >
              <div
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              >
                {getInitials(null, client.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-foreground">{client.email}</p>
                  {client.needsAttention ? (
                    <span className="shrink-0 rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
                      Needs attention
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                      Active
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{client.activeProgramName ?? "No active program"}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {client.needsAttention && <AlertTriangle className="size-3 shrink-0 text-danger" />}
                  {client.lastActivityOn ? `Active ${relativeDay(client.lastActivityOn)}` : "No workouts logged"}
                </p>
              </div>
              {client.consistencyPercent !== null && (
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{client.consistencyPercent}%</p>
                  <p className="text-[10px] text-muted-foreground">consistency</p>
                </div>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
