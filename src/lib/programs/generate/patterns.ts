import type { Exercise, ExerciseDifficulty, ExerciseEquipment, MovementPattern, MuscleGroup } from "@/lib/exercises/types";
import type { EquipmentAccess } from "@/lib/programs/generate/types";

/**
 * The generator's movement-pattern taxonomy and the substitution ladders built
 * on it — Appendix C of the coach interview
 * (deload-program-generator-coach-answers.md).
 *
 * Appendix C's instruction: "Build substitutions on patterns, not exercise
 * names. Each entry should be an ordered ladder from most to least demanding,
 * so that a regression is one step down rather than a lookup." That ordering is
 * what makes §10's injury logic work at all — step 3 of its three-step gate
 * regresses one rung at a time, and §9's equipment substitutions walk the same
 * rungs for a different reason.
 *
 * WHY THIS TAXONOMY EXISTS SEPARATELY FROM MovementPattern
 * -------------------------------------------------------
 * lib/exercises/types.ts already has a `MovementPattern` union, mirroring the
 * `exercises.movement_pattern` column. It is deliberately coarser than this
 * and cannot be used for the generator's requirements. Checked against the
 * seeded library:
 *
 * - Every row, pulldown, pull-up and chin-up is `pull` + `back`. Horizontal
 *   versus vertical pull is not recoverable from the column at all, yet §1
 *   makes "at least one horizontal pull and one vertical pull" a weekly
 *   non-negotiable. (Push is recoverable — chest implies horizontal,
 *   shoulders vertical — but pull is not.)
 * - `barbell-rdl` and `leg-curl-machine` are both `hinge` + `hamstrings`, so
 *   §1's "direct knee-flexion hamstring work — squats and deadlifts don't
 *   cover it" cannot be verified.
 * - Plank, side plank, dead bug and hanging knee raise are all
 *   `anti_rotation`, where Appendix C needs anti-extension, anti-rotation and
 *   anti-lateral-flexion as three separate ladders.
 * - Bulgarian split squat, walking lunge and dumbbell lunge are all `squat`
 *   (nothing in the library uses `lunge`), so bilateral versus unilateral is
 *   not recoverable either.
 *
 * Widening the database column was considered and rejected: it would mean a
 * migration plus re-tagging every row, it would change what the Exercise
 * Library's own filter UI offers, and it still wouldn't carry the ordering or
 * the injury-compatibility fields Appendix C asks for. So the vocabulary lives
 * here in code, and the per-exercise assignment lives in data — see below.
 *
 * WHERE EACH PIECE OF DATA LIVES, AND WHY
 * ---------------------------------------
 * The division matters for a practical reason: exercises get added to this
 * library over time, and an exercise the generator can't see is an exercise
 * that may as well not exist to it.
 *
 * - The *vocabulary* (SlotPattern below) is code. It's closed, roughly twenty
 *   values, derived from Appendix C, and changes rarely.
 * - *Which patterns an exercise serves* is data: `exercises.metadata`, keyed
 *   `slot_patterns`. Migration 0035 introduced that column as exactly this
 *   extension point ("future fields land here as keys before ever earning a
 *   real column"), and it was previously unused. Adding an exercise later is
 *   therefore an insert, not a code change and a redeploy.
 * - *Ladder ordering* is data too, in two parts: `metadata.demand_rank` gives
 *   a total order within a pattern (1 = most demanding), and the existing
 *   `exercise_relationships` table's progression/regression edges give the
 *   step-by-step walk. That table already holds 72 edges and already powers
 *   the Exercise Detail page, so the generator reads the same graph the app
 *   already shows rather than a private copy that could disagree with it.
 * - *Equipment and skill* need nothing new — `equipment` and `difficulty` are
 *   real columns already.
 * - *Injury compatibility* is data: `metadata.injury_contraindications`.
 *
 * An exercise with no `slot_patterns` is not an error and not a guess. It is
 * simply not selectable for a pattern the generator can't prove it satisfies
 * (see resolveSlotPatterns' fallback). A coach adding an exercise through the
 * Exercise Library UI today gets `metadata: {}` — createExercise doesn't write
 * this key — so that exercise is invisible to the generator until someone tags
 * it. Invisible is the correct failure here; the alternative is inferring that
 * a lateral raise satisfies a vertical-press requirement.
 */

