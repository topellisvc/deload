import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY. Uses the Supabase service-role key (SBSECRET), which
 * bypasses RLS entirely and can do things the app's normal anon-key
 * clients never can — like deleting an auth.users row outright (see
 * /api/admin/delete-user). Never import this from a "use client"
 * component or anything that could end up in a browser bundle; unlike
 * lib/supabase/client.ts and lib/supabase/server.ts, this one is only
 * ever safe to call from a Route Handler or Server Action.
 *
 * A plain createClient() rather than @supabase/ssr's cookie-bound
 * helpers — the service role key doesn't authenticate as any particular
 * user/session, so there's no cookie state to read or write here, unlike
 * lib/supabase/server.ts's per-request client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SBSECRET;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SBSECRET. Check .env.local (or the deployment's environment variables).");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
