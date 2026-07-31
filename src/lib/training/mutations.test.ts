import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyJointLadderStep, createJointCheckAnswer, finishWorkout } from "./mutations";
import { createSessionLog, createLoggedSet, completeSessionLog } from "@/lib/logging/mutations";
import { listExercises } from "@/lib/exercises/queries";
import { getAthleteInjuryProfile } from "@/lib/profile/queries";
import { upsertPersonalRecord } from "@/lib/profile/mutations";
import type { DraftSet } from "./types";

vi.mock("@/lib/logging/mutations", () => ({
  createSessionLog: vi.fn(),
  createLoggedSet: vi.fn(),
  completeSessionLog: vi.fn(),
}));

vi.mock("@/lib/dates", () => ({ todayDateString: () => "2026-07-27" }));

vi.mock("@/lib/exercises/queries", () => ({ listExercises: vi.fn() }));
vi.mock("@/lib/profile/queries", () => ({ getAthleteInjuryProfile: vi.fn() }));
vi.mock("@/lib/profile/mutations", () => ({ upsertPersonalRecord: vi.fn() }));

// Enough of the Supabase client's fluent query builder to satisfy
// finishWorkout's "does a session_logs row already exist for today"
// lookup, deleteDraftSession's delete, and saveMaxTestRecords' two lookups
// (set_prescriptions, then block_exercises for exercise_id) plus its
// exercise_max_records insert — everything else finishWorkout does goes
// through the mocked logging/mutations and profile/mutations functions
// above. maxTestRows defaults to none, so existing tests that don't care
// about the max-test path see saveMaxTestRecords return early without ever
// reaching upsertPersonalRecord or the exercise_max_records insert.
//
// blockExercises defaults to one row mapping makeDraftSet's default
// blockExerciseId ("ex-1") to a resolvable exercise_id, since most of this
// describe block's tests use that default — tests that care about the
// exercise_max_records path specifically pass their own.
//
// exerciseMaxInserts is a plain array (not a vi.fn(), since it needs to
// collect payloads across however many rows saveMaxTestRecords writes) that
// tests can inspect after the call to assert what got written.
function makeSupabase(
  existing: { id: string } | null,
  maxTestRows: { id: string; pr_record_type: string | null; rir_value?: number | null }[] = [],
  options: { blockExercises?: { id: string; exercise_id: string | null }[]; exerciseMaxInserts?: Record<string, unknown>[] } = {}
) {
  const blockExercises = options.blockExercises ?? [{ id: "ex-1", exercise_id: "exercise-1" }];
  const exerciseMaxInserts = options.exerciseMaxInserts ?? [];
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
      if (table === "set_prescriptions") {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: maxTestRows, error: null }),
            }),
          }),
        };
      }
      if (table === "block_exercises") {
        return {
          select: () => ({
            in: async () => ({ data: blockExercises, error: null }),
          }),
        };
      }
      if (table === "exercise_max_records") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            exerciseMaxInserts.push(payload);
            return { error: null };
          },
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
      readiness: null,
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
      readiness: null,
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
      readiness: null,
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
      readiness: null,
    });

    const positions = vi
      .mocked(createLoggedSet)
      .mock.calls.filter(([, params]) => params.blockExerciseId === "ex-3")
      .map(([, params]) => params.position);
    expect(positions).toHaveLength(2);
    expect(new Set(positions).size).toBe(2);
  });
});

