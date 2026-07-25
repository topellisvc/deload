import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request. Server Components
 * can't write cookies themselves, so without this, a session nearing
 * expiry would never get renewed and users would get silently signed out.
 *
 * Middleware runs on every request to every route, static tool pages
 * included — so if this ever throws, it doesn't just break auth, it takes
 * the entire site down. A missing or misconfigured env var must never be
 * able to do that, which is why this checks for the vars up front and
 * simply skips session refresh (rather than crashing) if they're absent,
 * instead of trusting `!` non-null assertions to always be true in every
 * deployment environment.
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Supabase env vars missing — skipping session refresh so the rest of the site keeps working."
    );
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Touching auth.getUser() is what actually triggers the refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in visitors landing on the marketing homepage want their
  // dashboard, not the pitch. Catching that here — before any HTML is
  // sent — replaces the old approach of rendering the full marketing page
  // and yanking it away client-side a moment later once auth state
  // resolved (see HomeRedirect's history): same "/" stays static for the
  // signed-out/SEO audience, signed-in visitors just never see it.
  if (user && request.nextUrl.pathname === "/") {
    const redirectResponse = NextResponse.redirect(new URL("/dashboard", request.url));
    // Carry over any cookies getUser() just refreshed — building the
    // redirect from a fresh NextResponse would otherwise drop them.
    supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return supabaseResponse;
}
