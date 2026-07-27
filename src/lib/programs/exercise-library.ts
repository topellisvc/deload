import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExerciseCategory } from "@/lib/programs/types";

export interface ExerciseLibraryEntry {
  id: string;
  owner_id: string;
  name: string;
  category: ExerciseCategory;
  created_at: string;
}

/**
 * A coach's saved custom exercises (migration 0031) — everything they've
 * typed into the exercise search that isn't in the built-in strength
 * catalog or the running/cardio suggestion lists. Fetched once when the
 * Program Builder mounts (see ProgramBuilder's own effect) rather than
 * per-keystroke; it's one small per-owner list, not worth a live query on
 * every search-box character.
 */
export async function getExerciseLibrary(supabase: SupabaseClient, ownerId: string): Promise<ExerciseLibraryEntry[]> {
  const { data, error } = await supabase
    .from("exercise_library")
    .select("*")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as ExerciseLibraryEntry[];
}

/**
 * Saves a newly-typed custom exercise name to the coach's library so it
 * shows up as a real search result next time, in this program and every
 * other one they build — the whole point of "Create" being a distinct
 * action from just typing a one-off custom_name. `on conflict do nothing`
 * (via the (owner_id, category, name) unique constraint) makes re-creating
 * the same name a harmless no-op rather than a duplicate-key error — the
 * caller (ExerciseSearchField's create flow) can't easily know in advance
 * whether a case-different variant already slipped through.
 */
export async function addToExerciseLibrary(
  supabase: SupabaseClient,
  params: { ownerId: string; name: string; category: ExerciseCategory }
): Promise<{ entry: ExerciseLibraryEntry | null; error: string | null }> {
  const { data, error } = await supabase
    .from("exercise_library")
    .upsert(
      { owner_id: params.ownerId, name: params.name, category: params.category },
      { onConflict: "owner_id,category,name", ignoreDuplicates: true }
    )
    .select()
    .maybeSingle();

  if (error) return { entry: null, error: "Couldn't save that exercise to your library." };
  // ignoreDuplicates means an actual duplicate resolves with no row back —
  // not an error, just nothing new to report (the entry already exists).
  return { entry: (data as ExerciseLibraryEntry | null) ?? null, error: null };
}
