import { describe, expect, it } from "vitest";
import { estimateWorkoutDurationSeconds, formatEstimatedDuration } from "./estimate-duration";
import type { BlockRow, SetPrescription } from "@/lib/programs/types";

function makeSet(overrides: Partial<SetPrescription> & Pick<SetPrescription, "id" | "block_exercise_id" | "position">): SetPrescription {
  return {
    prescription_type: "fixed_weight",
    sets: 1,
    reps: null,
    min_reps: null,
    max_reps: null,
    weight_value: null,
    percent_1rm_value: null,
    pr_record_type: null,
    rpe_value: null,
    rir_value: null,
    heart_rate_zone: null,
    calories: null,
    rest_seconds: null,
    notes: null,
    distance_meters: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    ...overrides,
  };
}

function makeBlocks(sets: SetPrescription[], category: "strength" | "running" | "cardio" = "strength"): BlockRow[] {
  return [
    {
      id: "block-1",
      day_id: "day-1",
      position: 1,
      block_type: "straight",
      rounds: 1,
      exercises: [
        { id: "ex-1", block_id: "block-1", position: 1, exercise_id: "a", custom_name: null, notes: null, exercise_category: category, sets },
      ],
    },
  ];
}

describe("estimateWorkoutDurationSeconds", () => {
  it("sums work + rest across every prescribed strength set", () => {
    const blocks = makeBlocks([makeSet({ id: "s1", block_exercise_id: "ex-1", position: 1, sets: 4, rest_seconds: 90 })]);
    // 4 sets * (40s work + 90s rest) = 520s
    expect(estimateWorkoutDurationSeconds(blocks)).toBe(4 * (40 + 90));
  });

  it("falls back to a default rest when a set has none", () => {
    const blocks = makeBlocks([makeSet({ id: "s1", block_exercise_id: "ex-1", position: 1, sets: 1, rest_seconds: null })]);
    expect(estimateWorkoutDurationSeconds(blocks)).toBe(40 + 60);
  });

  it("uses a cardio row's own duration_seconds instead of the strength heuristic", () => {
    const blocks = makeBlocks(
      [makeSet({ id: "s1", block_exercise_id: "ex-1", position: 1, sets: 1, duration_seconds: 1200, rest_seconds: 0 })],
      "cardio"
    );
    expect(estimateWorkoutDurationSeconds(blocks)).toBe(1200);
  });

  it("returns 0 for a day with no exercises", () => {
    expect(estimateWorkoutDurationSeconds([])).toBe(0);
  });
});

describe("formatEstimatedDuration", () => {
  it("formats sub-hour durations as minutes", () => {
    expect(formatEstimatedDuration(35 * 60)).toBe("~35 min");
  });

  it("rounds up to at least 1 minute", () => {
    expect(formatEstimatedDuration(10)).toBe("~1 min");
  });

  it("formats hour-plus durations with minutes", () => {
    expect(formatEstimatedDuration(75 * 60)).toBe("~1h 15m");
    expect(formatEstimatedDuration(60 * 60)).toBe("~1h");
  });
});
