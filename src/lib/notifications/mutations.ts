import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/lib/supabase/types";
import { sendNotificationEmail, siteOrigin } from "@/lib/notifications/email";

/**
 * Writes the in-app notification row and, if an email is provided, fires
 * off a best-effort request to also send it (see email.ts) — the one place
 * both channels meet, so a trigger site only ever calls this once instead
 * of remembering to do both separately.
 *
 * Never throws and never surfaces an error to its caller: a notification
 * failing to write must not fail the real action (assigning a program,
 * accepting an invite) that already succeeded by the time this runs. RLS
 * (migration 0019) restricts this to real, currently-active coaching
 * relationships regardless of what a caller passes in.
 *
 * `email`, when provided, is always sent to `params.recipientId` — the
 * same person the in-app notification row goes to. There's deliberately
 * no separate "email to" field a caller could set independently; see
 * NotificationEmailParams for why (the API route re-derives the actual
 * address itself rather than trusting one passed through here).
 */
export async function notify(
  supabase: SupabaseClient,
  params: {
    recipientId: string;
    actorId: string;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    email?: { subject: string; heading: string; message: string; ctaLabel?: string; ctaHref?: string };
  }
): Promise<void> {
  // The doc comment above promises callers this never throws — Supabase
  // normally keeps that promise on its own (a Postgrest-level failure like
  // an RLS violation resolves as `{ error }`, it doesn't throw), but a
  // genuine network failure (offline, DNS, a blocked request) makes the
  // underlying fetch reject, which *would* throw through this await and
  // out to notifyProgramAssigned/notifyInviteAccepted's own bare
  // `await notify(...)` call sites — turning "the program was created
  // fine but its notification failed" into "creating the program failed,"
  // which is exactly the failure mode this function exists to prevent.
  try {
    await supabase.from("notifications").insert({
      recipient_id: params.recipientId,
      actor_id: params.actorId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
    });
  } catch {
    return;
  }

  if (params.email) {
    sendNotificationEmail({ ...params.email, recipientId: params.recipientId });
  }
}

/**
 * Trigger 1 of 2 (see migration 0019's comment): a coach assigns/sends a
 * program to an athlete. Called from lib/programs/mutations.ts's
 * createProgram and cloneProgram whenever athlete_id differs from the
 * acting owner. Confirms an active coach_clients row exists before
 * attempting the email leg at all (still gated the same as before), but no
 * longer reads the athlete's address off it — the API route looks that up
 * itself from the same table, scoped by RLS to the caller's own real
 * relationships, rather than being handed an address to trust.
 */
export async function notifyProgramAssigned(
  supabase: SupabaseClient,
  params: { coachId: string; athleteId: string; programId: string; programName: string }
): Promise<void> {
  const { data: relationship } = await supabase
    .from("coach_clients")
    .select("id")
    .eq("coach_id", params.coachId)
    .eq("client_id", params.athleteId)
    .eq("status", "active")
    .maybeSingle();

  await notify(supabase, {
    recipientId: params.athleteId,
    actorId: params.coachId,
    type: "program_assigned",
    title: "New program from your coach",
    body: `"${params.programName}" was just added to your programs.`,
    link: `/programs/${params.programId}`,
    email: relationship
      ? {
          subject: "Your coach sent you a new program",
          heading: "New program from your coach",
          message: `"${params.programName}" was just added to your programs on Deload.`,
          ctaLabel: "View program",
          ctaHref: `${siteOrigin()}/programs/${params.programId}`,
        }
      : undefined,
  });
}

/**
 * Trigger 2 of 2: a pending coaching invite is accepted. Called from
 * lib/coaching/mutations.ts's acceptInvite. Unlike the invite-sent leg
 * (deliberately not a notification row — see migration 0019's comment),
 * the coach here is a real, long-existing user, so both channels work
 * normally. coachEmail/clientEmail are still passed in for the in-app
 * notification/email *body* text ("X accepted your invite") — that's just
 * copy, not routing — but nothing here decides where the email is sent;
 * see notify()/NotificationEmailParams.
 */
export async function notifyInviteAccepted(
  supabase: SupabaseClient,
  params: { coachId: string; coachEmail: string; clientId: string; clientEmail: string }
): Promise<void> {
  await notify(supabase, {
    recipientId: params.coachId,
    actorId: params.clientId,
    type: "invite_accepted",
    title: "Invite accepted",
    body: `${params.clientEmail} accepted your coaching invite.`,
    link: "/coaching",
    email: {
      subject: `${params.clientEmail} accepted your invite`,
      heading: "Invite accepted",
      message: `${params.clientEmail} just accepted your coaching invite on Deload. You can now build and assign programs for them.`,
      ctaLabel: "Go to Coaching",
      ctaHref: `${siteOrigin()}/coaching`,
    },
  });
}

/**
 * Trigger 3: a coaching invite is sent to an email that already has a
 * Deload account. Migration 0019 originally skipped any in-app row for
 * "invite sent" on the assumption the invitee usually has no account yet
 * (they get Supabase's own magic-link/OTP email for that leg instead) —
 * true for a new signup, but not for this case, where the recipient is a
 * real existing user who'd otherwise have no way to discover the invite
 * short of stumbling onto /coaching. No separate email leg here: the OTP
 * sign-in email inviteClient already sends covers that, this only adds
 * the missing in-app half. Gated by migration 0042's narrow insert
 * policy (only fires for a genuine matching pending invite), not the
 * general "active relationship" policy that the other two triggers use.
 */
export async function notifyInviteReceived(
  supabase: SupabaseClient,
  params: { coachId: string; coachEmail: string; recipientId: string; message?: string }
): Promise<void> {
  await notify(supabase, {
    recipientId: params.recipientId,
    actorId: params.coachId,
    type: "invite_received",
    title: "Coaching invite",
    body: params.message ? `${params.coachEmail}: "${params.message}"` : `${params.coachEmail} invited you to train with them.`,
    link: "/coaching",
  });
}

/** Marks one notification read — used when the bell dropdown's item is
 * clicked. `.is("read_at", null)` keeps this idempotent rather than an
 * error if it's somehow clicked twice. */
export async function markNotificationRead(supabase: SupabaseClient, notificationId: string): Promise<void> {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId).is("read_at", null);
}

/** "Mark all as read" in the bell dropdown — one bulk update rather than
 * one per row, same shape as messaging/mutations.ts's markConversationRead. */
export async function markAllNotificationsRead(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", userId).is("read_at", null);
}
