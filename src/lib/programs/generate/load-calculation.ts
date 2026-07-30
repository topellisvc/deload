import { percentOf1RM } from "@/lib/programs/generate/e1rm";
import type { DeloadKind, LoadCalculationMethod, ProgramPhase, SlotPattern, SlotPrescription, WeekContext, WeekSetPlan } from "@/lib/programs/generate/types";
import type { ExerciseCategory } from "@/lib/programs/types";

/**
 * Shared load-calculation dispatch, used by every template that builds
 * RIR-based strength slots (resistance-templates.ts, power-athletic-
 * templates.ts, sport-specific-templates.ts) so the actual conversion math
 * — and its safety guards — lives in exactly one place rather than being
 * re-derived per file. See LoadCalculationMethod's doc comment (types.ts)
 * for what each method means to the athlete; this file is just the
 * mechanical "take an already-built RIR prescription and reshape it"
 * layer, same principle resistance-templates.ts's own header comment states
 * for percent_1rm specifically: a shape conversion at the end of the
 * pipeline, not a second programming-science table.
 */

/** Only these four patterns have a matching lib/profile/personal-records.ts
 * record type — %1RM methods can only ever apply to a main lift on one of
 * these; every other slot (accessories, secondary compounds, or a main
 * lift on any other pattern) keeps its normal RIR-based prescription
 * regardless of the chosen method, since there's nothing to compute a
 * percentage of. */
export const TRACKABLE_PATTERN_LIFT_LABEL: Partial<Record<SlotPattern, string>> = {
  squat_bilateral: "Squat",
  horizontal_push: "Bench Press",
  hinge_bilateral: "Deadlift",
  vertical_push: "Overhead Press",
};

/** The single integer (reps, RIR) pair a WeekSetPlan actually targets, for
 * feeding into e1rm.ts's percentOf1RM. Every RIR-based plan these templates
 * produce has an integer rir and either a bare reps count or a minReps —
 * when a plan gives a range (minReps/maxReps differ), this reads the
 * bottom of it, matching the templates' own "default to the bottom of a
 * range" convention. */
function targetRepsAndRir(plan: WeekSetPlan): { reps: number; rir: number } | null {
  const repsFromRange = plan.minReps ?? (plan.reps != null ? Number(plan.reps) : null);
  if (repsFromRange == null || plan.rir == null) return null;
  if (!Number.isInteger(repsFromRange) || !Number.isInteger(plan.rir)) return null;
  return { reps: repsFromRange, rir: plan.rir };
}

/** A shared reps label for the methods that drop the RIR/percent target
 * entirely (coach_entered, athlete_choice) but still need to say how many
 * reps the set is for. */
function repsLabel(plan: WeekSetPlan): string | null {
  if (plan.reps != null) return plan.reps;
  if (plan.minReps != null && plan.maxReps != null) return plan.minReps === plan.maxReps ? String(plan.minReps) : `${plan.minReps}-${plan.maxReps}`;
  if (plan.minReps != null) return String(plan.minReps);
  return null;
}

/** Converts an already-resolved RIR-based plan to a percent_1rm plan, using
 * the exact reps/RIR target that plan already carries — see e1rm.ts's
 * percentOf1RM (the same table §8's volume counting and the runtime RIR
 * gate already use, not a separate percentage scheme invented here). Falls
 * back to returning the plan unchanged (still RIR-based) when a target
 * can't be read from it or falls outside the table's range — fails open to
 * the always-safe default rather than emitting a percent_1rm row with
 * nothing to compute. */
function toPercent1RMPlan(plan: WeekSetPlan): WeekSetPlan {
  const target = targetRepsAndRir(plan);
  if (!target) return plan;
  const percent = percentOf1RM(target.reps, target.rir);
  if (percent == null) return plan;
  return { ...plan, prescriptionType: "percent_1rm", percent1RM: percent, rir: undefined, rpe: undefined };
}

function asPercent1RM(base: SlotPrescription): SlotPrescription {
  return { forWeek: (ctx) => toPercent1RMPlan(base.forWeek(ctx)) };
}

/** The testing week's own prescription for whichever trackable main lift a
 * slot represents — one graded top set rather than the usual multi-set
 * prescription (WeekSetPlan has one `sets` count; the warm-up sets leading
 * into the graded set are described in notes rather than modeled as
 * structured data). 5 reps at RIR 1 — not a true 1-3 rep max attempt — is
 * deliberate: further from a true failure event, and still squarely inside
 * e1rm.ts's reliable range. */
