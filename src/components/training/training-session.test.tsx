// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrainingSession } from "./training-session";
import type { DraftSet, TrainingModeSession } from "@/lib/training/types";
import type { BlockExerciseRow } from "@/lib/programs/types";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

// The full state machine (exercise navigation, rest timers, resume
// derivation) is out of scope here — that's
// integration-level territory already covered by live testing (tasks
// #8-#11). These tests only exercise the things ProgramBuilder-style unit
// coverage can actually add value on: the Overview screen's direct skip
// (nothing's logged yet, so no dialog), the mid-workout End Workout
// dialog's save/discard/cancel branches, and the beforeunload guard
// (blocks the tab from closing mid-save). Every screen component is
// stubbed down to just the props these behaviors touch.
vi.mock("@/components/training/workout-overview-screen", () => ({
  WorkoutOverviewScreen: ({
    onBegin,
    starting,
    onSkip,
    skipping,
  }: {
    onBegin: () => void;
    starting: boolean;
    onSkip: () => void;
    skipping: boolean;
  }) => (
    <div>
      <button type="button" onClick={onBegin} disabled={starting}>
        Begin
      </button>
      <button type="button" onClick={onSkip} disabled={skipping}>
        Skip workout
      </button>
    </div>
  ),
}));
vi.mock("@/components/training/exercise-screen", () => ({
  ExerciseScreen: ({
    onEndWorkout,
    onSkipExercise,
    onCompleteSet,
    busy,
  }: {
    onEndWorkout: () => void;
    onSkipExercise: () => void;
    onCompleteSet: (payload: { weight: number | null; reps: number | null; notes: string | null }) => void;
    busy: boolean;
  }) => (
    <div>
      <button type="button" onClick={onEndWorkout} disabled={busy}>
        End workout
      </button>
      <button type="button" onClick={onSkipExercise} disabled={busy}>
        Skip exercise
      </button>
      <button type="button" onClick={() => onCompleteSet({ weight: 100, reps: 8, notes: null })} disabled={busy}>
        Complete set
      </button>
    </div>
  ),
}));
vi.mock("@/components/training/rest-screen", () => ({ RestScreen: () => null }));
vi.mock("@/components/training/exercise-complete-screen", () => ({ ExerciseCompleteScreen: () => null }));
vi.mock("@/components/training/rir-check-screen", () => ({
  RirCheckScreen: ({ onAnswer, busy }: { onAnswer: (rir: 0 | 1 | 2 | 3) => void; busy: boolean }) => (
    <div>
      <button type="button" onClick={() => onAnswer(3)} disabled={busy}>
        RIR 3+
      </button>
      <button type="button" onClick={() => onAnswer(0)} disabled={busy}>
        RIR 0
      </button>
    </div>
  ),
}));
vi.mock("@/components/training/workout-summary-screen", () => ({ WorkoutSummaryScreen: () => null }));
vi.mock("@/components/training/program-complete-screen", () => ({ ProgramCompleteScreen: () => null }));

const FAKE_EXERCISE: BlockExerciseRow = {
  id: "ex-1",
  block_id: "block-1",
  position: 1,
  exercise_id: null,
  custom_name: "Bench Press",
  notes: null,
  exercise_category: "strength",
  sets: [
    {
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
    },
  ],
};

// Real buildExerciseList/findResumeExerciseId depend on the full block tree
// — none of that matters for these two behaviors, so it's replaced with a
// fixed one-exercise list and a resume id that always lands on it.
vi.mock("@/lib/training/sequence", () => ({
  buildExerciseList: vi.fn(() => [FAKE_EXERCISE]),
  buildSetTargets: vi.fn(() => [{ id: "target-1", rest_seconds: null }]),
  findResumeExerciseId: vi.fn(() => FAKE_EXERCISE.id),
}));
vi.mock("@/lib/training/estimate-duration", () => ({ estimateWorkoutDurationSeconds: () => 0 }));
vi.mock("@/lib/training/totals", () => ({ computeWorkoutTotals: () => ({}) }));
vi.mock("@/lib/training/queries", () => ({
  isProgramComplete: vi.fn().mockResolvedValue(false),
  getRecentAutoregulationEvents: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/training/mutations", () => ({
  saveDraftSession: vi.fn(),
  deleteDraftSession: vi.fn(),
  finishWorkout: vi.fn(),
  createAutoregulationEvent: vi.fn(),
}));
vi.mock("@/lib/logging/mutations", () => ({ createSessionLog: vi.fn() }));

