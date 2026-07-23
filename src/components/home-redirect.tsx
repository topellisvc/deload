"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sends signed-in visitors from the marketing homepage straight to their
 * dashboard, without making / itself a dynamic page — same reasoning as
 * AuthStatus/CoachNavLink: checking auth server-side here would force the
 * whole static homepage into per-request rendering just for one redirect.
 * Renders nothing. Signed-out visitors see the homepage completely
 * unaffected; signed-in visitors get a brief flash of the marketing page
 * before the redirect fires, which is the right tradeoff for keeping /
 * static and fast for the SEO/logged-out audience it's actually built for.
 */
export function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session?.user) router.replace("/dashboard");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session?.user) router.replace("/dashboard");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