/**
 * Appendix C's patterns, plus the few §6 and §10 requirements Appendix C's
 * table doesn't enumerate as ladders but the templates must still be able to
 * ask for. Every value below is traceable to a specific requirement:
 *
 * Appendix C's own rows, split where its groupings hide a real distinction:
 * - squat/hinge split bilateral vs unilateral (Appendix C lists them that way)
 * - `hip_abduction` and `hip_adduction` are one Appendix C row but are pulled
 *   apart here, because §10 needs them independently and in opposite
 *   directions: lateral hip (gluteal tendinopathy) wants isometric *abduction*
 *   and explicitly avoids adducted positions, while anterior hip / groin wants
 *   *adduction* loading (Copenhagen). One pattern couldn't serve both.
 * - `calf_gastroc` and `calf_soleus` likewise. Appendix C orders them within
 *   one row, but §8 says "include soleus (bent-knee) work, not just gastroc"
 *   and §10's knee section calls soleus "chronically under-trained and
 *   [it] matters for both the knee and the Achilles." A template needs to
 *   prescribe soleus specifically, not hope a calf slot picks it.
 *
 * Not in Appendix C's table, required elsewhere:
 * - `jump`, `throw`, `sprint` — §6's volume is counted in foot contacts, total
 *   throws and metres of sprinting, so these are distinct prescriptions.
 *   (`rotational_power` stays separate because Appendix C gives it its own
 *   ladder and it's the highest-value quality for §7's Group 2 and golf.)
 * - `shoulder_external_rotation`, `scapular_control` — §10's shoulder section
 *   labels these "the actual treatment," and §9 protects flagged prophylaxis
 *   work above accessories in the trim order, so a template must be able to
 *   request them by name rather than hoping an accessory slot lands on one.
 * - `isometric_tendon` — §10's first-line for painful tendons (5 x 30-45 s),
 *   named for patellar, gluteal and elbow presentations. Distinct because the
 *   prescription is a hold, not reps.
 */
export type SlotPattern =
  | "squat_bilateral"
  | "squat_unilateral"
  | "hinge_bilateral"
  | "hinge_unilateral"
  | "knee_flexion"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "carry"
  | "anti_extension"
  | "anti_rotation"
  | "rotational_power"
  | "hip_abduction"
  | "hip_adduction"
  | "calf_gastroc"
  | "calf_soleus"
  | "neck"
  | "jump"
  | "throw"
  | "sprint"
  | "shoulder_external_rotation"
  | "scapular_control"
  | "isometric_tendon";

export const ALL_SLOT_PATTERNS: readonly SlotPattern[] = [
  "squat_bilateral",
  "squat_unilateral",
  "hinge_bilateral",
  "hinge_unilateral",
  "knee_flexion",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "carry",
  "anti_extension",
  "anti_rotation",
  "rotational_power",
  "hip_abduction",
  "hip_adduction",
  "calf_gastroc",
  "calf_soleus",
  "neck",
  "jump",
  "throw",
  "sprint",
  "shoulder_external_rotation",
  "scapular_control",
  "isometric_tendon",
] as const;

const SLOT_PATTERN_SET = new Set<string>(ALL_SLOT_PATTERNS);

export function isSlotPattern(value: unknown): value is SlotPattern {
  return typeof value === "string" && SLOT_PATTERN_SET.has(value);
}

/**
 * The reserved `exercises.metadata` keys this module reads. Named as constants
 * rather than inlined string literals so the seed migration, the resolver and
 * the tests can't drift apart on a typo.
 *
 * Flat keys rather than nested under a `generator` object: `metadata` is
 * currently unused by anything else, these names are specific enough not to
 * collide, and flat keys stay queryable from SQL (`metadata->'slot_patterns'`)
 * for the seed migration's own verification.
 */
export const METADATA_KEYS = {
  /** string[] of SlotPattern values this exercise can fill. */
  slotPatterns: "slot_patterns",
  /**
   * Appendix C's ordering, as an object keyed by pattern: lower = more
   * demanding.
   *
   * Per-pattern rather than a single number because an exercise can sit at
   * different rungs of different ladders — a renegade row is near the top of
   * the anti-rotation ladder while being a mid-tier horizontal pull, and a
   * side plank is the bottom rung of Appendix C's carry/anti-lateral-flexion
   * ladder while being nothing at all in any other.
   *
   * Ranks are spaced in tens rather than numbered 1, 2, 3. Appendix C's
   * ladders name exercises this library doesn't have yet (safety-bar squat,
   * box squat, rack pull, neutral-grip pull-up, band pulldown), and spacing
   * leaves room to insert them at their correct rung later without rewriting
   * every neighbour's rank. The absolute values mean nothing; only the order
   * within one pattern does.
   */
  demandRank: "demand_rank",
  /** string[] of injury-flag identifiers this exercise is contraindicated for. */
  contraindications: "injury_contraindications",
  /** true for §6's opt-in-only lifts — see requiresLiftCoaching. */
  requiresLiftCoaching: "requires_lift_coaching",
} as const;

