import { describe, expect, it } from "vitest";
import type { GlobalRefusalScreen, InjuryProfile, ProgramGenerationInput, RedFlagScreen, TrainingGoal } from "@/lib/programs/generate/types";
import { buildPowerAthleticTemplate, isPowerAthleticGoal } from "@/lib/programs/generate/power-athletic-templates";

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
    goal: "power_athletic",
    experienceLevel: "advanced",
    daysPerWeek: 3,
    sessionLengthMinutes: 75,
    equipmentAccess: "full_gym",
    athlete: { age: 24, bodyweightKg: 85, sex: "prefer_not_to_say", recentLayoff: false },
    injuries: clearInjuries(),
    redFlags: clearRedFlags(),
    globalRefusals: clearGlobalRefusals(),
    programLengthWeeks: 10,
    powerlifting: null,
    sport: null,
    hybrid: null,
    running: null,
    bodybuilding: null,
    conditioningModality: "no_preference",
    coachedOnOlympicLifts: false,
    ...overrides,
  };
}

describe("isPowerAthleticGoal", () => {
  it("only accepts power_athletic", () => {
    expect(isPowerAthleticGoal("power_athletic")).toBe(true);
    const others: TrainingGoal[] = ["get_stronger", "powerlifting_peak", "sport_specific"];
    for (const g of others) expect(isPowerAthleticGoal(g)).toBe(false);
  });
});

describe("buildPowerAthleticTemplate — routing", () => {
  it("routes out on a red flag", () => {
    const result = buildPowerAthleticTemplate(baseInput({ redFlags: { ...clearRedFlags(), severeOrWorseningPain: true } }));
    expect(result).toHaveProperty("needsHumanReason");
  });

  it("errors on a non-power_athletic goal", () => {
    const result = buildPowerAthleticTemplate(baseInput({ goal: "get_stronger" as TrainingGoal }));
    expect(result).toHaveProperty("error");
  });
});

