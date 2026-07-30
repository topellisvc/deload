import type { ExperienceLevel } from "@/lib/supabase/types";
import type { MuscleGroup } from "@/lib/exercises/types";
import { WEEKLY_REQUIRED_PATTERNS } from "@/lib/programs/generate/patterns";
import type { SlotPattern } from "@/lib/programs/generate/types";

/**
 * §1's days-per-week x experience-level split table, and the exercise-order
 * rules within a day. This module answers "what days exist and what pattern
 * does each one train" — the actual set/rep/RPE numbers are
 * resistance-templates.ts's job, layered on top of the DaySkeleton this file
 * produces.
 *
 * V1 SIMPLIFICATION, STATED ONCE HERE
 * ------------------------------------
 * The coach's table offers multiple valid splits at several (days, level)
 * combinations — e.g. 3 days intermediate: "Full body x3, or Upper / Lower /
 * Full." A generator has to pick one default rather than present a menu; this
 * file always takes the option the coach's own prose endorses most directly
 * (his "I'd nudge most new users toward" language at 3 days, "the default for
 * essentially everyone... I'd make it the app's fallback" at 4 days, etc.)
 * rather than the more exotic alternative. The alternative splits aren't
 * wrong, just not built — a genuine v1 scope cut, not an oversight.
 */

export type SplitType = "full_body" | "upper_lower" | "upper_lower_plus_one" | "push_pull_legs_x2";

export type DayRole =
  | "full_body_a"
  | "full_body_b"
  | "upper_a"
  | "lower_a"
  | "upper_b"
  | "lower_b"
  | "specialization"
  | "push"
  | "pull"
  | "legs";

export interface ChosenSplit {
  splitType: SplitType;
  /** Days per week the split actually uses — only differs from the
   * requested value when a level-based cap kicked in (novice at 6 days). */
  effectiveDaysPerWeek: number;
  dayRoles: DayRole[];
  warnings: string[];
}

/**
 * §1's table, collapsed to one default split per (days, level) cell. Picks
 * the day-role sequence and any warning the coach's answer attaches to that
 * cell — the 2-day advanced ceiling, the novice 6-day cap, the 6-day
 * long-session completion risk.
 */
export function chooseSplit(daysPerWeek: number, experienceLevel: ExperienceLevel, sessionLengthMinutes: number): ChosenSplit {
  const warnings: string[] = [];

  // "6 days: discourage [for a novice]... Cap novices at 4 and say why."
  let effectiveDays = daysPerWeek;
  if (experienceLevel === "beginner" && daysPerWeek >= 6) {
    effectiveDays = 4;
    warnings.push(
      "6 days a week is a lot to sustain as a beginner, so this program uses 4 days instead — full-body volume builds just as well without the extra recovery cost, and 4 days is easier to actually keep up."
    );
  }

  if (effectiveDays === 6 && sessionLengthMinutes >= 75) {
    warnings.push(
      "6 sessions a week at 75+ minutes each is a lot of training time — most people who pick this combination don't sustain it. Worth considering fewer days or shorter sessions."
    );
  }

  if (effectiveDays <= 2 && experienceLevel === "advanced") {
    warnings.push("At 2 days a week, this program will maintain your current strength and muscle rather than build meaningfully on it — that's the realistic ceiling at this frequency for an advanced lifter.");
  }

  if (effectiveDays <= 2) {
    return { splitType: "full_body", effectiveDaysPerWeek: effectiveDays, dayRoles: buildDayRoles("full_body", effectiveDays), warnings };
  }
  if (effectiveDays === 3) {
    return { splitType: "full_body", effectiveDaysPerWeek: effectiveDays, dayRoles: buildDayRoles("full_body", effectiveDays), warnings };
  }
  if (effectiveDays === 4) {
    return { splitType: "upper_lower", effectiveDaysPerWeek: effectiveDays, dayRoles: buildDayRoles("upper_lower", effectiveDays), warnings };
  }
  if (effectiveDays === 5) {
    return {
      splitType: "upper_lower_plus_one",
      effectiveDaysPerWeek: effectiveDays,
      dayRoles: buildDayRoles("upper_lower_plus_one", effectiveDays),
      warnings,
    };
  }
  // 6+ (advanced/intermediate only — novice was already capped to 4 above).
  return {
    splitType: "push_pull_legs_x2",
    effectiveDaysPerWeek: effectiveDays,
    dayRoles: buildDayRoles("push_pull_legs_x2", effectiveDays),
    warnings,
  };
}

function buildDayRoles(splitType: SplitType, days: number): DayRole[] {
  switch (splitType) {
    case "full_body":
      // A/B alternating — "3 days: Full body A/B/A alternating" and "2 days:
      // Full body A/B" are the same shape, just fewer repeats.
      return Array.from({ length: days }, (_, i) => (i % 2 === 0 ? "full_body_a" : "full_body_b"));
    case "upper_lower":
      // Upper/Lower x2 — the coach's fallback default at 4 days for every
      // level.
      return (["upper_a", "lower_a", "upper_b", "lower_b"] satisfies DayRole[]).slice(0, days);
    case "upper_lower_plus_one":
      // "The clean solution is Upper/Lower x2 plus a fifth day that's either
      // a weak-point/specialization day or a lower-priority day."
      return ["upper_a", "lower_a", "upper_b", "lower_b", "specialization"];
    case "push_pull_legs_x2":
      return (["push", "pull", "legs", "push", "pull", "legs"] satisfies DayRole[]).slice(0, days);
    default:
      return [];
  }
}

