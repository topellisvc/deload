import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAthleteInjuryProfile, getAthleteSummary, getExerciseMaxHistory, getPersonalRecords } from "./queries";
import { getMyCoaches, getLinkedProfile } from "@/lib/coaching/queries";
import type { CoachClient } from "@/lib/supabase/types";

vi.mock("@/lib/coaching/queries", () => ({
  getMyCoaches: vi.fn(),
  getLinkedProfile: vi.fn(),
}));

/** Minimal stand-in for Supabase's chainable, thenable query builder: every
 * chain method (select/eq/order/limit/...) returns the same object, and
 * `then` resolves it directly, so both `await ...builder` and
 * `await ...builder.maybeSingle()` work depending on which the code under
 * test actually calls. */
function makeBuilder(result: { data: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, ReturnType<typeof vi.fn>> & { then: unknown };
}

function makeCoach(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    id: "rel-1",
    coach_id: "coach-1",
    client_id: "athlete-1",
    client_email: "athlete@example.com",
    coach_email: "coach@example.com",
    status: "active",
    invite_message: null,
    accepted_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getAthleteSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("selects the athlete's is_active program rather than the most recently updated one", async () => {
    vi.mocked(getMyCoaches).mockResolvedValue([makeCoach()]);
    vi.mocked(getLinkedProfile).mockResolvedValue({ display_name: "Coach Jamie", bio: null });

    const programBuilder = makeBuilder({ data: { id: "program-active", name: "Active Program" } });
    const weeksBuilder = makeBuilder({ data: [] });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "programs") return programBuilder;
        if (table === "program_weeks") return weeksBuilder;
        return makeBuilder({ data: [] });
      }),
    };

    const summary = await getAthleteSummary(supabase as never, "athlete-1");

    expect(summary?.currentProgram).toEqual({ id: "program-active", name: "Active Program" });
    // This is the actual bug: the old query ordered programs by
    // updated_at and took the first result, which surfaces whichever
    // program the coach last *edited* — not the one flagged is_active,
    // i.e. the one the athlete is actually training on. Pinning the
    // filter here keeps that regression from creeping back in.
    expect(programBuilder.eq).toHaveBeenCalledWith("is_active", true);
    expect(programBuilder.order).not.toHaveBeenCalled();
    expect(programBuilder.limit).not.toHaveBeenCalled();
  });

  it("returns null when the athlete has no accepted coach relationship", async () => {
    vi.mocked(getMyCoaches).mockResolvedValue([]);
    const supabase = { from: vi.fn(() => makeBuilder({ data: null })) };

    const summary = await getAthleteSummary(supabase as never, "athlete-1");

    expect(summary).toBeNull();
  });

  it("returns null currentProgram when the coach has no active program for this athlete", async () => {
    vi.mocked(getMyCoaches).mockResolvedValue([makeCoach()]);
    vi.mocked(getLinkedProfile).mockResolvedValue({ display_name: "Coach Jamie", bio: null });

    const programBuilder = makeBuilder({ data: null });
    const supabase = { from: vi.fn(() => programBuilder) };

    const summary = await getAthleteSummary(supabase as never, "athlete-1");

    expect(summary?.currentProgram).toBeNull();
    expect(summary?.completionPercent).toBeNull();
  });
});

