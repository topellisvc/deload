import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CheckEmailBody {
  email: string;
}

function isValidBody(body: unknown): body is CheckEmailBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return typeof b.email === "string" && b.email.includes("@");
}

/**
 * Answers one question for SignInForm: does this email already have an
 * account? Only used to decide whether to show the name+role fields (a
 * returning user has already answered them, and shouldn't be asked
 * again) — never surfaced to the person as an explicit "that email is/
 * isn't registered" message, which is the part Supabase's own docs warn
 * against exposing (account enumeration). The one boolean this returns is
 * a much narrower leak than that, and only drives which fields render.
 *
 * Needs the admin client (lib/supabase/admin.ts) since an anonymous,
 * pre-sign-in visitor has no session for RLS to evaluate against —
 * profiles is only readable by an authenticated caller otherwise. Reads
 * profiles.email (denormalized from auth.users at signup, migration
 * 0021) rather than paginating admin.listUsers(), which has no
 * find-by-email filter in the JS client.
 */
export async function POST(request: Request) {
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

  return NextResponse.json({ hasAccount: data !== null });
}