describe("finishWorkout — auto-saving a personal record from a logged max-test set", () => {
  beforeEach(() => {
    vi.mocked(createSessionLog).mockReset().mockResolvedValue({ log: { id: "log-1" } as never, error: null });
    vi.mocked(completeSessionLog).mockReset().mockResolvedValue({ error: null });
    vi.mocked(createLoggedSet).mockReset().mockResolvedValue({ log: null, error: null });
    vi.mocked(upsertPersonalRecord).mockReset().mockResolvedValue({ record: null, error: null });
  });

  it("computes an e1RM and writes it to personal_records when the logged set's prescription is flagged is_max_test", async () => {
    const supabase = makeSupabase(null, [{ id: "set-1", pr_record_type: "squat" }]) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", performedWeight: 100, performedReps: 5, performedRir: 1 })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(upsertPersonalRecord).toHaveBeenCalledWith(
      supabase,
      "athlete-1",
      expect.objectContaining({ recordType: "squat", unit: "kg", achievedOn: "2026-07-27", valueNumber: expect.any(Number) })
    );
  });

  it("never writes a personal record for an ordinary logged set whose prescription isn't flagged is_max_test", async () => {
    // No rows come back from the set_prescriptions lookup — set-1 exists,
    // but wasn't a max test (e.g. it's a percent_1rm row that merely shares
    // the same pr_record_type for display purposes).
    const supabase = makeSupabase(null, []) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", performedWeight: 100, performedReps: 5, performedRir: 1 })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(upsertPersonalRecord).not.toHaveBeenCalled();
  });

  it("skips the auto-save (fails open) when RIR wasn't logged AND the set has no prescribed rir_value either", async () => {
    const supabase = makeSupabase(null, [{ id: "set-1", pr_record_type: "squat", rir_value: null }]) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", performedWeight: 100, performedReps: 5, performedRir: null })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(upsertPersonalRecord).not.toHaveBeenCalled();
  });

  /**
   * Regression test: Training Mode's own logger never asks for RIR at all
   * (strength-set-logger.tsx has weight and reps inputs only), so every max
   * test logged through it had performedRir: null — meaning the OLD guard
   * here (skip whenever performedRir is null) silently skipped the
   * auto-save for every single Training-Mode-logged test, no matter how
   * many were logged. Falling back to the set's own prescribed rir_value
   * (which syncTestingWeek/the generator always set, e.g. 1) is what makes
   * this resolve at all.
   */
  it("falls back to the set's own prescribed rir_value when performedRir wasn't logged (Training Mode's case)", async () => {
    const supabase = makeSupabase(null, [{ id: "set-1", pr_record_type: "squat", rir_value: 1 }]) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", performedWeight: 100, performedReps: 5, performedRir: null })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(upsertPersonalRecord).toHaveBeenCalledWith(
      supabase,
      "athlete-1",
      expect.objectContaining({ recordType: "squat", unit: "kg", achievedOn: "2026-07-27", valueNumber: expect.any(Number) })
    );
  });

  it("prefers the athlete's own reported RIR over the prescribed rir_value when both are present", async () => {
    // Prescribed rir_value is 1, but the athlete reported grinding it out at
    // RIR 0 — the real report of what happened should win.
    const supabase = makeSupabase(null, [{ id: "set-1", pr_record_type: "squat", rir_value: 1 }]) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", performedWeight: 100, performedReps: 5, performedRir: 0 })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    // RIR 0 at 5 reps -> 86% -> e1RM ~116.3, vs RIR 1 -> 84% -> ~119.0.
    // Asserting the RIR-0 figure confirms the reported value was actually
    // used, not silently ignored in favor of the prescribed one.
    const call = vi.mocked(upsertPersonalRecord).mock.calls[0]!;
    expect(call[2].valueNumber).toBeCloseTo(116.3, 1);
  });
});

