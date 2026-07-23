import { EXERCISES } from "@/lib/workout-generator/exercises";
import type { ExerciseCategory } from "@/lib/programs/types";

/**
 * Name suggestions for the program builder's exercise picker, one list per
 * category. Deliberately separate from lib/workout-generator/exercises.ts
 * (EXERCISES): that list carries pattern/equipment/isCompound fields the
 * quick-workout generator's algorithm needs and running/cardio exercises
 * have no equivalent for, so bolting a "category" onto it would mean
 * either fake values on every non-strength row or an awkward optional-field
 * schema. Two focused lists is simpler than one overloaded one — this file
 * only ever feeds a plain name datalist (see ExercisePicker), nothing
 * downstream needs the metadata that file has.
 *
 * Strength keeps using EXERCISES directly (unchanged, preserves every
 * existing suggestion); this file only adds the two new lists.
 */
export const RUNNING_EXERCISE_NAMES: readonly string[] = [
  "Easy Run",
  "Tempo Run",
  "Long Run",
  "Intervals",
  "Recovery Run",
  "Fartlek",
  "Hill Repeats",
  "Progression Run",
];

export const CARDIO_EXERCISE_NAMES: readonly string[] = [
  "Assault Bike",
  "Row Erg",
  "Ski Erg",
  "Cycling",
  "Swimming",
  "Walking",
  "Hiking",
  "Stair Climber",
  "Elliptical",
  "Battle Ropes",
  "Farmer Carries",
  "Sled Push",
  "Jump Rope",
];

/** Names to suggest in the picker for a given category — the strength case
 * reuses the existing curated database as-is (see file header). */
export function exerciseNamesForCategory(category: ExerciseCategory): readonly string[] {
  if (category === "strength") return EXERCISES.map((e) => e.name);
  if (category === "running") return RUNNING_EXERCISE_NAMES;
  return CARDIO_EXERCISE_NAMES;
}
