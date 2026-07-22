import { describe, expect, it } from "vitest";
import { QUESTIONS, STYLES, recommendTrainingStyle } from "./recommend-style";

function answersWith(overrides: Record<string, string>): Record<string, string> {
  // Sensible baseline: full gym + conditioning equipment (excludes nothing),
  // "consistent" structure and "general_progress" motivation (both weak/
  // neutral signals), so overrides dominate.
  return {
    goal: "health",
    equipment: "full_gym_conditioning",
    structure: "consistent",
    progress: "general_progress",
    ...overrides,
  };
}

describe("recommendTrainingStyle", () => {
  it("recommends powerlifting when goal, equipment, structure, and progress all point that way", () => {
    const result = recommendTrainingStyle({
      goal: "strength",
      equipment: "full_gym",
      structure: "simple",
      progress: "numbers",
    });
    expect(result.primary.id).toBe("powerlifting");
  });

  it("recommends bodybuilding when goal + structure + progress point that way", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "muscle", equipment: "dumbbell", structure: "varied", progress: "mirror" })
    );
    expect(result.primary.id).toBe("bodybuilding");
  });

  it("recommends calisthenics for a bodyweight-only, skill-focused profile", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "skills", equipment: "bodyweight", structure: "skill", progress: "movement_skill" })
    );
    expect(result.primary.id).toBe("calisthenics");
  });

  it("recommends hybrid for a well-rounded, varied profile", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "well_rounded", equipment: "full_gym_conditioning", structure: "mixed" })
    );
    expect(result.primary.id).toBe("hybrid");
  });

  it("recommends power & speed for an explosive, performance-driven profile", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "power_speed", equipment: "full_gym_conditioning", structure: "explosive", progress: "performance" })
    );
    expect(result.primary.id).toBe("power_speed");
  });

  it("recommends powerbuilding for a strength+size profile with barbell access", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "powerbuilding", equipment: "full_gym", structure: "heavy_and_pump", progress: "numbers" })
    );
    expect(result.primary.id).toBe("powerbuilding");
  });

  it("recommends crossfit for a competitive, scored, well-equipped profile", () => {
    const result = recommendTrainingStyle(
      answersWith({ goal: "crossfit", equipment: "full_gym_conditioning", structure: "scored", progress: "numbers" })
    );
    expect(result.primary.id).toBe("crossfit");
  });

  it("excludes powerlifting, powerbuilding, and crossfit when equipment is bodyweight-only, even if goal points there", () => {
    for (const goal of ["strength", "powerbuilding", "crossfit"]) {
      const result = recommendTrainingStyle(answersWith({ goal, equipment: "bodyweight" }));
      expect(result.primary.id).not.toBe("powerlifting");
      expect(result.primary.id).not.toBe("powerbuilding");
      expect(result.primary.id).not.toBe("crossfit");
      expect(result.scores.powerlifting).toBe("excluded");
      expect(result.scores.powerbuilding).toBe("excluded");
      expect(result.scores.crossfit).toBe("excluded");
    }
  });

  it("excludes powerlifting and powerbuilding (but not crossfit) when equipment is dumbbell-only", () => {
    const result = recommendTrainingStyle(answersWith({ goal: "strength", equipment: "dumbbell" }));
    expect(result.scores.powerlifting).toBe("excluded");
    expect(result.scores.powerbuilding).toBe("excluded");
    expect(result.scores.crossfit).not.toBe("excluded");
  });

  it("does not flag a close second when the gap is large", () => {
    const result = recommendTrainingStyle({
      goal: "muscle",
      equipment: "dumbbell",
      structure: "varied",
      progress: "mirror",
    });
    expect(result.secondary).toBeNull();
  });

  it("throws when an answer is missing", () => {
    expect(() =>
      recommendTrainingStyle({ goal: "muscle", equipment: "dumbbell", structure: "varied" })
    ).toThrow(RangeError);
  });

  it("throws for an unknown option id", () => {
    expect(() =>
      recommendTrainingStyle(answersWith({ goal: "not-a-real-option" }))
    ).toThrow(RangeError);
  });

  it("has exactly 4 questions and one option per style represented in the goal question", () => {
    expect(QUESTIONS).toHaveLength(4);
    const goalQuestion = QUESTIONS.find((q) => q.id === "goal")!;
    expect(goalQuestion.options).toHaveLength(Object.keys(STYLES).length);
  });

  it("never crashes and always returns a non-excluded primary across every answer combination", () => {
    for (const goalOption of QUESTIONS[0]!.options) {
      for (const equipmentOption of QUESTIONS[1]!.options) {
        for (const structureOption of QUESTIONS[2]!.options) {
          for (const progressOption of QUESTIONS[3]!.options) {
            const result = recommendTrainingStyle({
              goal: goalOption.id,
              equipment: equipmentOption.id,
              structure: structureOption.id,
              progress: progressOption.id,
            });
            expect(result.scores[result.primary.id]).not.toBe("excluded");
            expect(STYLES[result.primary.id]).toBeDefined();
          }
        }
      }
    }
  });

  it("reaches every style as the top recommendation somewhere in the full answer space", () => {
    const reached = new Set<string>();
    for (const goalOption of QUESTIONS[0]!.options) {
      for (const equipmentOption of QUESTIONS[1]!.options) {
        for (const structureOption of QUESTIONS[2]!.options) {
          for (const progressOption of QUESTIONS[3]!.options) {
            const result = recommendTrainingStyle({
              goal: goalOption.id,
              equipment: equipmentOption.id,
              structure: structureOption.id,
              progress: progressOption.id,
            });
            reached.add(result.primary.id);
          }
        }
      }
    }
    expect(reached.size).toBe(Object.keys(STYLES).length);
  });
});
