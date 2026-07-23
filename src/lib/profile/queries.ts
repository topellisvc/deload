import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase/types";

/** The signed-in user's full profile row, including the personal details
 * shown/edited on /profile. Falls back to a minimal default rather than
 * throwing if the row is somehow missing — the on_auth_user_created
 * trigger always creates one, so this should never actually happen. */
export async function getMyProfileDetails(supabase: SupabaseClient, userId: string): Promise<Profile> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>();
  return (
    data ?? {
      id: userId,
      role: "athlete",
      role_selected: false,
      display_name: null,
      height_value: null,
      height_unit: null,
      weight_value: null,
      weight_unit: null,
      goal: null,
      created_at: new Date().toISOString(),
    }
  );
}

export interface ProfileStats {
  programCount: number;
  sessionCount: number;
  /** Only meaningful for coaches — null when not fetched (see getMyStats). */
  activeClientCount: number | null;
}

/**
 * Read-only activity counts shown alongside the editable profile fields.
 * Each is a plain `eq(...)` count query scoped to the signed-in user, so
 * RLS (already restricting every one of these tables to owner/athlete/
 * coach) permits it the same way it would a normal page load — no
 * special-casing needed here.
 */
export async function getMyStats(
  supabase: SupabaseClient,
  userId: string,
  role: "athlete" | "coach"
): Promise<ProfileStats> {
  const [programsResult, sessionsResult, clientsResult] = await Promise.all([
    supabase.from("programs").select("id", { count: "exact", head: true }).eq("athlete_id", userId),
    supabase.from("session_logs").select("id", { count: "exact", head: true }).eq("athlete_id", userId),
    role === "coach"
      ? supabase
          .from("coach_clients")
          .select("id", { count: "exact", head: true })
          .eq("coach_id", userId)
          .eq("status", "active")
      : Promise.resolve({ count: null }),
  ]);

  return {
    programCount: programsResult.count ?? 0,
    sessionCount: sessionsResult.count ?? 0,
    activeClientCount: role === "coach" ? (clientsResult.count ?? 0) : null,
  };
}
