import type { DraftSet } from "@/lib/training/types";

export interface WorkoutTotals {
  setsCompleted: number;
  exercisesCompleted: number;
  /** Sum of weight × reps across every strength set that logged both — the
   * standard "tonnage" figure, not adjusted for exercise or rep range. */
  totalVolumeKg: number;
  totalDistanceMeters: number;
  totalCalories: number;
}

/** Pure aggregation for the Workout Summary screen — kept separate from any
 * component so it's independently testable and reusable if a totals figure
 * is ever needed elsewhere (e.g. a future "this week's volume" stat). */
export function computeWorkoutTotals(draftSets: DraftSet[]): WorkoutTotals {
  let totalVolumeKg = 0;
  let totalDistanceMeters = 0;
  let totalCalories = 0;
  const exercisesWithSets = new Set<string>();

  for (const s of draftSets) {
    exercisesWithSets.add(s.blockExerciseId);
    if (s.performedWeight != null && s.performedReps != null) {
      totalVolumeKg += s.performedWeight * s.performedReps;
    }
    if (s.performedDistanceMeters != null) totalDistanceMeters += s.performedDistanceMeters;
    if (s.performedCalories != null) totalCalories += s.performedCalories;
  }

  return {
    setsCompleted: draftSets.length,
    exercisesCompleted: exercisesWithSets.size,
    totalVolumeKg,
    totalDistanceMeters,
    totalCalories,
  };
}
