import type { Exercise } from "@/lib/exercises/types";
import { selectExerciseForSlot, type SelectionContext } from "@/lib/programs/generate/select-exercises";
import type { DayPlan, DeloadKind, ExerciseSlot, ProgramPhase, ProgramTemplate, WeekContext, WeekSetPlan } from "@/lib/programs/generate/types";
import type { BlockExerciseRow, BlockRow, DayRow, SetRow, WeekRow } from "@/lib/programs/types";

/**
 * Task #15 — turns a template family's ProgramTemplate (a fixed day/slot
 * *structure*, per-week numbers resolved lazily via SlotPrescription.forWeek)
 * into a real WeekRow[], the same shape starter-templates.ts hand-authors and
 * addWeek (mutations.ts) already knows how to insert.
 *
 * WHY THIS DOESN'T JUST REUSE createProgramFromTemplate's week1+progressionSteps PATH
 * ---------------------------------------------------------------------------------------
 * A StarterProgramTemplate is one hand-written week plus a flat per-week %
 * scale-up, because that's genuinely all four of those templates need. A
 * generated program is not that: a deload week isn't "week 1 scaled down,"
 * it's a different DeloadKind's treatment; a taper isn't a percentage of a
 * base week, it's a different ProgramPhase's prescription entirely. So this
 * file evaluates every week's real WeekContext against every slot's actual
 * forWeek function and produces a genuinely distinct WeekRow per week, not
 * one authored week plus arithmetic. The output is still exactly WeekRow[],
 * so whatever eventually creates the program (task #16/#17) can hand each
 * entry to addWeek with sourceWeek set and progressionPercent omitted —
 * insertion doesn't need to know or care that the source was generated
 * rather than hand-authored.
 *
 * EXERCISE SELECTION HAPPENS ONCE PER STRUCTURAL SLOT, NOT ONCE PER WEEK
 * --------------------------------------------------------------------------
 * ExerciseSlot's pattern/muscle-group/category never change week to week —
 * only its resolved WeekSetPlan does (that's the whole point of the
 * skeleton/numbers split documented in types.ts). selectExerciseForSlot's
 * inputs (the slot's shape, the athlete's equipment/injuries/skill/coaching)
 * are equally week-invariant, so calling it once per slot and reusing that
 * exercise for every week is both correct and exactly what a real program
 * needs — a lifter tracking "is my bench going up" needs the same exercise
 * in the same slot every week, not a fresh substitution each time.
 *
 * AVOIDING THE SAME EXERCISE TWICE IN ONE DAY
 * -----------------------------------------------
 * Two slots in the same day can legitimately ask for the same pattern (a
 * bodybuilding day's main chest press slot and a lagging-muscle-group chest
 * accessory, say) or the same muscle group, and selectExerciseForSlot is
 * deterministic — the same slot shape against the same pool always returns
 * the same exercise. Left alone that would put e.g. bench press twice in one
 * session. So each day tracks which exercise ids it has already placed and
 * excludes them from later slots' pools; if excluding them leaves nothing
 * (a thin pattern like knee_flexion, which the library currently has exactly
 * one entry for), the exclusion is dropped and a repeat is allowed rather
 * than leaving the slot empty — a repeated exercise is a smaller quality hit
 * than a missing one.
 *
 * WHAT AN UNRESOLVED SLOT BECOMES
 * -----------------------------------
 * If nothing in the library can fill a slot at all (a documented gap like
 * hip_abduction, or every candidate ruled out by injury/equipment/coaching
 * constraints), the row still gets created — exercise_id null, a
 * self-explanatory custom_name, and a warning — rather than silently
 * shrinking the day. A coach opening the program sees exactly which slot
 * needs their attention instead of wondering why a day looks thin.
 */

export interface AssembleInput {
  template: ProgramTemplate;
  /** Must match the number of weeks template.phaseByWeek/deloadWeeks were
   * built for — every template builder populates those maps for exactly
   * input.programLengthWeeks weeks, so callers should pass that same value
   * through rather than re-deriving it from the maps' contents. */
  totalWeeks: number;
  exercises: readonly Exercise[];
  selection: SelectionContext;
}

export interface AssembledProgram {
  weeks: WeekRow[];
  warnings: string[];
}

