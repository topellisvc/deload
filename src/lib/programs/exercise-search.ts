import { exerciseNamesForCategory, resolveExerciseId } from "@/lib/programs/exercise-catalog";
import type { ExerciseCategory } from "@/lib/programs/types";

export interface ExerciseSearchResult {
  /** Real catalog id when this result resolves to one (strength names that
   * match lib/workout-generator/exercises.ts), null for a suggestion-only
   * name (every running/cardio name today) — same distinction
   * updateBlockExercise's exercise_id/custom_name pair already makes. */
  id: string | null;
  name: string;
  category: ExerciseCategory;
}

/**
 * The single place the Program Builder's exercise search reads from.
 * Merges two sources: the built-in in-memory name lists
 * (lib/programs/exercise-catalog.ts) and, when provided, the signed-in
 * coach's own saved custom exercises (migration 0031's exercise_library —
 * see lib/programs/exercise-library.ts). `library` is a plain array rather
 * than this function querying Supabase itself: ExerciseSearchField's caller
 * (ProgramBuilder) fetches it once per mount and keeps it in local state,
 * so a coach's library doesn't refetch on every keystroke of every search
 * box on the page.
 *
 * Library entries are listed ahead of the built-in suggestions (a coach's
 * own frequently-reused names are more likely to be what they're after)
 * and deduped case-insensitively against them — no reason to show "Bench
 * Press" twice just because it exists in both places. Still returns a
 * Promise: swapping the built-in lists for a real shared/searchable
 * Exercise Library table later only changes this function's body, not its
 * contract or the component that calls it.
 */
export async function searchExercises(
  query: string,
  category: ExerciseCategory,
  library: ExerciseSearchResult[] = []
): Promise<ExerciseSearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  const builtInNames = exerciseNamesForCategory(category);
  const builtIn = builtInNames.map((name) => ({ id: resolveExerciseId(category, name), name, category }));
  const builtInLower = new Set(builtIn.map((r) => r.name.toLowerCase()));
  const ownLibrary = library.filter((entry) => entry.category === category && !builtInLower.has(entry.name.toLowerCase()));

  const merged = [...ownLibrary, ...builtIn];
  const matches = trimmed ? merged.filter((r) => r.name.toLowerCase().includes(trimmed)) : merged;
  return matches.slice(0, 50);
}

/** True when `query` isn't an exact (case-insensitive) match for any
 * existing name in this category — built-in or already in the coach's own
 * library — i.e. there's a real "create custom exercise" action to offer
 * rather than just re-surfacing something that already exists under a
 * different case. */
export function isNewExerciseName(query: string, category: ExerciseCategory, library: ExerciseSearchResult[] = []): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (exerciseNamesForCategory(category).some((name) => name.toLowerCase() === lower)) return false;
  return !library.some((entry) => entry.category === category && entry.name.toLowerCase() === lower);
}
