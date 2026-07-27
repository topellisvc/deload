// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AthletePreviewDay } from "./athlete-preview";
import type { DayRow, SetRow } from "@/lib/programs/types";

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
    weight_value: 100,
    percent_1rm_value: null,
    pr_record_type: null,
    rpe_value: null,
    rir_value: null,
    heart_rate_zone: null,
    calories: null,
    rest_seconds: 120,
    notes: null,
    distance_meters: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    advanced_config: null,
    ...overrides,
  };
}

function makeDay(overrides: Partial<DayRow> = {}): DayRow {
  return {
    id: "day-1",
    week_id: "week-1",
    position: 1,
    label: "Day 1",
    is_rest_day: false,
    blocks: [
      {
        id: "block-1",
        day_id: "day-1",
        position: 1,
        block_type: "straight",
        block_role: "main",
        rounds: 1,
        exercises: [
          {
            id: "ex-1",
            block_id: "block-1",
            position: 1,
            exercise_id: null,
            custom_name: "Bench Press",
            notes: "Control the eccentric.",
            exercise_category: "strength",
            sets: [makeSet()],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("AthletePreviewDay", () => {
  it("shows a rest-day message and nothing else for a rest day", () => {
    render(<AthletePreviewDay day={makeDay({ is_rest_day: true })} />);
    expect(screen.getByText("Rest day")).toBeInTheDocument();
    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
  });

  it("shows an empty-state message for a day with nothing added yet", () => {
    render(<AthletePreviewDay day={makeDay({ blocks: [] })} />);
    expect(screen.getByText(/nothing added to this day yet/i)).toBeInTheDocument();
  });

  it("renders exercise name, category, prescription, rest, and coach notes — everything the spec lists", () => {
    render(<AthletePreviewDay day={makeDay()} />);
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getAllByText("Strength").length).toBeGreaterThan(0);
    expect(screen.getByText("Exercise 1 of 1")).toBeInTheDocument();
    expect(screen.getByText(/120s|2:00/)).toBeInTheDocument();
    expect(screen.getByText("Control the eccentric.")).toBeInTheDocument();
  });

  it("numbers exercises across every block in position order, not per-block", () => {
    const day = makeDay({
      blocks: [
        {
          id: "block-1",
          day_id: "day-1",
          position: 1,
          block_type: "straight",
          block_role: "main",
          rounds: 1,
          exercises: [
            { id: "ex-1", block_id: "block-1", position: 1, exercise_id: null, custom_name: "Squat", notes: null, exercise_category: "strength", sets: [makeSet({ id: "s1" })] },
          ],
        },
        {
          id: "block-2",
          day_id: "day-1",
          position: 2,
          block_type: "straight",
          block_role: "main",
          rounds: 1,
          exercises: [
            { id: "ex-2", block_id: "block-2", position: 1, exercise_id: null, custom_name: "Row", notes: null, exercise_category: "strength", sets: [makeSet({ id: "s2" })] },
          ],
        },
      ],
    });
    render(<AthletePreviewDay day={day} />);
    expect(screen.getByText("Exercise 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Exercise 2 of 2")).toBeInTheDocument();
  });

  it("shows Warm-up and Conditioning/Finisher as their own sections, separate from the numbered main workout", () => {
    const day = makeDay({
      blocks: [
        {
          id: "block-warmup",
          day_id: "day-1",
          position: 1,
          block_type: "straight",
          block_role: "warmup",
          rounds: 1,
          exercises: [
            { id: "ex-warmup", block_id: "block-warmup", position: 1, exercise_id: null, custom_name: "Arm Circles", notes: null, exercise_category: "strength", sets: [makeSet({ id: "s-warmup" })] },
          ],
        },
        {
          id: "block-main",
          day_id: "day-1",
          position: 1,
          block_type: "straight",
          block_role: "main",
          rounds: 1,
          exercises: [
            { id: "ex-main", block_id: "block-main", position: 1, exercise_id: null, custom_name: "Bench Press", notes: null, exercise_category: "strength", sets: [makeSet({ id: "s-main" })] },
          ],
        },
        {
          id: "block-conditioning",
          day_id: "day-1",
          position: 1,
          block_type: "straight",
          block_role: "conditioning",
          rounds: 1,
          exercises: [
            { id: "ex-finisher", block_id: "block-conditioning", position: 1, exercise_id: null, custom_name: "Assault Bike", notes: null, exercise_category: "cardio", sets: [makeSet({ id: "s-finisher" })] },
          ],
        },
      ],
    });
    render(<AthletePreviewDay day={day} />);

    expect(screen.getByText("Warm-up")).toBeInTheDocument();
    expect(screen.getByText("Arm Circles")).toBeInTheDocument();
    expect(screen.getByText("Conditioning / Finisher")).toBeInTheDocument();
    expect(screen.getByText("Assault Bike")).toBeInTheDocument();

    // Only the main workout gets "Exercise X of Y" numbering — warm-up and
    // conditioning exercises aren't part of that count.
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Exercise 1 of 1")).toBeInTheDocument();
  });

  it("omits a section entirely when it has no blocks", () => {
    render(<AthletePreviewDay day={makeDay()} />);
    expect(screen.queryByText("Warm-up")).not.toBeInTheDocument();
    expect(screen.queryByText("Conditioning / Finisher")).not.toBeInTheDocument();
  });
});
