import { describe, expect, it } from "vitest";
import { METADATA_KEYS } from "@/lib/programs/generate/patterns";
import type { GlobalRefusalScreen, InjuryProfile, RedFlagScreen } from "@/lib/programs/generate/types";
import {
  ALL_INJURY_TAGS,
  activeTags,
  globalRefusalReason,
  isSafeForInjuries,
  jointRouteOutReason,
  needsHumanReason,
  recommendConsultationReason,
  redFlagReason,
} from "@/lib/programs/generate/injuries";

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
  return {
    pregnantWithPelvicFloorSymptoms: false,
    persistentWidespreadChronicPain: false,
    returnToPlayUnder12Months: false,
    youthPrePuberty: false,
  };
}

function clearInjuries(): InjuryProfile {
  return { shoulder: false, lowerBack: null, knee: null, wrist: false, hip: null, elbow: false };
}

describe("redFlagReason", () => {
  it("returns null when nothing is flagged", () => {
    expect(redFlagReason(clearRedFlags())).toBeNull();
  });

  for (const field of Object.keys(clearRedFlags()) as (keyof RedFlagScreen)[]) {
    it(`routes out when ${field} is true`, () => {
      const screen = { ...clearRedFlags(), [field]: true };
      expect(redFlagReason(screen)).toEqual(expect.any(String));
    });
  }
});

describe("globalRefusalReason", () => {
  it("returns null when nothing is flagged", () => {
    expect(globalRefusalReason(clearGlobalRefusals())).toBeNull();
  });

  for (const field of Object.keys(clearGlobalRefusals()) as (keyof GlobalRefusalScreen)[]) {
    it(`routes out when ${field} is true`, () => {
      const screen = { ...clearGlobalRefusals(), [field]: true };
      expect(globalRefusalReason(screen)).toEqual(expect.any(String));
    });
  }
});

describe("jointRouteOutReason", () => {
  it("routes out a post-surgical/ACL knee, independent of any time window", () => {
    const injuries = { ...clearInjuries(), knee: { presentation: "post_surgical_or_acl" as const } };
    expect(jointRouteOutReason(injuries)).toEqual(expect.any(String));
  });

  it("does not route out other knee presentations", () => {
    const injuries = { ...clearInjuries(), knee: { presentation: "anterior_patellar" as const } };
    expect(jointRouteOutReason(injuries)).toBeNull();
  });

  it("does not route out a clear profile", () => {
    expect(jointRouteOutReason(clearInjuries())).toBeNull();
  });
});

describe("needsHumanReason", () => {
  it("is null when every screen is clear", () => {
    expect(needsHumanReason({ redFlags: clearRedFlags(), globalRefusals: clearGlobalRefusals(), injuries: clearInjuries() })).toBeNull();
  });

  it("checks red flags before global refusals before the joint route-out", () => {
    // All three would fire; red flag must win, since it's step 1 in the
    // coach's own ordering and the most acute of the three.
    const result = needsHumanReason({
      redFlags: { ...clearRedFlags(), severeOrWorseningPain: true },
      globalRefusals: { ...clearGlobalRefusals(), youthPrePuberty: true },
      injuries: { ...clearInjuries(), knee: { presentation: "post_surgical_or_acl" } },
    });
    expect(result).toBe(redFlagReason({ ...clearRedFlags(), severeOrWorseningPain: true }));
  });
});

