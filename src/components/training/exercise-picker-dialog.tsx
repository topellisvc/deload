"use client";

import { CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { getExerciseDisplayName } from "@/lib/programs/exercise-catalog";
import { buildSetTargets } from "@/lib/training/sequence";
import { cn } from "@/lib/utils";
import type { BlockExerciseRow } from "@/lib/programs/types";

interface ExercisePickerDialogProps {
  open: boolean;
  onClose: () => void;
  exercises: BlockExerciseRow[];
  currentExerciseId: string | null;
  loggedSetCounts: Map<string, number>;
  onSelect: (exerciseId: string) => void;
}

/**
 * Lets the athlete jump straight to any exercise in the day, reachable from
 * both the exercise screen and the rest screen — added after feedback that
 * real gym order is dictated by whatever machine is free, not the
 * program's listed order. Picking a different exercise here doesn't lose
 * progress on the one left behind: every exercise's logged-set count is
 * tracked against its own id regardless of visit order (see
 * training-session.tsx), so hopping around and coming back later just
 * picks up wherever that exercise's own sets left off.
 */
export function ExercisePickerDialog({
  open,
  onClose,
  exercises,
  currentExerciseId,
  loggedSetCounts,
  onSelect,
}: ExercisePickerDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Jump to exercise" className="max-w-md">
      <ul className="flex flex-col gap-1.5">
        {exercises.map((exercise) => {
          const targetCount = buildSetTargets(exercise.sets).length;
          const logged = loggedSetCounts.get(exercise.id) ?? 0;
          const done = targetCount > 0 && logged >= targetCount;
          const isCurrent = exercise.id === currentExerciseId;
          return (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(exercise.id);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                  isCurrent ? "border-primary bg-primary/5" : "border-border hover:border-border-strong hover:bg-surface-hover"
                )}
              >
                <span className="text-sm font-medium text-foreground">{getExerciseDisplayName(exercise)}</span>
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {logged}/{targetCount || 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
