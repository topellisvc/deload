import { describe, expect, it } from "vitest";
import type { GlobalRefusalScreen, InjuryProfile, ProgramGenerationInput, RedFlagScreen, TrainingGoal, WeekContext } from "@/lib/programs/generate/types";
import { buildResistanceTemplate, isResistanceGoal } from "@/lib/programs/generate/resistance-templates";
import { percentOf1RM } from "@/lib/programs/generate/e1rm";

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
    goal: "build_muscle_hypertrophy",
    experienceLevel: "beginner",
    daysPerWeek: 3,
    sessionLengthMinutes: 60,
    equipmentAccess: "full_gym",
    athlete: { age: 30, bodyweightKg: 80, sex: "prefer_not_to_say", recentLayoff: false },
    injuries: clearInjuries(),
    redFlags: clearRedFlags(),
    globalRefusals: clearGlobalRefusals(),
    programLengthWeeks: 8,
    powerlifting: null,
    sport: null,
    hybrid: null,
    running: null,
    bodybuilding: null,
    conditioningModality: "no_preference",
    coachedOnOlympicLifts: false,
    includeCardio: false,
    loadCalculationMethod: "autoregulated_rir",
    ...overrides,
  };
}

describe("buildResistanceTemplate — routing", () => {
  it("routes out before building anything when a red flag is present", () => {
    const result = buildResistanceTemplate(baseInput({ redFlags: { ...clearRedFlags(), severeOrWorseningPain: true } }));
    expect(result).toHaveProperty("needsHumanReason");
    expect(result).not.toHaveProperty("template");
  });

  it("routes out on a global refusal", () => {
    const result = buildResistanceTemplate(baseInput({ globalRefusals: { ...clearGlobalRefusals(), youthPrePuberty: true } }));
    expect(result).toHaveProperty("needsHumanReason");
  });

  it("errors on a non-resistance goal rather than silently building something wrong", () => {
    const result = buildResistanceTemplate(baseInput({ goal: "run_marathon" as TrainingGoal }));
    expect(result).toHaveProperty("error");
  });

  it("isResistanceGoal agrees with what buildResistanceTemplate actually accepts", () => {
    const resistanceGoals: TrainingGoal[] = ["build_muscle_hypertrophy", "build_muscle_bodybuilding", "get_stronger", "general_fitness", "lose_fat"];
    const nonResistanceGoals: TrainingGoal[] = ["run_marathon", "improve_conditioning", "hybrid", "sport_specific", "powerlifting_peak", "power_athletic"];
    for (const goal of resistanceGoals) expect(isResistanceGoal(goal)).toBe(true);
    for (const goal of nonResistanceGoals) expect(isResistanceGoal(goal)).toBe(false);
  });
});

