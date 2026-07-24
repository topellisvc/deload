"use client";

import { AlertTriangle, Award, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BigTextField } from "@/components/training/big-fields";
import type { WorkoutTotals } from "@/lib/training/totals";

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours > 0) return `${hours}h ${remMinutes}m`;
  return `${remMinutes} min`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-surface px-3 py-3.5">
      <span className="text-xl font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

interface WorkoutSummaryScreenProps {
  dayLabel: string;
  durationSeconds: number;
  totals: WorkoutTotals;
  workoutNote: string;
  onWorkoutNoteChange: (text: string) => void;
  coachNotes: string[];
  onFinish: () => void;
  finishing: boolean;
  error: string | null;
}

/** The spec's Workout Completion screen — everything gets shown once, then
 * Finish Workout materializes it via lib/training/mutations.ts's
 * finishWorkout (a normal session_logs/logged_sets write, no different from
 * the manual "Log today" flow). */
export function WorkoutSummaryScreen({
  dayLabel,
  durationSeconds,
  totals,
  workoutNote,
  onWorkoutNoteChange,
  coachNotes,
  onFinish,
  finishing,
  error,
}: WorkoutSummaryScreenProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <CheckCircle2 className="size-14 text-success" />
        <h1 className="text-2xl font-bold text-foreground">Workout Complete</h1>
        <p className="text-sm text-muted-foreground">{dayLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Stat value={formatClock(durationSeconds)} label="Duration" />
        <Stat value={String(totals.exercisesCompleted)} label="Exercises" />
        <Stat value={String(totals.setsCompleted)} label="Sets" />
        {totals.totalVolumeKg > 0 && <Stat value={`${Math.round(totals.totalVolumeKg).toLocaleString()}kg`} label="Total Volume" />}
        {totals.totalDistanceMeters > 0 && <Stat value={`${(totals.totalDistanceMeters / 1000).toFixed(2)}km`} label="Distance" />}
        {totals.totalCalories > 0 && <Stat value={String(Math.round(totals.totalCalories))} label="Calories" />}
      </div>

      <BigTextField label="Workout Notes" value={workoutNote} onCommit={onWorkoutNoteChange} placeholder="How did the whole session go?" />

      {coachNotes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Award className="size-3.5" />
            Coach Notes
          </span>
          <ul className="flex flex-col gap-1">
            {coachNotes.map((note, i) => (
              <li key={i} className="text-sm italic text-foreground">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="flex gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}

      <Button size="lg" onClick={onFinish} disabled={finishing} className="h-14 text-base">
        {finishing ? "Saving…" : "Finish Workout"}
      </Button>
    </div>
  );
}
