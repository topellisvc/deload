import { describe, expect, it } from "vitest";
import {
  EXPERIENCE_LEVELS,
  GOALS,
  MAX_DAYS_PER_WEEK,
  MIN_DAYS_PER_WEEK,
  recommendTrainingSplit,
  type ExperienceLevel,
  type Goal,
} from "./recommend-split";

describe("recommendTrainingSplit", () => {
  it("always recommends full body at 2-3 days a week, regardless of goal or experience", () => {
    for (const goal of ["strength", "hypertrophy", "general_fitness"] as Goal[]) {
      for (const experience of ["beginner", "intermediate", "advanced"] as ExperienceLevel[]) {
        for (const daysPerWeek of [2, 3]) {
          const result = recommendTrainingSplit({ goal, experience, daysPerWeek });
          expect(result.split.id).toBe("full_body");
        }
      }
    }
  });

  it("recommends full body for a beginner at 4 days, upper/lower for intermediate/advanced", () => {
    const beginner = recommendTrainingSplit({ goal: "hypertrophy", experience: "beginner", daysPerWeek: 4 });
    expect(beginner.split.id).toBe("full_body");

    const intermediate = recommendTrainingSplit({ goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4 });
    expect(intermediate.split.id).toBe("upper_lower");

    const advanced = recommendTrainingSplit({ goal: "hypertrophy", experience: "advanced", daysPerWeek: 4 });
    expect(advanced.split.id).toBe("upper_lower");
  });

  it("keeps beginners on upper/lower even at 5-6 days a week", () => {
    for (const daysPerWeek of [5, 6]) {
      const result = recommendTrainingSplit({ goal: "hypertrophy", experience: "beginner", daysPerWeek });
      expect(result.split.id).toBe("upper_lower");
    }
  });

  it("recommends push/pull/legs for intermediate/advanced hypertrophy at 5-6 days", () => {
    for (const experience of ["intermediate", "advanced"] as ExperienceLevel[]) {
      for (const daysPerWeek of [5, 6]) {
        const result = recommendTrainingSplit({ goal: "hypertrophy", experience, daysPerWeek });
        expect(result.split.id).toBe("push_pull_legs");
      }
    }
  });

  it("keeps strength and general fitness goals on upper/lower even at high frequency", () => {
    for (const goal of ["strength", "general_fitness"] as Goal[]) {
      for (const daysPerWeek of [5, 6]) {
        const result = recommendTrainingSplit({ goal, experience: "advanced", daysPerWeek });
        expect(result.split.id).toBe("upper_lower");
      }
    }
  });

  it("builds a schedule of the correct length that cycles through the split's day types", () => {
    const result = recommendTrainingSplit({ goal: "hypertrophy", experience: "advanced", daysPerWeek: 5 });
    expect(result.split.id).toBe("push_pull_legs");
    expect(result.schedule).toEqual(["Push", "Pull", "Legs", "Push", "Pull"]);
  });

  it("builds a full-body schedule that repeats the single day type", () => {
    const result = recommendTrainingSplit({ goal: "general_fitness", experience: "beginner", daysPerWeek: 3 });
    expect(result.schedule).toEqual(["Full Body", "Full Body", "Full Body"]);
  });

  it("produces a non-empty reasoning and frequency description for every recommendation", () => {
    const result = recommendTrainingSplit({ goal: "strength", experience: "intermediate", daysPerWeek: 4 });
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.frequencyDescription.length).toBeGreaterThan(0);
  });

  it("rejects days-per-week outside the supported range", () => {
    expect(() =>
      recommendTrainingSplit({ goal: "strength", experience: "beginner", daysPerWeek: 1 })
    ).toThrow(RangeError);
    expect(() =>
      recommendTrainingSplit({ goal: "strength", experience: "beginner", daysPerWeek: 7 })
    ).toThrow(RangeError);
    expect(() =>
      recommendTrainingSplit({ goal: "strength", experience: "beginner", daysPerWeek: 3.5 })
    ).toThrow(RangeError);
  });

  it("never crashes across the full goal x experience x days-per-week matrix", () => {
    for (const goal of GOALS.map((g) => g.id)) {
      for (const experience of EXPERIENCE_LEVELS.map((e) => e.id)) {
        for (let daysPerWeek = MIN_DAYS_PER_WEEK; daysPerWeek <= MAX_DAYS_PER_WEEK; daysPerWeek++) {
          const result = recommendTrainingSplit({ goal, experience, daysPerWeek });
          expect(result.schedule).toHaveLength(daysPerWeek);
          expect(result.split.dayTypes.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
