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
    email?: { to: string; subject: string; heading: string; message: string; ctaLabel?: string; ctaHref?: string };
  }
): Promise<void> {
  await supabase.from("notifications").insert({
    recipient_id: params.recipientId,
    actor_id: params.actorId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });

  if (params.email) {
    sendNotificationEmail(params.email);
  }
}

/**
 * Trigger 1 of 2 (see migration 0019's comment): a coach assigns/sends a
 * program to an athlete. Called from lib/programs/mutations.ts's
 * createProgram and cloneProgram whenever athlete_id differs from the
 * acting owner. Looks up the athlete's email off the coach_clients roster
 * row (there's no other source — this app has no admin API to read
 * auth.users directly, see 0003_coach_clients.sql) so the email side can
 * work even though we only ever have the athlete's user id here.
 */
export async function notifyProgramAssigned(
  supabase: SupabaseClient,
  params: { coachId: string; athleteId: string; programId: string; programName: string }
): Promise<void> {
  const { data: relationship } = await supabase
    .from("coach_clients")
    .select("client_email")
    .eq("coach_id", params.coachId)
    .eq("client_id", params.athleteId)
    .eq("status", "active")
    .maybeSingle<{ client_email: string }>();

  await notify(supabase, {
    recipientId: params.athleteId,
    actorId: params.coachId,
    type: "program_assigned",
    title: "New program from your coach",
    body: `"${params.programName}" was just added to your programs.`,
    link: `/programs/${params.programId}`,
    email: relationship
      ? {
          to: relationship.client_email,
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
 * normally; coach_email comes straight off the coach_clients row being
 * accepted, same as the program-assigned lookup above.
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
      to: params.coachEmail,
      subject: `${params.clientEmail} accepted your invite`,
      heading: "Invite accepted",
      message: `${params.clientEmail} just accepted your coaching invite on Deload. You can now build and assign programs for them.`,
      ctaLabel: "Go to Coaching",
      ctaHref: `${siteOrigin()}/coaching`,
    },
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