import { saveDraftSession, deleteDraftSession, createAutoregulationEvent } from "@/lib/training/mutations";
import { getRecentAutoregulationEvents } from "@/lib/training/queries";
import { buildExerciseList } from "@/lib/training/sequence";
import { createSessionLog } from "@/lib/logging/mutations";

const BASE_PROPS = {
  trainingDayId: "day-1",
  athleteId: "athlete-1",
  programId: "prog-1",
  programName: "Push Pull Legs",
  weekLabel: "Week 1",
  weekPosition: 1,
  totalWeeks: 4,
  dayLabel: "Day 1",
  coachEmail: null,
  blocks: [],
  personalRecords: [],
  previousPerformance: {},
};

function makeDraftSet(overrides: Partial<DraftSet> = {}): DraftSet {
  return {
    blockExerciseId: "ex-1",
    setPrescriptionId: "set-1",
    position: 1,
    performedWeight: 100,
    performedReps: 8,
    performedRpe: null,
    performedRir: null,
    performedDistanceMeters: null,
    performedDurationSeconds: null,
    performedPaceSecondsPerKm: null,
    performedHeartRate: null,
    performedCalories: null,
    notes: null,
    ...overrides,
  };
}

describe("TrainingSession Overview skip", () => {
  beforeEach(() => {
    vi.mocked(saveDraftSession).mockReset();
    vi.mocked(deleteDraftSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(createSessionLog).mockReset().mockResolvedValue({ log: null, error: null });
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("skips immediately with no dialog when nothing has been logged yet", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={null} />);

    await user.click(screen.getByRole("button", { name: "Skip workout" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createSessionLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ trainingDayId: "day-1", athleteId: "athlete-1", skipped: true })
    );
    expect(deleteDraftSession).toHaveBeenCalledWith(expect.anything(), "day-1", "athlete-1");
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/dashboard"));
  });
});

describe("TrainingSession End Workout dialog", () => {
  const initialDraft: TrainingModeSession = {
    id: "session-1",
    trainingDayId: "day-1",
    athleteId: "athlete-1",
    startedAt: "2026-07-25T09:00:00.000Z",
    updatedAt: "2026-07-25T09:00:00.000Z",
    draftSets: [makeDraftSet()],
    exerciseNotes: {},
    skippedExercises: {},
    workoutNote: null,
  };

  beforeEach(() => {
    vi.mocked(saveDraftSession).mockReset();
    vi.mocked(deleteDraftSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(createSessionLog).mockReset().mockResolvedValue({ log: null, error: null });
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("offers Save & Finish or Discard, and doesn't act until one is chosen", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "End workout" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("End this workout early?")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Save & Finish/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Discard Workout/ })).toBeInTheDocument();
    expect(createSessionLog).not.toHaveBeenCalled();
  });

  it("Save & Finish leaves the exercise screen without discarding anything", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "End workout" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Save & Finish/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Moved off the exercise screen (mocked to render just this button) —
    // the real destination (WorkoutSummaryScreen) is mocked to null, so
    // "the End Workout button is gone" is what confirms the transition.
    expect(screen.queryByRole("button", { name: "End workout" })).not.toBeInTheDocument();
    expect(createSessionLog).not.toHaveBeenCalled();
    expect(deleteDraftSession).not.toHaveBeenCalled();
  });

  it("Discard Workout deletes the draft and logs a skip", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "End workout" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Discard Workout/ }));

    expect(createSessionLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ trainingDayId: "day-1", athleteId: "athlete-1", skipped: true })
    );
    expect(deleteDraftSession).toHaveBeenCalledWith(expect.anything(), "day-1", "athlete-1");
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("does nothing when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "End workout" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End workout" })).toBeInTheDocument();
    expect(createSessionLog).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

describe("TrainingSession Skip Exercise dialog", () => {
  const initialDraft: TrainingModeSession = {
    id: "session-1",
    trainingDayId: "day-1",
    athleteId: "athlete-1",
    startedAt: "2026-07-25T09:00:00.000Z",
    updatedAt: "2026-07-25T09:00:00.000Z",
    draftSets: [],
    exerciseNotes: {},
    skippedExercises: {},
    workoutNote: null,
  };

  beforeEach(() => {
    vi.mocked(saveDraftSession).mockReset().mockResolvedValue({ session: { ...initialDraft }, error: null });
  });

  it("opens with the exercise's name, and persists the reason on confirm", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "Skip exercise" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Skip Bench Press?")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText(/optional/i), { target: { value: "Shoulder felt tight" } });
    await user.click(within(dialog).getByRole("button", { name: /Skip This Exercise/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(saveDraftSession).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skippedExercises: { "ex-1": "Shoulder felt tight" } })
      )
    );
  });

  it("allows confirming with no reason given — it's optional, not required", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "Skip exercise" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Skip This Exercise/ }));

    await waitFor(() =>
      expect(saveDraftSession).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skippedExercises: { "ex-1": null } })
      )
    );
  });

  it("does nothing when cancelled", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "Skip exercise" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(saveDraftSession).not.toHaveBeenCalled();
  });
});

