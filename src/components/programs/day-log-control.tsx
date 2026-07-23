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

function formatLogDate(isoDate: string, today: string): string {
  if (isoDate === today) return "Today";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return isoDate;
  // Parsed and formatted as UTC so the displayed date always matches what
  // was stored, regardless of the viewer's own timezone offset.
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface DayLogControlProps {
  trainingDayId: string;
  athleteId: string;
  logs: SessionLog[];
}

/**
 * Every logged session for this day, each editable and deletable — not
 * just today's. A quick "Log today" add-on top when today isn't logged
 * yet. Deliberately not a full workout log (no per-set actual
 * weights/reps) — a session is either logged or it isn't, with an
 * optional free-text note, which is enough to close the loop on "did
 * this happen" without building a second parallel data model.
 */
export function DayLogControl({ trainingDayId, athleteId, logs: initialLogs }: DayLogControlProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

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
        <button
          type="button"
          onClick={handleLogToday}
          disabled={busyId === "new"}
          className="flex items-center gap-1 self-start font-medium text-primary transition-colors hover:underline disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Log today
        </button>
      )}

      {logs.length > 0 && (
        <ul className="flex flex-col gap-2">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-success">
                  <CheckCircle2 className="size-3.5" />
                  {formatLogDate(log.performed_on, today)}
                </span>
                <div className="flex items-center gap-2.5">
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
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
