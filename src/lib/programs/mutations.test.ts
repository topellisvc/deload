import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addExerciseBlock,
  addExerciseToBlock,
  cloneProgram,
  createProgram,
  createProgramFromSavedTemplate,
  createProgramFromTemplate,
  deleteProgramTemplate,
  saveProgramAsTemplate,
} from "./mutations";
import { getProgramTree } from "./queries";
import { STARTER_PROGRAM_TEMPLATES } from "./starter-templates";
import type { ProgramTemplateRow, ProgramTree } from "./types";

vi.mock("./queries", () => ({
  getProgramTree: vi.fn(),
}));

vi.mock("@/lib/notifications/mutations", () => ({
  notifyProgramAssigned: vi.fn(),
}));

import { notifyProgramAssigned } from "@/lib/notifications/mutations";

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

describe("addExerciseBlock / addExerciseToBlock category default", () => {
  it("addExerciseBlock uses the passed category instead of always defaulting to strength", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await addExerciseBlock(supabase as never, { dayId: "day-1", position: 1, category: "running" });

    expect(inserted.block_exercises![0]).toMatchObject({ exercise_category: "running" });
    expect(inserted.set_prescriptions![0]).toMatchObject({ prescription_type: "distance" });
  });

  it("addExerciseBlock falls back to strength when no category is passed (original behavior)", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await addExerciseBlock(supabase as never, { dayId: "day-1", position: 1 });

    expect(inserted.block_exercises![0]).toMatchObject({ exercise_category: "strength" });
  });

  it("addExerciseToBlock uses the passed category", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await addExerciseToBlock(supabase as never, { blockId: "block-1", position: 2, category: "cardio" });

    expect(inserted.block_exercises![0]).toMatchObject({ exercise_category: "cardio" });
    expect(inserted.set_prescriptions![0]).toMatchObject({ prescription_type: "time" });
  });
});

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

describe("createProgram notification wiring", () => {
  beforeEach(() => {
    vi.mocked(notifyProgramAssigned).mockReset();
  });

  it("notifies the athlete when the program is assigned to someone other than the creator", async () => {
    const { supabase } = makeSupabaseMock();

    await createProgram(supabase as never, {
      userId: "coach-1",
      name: "Off-season block",
      discipline: "resistance",
      dayLabels: ["Day 1"],
      athleteId: "athlete-1",
    });

    expect(notifyProgramAssigned).toHaveBeenCalledWith(supabase, {
      coachId: "coach-1",
      athleteId: "athlete-1",
      programId: expect.any(String),
      programName: "Off-season block",
    });
  });

  it("does not notify anyone for ordinary self-programming (no athleteId given)", async () => {
    const { supabase } = makeSupabaseMock();

    await createProgram(supabase as never, {
      userId: "user-1",
      name: "My own plan",
      discipline: "resistance",
      dayLabels: ["Day 1"],
    });

    expect(notifyProgramAssigned).not.toHaveBeenCalled();
  });
});

describe("cloneProgram notification wiring", () => {
  const sourceProgram: ProgramTree = {
    id: "prog-source",
    owner_id: "coach-1",
    athlete_id: "coach-1",
    name: "Source",
    discipline: "resistance",
    is_active: false,
    removed_by_athlete_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    weeks: [],
  };

  beforeEach(() => {
    vi.mocked(notifyProgramAssigned).mockReset();
    vi.mocked(getProgramTree).mockReset();
    vi.mocked(getProgramTree).mockResolvedValue({ id: "prog-clone" } as unknown as ProgramTree);
  });

  it("notifies the athlete when a copy is sent to a client", async () => {
    const { supabase } = makeSupabaseMock();

    await cloneProgram(supabase as never, {
      sourceProgram,
      ownerId: "coach-1",
      athleteId: "athlete-1",
      name: "Source (copy)",
    });

    expect(notifyProgramAssigned).toHaveBeenCalledWith(supabase, {
      coachId: "coach-1",
      athleteId: "athlete-1",
      programId: expect.any(String),
      programName: "Source (copy)",
    });
  });

  it("does not notify anyone when copying a program for yourself", async () => {
    const { supabase } = makeSupabaseMock();

    await cloneProgram(supabase as never, {
      sourceProgram,
      ownerId: "coach-1",
      athleteId: "coach-1",
      name: "Source (copy)",
    });

    expect(notifyProgramAssigned).not.toHaveBeenCalled();
  });
});

