"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Pencil, Plus, SkipForward, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createSessionLog, deleteSessionLog, updateSessionLogNote } from "@/lib/logging/mutations";
import type { LoggedSet, PersonalRecord, SessionLog } from "@/lib/supabase/types";
import type { BlockRow } from "@/lib/programs/types";
import { SessionPerformanceEditor } from "@/components/programs/session-performance-editor";
import { formatLogDate, formatLogTime, todayDateString } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface DayLogControlProps {
  trainingDayId: string;
  athleteId: string;
  logs: SessionLog[];
  /** This day's exercise structure — what SessionPerformanceEditor renders
   * the Prescription section from. Empty/absent blocks (e.g. a day with no
   * exercises yet) just means there's nothing to expand into. */
  blocks: BlockRow[];
  /** Keyed by `${session_log_id}:${block_exercise_id}` — passed straight
   * through to SessionPerformanceEditor per expanded log entry. */
  loggedSetsByExercise: Record<string, LoggedSet[]>;
  /** For prefilling a suggested weight when logging a percent_1rm set. */
  personalRecords: PersonalRecord[];
}

/**
 * Every logged session for this day, each editable and deletable — not
 * just today's. A quick "Log today" add-on top when today isn't logged
 * yet. Each entry expands into a SessionPerformanceEditor for the
 * Prescription-vs-Performance detail (per-set weights/reps/distance/etc);
 * collapsed by default so the day column stays scannable when all the
 * athlete wants to confirm is "yes, this happened."
 */
export function DayLogControl({ trainingDayId, athleteId, logs: initialLogs, blocks, loggedSetsByExercise, personalRecords }: DayLogControlProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = todayDateString();
  const hasTodayLog = logs.some((l) => l.performed_on === today);

  async function handleLogToday() {
    setBusyId("new");
    setError(null);
    const supabase = createClient();
    const { log, error: logError } = await createSessionLog(supabase, {
      trainingDayId,
      athleteId,
      performedOn: today,
    });
    setBusyId(null);
    if (logError || !log) {
      setError(logError ?? "Couldn't log this session.");
      return;
    }
    setLogs((prev) => [log, ...prev]);
  }

  async function handleSkipToday() {
    setBusyId("skip");
    setError(null);
    const supabase = createClient();
    const { log, error: logError } = await createSessionLog(supabase, {
      trainingDayId,
      athleteId,
      performedOn: today,
      skipped: true,
    });
    setBusyId(null);
    if (logError || !log) {
      setError(logError ?? "Couldn't skip this session.");
      return;
    }
    setLogs((prev) => [log, ...prev]);
  }

  async function handleDelete(logId: string) {
    setBusyId(logId);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await deleteSessionLog(supabase, logId);
    setBusyId(null);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    if (editingId === logId) setEditingId(null);
  }

  async function handleSaveNote(logId: string) {
    const trimmed = noteDraft.trim();
    const supabase = createClient();
    const { error: noteError } = await updateSessionLogNote(supabase, logId, trimmed || null);
    if (noteError) {
      setError(noteError);
      return;
    }
    setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, note: trimmed || null } : l)));
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2.5 text-xs">
      {!hasTodayLog && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleLogToday}
            disabled={busyId === "new"}
            className="flex items-center gap-1 self-start font-medium text-primary transition-colors hover:underline disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            Log today
          </button>
          <button
            type="button"
            onClick={handleSkipToday}
            disabled={busyId === "skip"}
            className="flex items-center gap-1 self-start font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline disabled:opacity-50"
          >
            <SkipForward className="size-3.5" />
            Skip today
          </button>
        </div>
      )}

      {logs.length > 0 && (
        <ul className="flex flex-col gap-2">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                {log.skipped ? (
                  <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <SkipForward className="size-3.5" />
                    Skipped · {formatLogDate(log.performed_on, today)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium text-success">
                    <CheckCircle2 className="size-3.5" />
                    {formatLogDate(log.performed_on, today)}
                    {log.completed_at && <span className="font-normal text-muted-foreground">· {formatLogTime(log.completed_at)}</span>}
                  </span>
                )}
                <div className="flex items-center gap-2.5">
                  {!log.skipped && blocks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedId((v) => (v === log.id ? null : log.id))}
                      aria-label={`${expandedId === log.id ? "Hide" : "Show"} workout details for ${formatLogDate(log.performed_on, today)}`}
                      className="flex items-center gap-0.5 font-medium text-foreground/70 transition-colors hover:text-foreground"
                    >
                      Details
                      <ChevronDown className={cn("size-3.5 transition-transform", expandedId === log.id && "rotate-180")} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNoteDraft(log.note ?? "");
                      setEditingId((v) => (v === log.id ? null : log.id));
                    }}
                    aria-label={`Add or edit note for ${formatLogDate(log.performed_on, today)}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(log.id)}
                    disabled={busyId === log.id}
                    aria-label={`Remove log for ${formatLogDate(log.performed_on, today)}`}
                    className="text-muted-foreground transition-colors hover:text-danger disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>

              {editingId === log.id ? (
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={() => handleSaveNote(log.id)}
                  placeholder="How'd it go?"
                  rows={2}
                  autoFocus
                  className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              ) : (
                log.note && <p className="pl-5 text-muted-foreground">{log.note}</p>
              )}

              {!log.skipped && expandedId === log.id && blocks.length > 0 && (
                <div className="pl-0.5 pt-1">
                  <SessionPerformanceEditor
                    sessionLogId={log.id}
                    blocks={blocks}
                    loggedSetsByExercise={loggedSetsByExercise}
                    personalRecords={personalRecords}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
