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
// Bare vi.fn() would return undefined instead of a promise, and
// ProgramBuilder's own effect does `getPersonalRecords(...).then(...)`
// unconditionally on mount — every existing test in this file would throw
// synchronously without a resolved default here, whether or not it cares
// about known-max behavior.
vi.mock("@/lib/profile/queries", () => ({ getPersonalRecords: vi.fn().mockResolvedValue([]) }));
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
    onTestMaxBeforeChange,
    knownMaxByExerciseId,
    onSaveKnownMax,
    onAddExerciseToBlock,
    addingExerciseBlockId,
    onDeleteDay,
    onDeleteBlock,
  }: {
    day: DayRow;
    onCategoryChange: (blockId: string, blockExerciseId: string, category: string) => void;
    onTestMaxBeforeChange: (blockId: string, blockExerciseId: string, testMaxBefore: boolean) => void;
    knownMaxByExerciseId: Map<string, { valueKg: number; performedOn: string }>;
    onSaveKnownMax: (exerciseId: string, valueKg: number) => void;
    onAddExerciseToBlock: (blockId: string) => void;
    addingExerciseBlockId: string | null;
    onDeleteDay?: () => void;
    onDeleteBlock: (blockId: string) => void;
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
          <button
            type="button"
            onClick={() => {
              const block = day.blocks[0]!;
              const exercise = block.exercises[0]!;
              onTestMaxBeforeChange(block.id, exercise.id, !exercise.test_max_before);
            }}
          >
            Toggle test max before
          </button>
          {/* Exposes the first exercise's current flag as text, purely so
              tests can observe propagation to a week that isn't the one the
              toggle button above was clicked in. */}
          <span>{day.blocks[0].exercises[0]!.test_max_before ? "flagged" : "not-flagged"}</span>
          {/* Exposes the shared knownMaxByExerciseId map's current value for
              this exercise, purely so tests can observe that saving a known
              max from one card's control updates every other card's
              display too — same "one shared source of truth" propagation
              handleSaveKnownMax's own doc comment describes. */}
          <span>
            {(() => {
              const exerciseId = day.blocks[0]!.exercises[0]!.exercise_id;
              const known = exerciseId ? knownMaxByExerciseId.get(exerciseId) : undefined;
              return known ? `known-max:${known.valueKg}` : "known-max:none";
            })()}
          </span>
          <button type="button" onClick={() => onSaveKnownMax(day.blocks[0]!.exercises[0]!.exercise_id!, 140)}>
            Save known max
          </button>
          <button type="button" disabled={addingExerciseBlockId === day.blocks[0].id} onClick={() => onAddExerciseToBlock(day.blocks[0]!.id)}>
            {addingExerciseBlockId === day.blocks[0].id
              ? "Adding…"
              : day.blocks[0].exercises.length > 1
                ? "Add another exercise"
                : "Make this a superset"}
          </button>
          <button type="button" onClick={() => onDeleteBlock(day.blocks[0]!.id)}>
            Delete block on {day.label}
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
// ProgramBuilder now calls useToast (pending-review message on the picker's
// "Create <name>" flow, migration 0038) — out of scope for these tests,
// none of which exercise that path, so a no-op stub avoids needing a real
// ToastProvider wrapped around every render() call below.
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
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
  updateBlockExercisesTestMaxBefore: vi.fn(),
  saveKnownExerciseMax: vi.fn(),
  switchExerciseCategory: vi.fn(),
  updatePrescriptionType: vi.fn(),
  addSetRow: vi.fn(),
  updateSetRow: vi.fn(),
  deleteSetRow: vi.fn(),
  syncTestingWeek: vi.fn(),
}));

import * as m from "@/lib/programs/mutations";
import { getPersonalRecords } from "@/lib/profile/queries";

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

/**
 * Ticking "Test max before" on one appearance of an exercise (e.g. Back
 * Squat on Day 1) used to only flag that one row — every other appearance
 * of the same exercise elsewhere in the program (Day 3, other weeks) stayed
 * unticked, which read as a bug ("why isn't it checked here too?"). These
 * cover the fix: the same exercise_id gets flagged everywhere at once,
 * except inside the generated testing week itself, whose own flag nothing
 * ever reads.
 */