/**
 * Which patterns this exercise can fill.
 *
 * Tagged data first. Where an exercise has no `slot_patterns` metadata, a
 * narrow inference runs — but *only* for the cases the database columns can
 * actually prove, which is a much shorter list than it looks:
 *
 * - `push` + `chest` -> horizontal_push, and `push` + `shoulders` ->
 *   vertical_push. Safe, because the column pair genuinely determines it.
 * - `squat` + quads/glutes -> squat_bilateral. Note this is knowingly wrong
 *   for the library's lunges and split squats, which are all tagged `squat`;
 *   they are exactly why tagging exists, and the seed migration tags them.
 * - `carry` -> carry, `anti_rotation` -> anti_rotation, `rotation` -> ...
 *   nothing, because `rotation` covers both rotational *power* (med ball) and
 *   a slow cable rotation, which are different prescriptions.
 *
 * Everything else returns empty. In particular no inference is made for `pull`
 * (horizontal and vertical are indistinguishable in the column) or `hinge`
 * (hip hinge and knee flexion are indistinguishable). Returning empty means
 * "not selectable for a pattern," which is the safe failure: an untagged
 * exercise is skipped, never substituted for one whose requirement it may not
 * meet.
 */
export function resolveSlotPatterns(exercise: Pick<Exercise, "movement_pattern" | "primary_muscle_group" | "metadata">): SlotPattern[] {
  const tagged = exercise.metadata?.[METADATA_KEYS.slotPatterns];

  // The *presence* of the key is what makes it authoritative, including when
  // it's an empty array. An empty tag means "someone looked at this exercise
  // and it fills no generator pattern," which is a real and necessary answer —
  // it's how §6's do-not-auto-prescribe list is enforced. depth-jump is tagged
  // `jump` by its column and would otherwise be selectable for plyometric
  // work, when §6 puts depth jumps squarely in "needs a coach in the room."
  // Same for the full snatch and clean & jerk. Falling through to inference
  // there would silently re-enable exactly what the source document excludes.
  if (Array.isArray(tagged)) return dedupe(tagged.filter(isSlotPattern));

  return inferSlotPatterns(exercise.movement_pattern, exercise.primary_muscle_group);
}

/**
 * §6's middle ground: hang power clean, high pull and power snatch from blocks
 * are "allowed but not default." Motivated people can learn them, but they sit
 * behind an explicit "have you been coached on this lift?" question, with the
 * template defaulting to trap-bar jumps and DB snatches instead — "which give
 * you most of the benefit at a fraction of the risk."
 *
 * This is separate from tagging an exercise out entirely (an empty
 * slot_patterns array). The full snatch and clean & jerk are never unlocked by
 * anything the user claims about their coaching history; §6 and §7's refusal
 * list put them outside the automated path regardless. Those get an empty tag.
 * These get a gate.
 */
export function requiresLiftCoaching(exercise: Pick<Exercise, "metadata">): boolean {
  return exercise.metadata?.[METADATA_KEYS.requiresLiftCoaching] === true;
}

/** Exported for the tests and for the seed migration's coverage check — this
 * is the "what could we prove without tagging" baseline, and the gap between
 * it and the tagged data is the thing worth asserting. */
export function inferSlotPatterns(movementPattern: MovementPattern | null, primaryMuscleGroup: MuscleGroup): SlotPattern[] {
  switch (movementPattern) {
    case "push":
      if (primaryMuscleGroup === "chest") return ["horizontal_push"];
      if (primaryMuscleGroup === "shoulders") return ["vertical_push"];
      return [];
    case "squat":
      // Bilateral only. The library tags lunges and split squats `squat` too,
      // so this is deliberately conservative rather than correct-looking.
      if (primaryMuscleGroup === "quadriceps" || primaryMuscleGroup === "glutes") return ["squat_bilateral"];
      return [];
    case "carry":
      return ["carry"];
    case "anti_rotation":
      return ["anti_rotation"];
    case "jump":
      return ["jump"];
    case "throw":
      return ["throw"];
    // `pull` can't be split into horizontal/vertical from the columns, and
    // `hinge` can't be split from knee_flexion. `rotation` conflates
    // rotational power with slow cable rotation. `lunge` is unused by the
    // library. All require tagging.
    case "pull":
    case "hinge":
    case "rotation":
    case "lunge":
    case null:
      return [];
    default:
      return [];
  }
}

/**
 * This exercise's rung on one specific pattern's ladder — lower is more
 * demanding. Untagged sorts last, so a real ladder always beats a guess.
 *
 * Takes the pattern because rank is per-pattern; see METADATA_KEYS.demandRank.
 */
