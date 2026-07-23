"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

/**
 * Sends signed-in visitors from the marketing homepage straight to their
 * dashboard, without making / itself a dynamic page — same reasoning as
 * AuthStatus. Renders nothing. Signed-out visitors see the homepage
 * completely unaffected; signed-in visitors get a brief flash of the
 * marketing page before the redirect fires, which is the right tradeoff
 * for keeping / static and fast for the SEO/logged-out audience it's
 * actually built for.
 *
 * Reads from the shared AuthProvider instead of its own session
 * subscription (this used to duplicate the same check every other header
 * island was already running).
 */
export function HomeRedirect() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  return null;
}