describe("activeTags", () => {
  it("is empty for a clear profile", () => {
    expect(activeTags(clearInjuries())).toEqual([]);
  });

  it("tags shoulder, wrist, and elbow directly — no presentation needed", () => {
    expect(activeTags({ ...clearInjuries(), shoulder: true })).toEqual(["shoulder"]);
    expect(activeTags({ ...clearInjuries(), wrist: true })).toEqual(["wrist"]);
    expect(activeTags({ ...clearInjuries(), elbow: true })).toEqual(["elbow"]);
  });

  it("maps each lower back presentation to its own tag", () => {
    expect(activeTags({ ...clearInjuries(), lowerBack: { pattern: "flexion_intolerant" } })).toEqual(["lower_back_flexion_intolerant"]);
    expect(activeTags({ ...clearInjuries(), lowerBack: { pattern: "extension_intolerant" } })).toEqual(["lower_back_extension_intolerant"]);
  });

  it("an unsure lower back applies both tags — the conservative default", () => {
    expect(activeTags({ ...clearInjuries(), lowerBack: { pattern: "unsure" } })).toEqual([
      "lower_back_flexion_intolerant",
      "lower_back_extension_intolerant",
    ]);
  });

  it("maps knee presentations, and produces no tag for post_surgical_or_acl", () => {
    expect(activeTags({ ...clearInjuries(), knee: { presentation: "anterior_patellar" } })).toEqual(["knee_anterior_patellar"]);
    expect(activeTags({ ...clearInjuries(), knee: { presentation: "meniscal_joint_line" } })).toEqual(["knee_meniscal_joint_line"]);
    expect(activeTags({ ...clearInjuries(), knee: { presentation: "post_surgical_or_acl" } })).toEqual([]);
  });

  it("an unsure knee applies both non-route-out tags", () => {
    expect(activeTags({ ...clearInjuries(), knee: { presentation: "unsure" } })).toEqual(["knee_anterior_patellar", "knee_meniscal_joint_line"]);
  });

  it("maps each hip presentation to its own tag", () => {
    expect(activeTags({ ...clearInjuries(), hip: { presentation: "anterior_groin" } })).toEqual(["hip_anterior_groin"]);
    expect(activeTags({ ...clearInjuries(), hip: { presentation: "lateral_glute" } })).toEqual(["hip_lateral_glute"]);
    expect(activeTags({ ...clearInjuries(), hip: { presentation: "posterior_hamstring" } })).toEqual(["hip_posterior_hamstring"]);
  });

  it("an unsure hip applies all three tags", () => {
    expect(activeTags({ ...clearInjuries(), hip: { presentation: "unsure" } })).toEqual([
      "hip_anterior_groin",
      "hip_lateral_glute",
      "hip_posterior_hamstring",
    ]);
  });

  it("combines tags across independently flagged joints", () => {
    const injuries: InjuryProfile = {
      shoulder: true,
      lowerBack: { pattern: "flexion_intolerant" },
      knee: null,
      wrist: false,
      hip: { presentation: "posterior_hamstring" },
      elbow: false,
    };
    expect(activeTags(injuries)).toEqual(["shoulder", "lower_back_flexion_intolerant", "hip_posterior_hamstring"]);
  });
});

describe("isSafeForInjuries", () => {
  it("is safe when the athlete has no active tags, regardless of the exercise", () => {
    const exercise = { metadata: { [METADATA_KEYS.contraindications]: ["shoulder"] } };
    expect(isSafeForInjuries(exercise, [])).toBe(true);
  });

  it("is safe when the exercise carries no contraindications", () => {
    const exercise = { metadata: {} };
    expect(isSafeForInjuries(exercise, ["shoulder"])).toBe(true);
  });

  it("is unsafe when an exercise's contraindication matches an active tag", () => {
    const exercise = { metadata: { [METADATA_KEYS.contraindications]: ["shoulder"] } };
    expect(isSafeForInjuries(exercise, ["shoulder"])).toBe(false);
  });

  it("is safe when an exercise's contraindications don't intersect the active tags", () => {
    const exercise = { metadata: { [METADATA_KEYS.contraindications]: ["lower_back_extension_intolerant"] } };
    expect(isSafeForInjuries(exercise, ["shoulder", "knee_anterior_patellar"])).toBe(true);
  });

  it("every InjuryTag is a plausible metadata value round-tripping through contraindications()", () => {
    for (const tag of ALL_INJURY_TAGS) {
      const exercise = { metadata: { [METADATA_KEYS.contraindications]: [tag] } };
      expect(isSafeForInjuries(exercise, [tag])).toBe(false);
    }
  });
});

describe("recommendConsultationReason", () => {
  it("is null for a clear profile", () => {
    expect(recommendConsultationReason(clearInjuries())).toBeNull();
  });

  it("is null for a single flagged joint", () => {
    expect(recommendConsultationReason({ ...clearInjuries(), shoulder: true })).toBeNull();
  });

  it("is null for two flagged joints that aren't the shoulder+lower-back combination", () => {
    const injuries: InjuryProfile = { ...clearInjuries(), wrist: true, elbow: true };
    expect(recommendConsultationReason(injuries)).toBeNull();
  });

  it("fires for shoulder + lower back together, even with no other flags", () => {
    const injuries: InjuryProfile = { ...clearInjuries(), shoulder: true, lowerBack: { pattern: "flexion_intolerant" } };
    expect(recommendConsultationReason(injuries)).toEqual(expect.any(String));
  });

  it("fires for three or more flagged joints regardless of which ones", () => {
    const injuries: InjuryProfile = { ...clearInjuries(), wrist: true, elbow: true, knee: { presentation: "anterior_patellar" } };
    expect(recommendConsultationReason(injuries)).toEqual(expect.any(String));
  });

  it("counts an unsure joint as one flagged joint, not one per tag it produces", () => {
    // unsure hip alone produces three tags but is one flagged joint — should
    // not fire on its own.
    const injuries: InjuryProfile = { ...clearInjuries(), hip: { presentation: "unsure" } };
    expect(recommendConsultationReason(injuries)).toBeNull();
  });
});
