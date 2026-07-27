export interface NotificationEmailParams {
  /** Who this is for — NOT an email address. The API route re-derives the
   * actual send-to address itself from an active coach_clients row
   * involving both the caller and this id (RLS-scoped, same as any other
   * query), rather than trusting a client-submitted address. A raw `to`
   * string used to be accepted directly here and forwarded to Resend
   * as-is, which meant anyone who could reach the endpoint with a valid
   * session (i.e. any signed-in user, via curl/devtools rather than the
   * app's own UI) could make it send arbitrary email to arbitrary
   * addresses using this app's sending domain. */
  recipientId: string;
  subject: string;
  heading: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/**
 * Fire-and-forget request to /api/notifications/email, the one server-side
 * piece of this feature — sending real email needs a secret provider API
 * key (Resend), which can never live in this browser-side module the way
 * every other lib/*\/mutations.ts talks straight to Supabase. See that
 * route for what happens on each end: it no-ops safely until the key is
 * configured (same "safe to leave unset" contract as Sentry's DSN in
 * instrumentation.ts).
 *
 * Deliberately not awaited by callers and never throws: a failed or
 * skipped email must never block the in-app action (assigning a program,
 * accepting an invite) that triggered it — the in-app notification row is
 * the source of truth, email is a best-effort extra.
 */
export function sendNotificationEmail(params: NotificationEmailParams): void {
  fetch("/api/notifications/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch(() => {
    // Best-effort — see doc comment above.
  });
}

/** Absolute origin for links inside emails (email clients don't know a
 * relative path's origin the way in-app navigation does). Only ever called
 * from the browser, same as the rest of this module. */
export function siteOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://www.deloadhq.com";
}
