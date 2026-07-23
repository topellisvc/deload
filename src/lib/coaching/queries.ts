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
 * Pending invites addressed to this user's email, awaiting their explicit
 * accept/decline — never auto-linked just because they signed in. A coach
 * only knows a client's email at invite time, so this can't be looked up
 * by client_id until accepted; RLS ("clients can see relationships naming
 * them") already restricts the result to rows actually naming this user
 * (by id or by email match), so no extra filtering is needed here beyond
 * status.
 */
export async function getPendingInvitesForMe(supabase: SupabaseClient): Promise<CoachClient[]> {
  const { data } = await supabase
    .from("coach_clients")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as CoachClient[];
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
