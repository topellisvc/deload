// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  onTestMaxBeforeChange: vi.fn(),
  knownMax: null,
  onSaveKnownMax: vi.fn(),
  onPrescriptionTypeChange: vi.fn(),
  onAddSet: vi.fn(),
  onSetChange: vi.fn(),
  onDeleteSet: vi.fn(),
  onReorderSets: vi.fn(),
  onSaveAsTemplate: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  otherDays: [],
  onMoveToDay: vi.fn(),
  isMoving: false,
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

  it("shows the 'Test max before' checkbox for a strength exercise with a real library exercise_id", () => {
    render(<ExerciseCard exercise={makeExercise({ exercise_id: "bench-press" })} expanded onToggleExpand={vi.fn()} {...baseProps} />);
    expect(screen.getByRole("checkbox", { name: /test max before/i })).toBeInTheDocument();
  });

  it("hides the 'Test max before' checkbox for a custom_name-only exercise (no exercise_id to test against)", () => {
    render(<ExerciseCard exercise={makeExercise({ exercise_id: null })} expanded onToggleExpand={vi.fn()} {...baseProps} />);
    expect(screen.queryByRole("checkbox", { name: /test max before/i })).not.toBeInTheDocument();
  });

  it("hides the 'Test max before' checkbox for a non-strength exercise", () => {
    render(
      <ExerciseCard
        exercise={makeExercise({ exercise_id: "assault-bike", exercise_category: "cardio", sets: [makeSet({ prescription_type: "time" })] })}
        expanded
        onToggleExpand={vi.fn()}
        {...baseProps}
      />
    );
    expect(screen.queryByRole("checkbox", { name: /test max before/i })).not.toBeInTheDocument();
  });

  it("reflects test_max_before's current value and calls onTestMaxBeforeChange when toggled", async () => {
    const onTestMaxBeforeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ExerciseCard
        exercise={makeExercise({ exercise_id: "bench-press", test_max_before: false })}
        expanded
        onToggleExpand={vi.fn()}
        {...baseProps}
        onTestMaxBeforeChange={onTestMaxBeforeChange}
      />
    );
    const checkbox = screen.getByRole("checkbox", { name: /test max before/i });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onTestMaxBeforeChange).toHaveBeenCalledWith(true);
  });

  it('shows an "Enter it" link and a testing-week hint when no known max is on record', () => {
    render(
      <ExerciseCard exercise={makeExercise({ exercise_id: "bench-press" })} expanded onToggleExpand={vi.fn()} {...baseProps} knownMax={null} />
    );
    expect(screen.getByRole("button", { name: /know their max\? enter it/i })).toBeInTheDocument();
    expect(screen.getByText(/add a testing week/i)).toBeInTheDocument();
    expect(screen.queryByText(/known max:/i)).not.toBeInTheDocument();
  });

  it("shows the known max plainly, with a Change link, once one is on record", () => {
    render(
      <ExerciseCard
        exercise={makeExercise({ exercise_id: "bench-press" })}
        expanded
        onToggleExpand={vi.fn()}
        {...baseProps}
        knownMax={{ valueKg: 140, performedOn: "2026-07-30" }}
      />
    );
    expect(screen.getByText("140kg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /know their max\? enter it/i })).not.toBeInTheDocument();
  });

  it("entering a known max calls onSaveKnownMax with the typed number", async () => {
    const onSaveKnownMax = vi.fn();
    const user = userEvent.setup();
    render(
      <ExerciseCard
        exercise={makeExercise({ exercise_id: "bench-press" })}
        expanded
        onToggleExpand={vi.fn()}
        {...baseProps}
        knownMax={null}
        onSaveKnownMax={onSaveKnownMax}
      />
    );

    await user.click(screen.getByRole("button", { name: /know their max\? enter it/i }));
    await user.type(screen.getByLabelText("Known 1RM"), "140");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveKnownMax).toHaveBeenCalledWith(140);
  });

  it("guards against a second commit firing before React has unmounted the input (key-repeat/double-click), since each write is a real INSERT with no upsert", () => {
    // exercise_max_records is append-only — a second commit in the same
    // edit session would write a genuine duplicate row, not overwrite the
    // first. Awaited user.type/user.click already let React flush a render
    // between events, so they can't reproduce the race this guards
    // against: two Enter keydowns (OS key-repeat) or two clicks landing
    // before the first commit's setEditing(false) has actually removed the
    // input from the tree. Wrapping both dispatches in one outer act(...)
    // reproduces exactly that — both handlers run back to back before
    // React commits either update, the same way the ref-based guard (not
    // useState, which batches and wouldn't have updated yet either) has to
    // survive.
    const onSaveKnownMax = vi.fn();
    render(
      <ExerciseCard
        exercise={makeExercise({ exercise_id: "bench-press" })}
        expanded
        onToggleExpand={vi.fn()}
        {...baseProps}
        knownMax={null}
        onSaveKnownMax={onSaveKnownMax}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /know their max\? enter it/i }));
    const input = screen.getByLabelText("Known 1RM");
    fireEvent.change(input, { target: { value: "140" } });

    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(onSaveKnownMax).toHaveBeenCalledTimes(1);
    expect(onSaveKnownMax).toHaveBeenCalledWith(140);
  });

  it("Change on an existing known max pre-fills the input with the current value", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseCard
        exercise={makeExercise({ exercise_id: "bench-press" })}
        expanded
        onToggleExpand={vi.fn()}
        {...baseProps}
        knownMax={{ valueKg: 140, performedOn: "2026-07-30" }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Change" }));

    expect(screen.getByLabelText("Known 1RM")).toHaveValue(140);
  });

  it("Cancel discards the edit without calling onSaveKnownMax", async () => {
    const onSaveKnownMax = vi.fn();
    const user = userEvent.setup();
    render(
      <ExerciseCard
        exercise={makeExercise({ exercise_id: "bench-press" })}
        expanded
        onToggleExpand={vi.fn()}
        {...baseProps}
        knownMax={null}
        onSaveKnownMax={onSaveKnownMax}
      />
    );

    await user.click(screen.getByRole("button", { name: /know their max\? enter it/i }));
    await user.type(screen.getByLabelText("Known 1RM"), "140");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSaveKnownMax).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /know their max\? enter it/i })).toBeInTheDocument();
  });

  it("hides the known-max control alongside 'Test max before' for a custom_name-only or non-strength exercise", () => {
    const { rerender } = render(
      <ExerciseCard exercise={makeExercise({ exercise_id: null })} expanded onToggleExpand={vi.fn()} {...baseProps} knownMax={null} />
    );
    expect(screen.queryByRole("button", { name: /know their max\? enter it/i })).not.toBeInTheDocument();

    rerender(
      <ExerciseCard
        exercise={makeExercise({ exercise_id: "assault-bike", exercise_category: "cardio", sets: [makeSet({ prescription_type: "time" })] })}
        expanded
        onToggleExpand={vi.fn()}
        {...baseProps}
        knownMax={null}
      />
    );
    expect(screen.queryByRole("button", { name: /know their max\? enter it/i })).not.toBeInTheDocument();
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

  it("Save as template calls onSaveAsTemplate", async () => {
    const onSaveAsTemplate = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard exercise={makeExercise()} expanded onToggleExpand={vi.fn()} {...baseProps} onSaveAsTemplate={onSaveAsTemplate} />);
    await user.click(screen.getByRole("button", { name: /save as template/i }));
    expect(onSaveAsTemplate).toHaveBeenCalled();
  });
});
