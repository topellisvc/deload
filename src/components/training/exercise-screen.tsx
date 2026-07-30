"use client";

import { ListOrdered, MessageSquareText, PersonStanding, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetDetails } from "@/components/programs/set-details";
import { WorkoutProgressBar } from "@/components/training/workout-progress-bar";
import { PreviousPerformanceCard } from "@/components/training/previous-performance-card";
import { StrengthSetLogger, type LastSetValues } from "@/components/training/strength-set-logger";
import { CardioSummaryForm } from "@/components/training/cardio-summary-form";
import { BigTextField } from "@/components/training/big-fields";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { exerciseMaxRecordType, getPrescriptionTypeDef, suggestedWeightFromPercent1RM } from "@/lib/programs/prescription-types";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/programs/prescription-types";
import { buildSetTargets } from "@/lib/training/sequence";
import type { BlockExerciseRow } from "@/lib/programs/types";
import type { DraftSet, PreviousPerformance } from "@/lib/training/types";
import type { PersonalRecord } from "@/lib/supabase/types";

interface ExerciseScreenProps {
  exercise: BlockExerciseRow;
  exerciseIndex: number;
  totalExercises: number;
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
  onOpenExerciseList: () => void;
  onSkipExercise: () => void;
  onEndWorkout: () => void;
  busy: boolean;
}

/**
 * One exercise, currently active in the guided flow — everything the
 * spec's "Exercise Layout" section lists (name, category, prescription,
 * rest time, coach notes, previous performance) above the logging
 * interface itself, which branches on category: a per-set stepper for
 * strength (StrengthSetLogger) or a single summary form for
 * running/cardio (CardioSummaryForm).
 */
export function ExerciseScreen({
  exercise,
  exerciseIndex,
  totalExercises,
  loggedSetCount,
  draftSets,
  personalRecords,
  previous,
  exerciseNote,
  onExerciseNoteChange,
  onCompleteSet,
  onCardioFinish,
  onOpenExerciseList,
  onSkipExercise,
  onEndWorkout,
  busy,
}: ExerciseScreenProps) {
  const category = exercise.exercise_category;
  const exerciseName = getExerciseDisplayName(exercise);
  // "Tap an exercise name to open the Exercise Detail page" (spec) — only
  // real Exercise Library rows (exercise_id set) have a detail page to
  // link to; a plain custom_name has nothing to tap through to.
  const exerciseHref = exercise.exercise_id ? `/exercises/${exercise.exercise_id}` : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-8">
      <WorkoutProgressBar currentIndex={exerciseIndex} total={totalExercises} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={onOpenExerciseList}>
          <ListOrdered className="size-3.5" />
          All Exercises
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSkipExercise} className="text-muted-foreground hover:text-foreground">
            <SkipForward className="size-3.5" />
            Skip
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEndWorkout}
            className="border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
          >
            End Workout
          </Button>
        </div>
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
          exerciseHref={exerciseHref}
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
          exerciseHref={exerciseHref}
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
  exerciseHref,
  loggedSetCount,
  draftSets,
  personalRecords,
  onCompleteSet,
  busy,
}: {
  exercise: BlockExerciseRow;
  exerciseName: string;
  exerciseHref: string | null;
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
  if (target.prescription_type === "percent_1rm" && target.percent_1rm_value != null) {
    // Same pr_record_type-or-own-exercise-history fallback as
    // exercise-performance-card.tsx — see exerciseMaxRecordType's doc
    // comment.
    const recordType = target.pr_record_type ?? exerciseMaxRecordType(exercise.exercise_id ?? "");
    const pr = personalRecords.find((r) => r.record_type === recordType);
    suggestedWeight = suggestedWeightFromPercent1RM(target.percent_1rm_value, pr?.value_number ?? null);
  }

  const exerciseDraftSets = draftSets.filter((s) => s.blockExerciseId === exercise.id).sort((a, b) => a.position - b.position);
  const lastDraftSet = exerciseDraftSets[exerciseDraftSets.length - 1];
  const lastSet: LastSetValues | null = lastDraftSet ? { weight: lastDraftSet.performedWeight, reps: lastDraftSet.performedReps } : null;

  return (
    <StrengthSetLogger
      key={`${target.id}-${loggedSetCount}`}
      exerciseName={exerciseName}
      exerciseHref={exerciseHref}
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
