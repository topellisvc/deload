// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkoutSummaryBar } from "./workout-summary-bar";
import type { BlockRow, SetRow } from "@/lib/programs/types";

function makeSet(overrides: Partial<SetRow> = {}): SetRow {
  return {
    id: "set-1",
    block_exercise_id: "ex-1",
    position: 1,
    prescription_type: "fixed_weight",
    sets: 3,
    reps: "8",
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

function makeBlocks(): BlockRow[] {
  return [
    {
      id: "block-1",
      day_id: "day-1",
      position: 1,
      block_type: "single",
      block_role: "main",
      rounds: 1,
      custom_name: null,
      notes: null,
      goal: null,
      completion_method: null,
      rest_between_exercises_seconds: null,
      rest_between_rounds_seconds: null,
      duration_seconds: null,
      interval_seconds: null,
      exercises: [
        {
          id: "ex-1",
          block_id: "block-1",
          position: 1,
          exercise_id: null,
          custom_name: "Bench Press",
          notes: null,
          exercise_category: "strength",
          sets: [makeSet({ id: "s1", sets: 4 }), makeSet({ id: "s2", sets: 3 })],
        },
        {
          id: "ex-2",
          block_id: "block-1",
          position: 2,
          exercise_id: null,
          custom_name: "Easy Run",
          notes: null,
          exercise_category: "running",
          sets: [makeSet({ id: "s3", prescription_type: "distance", sets: 1, distance_meters: 5000 })],
        },
      ],
    },
  ];
}

describe("WorkoutSummaryBar", () => {
  it("renders nothing for a day with no exercises yet", () => {
    const { container } = render(<WorkoutSummaryBar blocks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("totals exercises and sets across every block, and lists every category in play", () => {
    render(<WorkoutSummaryBar blocks={makeBlocks()} />);
    expect(screen.getByText("2 exercises")).toBeInTheDocument();
    // 4 + 3 (strength) + 1 (running distance row) = 8 total sets.
    expect(screen.getByText("8 sets")).toBeInTheDocument();
    expect(screen.getByText("Strength")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("uses singular wording for exactly one exercise and one set", () => {
    const blocks = makeBlocks();
    blocks[0]!.exercises = [{ ...blocks[0]!.exercises[0]!, sets: [makeSet({ id: "s1", sets: 1 })] }];
    render(<WorkoutSummaryBar blocks={blocks} />);
    expect(screen.getByText("1 exercise")).toBeInTheDocument();
    expect(screen.getByText("1 set")).toBeInTheDocument();
  });
});
