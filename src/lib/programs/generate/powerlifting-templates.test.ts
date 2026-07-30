import { describe, expect, it } from "vitest";
import type { GlobalRefusalScreen, InjuryProfile, ProgramGenerationInput, RedFlagScreen, TrainingGoal } from "@/lib/programs/generate/types";
import { buildPowerliftingTemplate, isPowerliftingGoal } from "@/lib/programs/generate/powerlifting-templates";

const NOW = new Date("2026-01-01T00:00:00Z");

function isoWeeksFromNow(weeks: number): string {
  const d = new Date(NOW.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

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
    goal: "powerlifting_peak",
    experienceLevel: "advanced",
    daysPerWeek: 4,
    sessionLengthMinutes: 90,
    equipmentAccess: "full_gym",
    athlete: { age: 28, bodyweightKg: 90, sex: "prefer_not_to_say", recentLayoff: false },
    injuries: clearInjuries(),
    redFlags: clearRedFlags(),
    globalRefusals: clearGlobalRefusals(),
    programLengthWeeks: 8, // deliberately ignored by this template — see test below
    powerlifting: { meetDateISO: isoWeeksFromNow(16), isFirstMeet: false },
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

describe("isPowerliftingGoal", () => {
  it("only accepts powerlifting_peak", () => {
    expect(isPowerliftingGoal("powerlifting_peak")).toBe(true);
    const others: TrainingGoal[] = ["get_stronger", "power_athletic", "hybrid"];
    for (const g of others) expect(isPowerliftingGoal(g)).toBe(false);
  });
});

describe("buildPowerliftingTemplate — routing", () => {
  it("routes out on a red flag before touching meet details", () => {
    const result = buildPowerliftingTemplate(baseInput({ redFlags: { ...clearRedFlags(), severeOrWorseningPain: true } }), NOW);
    expect(result).toHaveProperty("needsHumanReason");
  });

  it("errors on a non-powerlifting goal", () => {
    const result = buildPowerliftingTemplate(baseInput({ goal: "get_stronger" as TrainingGoal }), NOW);
    expect(result).toHaveProperty("error");
  });

  it("errors when no PowerliftingMeetDetails is supplied", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: null }), NOW);
    expect(result).toHaveProperty("error");
  });

  it("errors when the meet date has already passed", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(-1), isFirstMeet: false } }), NOW);
    expect(result).toHaveProperty("error");
  });
});

describe("buildPowerliftingTemplate — phase allocation regimes", () => {
  it("uses the full 16-week structure at 16 weeks out, ending on meet_week", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(16), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    const phases = [...result.template.phaseByWeek.entries()].sort((a, b) => a[0] - b[0]);
    expect(phases).toHaveLength(16);
    expect(phases[0]![1]).toBe("gpp");
    expect(phases.at(-1)![1]).toBe("meet_week");
    expect(phases.at(-2)![1]).toBe("taper");
  });

  it("drops gpp to zero at exactly 12 weeks out, starting on strength", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(12), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.phaseByWeek.size).toBe(12);
    expect(result.template.phaseByWeek.get(1)).toBe("strength");
  });

  it("compresses to a 4-phase structure with no gpp under 8 weeks out", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(7), isFirstMeet: true } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    const phases = new Set(result.template.phaseByWeek.values());
    expect(phases.has("gpp")).toBe(false);
    expect(result.template.phaseByWeek.size).toBe(7);
    expect(result.warnings.some((w) => w.includes("under 8 weeks"))).toBe(true);
  });

  it("still compresses (without gpp) at exactly 8-11 weeks out, with a softer warning than the under-8 case", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(8), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    const phases = new Set(result.template.phaseByWeek.values());
    expect(phases.has("gpp")).toBe(false);
    expect(result.template.phaseByWeek.size).toBe(8);
    expect(result.warnings.some((w) => w.includes("under 8 weeks"))).toBe(false);
    expect(result.warnings.some((w) => w.toLowerCase().includes("compressed to fit"))).toBe(true);
  });

  it("still ends on meet_week and taper even at the very short end of the compressed range", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(4), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.phaseByWeek.size).toBe(4);
    expect(result.template.phaseByWeek.get(4)).toBe("meet_week");
    expect(result.template.phaseByWeek.get(3)).toBe("taper");
  });

  it("goes taper-only under 4 weeks out and says so", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(3), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect([...result.template.phaseByWeek.values()].every((p) => p === "taper" || p === "meet_week")).toBe(true);
    expect(result.warnings.some((w) => w.toLowerCase().includes("no time") || w.toLowerCase().includes("arrive fresh"))).toBe(true);
  });

  it("a 1-week-out request is meet_week only", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(1), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.phaseByWeek.size).toBe(1);
    expect(result.template.phaseByWeek.get(1)).toBe("meet_week");
  });

  it("caps at 16 weeks and warns when the meet is further out than that", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(24), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.phaseByWeek.size).toBe(16);
    expect(result.warnings.some((w) => w.includes("only the final 16-week"))).toBe(true);
  });

  it("ignores programLengthWeeks entirely — the meet date drives length, not the questionnaire field", () => {
    const result = buildPowerliftingTemplate(baseInput({ programLengthWeeks: 2, powerlifting: { meetDateISO: isoWeeksFromNow(16), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.phaseByWeek.size).toBe(16);
  });
});

describe("buildPowerliftingTemplate — attempt-selection framing", () => {
  it("warns about conservative attempt selection for a first meet", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(16), isFirstMeet: true } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.includes("9 for 9"))).toBe(true);
  });

  it("frames the third attempt as a calculated risk for an experienced lifter", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(16), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.includes("calculated risk"))).toBe(true);
  });

  it("always refuses weight-cut guidance and always flags the bar-speed-coaching value", () => {
    const result = buildPowerliftingTemplate(baseInput(), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.toLowerCase().includes("weight-cut"))).toBe(true);
    expect(result.warnings.some((w) => w.toLowerCase().includes("bar speed"))).toBe(true);
  });
});

