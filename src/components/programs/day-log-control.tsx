"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createSessionLog, deleteSessionLog, updateSessionLogNote } from "@/lib/logging/mutations";
import type { SessionLog } from "@/lib/supabase/types";

/** Local calendar date (not UTC) — "did I train today" should follow the
 * athlete's own clock, not whatever the server's timezone happens to be. */
function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DayLogControlProps {
  trainingDayId: string;
  athleteId: string;
  logs: SessionLog[];
}

/**
 * Marks a training day done for today, with an optional note. Deliberately
 * not a full workout log (no per-set actual weights/reps) — just closes
 * the loop on "did this happen", which is what a coach actually needs
 * visibility into. Only ever rendered for the program's athlete (RLS
 * write policies enforce this regardless — see 0006_session_logs.sql —
 * but the caller should only mount this for the athlete in the first
 * place, not show it and let it fail).
 */
export function DayLogControl({ trainingDayId, athleteId, logs: initialLogs }: DayLogControlProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const today = todayDateString();
  const todayLog = logs.find((l) => l.performed_on === today);

  async function handleLog() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { log, error: logError } = await createSessionLog(supabase, {
      trainingDayId,
      athleteId,
      performedOn: today,
    });
    setBusy(false);
    if (logError || !log) {
      setError(logError ?? "Couldn't log this session.");
      return;
    }
    setLogs((prev) => [log, ...prev]);
  }

  async function handleUnlog() {
    if (!todayLog) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await deleteSessionLog(supabase, todayLog.id);
    setBusy(false);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    setLogs((prev) => prev.filter((l) => l.id !== todayLog.id));
    setEditingNote(false);
  }

  async function handleSaveNote() {
    if (!todayLog) return;
    const trimmed = noteDraft.trim();
    const supabase = createClient();
    const { error: noteError } = await updateSessionLogNote(supabase, todayLog.id, trimmed || null);
    if (noteError) {
      setError(noteError);
      return;
    }
    setLogs((prev) => prev.map((l) => (l.id === todayLog.id ? { ...l, note: trimmed || null } : l)));
    setEditingNote(false);
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        {todayLog ? (
          <div className="flex items-center gap-1.5 font-medium text-success">
            <CheckCircle2 className="size-3.5" />
            Logged today
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLog}
            disabled={busy}
            className="flex items-center gap-1 font-medium text-primary transition-colors hover:underline disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            Log today
          </button>
        )}
        {todayLog && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setNoteDraft(todayLog.note ?? "");
                setEditingNote((v) => !v);
              }}
              aria-label="Add or edit a note"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleUnlog}
              disabled={busy}
              aria-label="Remove today's log"
              className="text-muted-foreground transition-colors hover:text-danger disabled:opacity-50"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {editingNote && todayLog && (
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={handleSaveNote}
          placeholder="How'd it go?"
          rows={2}
          autoFocus
          className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      )}
      {!editingNote && todayLog?.note && <p className="text-muted-foreground">{todayLog.note}</p>}

      {logs.length > 1 && <p className="text-muted-foreground">Logged {logs.length}×</p>}

      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
