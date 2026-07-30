import { describe, expect, it } from "vitest";
import type { Exercise } from "@/lib/exercises/types";
import {
  ALL_SLOT_PATTERNS,
  METADATA_KEYS,
  SHOULDER_SUBSTITUTABLE_PATTERNS,
  WEEKLY_REQUIRED_PATTERNS,
  contraindications,
  demandRank,
  equipmentAvailable,
  inferSlotPatterns,
  isEquipmentUsable,
  isSkillAppropriate,
  isSlotPattern,
  ladderFor,
  requiresLiftCoaching,
  resolveSlotPatterns,
} from "@/lib/programs/generate/patterns";

/** Minimal Exercise-shaped fixture — only the fields the resolver reads. */
function ex(partial: Partial<Exercise>): Pick<Exercise, "movement_pattern" | "primary_muscle_group" | "metadata"> {
  return {
    movement_pattern: partial.movement_pattern ?? null,
    primary_muscle_group: partial.primary_muscle_group ?? "full_body",
    metadata: partial.metadata ?? {},
  };
}

describe("resolveSlotPatterns — tagged data", () => {
  it("prefers metadata over inference, even when inference would answer", () => {
    // Tagged as unilateral; the columns would have said squat_bilateral. This
    // is the library's actual situation for split squats and lunges.
    const bulgarian = ex({
      movement_pattern: "squat",
      primary_muscle_group: "quadriceps",
      metadata: { [METADATA_KEYS.slotPatterns]: ["squat_unilateral"] },
    });
    expect(resolveSlotPatterns(bulgarian)).toEqual(["squat_unilateral"]);
  });

  it("lets one exercise serve several patterns", () => {
    const tge = ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["carry", "anti_rotation"] } });
    expect(resolveSlotPatterns(tge).sort()).toEqual(["anti_rotation", "carry"]);
  });

  it("recovers the distinctions the database columns cannot express", () => {
    // Every row/pulldown/pull-up in the library is `pull` + `back`, so these
    // two are indistinguishable without tagging — the reason this module exists.
    const row = ex({ movement_pattern: "pull", primary_muscle_group: "back", metadata: { [METADATA_KEYS.slotPatterns]: ["horizontal_pull"] } });
    const pulldown = ex({ movement_pattern: "pull", primary_muscle_group: "back", metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_pull"] } });
    expect(resolveSlotPatterns(row)).toEqual(["horizontal_pull"]);
    expect(resolveSlotPatterns(pulldown)).toEqual(["vertical_pull"]);

    // Same for hinge vs knee flexion — barbell-rdl and leg-curl-machine are
    // both `hinge` + `hamstrings` in the library.
    const rdl = ex({ movement_pattern: "hinge", primary_muscle_group: "hamstrings", metadata: { [METADATA_KEYS.slotPatterns]: ["hinge_bilateral"] } });
    const legCurl = ex({ movement_pattern: "hinge", primary_muscle_group: "hamstrings", metadata: { [METADATA_KEYS.slotPatterns]: ["knee_flexion"] } });
    expect(resolveSlotPatterns(rdl)).toEqual(["hinge_bilateral"]);
    expect(resolveSlotPatterns(legCurl)).toEqual(["knee_flexion"]);
  });

  it("ignores unknown pattern strings rather than trusting them", () => {
    const bogus = ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["not_a_pattern", "vertical_pull"] } });
    expect(resolveSlotPatterns(bogus)).toEqual(["vertical_pull"]);
  });

  it("treats an explicit empty tag as authoritative, not as missing", () => {
    // This is how §6's do-not-auto-prescribe list is enforced. depth-jump is
    // movement_pattern 'jump' in the library, so inference would make it
    // selectable for plyometric work — but §6 puts depth jumps in "needs a
    // coach in the room." An empty tag has to beat the column.
    const depthJump = ex({
      movement_pattern: "jump",
      primary_muscle_group: "quadriceps",
      metadata: { [METADATA_KEYS.slotPatterns]: [] },
    });
    expect(resolveSlotPatterns(depthJump)).toEqual([]);
    // Sanity: without the tag, the column really would have made it selectable.
    expect(inferSlotPatterns("jump", "quadriceps")).toEqual(["jump"]);
  });

  it("does not fall back to inference when tags are present but all invalid", () => {
    // Present-but-unparseable is curated-and-broken, not unknown. Returning
    // nothing keeps the exercise invisible rather than silently reinstating a
    // column-derived guess someone deliberately overrode.
    const allBogus = ex({
      movement_pattern: "push",
      primary_muscle_group: "chest",
      metadata: { [METADATA_KEYS.slotPatterns]: ["nonsense"] },
    });
    expect(resolveSlotPatterns(allBogus)).toEqual([]);
  });

  it("only infers when the key is absent entirely", () => {
    const untagged = ex({ movement_pattern: "push", primary_muscle_group: "chest", metadata: {} });
    expect(resolveSlotPatterns(untagged)).toEqual(["horizontal_push"]);
  });

  it("dedupes repeated tags", () => {
    const dupe = ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["carry", "carry"] } });
    expect(resolveSlotPatterns(dupe)).toEqual(["carry"]);
  });

  it("survives malformed metadata without throwing", () => {
    expect(resolveSlotPatterns(ex({ metadata: { [METADATA_KEYS.slotPatterns]: "vertical_pull" } }))).toEqual([]);
    expect(resolveSlotPatterns(ex({ metadata: { [METADATA_KEYS.slotPatterns]: null } }))).toEqual([]);
    expect(resolveSlotPatterns(ex({ metadata: {} }))).toEqual([]);
  });
});

