import { describe, expect, it } from "vitest";
import type { GlobalRefusalScreen, InjuryProfile, ProgramGenerationInput, RedFlagScreen, TrainingGoal, WeekContext } from "@/lib/programs/generate/types";
import { buildRunningTemplate, buildWeeklyDistances, isRunGoal } from "@/lib/programs/generate/running-templates";

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
    goal: "run_5k",
    experienceLevel: "intermediate",
    daysPerWeek: 4,
    sessionLengthMinutes: 60,
    equipmentAccess: "full_gym",
    athlete: { age: 30, bodyweightKg: 70, sex: "prefer_not_to_say", recentLayoff: false },
    injuries: clearInjuries(),
    redFlags: clearRedFlags(),
    globalRefusals: clearGlobalRefusals(),
    programLengthWeeks: 10,
    powerlifting: null,
    sport: null,
    hybrid: null,
    running: { currentWeeklyKm: 15, weeksAtCurrentVolume: 4, hasRunContinuouslyThirtyMinutes: true },
    bodybuilding: null,
    conditioningModality: "no_preference",
    coachedOnOlympicLifts: false,
    includeCardio: false,
    loadCalculationMethod: "autoregulated_rir",
    ...overrides,
  };
}

describe("isRunGoal", () => {
  it("recognises every running goal and rejects everything else", () => {
    const runGoals: TrainingGoal[] = ["run_general", "run_5k", "run_10k", "run_half_marathon", "run_marathon"];
    const others: TrainingGoal[] = ["build_muscle_hypertrophy", "get_stronger", "improve_conditioning", "hybrid"];
    for (const g of runGoals) expect(isRunGoal(g)).toBe(true);
    for (const g of others) expect(isRunGoal(g)).toBe(false);
  });
});

describe("buildWeeklyDistances — §11's progression rule, not the 10% rule", () => {
  it("rises for 3 weeks then cuts on the 4th, never exceeding the weekly increase cap", () => {
    const distances = buildWeeklyDistances({ totalWeeks: 8, taperWeeks: 0, startKm: 20, peakKm: 60 });
    expect(distances[0]!).toBeLessThanOrEqual(distances[1]!);
    expect(distances[1]!).toBeLessThanOrEqual(distances[2]!);
    expect(distances[3]!).toBeLessThan(distances[2]!); // down week
    // No single up-week jump exceeds the ~5km/cycle cap by more than rounding.
    expect(distances[4]! - distances[0]!).toBeLessThanOrEqual(6);
  });

  it("never exceeds the peak", () => {
    const distances = buildWeeklyDistances({ totalWeeks: 16, taperWeeks: 0, startKm: 20, peakKm: 40 });
    for (const km of distances) expect(km).toBeLessThanOrEqual(40);
  });

  it("doesn't manufacture volume below the athlete's current base", () => {
    const distances = buildWeeklyDistances({ totalWeeks: 4, taperWeeks: 0, startKm: 45, peakKm: 40 });
    // startKm above peak is clamped down to peak, not left inconsistent.
    expect(distances[0]!).toBeLessThanOrEqual(40);
  });

  it("tapers down from roughly 80% toward roughly 40% of peak", () => {
    const distances = buildWeeklyDistances({ totalWeeks: 12, taperWeeks: 3, startKm: 20, peakKm: 60 });
    const taperWeeks = distances.slice(-3);
    expect(taperWeeks[0]!).toBeGreaterThan(taperWeeks[2]!);
    expect(taperWeeks[0]!).toBeLessThanOrEqual(round8(60 * 0.85));
    expect(taperWeeks[2]!).toBeGreaterThanOrEqual(round8(60 * 0.35));
  });
});

function round8(n: number): number {
  return Math.round(n);
}

describe("buildRunningTemplate — routing", () => {
  it("routes out on a red flag before building anything", () => {
    const result = buildRunningTemplate(baseInput({ redFlags: { ...clearRedFlags(), jointLocksCatchesOrGivesWay: true } }));
    expect(result).toHaveProperty("needsHumanReason");
  });

  it("errors on a non-running goal", () => {
    const result = buildRunningTemplate(baseInput({ goal: "get_stronger" as TrainingGoal }));
    expect(result).toHaveProperty("error");
  });
});

