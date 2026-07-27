import { createBrowserClient } from "@supabase/ssr";

/**
 * A plain fetch is aborted the instant the page unloads — found live while
 * testing Training Mode: click Complete Set, then immediately navigate away
 * (switch apps, follow a link, close the tab) before that autosave
 * resolves, and the set silently never reaches the database, with no error
 * shown since the page is already gone. `keepalive` tells the browser to
 * let the request finish in the background instead of cancelling it on
 * unload — the same mechanism `navigator.sendBeacon` uses, just via fetch
 * so every existing mutation gets it for free.
 *
 * But every browser enforces a ~64KB total-body cap on keepalive requests
 * (part of the Fetch spec, not a bug) and Safari fails the request outright
 * the instant a single one exceeds it — found live once uploadArticleImage
 * started sending real photos through this same client: a plain JSON
 * write (a draft session, a logged set, a program edit) is comfortably
 * under that cap, but a photo almost never is, and Postgrest bodies are
 * always plain JSON strings while a file upload's body is always a
 * File/Blob/FormData — so that's the exact signal used here to only ever
 * request keepalive for the small writes it was meant for, never for a
 * file upload big enough to blow the limit.
 */
export function keepaliveAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const canKeepAlive = typeof init?.body === "string";
  return fetch(input, { ...init, keepalive: canKeepAlive });
}

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
      fetch: keepaliveAwareFetch,
    },
  });
}