function testingProtocolPlan(liftLabel: string): WeekSetPlan {
  return {
    prescriptionType: "rir",
    sets: 1,
    reps: "5",
    rir: 1,
    restSeconds: 180,
    notes: `Testing week — warm up gradually, then work up to one hard set of 5 reps on the ${liftLabel} with about 1 rep left in the tank. Log the weight and reps here, then save it as your ${liftLabel} max on your profile — that's what the rest of this program's weights are calculated from.`,
  };
}

function asTestThenPercent1RM(base: SlotPrescription, liftLabel: string): SlotPrescription {
  return {
    forWeek(ctx: WeekContext): WeekSetPlan {
      if (ctx.phase === "testing") return testingProtocolPlan(liftLabel);
      return toPercent1RMPlan(base.forWeek(ctx));
    },
  };
}

/** assemble.ts's toSetRow always leaves weight_value null regardless of
 * prescriptionType (see its own doc comment on why) — so a coach_entered
 * slot needs no weight field here at all, just the right prescriptionType
 * and reps for a coach to fill a weight in against later. */
function asCoachEntered(base: SlotPrescription): SlotPrescription {
  return {
    forWeek(ctx) {
      const plan = base.forWeek(ctx);
      return { ...plan, prescriptionType: "fixed_weight", reps: repsLabel(plan), percent1RM: undefined, rir: undefined, rpe: undefined };
    },
  };
}

function asAthleteChoice(base: SlotPrescription): SlotPrescription {
  return {
    forWeek(ctx) {
      const plan = base.forWeek(ctx);
      return { ...plan, prescriptionType: "athlete_chooses_weight", reps: repsLabel(plan), percent1RM: undefined, rir: undefined, rpe: undefined };
    },
  };
}

/** Applies ProgramGenerationInput.loadCalculationMethod to one slot's
 * already-built prescription.
 *
 * The category guard exists because coach_entered/athlete_choice/
 * percent_1rm's fixed_weight/athlete_chooses_weight/percent_1rm
 * prescriptionTypes are strength-only (prescription-types.ts, mirroring the
 * DB's set_prescriptions_valid_type trigger) — a template that mixes
 * strength slots with running/cardio slots on the same day (power-athletic-
 * templates.ts's sprint slot) would trip that trigger if this function
 * blindly converted every slot regardless of category. Every method other
 * than autoregulated_rir short-circuits to the base prescription, unchanged,
 * for any non-strength slot.
 *
 * coach_entered/athlete_choice then apply to every remaining (strength)
 * slot in the day — there's no reason to restrict "let a human pick the
 * number" to just the trackable lifts. The two %1RM methods only ever apply
 * to a primary slot on a trackable pattern (see TRACKABLE_PATTERN_LIFT_LABEL);
 * every other strength slot keeps its normal RIR-based prescription no
 * matter which method was chosen. */
export function applyLoadCalculationMethod(
  base: SlotPrescription,
  method: LoadCalculationMethod,
  isPrimary: boolean,
  pattern: SlotPattern | null,
  category: ExerciseCategory
): SlotPrescription {
  if (category !== "strength") return base;

  if (method === "coach_entered") return asCoachEntered(base);
  if (method === "athlete_choice") return asAthleteChoice(base);

  const liftLabel = isPrimary && pattern ? TRACKABLE_PATTERN_LIFT_LABEL[pattern] : undefined;
  if (!liftLabel) return base;

  if (method === "percent_1rm") return asPercent1RM(base);
  if (method === "test_then_percent_1rm") return asTestThenPercent1RM(base, liftLabel);
  return base; // autoregulated_rir — unchanged
}

/** Inserts one "testing" week before a template's normal week 1, shifting
 * every existing week (including any scheduled deload/calibration weeks) up
 * by one position — a requested 8-week program becomes 9 real weeks. Only
 * called for test_then_percent_1rm; see that LoadCalculationMethod value's
 * doc comment for why it's the one method that changes a program's actual
 * length. */
export function withTestingWeek(
  phaseByWeek: Map<number, ProgramPhase>,
  deloadWeeks: Map<number, DeloadKind>
): { phaseByWeek: Map<number, ProgramPhase>; deloadWeeks: Map<number, DeloadKind> } {
  const shiftedPhaseByWeek = new Map<number, ProgramPhase>([[1, "testing"]]);
  for (const [week, phase] of phaseByWeek) shiftedPhaseByWeek.set(week + 1, phase);

  const shiftedDeloadWeeks = new Map<number, DeloadKind>();
  for (const [week, kind] of deloadWeeks) shiftedDeloadWeeks.set(week + 1, kind);

  return { phaseByWeek: shiftedPhaseByWeek, deloadWeeks: shiftedDeloadWeeks };
}
