import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/supabase/types";
import { notifyInviteAccepted, notifyInviteReceived } from "@/lib/notifications/mutations";

function authCallbackUrl(redirectTo: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

/**
 * Looks up whether the just-invited email already has a Deload account,
 * via the authenticated-only /api/coaching/resolve-invitee (needs the
 * service-role admin client, which can't run in this browser-side
 * module — see that route). Used only to decide whether to also fire an
 * in-app notification; failing this (network error, etc.) just means the
 * invitee doesn't get the in-app notification, not that the invite itself
 * fails — inviteClient's roster row and OTP email are already done by the
 * time this runs.
 */
async function resolveInviteeId(email: string): Promise<string | null> {
  try {
    const res = await fetch("/api/coaching/resolve-invitee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { userId?: string | null };
    return data.userId ?? null;
  } catch {
    return null;
  }
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

  // If this email already belongs to a real Deload account, they also get
  // an in-app notification — the OTP email above looks like any other
  // sign-in email, so without this they'd have no way to know they'd been
  // invited short of stumbling onto /coaching themselves. A brand-new
  // signup has no id to resolve yet, so this silently no-ops for them
  // (see notifyInviteReceived's doc comment for why that's fine).
  const recipientId = await resolveInviteeId(email);
  if (recipientId) {
    await notifyInviteReceived(supabase, {
      coachId: params.coachId,
      coachEmail: params.coachEmail,
      recipientId,
      message,
    });
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

/** Marks the one-time WelcomeTour modal as seen (migration 0040) — same
 * "record that they've been shown this already" action as chooseRole's
 * role_selected flag, just for the separate welcome-tour flag. */
export async function markTourSeen(supabase: SupabaseClient, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("profiles").update({ tour_seen: true }).eq("id", userId);
  return { error: friendlyError(error, "Couldn't save that. Try again.") };
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
  const { data, error } = await supabase
    .from("coach_clients")
    .update({ client_id: params.userId, status: "active", accepted_at: new Date().toISOString() })
    .eq("id", params.coachClientId)
    .is("client_id", null)
    .select("coach_id, coach_email, client_email")
    .maybeSingle<{ coach_id: string; coach_email: string; client_email: string }>();
  if (error) return { error: friendlyError(error, "Couldn't accept this invite. Try again.") };

  // Notifies the coach — see lib/notifications/mutations.ts's
  // notifyInviteAccepted. client_email comes straight off this same row
  // (it's the email the invite was addressed to, i.e. this accepting
  // user's own email) rather than a second lookup.
  if (data) {
    await notifyInviteAccepted(supabase, {
      coachId: data.coach_id,
      coachEmail: data.coach_email,
      clientId: params.userId,
      clientEmail: data.client_email,
    });
  }

  return { error: null };
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
