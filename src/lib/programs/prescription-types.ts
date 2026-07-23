import type { CardioPrescriptionType, ExerciseCategory, PrescriptionType, RunningPrescriptionType, StrengthPrescriptionType } from "@/lib/programs/types";

/**
 * The single declarative source of truth for "given this exercise category
 * and prescription type, which fields actually matter" — every place that
 * needs to know this (the program builder's set-row editors, the read-only
 * SetDetails prescription display, and the workout-logging Performance
 * form) reads from here instead of running its own `if (type === 'x')`
 * chain. Adding a new prescription type later means adding one entry here,
 * not touching N components — this is what "avoid hardcoded logic around
 * individual prescription types" means in practice.
 *
 * `prescriptionFields` drives what the coach sees while programming.
 * `performanceFields` drives what the athlete sees while logging what
 * actually happened — deliberately a separate list, since what's worth
 * planning (e.g. a target RPE) isn't always what's worth recording (the
 * athlete logs the weight and reps they actually used, not a copy of the
 * target).
 */

export type PrescriptionField =
  | "sets"
  | "reps"
  | "rep_range"
  | "weight"
  | "percent_1rm"
  | "rpe"
  | "rir"
  | "rest"
  | "distance"
  | "duration"
  | "pace"
  | "heart_rate_zone"
  | "calories"
  | "notes"
  | "notes_primary";

export type PerformanceField =
  | "weight"
  | "reps"
  | "rpe"
  | "distance"
  | "duration"
  | "pace"
  | "heart_rate"
  | "calories"
  | "notes";

export interface PrescriptionTypeDef {
  value: PrescriptionType;
  label: string;
  /** Short example shown in the type picker, matching the product spec's own examples. */
  example: string;
  prescriptionFields: PrescriptionField[];
  performanceFields: PerformanceField[];
}

const STRENGTH_TYPES: PrescriptionTypeDef[] = [
  {
    value: "fixed_weight",
    label: "Fixed Weight",
    example: "4 × 6 @ 100kg",
    prescriptionFields: ["sets", "reps", "weight", "rest"],
    performanceFields: ["weight", "reps", "rpe", "notes"],
  },
  {
    value: "percent_1rm",
    label: "% of 1RM",
    example: "4 × 6 @ 80% 1RM",
    prescriptionFields: ["sets", "reps", "percent_1rm", "rest"],
    performanceFields: ["weight", "reps", "rpe", "notes"],
  },
  {
    value: "rpe",
    label: "RPE",
    example: "3 × 8 @ RPE 8",
    prescriptionFields: ["sets", "reps", "rpe", "rest"],
    performanceFields: ["weight", "reps", "rpe", "notes"],
  },
  {
    value: "rir",
    label: "RIR",
    example: "3 × 8 @ 2 RIR",
    prescriptionFields: ["sets", "reps", "rir", "rest"],
    performanceFields: ["weight", "reps", "rpe", "notes"],
  },
  {
    value: "rep_range",
    label: "Rep Range",
    example: "3 × 6–8 reps",
    prescriptionFields: ["sets", "rep_range", "rest", "notes"],
    performanceFields: ["weight", "reps", "notes"],
  },
  {
    value: "athlete_chooses_weight",
    label: "Athlete Chooses Weight",
    example: "3 × 10, your call on load",
    prescriptionFields: ["sets", "reps", "rest", "notes"],
    performanceFields: ["weight", "reps", "rpe", "notes"],
  },
  {
    value: "coach_notes_only",
    label: "Coach Notes Only",
    example: "“Work up to a challenging set.”",
    prescriptionFields: ["notes_primary"],
    performanceFields: ["weight", "reps", "rpe", "notes"],
  },
];

const RUNNING_TYPES: PrescriptionTypeDef[] = [
  {
    value: "distance",
    label: "Distance",
    example: "5km",
    prescriptionFields: ["distance", "rest"],
    performanceFields: ["distance", "duration", "pace", "heart_rate", "rpe", "notes"],
  },
  {
    value: "time",
    label: "Time",
    example: "30 minutes",
    prescriptionFields: ["duration", "rest"],
    performanceFields: ["distance", "duration", "pace", "heart_rate", "rpe", "notes"],
  },
  {
    value: "distance_time",
    label: "Distance + Time",
    example: "5km in 25:00",
    prescriptionFields: ["distance", "duration", "rest"],
    performanceFields: ["distance", "duration", "pace", "heart_rate", "rpe", "notes"],
  },
  {
    value: "pace",
    label: "Pace",
    example: "5:00 /km",
    prescriptionFields: ["pace", "rest"],
    performanceFields: ["distance", "duration", "pace", "heart_rate", "rpe", "notes"],
  },
  {
    value: "heart_rate_zone",
    label: "Heart Rate Zone",
    example: "30 minutes Zone 2",
    prescriptionFields: ["duration", "heart_rate_zone", "rest"],
    performanceFields: ["distance", "duration", "pace", "heart_rate", "rpe", "notes"],
  },
  {
    value: "rpe",
    label: "RPE",
    example: "25 minutes @ RPE 6",
    prescriptionFields: ["duration", "rpe", "rest"],
    performanceFields: ["distance", "duration", "pace", "heart_rate", "rpe", "notes"],
  },
  {
    value: "intervals",
    label: "Intervals",
    example: "6 × 400m",
    prescriptionFields: ["sets", "distance", "duration", "rest"],
    performanceFields: ["distance", "duration", "pace", "heart_rate", "rpe", "notes"],
  },
  {
    value: "coach_notes",
    label: "Coach Notes",
    example: "“Easy recovery effort.”",
    prescriptionFields: ["notes_primary"],
    performanceFields: ["distance", "duration", "pace", "heart_rate", "rpe", "notes"],
  },
];

