import { describe, expect, it } from "vitest";
import { skipRemainingDays } from "./mutations";

/** Enough of the Supabase fluent query builder for createSessionLog's own
 * insert().select().single() chain — skipRemainingDays is tested through
 * the real createSessionLog rather than a mock of it, since both live in
 * this same module. `failFor` lets a specific training_day_id simulate the
 * unique-constraint violation createSessionLog already turns into "Already
 * logged for this date." */
function makeSupabase(failFor: Set<string> = new Set(), genuineFailFor: Set<string> = new Set()) {
  return {
    from: (table: string) => {
      if (table !== "session_logs") throw new Error(`unexpected table ${table}`);
      return {
        insert: (row: { training_day_id: string }) => ({
          select: () => ({
            single: async () => {
              if (genuineFailFor.has(row.training_day_id)) {
                return { data: null, error: { code: "500", message: "boom" } };
              }
              if (failFor.has(row.training_day_id)) {
                return { data: null, error: { code: "23505", message: "duplicate" } };
              }
              return { data: { id: `log-${row.training_day_id}`, ...row }, error: null };
            },
          }),
        }),
      };
    },
  };
}

describe("skipRemainingDays", () => {
  it("skips every day given and reports the count", async () => {
    const supabase = makeSupabase();
    const result = await skipRemainingDays(supabase as never, {
      trainingDayIds: ["day-1", "day-2", "day-3"],
      athleteId: "athlete-1",
      performedOn: "2026-07-30",
    });
    expect(result.skippedCount).toBe(3);
    expect(result.error).toBeNull();
  });

  it("treats an already-logged day as a non-failure, not a genuine error", async () => {
    const supabase = makeSupabase(new Set(["day-2"]));
    const result = await skipRemainingDays(supabase as never, {
      trainingDayIds: ["day-1", "day-2"],
      athleteId: "athlete-1",
      performedOn: "2026-07-30",
    });
    expect(result.skippedCount).toBe(1);
    expect(result.error).toBeNull();
  });

  it("surfaces an error when a day genuinely fails to skip", async () => {
    const supabase = makeSupabase(new Set(), new Set(["day-2"]));
    const result = await skipRemainingDays(supabase as never, {
      trainingDayIds: ["day-1", "day-2"],
      athleteId: "athlete-1",
      performedOn: "2026-07-30",
    });
    expect(result.skippedCount).toBe(1);
    expect(result.error).not.toBeNull();
  });

  it("returns zero skipped with no error for an empty list", async () => {
    const supabase = makeSupabase();
    const result = await skipRemainingDays(supabase as never, { trainingDayIds: [], athleteId: "athlete-1", performedOn: "2026-07-30" });
    expect(result.skippedCount).toBe(0);
    expect(result.error).toBeNull();
  });
});
