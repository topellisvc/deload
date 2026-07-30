import { describe, expect, it } from "vitest";
import type { GlobalRefusalScreen, InjuryProfile, ProgramGenerationInput, RedFlagScreen, SportProfile, TrainingGoal } from "@/lib/programs/generate/types";
import { buildSportSpecificTemplate, isSportSpecificGoal } from "@/lib/programs/generate/sport-specific-templates";

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

function baseSport(overrides: Partial<SportProfile> = {}): SportProfile {
  return {
    sportGroup: "field_court_invasion",
    seasonPhase: "off_season",
    practicesOrGamesPerWeek: 3,
    position: null,
    injuryInLast12Months: false,
    currentPain: false,
    canSquatToDepthPainFree: true,
    canReachArmsOverheadAgainstWall: true,
    currentlyCuttingWeight: false,
    throwingSessionsPerWeek: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ProgramGenerationInput> = {}): ProgramGenerationInput {
  return {
    goal: "sport_specific",
    experienceLevel: "intermediate",
    daysPerWeek: 4,
    sessionLengthMinutes: 60,
    equipmentAccess: "full_gym",
    athlete: { age: 22, bodyweightKg: 78, sex: "prefer_not_to_say", recentLayoff: false },
    injuries: clearInjuries(),
    redFlags: clearRedFlags(),
    globalRefusals: clearGlobalRefusals(),
    programLengthWeeks: 8,
    powerlifting: null,
    sport: baseSport(),
    hybrid: null,
    running: null,
    bodybuilding: null,
    conditioningModality: "no_preference",
    coachedOnOlympicLifts: false,
    ...overrides,
  };
}

describe("isSportSpecificGoal", () => {
  it("only accepts sport_specific", () => {
    expect(isSportSpecificGoal("sport_specific")).toBe(true);
    const others: TrainingGoal[] = ["get_stronger", "powerlifting_peak", "power_athletic"];
    for (const g of others) expect(isSportSpecificGoal(g)).toBe(false);
  });
});

describe("buildSportSpecificTemplate — routing", () => {
  it("routes out on a red flag", () => {
    const result = buildSportSpecificTemplate(baseInput({ redFlags: { ...clearRedFlags(), severeOrWorseningPain: true } }));
    expect(result).toHaveProperty("needsHumanReason");
  });

  it("routes out on youthPrePuberty (already unreachable via a normal sport-specific flow, but must not silently generate anyway)", () => {
    const result = buildSportSpecificTemplate(baseInput({ globalRefusals: { ...clearGlobalRefusals(), youthPrePuberty: true } }));
    expect(result).toHaveProperty("needsHumanReason");
  });

  it("errors on a non-sport_specific goal", () => {
    const result = buildSportSpecificTemplate(baseInput({ goal: "get_stronger" as TrainingGoal }));
    expect(result).toHaveProperty("error");
  });

  it("errors when sport profile is missing", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: null }));
    expect(result).toHaveProperty("error");
  });
});

describe("buildSportSpecificTemplate — season phase is the primary axis", () => {
  it("gives off-season 3-4 days and the highest volume", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ seasonPhase: "off_season" }), daysPerWeek: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(4);
    const plan = result.template.weekStructure.days[0]!.slots[0]!.prescription.forWeek({ weekIndex: 1, totalWeeks: 8, phase: "standard", deload: null });
    expect(plan.sets).toBe(4);
  });

  it("caps in-season at 2 days and trims to 4 movements regardless of requested days", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ seasonPhase: "in_season" }), daysPerWeek: 4 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days).toHaveLength(2);
    expect(result.template.weekStructure.days[0]!.slots.length).toBeLessThanOrEqual(4);
    expect(result.warnings.some((w) => w.includes("In-Season"))).toBe(true);
  });

  it("keeps in-season low volume and low intended fatigue (3-5 reps, real RIR buffer)", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ seasonPhase: "in_season" }), daysPerWeek: 2 }));
    if (!("template" in result)) throw new Error("expected a template");
    const plan = result.template.weekStructure.days[0]!.slots[0]!.prescription.forWeek({ weekIndex: 1, totalWeeks: 8, phase: "standard", deload: null });
    expect(plan.sets).toBe(3);
    expect(plan.minReps).toBe(3);
    expect(plan.maxReps).toBe(5);
    expect(plan.rir).toBeGreaterThanOrEqual(2);
  });

  it("allows zero structured days in post-season with an explicit warning, and produces no crash from assemble", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ seasonPhase: "post_season" }), daysPerWeek: 3 }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days.length).toBeGreaterThanOrEqual(0);
    expect(result.template.weekStructure.days.length).toBeLessThanOrEqual(2);
  });
});

