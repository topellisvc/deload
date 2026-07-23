import { CalendarDays } from "lucide-react";
import type { UpcomingSession } from "@/lib/dashboard/types";

export function UpcomingSection({ sessions }: { sessions: UpcomingSession[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Upcoming</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No upcoming sessions scheduled — set an active program to see what&apos;s next.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {sessions.map((session) => (
            <li key={session.dayId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{session.dayLabel}</p>
                <p className="text-xs text-muted-foreground">{session.weekLabel}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
