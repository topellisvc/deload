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
const STRENGTH_NAME_TO_ID = new Map(EXERCISES.map((e) => [e.name.toLowerCase(), e.id]));

/** Only the strength catalog (lib/workout-generator/exercises.ts) has real
 * ids to resolve against — running/cardio names are suggestions only and
 * always land in custom_name, same as any strength name typed that isn't in
 * EXERCISES either. Centralised here (previously a private copy inside
 * ExercisePicker) so the exercise search component reads from the same map
 * this file's other lookups already use. */
export function resolveExerciseId(category: ExerciseCategory, name: string): string | null {
  if (category !== "strength") return null;
  return STRENGTH_NAME_TO_ID.get(name.trim().toLowerCase()) ?? null;
}

/**
 * Resolves a block_exercise's display name. Checked in order:
 * 1. `exercise_name` — a name resolved from the Exercise Library (`public.
 *    exercises`) at fetch time by getProgramTree/getTrainingDayForTraining
 *    (a flat `{id, name}` lookup, same convention as every other level of
 *    those queries — see their header comments). Kept as a plain string
 *    field here rather than an async lookup so this function can stay
 *    synchronous, which every call site (Training Mode, the builder,
 *    workout logging) still relies on.
 * 2. The static strength catalog (lib/workout-generator/exercises.ts) —
 *    covers any block_exercises row whose exercise_id predates the
 *    Exercise Library and hasn't been re-fetched with a joined name yet.
 * 3. `custom_name`, then the raw id, then a final fallback.
 */
export function getExerciseDisplayName(exercise: {
  exercise_id: string | null;
  custom_name: string | null;
  exercise_name?: string | null;
}): string {
  if (exercise.exercise_name) return exercise.exercise_name;
  if (exercise.exercise_id) return STRENGTH_ID_TO_NAME.get(exercise.exercise_id) ?? exercise.custom_name ?? exercise.exercise_id;
  return exercise.custom_name ?? "Exercise";
}
