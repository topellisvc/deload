import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachClient, UserRole } from "@/lib/supabase/types";

/**
 * The signed-in user's own role — gates whether they can see/use the
 * Clients page (coaching is the paid tier; self-programming is free for
 * everyone). Falls back to 'athlete' (the safe default) if the profile
 * row is somehow missing, rather than throwing — the on_auth_user_created
 * trigger always creates one, so this should never actually happen.
 */
export async function getMyRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle<{ role: UserRole }>();
  return data?.role ?? "athlete";
}

/** Everyone this user has invited as a client (pending + active), newest first. */
export async function getMyClients(supabase: SupabaseClient, coachId: string): Promise<CoachClient[]> {
  const { data } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CoachClient[];
}

/** Coaches this user has an accepted relationship with, newest first. */
export async function getMyCoaches(supabase: SupabaseClient, clientId: string): Promise<CoachClient[]> {
  const { data } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CoachClient[];
}

/**
 * Resolves any invite(s) addressed to this user's email that haven't been
 * linked to their account yet, filling in client_id and flipping the row
 * to 'active'. This is necessary because a coach only knows a client's
 * email at invite time, before that person necessarily has an account —
 * see the migration comment in 0003_coach_clients.sql for why (no
 * service-role key / admin API available to pre-create accounts).
 *
 * Call this once per sign-in (safe to call on every page load — the
 * `client_id is null` filter makes it a no-op after the first time).
 */
export async function resolvePendingInvites(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<void> {
  // Lowercase to match how client_email is always stored (see
  // inviteClient) — auth.users.email isn't guaranteed lowercase for
  // someone who signed up before ever being invited. The RLS policy on
  // this update does the same lower() comparison, so this is belt and
  // suspenders, not the only place this matters.
  await supabase
    .from("coach_clients")
    .update({ client_id: userId, status: "active" })
    .ilike("client_email", email.toLowerCase())
    .is("client_id", null);
}

/** The coach's email for one specific coach->client relationship, if it exists. */
export async function getCoachEmail(
  supabase: SupabaseClient,
  params: { coachId: string; clientId: string }
): Promise<string | null> {
  const { data } = await supabase
    .from("coach_clients")
    .select("coach_email")
    .eq("coach_id", params.coachId)
    .eq("client_id", params.clientId)
    .maybeSingle<{ coach_email: string }>();
  return data?.coach_email ?? null;
}

/**
 * Minimal display info for a linked coach/client. Relies on the profiles
 * RLS exception (0003_coach_clients.sql) that only opens a profile up to
 * someone with an existing coach_clients row naming both of them — so this
 * silently returns null for anyone you're not actually linked with, rather
 * than throwing.
 */
export async function getLinkedProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ display_name: string | null } | null> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data ?? null;
}
