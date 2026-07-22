import { describe, expect, it } from "vitest";
import {
  FORMULAS,
  RELIABLE_REP_CEILING,
  convertWeight,
  estimateOneRepMax,
  generateTrainingTable,
  roundToIncrement,
} from "./one-rep-max";

describe("estimateOneRepMax", () => {
  it("returns the lifted weight itself for a 1-rep set", () => {
    const result = estimateOneRepMax(100, 1);
    expect(result.average).toBe(100);
    expect(result.low).toBe(100);
    expect(result.high).toBe(100);
    expect(result.isLowConfidence).toBe(false);
    for (const formula of FORMULAS) {
      expect(result.byFormula[formula.id]).toBe(100);
    }
  });

  it("estimates a higher 1RM than the lifted weight for reps > 1", () => {
    const result = estimateOneRepMax(100, 5);
    expect(result.average).toBeGreaterThan(100);
    expect(result.low).toBeLessThanOrEqual(result.average);
    expect(result.high).toBeGreaterThanOrEqual(result.average);
  });

  it("flags low confidence beyond the reliable rep ceiling", () => {
    const reliable = estimateOneRepMax(100, RELIABLE_REP_CEILING);
    const unreliable = estimateOneRepMax(100, RELIABLE_REP_CEILING + 1);
    expect(reliable.isLowConfidence).toBe(false);
    expect(unreliable.isLowConfidence).toBe(true);
  });

  it("produces a result for every registered formula", () => {
    const result = estimateOneRepMax(140, 8);
    expect(Object.keys(result.byFormula).sort()).toEqual(
      FORMULAS.map((f) => f.id).sort()
    );
  });

  it("rejects non-positive weight", () => {
    expect(() => estimateOneRepMax(0, 5)).toThrow(RangeError);
    expect(() => estimateOneRepMax(-10, 5)).toThrow(RangeError);
  });

  it("rejects out-of-range or non-integer reps", () => {
    expect(() => estimateOneRepMax(100, 0)).toThrow(RangeError);
    expect(() => estimateOneRepMax(100, 21)).toThrow(RangeError);
    expect(() => estimateOneRepMax(100, 5.5)).toThrow(RangeError);
  });
});

describe("generateTrainingTable", () => {
  it("generates 11 rows from 100% down to 50% in 5% steps", () => {
    const table = generateTrainingTable(200);
    expect(table).toHaveLength(11);
    expect(table[0]).toMatchObject({ percentage: 100, weight: 200 });
    expect(table[table.length - 1]).toMatchObject({ percentage: 50, weight: 100 });
  });

  it("computes proportional weight for each percentage", () => {
    const table = generateTrainingTable(150);
    const row80 = table.find((r) => r.percentage === 80);
    expect(row80?.weight).toBeCloseTo(120, 5);
  });

  it("assigns higher-strength zones to higher percentages", () => {
    const table = generateTrainingTable(100);
    expect(table.find((r) => r.percentage === 100)?.zone).toBe("Max Strength");
    expect(table.find((r) => r.percentage === 55)?.zone).toBe("Muscular Endurance");
  });

  it("rejects non-positive 1RM", () => {
    expect(() => generateTrainingTable(0)).toThrow(RangeError);
  });
});

describe("convertWeight", () => {
  it("converts kg to lb and back", () => {
    const lb = convertWeight(100, "kg", "lb");
    expect(lb).toBeCloseTo(220.46, 1);
    expect(convertWeight(lb, "lb", "kg")).toBeCloseTo(100, 5);
  });

  it("is a no-op when units match", () => {
    expect(convertWeight(123, "kg", "kg")).toBe(123);
  });
});

describe("roundToIncrement", () => {
  it("rounds to the nearest increment", () => {
    expect(roundToIncrement(101.2, 2.5)).toBe(100);
    expect(roundToIncrement(103, 2.5)).toBe(102.5);
    expect(roundToIncrement(97, 5)).toBe(95);
  });
});