describe("buildPowerAthleticTemplate — day structure", () => {
  it("builds 2 days at the low end", () => {
    const result = buildPowerAthleticTemplate(baseInput({ daysPerWeek: 2 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(2);
  });

  it("adds a dedicated strength-base day at 3", () => {
    const result = buildPowerAthleticTemplate(baseInput({ daysPerWeek: 3 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days.map((d) => d.label)).toContain("Strength Base");
  });

  it("clamps below 2 up to 2, with a warning", () => {
    const result = buildPowerAthleticTemplate(baseInput({ daysPerWeek: 1 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes("at least two"))).toBe(true);
  });

  it("clamps above 4 down to 4, with a warning", () => {
    const result = buildPowerAthleticTemplate(baseInput({ daysPerWeek: 6 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(4);
    expect(result.warnings.some((w) => w.includes("caps at 4 days"))).toBe(true);
  });
});

describe("buildPowerAthleticTemplate — the mandatory hamstring-prep sprint gate", () => {
  it("prescribes no sprinting at all during the prep weeks", () => {
    const result = buildPowerAthleticTemplate(baseInput({ experienceLevel: "advanced" }));
    if (!("template" in result)) throw new Error("expected a template");
    const sprintSlot = result.template.weekStructure.days[0]!.slots[0]!;
    const week1 = sprintSlot.prescription.forWeek({ weekIndex: 1, totalWeeks: 10, phase: "standard", deload: null });
    expect(week1.prescriptionType).toBe("coach_notes_only");
    expect(week1.notes).toContain("hamstring");
  });

  it("uses a 3-week prep for advanced and a 4-week prep for beginner/intermediate", () => {
    const advanced = buildPowerAthleticTemplate(baseInput({ experienceLevel: "advanced" }));
    const beginner = buildPowerAthleticTemplate(baseInput({ experienceLevel: "beginner" }));
    if (!("template" in advanced) || !("template" in beginner)) throw new Error("expected templates");

    const advancedSprint = advanced.template.weekStructure.days[0]!.slots[0]!;
    const beginnerSprint = beginner.template.weekStructure.days[0]!.slots[0]!;

    expect(advancedSprint.prescription.forWeek({ weekIndex: 3, totalWeeks: 10, phase: "standard", deload: null }).prescriptionType).toBe("coach_notes_only");
    expect(advancedSprint.prescription.forWeek({ weekIndex: 4, totalWeeks: 10, phase: "standard", deload: null }).prescriptionType).toBe("distance");

    expect(beginnerSprint.prescription.forWeek({ weekIndex: 4, totalWeeks: 10, phase: "standard", deload: null }).prescriptionType).toBe("coach_notes_only");
    expect(beginnerSprint.prescription.forWeek({ weekIndex: 5, totalWeeks: 10, phase: "standard", deload: null }).prescriptionType).toBe("distance");
  });

  it("ramps submaximal effort 70% -> 85% -> 95% over three weeks before full intent", () => {
    const result = buildPowerAthleticTemplate(baseInput({ experienceLevel: "advanced" }));
    if (!("template" in result)) throw new Error("expected a template");
    const sprintSlot = result.template.weekStructure.days[0]!.slots[0]!;
    // advanced prep = 3 weeks, so ramp is weeks 4, 5, 6, full intent from week 7.
    const week4 = sprintSlot.prescription.forWeek({ weekIndex: 4, totalWeeks: 10, phase: "standard", deload: null });
    const week5 = sprintSlot.prescription.forWeek({ weekIndex: 5, totalWeeks: 10, phase: "standard", deload: null });
    const week6 = sprintSlot.prescription.forWeek({ weekIndex: 6, totalWeeks: 10, phase: "standard", deload: null });
    const week7 = sprintSlot.prescription.forWeek({ weekIndex: 7, totalWeeks: 10, phase: "standard", deload: null });
    expect(week4.notes).toContain("70%");
    expect(week5.notes).toContain("85%");
    expect(week6.notes).toContain("95%");
    expect(week7.notes).toContain("Full-effort");
    expect(week7.distanceMeters).toBeGreaterThan(week4.distanceMeters!);
  });

  it("recommends hill sprints by name as the safer default", () => {
    const result = buildPowerAthleticTemplate(baseInput({ experienceLevel: "advanced" }));
    if (!("template" in result)) throw new Error("expected a template");
    const sprintSlot = result.template.weekStructure.days[0]!.slots[0]!;
    const rampWeek = sprintSlot.prescription.forWeek({ weekIndex: 4, totalWeeks: 10, phase: "standard", deload: null });
    expect(rampWeek.notes?.toLowerCase()).toContain("hill sprint");
  });

  it("includes hamstring-prep accessory slots (knee flexion + hip hinge) on every day that has them", () => {
    const result = buildPowerAthleticTemplate(baseInput({ daysPerWeek: 2 }));
    if (!("template" in result)) throw new Error("expected a template");
    const patterns = result.template.weekStructure.days[0]!.slots.map((s) => s.movementPattern);
    expect(patterns).toContain("knee_flexion");
    expect(patterns).toContain("hinge_bilateral");
  });
});

describe("buildPowerAthleticTemplate — output-quality prescriptions", () => {
  it("keeps jump and throw slots to 1-5 reps with long rest, never RIR-based", () => {
    const result = buildPowerAthleticTemplate(baseInput({ daysPerWeek: 2 }));
    if (!("template" in result)) throw new Error("expected a template");
    const jumpSlot = result.template.weekStructure.days[0]!.slots.find((s) => s.movementPattern === "jump" && s.isPrimary)!;
    const plan = jumpSlot.prescription.forWeek({ weekIndex: 1, totalWeeks: 10, phase: "standard", deload: null });
    expect(plan.prescriptionType).toBe("rep_range");
    expect(plan.restSeconds).toBeGreaterThanOrEqual(120);
    expect(jumpSlot.autoregulationEligible).toBe(false);
  });

  it("gives the maximal-strength slots a real RIR-based target, and marks them autoregulation-eligible", () => {
    const result = buildPowerAthleticTemplate(baseInput({ daysPerWeek: 2 }));
    if (!("template" in result)) throw new Error("expected a template");
    const strengthSlot = result.template.weekStructure.days[0]!.slots.find((s) => s.movementPattern === "squat_bilateral")!;
    const plan = strengthSlot.prescription.forWeek({ weekIndex: 1, totalWeeks: 10, phase: "standard", deload: null });
    expect(plan.prescriptionType).toBe("rir");
    expect(strengthSlot.autoregulationEligible).toBe(true);
  });
});

describe("buildPowerAthleticTemplate — warnings and exclusions", () => {
  it("always discloses the experience-level strength/power proxy", () => {
    const result = buildPowerAthleticTemplate(baseInput());
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.toLowerCase().includes("current squat max"))).toBe(true);
  });

  it("always states that the full snatch/clean & jerk, depth jumps, and contrast training are excluded regardless of input", () => {
    const result = buildPowerAthleticTemplate(baseInput({ coachedOnOlympicLifts: true }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.includes("never included here regardless"))).toBe(true);
  });
});
