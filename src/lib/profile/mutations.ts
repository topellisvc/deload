import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileLengthUnit, ProfileMassUnit } from "@/lib/supabase/types";

export interface ProfileUpdate {
  display_name: string | null;
  height_value: number | null;
  height_unit: ProfileLengthUnit | null;
  weight_value: number | null;
  weight_unit: ProfileMassUnit | null;
  goal: string | null;
}

/**
 * Saves the editable fields on /profile in one call. RLS ("profiles are
 * editable by their owner") already permits this — no new policy needed.
 * Doesn't touch role/role_selected; that's a separate, deliberate action
 * (see lib/coaching/mutations.ts:chooseRole), not something bundled into
 * a general profile save.
 */
export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: ProfileUpdate
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  return { error: error ? "Couldn't save your profile. Try again." : null };
}
