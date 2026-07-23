"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SessionHistoryEntry } from "@/lib/logging/queries";
import type { LoggedSet } from "@/lib/supabase/types";
import { SessionPerformanceEditor } from "@/components/programs/session-performance-editor";
import { formatLogDate, todayDateString } from "@/lib/dates";
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
 */
export function HistoryList({ entries, loggedSetsByExercise }: HistoryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = todayDateString();

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => {
        const isExpanded = expandedId === entry.log.id;
        const hasDetail = entry.blocks.some((b) => b.exercises.length > 0);

        return (
          <li key={entry.log.id} className="rounded-2xl border border-border bg-surface p-4">
            <button
              type="button"
              onClick={() => hasDetail && setExpandedId((v) => (v === entry.log.id ? null : entry.log.id))}
              disabled={!hasDetail}
              className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-default"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">
                  {formatLogDate(entry.log.performed_on, today, { includeYear: true })}
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
  );
}
