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

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    global: {
      // A plain fetch is aborted the instant the page unloads — found live
      // while testing Training Mode: click Complete Set, then immediately
      // navigate away (switch apps, follow a link, close the tab) before
      // that autosave resolves, and the set silently never reaches the
      // database, with no error shown since the page is already gone.
      // `keepalive` tells the browser to let the request finish in the
      // background instead of cancelling it on unload — the same mechanism
      // `navigator.sendBeacon` uses, just via fetch so every existing
      // mutation gets it for free. Every write from this client is a small
      // JSON body (a draft session, a logged set, a program edit), well
      // under the ~64KB keepalive limit browsers enforce.
      fetch: (input, init) => fetch(input, { ...init, keepalive: true }),
    },
  });
}
