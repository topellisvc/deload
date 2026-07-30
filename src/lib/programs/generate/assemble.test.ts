import { describe, expect, it } from "vitest";
import type { Exercise } from "@/lib/exercises/types";
import { assembleWeeks } from "@/lib/programs/generate/assemble";
import { METADATA_KEYS } from "@/lib/programs/generate/patterns";
import type { SelectionContext } from "@/lib/programs/generate/select-exercises";
import type { DayPlan, ExerciseSlot, InjuryProfile, ProgramTemplate, WeekSetPlan } from "@/lib/programs/generate/types";

let nextId = 0;

function ex(partial: Partial<Exercise> = {}): Exercise {
  nextId += 1;
  return {
    id: partial.id ?? `ex-${nextId}`,
    name: partial.name ?? "Test Exercise",
    category: partial.category ?? "strength",
    movement_pattern: partial.movement_pattern ?? null,
    primary_muscle_group: partial.primary_muscle_group ?? "full_body",
    secondary_muscle_groups: partial.secondary_muscle_groups ?? [],
    equipment: partial.equipment ?? "bodyweight",
    difficulty: partial.difficulty ?? "beginner",
    description: null,
    instructions_setup: null,
    instructions_execution: null,
    instructions_breathing: null,
    instructions_finishing: null,
    tags: [],
    thumbnail_url: null,
    metadata: partial.metadata ?? {},
    owner_id: partial.owner_id ?? null,
    review_status: partial.review_status ?? "approved",
    is_archived: partial.is_archived ?? false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function clearInjuries(): InjuryProfile {
  return { shoulder: false, lowerBack: null, knee: null, wrist: false, hip: null, elbow: false };
}

function baseSelection(overrides: Partial<SelectionContext> = {}): SelectionContext {
  return { equipmentAccess: "full_gym", experienceLevel: "intermediate", injuries: clearInjuries(), coachedOnOlympicLifts: false, ...overrides };
}

/** A slot whose forWeek reports 3 sets normally and 2 on a deload week —
 * enough to prove assembleWeeks actually threads a real per-week
 * WeekContext into every slot rather than reusing one resolved plan. */
function slot(overrides: Partial<ExerciseSlot> = {}): ExerciseSlot {
  return {
    role: "main",
    category: "strength",
    movementPattern: "squat_bilateral",
    primaryMuscleGroup: "quadriceps",
    isPrimary: true,
    autoregulationEligible: true,
    prescription: {
      forWeek: (ctx): WeekSetPlan => ({
        prescriptionType: "rir",
        sets: ctx.deload ? 2 : 3,
        minReps: 6,
        maxReps: 8,
        rir: 2,
        restSeconds: 120,
      }),
    },
    ...overrides,
  };
}

function simpleTemplate(days: DayPlan[]): ProgramTemplate {
  const phaseByWeek = new Map([
    [1, "standard" as const],
    [2, "standard" as const],
    [3, "standard" as const],
    [4, "deload" as const],
  ]);
  const deloadWeeks = new Map([[4, "volume_cut" as const]]);
  return { name: "Test Template", discipline: "resistance", weekStructure: { days }, deloadWeeks, phaseByWeek };
}

describe("assembleWeeks — week shape", () => {
  it("produces exactly totalWeeks WeekRows, 1-indexed and labelled", () => {
    const day: DayPlan = { label: "Day 1", isRestDay: false, intensity: "moderate", loadsLowerBody: true, slots: [slot()] };
    const pool = [ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } })];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 4, exercises: pool, selection: baseSelection() });
    expect(result.weeks).toHaveLength(4);
    expect(result.weeks.map((w) => w.position)).toEqual([1, 2, 3, 4]);
    expect(result.weeks.map((w) => w.label)).toEqual(["Week 1", "Week 2", "Week 3", "Week 4"]);
  });

  it("carries the day's label and rest-day flag through, with no blocks on a rest day", () => {
    const restDay: DayPlan = { label: "Rest", isRestDay: true, intensity: "easy", loadsLowerBody: false, slots: [] };
    const result = assembleWeeks({ template: simpleTemplate([restDay]), totalWeeks: 1, exercises: [], selection: baseSelection() });
    const day = result.weeks[0]!.days[0]!;
    expect(day.label).toBe("Rest");
    expect(day.is_rest_day).toBe(true);
    expect(day.blocks).toEqual([]);
  });

  it("gives every block_exercise a block matching the slot's role, one exercise per block", () => {
    const day: DayPlan = { label: "Day 1", isRestDay: false, intensity: "moderate", loadsLowerBody: true, slots: [slot({ role: "warmup" })] };
    const pool = [ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } })];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: pool, selection: baseSelection() });
    const block = result.weeks[0]!.days[0]!.blocks[0]!;
    expect(block.block_role).toBe("warmup");
    expect(block.block_type).toBe("straight");
    expect(block.exercises).toHaveLength(1);
  });
});

