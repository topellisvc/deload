"use client";

import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getExerciseHistoryForAthlete } from "@/lib/exercises/queries";
import type { Exercise, ExerciseHistoryForAthlete } from "@/lib/exercises/types";
import { formatLogDate, todayDateString } from "@/lib/dates";
import { Input } from "@/components/ui/input";

/**
 * "For coaches viewing an athlete, show Last Performed, Previous Loads,
 * Estimated 1RM, Recent Notes. Should help coaches make programming
 * decisions" (spec) — a focused per-exercise lookup rather than folded
 * into the existing full workout-history list (ClientHistorySection),
 * which is organized by session/date, not by exercise. Search is
 * client-side over the already-fetched library (same instant-filter
 * approach as the Exercise Library's own list page) since this is a
 * lookup a coach reaches for mid-conversation with an athlete, not
 * something worth a network round trip per keystroke.
 */
export function ExerciseHistoryLookup({ athleteId, exercises }: { athleteId: string; exercises: Exercise[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<ExerciseHistoryForAthlete | null>(null);
  const [loading, setLoading] = useState(false);

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return exercises.filter((e) => e.name.toLowerCase().includes(trimmed)).slice(0, 8);
  }, [query, exercises]);

  async function handleSelect(exercise: Exercise) {
    setSelected(exercise);
    setQuery("");
    setLoading(true);
    const supabase = createClient();
    const result = await getExerciseHistoryForAthlete(supabase, athleteId, exercise.id);
    setHistory(result);
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <History className="size-3.5" />
        Exercise history
      </h2>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Look up an exercise…"
          aria-label="Search this athlete's exercise history"
          className="pl-11"
        />
        {matches.length > 0 && (
          <ul className="absolute left-0 top-full z-10 mt-1 w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            {matches.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(exercise)}
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
                >
                  {exercise.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="mt-4 flex flex-col gap-3">
          <span className="text-sm font-semibold text-foreground">{selected.name}</span>
          {loading ? (
            <span className="text-sm text-muted-foreground">Loading…</span>
          ) : !history || (!history.lastPerformed && history.recentEntries.length === 0) ? (
            <span className="text-sm text-muted-foreground">No logged history for this exercise yet.</span>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Last Performed" value={history.lastPerformed ? formatLogDate(history.lastPerformed, todayDateString()) : "—"} />
                <Stat label="Estimated 1RM" value={history.estimated1RM ? `${history.estimated1RM}kg` : "—"} />
                <Stat label="Sessions Logged" value={String(history.recentEntries.length)} />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Previous Loads</span>
                <ul className="flex flex-col gap-2">
                  {history.recentEntries.map((entry) => (
                    <li key={entry.performedOn} className="rounded-xl bg-muted/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{formatLogDate(entry.performedOn, todayDateString())}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.sets
                            .map((s) => [s.weight != null ? `${s.weight}kg` : null, s.reps != null ? `×${s.reps}` : null].filter(Boolean).join(" "))
                            .filter(Boolean)
                            .join(", ") || "Logged"}
                        </span>
                      </div>
                      {entry.notes && <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{entry.notes}&rdquo;</p>}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/40 p-3 text-center">
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
