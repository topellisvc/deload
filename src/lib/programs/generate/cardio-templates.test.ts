import { describe, expect, it } from "vitest";
import type { GlobalRefusalScreen, InjuryProfile, ProgramGenerationInput, RedFlagScreen, TrainingGoal } from "@/lib/programs/generate/types";
import { buildCardioTemplate, isCardioGoal } from "@/lib/programs/generate/cardio-templates";

function clearRedFlags(): RedFlagScreen {
  return {
    radicularOrNumbnessSymptoms: false,
    unexplainedWeakness: false,
    nightPainThatWakesThem: false,
    jointLocksCatchesOrGivesWay: false,
    recentTraumaWithSwellingOrCantBearWeight: false,
    postSurgicalWithinSixMonthsNoClearance: false,
    systemicSymptomsAlongsidePain: false,
    bladderOrBowelChangeWithBackPain: false,
    severeOrWorseningPain: false,
    thumbBasePainAfterFall: false,
    ulnarWristClickingUnderLoad: false,
  };
}

function clearGlobalRefusals(): GlobalRefusalScreen {
  return { pregnantWithPelvicFloorSymptoms: false, persistentWidespreadChronicPain: false, returnToPlayUnder12Months: false, youthPrePuberty: false };
}

function clearInjuries(): InjuryProfile {
  return { shoulder: false, lowerBack: null, knee: null, wrist: false, hip: null, elbow: false };
}

function baseInput(overrides: Partial<ProgramGenerationInput> = {}): ProgramGenerationInput {
  return {
    goal: "improve_conditioning",
    experienceLevel: "beginner",
    daysPerWeek: 3,
    sessionLengthMinutes: 45,
    equipmentAccess: "full_gym",
    athlete: { age: 30, bodyweightKg: 75, sex: "prefer_not_to_say", recentLayoff: false },
    injuries: clearInjuries(),
    redFlags: clearRedFlags(),
    globalRefusals: clearGlobalRefusals(),
    programLengthWeeks: 8,
    powerlifting: null,
    sport: null,
    hybrid: null,
    running: null,
    bodybuilding: null,
    conditioningModality: "cycling",
    coachedOnOlympicLifts: false,
    includeCardio: false,
    ...overrides,
  };
}

describe("isCardioGoal", () => {
  it("only accepts improve_conditioning", () => {
    expect(isCardioGoal("improve_conditioning")).toBe(true);
    const others: TrainingGoal[] = ["run_5k", "get_stronger", "hybrid"];
    for (const g of others) expect(isCardioGoal(g)).toBe(false);
  });
});

describe("buildCardioTemplate — routing", () => {
  it("routes out on a red flag", () => {
    const result = buildCardioTemplate(baseInput({ redFlags: { ...clearRedFlags(), unexplainedWeakness: true } }));
    expect(result).toHaveProperty("needsHumanReason");
  });

  it("errors on a non-cardio goal", () => {
    const result = buildCardioTemplate(baseInput({ goal: "run_5k" as TrainingGoal }));
    expect(result).toHaveProperty("error");
  });
});

describe("buildCardioTemplate — beginner progression (§12)", () => {
  it("builds 2 conditioning days", () => {
    const result = buildCardioTemplate(baseInput({ experienceLevel: "beginner" }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.discipline).toBe("cardio");
    expect(result.template.weekStructure.days).toHaveLength(2);
  });

  it("ramps easy-day duration by 5 minutes a week toward a 40-minute ceiling", () => {
    const result = buildCardioTemplate(baseInput({ experienceLevel: "beginner" }));
    if (!("template" in result)) throw new Error("expected a template");
    const slot = result.template.weekStructure.days[0]!.slots[0]!;
    const week1 = slot.prescription.forWeek({ weekIndex: 1, totalWeeks: 8, phase: "standard", deload: null });
    const week3 = slot.prescription.forWeek({ weekIndex: 3, totalWeeks: 8, phase: "standard", deload: null });
    const week10 = slot.prescription.forWeek({ weekIndex: 10, totalWeeks: 8, phase: "standard", deload: null });
    expect(week1.durationSeconds).toBe(20 * 60);
    expect(week3.durationSeconds).toBe(30 * 60);
    expect(week10.durationSeconds).toBe(40 * 60); // capped, not still climbing
  });

  it("introduces short intervals on the second day starting week 4, not before", () => {
    const result = buildCardioTemplate(baseInput({ experienceLevel: "beginner" }));
    if (!("template" in result)) throw new Error("expected a template");
    const slot = result.template.weekStructure.days[1]!.slots[0]!;
    const week3 = slot.prescription.forWeek({ weekIndex: 3, totalWeeks: 8, phase: "standard", deload: null });
    const week4 = slot.prescription.forWeek({ weekIndex: 4, totalWeeks: 8, phase: "standard", deload: null });
    expect(week3.prescriptionType).toBe("heart_rate_zone");
    expect(week4.prescriptionType).toBe("intervals");
  });
});

describe("buildCardioTemplate — intermediate/advanced structure (§12)", () => {
  it("builds one hard session and the rest easy for a 3-4 day intermediate week", () => {
    const result = buildCardioTemplate(baseInput({ experienceLevel: "intermediate", daysPerWeek: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    const hard = result.template.weekStructure.days.filter((d) => d.label === "Long Intervals");
    const easy = result.template.weekStructure.days.filter((d) => d.label === "Zone 2");
    expect(hard).toHaveLength(1);
    expect(easy).toHaveLength(3);
  });

  it("gives an advanced 5-6 day week two hard sessions, staying polarised toward easy", () => {
    const result = buildCardioTemplate(baseInput({ experienceLevel: "advanced", daysPerWeek: 6 }));
    if (!("template" in result)) throw new Error("expected a template");
    const hard = result.template.weekStructure.days.filter((d) => d.label === "Long Intervals");
    const easy = result.template.weekStructure.days.filter((d) => d.label === "Zone 2");
    expect(hard).toHaveLength(2);
    expect(easy.length).toBeGreaterThan(hard.length);
  });

  it("clamps days per week to sane bounds per level", () => {
    const tooFew = buildCardioTemplate(baseInput({ experienceLevel: "advanced", daysPerWeek: 1 }));
    const tooMany = buildCardioTemplate(baseInput({ experienceLevel: "intermediate", daysPerWeek: 7 }));
    if (!("template" in tooFew) || !("template" in tooMany)) throw new Error("expected templates");
    expect(tooFew.template.weekStructure.days.length).toBeGreaterThanOrEqual(4);
    expect(tooMany.template.weekStructure.days.length).toBeLessThanOrEqual(4);
  });

  it("recommends biasing toward cycling/rowing for intermediate and advanced, to limit interference with lifting", () => {
    const result = buildCardioTemplate(baseInput({ experienceLevel: "intermediate" }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("does not surface the modality warning for a beginner", () => {
    const result = buildCardioTemplate(baseInput({ experienceLevel: "beginner" }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings).toHaveLength(0);
  });
});

describe("buildCardioTemplate — deload cadence", () => {
  it("marks every 4th week as a down_week with a scheduled volume-cut deload", () => {
    const result = buildCardioTemplate(baseInput({ experienceLevel: "intermediate", programLengthWeeks: 12 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect([...result.template.deloadWeeks.keys()]).toEqual([4, 8, 12]);
    expect(result.template.deloadWeeks.get(4)).toBe("volume_cut");
  });
});
