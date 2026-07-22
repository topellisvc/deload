import { describe, expect, it } from "vitest";
import {
  BODY_FAT_CATEGORIES,
  convertLength,
  convertMass,
  estimateBodyFat,
} from "./body-fat";

describe("convertLength", () => {
  it("converts cm to inches and back", () => {
    expect(convertLength(100, "cm", "in")).toBeCloseTo(39.3701, 3);
    expect(convertLength(convertLength(100, "cm", "in"), "in", "cm")).toBeCloseTo(100, 5);
  });

  it("is a no-op for matching units", () => {
    expect(convertLength(50, "in", "in")).toBe(50);
  });
});

describe("convertMass", () => {
  it("converts kg to lb and back", () => {
    expect(convertMass(100, "kg", "lb")).toBeCloseTo(220.462, 2);
    expect(convertMass(convertMass(100, "kg", "lb"), "lb", "kg")).toBeCloseTo(100, 5);
  });
});

describe("estimateBodyFat", () => {
  it("computes a plausible result for a typical male", () => {
    // ~40in waist, ~15in neck, ~70in height, 85kg
    const result = estimateBodyFat({
      sex: "male",
      heightIn: 70,
      neckIn: 15,
      waistIn: 40,
      weightKg: 85,
    });
    expect(result.bodyFatPercent).toBeGreaterThan(15);
    expect(result.bodyFatPercent).toBeLessThan(35);
    expect(result.leanMassKg + result.fatMassKg).toBeCloseTo(85, 5);
  });

  it("computes a plausible result for a typical female", () => {
    const result = estimateBodyFat({
      sex: "female",
      heightIn: 65,
      neckIn: 13,
      waistIn: 35,
      hipIn: 42,
      weightKg: 65,
    });
    expect(result.bodyFatPercent).toBeGreaterThan(10);
    expect(result.bodyFatPercent).toBeLessThan(30);
    expect(result.leanMassKg + result.fatMassKg).toBeCloseTo(65, 5);
  });

  it("throws for the female formula when hip is missing", () => {
    expect(() =>
      estimateBodyFat({ sex: "female", heightIn: 65, neckIn: 12, waistIn: 30, weightKg: 65 })
    ).toThrow(RangeError);
  });

  it("throws when waist is not greater than neck", () => {
    expect(() =>
      estimateBodyFat({ sex: "male", heightIn: 70, neckIn: 16, waistIn: 15, weightKg: 80 })
    ).toThrow(RangeError);
  });

  it("throws for non-positive inputs", () => {
    expect(() =>
      estimateBodyFat({ sex: "male", heightIn: 0, neckIn: 15, waistIn: 40, weightKg: 80 })
    ).toThrow(RangeError);
    expect(() =>
      estimateBodyFat({ sex: "male", heightIn: 70, neckIn: 15, waistIn: 40, weightKg: -1 })
    ).toThrow(RangeError);
  });

  it("clamps extreme results into a sane physiological range", () => {
    // Contrived near-equal waist/neck pushes the raw formula toward an
    // implausible extreme; result should still be clamped sensibly.
    const result = estimateBodyFat({
      sex: "male",
      heightIn: 70,
      neckIn: 15,
      waistIn: 15.5,
      weightKg: 80,
    });
    expect(result.bodyFatPercent).toBeGreaterThanOrEqual(2);
    expect(result.bodyFatPercent).toBeLessThanOrEqual(60);
  });

  it("assigns lower body fat to a leaner waist:neck ratio, holding other inputs constant", () => {
    const leaner = estimateBodyFat({
      sex: "male",
      heightIn: 70,
      neckIn: 15,
      waistIn: 33,
      weightKg: 80,
    });
    const heavier = estimateBodyFat({
      sex: "male",
      heightIn: 70,
      neckIn: 15,
      waistIn: 42,
      weightKg: 80,
    });
    expect(leaner.bodyFatPercent).toBeLessThan(heavier.bodyFatPercent);
  });

  it("defines male and female category tables that cover the full range with no gaps", () => {
    for (const sex of ["male", "female"] as const) {
      const sorted = [...BODY_FAT_CATEGORIES[sex]].sort(
        (a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity)
      );
      expect(sorted[0]!.min).toBeNull();
      expect(sorted[sorted.length - 1]!.max).toBeNull();
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i]!.max).toBe(sorted[i + 1]!.min);
      }
    }
  });

  it("classifies a low body fat male as Athletes or Essential fat", () => {
    const result = estimateBodyFat({
      sex: "male",
      heightIn: 70,
      neckIn: 16,
      waistIn: 30,
      weightKg: 75,
    });
    expect(["Essential fat", "Athletes"]).toContain(result.category);
  });
});