describe("assembleWeeks — per-week prescription resolution", () => {
  it("resolves a genuinely different WeekSetPlan for a deload week rather than scaling one authored week", () => {
    const day: DayPlan = { label: "Day 1", isRestDay: false, intensity: "moderate", loadsLowerBody: true, slots: [slot()] };
    const pool = [ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } })];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 4, exercises: pool, selection: baseSelection() });
    const week1Sets = result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.sets[0]!.sets;
    const week4Sets = result.weeks[3]!.days[0]!.blocks[0]!.exercises[0]!.sets[0]!.sets;
    expect(week1Sets).toBe(3);
    expect(week4Sets).toBe(2);
  });

  it("maps WeekSetPlan fields onto the real SetRow column names", () => {
    const day: DayPlan = { label: "Day 1", isRestDay: false, intensity: "moderate", loadsLowerBody: true, slots: [slot()] };
    const pool = [ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } })];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: pool, selection: baseSelection() });
    const set = result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.prescription_type).toBe("rir");
    expect(set.min_reps).toBe(6);
    expect(set.max_reps).toBe(8);
    expect(set.rir_value).toBe(2);
    expect(set.rest_seconds).toBe(120);
    // Never a hand-authored absolute load or a stored-PR percent lookup.
    expect(set.weight_value).toBeNull();
    expect(set.pr_record_type).toBeNull();
    expect(set.is_max_test).toBe(false);
    // prescription-types.ts's contract: every strength type except
    // rep_range reads the free-text `reps` field, not min_reps/max_reps —
    // SetDetails renders "?" if reps is null regardless of min_reps/
    // max_reps, so a plan that only ever set minReps/maxReps (the shape
    // every RIR-wave function in this generator actually produces) still
    // needs a computed reps string here.
    expect(set.reps).toBe("6-8");
  });

  it("computes a single-value reps string ('5', not '5-5') when a plan's minReps equals its maxReps", () => {
    const day: DayPlan = {
      label: "Day 1",
      isRestDay: false,
      intensity: "moderate",
      loadsLowerBody: true,
      slots: [
        slot({
          prescription: {
            forWeek: (): WeekSetPlan => ({ prescriptionType: "rir", sets: 3, minReps: 5, maxReps: 5, rir: 2, restSeconds: 120 }),
          },
        }),
      ],
    };
    const pool = [ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } })];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: pool, selection: baseSelection() });
    const set = result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.reps).toBe("5");
  });

  it("leaves a plan's own explicit reps string alone rather than recomputing it from minReps/maxReps", () => {
    const day: DayPlan = {
      label: "Day 1",
      isRestDay: false,
      intensity: "moderate",
      loadsLowerBody: true,
      slots: [
        slot({
          prescription: {
            forWeek: (): WeekSetPlan => ({ prescriptionType: "rir", sets: 1, reps: "AMRAP", rir: 1, restSeconds: 120 }),
          },
        }),
      ],
    };
    const pool = [ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } })];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: pool, selection: baseSelection() });
    const set = result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.reps).toBe("AMRAP");
  });

  it("carries a percent_1rm plan's prRecordType/isMaxTest through onto pr_record_type/is_max_test", () => {
    const day: DayPlan = {
      label: "Day 1",
      isRestDay: false,
      intensity: "moderate",
      loadsLowerBody: true,
      slots: [
        slot({
          prescription: {
            forWeek: (): WeekSetPlan => ({
              prescriptionType: "rir",
              sets: 1,
              reps: "5",
              rir: 1,
              restSeconds: 180,
              notes: "Testing week",
              prRecordType: "squat",
              isMaxTest: true,
            }),
          },
        }),
      ],
    };
    const pool = [ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } })];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: pool, selection: baseSelection() });
    const set = result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.sets[0]!;
    expect(set.pr_record_type).toBe("squat");
    expect(set.is_max_test).toBe(true);
  });

  it("persists the slot's autoregulationEligible flag onto the block_exercise row rather than dropping it", () => {
    const day: DayPlan = {
      label: "Day 1",
      isRestDay: false,
      intensity: "moderate",
      loadsLowerBody: true,
      slots: [slot({ autoregulationEligible: true }), slot({ autoregulationEligible: false, role: "conditioning", movementPattern: "carry", primaryMuscleGroup: "full_body" })],
    };
    const pool = [
      ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } }),
      ex({ id: "farmers-carry", metadata: { [METADATA_KEYS.slotPatterns]: ["carry"] } }),
    ];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: pool, selection: baseSelection() });
    const [eligibleBlock, ineligibleBlock] = result.weeks[0]!.days[0]!.blocks;
    expect(eligibleBlock!.exercises[0]!.autoregulation_eligible).toBe(true);
    expect(ineligibleBlock!.exercises[0]!.autoregulation_eligible).toBe(false);
  });
});

