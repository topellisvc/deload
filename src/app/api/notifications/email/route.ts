import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface NotificationEmailBody {
  to: string;
  subject: string;
  heading: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
}

function isValidBody(body: unknown): body is NotificationEmailBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.to === "string" &&
    typeof b.subject === "string" &&
    typeof b.heading === "string" &&
    typeof b.message === "string"
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(body: NotificationEmailBody): string {
  const cta =
    body.ctaHref && body.ctaLabel
      ? `<p style="margin:24px 0;"><a href="${body.ctaHref}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-size:14px;">${escapeHtml(body.ctaLabel)}</a></p>`
      : "";
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:13px;letter-spacing:0.05em;text-transform:uppercase;color:#888;margin:0 0 12px;">Deload</p>
      <h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(body.heading)}</h1>
      <p style="font-size:15px;line-height:1.5;color:#333;margin:0 0 8px;">${escapeHtml(body.message)}</p>
      ${cta}
    </div>
  `;
}

/**
 * The one server-side piece of the notifications feature — every other
 * part (writing the notification row, reading it back for the bell) is a
 * plain client-side Supabase call like the rest of this app, but sending
 * real email needs a secret provider API key that can never live in
 * browser code.
 *
 * Safe no-op (200, { skipped: true }) until RESEND_API_KEY and
 * NOTIFICATIONS_FROM_EMAIL are both set — see .env.local.example. To
 * activate: create a resend.com account, verify a sending domain (or use
 * their onboarding@resend.dev for testing), then set both env vars in
 * .env.local and in Vercel's project settings. No code changes needed
 * after that — same "leave blank, nothing breaks" contract as Sentry's DSN
 * (src/instrumentation.ts).
 *
 * Uses Resend's plain HTTP API directly rather than adding its SDK as a
 * dependency — this is the only call site, so a fetch is simpler than a
 * new package. Requires a signed-in session (this app's normal auth
 * cookie) so it can't be used as an open mail relay by an unauthenticated
 * caller who finds the endpoint.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATIONS_FROM_EMAIL;
  if (!apiKey || !from) {
    return NextResponse.json({ skipped: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: body.to,
      subject: body.subject,
      html: renderHtml(body),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Resend error: ${text}` }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