/**
 * prescription-types.ts's declarative contract is explicit: every strength
 * type except 'rep_range' reads the free-text `reps` field (min_reps/
 * max_reps is 'rep_range''s field alone) — SetDetails and every other
 * display surface follow that contract exactly, falling back to "?" when
 * `reps` is null regardless of whether min_reps/max_reps happen to be set.
 * But most of this file's own prescription-building functions (every RIR
 * wave in resistance-templates.ts, powerlifting-templates.ts's
 * MAIN_LIFT_SPEC, power-athletic-templates.ts's maximalStrengthPrescription,
 * sport-specific-templates.ts's slotPrescription, hybrid-templates.ts's
 * maintenance dose) represent a rep target as structured minReps/maxReps
 * numbers rather than a string — which e1rm.ts's percentOf1RM and this
 * file's own targetRepsAndRir-style helpers actually need to do real math on
 * a range, so that's not a mistake to "fix" at the source. Rather than
 * touching every one of those functions to also stringify a `reps` field
 * that would otherwise sit unused, this is the one place a WeekSetPlan
 * becomes a real SetRow, so it's the one place that reconciles the two: any
 * plan that supplies minReps/maxReps but no plain reps string gets one
 * computed here, in the exact shape the display layer already expects
 * ("6-8", or a bare "5" when min equals max) — same convention load-
 * calculation.ts's own repsLabel already uses for the same reason.
 */
function repsFieldFor(plan: WeekSetPlan): string | null {
  if (plan.reps != null) return plan.reps;
  if (plan.minReps != null && plan.maxReps != null) return plan.minReps === plan.maxReps ? String(plan.minReps) : `${plan.minReps}-${plan.maxReps}`;
  if (plan.minReps != null) return String(plan.minReps);
  return null;
}

function toSetRow(plan: WeekSetPlan, position: number): SetRow {
  return {
    id: "",
    block_exercise_id: "",
    position,
    prescription_type: plan.prescriptionType,
    sets: plan.sets,
    reps: repsFieldFor(plan),
    min_reps: plan.minReps ?? null,
    max_reps: plan.maxReps ?? null,
    // The generator never hand-authors an absolute load for someone it
    // knows nothing about (see types.ts's header comment on why WeekSetPlan
    // has no such field) — RIR/RPE autoregulation is the default mechanism,
    // not a stored-PR percentage lookup. A percent_1rm/test_then_percent_1rm
    // plan (load-calculation.ts) is the one exception: it does carry a
    // pr_record_type, so exercise-screen.tsx/exercise-performance-card.tsx
    // can resolve a suggested kg figure from the athlete's current max.
    weight_value: null,
    percent_1rm_value: plan.percent1RM ?? null,
    pr_record_type: plan.prRecordType ?? null,
    is_max_test: plan.isMaxTest ?? false,
    rpe_value: plan.rpe ?? null,
    rir_value: plan.rir ?? null,
    heart_rate_zone: plan.heartRateZone ?? null,
    calories: null,
    rest_seconds: plan.restSeconds ?? null,
    notes: plan.notes ?? null,
    distance_meters: plan.distanceMeters ?? null,
    duration_seconds: plan.durationSeconds ?? null,
    pace_seconds_per_km: plan.paceSecondsPerKm ?? null,
    advanced_config: null,
  };
}

function weekContextFor(template: ProgramTemplate, weekIndex: number, totalWeeks: number): WeekContext {
  const phase: ProgramPhase = template.phaseByWeek.get(weekIndex) ?? "standard";
  const deloadKind: DeloadKind | undefined = template.deloadWeeks.get(weekIndex);
  return { weekIndex, totalWeeks, phase, deload: deloadKind ? { kind: deloadKind } : null };
}

interface ResolvedSlot {
  slot: ExerciseSlot;
  exercise: Exercise | null;
  /** Human-readable placeholder used when no exercise resolves — see this
   * file's header comment on why an unresolved slot still produces a row. */
  placeholderName: string | null;
}

function slotDescription(slot: Pick<ExerciseSlot, "movementPattern" | "primaryMuscleGroup">): string {
  return slot.movementPattern ?? slot.primaryMuscleGroup ?? "unspecified";
}

/** Resolves every slot in a day to a real exercise (or a placeholder) once,
 * up front — this is the "select per structural slot, not per week" step.
 * Slots are resolved in their declared order, each excluding exercises
 * already placed earlier in the same day; if that exclusion empties the
 * pool for a slot, it's retried without the exclusion rather than left
 * unresolved (see header comment).
 *
 * A slot with neither a movementPattern nor a primaryMuscleGroup is never
 * sent to selectExerciseForSlot at all — running-templates.ts,
 * cardio-templates.ts, hybrid-templates.ts's maintenance-running days and
 * power-athletic-templates.ts's sprint day all build slots this way on
 * purpose (WeekSetPlan.forWeek already synthesizes the real distance/pace/
 * interval prescription with no Exercise Library row involved at all — see
 * migration 0045's header comment on why). Routing that combination
 * through the Appendix C ladder mechanism was never the intent; it just
 * has nothing to match against and reports "unresolved," which used to
 * surface as a spurious "no exercise available for main slot (unspecified)"
 * warning on every running/cardio/hybrid/sprint day, every single week.
 *
 * The placeholder name is the slot's own placeholderLabel when it has one;
 * otherwise it falls back to the day's own label ("Easy Run," "Threshold,"
 * "Zone 2," ...). The fallback is only correct when the slot has its day to
 * itself — see placeholderLabel's own doc comment (types.ts) for why a
 * multi-slot day (power-athletic-templates.ts's sprint day, which shares
 * "Speed & Power A" with a jump slot, hamstring-prep accessories and a
 * squat) needs the override instead of silently naming the sprint block
 * after the whole session. */
