import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addExerciseBlock,
  addExerciseBlockFromTemplate,
  addExerciseToBlock,
  cloneProgram,
  copyDayContents,
  createProgram,
  createProgramFromSavedTemplate,
  createProgramFromTemplate,
  deleteProgramTemplate,
  duplicateDay,
  duplicateExercise,
  insertDayTemplate,
  moveExerciseToDay,
  reorderBlocks,
  reorderSets,
  saveProgramAsTemplate,
} from "./mutations";
import type { BlockExerciseRow, BlockRow, DayRow, DayTemplateRow, ExerciseTemplateRow } from "./types";
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

  it("addExerciseBlock defaults to block_role 'main' when no role is passed", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await addExerciseBlock(supabase as never, { dayId: "day-1", position: 1 });

    expect(inserted.exercise_blocks![0]).toMatchObject({ block_role: "main" });
  });

  it("addExerciseBlock uses the passed role for the Warm-up / Conditioning sections", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await addExerciseBlock(supabase as never, { dayId: "day-1", position: 1, role: "warmup" });

    expect(inserted.exercise_blocks![0]).toMatchObject({ block_role: "warmup" });
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

    // Barbell Row is rep_range, with no weight/distance/duration/calories
    // set to begin with, so it should be byte-for-byte identical week over week.
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

describe("createProgramFromTemplate progression scaling for cardio's volume fields", () => {
  const cardioTemplate = STARTER_PROGRAM_TEMPLATES.find((t) => t.slug === "cardio-conditioning-base")!;

  beforeEach(() => {
    vi.mocked(getProgramTree).mockReset();
    vi.mocked(getProgramTree).mockResolvedValue({ id: "prog-1" } as unknown as ProgramTree);
  });

  it("scales duration_seconds and distance_meters across progression weeks, but leaves heart_rate_zone fixed", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    await createProgramFromTemplate(supabase as never, { template: cardioTemplate, userId: "user-1" });

    const setsPerWeek = countSets(cardioTemplate);
    const allSets = inserted.set_prescriptions!;
    const week1Sets = allSets.slice(0, setsPerWeek);
    const week2Sets = allSets.slice(setsPerWeek, setsPerWeek * 2); // first progression step: +8%

    // Steady State (Stationary Bike): 20 minutes @ Zone 2.
    const steadyStateIndex = week1Sets.findIndex((s) => s.prescription_type === "heart_rate_zone" && s.duration_seconds === 1200);
    expect(steadyStateIndex).toBeGreaterThanOrEqual(0);
    expect(week2Sets[steadyStateIndex]).toMatchObject({
      duration_seconds: Math.round(1200 * 1.08),
      heart_rate_zone: 2, // unchanged — a target zone isn't a volume to scale
    });

    // Tempo (Rowing Machine): 2500m.
    const tempoIndex = week1Sets.findIndex((s) => s.prescription_type === "distance" && s.distance_meters === 2500);
    expect(tempoIndex).toBeGreaterThanOrEqual(0);
    expect(week2Sets[tempoIndex]!.distance_meters).toBe(Math.round(2500 * 1.08));
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

describe("reorderBlocks", () => {
  /** Captures every update() call, per table, in call order — enough to
   * verify reorderBlocks' two-phase (stage-negative, then-final) approach
   * without a real Postgres unique constraint to violate. */
  function makeUpdateMock() {
    const updates: { table: string; id: string; position: number }[] = [];
    const supabase = {
      from: vi.fn((table: string) => ({
        update: vi.fn((patch: { position: number }) => ({
          eq: vi.fn((_col: string, id: string) => {
            updates.push({ table, id, position: patch.position });
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    };
    return { supabase, updates };
  }

  it("stages every block through a negative position before any real final position is written", async () => {
    const { supabase, updates } = makeUpdateMock();

    await reorderBlocks(supabase as never, [
      { id: "block-a", position: 2 },
      { id: "block-b", position: 1 },
      { id: "block-c", position: 3 },
    ]);

    expect(updates).toHaveLength(6);
    const [first, second, third, fourth, fifth, sixth] = updates;
    // Phase 1: every block gets a negative temp position, in input order.
    expect(first!.id).toBe("block-a");
    expect(first!.position).toBeLessThan(0);
    expect(second!.id).toBe("block-b");
    expect(second!.position).toBeLessThan(0);
    expect(third!.id).toBe("block-c");
    expect(third!.position).toBeLessThan(0);
    // Phase 2: every block lands on its real, positive final position.
    expect(fourth).toEqual({ table: "exercise_blocks", id: "block-a", position: 2 });
    expect(fifth).toEqual({ table: "exercise_blocks", id: "block-b", position: 1 });
    expect(sixth).toEqual({ table: "exercise_blocks", id: "block-c", position: 3 });
  });

  it("propagates an error from the first failing write instead of silently continuing", async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: "boom" } })),
        })),
      })),
    };

    const result = await reorderBlocks(supabase as never, [{ id: "block-a", position: 1 }]);
    expect(result.error).toBe("boom");
  });
});

