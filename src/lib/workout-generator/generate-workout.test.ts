import { describe, expect, it } from "vitest";
import { generateWorkout } from "./generate-workout";
import { EXERCISES } from "./exercises";

// Deterministic RNG for reproducible test assertions: always picks the
// first eligible candidate rather than a random one.
const firstPick = () => 0;

describe("generateWorkout", () => {
  it("only selects bodyweight exercises when equipment is bodyweight", () => {
    const workout = generateWorkout({
      goal: "general_fitness",
      equipment: "bodyweight",
      focus: "full_body",
      timeMinutes: 45,
      rng: firstPick,
    });
    expect(workout.exercises.length).toBeGreaterThan(0);
    for (const we of workout.exercises) {
      expect(we.exercise.equipment).toBe("bodyweight");
    }
  });

  it("allows bodyweight and dumbbell exercises when equipment is dumbbell", () => {
    const workout = generateWorkout({
      goal: "hypertrophy",
      equipment: "dumbbell",
      focus: "full_body",
      timeMinutes: 45,
      rng: firstPick,
    });
    for (const we of workout.exercises) {
      expect(["bodyweight", "dumbbell"]).toContain(we.exercise.equipment);
    }
  });

  it("allows any equipment tier when equipment is full_gym", () => {
    const workout = generateWorkout({
      goal: "strength",
      equipment: "full_gym",
      focus: "full_body",
      timeMinutes: 45,
      rng: firstPick,
    });
    for (const we of workout.exercises) {
      expect(["bodyweight", "dumbbell", "full_gym"]).toContain(we.exercise.equipment);
    }
  });

  it("never includes squat or hinge patterns for a push focus", () => {
    const workout = generateWorkout({
      goal: "hypertrophy",
      equipment: "full_gym",
      focus: "push",
      timeMinutes: 60,
      rng: firstPick,
    });
    for (const we of workout.exercises) {
      expect(["squat", "hinge"]).not.toContain(we.exercise.pattern);
    }
  });

  it("never includes push or pull patterns for a lower focus", () => {
    const workout = generateWorkout({
      goal: "hypertrophy",
      equipment: "full_gym",
      focus: "lower",
      timeMinutes: 60,
      rng: firstPick,
    });
    for (const we of workout.exercises) {
      expect(we.exercise.pattern).not.toMatch(/push|pull/);
    }
  });

  it("never selects the same exercise twice in one workout", () => {
    const workout = generateWorkout({
      goal: "general_fitness",
      equipment: "full_gym",
      focus: "full_body",
      timeMinutes: 60,
      rng: firstPick,
    });
    const ids = workout.exercises.map((we) => we.exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("generates more exercises for a longer time budget than a shorter one, all else equal", () => {
    const short = generateWorkout({
      goal: "hypertrophy",
      equipment: "full_gym",
      focus: "full_body",
      timeMinutes: 15,
      rng: firstPick,
    });
    const long = generateWorkout({
      goal: "hypertrophy",
      equipment: "full_gym",
      focus: "full_body",
      timeMinutes: 60,
      rng: firstPick,
    });
    expect(long.exercises.length).toBeGreaterThan(short.exercises.length);
  });

  it("never returns fewer than 2 exercises even for a very short time budget", () => {
    const workout = generateWorkout({
      goal: "strength",
      equipment: "full_gym",
      focus: "full_body",
      timeMinutes: 5,
      rng: firstPick,
    });
    expect(workout.exercises.length).toBeGreaterThanOrEqual(2);
  });

  it("caps the workout at a sane maximum exercise count for a very long time budget", () => {
    const workout = generateWorkout({
      goal: "general_fitness",
      equipment: "full_gym",
      focus: "full_body",
      timeMinutes: 240,
      rng: firstPick,
    });
    expect(workout.exercises.length).toBeLessThanOrEqual(8);
  });

  it("applies the strength goal's compound scheme (low reps, long rest) to compound exercises", () => {
    const workout = generateWorkout({
      goal: "strength",
      equipment: "full_gym",
      focus: "full_body",
      timeMinutes: 45,
      rng: firstPick,
    });
    const compound = workout.exercises.find((we) => we.exercise.isCompound);
    expect(compound?.reps).toBe("4-6");
    expect(compound?.restSeconds).toBe(150);
  });

  it("applies the general_fitness goal's higher-rep, shorter-rest scheme", () => {
    const workout = generateWorkout({
      goal: "general_fitness",
      equipment: "full_gym",
      focus: "full_body",
      timeMinutes: 45,
      rng: firstPick,
    });
    const compound = workout.exercises.find((we) => we.exercise.isCompound);
    expect(compound?.reps).toBe("12-15");
    expect(compound?.restSeconds).toBe(45);
  });

  it("returns a positive estimated duration", () => {
    const workout = generateWorkout({
      goal: "hypertrophy",
      equipment: "dumbbell",
      focus: "upper",
      timeMinutes: 30,
      rng: firstPick,
    });
    expect(workout.estimatedMinutes).toBeGreaterThan(0);
  });

  it("does not crash for every goal/equipment/focus combination", () => {
    const goals = ["strength", "hypertrophy", "general_fitness"] as const;
    const equipmentTiers = ["bodyweight", "dumbbell", "full_gym"] as const;
    const focuses = ["full_body", "upper", "lower", "push", "pull"] as const;

    for (const goal of goals) {
      for (const equipment of equipmentTiers) {
        for (const focus of focuses) {
          const workout = generateWorkout({ goal, equipment, focus, timeMinutes: 30 });
          expect(workout.exercises.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("has at least 1 bodyweight exercise for every movement pattern except carry (which requires external load by definition)", () => {
    const patterns = new Set(EXERCISES.map((e) => e.pattern));
    for (const pattern of patterns) {
      if (pattern === "carry") continue;
      const bodyweightCount = EXERCISES.filter(
        (e) => e.pattern === pattern && e.equipment === "bodyweight"
      ).length;
      expect(bodyweightCount).toBeGreaterThanOrEqual(1);
    }
  });
});