/** One exercise-order-compliant slot request for a day — resistance-
 * templates.ts turns each of these into a real ExerciseSlot by attaching a
 * SlotPrescription. `emphasis` marks the 1-2 slots per day eligible for
 * scheduled progression (§2: "only the 3-5 movements designated primary" —
 * per-day this is "primary", with "secondary" compounds and "accessory"
 * work progressing opportunistically instead). */
export interface SlotRequest {
  pattern: SlotPattern | null;
  primaryMuscleGroup: MuscleGroup | null;
  emphasis: "primary" | "secondary" | "accessory";
}

function primary(pattern: SlotPattern, primaryMuscleGroup: MuscleGroup | null = null): SlotRequest {
  return { pattern, primaryMuscleGroup, emphasis: "primary" };
}
function secondary(pattern: SlotPattern, primaryMuscleGroup: MuscleGroup | null = null): SlotRequest {
  return { pattern, primaryMuscleGroup, emphasis: "secondary" };
}
function accessory(pattern: SlotPattern | null, primaryMuscleGroup: MuscleGroup | null = null): SlotRequest {
  return { pattern, primaryMuscleGroup, emphasis: "accessory" };
}

/**
 * The exercise-order-compliant slot sequence for one day role. §1's order —
 * primary compound, secondary compound, accessory compounds, isolation,
 * direct core — is encoded as array position; nothing downstream reorders
 * these. Explosive/plyometric work (§1's step 1) is deliberately absent —
 * that's §6's power/athletic template (#22), not the general resistance
 * goals this file serves.
 *
 * Across a full week, every role combination here covers
 * WEEKLY_REQUIRED_PATTERNS at least once — see missingWeeklyPatterns, which
 * checks that invariant rather than just asserting it in a comment.
 */
export function slotSequenceForDayRole(role: DayRole): SlotRequest[] {
  switch (role) {
    case "full_body_a":
      return [
        primary("squat_bilateral", "quadriceps"),
        secondary("horizontal_push", "chest"),
        secondary("horizontal_pull", "back"),
        accessory("vertical_pull", "back"),
        accessory("knee_flexion", "hamstrings"),
        accessory("anti_extension", "core"),
      ];
    case "full_body_b":
      return [
        primary("hinge_bilateral", "hamstrings"),
        secondary("vertical_push", "shoulders"),
        secondary("horizontal_pull", "back"),
        accessory("squat_unilateral", "quadriceps"),
        accessory("calf_soleus", "calves"),
        accessory("anti_rotation", "core"),
      ];
    case "upper_a":
      return [
        primary("horizontal_push", "chest"),
        secondary("horizontal_pull", "back"),
        secondary("vertical_push", "shoulders"),
        accessory("vertical_pull", "back"),
        accessory(null, "triceps"),
        accessory(null, "biceps"),
      ];
    case "upper_b":
      return [
        primary("vertical_pull", "back"),
        secondary("vertical_push", "shoulders"),
        secondary("horizontal_pull", "back"),
        accessory("horizontal_push", "chest"),
        accessory("shoulder_external_rotation", "shoulders"),
        accessory(null, "biceps"),
      ];
    case "lower_a":
      return [
        primary("squat_bilateral", "quadriceps"),
        secondary("hinge_bilateral", "hamstrings"),
        accessory("knee_flexion", "hamstrings"),
        accessory("hip_abduction", "glutes"),
        accessory("calf_gastroc", "calves"),
        accessory("anti_extension", "core"),
      ];
    case "lower_b":
      return [
        primary("hinge_bilateral", "hamstrings"),
        secondary("squat_unilateral", "quadriceps"),
        accessory("knee_flexion", "hamstrings"),
        accessory("hip_adduction", "glutes"),
        accessory("calf_soleus", "calves"),
        accessory("anti_rotation", "core"),
      ];
    case "push":
      return [
        primary("horizontal_push", "chest"),
        secondary("vertical_push", "shoulders"),
        accessory(null, "chest"),
        accessory(null, "shoulders"),
        accessory(null, "triceps"),
      ];
    case "pull":
      return [
        primary("vertical_pull", "back"),
        secondary("horizontal_pull", "back"),
        accessory("shoulder_external_rotation", "shoulders"),
        accessory(null, "back"),
        accessory(null, "biceps"),
      ];
    case "legs":
      return [
        primary("squat_bilateral", "quadriceps"),
        secondary("hinge_bilateral", "hamstrings"),
        accessory("knee_flexion", "hamstrings"),
        accessory("hip_abduction", "glutes"),
        accessory("calf_soleus", "calves"),
        accessory("anti_extension", "core"),
      ];
    case "specialization":
      // "A weak-point/specialization day, or a lower-priority day (arms +
      // calves + core, or conditioning)." v1 always builds the
      // lower-priority version — bodybuilding's actual weak-point auditing
      // (§4) is layered on separately in resistance-templates.ts via
      // BodybuildingProfile, not baked into this shared skeleton.
      return [accessory(null, "biceps"), accessory(null, "triceps"), accessory("calf_soleus", "calves"), accessory("anti_rotation", "core")];
    default:
      return [];
  }
}

/**
 * §1's per-week non-negotiables, checked rather than assumed. Returns the
 * patterns a week of DayRoles fails to cover at least once — empty means the
 * week is compliant. Doesn't check the volume comparisons (pulling >= pushing
 * sets, hinge >= squat volume for desk-bound people) since those need actual
 * set counts, not just presence; see the resistance-templates tests for that.
 */
export function missingWeeklyPatterns(dayRoles: readonly DayRole[]): SlotPattern[] {
  const covered = new Set<SlotPattern>();
  for (const role of dayRoles) {
    for (const slot of slotSequenceForDayRole(role)) {
      if (slot.pattern) covered.add(slot.pattern);
    }
  }
  return WEEKLY_REQUIRED_PATTERNS.filter((p) => !covered.has(p));
}
