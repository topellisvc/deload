// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgramBuilder } from "./program-builder";
import type { BlockExerciseRow, BlockRow, DayRow, ProgramTree, SetRow, WeekRow } from "@/lib/programs/types";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
// Out of scope here — DayColumn is the exercise-picker/sets UI, a whole
// separate surface. Stubbed with a button per callback so these tests can
// drive ProgramBuilder's own onCategoryChange branch (confirm vs. no
// confirm) without needing the real picker UI.
vi.mock("@/components/programs/day-column", () => ({
  DayColumn: ({
    day,
    onCategoryChange,
    onAddExerciseToBlock,
    addingExerciseBlockId,
    onDeleteDay,
  }: {
    day: DayRow;
    onCategoryChange: (blockId: string, blockExerciseId: string, category: string) => void;
    onAddExerciseToBlock: (blockId: string) => void;
    addingExerciseBlockId: string | null;
    onDeleteDay?: () => void;
  }) => (
    <div>
      <span>{day.label}</span>
      {/* A freshly-added blank day (see the "Add day" tests below) has no
          blocks yet — guard rather than assume day.blocks[0] exists, same
          as the real DayColumn does. */}
      {day.blocks[0] && (
        <>
          <button
            type="button"
            onClick={() => {
              const block = day.blocks[0]!;
              const exercise = block.exercises[0]!;
              onCategoryChange(block.id, exercise.id, "running");
            }}
          >
            Switch to running
          </button>
          <button type="button" disabled={addingExerciseBlockId === day.blocks[0].id} onClick={() => onAddExerciseToBlock(day.blocks[0]!.id)}>
            {addingExerciseBlockId === day.blocks[0].id
              ? "Adding…"
              : day.blocks[0].exercises.length > 1
                ? "Add another exercise"
                : "Make this a superset"}
          </button>
        </>
      )}
      {onDeleteDay && (
        <button type="button" onClick={onDeleteDay}>
          Delete {day.label || `Day ${day.position}`}
        </button>
      )}
    </div>
  ),
}));
vi.mock("@/components/programs/add-week-dialog", () => ({ AddWeekDialog: () => null }));
// ProgramBuilder fetches the coach's exercise library on mount (see its
// own effect) purely to hand down to DayColumn/ExerciseCard — none of
// these tests exercise that, and the mocked supabase client below has no
// real `.from`, so the real implementation would throw. A resolved empty
// list keeps that effect a no-op here.
vi.mock("@/lib/programs/exercise-library", () => ({
  getExerciseLibrary: vi.fn().mockResolvedValue([]),
  addToExerciseLibrary: vi.fn(),
}));
vi.mock("@/lib/programs/exercise-templates", () => ({
  getExerciseTemplates: vi.fn().mockResolvedValue([]),
  saveExerciseAsTemplate: vi.fn(),
  deleteExerciseTemplate: vi.fn(),
}));
vi.mock("@/lib/programs/day-templates", () => ({
  getDayTemplates: vi.fn().mockResolvedValue([]),
  saveDayAsTemplate: vi.fn(),
  deleteDayTemplate: vi.fn(),
}));
vi.mock("@/lib/programs/mutations", () => ({
  createProgram: vi.fn(),
  cloneProgram: vi.fn(),
  updateProgram: vi.fn(),
  deleteProgram: vi.fn(),
  removeAssignedProgram: vi.fn(),
  setActiveProgram: vi.fn(),
  deactivateProgram: vi.fn(),
  addWeek: vi.fn(),
  deleteWeek: vi.fn(),
  addDay: vi.fn(),
  deleteDay: vi.fn(),
  updateDay: vi.fn(),
  copyDayContents: vi.fn(),
  addExerciseBlock: vi.fn(),
  deleteBlock: vi.fn(),
  addExerciseToBlock: vi.fn(),
  removeExerciseFromBlock: vi.fn(),
  updateBlockRounds: vi.fn(),
  updateBlockType: vi.fn(),
  swapBlockPositions: vi.fn(),
  updateBlockExercise: vi.fn(),
  switchExerciseCategory: vi.fn(),
  updatePrescriptionType: vi.fn(),
  addSetRow: vi.fn(),
  updateSetRow: vi.fn(),
  deleteSetRow: vi.fn(),
}));

