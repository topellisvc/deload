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

const STRENGTH_ID_TO_NAME = new Map(EXERCISES.map((e) => [e.id, e.name]));

/** Resolves a block_exercise's display name — exercise_id looks up the
 * strength catalog (lib/workout-generator/exercises.ts), custom_name is
 * used verbatim otherwise. Extracted from what used to be a private map
 * inside ExercisePicker so every place that renders an exercise's name
 * (the program builder, workout logging, Training Mode) resolves it the
 * same way instead of a couple of call sites showing the raw id. */
export function getExerciseDisplayName(exercise: { exercise_id: string | null; custom_name: string | null }): string {
  if (exercise.exercise_id) return STRENGTH_ID_TO_NAME.get(exercise.exercise_id) ?? exercise.custom_name ?? exercise.exercise_id;
  return exercise.custom_name ?? "Exercise";
}