describe("finishWorkout — auto-saving to exercise_max_records (migration 0054's per-exercise library)", () => {
  beforeEach(() => {
    vi.mocked(createSessionLog).mockReset().mockResolvedValue({ log: { id: "log-1" } as never, error: null });
    vi.mocked(completeSessionLog).mockReset().mockResolvedValue({ error: null });
    vi.mocked(createLoggedSet).mockReset().mockResolvedValue({ log: null, error: null });
    vi.mocked(upsertPersonalRecord).mockReset().mockResolvedValue({ record: null, error: null });
  });

  it("writes an exercise_max_records row keyed by this set's own exercise_id, even for a main lift with pr_record_type set", async () => {
    const exerciseMaxInserts: Record<string, unknown>[] = [];
    const supabase = makeSupabase(null, [{ id: "set-1", pr_record_type: "squat" }], {
      blockExercises: [{ id: "ex-1", exercise_id: "barbell-back-squat" }],
      exerciseMaxInserts,
    }) as never;

    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", blockExerciseId: "ex-1", performedWeight: 100, performedReps: 5, performedRir: 1 })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(exerciseMaxInserts).toHaveLength(1);
    expect(exerciseMaxInserts[0]).toMatchObject({
      athlete_id: "athlete-1",
      exercise_id: "barbell-back-squat",
      performed_on: "2026-07-27",
    });
    expect(typeof exerciseMaxInserts[0]!.estimated_1rm_kg).toBe("number");
  });

  it("writes an exercise_max_records row for the manual builder's per-exercise 'Test max before' flow, which never sets pr_record_type", async () => {
    const exerciseMaxInserts: Record<string, unknown>[] = [];
    // pr_record_type null — exactly what syncTestingWeek's generated sets
    // carry (see lib/programs/mutations.ts) — no personal_records write
    // should happen, but the exercise_max_records write still should.
    const supabase = makeSupabase(null, [{ id: "set-1", pr_record_type: null }], {
      blockExercises: [{ id: "ex-1", exercise_id: "bulgarian-split-squat" }],
      exerciseMaxInserts,
    }) as never;

    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", blockExerciseId: "ex-1", performedWeight: 60, performedReps: 5, performedRir: 1 })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(upsertPersonalRecord).not.toHaveBeenCalled();
    expect(exerciseMaxInserts).toHaveLength(1);
    expect(exerciseMaxInserts[0]).toMatchObject({ athlete_id: "athlete-1", exercise_id: "bulgarian-split-squat" });
  });

  it("writes to exercise_max_records for a Training-Mode-logged test (no performedRir) via the prescribed rir_value fallback", async () => {
    const exerciseMaxInserts: Record<string, unknown>[] = [];
    const supabase = makeSupabase(null, [{ id: "set-1", pr_record_type: null, rir_value: 1 }], {
      blockExercises: [{ id: "ex-1", exercise_id: "barbell-back-squat" }],
      exerciseMaxInserts,
    }) as never;

    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", blockExerciseId: "ex-1", performedWeight: 110, performedReps: 5, performedRir: null })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(exerciseMaxInserts).toHaveLength(1);
    expect(exerciseMaxInserts[0]).toMatchObject({ athlete_id: "athlete-1", exercise_id: "barbell-back-squat" });
  });

  it("never writes to exercise_max_records for an ordinary (non-max-test) logged set", async () => {
    const exerciseMaxInserts: Record<string, unknown>[] = [];
    const supabase = makeSupabase(null, [], { exerciseMaxInserts }) as never;

    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [makeDraftSet({ setPrescriptionId: "set-1", performedWeight: 100, performedReps: 5, performedRir: 1 })],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(exerciseMaxInserts).toHaveLength(0);
  });
});

describe("finishWorkout — Rule 3's readiness note", () => {
  beforeEach(() => {
    vi.mocked(createSessionLog).mockReset().mockResolvedValue({ log: { id: "log-1" } as never, error: null });
    vi.mocked(completeSessionLog).mockReset().mockResolvedValue({ error: null });
    vi.mocked(createLoggedSet).mockReset().mockResolvedValue({ log: null, error: null });
  });

  it("prepends a plain-language note when both sleep and soreness triggered a downregulation", async () => {
    const supabase = makeSupabase(null) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: "Felt okay overall.",
      readiness: { sleep: "bad", soreness: "beat_up" },
    });

    expect(createSessionLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ note: expect.stringContaining("Reduced load today") })
    );
    expect(createSessionLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ note: expect.stringContaining("Felt okay overall.") }));
  });

  it("leaves the note untouched when readiness didn't trigger a downregulation", async () => {
    const supabase = makeSupabase(null) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: "Felt okay overall.",
      readiness: { sleep: "ok", soreness: "normal" },
    });

    expect(createSessionLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ note: "Felt okay overall." }));
  });

  it("leaves a null workout note as null when readiness didn't trigger a downregulation", async () => {
    const supabase = makeSupabase(null) as never;
    await finishWorkout(supabase, {
      trainingDayId: "day-1",
      athleteId: "athlete-1",
      draftSets: [],
      exerciseNotes: {},
      skippedExercises: {},
      workoutNote: null,
      readiness: null,
    });

    expect(createSessionLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ note: null }));
  });
});