describe("saveProgramAsTemplate", () => {
  const program: ProgramTree = {
    id: "prog-1",
    owner_id: "coach-1",
    athlete_id: "coach-1",
    name: "Full Body Strength",
    discipline: "resistance",
    is_active: false,
    removed_by_athlete_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    weeks: [
      { id: "week-1", program_id: "prog-1", position: 1, label: "Week 1", based_on_week_id: null, created_at: "2026-01-01T00:00:00.000Z", days: [] },
    ],
  };

  function makeInsertMock(result: { data: ProgramTemplateRow | null; error: { message: string } | null }) {
    const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve(result) }) }));
    const supabase = { from: vi.fn(() => ({ insert })) };
    return { supabase, insert };
  }

  it("snapshots the program's weeks (not its own id/athlete/active flag) into a new template row", async () => {
    const savedRow: ProgramTemplateRow = {
      id: "template-1",
      owner_id: "coach-1",
      name: "My template",
      discipline: "resistance",
      template_data: { weeks: program.weeks },
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const { supabase, insert } = makeInsertMock({ data: savedRow, error: null });

    const result = await saveProgramAsTemplate(supabase as never, { program, ownerId: "coach-1", name: "My template" });

    expect(insert).toHaveBeenCalledWith({
      owner_id: "coach-1",
      name: "My template",
      discipline: "resistance",
      template_data: { weeks: program.weeks },
    });
    expect(result).toEqual({ template: savedRow, error: null });
  });

  it("returns a friendly error instead of throwing when the insert fails", async () => {
    const { supabase } = makeInsertMock({ data: null, error: { message: "boom" } });

    const result = await saveProgramAsTemplate(supabase as never, { program, ownerId: "coach-1", name: "My template" });

    expect(result.template).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("deleteProgramTemplate", () => {
  it("deletes the template row by id", async () => {
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = { from: vi.fn(() => ({ delete: () => ({ eq }) })) };

    const result = await deleteProgramTemplate(supabase as never, "template-1");

    expect(eq).toHaveBeenCalledWith("id", "template-1");
    expect(result.error).toBeNull();
  });

  it("returns a friendly error when the delete fails", async () => {
    const supabase = { from: vi.fn(() => ({ delete: () => ({ eq: () => Promise.resolve({ error: { message: "boom" } }) }) })) };

    const result = await deleteProgramTemplate(supabase as never, "template-1");

    expect(result.error).toBeTruthy();
  });
});

describe("createProgramFromSavedTemplate", () => {
  const template: ProgramTemplateRow = {
    id: "template-1",
    owner_id: "coach-1",
    name: "My Strength Template",
    discipline: "resistance",
    template_data: {
      weeks: [
        {
          id: "old-week-1",
          program_id: "old-prog",
          position: 1,
          label: "Week 1",
          based_on_week_id: null,
          created_at: "2026-01-01T00:00:00.000Z",
          days: [{ id: "old-day-1", week_id: "old-week-1", position: 1, label: "Day 1", is_rest_day: false, blocks: [] }],
        },
        {
          id: "old-week-2",
          program_id: "old-prog",
          position: 2,
          label: "Week 2",
          based_on_week_id: "old-week-1",
          created_at: "2026-01-01T00:00:00.000Z",
          days: [{ id: "old-day-2", week_id: "old-week-2", position: 1, label: "Day 1", is_rest_day: false, blocks: [] }],
        },
      ],
    },
    created_at: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.mocked(getProgramTree).mockReset();
    vi.mocked(getProgramTree).mockResolvedValue({ id: "prog-new" } as unknown as ProgramTree);
  });

  it("creates one programs row and one program_weeks row per stored week, owned by the caller", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    const result = await createProgramFromSavedTemplate(supabase as never, { template, userId: "user-1" });

    expect(result.error).toBeNull();
    expect(inserted.programs).toHaveLength(1);
    expect(inserted.programs![0]).toMatchObject({
      owner_id: "user-1",
      athlete_id: "user-1",
      name: "My Strength Template",
      discipline: "resistance",
    });
    expect(inserted.program_weeks).toHaveLength(2);
  });

  it("never links based_on_week_id back to the template's own stored (possibly stale) week ids", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await createProgramFromSavedTemplate(supabase as never, { template, userId: "user-1" });

    expect(inserted.program_weeks!.every((w) => w.based_on_week_id === null)).toBe(true);
  });

  it("assigns to a given athlete instead of the caller when athleteId is provided", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await createProgramFromSavedTemplate(supabase as never, { template, userId: "coach-1", athleteId: "athlete-1" });

    expect(inserted.programs![0]).toMatchObject({ owner_id: "coach-1", athlete_id: "athlete-1" });
  });

  it("returns an error instead of a program when getProgramTree can't re-fetch it", async () => {
    vi.mocked(getProgramTree).mockResolvedValue(null);
    const { supabase } = makeSupabaseMock();

    const result = await createProgramFromSavedTemplate(supabase as never, { template, userId: "user-1" });

    expect(result.program).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
