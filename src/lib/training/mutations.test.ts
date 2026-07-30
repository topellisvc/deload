import { describe, expect, it, vi, beforeEach } from "vitest";
import { finishWorkout } from "./mutations";
import { createSessionLog, createLoggedSet, completeSessionLog } from "@/lib/logging/mutations";
import type { DraftSet } from "./types";

vi.mock("@/lib/logging/mutations", () => ({
  createSessionLog: vi.fn(),
  createLoggedSet: vi.fn(),
  completeSessionLog: vi.fn(),
}));

vi.mock("@/lib/dates", () => ({ todayDateString: () => "2026-07-27" }));

// Enough of the Supabase client's fluent query builder to satisfy
// finishWorkout's "does a session_logs row already exist for today"
// lookup and deleteDraftSession's delete — everything else finishWorkout
// does goes through the mocked logging/mutations functions above.
function makeSupabase(existing: { id: string } | null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "session_logs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: existing, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "training_mode_sessions") {
        return {
          delete: () => ({
            eq: () => ({ eq: async () => ({ error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

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

describe("finishWorkout — skipped exercises", () => {
  beforeEach(() => {
    vi.mocked(createSessionLog).mockReset().mockResolvedValue({ log: { id: "log-1" } as never, error: null });
    vi.mocked(completeSessionLog).mockReset().mockResolvedValue({ error: null });
    vi.mocked(createLoggedSet).mockReset().mockResolvedValue({ log: null, error: null });
  });

  it("writes a notes-only row for a skipped exercise, formatted with its reason", async () => {
    const supabase = makeSupabase(null) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [],
      exerciseNotes: {},
      skippedExercises: { "ex-2": "Shoulder felt tight" },
      workoutNote: null,
    });

    expect(createLoggedSet).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ blockExerciseId: "ex-2", setPrescriptionId: null, position: 1, notes: "Skipped — Shoulder felt tight" })
    );
  });

  it("formats a reasonless skip as just 'Skipped'", async () => {
    const supabase = makeSupabase(null) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [],
      exerciseNotes: {},
      skippedExercises: { "ex-2": null },
      workoutNote: null,
    });

    expect(createLoggedSet).toHaveBeenCalledWith(supabase, expect.objectContaining({ blockExerciseId: "ex-2", notes: "Skipped" }));
  });

  it("never writes a skip row for an exercise that actually has real logged sets", async () => {
    const supabase = makeSupabase(null) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ blockExerciseId: "ex-1", position: 1 })],
      exerciseNotes: {},
      // Stale skip flag for an exercise that was, in fact, later trained —
      // the UI clears this client-side (see training-session.tsx's unskip),
      // but finishWorkout guards against it too.
      skippedExercises: { "ex-1": "changed my mind" },
      workoutNote: null,
    });

    const skipWrites = vi
      .mocked(createLoggedSet)
      .mock.calls.filter(([, params]) => typeof params.notes === "string" && params.notes.startsWith("Skipped"));
    expect(skipWrites).toHaveLength(0);
  });

  it("gives an exercise note and a skip reason on the same exercise distinct positions (avoids the logged_sets unique constraint)", async () => {
    const supabase = makeSupabase(null) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [],
      exerciseNotes: { "ex-3": "Felt strong today" },
      skippedExercises: { "ex-3": "actually skipped anyway" },
      workoutNote: null,
    });

    const positions = vi
      .mocked(createLoggedSet)
      .mock.calls.filter(([, params]) => params.blockExerciseId === "ex-3")
      .map(([, params]) => params.position);
    expect(positions).toHaveLength(2);
    expect(new Set(positions).size).toBe(2);
  });
});