describe("getPersonalRecords — merging in exercise_max_records (migration 0054)", () => {
  it("merges the latest exercise_max_records row per exercise into the same PersonalRecord[] shape, prefixed 'exercise:'", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "personal_records") return makeBuilder({ data: [{ id: "pr-1", user_id: "athlete-1", record_type: "squat", value_number: 150, unit: "kg", achieved_on: "2026-01-01", created_at: "x", updated_at: "x" }] });
        if (table === "exercise_max_records")
          return makeBuilder({
            data: [
              { exercise_id: "bulgarian-split-squat", estimated_1rm_kg: 60, performed_on: "2026-07-01" },
              // An earlier test for the same exercise — only the latest
              // (newest performed_on, already sorted first by the query's
              // own .order()) should survive the merge.
              { exercise_id: "bulgarian-split-squat", estimated_1rm_kg: 50, performed_on: "2026-06-01" },
            ],
          });
        return makeBuilder({ data: [] });
      }),
    };

    const records = await getPersonalRecords(supabase as never, "athlete-1");

    expect(records).toContainEqual(expect.objectContaining({ record_type: "squat", value_number: 150 }));
    const exerciseRecord = records.find((r) => r.record_type === "exercise:bulgarian-split-squat");
    expect(exerciseRecord).toMatchObject({ value_number: 60, achieved_on: "2026-07-01" });
    // The 50kg entry from the earlier test never made it in as its own row.
    expect(records.filter((r) => r.record_type === "exercise:bulgarian-split-squat")).toHaveLength(1);
  });

  it("returns just personal_records when the athlete has never logged a max-test set", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "personal_records") return makeBuilder({ data: [{ id: "pr-1", user_id: "athlete-1", record_type: "run_5k", value_number: 1200, unit: "seconds", achieved_on: null, created_at: "x", updated_at: "x" }] });
        return makeBuilder({ data: [] });
      }),
    };

    const records = await getPersonalRecords(supabase as never, "athlete-1");

    expect(records).toHaveLength(1);
    expect(records[0]!.record_type).toBe("run_5k");
  });
});

describe("getExerciseMaxHistory", () => {
  it("groups every test by exercise, newest first, with names resolved from the Exercise Library", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "exercise_max_records")
          return makeBuilder({
            data: [
              { exercise_id: "back-squat", estimated_1rm_kg: 160, performed_on: "2026-07-15" },
              { exercise_id: "back-squat", estimated_1rm_kg: 150, performed_on: "2026-06-01" },
              { exercise_id: "bench-press", estimated_1rm_kg: 100, performed_on: "2026-07-10" },
            ],
          });
        if (table === "exercises")
          return makeBuilder({ data: [{ id: "back-squat", name: "Barbell Back Squat" }, { id: "bench-press", name: "Barbell Bench Press" }] });
        return makeBuilder({ data: [] });
      }),
    };

    const history = await getExerciseMaxHistory(supabase as never, "athlete-1");

    expect(history.size).toBe(2);
    const squatHistory = history.get("back-squat");
    expect(squatHistory).toHaveLength(2);
    expect(squatHistory![0]).toMatchObject({ exerciseName: "Barbell Back Squat", estimated1RMKg: 160, performedOn: "2026-07-15" });
    expect(squatHistory![1]).toMatchObject({ estimated1RMKg: 150, performedOn: "2026-06-01" });
    expect(history.get("bench-press")).toHaveLength(1);
  });

  it("returns an empty map when nothing has ever been tested", async () => {
    const supabase = { from: vi.fn(() => makeBuilder({ data: [] })) };

    const history = await getExerciseMaxHistory(supabase as never, "athlete-1");

    expect(history.size).toBe(0);
  });
});

describe("getAthleteInjuryProfile", () => {
  it("returns the stored profile, defaulting any missing fields", async () => {
    const supabase = { from: vi.fn(() => makeBuilder({ data: { injuries: { shoulder: true, knee: { presentation: "unsure" } } } })) };

    const injuries = await getAthleteInjuryProfile(supabase as never, "athlete-1");

    expect(injuries).toEqual({ shoulder: true, wrist: false, elbow: false, lowerBack: null, knee: { presentation: "unsure" }, hip: null });
  });

  it("defaults to nothing flagged when no row exists yet", async () => {
    const supabase = { from: vi.fn(() => makeBuilder({ data: null })) };

    const injuries = await getAthleteInjuryProfile(supabase as never, "athlete-1");

    expect(injuries).toEqual({ shoulder: false, wrist: false, elbow: false, lowerBack: null, knee: null, hip: null });
  });
});
