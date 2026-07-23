"use client";

import { useState } from "react";
import { Plus, PersonStanding } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createLoggedSet, deleteLoggedSet, updateLoggedSet } from "@/lib/logging/mutations";
import { getPrescriptionTypeDef, suggestedWeightFromPercent1RM } from "@/lib/programs/prescription-types";
import type { BlockExerciseRow, LoggedSet } from "@/lib/programs/types";
import type { PersonalRecord } from "@/lib/supabase/types";
import { SetDetails } from "@/components/programs/set-details";
import { PerformanceRowEditor } from "@/components/programs/performance-row-editor";

interface ExercisePerformanceCardProps {
  sessionLogId: string;
  exercise: BlockExerciseRow;
  loggedSets: LoggedSet[];
  /** The athlete's current 1RMs — used to prefill a suggested working
   * weight when logging a set against a percent_1rm prescription (spec:
   * "calculate a suggested working weight... remain editable"). */
  personalRecords: PersonalRecord[];
  /** Only used by Coach Review (readOnly mode) so a re-fetch isn't needed
   * when a parent list needs to know the current set — the editable path
   * manages its own state internally since only the logging athlete can
   * write here anyway (RLS-enforced). */
  onLoggedSetsChange?: (next: LoggedSet[]) => void;
  readOnly?: boolean;
}

/**
 * One exercise within a logged session, showing the Prescription (what was
 * planned, read-only, reusing SetDetails so it's byte-for-byte the same
 * formatting as the program view) directly above the Performance section
 * (what was actually done) — the spec's "always two clearly separated
 * sections" requirement. The same component renders both the athlete's
 * editable logging view and (via `readOnly`) the coach's Planned vs
 * Performed comparison, so the two never drift apart.
 */
export function ExercisePerformanceCard({
  sessionLogId,
  exercise,
  loggedSets: initialLoggedSets,
  personalRecords,
  onLoggedSetsChange,
  readOnly,
}: ExercisePerformanceCardProps) {
  const [loggedSets, setLoggedSets] = useState(initialLoggedSets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = exercise.exercise_category;
  // Prescription type is treated as one setting per exercise everywhere
  // else in the app (see ExerciseBlockCard's picker) — same assumption
  // here: every set on this exercise shares it, so the first row's type is
  // enough to know which performance fields make sense to show.
  const prescriptionType = exercise.sets[0]?.prescription_type;
  const performanceFields = prescriptionType ? getPrescriptionTypeDef(category, prescriptionType)?.performanceFields ?? [] : [];

  function applyChange(next: LoggedSet[]) {
    setLoggedSets(next);
    onLoggedSetsChange?.(next);
  }

  async function handleAddSet() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const position = loggedSets.reduce((max, s) => Math.max(max, s.position), 0) + 1;
    // Best-effort provenance only: link to the prescription row at the same
    // position when one exists, so a coach reviewing later can still trace
    // "this logged set corresponds to that planned row" — but never
    // required, since the athlete can log more or fewer sets than planned.
    const matchingSet = exercise.sets[position - 1] ?? exercise.sets[0] ?? null;
    const setPrescriptionId = matchingSet?.id ?? null;

    // Prefill a suggested working weight for percent_1rm prescriptions —
    // computed fresh from the athlete's *current* PR, never persisted on
    // the prescription itself (see suggestedWeightFromPercent1RM). Still
    // fully editable immediately after: this only sets the starting value
    // of the field the athlete logs into.
    let performedWeight: number | null = null;
    if (matchingSet?.prescription_type === "percent_1rm" && matchingSet.percent_1rm_value != null && matchingSet.pr_record_type) {
      const pr = personalRecords.find((r) => r.record_type === matchingSet.pr_record_type);
      performedWeight = suggestedWeightFromPercent1RM(matchingSet.percent_1rm_value, pr?.value_number ?? null);
    }

    const { log, error: createError } = await createLoggedSet(supabase, {
      sessionLogId,
      blockExerciseId: exercise.id,
      setPrescriptionId,
      position,
      performedWeight,
    });
    setBusy(false);
    if (createError || !log) {
      setError(createError ?? "Couldn't log that set.");
      return;
    }
    applyChange([...loggedSets, log]);
  }

  async function handleChange(logId: string, patch: Partial<LoggedSet>) {
    // Optimistic — a workout log is low-stakes enough that rolling back a
    // failed save isn't worth the flicker; the error banner below is
    // enough to tell the athlete to retry.
    applyChange(loggedSets.map((l) => (l.id === logId ? { ...l, ...patch } : l)));
    const supabase = createClient();
    const { error: updateError } = await updateLoggedSet(supabase, logId, patch);
    if (updateError) setError(updateError);
  }

  async function handleDelete(logId: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await deleteLoggedSet(supabase, logId);
    setBusy(false);
    if (deleteError) {
      setError(deleteError);
      return;
    }
    applyChange(loggedSets.filter((l) => l.id !== logId));
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-3.5">
      <div className="flex items-center gap-1.5">
        {category !== "strength" && <PersonStanding className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="text-sm font-medium text-foreground">{exercise.custom_name || exercise.exercise_id}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prescription</span>
        <ul className="flex flex-col gap-1 pl-0.5">
          {exercise.sets.map((set) => (
            <li key={set.id}>
              <SetDetails set={set} category={category} />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border/70 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Performance</span>

        {loggedSets.length === 0 && (
          <p className="text-xs italic text-muted-foreground">{readOnly ? "Not logged." : "Nothing logged yet."}</p>
        )}

        {loggedSets.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {loggedSets.map((ls) => (
              <li key={ls.id}>
                <PerformanceRowEditor
                  fields={performanceFields}
                  loggedSet={ls}
                  onChange={(patch) => handleChange(ls.id, patch)}
                  onDelete={() => handleDelete(ls.id)}
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddSet}
            disabled={busy}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-primary transition-colors hover:underline disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            Log a set
          </button>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}
