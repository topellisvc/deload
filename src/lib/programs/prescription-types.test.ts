import { describe, it, expect } from "vitest";
import {
  PRESCRIPTION_TYPES_BY_CATEGORY,
  getPrescriptionTypeDef,
  defaultPrescriptionType,
  defaultCategoryForDiscipline,
  suggestedWeightFromPercent1RM,
  resolvePercent1RMRecord,
  exerciseMaxRecordType,
  parseExerciseIdFromRecordType,
} from "./prescription-types";
import type { PersonalRecord } from "@/lib/supabase/types";

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

describe("cardio 'reps' prescription type", () => {
  /** Bodyweight circuit movements (burpies, mountain climbers) are counted,
   * not timed/measured/paced — cardio's other 7 types all assume one of
   * those, so 'reps' fills the gap. Shares its string value with
   * mobility's own 'reps' type (same concept, different category) — see
   * migration 0057 for the per-category allow-list that keeps that legal. */
  it("is available for the cardio category, with sets/reps/rest fields", () => {
    const def = getPrescriptionTypeDef("cardio", "reps");
    expect(def).toBeDefined();
    expect(def?.prescriptionFields).toEqual(["sets", "reps", "rest"]);
  });

  it("is not cardio's default type — 'time' still is, for standalone cardio work outside a circuit", () => {
    expect(defaultPrescriptionType("cardio")).toBe("time");
  });

  it("resolves independently from mobility's own 'reps' entry (same value, different category)", () => {
    const cardio = getPrescriptionTypeDef("cardio", "reps");
    const mobility = getPrescriptionTypeDef("mobility", "reps");
    expect(cardio).toBeDefined();
    expect(mobility).toBeDefined();
    expect(PRESCRIPTION_TYPES_BY_CATEGORY.cardio).toContain(cardio);
    expect(PRESCRIPTION_TYPES_BY_CATEGORY.mobility).toContain(mobility);
    expect(PRESCRIPTION_TYPES_BY_CATEGORY.cardio).not.toContain(mobility);
  });
});

describe("defaultCategoryForDiscipline", () => {
  it("maps each discipline onto the right starting exercise category", () => {
    expect(defaultCategoryForDiscipline("resistance")).toBe("strength");
    expect(defaultCategoryForDiscipline("running")).toBe("running");
    expect(defaultCategoryForDiscipline("cardio")).toBe("cardio");
    // Hybrid has no dedicated category of its own — every hybrid starter
    // template is predominantly strength work with cardio mixed in, not
    // the other way around, so it defaults to strength.
    expect(defaultCategoryForDiscipline("hybrid")).toBe("strength");
  });
});

describe("defaultPrescriptionType", () => {
  it("defaults strength to % of 1RM — the prescription that adapts to the athlete's own tested max, not a flat number a coach has to guess", () => {
    expect(defaultPrescriptionType("strength")).toBe("percent_1rm");
  });

  it("still points at each other category's first listed type", () => {
    expect(defaultPrescriptionType("running")).toBe("distance");
    expect(defaultPrescriptionType("cardio")).toBe("time");
  });
});

describe("parseExerciseIdFromRecordType", () => {
  it("recovers the exercise id exerciseMaxRecordType encoded", () => {
    expect(parseExerciseIdFromRecordType(exerciseMaxRecordType("barbell-back-squat"))).toBe("barbell-back-squat");
  });

  it("returns null for personal_records' 4 fixed lift strings and anything else unprefixed", () => {
    expect(parseExerciseIdFromRecordType("squat")).toBeNull();
    expect(parseExerciseIdFromRecordType("bench_press")).toBeNull();
    expect(parseExerciseIdFromRecordType("run_5k")).toBeNull();
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

function makeRecord(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    id: "pr-1",
    user_id: "athlete-1",
    record_type: "squat",
    value_number: 100,
    unit: "kg",
    achieved_on: "2026-01-01",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolvePercent1RMRecord", () => {
  /**
   * Regression coverage: a percent_1rm set built with an old-style
   * pr_record_type ("squat") used to resolve ONLY against personal_records,
   * so a coach who tested that exercise through the newer "Test max
   * before" flow (which writes exclusively to exercise_max_records, never
   * personal_records — see syncTestingWeek/saveMaxTestRecords) would still
   * see a blank suggested weight, since personal_records' "squat" entry
   * never gets written anymore (manual PR entry was removed from
   * /profile). The exercise-scoped record must win whenever it exists.
   */
  it("prefers the exercise-scoped record over pr_record_type when both exist", () => {
    const records = [makeRecord({ record_type: "squat", value_number: 150 }), makeRecord({ record_type: "exercise:barbell-back-squat", value_number: 128 })];

    const pr = resolvePercent1RMRecord(records, { exerciseId: "barbell-back-squat", prRecordType: "squat" });

    expect(pr?.value_number).toBe(128);
  });

  it("falls back to pr_record_type when no exercise-scoped test has been logged yet", () => {
    const records = [makeRecord({ record_type: "squat", value_number: 150 })];

    const pr = resolvePercent1RMRecord(records, { exerciseId: "barbell-back-squat", prRecordType: "squat" });

    expect(pr?.value_number).toBe(150);
  });

  it("uses the exercise-scoped record when pr_record_type is null (the manual builder's own flow)", () => {
    const records = [makeRecord({ record_type: "exercise:barbell-back-squat", value_number: 128 })];

    const pr = resolvePercent1RMRecord(records, { exerciseId: "barbell-back-squat", prRecordType: null });

    expect(pr?.value_number).toBe(128);
  });

  it("returns null when neither a matching exercise record nor pr_record_type record exists", () => {
    const pr = resolvePercent1RMRecord([makeRecord({ record_type: "bench_press" })], { exerciseId: "barbell-back-squat", prRecordType: "squat" });

    expect(pr).toBeNull();
  });

  it("returns null for a null exerciseId with no pr_record_type either", () => {
    const pr = resolvePercent1RMRecord([makeRecord()], { exerciseId: null, prRecordType: null });

    expect(pr).toBeNull();
  });
});
