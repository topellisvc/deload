import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface SetBetaAccessBody {
  userId: string;
  enabled: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidBody(body: unknown): body is SetBetaAccessBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.userId === "string" && UUID_RE.test(b.userId) && typeof b.enabled === "boolean";
}

/**
 * Admin-only toggle for profiles.beta_build_for_me (migration 0053) — the
 * "who gets 'Build my program' while it's in beta" switch. Same shape as
 * /api/admin/delete-user: verify the caller is an admin with the normal
 * session-bound client, then reach for the service-role client to do the
 * actual write, since migration 0021 only ever granted admins SELECT on
 * other profiles, not UPDATE — RLS would reject this from the session
 * client even for a genuine admin.
 *
 * Unlike delete-user this is fully reversible (flip it back off any time),
 * so there's no same-user guard and no confirmation step required here —
 * the UI (BetaAccessToggle) skips the confirm dialog for the same reason.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle<{ is_admin: boolean }>();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Missing or invalid userId/enabled" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("profiles").update({ beta_build_for_me: body.enabled }).eq("id", body.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ betaBuildForMe: body.enabled });
}
