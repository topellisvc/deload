import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgramFromTemplate } from "./mutations";
import { getProgramTree } from "./queries";
import { STARTER_PROGRAM_TEMPLATES } from "./starter-templates";
import type { ProgramTree } from "./types";

vi.mock("./queries", () => ({
  getProgramTree: vi.fn(),
}));

/** Captures every row passed to insert(), per table, in call order — real
 * enough to verify createProgramFromTemplate/addWeek's actual behavior
 * (row counts, field values, insertion order across weeks) without a real
 * Postgres round trip. */
function makeSupabaseMock() {
  const inserted: Record<string, Record<string, unknown>[]> = {};
  const supabase = {
    from: vi.fn((table: string) => ({
      insert: vi.fn((rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        inserted[table] = [...(inserted[table] ?? []), ...list];
        return Promise.resolve({ error: null });
      }),
    })),
  };
  return { supabase, inserted };
}

function countSets(template: (typeof STARTER_PROGRAM_TEMPLATES)[number]): number {
  return template.week1.days.reduce(
    (n, d) => n + d.blocks.reduce((n2, b) => n2 + b.exercises.reduce((n3, e) => n3 + e.sets.length, 0), 0),
    0
  );
}

describe("createProgramFromTemplate", () => {
  const template = STARTER_PROGRAM_TEMPLATES.find((t) => t.slug === "full-body-strength")!;

  beforeEach(() => {
    vi.mocked(getProgramTree).mockReset();
    vi.mocked(getProgramTree).mockResolvedValue({ id: "prog-1" } as unknown as ProgramTree);
  });

  it("creates one programs row and one program_weeks row per week (week 1 + every progression step)", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    const result = await createProgramFromTemplate(supabase as never, { template, userId: "user-1" });

    expect(result.error).toBeNull();
    expect(inserted.programs).toHaveLength(1);
    expect(inserted.programs![0]).toMatchObject({
      owner_id: "user-1",
      athlete_id: "user-1",
      name: template.name,
      discipline: template.discipline,
    });
    expect(inserted.program_weeks).toHaveLength(1 + template.progressionSteps.length);
  });

  it("defaults athlete_id to userId (self-programmed) when no separate athleteId is given", async () => {
    const { supabase, inserted } = makeSupabaseMock();
    await createProgramFromTemplate(supabase as never, { template, userId: "user-1" });
    expect(inserted.programs![0]).toMatchObject({ owner_id: "user-1", athlete_id: "user-1" });
  });

  it("keeps week 1's based_on_week_id null (it's not really a copy of anything) but records real provenance on the progression weeks", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await createProgramFromTemplate(supabase as never, { template, userId: "user-1" });

    const weeks = inserted.program_weeks!;
    const week1 = weeks[0]!;
    expect(week1.based_on_week_id).toBeNull();
    expect(weeks.slice(1).every((w) => w.based_on_week_id === week1.id)).toBe(true);
  });

  it("scales percent_1rm sets across progression weeks but leaves rep_range sets unchanged", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await createProgramFromTemplate(supabase as never, { template, userId: "user-1" });

    const setsPerWeek = countSets(template);
    const allSets = inserted.set_prescriptions!;
    const week1Sets = allSets.slice(0, setsPerWeek);
    const week2Sets = allSets.slice(setsPerWeek, setsPerWeek * 2);

    // Back Squat's Day 1 set: 3x5 @ 65% — template's first progression step is +3%.
    const squatIndex = week1Sets.findIndex((s) => s.pr_record_type === "squat" && s.percent_1rm_value === 65);
    expect(squatIndex).toBeGreaterThanOrEqual(0);
    expect(week2Sets[squatIndex]!.percent_1rm_value).toBeCloseTo(65 * 1.03, 1);

    // Barbell Row is rep_range — addWeek only scales fixed_weight/percent_1rm/distance,
    // so this should be byte-for-byte identical week over week.
    const rowIndex = week1Sets.findIndex((s) => s.prescription_type === "rep_range" && s.min_reps === 8 && s.max_reps === 10);
    expect(rowIndex).toBeGreaterThanOrEqual(0);
    expect(week2Sets[rowIndex]).toMatchObject({ min_reps: 8, max_reps: 10 });
  });

  it("returns an error instead of a program when getProgramTree can't re-fetch it", async () => {
    vi.mocked(getProgramTree).mockResolvedValue(null);
    const { supabase } = makeSupabaseMock();

    const result = await createProgramFromTemplate(supabase as never, { template, userId: "user-1" });

    expect(result.program).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
