"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Replaces the old CoachNavLink ("Clients" / "Become a coach") now that
 * the coaching relationship — invites, roster, messaging — lives at one
 * fixed destination, /coaching, for everyone: an athlete with a coach, a
 * coach with clients, both, or neither (that page handles all four with
 * its own empty states, so the nav label itself doesn't need to branch on
 * role the way the old link did). Same client-side auth check as every
 * other nav island here — see AuthStatus for why.
 */
export function CoachingNavLink() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!user) return null;

  return (
    <Link
      href="/coaching"
      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      Coaching
    </Link>
  );
}