describe("assembleWeeks — exercise selection is stable across weeks", () => {
  it("selects the same exercise for a slot in every week rather than re-rolling it", () => {
    const day: DayPlan = { label: "Day 1", isRestDay: false, intensity: "moderate", loadsLowerBody: true, slots: [slot()] };
    const pool = [
      ex({ id: "barbell-back-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"], [METADATA_KEYS.demandRank]: { squat_bilateral: 10 } } }),
      ex({ id: "goblet-squat", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"], [METADATA_KEYS.demandRank]: { squat_bilateral: 40 } } }),
    ];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 4, exercises: pool, selection: baseSelection() });
    const idsByWeek = result.weeks.map((w) => w.days[0]!.blocks[0]!.exercises[0]!.exercise_id);
    expect(new Set(idsByWeek).size).toBe(1);
    expect(idsByWeek[0]).toBe("barbell-back-squat");
  });
});

describe("assembleWeeks — avoiding a duplicate exercise within one day", () => {
  it("gives two same-pattern slots in one day different exercises when more than one option exists", () => {
    const day: DayPlan = {
      label: "Day 1",
      isRestDay: false,
      intensity: "moderate",
      loadsLowerBody: false,
      slots: [slot({ movementPattern: "carry", primaryMuscleGroup: "full_body" }), slot({ movementPattern: "carry", primaryMuscleGroup: "full_body", role: "conditioning", isPrimary: false })],
    };
    const pool = [
      ex({ id: "farmers-carry", metadata: { [METADATA_KEYS.slotPatterns]: ["carry"], [METADATA_KEYS.demandRank]: { carry: 10 } } }),
      ex({ id: "suitcase-carry", metadata: { [METADATA_KEYS.slotPatterns]: ["carry"], [METADATA_KEYS.demandRank]: { carry: 20 } } }),
    ];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: pool, selection: baseSelection() });
    const ids = result.weeks[0]!.days[0]!.blocks.map((b) => b.exercises[0]!.exercise_id);
    expect(ids).toEqual(["farmers-carry", "suitcase-carry"]);
  });

  it("falls back to a repeat rather than an empty slot when only one option exists for the pattern", () => {
    const day: DayPlan = {
      label: "Day 1",
      isRestDay: false,
      intensity: "moderate",
      loadsLowerBody: false,
      slots: [slot({ movementPattern: "knee_flexion", primaryMuscleGroup: "hamstrings" }), slot({ movementPattern: "knee_flexion", primaryMuscleGroup: "hamstrings", role: "conditioning" })],
    };
    const pool = [ex({ id: "leg-curl-machine", metadata: { [METADATA_KEYS.slotPatterns]: ["knee_flexion"] } })];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: pool, selection: baseSelection() });
    const ids = result.weeks[0]!.days[0]!.blocks.map((b) => b.exercises[0]!.exercise_id);
    expect(ids).toEqual(["leg-curl-machine", "leg-curl-machine"]);
  });
});

describe("assembleWeeks — unresolved slots", () => {
  it("still produces a row, with a placeholder name, exercise_id null, and a warning", () => {
    const day: DayPlan = { label: "Day 1", isRestDay: false, intensity: "moderate", loadsLowerBody: false, slots: [slot({ movementPattern: "calf_soleus", primaryMuscleGroup: "calves" })] };
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: [], selection: baseSelection() });
    const blockExercise = result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!;
    expect(blockExercise.exercise_id).toBeNull();
    expect(blockExercise.custom_name).toContain("calf_soleus");
    expect(result.warnings.some((w) => w.includes("Day 1") && w.includes("calf_soleus"))).toBe(true);
  });

  it("still produces the block/set structure for an unresolved slot, not an empty day", () => {
    const day: DayPlan = { label: "Day 1", isRestDay: false, intensity: "moderate", loadsLowerBody: false, slots: [slot({ movementPattern: "calf_soleus", primaryMuscleGroup: "calves" })] };
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: [], selection: baseSelection() });
    const day0 = result.weeks[0]!.days[0]!;
    expect(day0.blocks).toHaveLength(1);
    expect(day0.blocks[0]!.exercises[0]!.sets).toHaveLength(1);
  });
});

