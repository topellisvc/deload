// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayColumn } from "./day-column";
import type { BlockExerciseRow, BlockRow, DayRow, SetRow } from "@/lib/programs/types";

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
    weight_value: 100,
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

function makeBlock(overrides: Partial<BlockRow> = {}): BlockRow {
  return {
    id: "block-1",
    day_id: "day-1",
    position: 1,
    block_type: "straight",
    block_role: "main",
    rounds: 1,
    exercises: [makeExercise()],
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
    blocks: [makeBlock()],
    ...overrides,
  };
}

/** Every callback DayColumn takes, defaulted to a no-op spy — individual
 * tests below only override the handful they actually assert on. Keeps
 * each test's props focused on what it's testing rather than re-listing
 * this whole interface every time. */
function baseProps() {
  return {
    otherDays: [],
    mode: "simple" as const,
    library: [],
    onCreateCustomExercise: vi.fn(),
    onUpdateDay: vi.fn(),
    onCopyTo: vi.fn(),
    onDuplicateDay: vi.fn(),
    onAddBlock: vi.fn(),
    onDeleteBlock: vi.fn(),
    onReorderBlocks: vi.fn(),
    onAddExerciseToBlock: vi.fn(),
    exerciseTemplates: [],
    dayTemplates: [],
    onSaveAsTemplate: vi.fn(),
    onInsertExerciseTemplate: vi.fn(),
    onSaveDayAsTemplate: vi.fn(),
    onInsertDayTemplate: vi.fn(),
    addingExerciseBlockId: null,
    onRemoveExerciseFromBlock: vi.fn(),
    onDuplicateExercise: vi.fn(),
    onMoveExerciseToDay: vi.fn(),
    movingExerciseId: null,
    onRoundsChange: vi.fn(),
    onExerciseChange: vi.fn(),
    onNoteChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onTestMaxBeforeChange: vi.fn(),
    knownMaxByExerciseId: new Map(),
    onSaveKnownMax: vi.fn(),
    onPrescriptionTypeChange: vi.fn(),
    onAddSet: vi.fn(),
    onSetChange: vi.fn(),
    onDeleteSet: vi.fn(),
    onReorderSets: vi.fn(),
  };
}

/**
 * DayColumn owns one delegated keydown handler for the whole day (see its
 * own doc comment) rather than a listener per exercise — these cover that
 * every shortcut only fires when a specific exercise's own toggle button
 * has focus (proven by the ArrowDown/ArrowUp test moving real DOM focus,
 * not just calling a handler directly), and is a no-op everywhere else
 * (proven implicitly: none of these tests need to guard against firing
 * while a sibling input has focus, because the delegated handler already
 * checks the exact event target's data-exercise-toggle attribute).
 */
describe("DayColumn keyboard shortcuts", () => {
  it("ArrowDown/ArrowUp move focus between exercise toggles in day order", async () => {
    const user = userEvent.setup();
    const day = makeDay({
      blocks: [
        makeBlock({ id: "block-1", exercises: [makeExercise({ id: "ex-1", custom_name: "Bench Press" })] }),
        makeBlock({ id: "block-2", position: 2, exercises: [makeExercise({ id: "ex-2", block_id: "block-2", custom_name: "Squat" })] }),
      ],
    });
    render(<DayColumn day={day} {...baseProps()} />);

    screen.getByText("Bench Press").closest("button")!.focus();
    expect(screen.getByText("Bench Press").closest("button")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("Squat").closest("button")).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByText("Bench Press").closest("button")).toHaveFocus();
  });

  it("Delete/Backspace removes just the exercise from a grouped (superset) block", async () => {
    const user = userEvent.setup();
    const onRemoveExerciseFromBlock = vi.fn();
    const day = makeDay({
      blocks: [
        makeBlock({
          exercises: [makeExercise({ id: "ex-1", custom_name: "Bench Press" }), makeExercise({ id: "ex-2", custom_name: "Incline Press" })],
        }),
      ],
    });
    render(<DayColumn day={day} {...baseProps()} onRemoveExerciseFromBlock={onRemoveExerciseFromBlock} />);

    screen.getByText("Bench Press").closest("button")!.focus();
    await user.keyboard("{Delete}");

    expect(onRemoveExerciseFromBlock).toHaveBeenCalledWith("block-1", "ex-1");
  });

  it("Delete/Backspace deletes the whole block when it's the block's only exercise", async () => {
    const user = userEvent.setup();
    const onDeleteBlock = vi.fn();
    render(<DayColumn day={makeDay()} {...baseProps()} onDeleteBlock={onDeleteBlock} />);

    screen.getByText("Bench Press").closest("button")!.focus();
    await user.keyboard("{Backspace}");

    expect(onDeleteBlock).toHaveBeenCalledWith("block-1");
  });

  it("Cmd/Ctrl+D duplicates the focused exercise", async () => {
    const user = userEvent.setup();
    const onDuplicateExercise = vi.fn();
    render(<DayColumn day={makeDay()} {...baseProps()} onDuplicateExercise={onDuplicateExercise} />);

    screen.getByText("Bench Press").closest("button")!.focus();
    await user.keyboard("{Control>}d{/Control}");

    expect(onDuplicateExercise).toHaveBeenCalledWith("block-1", "ex-1");
  });

  it("Escape collapses the focused exercise if it's expanded", async () => {
    const user = userEvent.setup();
    render(<DayColumn day={makeDay()} {...baseProps()} />);

    const toggle = screen.getByText("Bench Press").closest("button")!;
    await user.click(toggle);
    expect(screen.getByText("Save as template")).toBeInTheDocument();

    toggle.focus();
    await user.keyboard("{Escape}");

    expect(screen.queryByText("Save as template")).not.toBeInTheDocument();
  });

  it("Enter expands the focused exercise via native button semantics (no custom handling needed)", async () => {
    const user = userEvent.setup();
    render(<DayColumn day={makeDay()} {...baseProps()} />);

    screen.getByText("Bench Press").closest("button")!.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Save as template")).toBeInTheDocument();
  });
});

/**
 * ProgramBuilder passes `onDeleteDay` as undefined for the last remaining
 * day in a week (see its own comment on that prop) so this button simply
 * doesn't render rather than rendering disabled — these cover both the
 * "hidden when undefined" case and that clicking it calls straight
 * through with no confirmation of its own (ProgramBuilder's shared
 * pendingConfirm dialog owns the "are you sure," not this component).
 */
describe("DayColumn delete day button", () => {
  it("doesn't render when onDeleteDay is undefined (last day in the week)", () => {
    // Exact match, not a /delete/i regex — the exercise inside makeDay()'s
    // default block also has its own "Delete Bench Press" button, which
    // would false-match a looser query.
    render(<DayColumn day={makeDay()} {...baseProps()} />);
    expect(screen.queryByRole("button", { name: "Delete Day 1" })).not.toBeInTheDocument();
  });

  it("calls onDeleteDay when clicked", async () => {
    const user = userEvent.setup();
    const onDeleteDay = vi.fn();
    render(<DayColumn day={makeDay({ label: "Upper Body" })} {...baseProps()} onDeleteDay={onDeleteDay} />);

    await user.click(screen.getByRole("button", { name: "Delete Upper Body" }));

    expect(onDeleteDay).toHaveBeenCalled();
  });
});