describe("TrainingSession beforeunload guard", () => {
  beforeEach(() => {
    vi.mocked(saveDraftSession).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("blocks tab close while a save is in flight, and stops blocking once it settles", async () => {
    let resolveSave!: (value: { session: TrainingModeSession | null; error: string | null }) => void;
    vi.mocked(saveDraftSession).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={null} />);

    await user.click(screen.getByRole("button", { name: "Begin" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Begin" })).toBeDisabled());

    const eventDuringSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(eventDuringSave);
    expect(eventDuringSave.defaultPrevented).toBe(true);

    resolveSave({
      session: {
        id: "session-1",
        trainingDayId: "day-1",
        athleteId: "athlete-1",
        startedAt: "2026-07-25T09:00:00.000Z",
        updatedAt: "2026-07-25T09:00:00.000Z",
        draftSets: [],
        exerciseNotes: {},
        skippedExercises: {},
        workoutNote: null,
      },
      error: null,
    });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Begin" })).not.toBeInTheDocument());

    const eventAfterSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(eventAfterSave);
    expect(eventAfterSave.defaultPrevented).toBe(false);
  });

  it("never blocks tab close while idle (no save in flight)", () => {
    render(<TrainingSession {...BASE_PROPS} initialDraft={null} />);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

describe("TrainingSession RIR check (Rule 1)", () => {
  const initialDraft: TrainingModeSession = {
    id: "session-1",
    trainingDayId: "day-1",
    athleteId: "athlete-1",
    startedAt: "2026-07-25T09:00:00.000Z",
    updatedAt: "2026-07-25T09:00:00.000Z",
    draftSets: [],
    exerciseNotes: {},
    skippedExercises: {},
    workoutNote: null,
  };

  beforeEach(() => {
    vi.mocked(saveDraftSession).mockReset().mockResolvedValue({ session: { ...initialDraft }, error: null });
    vi.mocked(getRecentAutoregulationEvents).mockReset().mockResolvedValue([]);
    vi.mocked(createAutoregulationEvent).mockReset().mockResolvedValue({ error: null });
    vi.mocked(buildExerciseList).mockReturnValue([FAKE_EXERCISE]);
  });

  it("does not enter the RIR check for an exercise the template didn't mark autoregulation-eligible", async () => {
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "Complete set" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Complete set" })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "RIR 3+" })).not.toBeInTheDocument();
    expect(getRecentAutoregulationEvents).not.toHaveBeenCalled();
  });

  it("asks the RIR question after the last set of an autoregulation-eligible exercise, and records an 'advance' event for 3+ RIR", async () => {
    vi.mocked(buildExerciseList).mockReturnValue([{ ...FAKE_EXERCISE, autoregulation_eligible: true }]);
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "Complete set" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "RIR 3+" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "RIR 3+" }));

    await waitFor(() =>
      expect(createAutoregulationEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ athleteId: "athlete-1", blockExerciseId: "ex-1", kind: "advance" })
      )
    );
    expect(getRecentAutoregulationEvents).toHaveBeenCalledWith(expect.anything(), { athleteId: "athlete-1", blockExerciseId: "ex-1" });
    // Patches the raw answer onto the draft set so Finish Workout can
    // persist it to logged_sets.performed_rir.
    await waitFor(() =>
      expect(saveDraftSession).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ draftSets: [expect.objectContaining({ performedRir: 3 })] })
      )
    );
  });

  it("holds (not advance) for 0 RIR, and still writes an event", async () => {
    vi.mocked(buildExerciseList).mockReturnValue([{ ...FAKE_EXERCISE, autoregulation_eligible: true }]);
    const user = userEvent.setup();
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "Complete set" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "RIR 0" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "RIR 0" }));

    await waitFor(() =>
      expect(createAutoregulationEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "hold" }))
    );
  });
});