describe("requiresLiftCoaching — §6's opt-in middle ground", () => {
  it("gates only exercises explicitly marked", () => {
    expect(requiresLiftCoaching(ex({ metadata: { [METADATA_KEYS.requiresLiftCoaching]: true } }))).toBe(true);
    expect(requiresLiftCoaching(ex({ metadata: {} }))).toBe(false);
  });

  it("requires a real boolean, not a truthy value", () => {
    expect(requiresLiftCoaching(ex({ metadata: { [METADATA_KEYS.requiresLiftCoaching]: "yes" } }))).toBe(false);
    expect(requiresLiftCoaching(ex({ metadata: { [METADATA_KEYS.requiresLiftCoaching]: 1 } }))).toBe(false);
  });

  it("is a different mechanism from being tagged out entirely", () => {
    // A gated lift still fills a pattern once unlocked; a tagged-out lift never
    // does. The full snatch and clean & jerk are the latter — §6 and §7's
    // refusal list exclude them regardless of what the user claims.
    const gated = ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["hinge_bilateral"], [METADATA_KEYS.requiresLiftCoaching]: true } });
    const excluded = ex({ movement_pattern: "pull", primary_muscle_group: "full_body", metadata: { [METADATA_KEYS.slotPatterns]: [] } });
    expect(resolveSlotPatterns(gated)).toEqual(["hinge_bilateral"]);
    expect(requiresLiftCoaching(gated)).toBe(true);
    expect(resolveSlotPatterns(excluded)).toEqual([]);
    expect(requiresLiftCoaching(excluded)).toBe(false);
  });
});

