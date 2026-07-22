/**
 * Calorie target ("TDEE") and macro estimation.
 *
 * Same philosophy as the 1RM tool: no single BMR formula is "correct" for
 * everyone, so we run multiple published formulas and expose the spread as
 * a confidence range rather than a single falsely precise number.
 *
 * BMR (basal metabolic rate) formulas used:
 *  - Mifflin-St Jeor (1990): the formula most consistently found to be the
 *    most accurate for the general population in modern validation studies
 *    (e.g. Frankenfield et al., 2005) — always used.
 *  - Harris-Benedict (revised 1990 constants): older, still widely cited,
 *    tends to run a little higher than Mifflin-St Jeor — always used
 *    alongside it to form the range.
 *  - Katch-McArdle: uses lean body mass directly instead of estimating it
 *    from height/weight/age, so it's typically more accurate for people
 *    who know their body fat percentage (especially if they're leaner or
 *    more muscular than population averages) — used only when body fat %
 *    is provided.
 *
 * TDEE (total daily energy expenditure) = BMR x an activity multiplier.
 * Activity multipliers are the standard, widely-cited Harris-Benedict-era
 * categories still in common use.
 */

export type Sex = "male" | "female";

export type ActivityLevelId =
  | "sedentary"
  | "light"
  | "moderate"
  | "very_active"
  | "extra_active";

export interface ActivityLevelInfo {
  id: ActivityLevelId;
  label: string;
  multiplier: number;
  description: string;
}

export const ACTIVITY_LEVELS: readonly ActivityLevelInfo[] = [
  {
    id: "sedentary",
    label: "Sedentary",
    multiplier: 1.2,
    description: "Little to no exercise, desk job.",
  },
  {
    id: "light",
    label: "Lightly active",
    multiplier: 1.375,
    description: "Light exercise 1-3 days/week.",
  },
  {
    id: "moderate",
    label: "Moderately active",
    multiplier: 1.55,
    description: "Moderate exercise 3-5 days/week.",
  },
  {
    id: "very_active",
    label: "Very active",
    multiplier: 1.725,
    description: "Hard exercise 6-7 days/week.",
  },
  {
    id: "extra_active",
    label: "Extra active",
    multiplier: 1.9,
    description: "Physical job plus daily training.",
  },
] as const;

export type GoalId = "cut" | "maintain" | "gain";

export interface GoalInfo {
  id: GoalId;
  label: string;
  /** Multiplicative adjustment applied to TDEE to get the calorie target. */
  adjustmentPct: number;
  /** Grams of protein per kg of body weight used for this goal. */
  proteinGPerKg: number;
  description: string;
}

export const GOALS: readonly GoalInfo[] = [
  {
    id: "cut",
    label: "Lose weight",
    adjustmentPct: -0.2,
    proteinGPerKg: 2.2,
    description: "A moderate deficit, sized to lose fat while protecting muscle.",
  },
  {
    id: "maintain",
    label: "Maintain weight",
    adjustmentPct: 0,
    proteinGPerKg: 2.0,
    description: "Eat at your estimated maintenance level.",
  },
  {
    id: "gain",
    label: "Gain weight",
    adjustmentPct: 0.12,
    proteinGPerKg: 1.8,
    description: "A modest surplus, sized to minimize fat gained per pound of muscle.",
  },
] as const;

/** Fraction of total calories allocated to fat — a widely-cited floor for hormonal health. */
export const FAT_PCT_OF_CALORIES = 0.25;

export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function harrisBenedict(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return sex === "male"
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
}

