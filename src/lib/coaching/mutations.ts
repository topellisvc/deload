import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/supabase/types";

function authCallbackUrl(redirectTo: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

/**
 * Maps a raw Postgres/PostgREST error to something worth showing someone
 * who isn't debugging the database — used by every coaching mutation
 * below except inviteClient (which already special-cases its own most
 * likely failure, a duplicate invite).
 */
function friendlyError(error: { message: string } | null, fallback: string): string | null {
  if (!error) return null;
  return fallback;
}

/**
 * Invites someone to be this coach's client.
 *
 * There's no admin API available here (no Supabase service-role key
 * configured — see 0003_coach_clients.sql), so this reuses the existing
 * passwordless sign-in mechanism instead of a dedicated invite email:
 * `signInWithOtp` sends the invitee a real magic-link email and creates
 * their account if they don't have one yet, using nothing but the public
 * anon key. It does not touch the calling (coach's) session — no
 * verifyOtp/exchangeCodeForSession happens here, just a "send mail" call.
 *
 * The roster row is written first and shows up as 'pending' immediately
 * regardless of email deliverability. It stays 'pending' — and no program
 * can be assigned to the invitee — until they explicitly accept it (see
 * acceptInvite). Signing in off the invite email does not by itself link
 * anything: linking a random email you happen to know to your roster,
 * just because that person naturally signed in for unrelated reasons
 * someday, would let a coach silently attach themselves to someone who
 * never agreed to it.
 */
export async function inviteClient(
  supabase: SupabaseClient,
  params: { coachId: string; coachEmail: string; email: string; message?: string }
): Promise<{ error: string | null }> {
  const email = params.email.trim().toLowerCase();
  if (!email) return { error: "Enter an email address." };

  const message = params.message?.trim();
  const { error: insertError } = await supabase.from("coach_clients").insert({
    coach_id: params.coachId,
    client_email: email,
    coach_email: params.coachEmail,
    invite_message: message || null,
  });
  if (insertError) {
    if (insertError.code === "23505") return { error: "You've already invited this email." };
    return { error: insertError.message };
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authCallbackUrl("/programs"), shouldCreateUser: true },
  });
  if (otpError) {
    return { error: `Added to your roster, but the invite email couldn't be sent: ${otpError.message}` };
  }

  return { error: null };
}

/**
 * Records the user's coach-or-athlete choice — used both by the first-login
 * onboarding prompt (RoleOnboarding) and by the "Become a coach" upgrade
 * path later (UpgradePrompt), since they're the same underlying action:
 * set the role, and mark that they've now actually been asked so
 * RoleOnboarding never nags them again. No payment involved yet (RLS:
 * "profiles are editable by their owner" already permits this, no new
 * policy needed) — but every place that actually matters (creating a
 * client invite, assigning a program to someone else) is gated by this
 * same role column at the database level, so wiring in real billing later
 * just means changing what calls this function, not the gate itself.
 */
export async function chooseRole(
  supabase: SupabaseClient,
  userId: string,
  role: UserRole
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("profiles").update({ role, role_selected: true }).eq("id", userId);
  return { error: friendlyError(error, "Couldn't save that. Try again.") };
}

/** Thin wrapper around chooseRole for the "Become a coach" upgrade path. */
export async function upgradeToCoach(supabase: SupabaseClient, userId: string): Promise<{ error: string | null }> {
  return chooseRole(supabase, userId, "coach");
}

export async function removeClient(
  supabase: SupabaseClient,
  coachClientId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("coach_clients").delete().eq("id", coachClientId);
  return { error: friendlyError(error, "Couldn't remove this client. Try again.") };
}

/**
 * Explicit, user-initiated acceptance of a pending invite — the only way
 * a coach_clients row is allowed to link to a real client_id. The
 * `client_id is null` guard also stops a stale/already-resolved invite
 * from being re-accepted twice.
 */
export async function acceptInvite(
  supabase: SupabaseClient,
  params: { coachClientId: string; userId: string }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("coach_clients")
    .update({ client_id: params.userId, status: "active", accepted_at: new Date().toISOString() })
    .eq("id", params.coachClientId)
    .is("client_id", null);
  return { error: friendlyError(error, "Couldn't accept this invite. Try again.") };
}

/**
 * Declining a pending invite just deletes the row — the client-side
 * delete policy also lets someone remove themselves from an *active*
 * coaching relationship later, not only a pending one, so "decline" and
 * "leave" both reuse this.
 */
export async function declineInvite(
  supabase: SupabaseClient,
  coachClientId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("coach_clients").delete().eq("id", coachClientId);
  return { error: friendlyError(error, "Couldn't decline this invite. Try again.") };
}
