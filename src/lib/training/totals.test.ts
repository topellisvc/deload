import { describe, expect, it } from "vitest";
import { computeWorkoutTotals } from "./totals";
import type { DraftSet } from "./types";

function makeDraftSet(overrides: Partial<DraftSet> & Pick<DraftSet, "blockExerciseId" | "position">): DraftSet {
  return {
    setPrescriptionId: null,
    performedWeight: null,
    performedReps: null,
    performedRpe: null,
    performedDistanceMeters: null,
    performedDurationSeconds: null,
    performedPaceSecondsPerKm: null,
    performedHeartRate: null,
    performedCalories: null,
    notes: null,
    ...overrides,
  };
}

describe("computeWorkoutTotals", () => {
  it("sums weight x reps across strength sets into total volume", () => {
    const totals = computeWorkoutTotals([
      makeDraftSet({ blockExerciseId: "ex-1", position: 1, performedWeight: 100, performedReps: 6 }),
      makeDraftSet({ blockExerciseId: "ex-1", position: 2, performedWeight: 100, performedReps: 5 }),
    ]);
    expect(totals.totalVolumeKg).toBe(1100);
    expect(totals.setsCompleted).toBe(2);
    expect(totals.exercisesCompleted).toBe(1);
  });

  it("ignores a set missing either weight or reps for volume, but still counts it", () => {
    const totals = computeWorkoutTotals([makeDraftSet({ blockExerciseId: "ex-1", position: 1, performedReps: 8 })]);
    expect(totals.totalVolumeKg).toBe(0);
    expect(totals.setsCompleted).toBe(1);
  });

  it("sums distance and calories across cardio/running entries", () => {
    const totals = computeWorkoutTotals([
      makeDraftSet({ blockExerciseId: "ex-1", position: 1, performedDistanceMeters: 5000, performedCalories: 300 }),
      makeDraftSet({ blockExerciseId: "ex-2", position: 1, performedDistanceMeters: 2000, performedCalories: 120 }),
    ]);
    expect(totals.totalDistanceMeters).toBe(7000);
    expect(totals.totalCalories).toBe(420);
    expect(totals.exercisesCompleted).toBe(2);
  });

  it("returns all-zero totals for an empty workout", () => {
    const totals = computeWorkoutTotals([]);
    expect(totals).toEqual({ setsCompleted: 0, exercisesCompleted: 0, totalVolumeKg: 0, totalDistanceMeters: 0, totalCalories: 0 });
  });
});