describe("inferSlotPatterns — the untagged fallback", () => {
  it("splits push by muscle group, which the columns genuinely determine", () => {
    expect(inferSlotPatterns("push", "chest")).toEqual(["horizontal_push"]);
    expect(inferSlotPatterns("push", "shoulders")).toEqual(["vertical_push"]);
    // Triceps pressing isn't a pattern requirement, so no guess.
    expect(inferSlotPatterns("push", "triceps")).toEqual([]);
  });

  it("refuses to guess for pull, because horizontal and vertical are indistinguishable", () => {
    expect(inferSlotPatterns("pull", "back")).toEqual([]);
    expect(inferSlotPatterns("pull", "biceps")).toEqual([]);
  });

  it("refuses to guess for hinge, because hip hinge and knee flexion are indistinguishable", () => {
    expect(inferSlotPatterns("hinge", "hamstrings")).toEqual([]);
    expect(inferSlotPatterns("hinge", "glutes")).toEqual([]);
  });

  it("refuses to guess for rotation, which conflates power with slow cable work", () => {
    expect(inferSlotPatterns("rotation", "core")).toEqual([]);
  });

  it("returns empty for an untyped movement pattern", () => {
    expect(inferSlotPatterns(null, "full_body")).toEqual([]);
  });

  it("never infers a pattern it cannot prove — the safe-failure property", () => {
    // The guarantee the whole design rests on: an untagged exercise is either
    // resolved correctly or not selectable. It is never resolved to a pattern
    // whose requirement it might not meet.
    const provable = new Set(["horizontal_push", "vertical_push", "squat_bilateral", "carry", "anti_rotation", "jump", "throw"]);
    const patterns = ["push", "pull", "squat", "hinge", "lunge", "carry", "rotation", "anti_rotation", "jump", "throw", null] as const;
    const muscles = ["chest", "back", "shoulders", "quadriceps", "hamstrings", "glutes", "calves", "core", "biceps", "triceps", "forearms", "full_body"] as const;
    for (const mp of patterns) {
      for (const mg of muscles) {
        for (const inferred of inferSlotPatterns(mp, mg)) {
          expect(provable.has(inferred), `inferred ${inferred} from ${mp}/${mg}`).toBe(true);
        }
      }
    }
  });
});