import * as m from "@/lib/programs/mutations";

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

function makeWeek(overrides: Partial<WeekRow> = {}): WeekRow {
  return {
    id: "week-1",
    program_id: "prog-1",
    position: 1,
    label: null,
    based_on_week_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    days: [makeDay()],
    ...overrides,
  };
}

function makeProgram(overrides: Partial<ProgramTree> = {}): ProgramTree {
  return {
    id: "prog-1",
    owner_id: "coach-1",
    athlete_id: "coach-1",
    name: "Push Pull Legs",
    discipline: "hybrid",
    is_active: false,
    removed_by_athlete_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    weeks: [makeWeek()],
    ...overrides,
  };
}

/**
 * ProgramBuilder replaced three separate window.confirm() call sites with
 * one shared `pendingConfirm` object feeding a single ConfirmDialog — these
 * tests cover that shared mechanism (right copy per action, right mutation
 * called, delete-week's "can't drop below one week" guard, and the
 * confirm-only-when-there's-something-to-lose branch on category switch),
 * not DayColumn's own UI (mocked away above).
 */
describe("ProgramBuilder shared confirm dialog", () => {
  beforeEach(() => {
    vi.mocked(m.deleteProgram).mockReset();
    vi.mocked(m.deleteWeek).mockReset();
    vi.mocked(m.deleteDay).mockReset();
    vi.mocked(m.switchExerciseCategory).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("confirms and calls deleteProgram, then navigates to /programs", async () => {
    vi.mocked(m.deleteProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<ProgramBuilder initialProgram={makeProgram()} />);

    await user.click(screen.getByRole("button", { name: "Delete program" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText('Delete "Push Pull Legs"? This can\'t be undone.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(m.deleteProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/programs"));
  });

  it("confirms and calls deleteWeek for a non-last week", async () => {
    vi.mocked(m.deleteWeek).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <ProgramBuilder
        initialProgram={makeProgram({
          weeks: [makeWeek({ id: "week-1", position: 1 }), makeWeek({ id: "week-2", position: 2 })],
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete Week 1" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete Week 1? This can't be undone.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(m.deleteWeek).toHaveBeenCalledWith(expect.anything(), "week-1");
  });

  it("never offers a delete-week button when there is only one week", () => {
    render(<ProgramBuilder initialProgram={makeProgram({ weeks: [makeWeek()] })} />);
    expect(screen.queryByRole("button", { name: /delete week 1/i })).not.toBeInTheDocument();
  });

  it("confirms and calls deleteDay for a non-last day", async () => {
    vi.mocked(m.deleteDay).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <ProgramBuilder
        initialProgram={makeProgram({
          weeks: [makeWeek({ days: [makeDay({ id: "day-1", position: 1, label: "Day 1" }), makeDay({ id: "day-2", position: 2, label: "Day 2" })] })],
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete Day 1" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete Day 1? This can't be undone.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(m.deleteDay).toHaveBeenCalledWith(expect.anything(), "day-1");
  });

  it("never offers a delete-day button when there is only one day in the week", () => {
    render(<ProgramBuilder initialProgram={makeProgram({ weeks: [makeWeek({ days: [makeDay()] })] })} />);
    expect(screen.queryByRole("button", { name: /delete day 1/i })).not.toBeInTheDocument();
  });

  it("adds a blank day at the end of the week and it becomes deletable once there's more than one", async () => {
    vi.mocked(m.addDay).mockResolvedValue({
      day: { id: "day-2", week_id: "week-1", position: 2, label: null, is_rest_day: false, blocks: [] },
      error: null,
    });
    const user = userEvent.setup();
    render(<ProgramBuilder initialProgram={makeProgram({ weeks: [makeWeek({ days: [makeDay({ id: "day-1", position: 1 })] })] })} />);

    expect(screen.queryByRole("button", { name: /delete day/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add day" }));

    expect(m.addDay).toHaveBeenCalledWith(expect.anything(), { weekId: "week-1", position: 2 });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /delete day/i })).toHaveLength(2));
  });

  it("confirms before switching exercise category when the exercise already has prescription data", async () => {
    vi.mocked(m.switchExerciseCategory).mockResolvedValue({ set: makeSet({ prescription_type: "distance" }), error: null });
    const user = userEvent.setup();
    render(<ProgramBuilder initialProgram={makeProgram()} />);

    await user.click(screen.getByRole("button", { name: "Switch to running" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/clears the prescription data already entered/)).toBeInTheDocument();
    expect(m.switchExerciseCategory).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Switch" }));
    expect(m.switchExerciseCategory).toHaveBeenCalledWith(expect.anything(), {
      blockExerciseId: "ex-1",
      category: "running",
    });
  });

  it("switches category immediately, with no confirm dialog, when the exercise has no prescription data yet", async () => {
    vi.mocked(m.switchExerciseCategory).mockResolvedValue({ set: makeSet({ prescription_type: "distance" }), error: null });
    const user = userEvent.setup();
    render(
      <ProgramBuilder
        initialProgram={makeProgram({
          weeks: [
            makeWeek({
              days: [
                makeDay({
                  blocks: [
                    makeBlock({
                      exercises: [
                        makeExercise({
                          sets: [
                            makeSet({
                              reps: null,
                              weight_value: null,
                              percent_1rm_value: null,
                              distance_meters: null,
                              duration_seconds: null,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Switch to running" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(m.switchExerciseCategory).toHaveBeenCalledWith(expect.anything(), {
        blockExerciseId: "ex-1",
        category: "running",
      })
    );
  });
});

/**
 * "Make this a superset" needs the server-generated exercise id back before
 * local state can update, so there's a real network round-trip with no
 * synchronous effect — clicking again before it resolves used to fire a
 * second, duplicate insert (and read, live, as "my first click didn't
 * register"). These cover the fix: the in-flight block disables its own
 * button until the request settles.
 */
describe("ProgramBuilder add-exercise-to-block pending state", () => {
  beforeEach(() => {
    vi.mocked(m.addExerciseToBlock).mockReset();
    // Adding a second exercise flips the block to "superset" server-side
    // too (see becomesGrouped in handleAddExerciseToBlock) — resolved here
    // so that background write doesn't surface as an unhandled rejection.
    vi.mocked(m.updateBlockType).mockResolvedValue({ error: null });
  });

  it("disables the button while the add-exercise request is in flight, and ignores a second click", async () => {
    let resolveAdd!: (v: { exercise: BlockExerciseRow; error: null }) => void;
    vi.mocked(m.addExerciseToBlock).mockReturnValue(
      new Promise((resolve) => {
        resolveAdd = resolve;
      })
    );
    const user = userEvent.setup();
    render(<ProgramBuilder initialProgram={makeProgram()} />);

    const button = screen.getByRole("button", { name: "Make this a superset" });
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Adding…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Adding…" }));
    expect(m.addExerciseToBlock).toHaveBeenCalledTimes(1);

    resolveAdd({ exercise: makeExercise({ id: "ex-2" }), error: null });
    await waitFor(() => expect(screen.getByRole("button", { name: "Add another exercise" })).not.toBeDisabled());
  });
});

/**
 * Every background Supabase write from ProgramBuilder's handlers is
 * wrapped in `track()` to drive this "Saving…/All changes saved"
 * indicator — nothing else in the tree surfaces that a write is actually
 * in flight or has landed (edits apply to local state immediately, see
 * this component's own doc comment). Reuses addExerciseToBlock's
 * controllable-promise pattern (see the describe block above) to observe
 * both states around a real await boundary.
 */
describe("ProgramBuilder autosave status indicator", () => {
  beforeEach(() => {
    vi.mocked(m.addExerciseToBlock).mockReset();
    vi.mocked(m.updateBlockType).mockResolvedValue({ error: null });
  });

  it("shows nothing before any edit, 'Saving…' while a write is in flight, then 'All changes saved' once it resolves", async () => {
    let resolveAdd!: (v: { exercise: BlockExerciseRow; error: null }) => void;
    vi.mocked(m.addExerciseToBlock).mockReturnValue(
      new Promise((resolve) => {
        resolveAdd = resolve;
      })
    );
    const user = userEvent.setup();
    render(<ProgramBuilder initialProgram={makeProgram()} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Make this a superset" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saving…");

    resolveAdd({ exercise: makeExercise({ id: "ex-2" }), error: null });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("All changes saved"));
  });
});