describe("reorderSets", () => {
  /** Same staged-negative-position mechanics as reorderBlocks, just against
   * set_prescriptions — the Cardio Builder's drag-and-drop interval
   * reordering relies on this. */
  function makeUpdateMock() {
    const updates: { table: string; id: string; position: number }[] = [];
    const supabase = {
      from: vi.fn((table: string) => ({
        update: vi.fn((patch: { position: number }) => ({
          eq: vi.fn((_col: string, id: string) => {
            updates.push({ table, id, position: patch.position });
            return Promise.resolve({ error: null });
          }),
        })),
      })),
    };
    return { supabase, updates };
  }

  it("stages every set through a negative position before any real final position is written", async () => {
    const { supabase, updates } = makeUpdateMock();

    await reorderSets(supabase as never, [
      { id: "set-a", position: 2 },
      { id: "set-b", position: 1 },
    ]);

    expect(updates).toHaveLength(4);
    const [first, second, third, fourth] = updates;
    expect(first!.id).toBe("set-a");
    expect(first!.position).toBeLessThan(0);
    expect(second!.id).toBe("set-b");
    expect(second!.position).toBeLessThan(0);
    expect(third).toEqual({ table: "set_prescriptions", id: "set-a", position: 2 });
    expect(fourth).toEqual({ table: "set_prescriptions", id: "set-b", position: 1 });
  });

  it("propagates an error from the first failing write instead of silently continuing", async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: "boom" } })),
        })),
      })),
    };

    const result = await reorderSets(supabase as never, [{ id: "set-a", position: 1 }]);
    expect(result.error).toBe("boom");
  });
});

describe("copyDayContents", () => {
  function makeBlock(overrides: Partial<BlockRow> & Pick<BlockRow, "id" | "position" | "block_role">): BlockRow {
    return {
      day_id: "source-day",
      block_type: "straight",
      rounds: 1,
      exercises: [
        { id: `${overrides.id}-ex`, block_id: overrides.id, position: 1, exercise_id: null, custom_name: "Exercise", notes: null, exercise_category: "strength", sets: [] },
      ],
      ...overrides,
    };
  }

  /** Position is scoped per (day_id, block_role) (migration 0032) — a
   * shared "append at the end of the day" counter would misorder sections
   * and could collide with an existing block in a different role. Each
   * role needs its own next-position counter, seeded from the target
   * day's *existing* blocks in that role. */
  it("seeds each role's position from the target day's existing blocks in that same role, independently", async () => {
    const { supabase } = makeSupabaseMock();

    const sourceDay: DayRow = {
      id: "source-day",
      week_id: "week-1",
      position: 1,
      label: null,
      is_rest_day: false,
      blocks: [
        makeBlock({ id: "src-warmup", position: 1, block_role: "warmup" }),
        makeBlock({ id: "src-main-1", position: 1, block_role: "main" }),
        makeBlock({ id: "src-main-2", position: 2, block_role: "main" }),
      ],
    };

    // Target day already has one warmup block (position 1) and no main
    // blocks — so the copied warmup should land at position 2, while the
    // two copied main blocks start fresh at positions 1 and 2.
    const targetDayBlocks: BlockRow[] = [makeBlock({ id: "existing-warmup", day_id: "target-day", position: 1, block_role: "warmup" })];

    const { blocks, error } = await copyDayContents(supabase as never, { sourceDay, targetDayId: "target-day", targetDayBlocks });

    expect(error).toBeNull();
    expect(blocks).toHaveLength(3);
    const warmupCopy = blocks.find((b) => b.block_role === "warmup");
    const mainCopies = blocks.filter((b) => b.block_role === "main").sort((a, b) => a.position - b.position);

    expect(warmupCopy!.position).toBe(2);
    expect(mainCopies.map((b) => b.position)).toEqual([1, 2]);
  });
});

