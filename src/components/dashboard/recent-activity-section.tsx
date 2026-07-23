import { Dumbbell, Users } from "lucide-react";
import type { ActivityEvent } from "@/lib/dashboard/types";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Newest first (getRecentActivity already sorts). Only session_log and
 * coach_interaction events exist today; the ActivityEvent union has room
 * for program_change and richer coach events later without this component
 * needing a rewrite — just another arm in the switch below. `title` is
 * overridable so the coaching hub's athlete detail page can label this
 * "Workout history" while /dashboard keeps "Recent activity" — same
 * component and query, just different framing for who's reading it.
 */
export function RecentActivitySection({ events, title = "Recent activity" }: { events: ActivityEvent[]; title?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing logged yet — your training history will show up here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {events.map((event) => (
            <li key={`${event.type}-${event.id}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              {event.type === "session_log" ? (
                <>
                  <Dumbbell className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      Logged {event.dayLabel} — {event.programName}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatWhen(event.occurredAt)}</p>
                  </div>
                </>
              ) : (
                <>
                  <Users className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{event.detail}</p>
                    <p className="text-xs text-muted-foreground">{formatWhen(event.occurredAt)}</p>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
