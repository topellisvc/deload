import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface DeleteUserBody {
  userId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidBody(body: unknown): body is DeleteUserBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.userId === "string" && UUID_RE.test(b.userId);
}

/**
 * Admin-only account deletion — the one thing the roster (/admin) couldn't
 * do before, since deleting an auth.users row needs the service-role key
 * (see lib/supabase/admin.ts), which never reaches the browser. Mirrors
 * /api/notifications/email's shape: check the caller's own session with
 * the normal cookie-bound server client first, only reach for the admin
 * client after that's established.
 *
 * profiles.id -> auth.users(id) is `on delete cascade` (migration ~0001,
 * predates tracked migrations), so this one call also removes the
 * profiles row and everything else that cascades from it — no separate
 * cleanup needed here.
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
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  // An admin deleting their own account from this same screen would lock
  // them out mid-action with no roster left to undo it from — make them
  // do that (if they ever really want to) through normal account settings
  // instead, not this button.
  if (body.userId === user.id) {
    return NextResponse.json({ error: "You can't delete your own account from here." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(body.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ deleted: true });
}