describe("buildResistanceTemplate — successful generation", () => {
  it("produces a resistance-discipline template with one day per chosen split day", () => {
    const result = buildResistanceTemplate(baseInput({ daysPerWeek: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.discipline).toBe("resistance");
    expect(result.template.weekStructure.days).toHaveLength(4);
  });

  it("names the template after the goal and the chosen split", () => {
    const result = buildResistanceTemplate(baseInput({ goal: "get_stronger", daysPerWeek: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.name).toContain("Strength");
    expect(result.template.name).toContain("Upper/Lower");
  });

  it("marks exactly one primary, autoregulation-eligible slot per day", () => {
    const result = buildResistanceTemplate(baseInput({ daysPerWeek: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    for (const day of result.template.weekStructure.days) {
      const primaries = day.slots.filter((s) => s.isPrimary);
      expect(primaries).toHaveLength(1);
      expect(primaries[0]?.autoregulationEligible).toBe(true);
      expect(day.slots.filter((s) => !s.isPrimary).every((s) => !s.autoregulationEligible)).toBe(true);
    }
  });

  it("surfaces a plateau warning for a fat-loss goal", () => {
    const result = buildResistanceTemplate(baseInput({ goal: "lose_fat" }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.toLowerCase().includes("plateau"))).toBe(true);
  });

  it("does not surface the plateau warning for other goals", () => {
    const result = buildResistanceTemplate(baseInput({ goal: "get_stronger" }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.toLowerCase().includes("plateau"))).toBe(false);
  });

  it("carries the split's own warnings through — a beginner requesting 6 days gets capped with an explanation", () => {
    const result = buildResistanceTemplate(baseInput({ daysPerWeek: 6, experienceLevel: "beginner" }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(4);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("recommends a consultation when shoulder and lower back are both flagged, but still returns a template", () => {
    const result = buildResistanceTemplate(
      baseInput({ injuries: { ...clearInjuries(), shoulder: true, lowerBack: { pattern: "flexion_intolerant" } } })
    );
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.recommendConsultation).not.toBeNull();
  });
});

describe("buildResistanceTemplate — opt-in cardio", () => {
  it("adds no cardio days by default", () => {
    const result = buildResistanceTemplate(baseInput({ goal: "general_fitness", daysPerWeek: 3 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(3);
    expect(result.template.weekStructure.days.some((d) => d.label.startsWith("Cardio"))).toBe(false);
  });

  it("appends 2 cardio days on top of the lifting split for general_fitness when opted in", () => {
    const result = buildResistanceTemplate(baseInput({ goal: "general_fitness", daysPerWeek: 3, includeCardio: true }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(5);
    const cardioDays = result.template.weekStructure.days.filter((d) => d.label.startsWith("Cardio"));
    expect(cardioDays).toHaveLength(2);
    for (const day of cardioDays) {
      expect(day.slots).toHaveLength(1);
      expect(day.slots[0]?.category).toBe("cardio");
      expect(day.slots[0]?.movementPattern).toBeNull();
      const plan = day.slots[0]!.prescription.forWeek({ weekIndex: 1, totalWeeks: 8, phase: "standard", deload: null });
      expect(plan.prescriptionType).toBe("heart_rate_zone");
    }
    expect(result.warnings.some((w) => w.includes("included here, not developed"))).toBe(true);
  });

  it("appends cardio days for lose_fat when opted in", () => {
    const result = buildResistanceTemplate(baseInput({ goal: "lose_fat", daysPerWeek: 3, includeCardio: true }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days.filter((d) => d.label.startsWith("Cardio"))).toHaveLength(2);
  });

  it("ignores includeCardio for goals that stay lifting-only, with an explanatory warning", () => {
    const result = buildResistanceTemplate(baseInput({ goal: "get_stronger", daysPerWeek: 3, includeCardio: true }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(3);
    expect(result.template.weekStructure.days.some((d) => d.label.startsWith("Cardio"))).toBe(false);
    expect(result.warnings.some((w) => w.includes("wasn't added"))).toBe(true);
  });

  it("does not recommend a consultation for a clear injury profile", () => {
    const result = buildResistanceTemplate(baseInput());
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.recommendConsultation).toBeNull();
  });
});

describe("buildResistanceTemplate — deload and calibration cadence (§3, §4)", () => {
  it("schedules no deload weeks for a beginner — reactive resets cover it instead, per §3", () => {
    const result = buildResistanceTemplate(baseInput({ experienceLevel: "beginner", programLengthWeeks: 12 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.deloadWeeks.size).toBe(0);
  });

  it("schedules a deload every 5 weeks for an intermediate", () => {
    const result = buildResistanceTemplate(baseInput({ experienceLevel: "intermediate", programLengthWeeks: 12 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect([...result.template.deloadWeeks.keys()]).toEqual([5, 10]);
    expect(result.template.deloadWeeks.get(5)).toBe("volume_cut");
  });

  it("schedules a deload every 4 weeks for an advanced lifter", () => {
    const result = buildResistanceTemplate(baseInput({ experienceLevel: "advanced", programLengthWeeks: 12 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect([...result.template.deloadWeeks.keys()]).toEqual([4, 8, 12]);
  });

  it("marks week 1 as a calibration week for every level", () => {
    for (const experienceLevel of ["beginner", "intermediate", "advanced"] as const) {
      const result = buildResistanceTemplate(baseInput({ experienceLevel, programLengthWeeks: 8 }));
      if (!("template" in result)) throw new Error("expected a template");
      expect(result.template.phaseByWeek.get(1)).toBe("calibration");
      expect(result.template.phaseByWeek.get(2)).toBe("standard");
    }
  });

  it("extends calibration to a 3-week ramp-in for a returner, and warns about it", () => {
    const result = buildResistanceTemplate(baseInput({ athlete: { age: 30, bodyweightKg: 80, sex: "prefer_not_to_say", recentLayoff: true } }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.phaseByWeek.get(1)).toBe("calibration");
    expect(result.template.phaseByWeek.get(2)).toBe("calibration");
    expect(result.template.phaseByWeek.get(3)).toBe("calibration");
    expect(result.template.phaseByWeek.get(4)).toBe("standard");
    expect(result.warnings.some((w) => w.toLowerCase().includes("ramp-in"))).toBe(true);
  });
});

describe("buildResistanceTemplate — bodybuilding weak-point emphasis (§4)", () => {
  it("adds extra slots for lagging muscle groups, capped at two", () => {
    const withoutLagging = buildResistanceTemplate(baseInput({ goal: "build_muscle_bodybuilding", daysPerWeek: 4 }));
    const withLagging = buildResistanceTemplate(
      baseInput({
        goal: "build_muscle_bodybuilding",
        daysPerWeek: 4,
        bodybuilding: { laggingMuscleGroups: ["calves", "shoulders", "biceps"] },
      })
    );
    if (!("template" in withoutLagging) || !("template" in withLagging)) throw new Error("expected templates");
    const baseCount = withoutLagging.template.weekStructure.days[0]!.slots.length;
    const laggingCount = withLagging.template.weekStructure.days[0]!.slots.length;
    expect(laggingCount).toBe(baseCount + 2); // capped at 2, not 3
    const groups = withLagging.template.weekStructure.days[0]!.slots.map((s) => s.primaryMuscleGroup);
    expect(groups).toEqual(expect.arrayContaining(["calves", "shoulders"]));
  });

  it("adds nothing when the goal isn't bodybuilding, even if a profile is supplied", () => {
    const result = buildResistanceTemplate(
      baseInput({ goal: "build_muscle_hypertrophy", daysPerWeek: 4, bodybuilding: { laggingMuscleGroups: ["calves"] } })
    );
    const plain = buildResistanceTemplate(baseInput({ goal: "build_muscle_hypertrophy", daysPerWeek: 4 }));
    if (!("template" in result) || !("template" in plain)) throw new Error("expected templates");
    expect(result.template.weekStructure.days[0]!.slots.length).toBe(plain.template.weekStructure.days[0]!.slots.length);
  });
});

describe("prescriptions — calibration and deload behave correctly through a real slot", () => {
  function primarySlotPrescription(experienceLevel: ProgramGenerationInput["experienceLevel"]) {
    const result = buildResistanceTemplate(baseInput({ experienceLevel, daysPerWeek: 3 }));
    if (!("template" in result)) throw new Error("expected a template");
    const day = result.template.weekStructure.days[0]!;
    const primary = day.slots.find((s) => s.isPrimary);
    if (!primary) throw new Error("expected a primary slot");
    return primary.prescription;
  }

  it("caps a calibration week at 2 sets and at least 3 RIR, for every level", () => {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      const ctx: WeekContext = { weekIndex: 1, totalWeeks: 8, phase: "calibration", deload: null };
      const plan = primarySlotPrescription(level).forWeek(ctx);
      expect(plan.sets).toBeLessThanOrEqual(2);
      expect(plan.rir).toBeGreaterThanOrEqual(3);
    }
  });

  it("a volume_cut deload reduces sets versus the equivalent standard week", () => {
    const standardCtx: WeekContext = { weekIndex: 3, totalWeeks: 8, phase: "standard", deload: null };
    const deloadCtx: WeekContext = { weekIndex: 3, totalWeeks: 8, phase: "deload", deload: { kind: "volume_cut" } };
    const prescription = primarySlotPrescription("beginner");
    const standard = prescription.forWeek(standardCtx);
    const deload = prescription.forWeek(deloadCtx);
    expect(deload.sets).toBeLessThan(standard.sets);
    expect(deload.rir!).toBeGreaterThan(standard.rir!);
  });

  it("a joint_connective deload cuts sets less than volume_cut but still relaxes effort", () => {
    const prescription = primarySlotPrescription("advanced");
    const volumeCut = prescription.forWeek({ weekIndex: 6, totalWeeks: 12, phase: "deload", deload: { kind: "volume_cut" } });
    const jointConnective = prescription.forWeek({ weekIndex: 6, totalWeeks: 12, phase: "deload", deload: { kind: "joint_connective" } });
    expect(jointConnective.sets).toBeGreaterThanOrEqual(volumeCut.sets);
    expect(jointConnective.rir).toBeGreaterThanOrEqual(3);
  });

  it("an intermediate's wave tightens RIR across weeks 1-3 and eases on week 4", () => {
    const prescription = primarySlotPrescription("intermediate");
    const rirFor = (weekIndex: number): number => prescription.forWeek({ weekIndex, totalWeeks: 12, phase: "standard", deload: null }).rir ?? -1;
    // weekIndex 2,3,4,5 -> weekInWave 2,3,4,1 (since weekInWave = ((weekIndex-1)%4)+1)
    const [week2, week3, week4] = [rirFor(2), rirFor(3), rirFor(4)];
    expect(week2).toBeGreaterThan(week3); // week 2 (rir 2) > week 3 (rir 1)
    expect(week4).toBeGreaterThan(week3); // week 4 (rir 4, the wave's own light week) eases off week 3
  });
});

// At daysPerWeek 3, chooseSplit always returns "full_body" and day 0 is
// full_body_a, whose primary slot is squat_bilateral — a trackable pattern
// (TRACKABLE_PATTERN_LIFT_LABEL) with a "Squat" label. full_body_a's
// secondary slot is horizontal_push, which IS in that same map but isn't
// primary — useful for proving the %1RM methods only ever touch a primary
// slot, not just any trackable pattern.
describe("buildResistanceTemplate — load calculation method", () => {
  const standardCtx: WeekContext = { weekIndex: 3, totalWeeks: 8, phase: "standard", deload: null };

  function daySlots(method: ProgramGenerationInput["loadCalculationMethod"], experienceLevel: ProgramGenerationInput["experienceLevel"] = "intermediate") {
    const result = buildResistanceTemplate(baseInput({ daysPerWeek: 3, experienceLevel, loadCalculationMethod: method }));
    if (!("template" in result)) throw new Error("expected a template");
    return { result, day: result.template.weekStructure.days[0]! };
  }

  it("autoregulated_rir (the default) leaves every slot's prescription exactly as the split built it", () => {
    const { day } = daySlots("autoregulated_rir");
    const primary = day.slots.find((s) => s.isPrimary)!;
    expect(primary.prescription.forWeek(standardCtx).prescriptionType).toBe("rir");
  });

  it("percent_1rm converts only the primary slot on a trackable pattern, using e1rm's own percentOf1RM table", () => {
    const { day: rirDay } = daySlots("autoregulated_rir");
    const { day: percentDay } = daySlots("percent_1rm");

    const rirPrimary = rirDay.slots.find((s) => s.isPrimary)!;
    const percentPrimary = percentDay.slots.find((s) => s.isPrimary)!;
    expect(rirPrimary.movementPattern).toBe("squat_bilateral");

    const rirPlan = rirPrimary.prescription.forWeek(standardCtx);
    const percentPlan = percentPrimary.prescription.forWeek(standardCtx);

    const expectedPercent = percentOf1RM(rirPlan.minReps ?? Number(rirPlan.reps), rirPlan.rir!);
    expect(percentPlan.prescriptionType).toBe("percent_1rm");
    expect(percentPlan.percent1RM).toBe(expectedPercent);
    expect(percentPlan.rir).toBeUndefined();
    // Carries the record type for display resolution (exercise-screen.tsx),
    // but this is never itself a max test — logging it shouldn't overwrite
    // a real tested max with a percentage-derived guess.
    expect(percentPlan.prRecordType).toBe("squat");
    expect(percentPlan.isMaxTest).toBeFalsy();
  });

  it("percent_1rm leaves a secondary slot alone even though its pattern (horizontal_push) is itself trackable — only a primary slot converts", () => {
    const { day: rirDay } = daySlots("autoregulated_rir");
    const { day: percentDay } = daySlots("percent_1rm");
    const rirSecondary = rirDay.slots.find((s) => !s.isPrimary && s.movementPattern === "horizontal_push")!;
    const percentSecondary = percentDay.slots.find((s) => !s.isPrimary && s.movementPattern === "horizontal_push")!;
    expect(percentSecondary.prescription.forWeek(standardCtx).prescriptionType).toBe(rirSecondary.prescription.forWeek(standardCtx).prescriptionType);
    expect(percentSecondary.prescription.forWeek(standardCtx).prescriptionType).not.toBe("percent_1rm");
  });

  it("coach_entered turns every slot in the day — primary and accessory alike — into a blank fixed_weight row with reps carried over", () => {
    const { day } = daySlots("coach_entered");
    for (const slot of day.slots) {
      const plan = slot.prescription.forWeek(standardCtx);
      expect(plan.prescriptionType).toBe("fixed_weight");
      expect(plan.rir).toBeUndefined();
      expect(plan.percent1RM).toBeUndefined();
      expect(plan.reps).toEqual(expect.anything());
    }
  });

  it("athlete_choice turns every slot into athlete_chooses_weight with reps but no effort target", () => {
    const { day } = daySlots("athlete_choice");
    for (const slot of day.slots) {
      const plan = slot.prescription.forWeek(standardCtx);
      expect(plan.prescriptionType).toBe("athlete_chooses_weight");
      expect(plan.rir).toBeUndefined();
      expect(plan.reps).toEqual(expect.anything());
    }
  });

  it("test_then_percent_1rm inserts a testing week at position 1, shifting every existing week (including scheduled deloads) up by one", () => {
    const { result } = daySlots("test_then_percent_1rm", "intermediate");
    // Unmodified, an intermediate 8-week program calibrates week 1 and
    // deloads at 5 — shifted, that's calibration at 2 and deload at 6, with
    // a brand-new testing week at 1 and the program now 9 weeks long.
    expect(result.template.phaseByWeek.get(1)).toBe("testing");
    expect(result.template.phaseByWeek.get(2)).toBe("calibration");
    expect(result.template.phaseByWeek.get(3)).toBe("standard");
    expect(result.template.deloadWeeks.get(6)).toBe("volume_cut");
    expect(result.template.phaseByWeek.size).toBe(9);
  });

  it("the testing week's own prescription is a single graded set naming the trackable lift, not a normal RIR wave", () => {
    const { day } = daySlots("test_then_percent_1rm", "intermediate");
    const primary = day.slots.find((s) => s.isPrimary)!;
    const testingCtx: WeekContext = { weekIndex: 1, totalWeeks: 9, phase: "testing", deload: null };
    const plan = primary.prescription.forWeek(testingCtx);
    expect(plan.prescriptionType).toBe("rir");
    expect(plan.sets).toBe(1);
    expect(plan.rir).toBe(1);
    expect(plan.notes).toContain("Testing week");
    expect(plan.notes).toContain("Squat");
    // No more "go save it on your profile" instruction — logging this set
    // is what triggers the automatic save (training/mutations.ts).
    expect(plan.notes).not.toContain("profile");
    expect(plan.isMaxTest).toBe(true);
    expect(plan.prRecordType).toBe("squat");
  });

  it("after the testing week, later weeks resolve to a normal percent_1rm conversion", () => {
    const { day: rirDay } = daySlots("autoregulated_rir");
    const { day: testDay } = daySlots("test_then_percent_1rm", "intermediate");
    const rirPrimary = rirDay.slots.find((s) => s.isPrimary)!;
    const testPrimary = testDay.slots.find((s) => s.isPrimary)!;
    // The wave/calibration math runs on the raw (already-shifted) weekIndex,
    // so comparing against the un-shifted build means using the *same*
    // weekIndex on both sides here, not the "equivalent pre-shift" week.
    const laterCtx: WeekContext = { weekIndex: 4, totalWeeks: 9, phase: "standard", deload: null };
    const rirPlan = rirPrimary.prescription.forWeek(laterCtx);
    const testPlan = testPrimary.prescription.forWeek(laterCtx);
    expect(testPlan.prescriptionType).toBe("percent_1rm");
    expect(testPlan.percent1RM).toBe(percentOf1RM(rirPlan.minReps ?? Number(rirPlan.reps), rirPlan.rir!));
  });

  it("downgrades test_then_percent_1rm to autoregulated_rir for a beginner, with an explanatory warning, and doesn't insert a testing week", () => {
    const { result, day } = daySlots("test_then_percent_1rm", "beginner");
    expect(result.template.phaseByWeek.get(1)).toBe("calibration");
    expect(result.template.phaseByWeek.size).toBe(8);
    expect(result.warnings.some((w) => w.toLowerCase().includes("isn't something this generator does for beginners"))).toBe(true);
    const primary = day.slots.find((s) => s.isPrimary)!;
    expect(primary.prescription.forWeek({ weekIndex: 3, totalWeeks: 8, phase: "standard", deload: null }).prescriptionType).toBe("rir");
  });

  it("warns that a percentage needs a saved max, for percent_1rm and test_then_percent_1rm but not the other methods", () => {
    const methods: ProgramGenerationInput["loadCalculationMethod"][] = ["autoregulated_rir", "percent_1rm", "coach_entered", "athlete_choice", "test_then_percent_1rm"];
    const expectFires: Record<string, boolean> = {
      autoregulated_rir: false,
      percent_1rm: true,
      coach_entered: false,
      athlete_choice: false,
      test_then_percent_1rm: true,
    };
    for (const method of methods) {
      const { result } = daySlots(method, "intermediate");
      const fires = result.warnings.some((w) => w.includes("Weights shown as a percentage need a saved max"));
      expect(fires).toBe(expectFires[method]);
    }
  });
});
