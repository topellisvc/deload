/**
 * One-Rep Max (1RM) estimation.
 *
 * Every published sub-maximal 1RM formula is a regression fit to a specific
 * population (often trained male lifters doing barbell squat/bench/deadlift),
 * so no single formula is "correct" — they diverge, and the divergence grows
 * with rep count. Rather than presenting one falsely precise number, we run
 * multiple formulas and expose the spread as a confidence range. This is the
 * honest way to represent estimation uncertainty to the user.
 *
 * All formulas assume a genuine, technically-sound set taken close to
 * failure (roughly 0-2 reps in reserve). Estimates are only reliable up to
 * about 10-12 reps; beyond that, fatigue and technique breakdown dominate
 * and every formula's error grows sharply.
 */

export type FormulaId =
  | "epley"
  | "brzycki"
  | "lombardi"
  | "mcglothin"
  | "wathen";

export interface FormulaDefinition {
  id: FormulaId;
  label: string;
  /** Short attribution/description shown in the UI for trust & transparency. */
  description: string;
  calculate: (weight: number, reps: number) => number;
}

export const FORMULAS: readonly FormulaDefinition[] = [
  {
    id: "epley",
    label: "Epley",
    description: "The most widely used formula; tends to run slightly high at higher rep counts.",
    calculate: (w, r) => w * (1 + r / 30),
  },
  {
    id: "brzycki",
    label: "Brzycki",
    description: "Popular in strength coaching; tends to run slightly low at higher rep counts.",
    calculate: (w, r) => w * (36 / (37 - r)),
  },
  {
    id: "lombardi",
    label: "Lombardi",
    description: "A power-curve model; behaves differently at very low vs. high reps.",
    calculate: (w, r) => w * Math.pow(r, 0.1),
  },
  {
    id: "mcglothin",
    label: "McGlothin",
    description: "Derived from powerlifting competition data.",
    calculate: (w, r) => (100 * w) / (101.3 - 2.67123 * r),
  },
  {
    id: "wathen",
    label: "Wathen",
    description: "Derived from powerlifting competition data using an exponential fit.",
    calculate: (w, r) => (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r)),
  },
] as const;

export const MIN_REPS = 1;
export const MAX_REPS = 20;
/** Beyond this rep count, formula error grows fast enough to warn the user. */
export const RELIABLE_REP_CEILING = 12;

export interface OneRepMaxEstimate {
  /** Result per formula, rounded to the nearest display unit. */
  byFormula: Record<FormulaId, number>;
  /** Mean across all formulas — the headline estimate. */
  average: number;
  /** Lowest and highest formula results — the honest confidence range. */
  low: number;
  high: number;
  /** True once reps exceed the range where estimates stay reliable. */
  isLowConfidence: boolean;
}

/**
 * Estimate 1RM from a single set of (weight, reps) using every formula,
 * returning both the individual results and an aggregate confidence range.
 */
export function estimateOneRepMax(weight: number, reps: number): OneRepMaxEstimate {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new RangeError("weight must be a positive, finite number");
  }
  if (!Number.isInteger(reps) || reps < MIN_REPS || reps > MAX_REPS) {
    throw new RangeError(`reps must be an integer between ${MIN_REPS} and ${MAX_REPS}`);
  }

  // A true 1-rep set has no estimation error — every formula collapses to
  // the lifted weight itself, so skip the formulas entirely.
  if (reps === 1) {
    const byFormula = Object.fromEntries(
      FORMULAS.map((f) => [f.id, weight])
    ) as Record<FormulaId, number>;
    return { byFormula, average: weight, low: weight, high: weight, isLowConfidence: false };
  }

  const byFormula = Object.fromEntries(
    FORMULAS.map((f) => [f.id, f.calculate(weight, reps)])
  ) as Record<FormulaId, number>;

  const values = Object.values(byFormula);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  const low = Math.min(...values);
  const high = Math.max(...values);

  return {
    byFormula,
    average,
    low,
    high,
    isLowConfidence: reps > RELIABLE_REP_CEILING,
  };
}

export type TrainingZone =
  | "Max Strength"
  | "Strength"
  | "Strength & Hypertrophy"
  | "Hypertrophy"
  | "Muscular Endurance";

export interface TrainingTableRow {
  percentage: number;
  weight: number;
  /** Typical rep range lifters can perform at this %1RM, near failure. */
  repRange: string;
  zone: TrainingZone;
}

/**
 * Reference %1RM -> typical-rep-range mapping, at 5% increments.
 * Widely-cited approximation (NSCA-style load/rep relationship). Reps
 * become an increasingly rough estimate below ~60%, which is disclosed
 * in the UI rather than hidden behind false precision.
 */
const REP_RANGE_BY_PERCENTAGE: Record<number, string> = {
  100: "1",
  95: "2",
  90: "3–4",
  85: "5–6",
  80: "7–8",
  75: "9–10",
  70: "11–12",
  65: "13–15",
  60: "16–18",
  55: "19–22",
  50: "22+",
};

function zoneForPercentage(percentage: number): TrainingZone {
  if (percentage >= 90) return "Max Strength";
  if (percentage >= 80) return "Strength";
  if (percentage >= 70) return "Strength & Hypertrophy";
  if (percentage >= 60) return "Hypertrophy";
  return "Muscular Endurance";
}

/**
 * Build a percentage-based training table from an estimated 1RM, in 5%
 * increments from 50% to 100% — the actionable output that turns a single
 * number into a usable training decision.
 */
export function generateTrainingTable(oneRepMax: number): TrainingTableRow[] {
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0) {
    throw new RangeError("oneRepMax must be a positive, finite number");
  }

  const rows: TrainingTableRow[] = [];
  for (let percentage = 100; percentage >= 50; percentage -= 5) {
    rows.push({
      percentage,
      weight: (oneRepMax * percentage) / 100,
      repRange: REP_RANGE_BY_PERCENTAGE[percentage] ?? "—",
      zone: zoneForPercentage(percentage),
    });
  }
  return rows;
}

export type WeightUnit = "kg" | "lb";

const KG_TO_LB = 2.2046226218;

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === "kg" ? value * KG_TO_LB : value / KG_TO_LB;
}

/** Round to the nearest practical increment for display (e.g. plate math). */
export function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}
