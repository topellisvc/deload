import { describe, expect, it } from "vitest";
import { upsertAthleteInjuryProfile } from "./mutations";

function makeSupabase(shouldError = false) {
  const upsertCalls: { table: string; row: unknown; options: unknown }[] = [];
  return {
    supabase: {
      from: (table: string) => ({
        upsert: (row: unknown, options: unknown) => {
          upsertCalls.push({ table, row, options });
          return Promise.resolve({ error: shouldError ? { message: "boom" } : null });
        },
      }),
    },
    upsertCalls,
  };
}

describe("upsertAthleteInjuryProfile", () => {
  it("upserts onto athlete_injury_profiles keyed by athlete_id", async () => {
    const { supabase, upsertCalls } = makeSupabase();
    const injuries = { shoulder: true, wrist: false, elbow: false, lowerBack: null, knee: null, hip: null };

    const result = await upsertAthleteInjuryProfile(supabase as never, { athleteId: "athlete-1", injuries });

    expect(result.error).toBeNull();
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]!.table).toBe("athlete_injury_profiles");
    expect(upsertCalls[0]!.row).toMatchObject({ athlete_id: "athlete-1", injuries });
    expect(upsertCalls[0]!.options).toEqual({ onConflict: "athlete_id" });
  });

  it("surfaces a friendly error rather than the raw Postgres message", async () => {
    const { supabase } = makeSupabase(true);
    const injuries = { shoulder: false, wrist: false, elbow: false, lowerBack: null, knee: null, hip: null };

    const result = await upsertAthleteInjuryProfile(supabase as never, { athleteId: "athlete-1", injuries });

    expect(result.error).toBe("Couldn't save your injury profile. Try again.");
  });
});