describe("demandRank and contraindications", () => {
  it("reads the rank for the pattern asked about", () => {
    const e = ex({ metadata: { [METADATA_KEYS.demandRank]: { horizontal_pull: 25, anti_rotation: 15 } } });
    expect(demandRank(e, "horizontal_pull")).toBe(25);
    expect(demandRank(e, "anti_rotation")).toBe(15);
  });

  it("keeps an exercise's rungs on different ladders independent", () => {
    // A renegade row is near the top of the anti-rotation ladder while being a
    // mid-tier horizontal pull. A single rank couldn't say both.
    const renegade = ex({ metadata: { [METADATA_KEYS.demandRank]: { horizontal_pull: 25, anti_rotation: 15 } } });
    expect(demandRank(renegade, "anti_rotation")).toBeLessThan(demandRank(renegade, "horizontal_pull"));
  });

  it("sorts untagged exercises last so a real ladder always wins", () => {
    const tagged = demandRank(ex({ metadata: { [METADATA_KEYS.demandRank]: { carry: 70 } } }), "carry");
    const untagged = demandRank(ex({ metadata: {} }), "carry");
    expect(untagged).toBeGreaterThan(tagged);
  });

  it("returns unranked for a pattern the exercise has no rank for", () => {
    const e = ex({ metadata: { [METADATA_KEYS.demandRank]: { carry: 10 } } });
    expect(demandRank(e, "vertical_pull")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("ignores a malformed rank object", () => {
    expect(demandRank(ex({ metadata: { [METADATA_KEYS.demandRank]: 1 } }), "carry")).toBe(Number.MAX_SAFE_INTEGER);
    expect(demandRank(ex({ metadata: { [METADATA_KEYS.demandRank]: [10] } }), "carry")).toBe(Number.MAX_SAFE_INTEGER);
    expect(demandRank(ex({ metadata: { [METADATA_KEYS.demandRank]: { carry: "10" } } }), "carry")).toBe(Number.MAX_SAFE_INTEGER);
    expect(demandRank(ex({ metadata: { [METADATA_KEYS.demandRank]: { carry: Number.NaN } } }), "carry")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("reads contraindications and tolerates junk", () => {
    expect(contraindications(ex({ metadata: { [METADATA_KEYS.contraindications]: ["lower_back_flexion_intolerant", 3] } }))).toEqual([
      "lower_back_flexion_intolerant",
    ]);
    expect(contraindications(ex({ metadata: {} }))).toEqual([]);
  });
});

describe("ladderFor", () => {
  const lib = [
    { id: "lat-pulldown", ...ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_pull"], [METADATA_KEYS.demandRank]: { vertical_pull: 50 } } }) },
    { id: "pull-up", ...ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_pull"], [METADATA_KEYS.demandRank]: { vertical_pull: 20 } } }) },
    { id: "assisted-pull-up", ...ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["vertical_pull"], [METADATA_KEYS.demandRank]: { vertical_pull: 40 } } }) },
    { id: "barbell-row", ...ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["horizontal_pull"], [METADATA_KEYS.demandRank]: { horizontal_pull: 10 } } }) },
  ];

  it("orders a pattern's exercises most to least demanding", () => {
    expect(ladderFor(lib, "vertical_pull").map((e) => e.id)).toEqual(["pull-up", "assisted-pull-up", "lat-pulldown"]);
  });

  it("excludes exercises that don't serve the pattern", () => {
    expect(ladderFor(lib, "vertical_pull").map((e) => e.id)).not.toContain("barbell-row");
  });

  it("returns empty for a pattern nothing in the library serves", () => {
    expect(ladderFor(lib, "knee_flexion")).toEqual([]);
  });

  it("is a total, stable order — §14's stability check depends on it", () => {
    const tied = [
      { id: "zebra", ...ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["carry"], [METADATA_KEYS.demandRank]: { carry: 10 } } }) },
      { id: "alpha", ...ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["carry"], [METADATA_KEYS.demandRank]: { carry: 10 } } }) },
    ];
    expect(ladderFor(tied, "carry").map((e) => e.id)).toEqual(["alpha", "zebra"]);
    expect(ladderFor([...tied].reverse(), "carry").map((e) => e.id)).toEqual(["alpha", "zebra"]);
  });

  it("puts untagged-rank exercises after ranked ones", () => {
    const mixed = [
      { id: "unranked", ...ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["carry"] } }) },
      { id: "ranked", ...ex({ metadata: { [METADATA_KEYS.slotPatterns]: ["carry"], [METADATA_KEYS.demandRank]: { carry: 30 } } }) },
    ];
    expect(ladderFor(mixed, "carry").map((e) => e.id)).toEqual(["ranked", "unranked"]);
  });
});

describe("equipment gating (§9 mistake #6)", () => {
  it("narrows monotonically from full gym to bodyweight", () => {
    const full = equipmentAvailable("full_gym");
    const home = equipmentAvailable("home_gym");
    const minimal = equipmentAvailable("minimal_equipment");
    const bodyweight = equipmentAvailable("bodyweight_only");
    for (const e of bodyweight) expect(minimal.has(e), `${e} in minimal`).toBe(true);
    for (const e of minimal) expect(home.has(e), `${e} in home_gym`).toBe(true);
    for (const e of home) expect(full.has(e), `${e} in full_gym`).toBe(true);
    expect(bodyweight.size).toBeLessThan(minimal.size);
    expect(minimal.size).toBeLessThan(home.size);
    expect(home.size).toBeLessThan(full.size);
  });

  it("keeps machines and cables out of anything but a full gym", () => {
    expect(isEquipmentUsable("machine", "full_gym")).toBe(true);
    expect(isEquipmentUsable("machine", "home_gym")).toBe(false);
    expect(isEquipmentUsable("cable", "home_gym")).toBe(false);
    expect(isEquipmentUsable("cable", "minimal_equipment")).toBe(false);
  });

  it("keeps a barbell out of minimal equipment but allows it in a home gym", () => {
    expect(isEquipmentUsable("barbell", "home_gym")).toBe(true);
    expect(isEquipmentUsable("barbell", "minimal_equipment")).toBe(false);
  });

  it("allows bands at minimal equipment — the §9 purchase-priority floor", () => {
    expect(isEquipmentUsable("resistance_band", "minimal_equipment")).toBe(true);
    expect(isEquipmentUsable("resistance_band", "bodyweight_only")).toBe(false);
  });
});