describe("duplicateExercise", () => {
  function makeSourceExercise(overrides: Partial<BlockExerciseRow> = {}): BlockExerciseRow {
    return {
      id: "ex-1",
      block_id: "block-1",
      position: 1,
      exercise_id: null,
      custom_name: "Bench Press",
      notes: "Control the eccentric",
      exercise_category: "strength",
      sets: [
        {
          id: "set-1",
          block_exercise_id: "ex-1",
          position: 1,
          prescription_type: "fixed_weight",
          sets: 4,
          reps: "6",
          min_reps: null,
          max_reps: null,
          weight_value: 100,
          percent_1rm_value: null,
          pr_record_type: null,
          rpe_value: null,
          rir_value: null,
          heart_rate_zone: null,
          calories: null,
          rest_seconds: 120,
          notes: null,
          distance_meters: null,
          duration_seconds: null,
          pace_seconds_per_km: null,
          advanced_config: null,
        },
      ],
      ...overrides,
    };
  }

  it("creates a new standalone block with a copy of the exercise and its set rows, all with fresh ids", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    const result = await duplicateExercise(supabase as never, { dayId: "day-1", position: 2, exercise: makeSourceExercise() });

    expect(result.error).toBeNull();
    expect(inserted.exercise_blocks).toEqual([
      { id: expect.any(String), day_id: "day-1", position: 2, block_type: "straight", block_role: "main", rounds: 1 },
    ]);
    expect(inserted.block_exercises![0]).toMatchObject({ custom_name: "Bench Press", notes: "Control the eccentric", exercise_category: "strength" });
    expect(inserted.set_prescriptions![0]).toMatchObject({ prescription_type: "fixed_weight", sets: 4, reps: "6", weight_value: 100, rest_seconds: 120 });

    // Every id in the returned block is new — not a copy of the source's ids.
    expect(result.block!.id).not.toBe("block-1");
    expect(result.block!.exercises[0]!.id).not.toBe("ex-1");
    expect(result.block!.exercises[0]!.sets[0]!.id).not.toBe("set-1");
    // But the block_exercise_id on the new set row points at the *new*
    // exercise id, not the stale source one — otherwise it'd reference an
    // exercise that no longer exists from this new set row's perspective.
    expect(result.block!.exercises[0]!.sets[0]!.block_exercise_id).toBe(result.block!.exercises[0]!.id);
  });

  it("copies every set row when the exercise has more than one prescription row (e.g. a drop set)", async () => {
    const { supabase, inserted } = makeSupabaseMock();
    const source = makeSourceExercise({
      sets: [
        { ...makeSourceExercise().sets[0]!, id: "set-1", position: 1 },
        { ...makeSourceExercise().sets[0]!, id: "set-2", position: 2, weight_value: 80 },
      ],
    });

    await duplicateExercise(supabase as never, { dayId: "day-1", position: 2, exercise: source });

    expect(inserted.set_prescriptions).toHaveLength(2);
    expect(inserted.set_prescriptions![1]).toMatchObject({ weight_value: 80, position: 2 });
  });
});

