"use client";

import { CheckCircle2, SkipForward, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { buildSetTargets } from "@/lib/training/sequence";
import { cn } from "@/lib/utils";
import type { BlockExerciseRow } from "@/lib/programs/types";

interface ExerciseListScreenProps {
  dayLabel: string;
  exercises: BlockExerciseRow[];
  currentExerciseId: string | null;
  resumeExerciseId: string | null;
  loggedSetCounts: Map<string, number>;
  skippedExerciseIds: ReadonlySet<string>;
  onSelect: (exerciseId: string) => void;
  onSkipExercise: (exerciseId: string) => void;
  onEndWorkout: () => void;
}

/**
 * Shown right after "Begin Workout," and reachable any time mid-workout via
 * the "All Exercises" button on the exercise/rest screens — every exercise
 * in today's session, tap any one to jump straight to it in either
 * direction. Exists specifically to make "these don't have to be done in
 * the listed order" obvious from the first moment, rather than something
 * only discoverable via a small link once already mid-set on exercise #1 —
 * added after athlete feedback that real gym order follows whatever
 * machine happens to be free, not the program's listed order.
 */
export function ExerciseListScreen({
  dayLabel,
  exercises,
  currentExerciseId,
  resumeExerciseId,
  loggedSetCounts,
  skippedExerciseIds,
  onSelect,
  onSkipExercise,
  onEndWorkout,
}: ExerciseListScreenProps) {
  const doneCount = exercises.filter((exercise) => {
    const targetCount = buildSetTargets(exercise.sets).length;
    return targetCount > 0 && (loggedSetCounts.get(exercise.id) ?? 0) >= targetCount;
  }).length;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1.5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{dayLabel}</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Today&rsquo;s Exercises</h1>
        <p className="text-sm text-muted-foreground">Tap any exercise to start it — do them in whatever order works for you.</p>
      </div>

      <ul className="flex flex-col gap-2">
        {exercises.map((exercise) => {
          const targetCount = buildSetTargets(exercise.sets).length;
          const logged = loggedSetCounts.get(exercise.id) ?? 0;
          const done = targetCount > 0 && logged >= targetCount;
          const skipped = !done && skippedExerciseIds.has(exercise.id);
          const isCurrent = exercise.id === currentExerciseId;
          const isUpNext = !done && !skipped && !isCurrent && exercise.id === resumeExerciseId;

          return (
            <li
              key={exercise.id}
              className={cn(
                "flex items-center gap-1 rounded-xl border transition-colors",
                isCurrent ? "border-primary bg-primary/5" : "border-border hover:border-border-strong hover:bg-surface-hover"
              )}
            >
              <button type="button" onClick={() => onSelect(exercise.id)} className="flex flex-1 items-center justify-between gap-3 px-4 py-3.5 text-left">
                <div className="flex flex-col gap-0.5">
                  <span className={cn("text-sm font-medium", skipped ? "text-muted-foreground" : "text-foreground")}>
                    {getExerciseDisplayName(exercise)}
                  </span>
                  {isCurrent && <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">In progress</span>}
                  {isUpNext && <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Up next</span>}
                </div>
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" />
                ) : skipped ? (
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">Skipped</span>
                ) : (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {logged}/{targetCount || 1} sets
                  </span>
                )}
              </button>
              {!done && !skipped && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkipExercise(exercise.id);
                  }}
                  aria-label={`Skip ${getExerciseDisplayName(exercise)}`}
                  title="Skip exercise"
                  className="mr-2 shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <SkipForward className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {doneCount} of {exercises.length} done
          {skippedExerciseIds.size > 0 && ` · ${skippedExerciseIds.size} skipped`}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onEndWorkout}
          className="border-danger/30 text-danger hover:border-danger hover:bg-danger/10"
        >
          <StopCircle className="size-3.5" />
          End Workout
        </Button>
      </div>
    </div>
  );
}