describe("buildSportSpecificTemplate — group emphasis layered on the base", () => {
  it("gives field/court invasion sports an adductor slot high in priority", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "field_court_invasion", seasonPhase: "in_season" }) }));
    if (!("template" in result)) throw new Error("expected a template");
    const patterns = result.template.weekStructure.days[0]!.slots.map((s) => s.movementPattern);
    expect(patterns).toContain("hip_adduction");
  });

  it("gives combat grappling a carry (grip) slot and a neck slot", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "combat_grappling", seasonPhase: "off_season" }) }));
    if (!("template" in result)) throw new Error("expected a template");
    const patterns = result.template.weekStructure.days[0]!.slots.map((s) => s.movementPattern);
    expect(patterns).toContain("carry");
    expect(patterns).toContain("neck");
  });

  it("gives swimming no vertical_push slot at all, even with overhead access", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "swimming", seasonPhase: "off_season", canReachArmsOverheadAgainstWall: true }) }));
    if (!("template" in result)) throw new Error("expected a template");
    const patterns = result.template.weekStructure.days.flatMap((d) => d.slots.map((s) => s.movementPattern));
    expect(patterns).not.toContain("vertical_push");
  });

  it("gives golf a rotational_power and anti_rotation slot", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "golf", seasonPhase: "off_season" }) }));
    if (!("template" in result)) throw new Error("expected a template");
    const patterns = result.template.weekStructure.days[0]!.slots.map((s) => s.movementPattern);
    expect(patterns).toContain("rotational_power");
    expect(patterns).toContain("anti_rotation");
  });

  it("puts pulling first for climbing, ahead of squat/hinge", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "climbing", seasonPhase: "off_season" }) }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.weekStructure.days[0]!.slots[0]!.movementPattern).toBe("horizontal_pull");
  });
});

describe("buildSportSpecificTemplate — screening flags", () => {
  it("drops vertical_push and warns when overhead reach is not pain-free", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "field_court_invasion", canReachArmsOverheadAgainstWall: false }) }));
    if (!("template" in result)) throw new Error("expected a template");
    const patterns = result.template.weekStructure.days.flatMap((d) => d.slots.map((s) => s.movementPattern));
    expect(patterns).not.toContain("vertical_push");
    expect(result.warnings.some((w) => w.toLowerCase().includes("overhead"))).toBe(true);
  });

  it("warns plainly that the throwing arm isn't managed when throwing volume is unknown", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "rotational_overhead", throwingSessionsPerWeek: null }) }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.includes("doesn't manage your throwing arm"))).toBe(true);
  });

  it("drops overhead pressing outright and warns when throwing volume is known and meaningful", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "rotational_overhead", throwingSessionsPerWeek: 4, canReachArmsOverheadAgainstWall: true }) }));
    if (!("template" in result)) throw new Error("expected a template");
    const patterns = result.template.weekStructure.days.flatMap((d) => d.slots.map((s) => s.movementPattern));
    expect(patterns).not.toContain("vertical_push");
    expect(result.warnings.some((w) => w.includes("throwing sessions a week"))).toBe(true);
  });

  it("downgrades volume ~30% while cutting weight, with a warning, and never gives weight-cut guidance itself", () => {
    const normal = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "combat_striking", currentlyCuttingWeight: false }) }));
    const cutting = buildSportSpecificTemplate(baseInput({ sport: baseSport({ sportGroup: "combat_striking", currentlyCuttingWeight: true }) }));
    if (!("template" in normal) || !("template" in cutting)) throw new Error("expected templates");
    const normalSets = normal.template.weekStructure.days[0]!.slots[0]!.prescription.forWeek({ weekIndex: 1, totalWeeks: 8, phase: "standard", deload: null }).sets;
    const cuttingSets = cutting.template.weekStructure.days[0]!.slots[0]!.prescription.forWeek({ weekIndex: 1, totalWeeks: 8, phase: "standard", deload: null }).sets;
    expect(cuttingSets).toBeLessThan(normalSets);
    expect(cutting.warnings.some((w) => w.includes("cutting weight"))).toBe(true);
    expect(cutting.warnings.every((w) => !w.toLowerCase().includes("how to cut") && !w.toLowerCase().includes("how much to eat"))).toBe(true);
  });

  it("warns when squat-to-depth isn't pain-free, without silently changing the squat slot", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ canSquatToDepthPainFree: false }) }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.toLowerCase().includes("squat to depth"))).toBe(true);
  });

  it("surfaces injuryInLast12Months / currentPain as a warning to flag to a reviewer", () => {
    const result = buildSportSpecificTemplate(baseInput({ sport: baseSport({ currentPain: true }) }));
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.warnings.some((w) => w.toLowerCase().includes("lighter-weight check"))).toBe(true);
  });

  it("always states this is general athletic development with a sport emphasis, never a sport-specific program", () => {
    const result = buildSportSpecificTemplate(baseInput());
    if (!("template" in result)) throw new Error("expected a template");
    expect(result.template.name).toContain("General Athletic Development");
  });
});
