"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SetDetails } from "@/components/programs/set-details";
import { BigNumberField, BigTextField } from "@/components/training/big-fields";
import type { SetPrescription } from "@/lib/programs/types";

interface StrengthSetLoggerProps {
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  target: SetPrescription;
  suggestedWeight: number | null;
  onComplete: (payload: { weight: number | null; reps: number | null; rpe: number | null; notes: string | null }) => void;
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
 * "Bench Press / Set 2 of 4 / Target: 100kg × 6 / Input: Weight, Reps,
 * Optional RPE / Complete Set" — the spec's Set Workflow example, verbatim.
 * The Prescription's own read-only card sits above this (in ExerciseScreen);
 * this component is only the "Target" reminder plus the actual input, kept
 * separate so it can be remounted (via `key`) fresh for every set.
 */
export function StrengthSetLogger({ exerciseName, setNumber, totalSets, target, suggestedWeight, onComplete, busy }: StrengthSetLoggerProps) {
  const [weight, setWeight] = useState<number | null>(() => defaultWeight(target, suggestedWeight));
  const [reps, setReps] = useState<number | null>(() => defaultReps(target));
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    setWeight(defaultWeight(target, suggestedWeight));
    setReps(defaultReps(target));
    setRpe(null);
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
        <BigNumberField label="RPE" value={rpe} onChange={setRpe} step={0.5} min={1} placeholder="—" />
      </div>

      {showNotes ? (
        <BigTextField label="Notes" value={notes} onCommit={setNotes} placeholder="How did that set feel?" />
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          + Add a note
        </button>
      )}

      <Button
        size="lg"
        disabled={busy}
        onClick={() => onComplete({ weight, reps, rpe, notes: notes.trim() || null })}
        className="h-14 text-base"
      >
        {busy ? "Saving…" : "Complete Set"}
      </Button>
    </div>
  );
}
