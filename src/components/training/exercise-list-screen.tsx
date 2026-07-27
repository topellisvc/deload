"use client";

import { CheckCircle2, SkipForward } from "lucide-react";
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
  onSelect: (exerciseId: string) => void;
  onSkipWorkout: () => void;
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
  onSelect,
  onSkipWorkout,
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
          const isCurrent = exercise.id === currentExerciseId;
          const isUpNext = !done && !isCurrent && exercise.id === resumeExerciseId;

          return (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => onSelect(exercise.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
                  isCurrent ? "border-primary bg-primary/5" : "border-border hover:border-border-strong hover:bg-surface-hover"
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{getExerciseDisplayName(exercise)}</span>
                  {isCurrent && <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">In progress</span>}
                  {isUpNext && <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Up next</span>}
                </div>
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" />
                ) : (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {logged}/{targetCount || 1} sets
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {doneCount} of {exercises.length} done
        </span>
        <Button variant="ghost" size="sm" onClick={onSkipWorkout} className="text-muted-foreground">
          <SkipForward className="size-3.5" />
          Skip Workout
        </Button>
      </div>
    </div>
  );
}
