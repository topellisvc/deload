"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

/**
 * Fallback for the rare case someone's auth state changes while they're
 * already sitting on "/" without a fresh navigation (e.g. signing in from
 * another tab). The common case — a signed-in visitor requesting "/" —
 * is now caught in middleware (src/lib/supabase/middleware.ts) before any
 * HTML is even sent, which is what actually eliminated the old flash of
 * the marketing page. This component renders nothing and is otherwise a
 * no-op; signed-out visitors are completely unaffected either way.
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