describe("assembleWeeks — a slot with neither a pattern nor a muscle group", () => {
  // running-templates.ts, cardio-templates.ts, hybrid-templates.ts's
  // maintenance-running days and power-athletic-templates.ts's sprint day
  // all build slots exactly this way on purpose — WeekSetPlan.forWeek
  // synthesizes the real distance/pace/interval prescription without ever
  // touching the Exercise Library. This used to still get sent through
  // selectExerciseForSlot and come back "unresolved," producing a spurious
  // "no exercise available for main slot (unspecified)" warning on every
  // running/cardio/hybrid/sprint day, every week — regression coverage for
  // that fix.
  it("uses the day's own label as the exercise name, with no catalog lookup and no warning", () => {
    const day: DayPlan = {
      label: "Threshold",
      isRestDay: false,
      intensity: "hard",
      loadsLowerBody: true,
      slots: [slot({ category: "running", movementPattern: null, primaryMuscleGroup: null })],
    };
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: [], selection: baseSelection() });
    const blockExercise = result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!;
    expect(blockExercise.exercise_id).toBeNull();
    expect(blockExercise.custom_name).toBe("Threshold");
    expect(result.warnings).toEqual([]);
  });

  it("never calls into exercise selection at all — an empty library still resolves cleanly", () => {
    const day: DayPlan = {
      label: "Easy Run",
      isRestDay: false,
      intensity: "easy",
      loadsLowerBody: true,
      slots: [slot({ category: "running", movementPattern: null, primaryMuscleGroup: null })],
    };
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises: [], selection: baseSelection() });
    expect(result.warnings).toEqual([]);
    expect(result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.custom_name).toBe("Easy Run");
  });

  it("prefers the slot's own placeholderLabel over the day's label when the day has more than one slot", () => {
    // power-athletic-templates.ts's sprint day is the real-world case: a
    // multi-slot day ("Speed & Power A") where the pattern-less sprint slot
    // would otherwise get named after the whole session instead of itself.
    const day: DayPlan = {
      label: "Speed & Power A",
      isRestDay: false,
      intensity: "hard",
      loadsLowerBody: true,
      slots: [
        slot({ category: "running", movementPattern: null, primaryMuscleGroup: null, placeholderLabel: "Sprints" }),
        slot({ category: "strength", movementPattern: "squat_bilateral", primaryMuscleGroup: "quadriceps" }),
      ],
    };
    const exercises: Exercise[] = [
      ex({
        id: "goblet-squat",
        movement_pattern: "squat",
        primary_muscle_group: "quadriceps",
        metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] },
      }),
    ];
    const result = assembleWeeks({ template: simpleTemplate([day]), totalWeeks: 1, exercises, selection: baseSelection() });
    const blocks = result.weeks[0]!.days[0]!.blocks;
    expect(blocks[0]!.exercises[0]!.custom_name).toBe("Sprints");
    expect(blocks[0]!.exercises[0]!.custom_name).not.toBe("Speed & Power A");
  });
});

describe("assembleWeeks — respects injury/equipment/coaching constraints per athlete", () => {
  it("regresses away from a contraindicated exercise the same way select-exercises.ts does on its own", () => {
    const day: DayPlan = { label: "Day 1", isRestDay: false, intensity: "moderate", loadsLowerBody: false, slots: [slot({ movementPattern: "vertical_push", primaryMuscleGroup: "shoulders" })] };
    const pool = [
      ex({
        id: "barbell-overhead-press",
        metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_push"], [METADATA_KEYS.demandRank]: { vertical_push: 10 }, [METADATA_KEYS.contraindications]: ["shoulder"] },
      }),
      ex({ id: "dumbbell-shoulder-press", metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_push"], [METADATA_KEYS.demandRank]: { vertical_push: 30 } } }),
    ];
    const result = assembleWeeks({
      template: simpleTemplate([day]),
      totalWeeks: 1,
      exercises: pool,
      selection: baseSelection({ injuries: { ...clearInjuries(), shoulder: true } }),
    });
    expect(result.weeks[0]!.days[0]!.blocks[0]!.exercises[0]!.exercise_id).toBe("dumbbell-shoulder-press");
  });
});