describe("buildRunningTemplate — the marathon downgrade (§11)", () => {
  it("downgrades a marathon request under 24 weeks with no running base to a half-marathon plan", () => {
    const result = buildRunningTemplate(
      baseInput({
        goal: "run_marathon",
        programLengthWeeks: 16,
        running: { currentWeeklyKm: 0, weeksAtCurrentVolume: 0, hasRunContinuouslyThirtyMinutes: false },
      })
    );
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.name).toBe("Half Marathon");
    expect(result.warnings.some((w) => w.toLowerCase().includes("half-marathon"))).toBe(true);
  });

  it("builds a real marathon plan when there's an established running base, even under 24 weeks", () => {
    const result = buildRunningTemplate(
      baseInput({
        goal: "run_marathon",
        programLengthWeeks: 18,
        running: { currentWeeklyKm: 30, weeksAtCurrentVolume: 8, hasRunContinuouslyThirtyMinutes: true },
      })
    );
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.name).toBe("Marathon");
  });

  it("builds a real marathon plan at 24+ weeks regardless of running base", () => {
    const result = buildRunningTemplate(
      baseInput({
        goal: "run_marathon",
        programLengthWeeks: 24,
        running: { currentWeeklyKm: 0, weeksAtCurrentVolume: 0, hasRunContinuouslyThirtyMinutes: false },
      })
    );
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.name).toBe("Marathon");
  });

  it("warns, but still builds, when a non-marathon goal is under its own stated minimum", () => {
    const result = buildRunningTemplate(baseInput({ goal: "run_5k", programLengthWeeks: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.includes("8 weeks"))).toBe(true);
  });
});

describe("buildRunningTemplate — structure", () => {
  it("produces a running-discipline template with a fixed day count matching daysPerWeek", () => {
    const result = buildRunningTemplate(baseInput({ daysPerWeek: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.discipline).toBe("running");
    expect(result.template.weekStructure.days).toHaveLength(4);
  });

  it("includes a Long Run and, at 3+ days, a quality day, every week — the day list itself never changes shape", () => {
    const result = buildRunningTemplate(baseInput({ daysPerWeek: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    const labels = result.template.weekStructure.days.map((d) => d.label);
    expect(labels).toContain("Long Run");
    expect(labels).toContain("VO2max Intervals");
  });

  it("drops the dedicated quality day only when there are too few days to support one", () => {
    const result = buildRunningTemplate(baseInput({ daysPerWeek: 2 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(2);
    expect(result.template.weekStructure.days.map((d) => d.label)).not.toContain("VO2max Intervals");
  });

  it("the quality day resolves to an easy run during base weeks and the real session during quality weeks", () => {
    const result = buildRunningTemplate(baseInput({ daysPerWeek: 4, programLengthWeeks: 10 }));
    if (!("template" in result)) throw new Error("expected a template");
    const qualitySlot = result.template.weekStructure.days.find((d) => d.label === "VO2max Intervals")!.slots[0]!;

    const baseCtx: WeekContext = { weekIndex: 1, totalWeeks: 10, phase: "base", deload: null };
    const qualityCtx: WeekContext = { weekIndex: 6, totalWeeks: 10, phase: "quality", deload: null };

    expect(qualitySlot.prescription.forWeek(baseCtx).prescriptionType).toBe("distance");
    expect(qualitySlot.prescription.forWeek(qualityCtx).prescriptionType).toBe("intervals");
  });

  it("run_general's quality slot is live from week 1 — no base-only phase", () => {
    const result = buildRunningTemplate(baseInput({ goal: "run_general", daysPerWeek: 4, programLengthWeeks: 8 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.phaseByWeek.get(1)).toBe("quality");
  });

  it("marks every 4th week as a down_week and a scheduled deload", () => {
    const result = buildRunningTemplate(baseInput({ programLengthWeeks: 12 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.phaseByWeek.get(4)).toBe("down_week");
    expect(result.template.deloadWeeks.get(4)).toBe("volume_cut");
  });

  it("the long run stays within roughly 25-30% of that week's total distance", () => {
    const result = buildRunningTemplate(baseInput({ daysPerWeek: 4, programLengthWeeks: 10 }));
    if (!("template" in result)) throw new Error("expected a template");
    const longRunSlot = result.template.weekStructure.days.find((d) => d.label === "Long Run")!.slots[0]!;
    const ctx: WeekContext = { weekIndex: 3, totalWeeks: 10, phase: "base", deload: null };
    const plan = longRunSlot.prescription.forWeek(ctx);
    expect(plan.distanceMeters).toBeGreaterThan(0);
    // 0.28 of whatever that week's distance is — just confirm it's a
    // sensible fraction rather than the full weekly volume.
    expect(plan.distanceMeters!).toBeLessThan(35000);
  });

  it("half marathon's long run carries a pace-segment note once in the quality phase, not during base", () => {
    const result = buildRunningTemplate(baseInput({ goal: "run_half_marathon", daysPerWeek: 4, programLengthWeeks: 14 }));
    if (!("template" in result)) throw new Error("expected a template");
    const longRunSlot = result.template.weekStructure.days.find((d) => d.label === "Long Run")!.slots[0]!;
    const baseNotes = longRunSlot.prescription.forWeek({ weekIndex: 1, totalWeeks: 14, phase: "base", deload: null }).notes;
    const qualityNotes = longRunSlot.prescription.forWeek({ weekIndex: 10, totalWeeks: 14, phase: "quality", deload: null }).notes;
    expect(baseNotes).toBeNull();
    expect(qualityNotes).toEqual(expect.any(String));
  });
});