describe("addExerciseBlockFromTemplate", () => {
  const template: ExerciseTemplateRow = {
    id: "template-1",
    owner_id: "user-1",
    name: "Bench 5x5",
    exercise_category: "strength",
    template_data: {
      id: "stale-ex-id",
      block_id: "stale-block-id",
      position: 1,
      exercise_id: null,
      custom_name: "Bench Press",
      notes: "Heavy day",
      exercise_category: "strength",
      sets: [
        {
          id: "stale-set-id",
          block_exercise_id: "stale-ex-id",
          position: 1,
          prescription_type: "fixed_weight",
          sets: 5,
          reps: "5",
          min_reps: null,
          max_reps: null,
          weight_value: 100,
          percent_1rm_value: null,
          pr_record_type: null,
          rpe_value: null,
          rir_value: null,
          heart_rate_zone: null,
          calories: null,
          rest_seconds: 120,
          notes: null,
          distance_meters: null,
          duration_seconds: null,
          pace_seconds_per_km: null,
          advanced_config: null,
        },
      ],
    },
    created_at: "2026-01-01T00:00:00.000Z",
  };

  // A template's stored ids are structural only, same as
  // ProgramTemplateRow's — this is really the same clone-with-fresh-ids
  // operation duplicateExercise already does, just sourced from a stored
  // snapshot instead of a live exercise.
  it("inserts a new block+exercise+sets from the template, with fresh ids and the requested role", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    const result = await addExerciseBlockFromTemplate(supabase as never, { dayId: "day-1", position: 1, role: "warmup", template });

    expect(result.error).toBeNull();
    expect(inserted.exercise_blocks![0]).toMatchObject({ day_id: "day-1", position: 1, block_role: "warmup" });
    expect(inserted.block_exercises![0]).toMatchObject({ custom_name: "Bench Press", notes: "Heavy day" });
    expect(inserted.set_prescriptions![0]).toMatchObject({ sets: 5, reps: "5", weight_value: 100 });

    expect(result.block!.id).not.toBe("stale-block-id");
    expect(result.block!.exercises[0]!.id).not.toBe("stale-ex-id");
    expect(result.block!.exercises[0]!.sets[0]!.id).not.toBe("stale-set-id");
  });
});

describe("insertDayTemplate", () => {
  const template: DayTemplateRow = {
    id: "day-template-1",
    owner_id: "user-1",
    name: "Upper Strength",
    template_data: {
      blocks: [
        {
          id: "stale-block-id",
          day_id: "stale-day-id",
          position: 1,
          block_type: "straight",
          block_role: "main",
          rounds: 1,
          exercises: [
            { id: "stale-ex-id", block_id: "stale-block-id", position: 1, exercise_id: null, custom_name: "Bench Press", notes: null, exercise_category: "strength", sets: [] },
          ],
        },
      ],
    },
    created_at: "2026-01-01T00:00:00.000Z",
  };

  it("inserts the template's blocks into the target day with fresh ids, seeded from the target's existing blocks", async () => {
    const { supabase } = makeSupabaseMock();

    const { blocks, error } = await insertDayTemplate(supabase as never, { targetDayId: "target-day", targetDayBlocks: [], template });

    expect(error).toBeNull();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.id).not.toBe("stale-block-id");
    expect(blocks[0]!.day_id).toBe("target-day");
    expect(blocks[0]!.position).toBe(1);
    expect(blocks[0]!.exercises[0]!.custom_name).toBe("Bench Press");
  });
});

describe("duplicateDay", () => {
  const sourceDay: DayRow = {
    id: "source-day",
    week_id: "week-1",
    position: 1,
    label: "Upper Strength",
    is_rest_day: false,
    blocks: [
      {
        id: "src-block",
        day_id: "source-day",
        position: 1,
        block_type: "straight",
        block_role: "main",
        rounds: 1,
        exercises: [
          { id: "src-ex", block_id: "src-block", position: 1, exercise_id: null, custom_name: "Bench Press", notes: null, exercise_category: "strength", sets: [] },
        ],
      },
    ],
  };

  it("inserts a new day labeled '<original> copy' with fresh-id copies of every block", async () => {
    const { supabase, inserted } = makeSupabaseMock();

    const { day, error } = await duplicateDay(supabase as never, { sourceDay, weekId: "week-1", position: 2 });

    expect(error).toBeNull();
    expect(day!.label).toBe("Upper Strength copy");
    expect(day!.week_id).toBe("week-1");
    expect(day!.position).toBe(2);
    expect(day!.id).not.toBe("source-day");
    expect(inserted.training_days).toEqual([
      { id: day!.id, week_id: "week-1", position: 2, label: "Upper Strength copy", is_rest_day: false },
    ]);
    expect(day!.blocks).toHaveLength(1);
    expect(day!.blocks[0]!.id).not.toBe("src-block");
    expect(day!.blocks[0]!.day_id).toBe(day!.id);
    expect(day!.blocks[0]!.exercises[0]!.custom_name).toBe("Bench Press");
  });

  it("leaves the label null when the source day has none, instead of '<null> copy'", async () => {
    const { supabase } = makeSupabaseMock();

    const { day } = await duplicateDay(supabase as never, { sourceDay: { ...sourceDay, label: null }, weekId: "week-1", position: 2 });

    expect(day!.label).toBeNull();
  });
});

