import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components ("use client"). Reads
 * cookies/localStorage directly in the browser.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env.local (or the deployment's environment variables)."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