function resolveDaySlots(day: DayPlan, exercises: readonly Exercise[], selection: SelectionContext, warnings: string[], dayLabel: string): ResolvedSlot[] {
  const usedToday = new Set<string>();
  const resolved: ResolvedSlot[] = [];

  for (const slot of day.slots) {
    if (!slot.movementPattern && !slot.primaryMuscleGroup) {
      resolved.push({ slot, exercise: null, placeholderName: slot.placeholderLabel ?? dayLabel });
      continue;
    }

    const available = exercises.filter((e) => !usedToday.has(e.id));
    let result = selectExerciseForSlot(slot, available, selection);
    if ("unresolved" in result) {
      // Retry allowing a repeat within the day — a duplicate is a smaller
      // quality hit than an empty slot.
      result = selectExerciseForSlot(slot, exercises, selection);
    }

    if ("unresolved" in result) {
      warnings.push(`"${dayLabel}": no exercise available for ${slot.role} slot (${slotDescription(slot)}) — ${result.unresolved}`);
      resolved.push({ slot, exercise: null, placeholderName: `Needs manual exercise selection (${slotDescription(slot)})` });
      continue;
    }

    usedToday.add(result.exercise.id);
    resolved.push({ slot, exercise: result.exercise, placeholderName: null });
  }

  return resolved;
}

function toBlockExerciseRow(resolved: ResolvedSlot, position: number, plan: WeekSetPlan): BlockExerciseRow {
  return {
    id: "",
    block_id: "",
    position,
    exercise_id: resolved.exercise?.id ?? null,
    custom_name: resolved.placeholderName,
    notes: null,
    exercise_category: resolved.slot.category,
    // Read straight off the slot the template built this row from — see
    // BlockExercise.autoregulation_eligible's doc comment (supabase/types.ts)
    // for why this is the one place in the generator that needs to set it.
    autoregulation_eligible: resolved.slot.autoregulationEligible,
    sets: [toSetRow(plan, 1)],
  };
}

function toDayRow(day: DayPlan, resolvedSlots: ResolvedSlot[], ctx: WeekContext, position: number): DayRow {
  const blocks: BlockRow[] = day.isRestDay
    ? []
    : resolvedSlots.map((resolved, i) => ({
        id: "",
        day_id: "",
        position: i + 1,
        block_type: "straight",
        block_role: resolved.slot.role,
        rounds: 1,
        exercises: [toBlockExerciseRow(resolved, 1, resolved.slot.prescription.forWeek(ctx))],
      }));

  return { id: "", week_id: "", position, label: day.label, is_rest_day: day.isRestDay, blocks };
}

/**
 * Produces one WeekRow per week from 1..totalWeeks. Every id/week_id/day_id/
 * etc. is a throwaway placeholder, same convention as starter-templates.ts —
 * addWeek generates real ids fresh for whatever WeekRow it's given.
 */
export function assembleWeeks(input: AssembleInput): AssembledProgram {
  const { template, totalWeeks, exercises, selection } = input;
  const warnings: string[] = [];

  // Resolved once, reused for every week — see header comment.
  const resolvedByDay: ResolvedSlot[][] = template.weekStructure.days.map((day) => resolveDaySlots(day, exercises, selection, warnings, day.label));

  const weeks: WeekRow[] = [];
  for (let weekIndex = 1; weekIndex <= totalWeeks; weekIndex++) {
    const ctx = weekContextFor(template, weekIndex, totalWeeks);
    const days: DayRow[] = template.weekStructure.days.map((day, i) => toDayRow(day, resolvedByDay[i]!, ctx, i + 1));
    weeks.push({
      id: "",
      program_id: "",
      position: weekIndex,
      label: `Week ${weekIndex}`,
      based_on_week_id: null,
      created_at: "",
      days,
    });
  }

  return { weeks, warnings: dedupe(warnings) };
}

function dedupe(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
