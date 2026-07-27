import { describe, it, expect } from "vitest";
import {
  PRESCRIPTION_TYPES_BY_CATEGORY,
  getPrescriptionTypeDef,
  defaultPrescriptionType,
  suggestedWeightFromPercent1RM,
} from "./prescription-types";

describe("cardio 'intervals' prescription type", () => {
  it("is available for the cardio category, with sets/duration/distance/rest fields", () => {
    const def = getPrescriptionTypeDef("cardio", "intervals");
    expect(def).toBeDefined();
    expect(def?.prescriptionFields).toEqual(["sets", "duration", "distance", "rest"]);
  });

  it("resolves independently from running's own 'intervals' entry (same value, different category)", () => {
    const cardio = getPrescriptionTypeDef("cardio", "intervals");
    const running = getPrescriptionTypeDef("running", "intervals");
    expect(cardio).toBeDefined();
    expect(running).toBeDefined();
    // Both exist under the same value but are looked up per-category —
    // not the same object, and each only appears in its own category's list.
    expect(PRESCRIPTION_TYPES_BY_CATEGORY.cardio).toContain(cardio);
    expect(PRESCRIPTION_TYPES_BY_CATEGORY.running).toContain(running);
    expect(PRESCRIPTION_TYPES_BY_CATEGORY.cardio).not.toContain(running);
  });

  it("does not resolve for the strength category", () => {
    expect(getPrescriptionTypeDef("strength", "intervals" as never)).toBeUndefined();
  });
});

describe("defaultPrescriptionType", () => {
  it("still points at each category's first listed type after the cardio addition", () => {
    expect(defaultPrescriptionType("strength")).toBe("fixed_weight");
    expect(defaultPrescriptionType("running")).toBe("distance");
    expect(defaultPrescriptionType("cardio")).toBe("time");
  });
});

describe("suggestedWeightFromPercent1RM", () => {
  it("returns null when either input is missing", () => {
    expect(suggestedWeightFromPercent1RM(null, 100)).toBeNull();
    expect(suggestedWeightFromPercent1RM(80, null)).toBeNull();
  });

  it("computes and rounds to 1 decimal", () => {
    expect(suggestedWeightFromPercent1RM(80, 100)).toBe(80);
    expect(suggestedWeightFromPercent1RM(72.5, 137)).toBe(99.3);
  });
});
