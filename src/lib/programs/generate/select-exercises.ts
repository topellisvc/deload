import type { Exercise, ExerciseLibraryCategory, MuscleGroup } from "@/lib/exercises/types";
import { activeTags, isSafeForInjuries, type InjuryTag } from "@/lib/programs/generate/injuries";
import { isEquipmentUsable, isSkillAppropriate, ladderFor, requiresLiftCoaching } from "@/lib/programs/generate/patterns";
import type { EquipmentAccess, ExerciseSlot, InjuryProfile, SlotPattern } from "@/lib/programs/generate/types";
import type { ExperienceLevel } from "@/lib/supabase/types";

/**
 * Task #14 — resolves one ExerciseSlot (a description of what a day needs at
 * one position: "a squat pattern for quads," "a horizontal pull for back")
 * to a real, selectable Exercise Library row. Referenced by name in
 * types.ts's ExerciseSlot comment; this is that file.
 *
 * Deterministic on purpose, same reason the rest of this generator is: given
 * the same slot, the same exercise pool and the same athlete constraints,
 * this always returns the same exercise. That's what makes §14's own
 * stability check meaningful ("fill the same questionnaire twice with one
 * small difference and check the outputs aren't wildly different") and what
 * makes a "why did I get this exercise" answer explainable rather than a
 * black box.
 *
 * THE ALGORITHM, IN ONE PARAGRAPH
 * ----------------------------------
 * For a pattern-bearing slot: build Appendix C's ladder for that pattern
 * (patterns.ts's ladderFor, already ordered most to least demanding), apply
 * three hard filters — equipment the athlete actually has, injury safety for
 * their active tags, and §6's lift-coaching gate — then, among what
 * survives, prefer exercises appropriate to the athlete's skill level and
 * take the most demanding one that's left. That last step is §10 step 3
 * ("regress in a fixed order... a regression is one step down the ladder")
 * happening automatically: nothing here decides "swap to a machine because
 * they're a beginner" as a separate rule, it falls out of walking the same
 * ordered list every other decision already respects.
 *
 * WHY SKILL IS A FILTER APPLIED SECOND, NOT ALONGSIDE EQUIPMENT/INJURY
 * -----------------------------------------------------------------------
 * patterns.ts's isSkillAppropriate is documented as "a preference, not a
 * filter" — §9 says a strength goal at intermediate+ gets "barbell primary,
 * no substitution," and a beginner should still get the barbell version of a
 * pattern if literally nothing else in that pattern is available (an empty
 * slot is a worse outcome than an early advanced exercise). So skill is
 * applied as a soft second pass: prefer the subset that fits, but fall back
 * to the full hard-filtered set rather than returning unresolved. Equipment,
 * injury safety and the coaching gate get no such fallback — those are
 * genuine hard constraints (you cannot select a barbell exercise for someone
 * without a barbell, or a shoulder-contraindicated press for a flagged
 * shoulder) and failing them always removes a candidate for good.
 *
 * WHAT THIS FILE DOES NOT DO
 * -----------------------------
 * - It never swaps which *pattern* a slot asks for. §1's "vertical push/pull
 *   can substitute away entirely for a flagged shoulder" is a decision about
 *   which patterns a day's structure requires, which belongs to the template
 *   that built the day (or to assemble.ts, task #15, if it needs to react to
 *   a completely empty ladder) — not to this per-slot resolver. In practice
 *   this rarely bites: the seeded data leaves at least one non-contraindicated
 *   option in every WEEKLY_REQUIRED_PATTERNS ladder for every single-joint
 *   flag, so the common case resolves cleanly without ever reaching for that
 *   pattern-level fallback.
 * - It does not resolve running/cardio/mobility/stretching category slots.
 *   Those templates (running-templates.ts, cardio-templates.ts) already
 *   build ExerciseSlot.movementPattern/primaryMuscleGroup as null and carry
 *   a human-readable label + prescription directly — there is no
 *   Appendix C ladder for "Easy Run," and the library's running/cardio rows
 *   were deliberately left untagged by the seed migration (task #26) for
 *   exactly this reason. If a future assemble.ts wants to attach a specific
 *   library row to one of those slots (for logging/history purposes), that's
 *   a name/category lookup, not a pattern-ladder resolution, and doesn't need
 *   this file's machinery.
 * - It does not pick more than one exercise per slot, and it does not know
 *   about set/rep numbers at all — WeekSetPlan/SlotPrescription (already
 *   resolved by the time a slot reaches this function) own that.
 */

export interface SelectionContext {
  equipmentAccess: EquipmentAccess;
  experienceLevel: ExperienceLevel;
  injuries: InjuryProfile;
  /** §6's gate — see requiresLiftCoaching's own doc comment. */
  coachedOnOlympicLifts: boolean;
}