const CARDIO_TYPES: PrescriptionTypeDef[] = [
  {
    value: "time",
    label: "Time",
    example: "20 minutes",
    prescriptionFields: ["duration", "rest"],
    performanceFields: ["duration", "distance", "calories", "heart_rate", "pace", "rpe", "notes"],
  },
  {
    value: "distance",
    label: "Distance",
    example: "5km cycle",
    prescriptionFields: ["distance", "rest"],
    performanceFields: ["duration", "distance", "calories", "heart_rate", "pace", "rpe", "notes"],
  },
  {
    value: "calories",
    label: "Calories",
    example: "20 calories, Assault Bike",
    prescriptionFields: ["calories", "rest"],
    performanceFields: ["duration", "distance", "calories", "heart_rate", "pace", "rpe", "notes"],
  },
  {
    value: "heart_rate_zone",
    label: "Heart Rate Zone",
    example: "20 minutes Zone 3",
    prescriptionFields: ["duration", "heart_rate_zone", "rest"],
    performanceFields: ["duration", "distance", "calories", "heart_rate", "pace", "rpe", "notes"],
  },
  {
    value: "rpe",
    label: "RPE",
    example: "25 minutes @ RPE 6",
    prescriptionFields: ["duration", "rpe", "rest"],
    performanceFields: ["duration", "distance", "calories", "heart_rate", "pace", "rpe", "notes"],
  },
  {
    value: "coach_notes",
    label: "Coach Notes",
    example: "“Maintain conversational pace.”",
    prescriptionFields: ["notes_primary"],
    performanceFields: ["duration", "distance", "calories", "heart_rate", "pace", "rpe", "notes"],
  },
];

/**
 * Category -> its allowed prescription types, in the order shown in the
 * builder's type picker. Mirrors the check enforced server-side by the
 * `set_prescriptions_valid_type` trigger (migration 0012) — that trigger
 * is the real guarantee, this is what keeps the UI from ever offering a
 * combination the database would reject.
 */
export const PRESCRIPTION_TYPES_BY_CATEGORY: Record<ExerciseCategory, PrescriptionTypeDef[]> = {
  strength: STRENGTH_TYPES,
  running: RUNNING_TYPES,
  cardio: CARDIO_TYPES,
};

const ALL_TYPES = [...STRENGTH_TYPES, ...RUNNING_TYPES, ...CARDIO_TYPES];

/** Dedupe by value for cross-category lookups below — 'rpe' and
 * 'coach_notes'/'coach_notes_only' each appear in more than one category's
 * list above but should resolve to a single definition when looked up by
 * (category, type) rather than by value alone. */
export function getPrescriptionTypeDef(category: ExerciseCategory, type: PrescriptionType): PrescriptionTypeDef | undefined {
  return PRESCRIPTION_TYPES_BY_CATEGORY[category].find((t) => t.value === type);
}

/** Sensible starting type for a freshly-created exercise in this category —
 * the least surprising thing to default to before the coach picks something more specific. */
export function defaultPrescriptionType(category: ExerciseCategory): PrescriptionType {
  return PRESCRIPTION_TYPES_BY_CATEGORY[category][0]!.value;
}

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: "Strength",
  running: "Running",
  cardio: "Cardio",
};

export type { StrengthPrescriptionType, RunningPrescriptionType, CardioPrescriptionType };

/**
 * The suggested working weight for a 'percent_1rm' prescription — computed
 * fresh from the athlete's *current* stored 1RM every time it's needed
 * (program builder preview, workout logging) rather than persisted on the
 * prescription row. Persisting it would mean either it goes stale the
 * moment the athlete updates their 1RM, or every PR update would need to
 * cascade out and rewrite every prescription that referenced it — a
 * derived value has no business being stored. Rounded to 1 decimal (the
 * loading increments athletes actually use, e.g. 0.5kg microplates).
 */
export function suggestedWeightFromPercent1RM(percent: number | null, oneRepMax: number | null): number | null {
  if (percent == null || oneRepMax == null) return null;
  return Math.round(oneRepMax * (percent / 100) * 10) / 10;
}

// Referenced for exhaustiveness only — keeps ALL_TYPES from being flagged unused
// while remaining available for future cross-category lookups (e.g. a search box).
export { ALL_TYPES };
