import { describe, expect, it } from "vitest";
import { buildExerciseSequence, buildSetTargets, findResumeStepIndex } from "./sequence";
import type { BlockRow, SetPrescription } from "@/lib/programs/types";

function makeSet(overrides: Partial<SetPrescription> & Pick<SetPrescription, "id" | "block_exercise_id" | "position">): SetPrescription {
  return {
    prescription_type: "fixed_weight",
    sets: 1,
    reps: null,
    min_reps: null,
    max_reps: null,
    weight_value: null,
    percent_1rm_value: null,
    pr_record_type: null,
    rpe_value: null,
    rir_value: null,
    heart_rate_zone: null,
    calories: null,
    rest_seconds: null,
    notes: null,
    distance_meters: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    ...overrides,
  };
}

function makeBlock(overrides: Partial<BlockRow> & Pick<BlockRow, "id" | "day_id" | "position" | "exercises">): BlockRow {
  return { block_type: "straight", rounds: 1, ...overrides };
}

describe("buildExerciseSequence", () => {
  it("orders exercises by block position, then exercise position", () => {
    const blocks: BlockRow[] = [
      makeBlock({
        id: "block-2",
        day_id: "day-1",
        position: 2,
        exercises: [
          { id: "ex-c", block_id: "block-2", position: 1, exercise_id: "c", custom_name: null, notes: null, exercise_category: "strength", sets: [] },
        ],
      }),
      makeBlock({
        id: "block-1",
        day_id: "day-1",
        position: 1,
        exercises: [
          { id: "ex-b", block_id: "block-1", position: 2, exercise_id: "b", custom_name: null, notes: null, exercise_category: "strength", sets: [] },
          { id: "ex-a", block_id: "block-1", position: 1, exercise_id: "a", custom_name: null, notes: null, exercise_category: "strength", sets: [] },
        ],
      }),
    ];

    const sequence = buildExerciseSequence(blocks);
    expect(sequence.map((s) => s.blockExercise.id)).toEqual(["ex-a", "ex-b", "ex-c"]);
    expect(sequence.map((s) => s.stepIndex)).toEqual([0, 1, 2]);
  });

  it("returns an empty sequence for a day with no exercises", () => {
    expect(buildExerciseSequence([])).toEqual([]);
  });

  it("interleaves a superset round-robin (A1, B1, A2, B2...) instead of finishing one exercise before the next", () => {
    const blocks: BlockRow[] = [
      makeBlock({
        id: "block-1",
        day_id: "day-1",
        position: 1,
        block_type: "superset",
        rounds: 3,
        exercises: [
          {
            id: "ex-a",
            block_id: "block-1",
            position: 1,
            exercise_id: "a",
            custom_name: null,
            notes: null,
            exercise_category: "strength",
            sets: [makeSet({ id: "s-a", block_exercise_id: "ex-a", position: 1, sets: 3 })],
          },
          {
            id: "ex-b",
            block_id: "block-1",
            position: 2,
            exercise_id: "b",
            custom_name: null,
            notes: null,
            exercise_category: "strength",
            sets: [makeSet({ id: "s-b", block_exercise_id: "ex-b", position: 1, sets: 3 })],
          },
        ],
      }),
    ];

    const sequence = buildExerciseSequence(blocks);
    expect(sequence.map((s) => s.blockExercise.id)).toEqual(["ex-a", "ex-b", "ex-a", "ex-b", "ex-a", "ex-b"]);
    expect(sequence.map((s) => s.roundNumber)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it("drops an exercise out of later rounds once its own turns are used up, without blocking its partner", () => {
    const blocks: BlockRow[] = [
      makeBlock({
        id: "block-1",
        day_id: "day-1",
        position: 1,
        block_type: "superset",
        rounds: 1,
        exercises: [
          {
            id: "ex-a",
            block_id: "block-1",
            position: 1,
            exercise_id: "a",
            custom_name: null,
            notes: null,
            exercise_category: "strength",
            sets: [makeSet({ id: "s-a", block_exercise_id: "ex-a", position: 1, sets: 3 })],
          },
          {
            id: "ex-b",
            block_id: "block-1",
            position: 2,
            exercise_id: "b",
            custom_name: null,
            notes: null,
            // Cardio/running always contributes exactly one turn, regardless
            // of its partner's set count.
            exercise_category: "cardio",
            sets: [makeSet({ id: "s-b", block_exercise_id: "ex-b", position: 1, sets: 1 })],
          },
        ],
      }),
    ];

    const sequence = buildExerciseSequence(blocks);
    expect(sequence.map((s) => s.blockExercise.id)).toEqual(["ex-a", "ex-b", "ex-a", "ex-a"]);
  });
});

describe("buildSetTargets", () => {
  it("repeats a single straight-set row `sets` times", () => {
    const targets = buildSetTargets([makeSet({ id: "s1", block_exercise_id: "ex-1", position: 1, sets: 4 })]);
    expect(targets).toHaveLength(4);
    expect(targets.every((t) => t.id === "s1")).toBe(true);
  });

  it("flattens a drop set (multiple rows, each sets=1) into one target per row, in position order", () => {
    const targets = buildSetTargets([
      makeSet({ id: "drop-2", block_exercise_id: "ex-1", position: 2, sets: 1, weight_value: 80 }),
      makeSet({ id: "drop-1", block_exercise_id: "ex-1", position: 1, sets: 1, weight_value: 100 }),
    ]);
    expect(targets.map((t) => t.id)).toEqual(["drop-1", "drop-2"]);
  });

  it("mixes a multi-set row with a single-set row correctly", () => {
    const targets = buildSetTargets([
      makeSet({ id: "warmup", block_exercise_id: "ex-1", position: 1, sets: 1 }),
      makeSet({ id: "working", block_exercise_id: "ex-1", position: 2, sets: 3 }),
    ]);
    expect(targets.map((t) => t.id)).toEqual(["warmup", "working", "working", "working"]);
  });
});

describe("findResumeStepIndex", () => {
  const sequence = buildExerciseSequence([
    makeBlock({
      id: "block-1",
      day_id: "day-1",
      position: 1,
      exercises: [
        {
          id: "ex-1",
          block_id: "block-1",
          position: 1,
          exercise_id: "a",
          custom_name: null,
          notes: null,
          exercise_category: "strength",
          sets: [makeSet({ id: "s1", block_exercise_id: "ex-1", position: 1, sets: 3 })],
        },
        {
          id: "ex-2",
          block_id: "block-1",
          position: 2,
          exercise_id: "b",
          custom_name: null,
          notes: null,
          exercise_category: "strength",
          sets: [makeSet({ id: "s2", block_exercise_id: "ex-2", position: 1, sets: 2 })],
        },
      ],
    }),
  ]);

  it("resumes at the first exercise with fewer logged sets than prescribed", () => {
    expect(findResumeStepIndex(sequence, new Map())).toBe(0);
    expect(findResumeStepIndex(sequence, new Map([["ex-1", 3]]))).toBe(1);
  });

  it("returns null once every exercise is fully logged", () => {
    expect(findResumeStepIndex(sequence, new Map([["ex-1", 3], ["ex-2", 2]]))).toBeNull();
  });

  it("resumes at the next unlogged turn, not an exercise's first occurrence, once interleaving is underway", () => {
    // ex-1: 3 sets, ex-2: 3 sets, round-robin -> [ex-1, ex-2, ex-1, ex-2, ex-1, ex-2]
    const interleaved = buildExerciseSequence([
      makeBlock({
        id: "block-1",
        day_id: "day-1",
        position: 1,
        exercises: [
          {
            id: "ex-1",
            block_id: "block-1",
            position: 1,
            exercise_id: "a",
            custom_name: null,
            notes: null,
            exercise_category: "strength",
            sets: [makeSet({ id: "s1", block_exercise_id: "ex-1", position: 1, sets: 3 })],
          },
          {
            id: "ex-2",
            block_id: "block-1",
            position: 2,
            exercise_id: "b",
            custom_name: null,
            notes: null,
            exercise_category: "strength",
            sets: [makeSet({ id: "s2", block_exercise_id: "ex-2", position: 1, sets: 3 })],
          },
        ],
      }),
    ]);

    // Athlete has done A1, B1, A2 (ex-1 logged twice, ex-2 logged once) and
    // is about to do B2 — the next unlogged turn is index 3 (the second
    // ex-2 step), not index 0 (ex-1's first step, which the old
    // one-step-per-exercise logic would have incorrectly sent them back to).
    expect(findResumeStepIndex(interleaved, new Map([["ex-1", 2], ["ex-2", 1]]))).toBe(3);
  });
});
