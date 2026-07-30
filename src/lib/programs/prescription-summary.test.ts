import { describe, expect, it } from "vitest";
import { summarizePrescriptionPrimary, summarizeRest } from "./prescription-summary";
import type { SetRow } from "@/lib/programs/types";

function makeSet(overrides: Partial<SetRow> = {}): SetRow {
  return {
    id: "set-1",
    block_exercise_id: "ex-1",
    position: 1,
    prescription_type: "fixed_weight",
    sets: 4,
    reps: "6",
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
    advanced_config: null,
    ...overrides,
  };
}

describe("summarizePrescriptionPrimary", () => {
  it("formats fixed_weight as the spec's own example", () => {
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "fixed_weight", sets: 4, reps: "6", weight_value: 100 }), "strength")).toBe(
      "4 × 6 @ 100kg"
    );
  });

  it("formats percent_1rm using a % sign, matching the spec's '4 x 6 @ 80%' example", () => {
    expect(
      summarizePrescriptionPrimary(makeSet({ prescription_type: "percent_1rm", sets: 4, reps: "6", percent_1rm_value: 80 }), "strength")
    ).toBe("4 × 6 @ 80%");
  });

  it("formats rpe and rir", () => {
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "rpe", rpe_value: 8 }), "strength")).toContain("RPE 8");
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "rir", rir_value: 2 }), "strength")).toContain("2 RIR");
  });

  it("formats a rep range", () => {
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "rep_range", sets: 3, min_reps: 6, max_reps: 8 }), "strength")).toBe(
      "3 × 6–8 reps"
    );
  });

  it("falls back to a dash for coach_notes_only with no notes yet, and quotes the note once one exists", () => {
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "coach_notes_only", notes: null }), "strength")).toBe(
      "No guidance added yet"
    );
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "coach_notes_only", notes: "Work up to a top set" }), "strength")).toBe(
      "“Work up to a top set”"
    );
  });

  it("formats running distance in km", () => {
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "distance", distance_meters: 5000 }), "running")).toBe("5km");
  });

  it("formats running/cardio time using mm:ss", () => {
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "time", duration_seconds: 1200 }), "cardio")).toBe("20:00");
  });

  it("formats intervals as count x distance/time", () => {
    expect(
      summarizePrescriptionPrimary(makeSet({ prescription_type: "intervals", sets: 6, distance_meters: 400 }), "running")
    ).toBe("6 × 400m");
  });

  it("formats sub-1000m distances in meters, not a fractional km", () => {
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "distance", distance_meters: 40 }), "running")).toBe("40m");
  });

  it("returns a dash when a numeric field required by the type hasn't been filled in", () => {
    expect(summarizePrescriptionPrimary(makeSet({ prescription_type: "distance", distance_meters: null }), "running")).toBe("—");
  });
});

describe("summarizeRest", () => {
  it("formats rest as 'Rest mm:ss', matching the spec's 'Rest 2:00' example", () => {
    expect(summarizeRest(makeSet({ rest_seconds: 120 }))).toBe("Rest 2:00");
  });

  it("returns null when no rest is set, so the caller can omit the summary entirely", () => {
    expect(summarizeRest(makeSet({ rest_seconds: null }))).toBeNull();
  });
});
