// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { CircuitBlockCard, type CircuitSettingsPatch } from "./circuit-block-card";
import type { BlockExerciseRow, BlockRow, SetRow } from "@/lib/programs/types";

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
    custom_name: "Kettlebell Swing",
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
    block_type: "circuit",
    block_role: "main",
    rounds: 3,
    custom_name: "Metcon A",
    notes: null,
    goal: null,
    completion_method: "traditional_rounds",
    rest_between_exercises_seconds: 15,
    rest_between_rounds_seconds: 90,
    duration_seconds: null,
    interval_seconds: null,
    exercises: [makeExercise()],
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof CircuitBlockCard>[0]> = {}) {
  const block = props.block ?? makeBlock();
  const defaults: Parameters<typeof CircuitBlockCard>[0] = {
    block,
    expandedExerciseId: null,
    onToggleExpand: vi.fn(),
    mode: "simple",
    library: [],
    onCreateCustomExercise: vi.fn(),
    onDeleteBlock: vi.fn(),
    onAddExerciseToBlock: vi.fn(),
    isAddingExercise: false,
    onRemoveExerciseFromBlock: vi.fn(),
    onDuplicateExercise: vi.fn(),
    otherDays: [],
    onMoveExerciseToDay: vi.fn(),
    movingExerciseId: null,
    onSettingsChange: vi.fn(),
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
    onSaveAsTemplate: vi.fn(),
    ...props,
  };

  // useSortable (the whole-block drag handle) needs a DndContext/
  // SortableContext ancestor the same way BlockSection (day-column.tsx)
  // always provides one — wrapping here so this test exercises the real
  // component tree shape rather than a stripped-down stand-in.
  return render(
    <DndContext>
      <SortableContext items={[block.id]}>
        <CircuitBlockCard {...defaults} />
      </SortableContext>
    </DndContext>
  );
}

describe("CircuitBlockCard", () => {
  it("starts collapsed for a circuit that already has exercises, showing the summary line", () => {
    renderCard();
    expect(screen.getByText("Metcon A")).toBeInTheDocument();
    expect(screen.getByText(/1 exercise/)).toBeInTheDocument();
    expect(screen.getByText(/3 rounds/)).toBeInTheDocument();
    expect(screen.getByText(/Traditional Rounds/)).toBeInTheDocument();
    // Settings panel (Circuit name input) only renders once expanded.
    expect(screen.queryByLabelText("Circuit name")).not.toBeInTheDocument();
  });

  it("starts expanded for a brand-new circuit with no exercises yet", () => {
    renderCard({ block: makeBlock({ exercises: [] }) });
    expect(screen.getByLabelText("Circuit name")).toBeInTheDocument();
    expect(screen.getByText("Add exercise")).toBeInTheDocument();
  });

  it("expands on click and shows the settings panel plus every exercise", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: /Metcon A/ }));
    expect(screen.getByLabelText("Circuit name")).toBeInTheDocument();
    expect(screen.getByText("Kettlebell Swing")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Completion method" })).toBeInTheDocument();
  });

  it("only shows the fields the current completion method's config lists as relevant", async () => {
    const user = userEvent.setup();
    // EMOM: rounds + interval, no rest-between-rounds or duration (see
    // completion-methods.ts's own field map for the reasoning).
    renderCard({ block: makeBlock({ completion_method: "emom", interval_seconds: 60 }) });
    await user.click(screen.getByRole("button", { name: /Metcon A/ }));
    expect(screen.getByText("Interval")).toBeInTheDocument();
    expect(screen.queryByText("Rest between rounds")).not.toBeInTheDocument();
    expect(screen.queryByText("Duration")).not.toBeInTheDocument();
  });

  it("fires onSettingsChange with the new completion method when a different method is picked", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    renderCard({ onSettingsChange });
    await user.click(screen.getByRole("button", { name: /Metcon A/ }));
    await user.click(screen.getByRole("radio", { name: /AMRAP/ }));
    expect(onSettingsChange).toHaveBeenCalledWith({ completion_method: "amrap" } satisfies CircuitSettingsPatch);
  });

  it("calls onAddExerciseToBlock from the expanded exercise list", async () => {
    const user = userEvent.setup();
    const onAddExerciseToBlock = vi.fn();
    renderCard({ onAddExerciseToBlock });
    await user.click(screen.getByRole("button", { name: /Metcon A/ }));
    await user.click(screen.getByText("Add exercise"));
    expect(onAddExerciseToBlock).toHaveBeenCalled();
  });

  it("treats a single-exercise circuit as grouped — deleting its only exercise removes it from the circuit, not the whole block", async () => {
    // Explicitly block_type: 'circuit' with just 1 exercise so far (still
    // mid-build) should behave like any other grouped block once expanded:
    // the exercise's own delete removes it from the circuit rather than
    // reaching for onDeleteBlock, since a coach building a circuit one
    // exercise at a time shouldn't have "delete" on that first exercise
    // nuke the circuit they just created.
    const user = userEvent.setup();
    const onRemoveExerciseFromBlock = vi.fn();
    const onDeleteBlock = vi.fn();
    renderCard({ onRemoveExerciseFromBlock, onDeleteBlock, block: makeBlock({ exercises: [makeExercise(), makeExercise({ id: "ex-2", custom_name: "Box Jump" })] }) });
    await user.click(screen.getByRole("button", { name: /Metcon A/ }));
    const removeButtons = screen.getAllByRole("button", { name: /Remove .* from this circuit/ });
    await user.click(removeButtons[0]!);
    expect(onRemoveExerciseFromBlock).toHaveBeenCalledWith("ex-1");
    expect(onDeleteBlock).not.toHaveBeenCalled();
  });
});