export interface SelectedExercise {
  exercise: Exercise;
  /**
   * How many rungs down the pattern's full ladder (before any filtering)
   * this pick sits from the top. 0 means the single most demanding exercise
   * the library has for this pattern was used outright — no regression was
   * needed. A positive number means something (equipment, injury, coaching
   * gate, or an empty skill-appropriate subset) knocked one or more more-
   * demanding options out first.
   *
   * Not a warning by itself — §10 step 3 treats a clean regression as the
   * *correct* outcome for a flagged joint, not a degraded one. A template or
   * UI layer can decide whether a particular regressedSteps value is worth
   * mentioning; this file just reports the fact.
   */
  regressedSteps: number;
}

/** Nothing in the library can currently fill this slot under these
 * constraints. Not necessarily an error — an empty hip_abduction or
 * calf_soleus ladder is a documented, known gap (see the seed migration's
 * header), and a fully-excluded pattern for a heavily-flagged athlete is a
 * real, if rare, possibility. The caller decides what to do with it. */
export interface UnresolvedSlot {
  unresolved: string;
}

export type SlotSelectionResult = SelectedExercise | UnresolvedSlot;

function passesHardFilters(exercise: Exercise, context: SelectionContext, tags: readonly InjuryTag[]): boolean {
  if (!isEquipmentUsable(exercise.equipment, context.equipmentAccess)) return false;
  if (!isSafeForInjuries(exercise, tags)) return false;
  if (requiresLiftCoaching(exercise) && !context.coachedOnOlympicLifts) return false;
  return true;
}

/** Prefer skill-appropriate candidates, but never let that preference empty
 * the list — see this file's header comment on why skill is a soft filter. */
function preferSkillAppropriate<T extends Pick<Exercise, "difficulty">>(candidates: readonly T[], level: ExperienceLevel): readonly T[] {
  const appropriate = candidates.filter((e) => isSkillAppropriate(e.difficulty, level));
  return appropriate.length > 0 ? appropriate : candidates;
}

function selectableExercisePool(exercises: readonly Exercise[]): Exercise[] {
  // Archived rows are gone from the coach's own library UI; a coach's own
  // pending (or a rejected) custom exercise isn't visible to anyone else per
  // migration 0038's review-status gate, so the generator — which has no
  // single coach's identity to check ownership against — must not select
  // one either. Only globally-approved rows are safe to hand to any athlete.
  return exercises.filter((e) => !e.is_archived && e.review_status === "approved");
}

function selectFromLadder(pattern: SlotPattern, pool: readonly Exercise[], context: SelectionContext): SlotSelectionResult {
  const tags = activeTags(context.injuries);
  const ladder = ladderFor(pool, pattern);
  if (ladder.length === 0) {
    return { unresolved: `No exercise in the library is tagged for the "${pattern}" pattern.` };
  }

  const eligible = ladder.filter((e) => passesHardFilters(e, context, tags));
  if (eligible.length === 0) {
    return { unresolved: `Every "${pattern}" exercise was ruled out by equipment, injury, or lift-coaching constraints.` };
  }

  const candidates = preferSkillAppropriate(eligible, context.experienceLevel);
  const picked = candidates[0]!;
  const regressedSteps = ladder.findIndex((e) => e.id === picked.id);
  return { exercise: picked, regressedSteps };
}

/**
 * A slot with no movementPattern (an accessory or "athlete's choice" slot —
 * see ExerciseSlot's own comment) has no Appendix C ladder to walk. It's
 * matched on category + primaryMuscleGroup instead, with the same hard
 * filters, and ordered by id for a stable pick rather than by demand_rank,
 * since demand_rank is only ever populated per-pattern and these slots
 * declare none.
 */
function selectByMuscleGroup(
  category: ExerciseLibraryCategory,
  primaryMuscleGroup: MuscleGroup | null,
  pool: readonly Exercise[],
  context: SelectionContext
): SlotSelectionResult {
  if (!primaryMuscleGroup) {
    return { unresolved: "Slot has neither a movement pattern nor a primary muscle group to select against." };
  }

  const tags = activeTags(context.injuries);
  const matches = pool
    .filter((e) => e.category === category && e.primary_muscle_group === primaryMuscleGroup)
    .filter((e) => passesHardFilters(e, context, tags))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (matches.length === 0) {
    return { unresolved: `No "${category}" exercise for "${primaryMuscleGroup}" survived equipment/injury/coaching filters.` };
  }

  const candidates = preferSkillAppropriate(matches, context.experienceLevel);
  return { exercise: candidates[0]!, regressedSteps: 0 };
}

export function selectExerciseForSlot(
  slot: Pick<ExerciseSlot, "movementPattern" | "primaryMuscleGroup" | "category">,
  exercises: readonly Exercise[],
  context: SelectionContext
): SlotSelectionResult {
  const pool = selectableExercisePool(exercises);
  if (slot.movementPattern) return selectFromLadder(slot.movementPattern, pool, context);
  return selectByMuscleGroup(slot.category, slot.primaryMuscleGroup, pool, context);
}