describe("createJointCheckAnswer", () => {
  it("inserts one row onto joint_check_answers", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const supabase = { from: vi.fn(() => ({ insert })) } as never;

    const result = await createJointCheckAnswer(supabase, { athleteId: "athlete-1", joint: "shoulder", answer: "worse" });

    expect(result.error).toBeNull();
    expect(insert).toHaveBeenCalledWith({ athlete_id: "athlete-1", joint: "shoulder", answer: "worse" });
  });

  it("surfaces a friendly error rather than the raw Postgres message", async () => {
    const insert = vi.fn(async () => ({ error: { message: "boom" } }));
    const supabase = { from: vi.fn(() => ({ insert })) } as never;

    const result = await createJointCheckAnswer(supabase, { athleteId: "athlete-1", joint: "knee", answer: "better" });

    expect(result.error).toBe("Couldn't record that answer. Try again.");
  });
});

describe("applyJointLadderStep", () => {
  function ex(id: string, slotPatterns: string[], demandRank: number, overrides: Record<string, unknown> = {}) {
    return {
      id,
      is_archived: false,
      review_status: "approved",
      movement_pattern: null,
      primary_muscle_group: "full_body",
      metadata: { slot_patterns: slotPatterns, demand_rank: Object.fromEntries(slotPatterns.map((p) => [p, demandRank])) },
      ...overrides,
    };
  }

  /** Builds a fake Supabase client wired for applyJointLadderStep's exact
   * read chain (program_weeks -> training_days -> exercise_blocks ->
   * block_exercises), plus an update().eq().select() chain for
   * block_exercises whose result is controlled by `updateResult`, and a
   * no-op autoregulation_events insert (applyJointLadderStep fires one of
   * these, best-effort, per successful substitution). */
  function makeSupabase(blockExercises: { id: string; exercise_id: string }[], updateResult: { data: unknown[] | null; error: unknown } = { data: [{ id: "x" }], error: null }) {
    const updateCalls: { id: string; exercise_id: string }[] = [];
    const insertedEvents: Record<string, unknown>[] = [];
    return {
      from: vi.fn((table: string) => {
        if (table === "program_weeks") {
          return { select: () => ({ eq: () => ({ gte: async () => ({ data: [{ id: "week-1" }] }) }) }) };
        }
        if (table === "training_days") {
          return { select: () => ({ in: async () => ({ data: [{ id: "day-1" }] }) }) };
        }
        if (table === "exercise_blocks") {
          return { select: () => ({ in: async () => ({ data: [{ id: "block-1" }] }) }) };
        }
        if (table === "autoregulation_events") {
          return {
            insert: async (row: Record<string, unknown>) => {
              insertedEvents.push(row);
              return { error: null };
            },
          };
        }
        if (table === "block_exercises") {
          return {
            select: () => ({ in: () => ({ not: async () => ({ data: blockExercises }) }) }),
            update: (patch: { exercise_id: string }) => ({
              eq: (_col: string, id: string) => {
                updateCalls.push({ id, exercise_id: patch.exercise_id });
                return { select: async () => updateResult };
              },
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
      updateCalls,
      insertedEvents,
    };
  }

  const pullLibrary = [
    ex("lat-pulldown", ["vertical_pull"], 50),
    ex("pull-up", ["vertical_pull"], 20),
    ex("assisted-pull-up", ["vertical_pull"], 40),
  ];

  beforeEach(() => {
    vi.mocked(getAthleteInjuryProfile).mockReset().mockResolvedValue({
      shoulder: false,
      wrist: false,
      elbow: false,
      lowerBack: null,
      knee: null,
      hip: null,
    });
  });

  it("regresses a matching block_exercise one rung down its pattern's ladder", async () => {
    vi.mocked(listExercises).mockResolvedValue(pullLibrary as never);
    const { updateCalls, insertedEvents, ...supabase } = makeSupabase([{ id: "be-1", exercise_id: "pull-up" }]);

    const result = await applyJointLadderStep(supabase as never, {
      athleteId: "athlete-1",
      programId: "program-1",
      fromWeekPosition: 1,
      joint: "shoulder",
      direction: "regress",
    });

    expect(result).toEqual({ updatedCount: 1, skippedCount: 0, error: null });
    expect(updateCalls).toEqual([{ id: "be-1", exercise_id: "assisted-pull-up" }]);
    // One autoregulation_events row per substitution, so a coach can see why
    // the exercise itself changed — same rationale as Rule 1's events.
    expect(insertedEvents).toEqual([
      {
        athlete_id: "athlete-1",
        block_exercise_id: "be-1",
        kind: "joint_regress",
        detail: { joint: "shoulder", fromExerciseId: "pull-up", toExerciseId: "assisted-pull-up" },
      },
    ]);
  });

  it("leaves an exercise alone when it isn't tagged for the flagged joint's patterns", async () => {
    vi.mocked(listExercises).mockResolvedValue([ex("bench-press", ["horizontal_push"], 10)] as never);
    const { updateCalls, ...supabase } = makeSupabase([{ id: "be-1", exercise_id: "bench-press" }]);

    const result = await applyJointLadderStep(supabase as never, {
      athleteId: "athlete-1",
      programId: "program-1",
      fromWeekPosition: 1,
      joint: "knee",
      direction: "regress",
    });

    expect(result).toEqual({ updatedCount: 0, skippedCount: 0, error: null });
    expect(updateCalls).toEqual([]);
  });

  it("leaves an exercise alone when it's already at the bottom of its ladder", async () => {
    vi.mocked(listExercises).mockResolvedValue(pullLibrary as never);
    const { updateCalls, ...supabase } = makeSupabase([{ id: "be-1", exercise_id: "lat-pulldown" }]);

    const result = await applyJointLadderStep(supabase as never, {
      athleteId: "athlete-1",
      programId: "program-1",
      fromWeekPosition: 1,
      joint: "shoulder",
      direction: "regress",
    });

    expect(result).toEqual({ updatedCount: 0, skippedCount: 0, error: null });
    expect(updateCalls).toEqual([]);
  });

  it("reports a skip rather than a false success when RLS blocks the write (owner-only, coach-assigned program)", async () => {
    vi.mocked(listExercises).mockResolvedValue(pullLibrary as never);
    const { updateCalls, ...supabase } = makeSupabase([{ id: "be-1", exercise_id: "pull-up" }], { data: [], error: null });

    const result = await applyJointLadderStep(supabase as never, {
      athleteId: "athlete-1",
      programId: "program-1",
      fromWeekPosition: 1,
      joint: "shoulder",
      direction: "regress",
    });

    expect(result).toEqual({ updatedCount: 0, skippedCount: 1, error: null });
    expect(updateCalls).toHaveLength(1);
  });

  it("excludes exercises the athlete's other flagged injuries rule out from the candidate pool", async () => {
    vi.mocked(listExercises).mockResolvedValue([
      ex("pull-up", ["vertical_pull"], 20),
      ex("assisted-pull-up", ["vertical_pull"], 40, { metadata: { slot_patterns: ["vertical_pull"], demand_rank: { vertical_pull: 40 }, injury_contraindications: ["wrist"] } }),
      ex("lat-pulldown", ["vertical_pull"], 50),
    ] as never);
    vi.mocked(getAthleteInjuryProfile).mockResolvedValue({
      shoulder: false,
      wrist: true,
      elbow: false,
      lowerBack: null,
      knee: null,
      hip: null,
    });
    const { updateCalls, ...supabase } = makeSupabase([{ id: "be-1", exercise_id: "pull-up" }]);

    const result = await applyJointLadderStep(supabase as never, {
      athleteId: "athlete-1",
      programId: "program-1",
      fromWeekPosition: 1,
      joint: "shoulder",
      direction: "regress",
    });

    // assisted-pull-up is excluded from the pool (wrist-contraindicated), so
    // the next rung down from pull-up is lat-pulldown, not assisted-pull-up.
    expect(result.updatedCount).toBe(1);
    expect(updateCalls).toEqual([{ id: "be-1", exercise_id: "lat-pulldown" }]);
  });
});
