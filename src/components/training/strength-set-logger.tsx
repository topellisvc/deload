"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetDetails } from "@/components/programs/set-details";
import { BigNumberField, BigTextField } from "@/components/training/big-fields";
import type { SetPrescription } from "@/lib/programs/types";

export interface LastSetValues {
  weight: number | null;
  reps: number | null;
}

interface StrengthSetLoggerProps {
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  target: SetPrescription;
  suggestedWeight: number | null;
  /** The athlete's own previous set on this exercise, if one's already been
   * logged this workout — powers "Same as Last Set" (spec: "mark a set to
   * be the same as the last set"). Null for the first set of an exercise. */
  lastSet: LastSetValues | null;
  onComplete: (payload: { weight: number | null; reps: number | null; notes: string | null }) => void;
  busy: boolean;
}

/** Prefilled starting values for a fresh set — the athlete's own last input
 * for *this* prescription row (fixed_weight or the percent_1rm suggestion)
 * where one exists, otherwise blank. Never overwrites what the athlete has
 * already typed once they start editing (see the key={target.id} reset in
 * the parent, which remounts this per set rather than trying to diff). */
function defaultWeight(target: SetPrescription, suggestedWeight: number | null): number | null {
  if (target.prescription_type === "fixed_weight") return target.weight_value;
  if (target.prescription_type === "percent_1rm") return suggestedWeight;
  return null;
}

function defaultReps(target: SetPrescription): number | null {
  if (target.reps && /^\d+$/.test(target.reps.trim())) return Number(target.reps);
  if (target.min_reps != null && target.max_reps != null) return target.max_reps;
  return null;
}

/**
 * "Bench Press / Set 2 of 4 / Target: 100kg × 6 / Input: Weight, Reps /
 * Complete Set" — the spec's Set Workflow example. No RPE input: logging
 * what actually happened only needs weight and reps, and skipping RPE
 * keeps each set to two taps instead of three. (RPE stays available in the
 * desktop Coach Review / logging table for anyone who wants it there —
 * this is Training Mode's own, deliberately narrower, input.)
 */
export function StrengthSetLogger({ exerciseName, setNumber, totalSets, target, suggestedWeight, lastSet, onComplete, busy }: StrengthSetLoggerProps) {
  const [weight, setWeight] = useState<number | null>(() => defaultWeight(target, suggestedWeight));
  const [reps, setReps] = useState<number | null>(() => defaultReps(target));
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    setWeight(defaultWeight(target, suggestedWeight));
    setReps(defaultReps(target));
    setNotes("");
    setShowNotes(false);
  }, [target, suggestedWeight]);

  const showWeight = target.prescription_type !== "coach_notes_only";

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{exerciseName}</h2>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          Set {setNumber} of {totalSets}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Target</span>
        <SetDetails set={target} category="strength" />
      </div>

      <div className="flex flex-wrap items-start justify-center gap-6">
        {showWeight && <BigNumberField label="Weight" unit="kg" value={weight} onChange={setWeight} step={2.5} autoFocus />}
        <BigNumberField label="Reps" value={reps} onChange={setReps} step={1} autoFocus={!showWeight} />
      </div>

      {showNotes ? (
        <BigTextField label="Notes" value={notes} onCommit={setNotes} placeholder="How did that set feel?" />
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          + Add a note
        </button>
      )}

      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={busy} onClick={() => onComplete({ weight, reps, notes: notes.trim() || null })} className="h-14 text-base">
          {busy ? "Saving…" : "Complete Set"}
        </Button>

        {lastSet && (lastSet.weight != null || lastSet.reps != null) && (
          <Button
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={() => onComplete({ weight: lastSet.weight, reps: lastSet.reps, notes: null })}
            className="h-12 text-sm"
          >
            <Copy className="size-4" />
            Same as Last Set{lastSet.weight != null && lastSet.reps != null ? ` — ${lastSet.weight}kg × ${lastSet.reps}` : ""}
          </Button>
        )}
      </div>
    </div>
  );
}