describe("buildPowerliftingTemplate — day structure", () => {
  it("builds Squat/Bench/Deadlift/Bench-volume at 4 days", () => {
    const result = buildPowerliftingTemplate(baseInput({ daysPerWeek: 4 }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    const labels = result.template.weekStructure.days.map((d) => d.label);
    expect(labels).toEqual(["Squat", "Bench", "Deadlift", "Bench — Volume"]);
  });

  it("builds Squat/Bench/Deadlift at 3 days", () => {
    const result = buildPowerliftingTemplate(baseInput({ daysPerWeek: 3 }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days.map((d) => d.label)).toEqual(["Squat", "Bench", "Deadlift"]);
  });

  it("clamps below 3 days up to 3, with a warning", () => {
    const result = buildPowerliftingTemplate(baseInput({ daysPerWeek: 2 }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(3);
    expect(result.warnings.some((w) => w.includes("3 days a week"))).toBe(true);
  });

  it("clamps above 4 days down to 4, with a warning", () => {
    const result = buildPowerliftingTemplate(baseInput({ daysPerWeek: 6 }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(4);
    expect(result.warnings.some((w) => w.includes("caps at 4 days"))).toBe(true);
  });
});

describe("buildPowerliftingTemplate — main lift prescription by phase", () => {
  it("falls in reps and rises in effort from gpp through peaking, then eases for the taper and meet week", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(16), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    const squatSlot = result.template.weekStructure.days[0]!.slots[0]!;

    const plan = (weekIndex: number) => squatSlot.prescription.forWeek({ weekIndex, totalWeeks: 16, phase: result.template.phaseByWeek.get(weekIndex)!, deload: null });

    // gpp weeks 1-4, strength 5-8, intensification 9-12, peaking 13-14, taper 15, meet_week 16.
    const gppWeek = plan(1);
    const peakingWeek = plan(13);
    const taperWeek = plan(15);
    const meetWeek = plan(16);

    expect(gppWeek.maxReps).toBeGreaterThan(peakingWeek.maxReps!);
    expect(gppWeek.rir).toBeGreaterThan(peakingWeek.rir!);
    expect(taperWeek.sets).toBe(1);
    expect(meetWeek.notes).toContain("3 days");
  });

  it("reduces accessory work to notes-only during taper and meet week", () => {
    const result = buildPowerliftingTemplate(baseInput({ powerlifting: { meetDateISO: isoWeeksFromNow(16), isFirstMeet: false } }), NOW);
    if (!("template" in result)) throw new Error("expected a template");
    const accessorySlot = result.template.weekStructure.days[0]!.slots[1]!;
    const taperPlan = accessorySlot.prescription.forWeek({ weekIndex: 15, totalWeeks: 16, phase: "taper", deload: null });
    const gppPlan = accessorySlot.prescription.forWeek({ weekIndex: 1, totalWeeks: 16, phase: "gpp", deload: null });
    expect(taperPlan.prescriptionType).toBe("coach_notes_only");
    expect(gppPlan.prescriptionType).toBe("rir");
  });
});
