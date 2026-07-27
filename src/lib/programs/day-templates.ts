import type { SupabaseClient } from "@supabase/supabase-js";
import type { DayRow, DayTemplateRow } from "@/lib/programs/types";

/**
 * A coach's saved day templates, newest first — fetched once when the
 * Program Builder mounts alongside the exercise library/templates, not
 * per-render.
 */
export async function getDayTemplates(supabase: SupabaseClient, ownerId: string): Promise<DayTemplateRow[]> {
  const { data, error } = await supabase
    .from("day_templates")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as DayTemplateRow[];
}

/**
 * Snapshots one training day's blocks (Warm-up, Main, Conditioning — every
 * section, not just the main workout) into a reusable template — see
 * DayTemplateRow's doc comment for why this stores the day's live
 * `blocks: BlockRow[]` as-is.
 */
export async function saveDayAsTemplate(
  supabase: SupabaseClient,
  params: { ownerId: string; name: string; day: DayRow }
): Promise<{ template: DayTemplateRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("day_templates")
    .insert({
      owner_id: params.ownerId,
      name: params.name,
      template_data: { blocks: params.day.blocks },
    })
    .select()
    .single<DayTemplateRow>();

  if (error) return { template: null, error: "Couldn't save this day as a template. Try again." };
  return { template: data, error: null };
}

export async function deleteDayTemplate(supabase: SupabaseClient, templateId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("day_templates").delete().eq("id", templateId);
  return { error: error ? "Couldn't delete this template. Try again." : null };
}
