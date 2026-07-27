// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseCard } from "./exercise-card";
import type { BlockExerciseRow, SetRow } from "@/lib/programs/types";

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

function makeExercise(overrides: Partial<BlockExerciseRow> = {}): BlockExerciseRow {
  return {
    id: "ex-1",
    block_id: "block-1",
    position: 1,
    exercise_id: null,
    custom_name: "Bench Press",
    notes: null,
    exercise_category: "strength",
    sets: [makeSet()],
    ...overrides,
  };
}

const baseProps = {
  isGrouped: false,
  mode: "simple" as const,
  library: [],
  onCreateCustomExercise: vi.fn(),
  onExerciseChange: vi.fn(),
  onNoteChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onPrescriptionTypeChange: vi.fn(),
  onAddSet: vi.fn(),
  onSetChange: vi.fn(),
  onDeleteSet: vi.fn(),
  onReorderSets: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
};

describe("ExerciseCard collapsed state", () => {
  it("shows name, category, prescription summary, and rest summary, matching the spec's own example", () => {
    render(<ExerciseCard exercise={makeExercise()} expanded={false} onToggleExpand={vi.fn()} {...baseProps} />);
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Strength")).toBeInTheDocument();
    expect(screen.getByText("4 × 6 @ 100kg")).toBeInTheDocument();
    expect(screen.getByText("· Rest 2:00")).toBeInTheDocument();
  });

  it("shows a note indicator only when the exercise has a coach note", () => {
    const { rerender } = render(
      <ExerciseCard exercise={makeExercise({ notes: null })} expanded={false} onToggleExpand={vi.fn()} {...baseProps} />
    );
    expect(screen.queryByLabelText("Has a coach note")).not.toBeInTheDocument();

    rerender(<ExerciseCard exercise={makeExercise({ notes: "Bar speed" })} expanded={false} onToggleExpand={vi.fn()} {...baseProps} />);
    expect(screen.getByLabelText("Has a coach note")).toBeInTheDocument();
  });

  it("does not render the full editing surface while collapsed", () => {
    render(<ExerciseCard exercise={makeExercise()} expanded={false} onToggleExpand={vi.fn()} {...baseProps} />);
    expect(screen.queryByRole("radiogroup", { name: /prescription type/i })).not.toBeInTheDocument();
  });

  it("calls onToggleExpand when the row itself is clicked", async () => {
    const onToggleExpand = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard exercise={makeExercise()} expanded={false} onToggleExpand={onToggleExpand} {...baseProps} />);
    await user.click(screen.getByText("Bench Press"));
    expect(onToggleExpand).toHaveBeenCalled();
  });

  it("duplicate and delete fire their own callbacks without toggling expand", async () => {
    const onToggleExpand = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ExerciseCard
        exercise={makeExercise()}
        expanded={false}
        onToggleExpand={onToggleExpand}
        {...baseProps}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByLabelText("Duplicate Bench Press"));
    expect(onDuplicate).toHaveBeenCalled();
    expect(onToggleExpand).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Delete Bench Press"));
    expect(onDelete).toHaveBeenCalled();
    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it("shows 'remove from superset' instead of delete when grouped", () => {
    const onRemoveFromBlock = vi.fn();
    render(
      <ExerciseCard
        exercise={makeExercise()}
        expanded={false}
        onToggleExpand={vi.fn()}
        {...baseProps}
        isGrouped
        onRemoveFromBlock={onRemoveFromBlock}
      />
    );
    expect(screen.getByLabelText(/remove bench press from this superset/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Delete Bench Press")).not.toBeInTheDocument();
  });
});

describe("ExerciseCard expanded state", () => {
  it("renders the exercise search, category control, prescription type picker, and set rows", () => {
    render(<ExerciseCard exercise={makeExercise()} expanded onToggleExpand={vi.fn()} {...baseProps} />);
    expect(screen.getByRole("button", { name: "Bench Press" })).toBeInTheDocument(); // exercise search trigger
    expect(screen.getByRole("radiogroup", { name: /exercise category/i })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /prescription type/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add row/i })).toBeInTheDocument();
  });

  it("renders the Cardio Builder's structured interval table instead of generic rows for the 'intervals' prescription type", () => {
    const exercise = makeExercise({
      exercise_category: "cardio",
      custom_name: "Assault Bike",
      sets: [makeSet({ prescription_type: "intervals", sets: 8, distance_meters: null, duration_seconds: 30, rest_seconds: 90 })],
    });
    render(<ExerciseCard exercise={exercise} expanded onToggleExpand={vi.fn()} {...baseProps} />);
    expect(screen.getByRole("button", { name: "Add interval" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^add row$/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Repeat")).toBeInTheDocument();
  });

  it("does not show Custom Fields in simple mode, but does in advanced mode", () => {
    const { rerender } = render(
      <ExerciseCard exercise={makeExercise()} expanded onToggleExpand={vi.fn()} {...baseProps} mode="simple" />
    );
    expect(screen.queryByText("Custom Fields")).not.toBeInTheDocument();

    rerender(<ExerciseCard exercise={makeExercise()} expanded onToggleExpand={vi.fn()} {...baseProps} mode="advanced" />);
    expect(screen.getByText("Custom Fields")).toBeInTheDocument();
  });

  it("shows the coach note affordance", () => {
    render(<ExerciseCard exercise={makeExercise()} expanded onToggleExpand={vi.fn()} {...baseProps} />);
    expect(screen.getByRole("button", { name: /add coach note/i })).toBeInTheDocument();
  });

  it("Add row calls onAddSet", async () => {
    const onAddSet = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard exercise={makeExercise()} expanded onToggleExpand={vi.fn()} {...baseProps} onAddSet={onAddSet} />);
    await user.click(screen.getByRole("button", { name: /add row/i }));
    expect(onAddSet).toHaveBeenCalled();
  });
});
