import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LEVELS,
  GOALS,
  computeMacros,
  estimateCalorieTarget,
  harrisBenedict,
  katchMcArdle,
  mifflinStJeor,
} from "./calorie-macro";

describe("mifflinStJeor", () => {
  it("matches the published formula for a male", () => {
    // 10*80 + 6.25*180 - 5*25 + 5
    expect(mifflinStJeor("male", 80, 180, 25)).toBeCloseTo(1805, 5);
  });

  it("matches the published formula for a female", () => {
    // 10*60 + 6.25*165 - 5*30 - 161
    expect(mifflinStJeor("female", 60, 165, 30)).toBeCloseTo(1320.25, 5);
  });
});

describe("harrisBenedict", () => {
  it("matches the revised 1990 formula for a male", () => {
    expect(harrisBenedict("male", 80, 180, 25)).toBeCloseTo(1882.017, 2);
  });
});

describe("katchMcArdle", () => {
  it("matches the published formula", () => {
    expect(katchMcArdle(64)).toBeCloseTo(1752.4, 5);
  });
});

describe("estimateCalorieTarget", () => {
  const baseInputs = {
    sex: "male" as const,
    age: 25,
    heightCm: 180,
    weightKg: 80,
    activityLevel: "moderate" as const,
    goal: "maintain" as const,
  };

  it("averages Mifflin-St Jeor and Harris-Benedict when no body fat % is given", () => {
    const result = estimateCalorieTarget(baseInputs);
    expect(result.usedKatchMcArdle).toBe(false);
    expect(Object.keys(result.bmrByFormula)).toEqual(["mifflinStJeor", "harrisBenedict"]);
    const expectedAverage = (mifflinStJeor("male", 80, 180, 25) + harrisBenedict("male", 80, 180, 25)) / 2;
    expect(result.bmrAverage).toBeCloseTo(expectedAverage, 5);
  });

  it("adds Katch-McArdle when body fat % is given, and it affects the average", () => {
    const result = estimateCalorieTarget({ ...baseInputs, bodyFatPercent: 20 });
    expect(result.usedKatchMcArdle).toBe(true);
    expect(Object.keys(result.bmrByFormula)).toContain("katchMcArdle");
    expect(result.bmrByFormula.katchMcArdle).toBeCloseTo(katchMcArdle(80 * 0.8), 5);
  });

  it("applies the activity multiplier to reach TDEE", () => {
    const result = estimateCalorieTarget(baseInputs);
    const activity = ACTIVITY_LEVELS.find((a) => a.id === "moderate")!;
    expect(result.tdeeAverage).toBeCloseTo(result.bmrAverage * activity.multiplier, 5);
  });

  it("applies a negative adjustment for a cut goal and positive for a gain goal", () => {
    const cut = estimateCalorieTarget({ ...baseInputs, goal: "cut" });
    const maintain = estimateCalorieTarget({ ...baseInputs, goal: "maintain" });
    const gain = estimateCalorieTarget({ ...baseInputs, goal: "gain" });
    expect(cut.calorieTarget).toBeLessThan(maintain.calorieTarget);
    expect(gain.calorieTarget).toBeGreaterThan(maintain.calorieTarget);
  });

  it("produces a higher TDEE for a more active activity level, all else equal", () => {
    const sedentary = estimateCalorieTarget({ ...baseInputs, activityLevel: "sedentary" });
    const veryActive = estimateCalorieTarget({ ...baseInputs, activityLevel: "very_active" });
    expect(veryActive.tdeeAverage).toBeGreaterThan(sedentary.tdeeAverage);
  });

  it("rejects invalid inputs", () => {
    expect(() => estimateCalorieTarget({ ...baseInputs, age: 0 })).toThrow(RangeError);
    expect(() => estimateCalorieTarget({ ...baseInputs, heightCm: -1 })).toThrow(RangeError);
    expect(() => estimateCalorieTarget({ ...baseInputs, weightKg: 0 })).toThrow(RangeError);
  });

  it("ignores an out-of-range body fat % rather than using nonsense lean mass", () => {
    const result = estimateCalorieTarget({ ...baseInputs, bodyFatPercent: 150 });
    expect(result.usedKatchMcArdle).toBe(false);
  });
});

describe("computeMacros", () => {
  it("allocates fat as a fixed percentage of total calories", () => {
    const macros = computeMacros(2500, 80, "maintain");
    expect(macros.fatKcal).toBeCloseTo(2500 * 0.25, 5);
  });

  it("sets protein from the goal's g/kg bodyweight value", () => {
    const macros = computeMacros(2500, 80, "cut");
    const cutGoal = GOALS.find((g) => g.id === "cut")!;
    expect(macros.proteinG).toBeCloseTo(80 * cutGoal.proteinGPerKg, 5);
  });

  it("fills remaining calories with carbs, and macros sum back to the calorie target", () => {
    const calorieTarget = 2500;
    const macros = computeMacros(calorieTarget, 80, "maintain");
    const total = macros.proteinKcal + macros.fatKcal + macros.carbKcal;
    expect(total).toBeCloseTo(calorieTarget, 5);
    expect(macros.carbsClampedToZero).toBe(false);
  });

  it("clamps carbs to zero without going negative when protein + fat exceed the target", () => {
    // Very low calorie target relative to a high bodyweight makes protein
    // alone consume most/all of the budget.
    const macros = computeMacros(800, 150, "cut");
    expect(macros.carbG).toBe(0);
    expect(macros.carbKcal).toBe(0);
    expect(macros.carbsClampedToZero).toBe(true);
    expect(macros.fatG).toBeGreaterThanOrEqual(0);
  });

  it("rejects invalid inputs", () => {
    expect(() => computeMacros(0, 80, "maintain")).toThrow(RangeError);
    expect(() => computeMacros(2000, 0, "maintain")).toThrow(RangeError);
  });
});
