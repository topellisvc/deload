"use client";

import { useState } from "react";
import { ChevronDown, SkipForward, Trash2 } from "lucide-react";
import type { SessionHistoryEntry } from "@/lib/logging/queries";
import type { LoggedSet } from "@/lib/supabase/types";
import { SessionPerformanceEditor } from "@/components/programs/session-performance-editor";
import { createClient } from "@/lib/supabase/client";
import { deleteSessionLog } from "@/lib/logging/mutations";
import { formatLogDate, formatLogTime, todayDateString } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface HistoryListProps {
  entries: SessionHistoryEntry[];
  /** Keyed by `${session_log_id}:${block_exercise_id}` — see
   * groupLoggedSetsByExercise. One flat map for every entry on the page,
   * same batching principle as everywhere else this shape is used. */
  loggedSetsByExercise: Record<string, LoggedSet[]>;
}

/**
 * Every past session, newest first, each collapsed to a one-line date +
 * program/day summary until clicked open — expanding reveals the exact
 * same Prescription-above-Performance view used everywhere else in the app
 * (SessionPerformanceEditor, read-only here since this is a look-back, not
 * a place to edit history). Collapsed by default rather than rendering
 * every session's full detail inline: someone with months of logs would
 * otherwise get an enormous, slow page for a screen that's meant to answer
 * "what did I do on this date," not to be read top to bottom.
 *
 * Entries are lifted into local state (server-passed props are only the
 * initial value) so a delete can remove a session from the list
 * immediately — same optimistic-remove pattern as DayLogControl's
 * handleDelete, just spanning every program instead of one day.
 */
export function HistoryList({ entries: initialEntries, loggedSetsByExercise }: HistoryListProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayDateString();

  async function handleDelete(logId: string) {
    if (!window.confirm("Delete this session? This can't be undone.")) return;
    setBusyId(logId);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await deleteSessionLog(supabase, logId);
    setBusyId(null);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    setEntries((prev) => prev.filter((e) => e.log.id !== logId));
    if (expandedId === logId) setExpandedId(null);
  }

  if (entries.length === 0) {
    // The page's own server-rendered empty state only covers the initial
    // load (based on the entries it fetched) — this covers deleting your
    // way down to zero without a refresh.
    return (
      <div className="flex flex-col gap-3">
        {error && <p className="text-sm text-danger">{error}</p>}
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          Nothing logged yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => {
          const isExpanded = expandedId === entry.log.id;
          const hasDetail = !entry.log.skipped && entry.blocks.some((b) => b.exercises.length > 0);

          return (
            <li key={entry.log.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => hasDetail && setExpandedId((v) => (v === entry.log.id ? null : entry.log.id))}
                  disabled={!hasDetail}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left disabled:cursor-default"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {entry.log.skipped && <SkipForward className="size-3.5 shrink-0 text-muted-foreground" />}
                      {formatLogDate(entry.log.performed_on, today, { includeYear: true })}
                      {entry.log.skipped && <span className="font-normal text-muted-foreground">· Skipped</span>}
                      {!entry.log.skipped && entry.log.completed_at && (
                        <span className="font-normal text-muted-foreground">· {formatLogTime(entry.log.completed_at)}</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.programName} · {entry.dayLabel}
                    </span>
                  </div>
                  {hasDetail && (
                    <ChevronDown
                      className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.log.id)}
                  disabled={busyId === entry.log.id}
                  aria-label={`Delete session from ${formatLogDate(entry.log.performed_on, today, { includeYear: true })}`}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-danger disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {entry.log.note && <p className="mt-2 text-sm text-muted-foreground">{entry.log.note}</p>}

              {isExpanded && (
                <div className="mt-3 border-t border-border pt-3">
                  <SessionPerformanceEditor
                    sessionLogId={entry.log.id}
                    blocks={entry.blocks}
                    loggedSetsByExercise={loggedSetsByExercise}
                    personalRecords={[]}
                    readOnly
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