/** Extends makeSupabaseMock's insert-only mock with a `.delete().eq()`
 * chain — moveExerciseToDay's removal half (removeExerciseFromBlock /
 * deleteBlock) issues deletes, which the shared mock doesn't model. Kept
 * local to this describe block rather than folded into makeSupabaseMock
 * since no other existing test needs delete support. */
function makeSupabaseMockWithDelete(deleteError: string | null = null) {
  const inserted: Record<string, Record<string, unknown>[]> = {};
  const deleted: { table: string; id: unknown }[] = [];
  const supabase = {
    from: vi.fn((table: string) => ({
      insert: vi.fn((rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(rows) ? rows : [rows];
        inserted[table] = [...(inserted[table] ?? []), ...list];
        return Promise.resolve({ error: null });
      }),
      delete: vi.fn(() => ({
        eq: vi.fn((_column: string, id: unknown) => {
          deleted.push({ table, id });
          return Promise.resolve({ error: deleteError ? { message: deleteError } : null });
        }),
      })),
    })),
  };
  return { supabase, inserted, deleted };
}

describe("moveExerciseToDay", () => {
  const exercise: BlockExerciseRow = {
    id: "ex-1",
    block_id: "source-block",
    position: 1,
    exercise_id: null,
    custom_name: "Bench Press",
    notes: null,
    exercise_category: "strength",
    sets: [],
  };

  it("copies the exercise to the target day and deletes the source block when it had no other exercises", async () => {
    const { supabase, inserted, deleted } = makeSupabaseMockWithDelete();

    const { block, error } = await moveExerciseToDay(supabase as never, {
      targetDayId: "target-day",
      targetPosition: 1,
      blockRole: "main",
      exercise,
      sourceBlockId: "source-block",
      sourceBlockHasOtherExercises: false,
    });

    expect(error).toBeNull();
    expect(block!.day_id).toBe("target-day");
    expect(block!.exercises[0]!.custom_name).toBe("Bench Press");
    expect(inserted.exercise_blocks![0]).toMatchObject({ day_id: "target-day", position: 1, block_role: "main" });
    expect(deleted).toEqual([{ table: "exercise_blocks", id: "source-block" }]);
  });

  it("removes just the one exercise (not the whole block) when the source block has other exercises left", async () => {
    const { supabase, deleted } = makeSupabaseMockWithDelete();

    await moveExerciseToDay(supabase as never, {
      targetDayId: "target-day",
      targetPosition: 1,
      blockRole: "main",
      exercise,
      sourceBlockId: "source-block",
      sourceBlockHasOtherExercises: true,
    });

    expect(deleted).toEqual([{ table: "block_exercises", id: "ex-1" }]);
  });

  it("still returns the copied block but with a partial-failure message when the removal fails", async () => {
    const { supabase } = makeSupabaseMockWithDelete("network error");

    const { block, error } = await moveExerciseToDay(supabase as never, {
      targetDayId: "target-day",
      targetPosition: 1,
      blockRole: "main",
      exercise,
      sourceBlockId: "source-block",
      sourceBlockHasOtherExercises: false,
    });

    expect(block).not.toBeNull();
    expect(error).toBe("Moved, but couldn't remove it from the original day — you may need to delete it there yourself.");
  });
});
