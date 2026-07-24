"use client";

import { MessageSquareText, PersonStanding } from "lucide-react";
import { SetDetails } from "@/components/programs/set-details";
import { WorkoutProgressBar } from "@/components/training/workout-progress-bar";
import { PreviousPerformanceCard } from "@/components/training/previous-performance-card";
import { StrengthSetLogger, type LastSetValues } from "@/components/training/strength-set-logger";
import { CardioSummaryForm } from "@/components/training/cardio-summary-form";
import { BigTextField } from "@/components/training/big-fields";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { getPrescriptionTypeDef, suggestedWeightFromPercent1RM } from "@/lib/programs/prescription-types";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/programs/prescription-types";
import { buildSetTargets } from "@/lib/training/sequence";
import type { DraftSet, ExerciseStep, PreviousPerformance } from "@/lib/training/types";
import type { PersonalRecord } from "@/lib/supabase/types";

interface ExerciseScreenProps {
  step: ExerciseStep;
  stepIndex: number;
  totalSteps: number;
  loggedSetCount: number;
  draftSets: DraftSet[];
  personalRecords: PersonalRecord[];
  previous: PreviousPerformance | undefined;
  exerciseNote: string;
  onExerciseNoteChange: (text: string) => void;
  onCompleteSet: (payload: { weight: number | null; reps: number | null; notes: string | null }) => void;
  onCardioFinish: (payload: {
    distanceMeters: number | null;
    durationSeconds: number | null;
    paceSecondsPerKm: number | null;
    heartRate: number | null;
    calories: number | null;
    rpe: number | null;
    notes: string | null;
  }) => void;
  onSkipWorkout: () => void;
  busy: boolean;
}

/**
 * One exercise's turn in the guided flow — everything the spec's "Exercise
 * Layout" section lists (name, category, prescription, rest time, coach
 * notes, previous performance) above the logging interface itself, which
 * branches on category: a per-set stepper for strength (StrengthSetLogger)
 * or a single summary form for running/cardio (CardioSummaryForm).
 */
export function ExerciseScreen({
  step,
  stepIndex,
  totalSteps,
  loggedSetCount,
  draftSets,
  personalRecords,
  previous,
  exerciseNote,
  onExerciseNoteChange,
  onCompleteSet,
  onCardioFinish,
  onSkipWorkout,
  busy,
}: ExerciseScreenProps) {
  const exercise = step.blockExercise;
  const category = exercise.exercise_category;
  const exerciseName = getExerciseDisplayName(exercise);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 px-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <WorkoutProgressBar currentIndex={stepIndex} total={totalSteps} />
        <button
          type="button"
          onClick={onSkipWorkout}
          className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Skip Workout
        </button>
      </div>

      <div className="flex items-center gap-2">
        {category !== "strength" && <PersonStanding className="size-4 text-muted-foreground" />}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{EXERCISE_CATEGORY_LABELS[category]}</span>
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-4">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prescription</span>
        <ul className="flex flex-col gap-1">
          {exercise.sets.map((set) => (
            <li key={set.id}>
              <SetDetails set={set} category={category} />
            </li>
          ))}
        </ul>
      </div>

      {exercise.notes && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm italic text-foreground">{exercise.notes}</p>
        </div>
      )}

      {previous && <PreviousPerformanceCard previous={previous} category={category} />}

      {category === "strength" ? (
        <StrengthLoggerSlot
          key={exercise.id}
          exercise={exercise}
          exerciseName={exerciseName}
          loggedSetCount={loggedSetCount}
          draftSets={draftSets}
          personalRecords={personalRecords}
          onCompleteSet={onCompleteSet}
          busy={busy}
        />
      ) : (
        <CardioSummaryForm
          key={exercise.id}
          exerciseName={exerciseName}
          category={category}
          target={exercise.sets[0]!}
          fields={getPrescriptionTypeDef(category, exercise.sets[0]!.prescription_type)?.performanceFields ?? []}
          onFinish={onCardioFinish}
          busy={busy}
        />
      )}

      <BigTextField label="Exercise Notes" value={exerciseNote} onCommit={onExerciseNoteChange} placeholder="e.g. Left shoulder felt tight." />
    </div>
  );
}

function StrengthLoggerSlot({
  exercise,
  exerciseName,
  loggedSetCount,
  draftSets,
  personalRecords,
  onCompleteSet,
  busy,
}: {
  exercise: ExerciseStep["blockExercise"];
  exerciseName: string;
  loggedSetCount: number;
  draftSets: DraftSet[];
  personalRecords: PersonalRecord[];
  onCompleteSet: ExerciseScreenProps["onCompleteSet"];
  busy: boolean;
}) {
  const targets = buildSetTargets(exercise.sets);
  const target = targets[loggedSetCount] ?? targets[targets.length - 1];
  if (!target) return null;

  let suggestedWeight: number | null = null;
  if (target.prescription_type === "percent_1rm" && target.percent_1rm_value != null && target.pr_record_type) {
    const pr = personalRecords.find((r) => r.record_type === target.pr_record_type);
    suggestedWeight = suggestedWeightFromPercent1RM(target.percent_1rm_value, pr?.value_number ?? null);
  }

  const exerciseDraftSets = draftSets.filter((s) => s.blockExerciseId === exercise.id).sort((a, b) => a.position - b.position);
  const lastDraftSet = exerciseDraftSets[exerciseDraftSets.length - 1];
  const lastSet: LastSetValues | null = lastDraftSet ? { weight: lastDraftSet.performedWeight, reps: lastDraftSet.performedReps } : null;

  return (
    <StrengthSetLogger
      key={`${target.id}-${loggedSetCount}`}
      exerciseName={exerciseName}
      setNumber={loggedSetCount + 1}
      totalSets={targets.length}
      target={target}
      suggestedWeight={suggestedWeight}
      lastSet={lastSet}
      onComplete={onCompleteSet}
      busy={busy}
    />
  );
}