export function demandRank(exercise: Pick<Exercise, "metadata">, pattern: SlotPattern): number {
  const ranks = exercise.metadata?.[METADATA_KEYS.demandRank];
  if (ranks && typeof ranks === "object" && !Array.isArray(ranks)) {
    const value = (ranks as Record<string, unknown>)[pattern];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Appendix C's ladder for one pattern: the exercises that can fill it, ordered
 * most to least demanding. "A regression is one step down rather than a
 * lookup" — §10 step 3 walks this one rung at a time and never skips.
 *
 * Ties break on id so the ordering is total and a generated program is stable
 * across runs. §14's stability check ("fill the same questionnaire twice with
 * one small difference and check the outputs aren't wildly different") is
 * unmeetable if selection can reorder equal-ranked exercises arbitrarily.
 */
export function ladderFor<T extends Pick<Exercise, "id" | "movement_pattern" | "primary_muscle_group" | "metadata">>(
  exercises: readonly T[],
  pattern: SlotPattern
): T[] {
  return exercises
    .filter((exercise) => resolveSlotPatterns(exercise).includes(pattern))
    .sort((a, b) => demandRank(a, pattern) - demandRank(b, pattern) || a.id.localeCompare(b.id));
}

export function contraindications(exercise: Pick<Exercise, "metadata">): string[] {
  const value = exercise.metadata?.[METADATA_KEYS.contraindications];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/**
 * Which equipment types are usable at each access level (§9's
 * home/minimal-equipment section, and its mistake #6: "Ignoring equipment
 * reality — prescribing a hack squat to someone with dumbbells and a bench.
 * You need a real substitution graph keyed on equipment, not a text
 * disclaimer.").
 *
 * `minimal_equipment` means the §9 purchase-priority floor: a pull-up bar or
 * rings plus bands, which is what makes the vertical-pull hole survivable at
 * all. Bodyweight-only genuinely cannot fill vertical or horizontal pull well,
 * and §9 says to be honest about that rather than pretend — the generator
 * surfaces it as a warning rather than silently substituting something
 * inferior.
 */
const EQUIPMENT_BY_ACCESS: Record<EquipmentAccess, readonly ExerciseEquipment[]> = {
  full_gym: ["barbell", "dumbbell", "machine", "cable", "resistance_band", "bodyweight", "kettlebell", "medicine_ball", "cardio_machine"],
  home_gym: ["barbell", "dumbbell", "resistance_band", "bodyweight", "kettlebell", "medicine_ball"],
  minimal_equipment: ["dumbbell", "resistance_band", "bodyweight", "kettlebell"],
  bodyweight_only: ["bodyweight"],
};

export function equipmentAvailable(access: EquipmentAccess): ReadonlySet<ExerciseEquipment> {
  return new Set(EQUIPMENT_BY_ACCESS[access]);
}

export function isEquipmentUsable(equipment: ExerciseEquipment, access: EquipmentAccess): boolean {
  return equipmentAvailable(access).has(equipment);
}

/**
 * §9's novice modality default: "Fewer high-skill barbell lifts than tradition
 * suggests... Introduce barbell lifts progressively as an unlockable, not a
 * prerequisite." An `advanced`-difficulty exercise is not offered to a
 * beginner unless nothing else in the pattern is available.
 *
 * Deliberately a preference, not a filter — §9's very next row says a strength
 * goal at intermediate+ gets "Barbell primary, no substitution. Specificity —
 * if you want a bigger squat you must squat." So skill gates ordering, and the
 * template decides whether to insist.
 */
export function isSkillAppropriate(difficulty: ExerciseDifficulty, level: "beginner" | "intermediate" | "advanced"): boolean {
  if (level === "beginner") return difficulty !== "advanced";
  return true;
}

/** §1's weekly non-negotiables, as data rather than prose so the validation
 * harness can assert them against a generated week.
 *
 * Note what's *not* here: "total pulling sets >= total pushing sets" and
 * "hinge volume >= squat volume" are volume comparisons, not presence checks,
 * so they belong to the volume accounting module rather than this list. */
export const WEEKLY_REQUIRED_PATTERNS: readonly SlotPattern[] = [
  "squat_bilateral",
  "hinge_bilateral",
  "horizontal_push",
  "horizontal_pull",
  "vertical_push",
  "vertical_pull",
  // "Direct knee-flexion hamstring work (leg curl, Nordic, slider) — squats
  // and deadlifts don't cover it." The one most often missed, and the reason
  // knee_flexion had to be split out of `hinge`.
  "knee_flexion",
] as const;

/** §1: vertical push and vertical pull are the two the shoulder branch is
 * allowed to substitute away from, per "or a substitution if
 * shoulder-flagged." Everything else in WEEKLY_REQUIRED_PATTERNS stands
 * regardless. */
export const SHOULDER_SUBSTITUTABLE_PATTERNS: readonly SlotPattern[] = ["vertical_push", "vertical_pull"] as const;

function dedupe<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}
