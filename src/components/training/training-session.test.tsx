// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrainingSession } from "./training-session";
import type { DraftSet, TrainingModeSession } from "@/lib/training/types";
import type { BlockExerciseRow } from "@/lib/programs/types";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

// The full state machine (exercise sequencing, superset interleaving, rest
// timers, resume-step derivation) is out of scope here — that's
// integration-level territory already covered by live testing (tasks
// #8-#11). These tests only exercise the two things ProgramBuilder-style
// unit coverage can actually add value on: the skip-workout confirm branch
// (only prompts once something's actually been logged) and the
// beforeunload guard (blocks the tab from closing mid-save). Every screen
// component is stubbed down to just the props these two behaviors touch.
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
  ExerciseScreen: ({ onSkipWorkout, busy }: { onSkipWorkout: () => void; busy: boolean }) => (
    <div>
      <button type="button" onClick={onSkipWorkout} disabled={busy}>
        Skip workout
      </button>
    </div>
  ),
}));
vi.mock("@/components/training/rest-screen", () => ({ RestScreen: () => null }));
vi.mock("@/components/training/exercise-complete-screen", () => ({ ExerciseCompleteScreen: () => null }));
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
    },
  ],
};

// Real buildExerciseSequence/findResumeStepIndex depend on the full block
// tree and superset-interleaving rules — none of that matters for these two
// behaviors, so it's replaced with a fixed one-step sequence and a resume
// index that always lands on that same step.
vi.mock("@/lib/training/sequence", () => ({
  buildExerciseSequence: () => [{ blockExercise: FAKE_EXERCISE }],
  buildSetTargets: () => [{ id: "target-1", rest_seconds: null }],
  findResumeStepIndex: () => 0,
}));
vi.mock("@/lib/training/estimate-duration", () => ({ estimateWorkoutDurationSeconds: () => 0 }));
vi.mock("@/lib/training/totals", () => ({ computeWorkoutTotals: () => ({}) }));
vi.mock("@/lib/training/queries", () => ({ isProgramComplete: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/training/mutations", () => ({
  saveDraftSession: vi.fn(),
  deleteDraftSession: vi.fn(),
  finishWorkout: vi.fn(),
}));
vi.mock("@/lib/logging/mutations", () => ({ createSessionLog: vi.fn() }));

import { saveDraftSession, deleteDraftSession } from "@/lib/training/mutations";
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
    performedDistanceMeters: null,
    performedDurationSeconds: null,
    performedPaceSecondsPerKm: null,
    performedHeartRate: null,
    performedCalories: null,
    notes: null,
    ...overrides,
  };
}

describe("TrainingSession skip-workout confirm", () => {
  beforeEach(() => {
    vi.mocked(saveDraftSession).mockReset();
    vi.mocked(deleteDraftSession).mockReset().mockResolvedValue(undefined);
    vi.mocked(createSessionLog).mockReset().mockResolvedValue({ log: null, error: null });
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("skips immediately with no confirm dialog when nothing has been logged yet (Overview)", async () => {
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

  it("requires confirmation before skipping once a set has already been logged, and doesn't skip until confirmed", async () => {
    const user = userEvent.setup();
    const initialDraft: TrainingModeSession = {
      id: "session-1",
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      startedAt: "2026-07-25T09:00:00.000Z",
      updatedAt: "2026-07-25T09:00:00.000Z",
      draftSets: [makeDraftSet()],
      exerciseNotes: {},
      workoutNote: null,
    };
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "Skip workout" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Skip this workout?")).toBeInTheDocument();
    expect(within(dialog).getByText(/won't be saved/)).toBeInTheDocument();
    expect(createSessionLog).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Skip" }));

    expect(createSessionLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ trainingDayId: "day-1", athleteId: "athlete-1", skipped: true })
    );
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("does not skip when the confirm dialog is dismissed instead of confirmed", async () => {
    const user = userEvent.setup();
    const initialDraft: TrainingModeSession = {
      id: "session-1",
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      startedAt: "2026-07-25T09:00:00.000Z",
      updatedAt: "2026-07-25T09:00:00.000Z",
      draftSets: [makeDraftSet()],
      exerciseNotes: {},
      workoutNote: null,
    };
    render(<TrainingSession {...BASE_PROPS} initialDraft={initialDraft} />);

    await user.click(screen.getByRole("button", { name: "Skip workout" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createSessionLog).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
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
