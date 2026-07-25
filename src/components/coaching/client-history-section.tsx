import { HistoryList } from "@/components/history/history-list";
import type { SessionHistoryEntry } from "@/lib/logging/queries";
import type { LoggedSet } from "@/lib/supabase/types";

interface ClientHistorySectionProps {
  entries: SessionHistoryEntry[];
  loggedSetsByExercise: Record<string, LoggedSet[]>;
}

/**
 * The coach's view of one client's full training record — same
 * expand-to-see-every-set detail HistoryList already gives an athlete of
 * their own history (getSessionHistory takes any athleteId, and RLS
 * already permits reading it via program ownership — see that migration's
 * policy), not just the coarse "logged/skipped + program name" strip this
 * page used to show via RecentActivitySection. Read-only: canDelete=false
 * hides the delete affordance rather than shipping a button that would
 * silently no-op (see HistoryList's own canDelete comment).
 */
export function ClientHistorySection({ entries, loggedSetsByExercise }: ClientHistorySectionProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Workout history</h2>
      <HistoryList entries={entries} loggedSetsByExercise={loggedSetsByExercise} canDelete={false} />
    </div>
  );
}
