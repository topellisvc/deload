import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockExerciseRow, ExerciseTemplateRow } from "@/lib/programs/types";

/**
 * A coach's saved exercise templates, newest first — fetched once when the
 * Program Builder mounts alongside the exercise library (see
 * ProgramBuilder's own effect), not per-render: it's one small per-owner
 * list.
 */
export async function getExerciseTemplates(supabase: SupabaseClient, ownerId: string): Promise<ExerciseTemplateRow[]> {
  const { data, error } = await supabase
    .from("exercise_templates")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as ExerciseTemplateRow[];
}

/**
 * Snapshots one exercise's full prescription (every set row, notes, and
 * all) into a reusable template — see ExerciseTemplateRow's doc comment
 * for why this stores the whole live `BlockExerciseRow` as-is rather than
 * a purpose-built subset shape.
 */
export async function saveExerciseAsTemplate(
  supabase: SupabaseClient,
  params: { ownerId: string; name: string; exercise: BlockExerciseRow }
): Promise<{ template: ExerciseTemplateRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("exercise_templates")
    .insert({
      owner_id: params.ownerId,
      name: params.name,
      exercise_category: params.exercise.exercise_category,
      template_data: params.exercise,
    })
    .select()
    .single<ExerciseTemplateRow>();

  if (error) return { template: null, error: "Couldn't save this as a template. Try again." };
  return { template: data, error: null };
}

export async function deleteExerciseTemplate(supabase: SupabaseClient, templateId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercise_templates").delete().eq("id", templateId);
  return { error: error ? "Couldn't delete this template. Try again." : null };
}