describe("skill gating (§9 novice modality default)", () => {
  it("keeps advanced exercises away from beginners", () => {
    expect(isSkillAppropriate("advanced", "beginner")).toBe(false);
    expect(isSkillAppropriate("intermediate", "beginner")).toBe(true);
    expect(isSkillAppropriate("beginner", "beginner")).toBe(true);
  });

  it("puts no ceiling on intermediate or advanced athletes", () => {
    for (const d of ["beginner", "intermediate", "advanced"] as const) {
      expect(isSkillAppropriate(d, "intermediate")).toBe(true);
      expect(isSkillAppropriate(d, "advanced")).toBe(true);
    }
  });
});

describe("§1's weekly non-negotiables", () => {
  it("lists exactly the seven presence requirements", () => {
    expect([...WEEKLY_REQUIRED_PATTERNS].sort()).toEqual(
      ["hinge_bilateral", "horizontal_pull", "horizontal_push", "knee_flexion", "squat_bilateral", "vertical_pull", "vertical_push"].sort()
    );
  });

  it("includes direct knee flexion, the requirement squats and deadlifts don't cover", () => {
    expect(WEEKLY_REQUIRED_PATTERNS).toContain("knee_flexion");
  });

  it("allows only the two vertical patterns to be substituted for a flagged shoulder", () => {
    expect([...SHOULDER_SUBSTITUTABLE_PATTERNS].sort()).toEqual(["vertical_pull", "vertical_push"]);
    for (const pattern of SHOULDER_SUBSTITUTABLE_PATTERNS) {
      expect(WEEKLY_REQUIRED_PATTERNS).toContain(pattern);
    }
  });

  it("every required pattern is a real pattern", () => {
    for (const pattern of WEEKLY_REQUIRED_PATTERNS) expect(isSlotPattern(pattern)).toBe(true);
  });
});

describe("the pattern vocabulary itself", () => {
  it("ALL_SLOT_PATTERNS has no duplicates", () => {
    expect(new Set(ALL_SLOT_PATTERNS).size).toBe(ALL_SLOT_PATTERNS.length);
  });

  it("isSlotPattern accepts every listed value and rejects near-misses", () => {
    for (const p of ALL_SLOT_PATTERNS) expect(isSlotPattern(p)).toBe(true);
    for (const bad of ["push", "pull", "squat", "hinge", "vertical", "", null, undefined, 7, {}]) {
      expect(isSlotPattern(bad), String(bad)).toBe(false);
    }
  });

  it("keeps the pairs §10 needs to treat in opposite directions separate", () => {
    // Lateral hip wants abduction and avoids adducted positions; anterior hip
    // wants adduction loading. One pattern couldn't serve both.
    expect(ALL_SLOT_PATTERNS).toContain("hip_abduction");
    expect(ALL_SLOT_PATTERNS).toContain("hip_adduction");
    // §8: "Include soleus (bent-knee) work, not just gastroc."
    expect(ALL_SLOT_PATTERNS).toContain("calf_soleus");
    expect(ALL_SLOT_PATTERNS).toContain("calf_gastroc");
  });

  it("includes the §10 shoulder treatment patterns a prophylaxis slot must request by name", () => {
    expect(ALL_SLOT_PATTERNS).toContain("shoulder_external_rotation");
    expect(ALL_SLOT_PATTERNS).toContain("scapular_control");
    expect(ALL_SLOT_PATTERNS).toContain("isometric_tendon");
  });
});
