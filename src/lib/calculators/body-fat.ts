/**
 * Body fat percentage — U.S. Navy circumference method.
 *
 * Estimates body density from a small set of tape-measure circumferences
 * (Hodgdon & Beckett, 1984, Naval Health Research Center), then converts
 * density to body fat percentage using the Siri (1961) equation. This is
 * the most widely validated field method that doesn't require special
 * equipment — not because it's the most accurate method available (DEXA
 * and hydrostatic weighing both beat it), but because it's the most
 * accurate method a person can do at home with a tape measure.
 *
 * Known limitation, stated plainly: published validation studies put this
 * method's error at roughly ±3-4 percentage points of body fat compared to
 * DEXA, and it can be less accurate at the high and low ends of the body
 * fat range. We surface that margin in the UI rather than presenting a
 * single falsely precise number.
 *
 * The original formula was fit using measurements in inches. Some sites
 * apply it to centimeter inputs without converting first, which silently
 * breaks the math (log10 of a physical quantity isn't unit-invariant). We
 * always convert to inches internally before applying the formula,
 * regardless of what unit the person entered.
 */

export type BiologicalSex = "male" | "female";
export type LengthUnit = "cm" | "in";
export type MassUnit = "kg" | "lb";

const CM_TO_IN = 1 / 2.54;
const LB_TO_KG = 1 / 2.2046226218;

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (from === to) return value;
  return from === "cm" ? value * CM_TO_IN : value / CM_TO_IN;
}

export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  if (from === to) return value;
  return from === "kg" ? value / LB_TO_KG : value * LB_TO_KG;
}

export interface BodyFatCategory {
  label: string;
  /** Inclusive lower bound (%), or null for unbounded. */
  min: number | null;
  /** Exclusive upper bound (%), or null for unbounded. */
  max: number | null;
}

// American Council on Exercise (ACE) body fat categorization — the most
// commonly cited general-population reference ranges, published separately
// for men and women since essential fat requirements differ by sex.
export const BODY_FAT_CATEGORIES: Record<BiologicalSex, readonly BodyFatCategory[]> = {
  male: [
    { label: "Essential fat", min: null, max: 6 },
    { label: "Athletes", min: 6, max: 14 },
    { label: "Fitness", min: 14, max: 18 },
    { label: "Average", min: 18, max: 25 },
    { label: "Obese", min: 25, max: null },
  ],
  female: [
    { label: "Essential fat", min: null, max: 14 },
    { label: "Athletes", min: 14, max: 21 },
    { label: "Fitness", min: 21, max: 25 },
    { label: "Average", min: 25, max: 32 },
    { label: "Obese", min: 32, max: null },
  ],
};

/** Published error margin of the Navy method vs. DEXA, from validation studies. */
export const ESTIMATED_ERROR_MARGIN_PCT = 3.5;

export interface BodyFatInputs {
  sex: BiologicalSex;
  /** Height, already normalized to inches. */
  heightIn: number;
  /** Neck circumference, already normalized to inches. */
  neckIn: number;
  /** Waist circumference, already normalized to inches. */
  waistIn: number;
  /** Hip circumference, already normalized to inches. Required for female only. */
  hipIn?: number;
  /** Total body weight, already normalized to kg. Used only for mass breakdown. */
  weightKg: number;
}

export interface BodyFatResult {
  bodyFatPercent: number;
  category: string;
  leanMassKg: number;
  fatMassKg: number;
}

function categoryFor(sex: BiologicalSex, bodyFatPercent: number): string {
  const categories = BODY_FAT_CATEGORIES[sex];
  const match = categories.find(
    (c) => (c.min === null || bodyFatPercent >= c.min) && (c.max === null || bodyFatPercent < c.max)
  );
  return (match ?? categories[categories.length - 1]!).label;
}

/**
 * Estimate body fat percentage from circumference measurements. All length
 * inputs must already be normalized to inches (use convertLength first) and
 * weight to kg (use convertMass first) — keeps this function's math
 * unambiguous rather than juggling units internally.
 */
export function estimateBodyFat(inputs: BodyFatInputs): BodyFatResult {
  const { sex, heightIn, neckIn, waistIn, hipIn, weightKg } = inputs;

  if (![heightIn, neckIn, waistIn, weightKg].every((v) => Number.isFinite(v) && v > 0)) {
    throw new RangeError("height, neck, waist, and weight must be positive, finite numbers");
  }
  if (waistIn <= neckIn) {
    throw new RangeError("waist measurement must be greater than neck measurement");
  }

  let bodyDensity: number;

  if (sex === "male") {
    bodyDensity =
      1.0324 - 0.19077 * Math.log10(waistIn - neckIn) + 0.15456 * Math.log10(heightIn);
  } else {
    if (!hipIn || !Number.isFinite(hipIn) || hipIn <= 0) {
      throw new RangeError("hip measurement is required for the female formula");
    }
    if (waistIn + hipIn <= neckIn) {
      throw new RangeError("waist + hip must be greater than neck measurement");
    }
    bodyDensity =
      1.29579 -
      0.35004 * Math.log10(waistIn + hipIn - neckIn) +
      0.221 * Math.log10(heightIn);
  }

  // Siri equation: converts body density to body fat percentage.
  const bodyFatPercentRaw = 495 / bodyDensity - 450;
  const bodyFatPercent = Math.min(Math.max(bodyFatPercentRaw, 2), 60);

  const fatMassKg = weightKg * (bodyFatPercent / 100);
  const leanMassKg = weightKg - fatMassKg;

  return {
    bodyFatPercent,
    category: categoryFor(sex, bodyFatPercent),
    leanMassKg,
    fatMassKg,
  };
}