describe("ProgramBuilder 'Test max before' propagates across every appearance of the same exercise", () => {
  beforeEach(() => {
    vi.mocked(m.updateBlockExercisesTestMaxBefore).mockReset().mockResolvedValue({ error: null });
  });

  it("flags every other block_exercise sharing the same exercise_id, across every week, and writes them in one batched call", async () => {
    const user = userEvent.setup();
    render(
      <ProgramBuilder
        initialProgram={makeProgram({
          weeks: [
            makeWeek({
              id: "week-1",
              position: 1,
              label: "Week 1",
              days: [
                makeDay({
                  id: "day-1",
                  blocks: [makeBlock({ id: "block-1", exercises: [makeExercise({ id: "ex-1", exercise_id: "barbell-back-squat", test_max_before: false })] })],
                }),
              ],
            }),
            makeWeek({
              id: "week-2",
              position: 2,
              label: "Week 2",
              days: [
                makeDay({
                  id: "day-2",
                  week_id: "week-2",
                  blocks: [
                    makeBlock({
                      id: "block-2",
                      day_id: "day-2",
                      exercises: [makeExercise({ id: "ex-2", block_id: "block-2", exercise_id: "barbell-back-squat", test_max_before: false })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Toggle test max before" }));

    // One batched statement covering both rows, not one PATCH per row —
    // firing N concurrent single-row updates was enough concurrent write
    // load to trip this project's statement_timeout in practice.
    await waitFor(() => {
      expect(m.updateBlockExercisesTestMaxBefore).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining(["ex-1", "ex-2"]), true);
    });

    await user.click(screen.getByRole("button", { name: "Week 2" }));
    expect(await screen.findByText("flagged")).toBeInTheDocument();
  });

  it("never touches the generated testing week's own copy of the same exercise", async () => {
    const user = userEvent.setup();
    render(
      <ProgramBuilder
        initialProgram={makeProgram({
          weeks: [
            makeWeek({
              id: "testing-week",
              position: 1,
              label: "Testing Week",
              is_testing_week: true,
              days: [
                makeDay({
                  id: "testing-day",
                  week_id: "testing-week",
                  blocks: [
                    makeBlock({
                      id: "testing-block",
                      day_id: "testing-day",
                      exercises: [makeExercise({ id: "ex-testing", block_id: "testing-block", exercise_id: "barbell-back-squat", test_max_before: false })],
                    }),
                  ],
                }),
              ],
            }),
            makeWeek({
              id: "week-2",
              position: 2,
              label: "Week 2",
              days: [
                makeDay({
                  id: "day-2",
                  week_id: "week-2",
                  blocks: [
                    makeBlock({
                      id: "block-2",
                      day_id: "day-2",
                      exercises: [makeExercise({ id: "ex-2", block_id: "block-2", exercise_id: "barbell-back-squat", test_max_before: false })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Week 2" }));
    await user.click(screen.getByRole("button", { name: "Toggle test max before" }));

    await waitFor(() => expect(m.updateBlockExercisesTestMaxBefore).toHaveBeenCalledWith(expect.anything(), ["ex-2"], true));

    await user.click(screen.getByRole("button", { name: "Testing Week" }));
    expect(await screen.findByText("not-flagged")).toBeInTheDocument();
  });

  /**
   * Regression test: ticking "Test max before" and immediately clicking
   * "Add testing week" used to race — syncTestingWeek's own getProgramTree
   * refresh could run its SELECT before the checkbox's background write had
   * actually committed, so the freshly-read program would show the
   * checkbox reverted to false even though the testing week itself (built
   * from the correct optimistic local state) included that exercise. Fixed
   * by having handleSyncTestingWeek await flushPendingSaves() first.
   */
  it("waits for an in-flight 'Test max before' write to land before syncTestingWeek reads the program back", async () => {
    const user = userEvent.setup();
    let resolveWrite: ((result: { error: string | null }) => void) | undefined;
    const pendingWrite = new Promise<{ error: string | null }>((resolve) => {
      resolveWrite = resolve;
    });
    vi.mocked(m.updateBlockExercisesTestMaxBefore).mockReset().mockReturnValue(pendingWrite);
    vi.mocked(m.syncTestingWeek).mockReset().mockResolvedValue({ program: null, error: "unused in this test" });

    render(
      <ProgramBuilder
        initialProgram={makeProgram({
          weeks: [
            makeWeek({
              id: "week-1",
              position: 1,
              label: "Week 1",
              days: [
                makeDay({
                  id: "day-1",
                  blocks: [makeBlock({ id: "block-1", exercises: [makeExercise({ id: "ex-1", exercise_id: "barbell-back-squat", test_max_before: false })] })],
                }),
              ],
            }),
          ],
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Toggle test max before" }));
    await user.click(screen.getAllByRole("button", { name: "Add testing week" })[0]!);

    // The checkbox's own write is still in flight — syncTestingWeek must
    // not have run yet, or it'd read back the pre-write (false) value.
    expect(m.syncTestingWeek).not.toHaveBeenCalled();

    resolveWrite!({ error: null });
    await waitFor(() => expect(m.syncTestingWeek).toHaveBeenCalledWith(expect.anything(), expect.anything()));
  });
});

/**
 * A coach who already knows an athlete's current max can type it in
 * directly (KnownMaxControl, next to "Test max before") instead of running
 * a whole testing week first. Unlike test_max_before — a real per-row DB
 * column that needs matchingBlockExerciseIds to propagate — the known-max
 * display is driven by one shared knownMaxByExerciseId map keyed by
 * exercise_id, so entering it once should update every appearance of that
 * exercise without any per-row write. This covers that propagation plus
 * the write itself landing in the same library (exercise_max_records) a
 * real logged test would.
 */
describe("ProgramBuilder known-max control", () => {
  beforeEach(() => {
    vi.mocked(m.saveKnownExerciseMax).mockReset().mockResolvedValue({ error: null });
    vi.mocked(getPersonalRecords).mockReset().mockResolvedValue([]);
  });

  it("saves to the library and updates every other appearance of the same exercise, not just the one edited", async () => {
    const user = userEvent.setup();
    render(
      <ProgramBuilder
        initialProgram={makeProgram({
          weeks: [
            makeWeek({
              id: "week-1",
              position: 1,
              label: "Week 1",
              days: [
                makeDay({
                  id: "day-1",
                  blocks: [makeBlock({ id: "block-1", exercises: [makeExercise({ id: "ex-1", exercise_id: "barbell-back-squat" })] })],
                }),
              ],
            }),
            makeWeek({
              id: "week-2",
              position: 2,
              label: "Week 2",
              days: [
                makeDay({
                  id: "day-2",
                  week_id: "week-2",
                  blocks: [
                    makeBlock({
                      id: "block-2",
                      day_id: "day-2",
                      exercises: [makeExercise({ id: "ex-2", block_id: "block-2", exercise_id: "barbell-back-squat" })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })}
      />
    );

    expect(screen.getByText("known-max:none")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save known max" }));

    await waitFor(() => {
      expect(m.saveKnownExerciseMax).toHaveBeenCalledWith(expect.anything(), {
        athleteId: "coach-1",
        exerciseId: "barbell-back-squat",
        estimated1RMKg: 140,
        programId: "prog-1",
      });
    });
    expect(screen.getByText("known-max:140")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Week 2" }));
    expect(await screen.findByText("known-max:140")).toBeInTheDocument();
  });
});

/**
 * The reverse direction: deleting a testing-week day or exercise used to
 * leave the real exercise(s) it came from stuck "Test max before"-ticked
 * forever, since nothing told them their test no longer exists. The next
 * "Sync testing week" click would then silently recreate exactly what was
 * just deleted, which read as the deletion not actually working. These
 * cover the fix — untickTestMaxBefore, wired into both the day-delete and
 * block-delete paths, gated on `week.is_testing_week`.
 */
describe("ProgramBuilder deleting from the testing week unticks 'Test max before' on the real exercise(s)", () => {
  beforeEach(() => {
    vi.mocked(m.updateBlockExercisesTestMaxBefore).mockReset().mockResolvedValue({ error: null });
    vi.mocked(m.deleteDay).mockReset().mockResolvedValue({ error: null });
    vi.mocked(m.deleteBlock).mockReset().mockResolvedValue({ error: null });
  });

  function renderWithTestingWeek() {
    return render(
      <ProgramBuilder
        initialProgram={makeProgram({
          weeks: [
            makeWeek({
              id: "week-1",
              position: 1,
              label: "Week 1",
              days: [
                makeDay({
                  id: "day-1",
                  blocks: [makeBlock({ id: "block-1", exercises: [makeExercise({ id: "ex-1", exercise_id: "barbell-back-squat", test_max_before: true })] })],
                }),
              ],
            }),
            makeWeek({
              id: "testing-week",
              position: 2,
              label: "Testing Week",
              is_testing_week: true,
              days: [
                makeDay({
                  id: "testing-day-1",
                  week_id: "testing-week",
                  label: "Push — Test",
                  position: 1,
                  blocks: [
                    makeBlock({
                      id: "testing-block-1",
                      day_id: "testing-day-1",
                      exercises: [makeExercise({ id: "ex-testing", block_id: "testing-block-1", exercise_id: "barbell-back-squat", test_max_before: false })],
                    }),
                  ],
                }),
                // A second day purely so the day-delete button (hidden when
                // a week has only one day) actually renders for the day
                // deletion test below.
                makeDay({ id: "testing-day-2", week_id: "testing-week", label: "Pull — Test", position: 2, blocks: [] }),
              ],
            }),
          ],
        })}
      />
    );
  }

  it("deleting the testing day unticks the real exercise it tested", async () => {
    const user = userEvent.setup();
    renderWithTestingWeek();

    await user.click(screen.getByRole("button", { name: "Testing Week" }));
    await user.click(screen.getByRole("button", { name: "Delete Push — Test" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(m.deleteDay).toHaveBeenCalledWith(expect.anything(), "testing-day-1");
    await waitFor(() => expect(m.updateBlockExercisesTestMaxBefore).toHaveBeenCalledWith(expect.anything(), ["ex-1"], false));

    await user.click(screen.getByRole("button", { name: "Week 1" }));
    expect(await screen.findByText("not-flagged")).toBeInTheDocument();
  });

  it("deleting the testing block (single-exercise) unticks the real exercise it tested", async () => {
    const user = userEvent.setup();
    renderWithTestingWeek();

    await user.click(screen.getByRole("button", { name: "Testing Week" }));
    await user.click(screen.getByRole("button", { name: "Delete block on Push — Test" }));

    expect(m.deleteBlock).toHaveBeenCalledWith(expect.anything(), "testing-block-1");
    await waitFor(() => expect(m.updateBlockExercisesTestMaxBefore).toHaveBeenCalledWith(expect.anything(), ["ex-1"], false));

    await user.click(screen.getByRole("button", { name: "Week 1" }));
    expect(await screen.findByText("not-flagged")).toBeInTheDocument();
  });

  it("does NOT untick anything when deleting a day/block from a normal (non-testing) week", async () => {
    const user = userEvent.setup();
    renderWithTestingWeek();

    // Week 1 has 2+ blocks? No — it has just one day, so the day-delete
    // button isn't offered there; delete the block instead, which is
    // always offered.
    await user.click(screen.getByRole("button", { name: "Delete block on Day 1" }));

    expect(m.deleteBlock).toHaveBeenCalledWith(expect.anything(), "block-1");
    expect(m.updateBlockExercisesTestMaxBefore).not.toHaveBeenCalled();
  });
});
