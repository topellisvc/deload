"use client";

import { useMemo } from "react";
import { Clock3, Dumbbell, ListChecks, Tags } from "lucide-react";
import { estimateWorkoutDurationSeconds, formatEstimatedDuration } from "@/lib/training/estimate-duration";
import { EXERCISE_CATEGORY_ACTIVE_CLASSES, EXERCISE_CATEGORY_LABELS } from "@/lib/programs/prescription-types";
import type { BlockRow, ExerciseCategory } from "@/lib/programs/types";
import { cn } from "@/lib/utils";

interface WorkoutSummaryBarProps {
  blocks: BlockRow[];
}

/**
 * A live "what does this day actually add up to" strip at the top of every
 * training day — exercise count, total prescribed sets, an estimated
 * duration, and which categories are in play. Recomputed from `blocks` on
 * every render (useMemo just avoids redoing the walk when unrelated state
 * changes elsewhere in the builder), so it's always in sync with whatever
 * the coach just edited, no separate "recalculate" step.
 *
 * Reuses estimateWorkoutDurationSeconds/formatEstimatedDuration
 * (lib/training/estimate-duration.ts) — the exact same heuristic Training
 * Mode's Overview screen already shows the athlete, so the builder's
 * estimate and what the athlete eventually sees never quietly diverge.
 */
export function WorkoutSummaryBar({ blocks }: WorkoutSummaryBarProps) {
  const { exerciseCount, setCount, categories } = useMemo(() => {
    let exercises = 0;
    let sets = 0;
    const cats = new Set<ExerciseCategory>();
    for (const block of blocks) {
      for (const exercise of block.exercises) {
        exercises += 1;
        cats.add(exercise.exercise_category);
        for (const set of exercise.sets) sets += Math.max(1, set.sets);
      }
    }
    return { exerciseCount: exercises, setCount: sets, categories: Array.from(cats) };
  }, [blocks]);

  const estimatedSeconds = useMemo(() => estimateWorkoutDurationSeconds(blocks), [blocks]);

  if (exerciseCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Dumbbell className="size-3.5" />
        {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"}
      </span>
      <span className="flex items-center gap-1.5">
        <ListChecks className="size-3.5" />
        {setCount} {setCount === 1 ? "set" : "sets"}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock3 className="size-3.5" />
        {formatEstimatedDuration(estimatedSeconds)}
      </span>
      {categories.length > 0 && (
        <span className="flex items-center gap-1.5">
          <Tags className="size-3.5" />
          <span className="flex items-center gap-1">
            {categories.map((c) => (
              <span key={c} className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", EXERCISE_CATEGORY_ACTIVE_CLASSES[c])}>
                {EXERCISE_CATEGORY_LABELS[c]}
              </span>
            ))}
          </span>
        </span>
      )}
    </div>
  );
}
