import { describe, expect, it } from "vitest";
import { QUESTIONS, recommendTrainingStyle, STYLES } from "./recommend-style";

function answersWith(overrides: Record<string, string>): Record<string, string> {
  // Sensible baseline: full gym + conditioning equipment (excludes nothing),
  // "consistent" structure (weak/neutral signal) so overrides dominate.
  return {
    goal: "health",
    equipment: "full_gym_conditioning",
    structure: "consistent",
    ...overrides,
  };
}

describe("recommendTrainingStyle", () => {
  it("recommends powerlifting when goal + equipment + structure all point that way", () => {
    const result = recommendTrainingStyle({
      goal: "strength",
      equipment: "full_gym",
      structure: "simple",
    });
    expect(result.primary.id).toBe("powerlifting");
  });

  it("recommends bodybuilding when goal + structure point that way", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "muscle", equipment: "dumbbell", structure: "varied" })
    );
    expect(result.primary.id).toBe("bodybuilding");
  });

  it("recommends calisthenics for a bodyweight-only, skill-focused profile", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "skills", equipment: "bodyweight", structure: "skill" })
    );
    expect(result.primary.id).toBe("calisthenics");
  });

  it("recommends hybrid for a well-rounded, varied profile", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "well_rounded", equipment: "full_gym_conditioning", structure: "mixed" })
    );
    expect(result.primary.id).toBe("hybrid");
  });

  it("excludes powerlifting entirely when equipment is bodyweight-only, even if goal points there", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "strength", equipment: "bodyweight", structure: "simple" })
    );
    expect(result.primary.id).not.toBe("powerlifting");
    expect(result.scores.powerlifting).toBe("excluded");
  });

  it("excludes powerlifting entirely when equipment is dumbbell-only", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "strength", equipment: "dumbbell", structure: "simple" })
    );
    expect(result.scores.powerlifting).toBe("excluded");
  });

  it("flags a close second when the top two scores are within 1 point", () => {
    // goal=strength (powerlifting +3), structure=simple (powerlifting +2, general +1),
    // equipment=full_gym (powerlifting +2, bodybuilding +1, general +1)
    // powerlifting = 7, general_fitness = 2 -- not close. Construct an actual near-tie instead:
    const result = recommendTrainingStyle({
      goal: "health", // general_fitness +3
      equipment: "full_gym", // powerlifting +2, bodybuilding +1, general_fitness +1
      structure: "simple", // powerlifting +2, general_fitness +1
    });
    // general_fitness = 3+1+1 = 5, powerlifting = 2+2 = 4 -> gap of 1, close second
    expect(result.primary.id).toBe("general_fitness");
    expect(result.secondary?.id).toBe("powerlifting");
  });

  it("does not flag a close second when the gap is large", () => {
    const result = recommendTrainingStyle({
      goal: "muscle",
      equipment: "dumbbell",
      structure: "varied",
    });
    expect(result.secondary).toBeNull();
  });

  it("throws when an answer is missing", () => {
    expect(() => recommendTrainingStyle({ goal: "muscle", equipment: "dumbbell" })).toThrow(RangeError);
  });

  it("throws for an unknown option id", () => {
    expect(() =>
      recommendTrainingStyle({ goal: "not-a-real-option", equipment: "dumbbell", structure: "varied" })
    ).toThrow(RangeError);
  });

  it("never crashes and always returns a non-excluded primary across every answer combination", () => {
    for (const goalOption of QUESTIONS[0]!.options) {
      for (const equipmentOption of QUESTIONS[1]!.options) {
        for (const structureOption of QUESTIONS[2]!.options) {
          const result = recommendTrainingStyle({
            goal: goalOption.id,
            equipment: equipmentOption.id,
            structure: structureOption.id,
          });
          expect(result.scores[result.primary.id]).not.toBe("excluded");
          expect(STYLES[result.primary.id]).toBeDefined();
        }
      }
    }
  });
});
