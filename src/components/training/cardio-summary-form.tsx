"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SetDetails } from "@/components/programs/set-details";
import { BigDistanceField, BigDurationField, BigNumberField, BigTextField } from "@/components/training/big-fields";
import type { PerformanceField } from "@/lib/programs/prescription-types";
import type { ExerciseCategory, SetPrescription } from "@/lib/programs/types";

interface CardioSummaryFormProps {
  exerciseName: string;
  category: ExerciseCategory;
  target: SetPrescription;
  fields: PerformanceField[];
  onFinish: (payload: {
    distanceMeters: number | null;
    durationSeconds: number | null;
    paceSecondsPerKm: number | null;
    heartRate: number | null;
    calories: number | null;
    rpe: number | null;
    notes: string | null;
  }) => void;
  busy: boolean;
}

/**
 * "Cardio workouts should display a summary form instead of individual
 * sets where appropriate" — one form for the whole exercise rather than the
 * strength per-set stepper, fields entirely driven by performanceFields
 * (lib/programs/prescription-types.ts) so a plain 'distance' running row
 * doesn't ask for calories, a cardio 'calories' row doesn't ask for pace,
 * etc. Shared between running and cardio categories since both draw from
 * the same field vocabulary.
 */
export function CardioSummaryForm({ exerciseName, category, target, fields, onFinish, busy }: CardioSummaryFormProps) {
  const set = new Set(fields);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [paceSecondsPerKm, setPaceSecondsPerKm] = useState<number | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [calories, setCalories] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-xl font-bold text-foreground">{exerciseName}</h2>

      <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prescription</span>
        <SetDetails set={target} category={category} />
      </div>

      <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-4">
        {set.has("duration") && <BigDurationField label="Duration" value={durationSeconds} onChange={setDurationSeconds} />}
        {set.has("distance") && <BigDistanceField label="Distance" value={distanceMeters} onChange={setDistanceMeters} />}
        {set.has("pace") && <BigDurationField label="Avg Pace /km" value={paceSecondsPerKm} onChange={setPaceSecondsPerKm} />}
        {set.has("heart_rate") && <BigNumberField label="Avg HR" unit="bpm" value={heartRate} onChange={setHeartRate} step={5} placeholder="—" />}
        {set.has("calories") && <BigNumberField label="Calories" value={calories} onChange={setCalories} step={5} placeholder="—" />}
        {set.has("rpe") && <BigNumberField label="RPE" value={rpe} onChange={setRpe} step={0.5} min={1} placeholder="—" />}
      </div>

      {set.has("notes") && <BigTextField label="Notes" value={notes} onCommit={setNotes} placeholder="How did that feel?" />}

      <Button
        size="lg"
        disabled={busy}
        onClick={() =>
          onFinish({
            distanceMeters,
            durationSeconds,
            paceSecondsPerKm,
            heartRate,
            calories,
            rpe,
            notes: notes.trim() || null,
          })
        }
        className="h-14 text-base"
      >
        {busy ? "Saving…" : "Finish Exercise"}
      </Button>
    </div>
  );
}
