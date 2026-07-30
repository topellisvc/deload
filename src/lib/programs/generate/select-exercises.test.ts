import { describe, expect, it } from "vitest";
import type { Exercise } from "@/lib/exercises/types";
import { METADATA_KEYS } from "@/lib/programs/generate/patterns";
import { selectExerciseForSlot, type SelectionContext } from "@/lib/programs/generate/select-exercises";
import type { InjuryProfile } from "@/lib/programs/generate/types";

let nextId = 0;

/** A minimal, fully-formed Exercise fixture — only the fields this module's
 * selection logic reads vary per test; everything else is a safe default. */
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

function baseContext(overrides: Partial<SelectionContext> = {}): SelectionContext {
  return {
    equipmentAccess: "full_gym",
    experienceLevel: "intermediate",
    injuries: clearInjuries(),
    coachedOnOlympicLifts: false,
    ...overrides,
  };
}

/** A three-rung vertical_pull ladder mirroring the real seed data's shape:
 * pull-up (advanced, bodyweight, top rung) -> assisted-pull-up (beginner,
 * machine, mid rung) -> lat-pulldown (beginner, cable, bottom rung). */
function verticalPullLadder(): Exercise[] {
  return [
    ex({ id: "pull-up", equipment: "bodyweight", difficulty: "advanced", metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_pull"], [METADATA_KEYS.demandRank]: { vertical_pull: 10 } } }),
    ex({ id: "assisted-pull-up", equipment: "machine", difficulty: "beginner", metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_pull"], [METADATA_KEYS.demandRank]: { vertical_pull: 30 } } }),
    ex({ id: "lat-pulldown", equipment: "cable", difficulty: "beginner", metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_pull"], [METADATA_KEYS.demandRank]: { vertical_pull: 40 } } }),
  ];
}

describe("selectExerciseForSlot — ladder-based patterns", () => {
  it("picks the single most demanding exercise when nothing restricts the athlete", () => {
    const result = selectExerciseForSlot({ movementPattern: "vertical_pull", primaryMuscleGroup: "back", category: "strength" }, verticalPullLadder(), baseContext());
    if (!("exercise" in result)) throw new Error("expected a selection");
    expect(result.exercise.id).toBe("pull-up");
    expect(result.regressedSteps).toBe(0);
  });

  it("regresses past a barbell exercise for someone without one", () => {
    const ladder = [
      ex({ id: "barbell-row", equipment: "barbell", difficulty: "advanced", metadata: { [METADATA_KEYS.slotPatterns]: ["horizontal_pull"], [METADATA_KEYS.demandRank]: { horizontal_pull: 10 } } }),
      ex({ id: "dumbbell-row", equipment: "dumbbell", difficulty: "beginner", metadata: { [METADATA_KEYS.slotPatterns]: ["horizontal_pull"], [METADATA_KEYS.demandRank]: { horizontal_pull: 30 } } }),
    ];
    const result = selectExerciseForSlot(
      { movementPattern: "horizontal_pull", primaryMuscleGroup: "back", category: "strength" },
      ladder,
      baseContext({ equipmentAccess: "minimal_equipment" })
    );
    if (!("exercise" in result)) throw new Error("expected a selection");
    expect(result.exercise.id).toBe("dumbbell-row");
    expect(result.regressedSteps).toBe(1);
  });

  it("regresses past an exercise contraindicated for a flagged injury", () => {
    const ladder = [
      ex({
        id: "barbell-overhead-press",
        equipment: "barbell",
        difficulty: "advanced",
        metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_push"], [METADATA_KEYS.demandRank]: { vertical_push: 10 }, [METADATA_KEYS.contraindications]: ["shoulder"] },
      }),
      ex({
        id: "dumbbell-shoulder-press",
        equipment: "dumbbell",
        difficulty: "beginner",
        metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_push"], [METADATA_KEYS.demandRank]: { vertical_push: 30 } },
      }),
    ];
    const result = selectExerciseForSlot(
      { movementPattern: "vertical_push", primaryMuscleGroup: "shoulders", category: "strength" },
      ladder,
      baseContext({ injuries: { ...clearInjuries(), shoulder: true } })
    );
    if (!("exercise" in result)) throw new Error("expected a selection");
    expect(result.exercise.id).toBe("dumbbell-shoulder-press");
  });

  it("excludes a lift gated behind coaching until the athlete confirms they've been coached", () => {
    const ladder = [
      ex({ id: "hang-clean", equipment: "barbell", difficulty: "advanced", metadata: { [METADATA_KEYS.slotPatterns]: ["jump"], [METADATA_KEYS.requiresLiftCoaching]: true } }),
      ex({ id: "box-jump", equipment: "bodyweight", difficulty: "intermediate", metadata: { [METADATA_KEYS.slotPatterns]: ["jump"], [METADATA_KEYS.demandRank]: { jump: 20 } } }),
    ];
    const uncoached = selectExerciseForSlot({ movementPattern: "jump", primaryMuscleGroup: "quadriceps", category: "strength" }, ladder, baseContext({ coachedOnOlympicLifts: false }));
    if (!("exercise" in uncoached)) throw new Error("expected a selection");
    expect(uncoached.exercise.id).toBe("box-jump");
  });

  it("never selects an exercise with an explicit empty slot_patterns tag, regardless of its column values", () => {
    const excluded = ex({
      id: "depth-jump",
      movement_pattern: "jump",
      primary_muscle_group: "quadriceps",
      metadata: { [METADATA_KEYS.slotPatterns]: [] },
    });
    const result = selectExerciseForSlot({ movementPattern: "jump", primaryMuscleGroup: "quadriceps", category: "strength" }, [excluded], baseContext());
    expect(result).toHaveProperty("unresolved");
  });

  it("falls back to an advanced exercise for a beginner when nothing else fills the pattern", () => {
    const onlyAdvanced = [ex({ id: "barbell-back-squat", equipment: "barbell", difficulty: "advanced", metadata: { [METADATA_KEYS.slotPatterns]: ["squat_bilateral"] } })];
    const result = selectExerciseForSlot(
      { movementPattern: "squat_bilateral", primaryMuscleGroup: "quadriceps", category: "strength" },
      onlyAdvanced,
      baseContext({ experienceLevel: "beginner" })
    );
    if (!("exercise" in result)) throw new Error("expected a selection — an advanced exercise beats an empty slot");
    expect(result.exercise.id).toBe("barbell-back-squat");
  });

  it("prefers a beginner-appropriate exercise over an advanced one at the same rank when both are available", () => {
    const ladder = [
      ex({ id: "advanced-move", difficulty: "advanced", metadata: { [METADATA_KEYS.slotPatterns]: ["carry"], [METADATA_KEYS.demandRank]: { carry: 10 } } }),
      ex({ id: "beginner-move", difficulty: "beginner", metadata: { [METADATA_KEYS.slotPatterns]: ["carry"], [METADATA_KEYS.demandRank]: { carry: 20 } } }),
    ];
    const result = selectExerciseForSlot({ movementPattern: "carry", primaryMuscleGroup: "full_body", category: "strength" }, ladder, baseContext({ experienceLevel: "beginner" }));
    if (!("exercise" in result)) throw new Error("expected a selection");
    expect(result.exercise.id).toBe("beginner-move");
  });

  it("reports unresolved when the pattern has no candidates in the library at all", () => {
    const result = selectExerciseForSlot({ movementPattern: "calf_soleus", primaryMuscleGroup: "calves", category: "strength" }, [], baseContext());
    expect(result).toHaveProperty("unresolved");
  });

  it("excludes archived and non-approved rows from selection", () => {
    const archived = ex({ id: "archived-move", is_archived: true, metadata: { [METADATA_KEYS.slotPatterns]: ["carry"] } });
    const pending = ex({ id: "pending-move", review_status: "pending", owner_id: "coach-1", metadata: { [METADATA_KEYS.slotPatterns]: ["carry"] } });
    const approved = ex({ id: "approved-move", metadata: { [METADATA_KEYS.slotPatterns]: ["carry"], [METADATA_KEYS.demandRank]: { carry: 50 } } });
    const result = selectExerciseForSlot({ movementPattern: "carry", primaryMuscleGroup: "full_body", category: "strength" }, [archived, pending, approved], baseContext());
    if (!("exercise" in result)) throw new Error("expected a selection");
    expect(result.exercise.id).toBe("approved-move");
  });

  it("is stable across repeated calls with the same inputs — §14's determinism requirement", () => {
    const ladder = verticalPullLadder();
    const first = selectExerciseForSlot({ movementPattern: "vertical_pull", primaryMuscleGroup: "back", category: "strength" }, ladder, baseContext());
    const second = selectExerciseForSlot({ movementPattern: "vertical_pull", primaryMuscleGroup: "back", category: "strength" }, [...ladder].reverse(), baseContext());
    if (!("exercise" in first) || !("exercise" in second)) throw new Error("expected selections");
    expect(first.exercise.id).toBe(second.exercise.id);
  });
});

describe("selectExerciseForSlot — muscle-group-only accessory slots", () => {
  it("matches on category and primary muscle group when there is no movement pattern", () => {
    const pool = [
      ex({ id: "cable-lateral-raise", category: "strength", primary_muscle_group: "shoulders", equipment: "cable" }),
      ex({ id: "unrelated-chest-move", category: "strength", primary_muscle_group: "chest" }),
    ];
    const result = selectExerciseForSlot({ movementPattern: null, primaryMuscleGroup: "shoulders", category: "strength" }, pool, baseContext());
    if (!("exercise" in result)) throw new Error("expected a selection");
    expect(result.exercise.id).toBe("cable-lateral-raise");
  });

  it("is a stable, deterministic pick among ties (sorted by id)", () => {
    const pool = [
      ex({ id: "zebra-curl", category: "strength", primary_muscle_group: "biceps" }),
      ex({ id: "alpha-curl", category: "strength", primary_muscle_group: "biceps" }),
    ];
    const result = selectExerciseForSlot({ movementPattern: null, primaryMuscleGroup: "biceps", category: "strength" }, pool, baseContext());
    if (!("exercise" in result)) throw new Error("expected a selection");
    expect(result.exercise.id).toBe("alpha-curl");
  });

  it("reports unresolved when neither a pattern nor a muscle group is given", () => {
    const result = selectExerciseForSlot({ movementPattern: null, primaryMuscleGroup: null, category: "cardio" }, [ex()], baseContext());
    expect(result).toHaveProperty("unresolved");
  });

  it("still applies equipment and injury filters to muscle-group matches", () => {
    const pool = [
      ex({ id: "barbell-curl", category: "strength", primary_muscle_group: "biceps", equipment: "barbell" }),
      ex({ id: "band-curl", category: "strength", primary_muscle_group: "biceps", equipment: "resistance_band" }),
    ];
    const result = selectExerciseForSlot(
      { movementPattern: null, primaryMuscleGroup: "biceps", category: "strength" },
      pool,
      baseContext({ equipmentAccess: "minimal_equipment" })
    );
    if (!("exercise" in result)) throw new Error("expected a selection");
    expect(result.exercise.id).toBe("band-curl");
  });
});
