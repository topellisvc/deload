import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ResolveInviteeBody {
  email: string;
}

function isValidBody(body: unknown): body is ResolveInviteeBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.email === "string" && b.email.includes("@");
}

/**
 * Looks up the profiles.id behind an email, for a coach who's just sent an
 * invite and needs to know whether to fire an in-app notification (see
 * notifyInviteReceived in lib/notifications/mutations.ts). Any signed-in
 * user can call this — it's not admin-gated like delete-user — but unlike
 * /api/auth/check-email (public, pre-auth, boolean-only) this returns an
 * actual id, so it stays behind auth.getUser() and off the public sign-in
 * path entirely.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Missing or invalid email" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  const adminClient = createAdminClient();
  const { data } = await adminClient.from("profiles").select("id").eq("email", email).maybeSingle();

  return NextResponse.json({ userId: data?.id ?? null });
}