export function katchMcArdle(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

export interface CalorieInputs {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevelId;
  goal: GoalId;
  /** Optional — unlocks the Katch-McArdle formula for a tighter estimate. */
  bodyFatPercent?: number;
}

export interface CalorieResult {
  bmrByFormula: Partial<Record<"mifflinStJeor" | "harrisBenedict" | "katchMcArdle", number>>;
  bmrAverage: number;
  tdeeAverage: number;
  tdeeLow: number;
  tdeeHigh: number;
  calorieTarget: number;
  usedKatchMcArdle: boolean;
}

export function estimateCalorieTarget(inputs: CalorieInputs): CalorieResult {
  const { sex, age, heightCm, weightKg, activityLevel, goal, bodyFatPercent } = inputs;

  if (!Number.isFinite(age) || age <= 0) throw new RangeError("age must be a positive, finite number");
  if (!Number.isFinite(heightCm) || heightCm <= 0)
    throw new RangeError("height must be a positive, finite number");
  if (!Number.isFinite(weightKg) || weightKg <= 0)
    throw new RangeError("weight must be a positive, finite number");

  const activity = ACTIVITY_LEVELS.find((a) => a.id === activityLevel);
  if (!activity) throw new RangeError(`unknown activity level: ${activityLevel}`);
  const goalInfo = GOALS.find((g) => g.id === goal);
  if (!goalInfo) throw new RangeError(`unknown goal: ${goal}`);

  const bmrByFormula: CalorieResult["bmrByFormula"] = {
    mifflinStJeor: mifflinStJeor(sex, weightKg, heightCm, age),
    harrisBenedict: harrisBenedict(sex, weightKg, heightCm, age),
  };

  const usedKatchMcArdle =
    bodyFatPercent !== undefined && Number.isFinite(bodyFatPercent) && bodyFatPercent > 0 && bodyFatPercent < 100;

  if (usedKatchMcArdle) {
    const leanMassKg = weightKg * (1 - bodyFatPercent! / 100);
    bmrByFormula.katchMcArdle = katchMcArdle(leanMassKg);
  }

  const bmrValues = Object.values(bmrByFormula) as number[];
  const bmrAverage = bmrValues.reduce((sum, v) => sum + v, 0) / bmrValues.length;
  const bmrLow = Math.min(...bmrValues);
  const bmrHigh = Math.max(...bmrValues);

  const tdeeAverage = bmrAverage * activity.multiplier;
  const tdeeLow = bmrLow * activity.multiplier;
  const tdeeHigh = bmrHigh * activity.multiplier;

  const calorieTarget = tdeeAverage * (1 + goalInfo.adjustmentPct);

  return {
    bmrByFormula,
    bmrAverage,
    tdeeAverage,
    tdeeLow,
    tdeeHigh,
    calorieTarget,
    usedKatchMcArdle,
  };
}

export interface MacroResult {
  proteinG: number;
  fatG: number;
  carbG: number;
  proteinKcal: number;
  fatKcal: number;
  carbKcal: number;
  /** True when protein + fat alone already consumed the full calorie target, zeroing carbs. */
  carbsClampedToZero: boolean;
}

/**
 * Splits a calorie target into protein/fat/carbs. Protein is set from
 * grams-per-kg-bodyweight (ISSN position-stand range is roughly 1.6-2.2
 * g/kg; we use the goal-appropriate value from GOALS). Fat is a fixed
 * percentage of total calories. Carbs take the remainder.
 *
 * At very low calorie targets or very high body weight, protein + fat can
 * exceed the total target — rather than produce a negative carb number, we
 * clamp carbs to zero and cap fat at whatever calories remain.
 */
export function computeMacros(calorieTarget: number, weightKg: number, goal: GoalId): MacroResult {
  if (!Number.isFinite(calorieTarget) || calorieTarget <= 0)
    throw new RangeError("calorieTarget must be a positive, finite number");
  if (!Number.isFinite(weightKg) || weightKg <= 0)
    throw new RangeError("weightKg must be a positive, finite number");

  const goalInfo = GOALS.find((g) => g.id === goal);
  if (!goalInfo) throw new RangeError(`unknown goal: ${goal}`);

  const proteinG = weightKg * goalInfo.proteinGPerKg;
  const proteinKcal = proteinG * 4;

  const fatKcalTarget = calorieTarget * FAT_PCT_OF_CALORIES;
  const remainingAfterFat = calorieTarget - proteinKcal - fatKcalTarget;

  let fatKcal = fatKcalTarget;
  let carbKcal = remainingAfterFat;
  let carbsClampedToZero = false;

  if (remainingAfterFat < 0) {
    carbsClampedToZero = true;
    carbKcal = 0;
    fatKcal = Math.max(calorieTarget - proteinKcal, 0);
  }

  return {
    proteinG,
    fatG: fatKcal / 9,
    carbG: carbKcal / 4,
    proteinKcal,
    fatKcal,
    carbKcal,
    carbsClampedToZero,
  };
}
