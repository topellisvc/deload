"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getMyProfile } from "@/lib/coaching/queries";
import type { UserRole } from "@/lib/supabase/types";

/**
 * The nav slot that used to be a static "Clients" link. Hidden entirely
 * for signed-out visitors, "Clients" for anyone already a coach, and
 * "Become a coach" for a signed-in athlete — clicking either one goes to
 * /clients, which renders the roster or the upgrade prompt depending on
 * role. Deliberately client-side, same reasoning as AuthStatus: reading
 * auth/profile state server-side in the header would force every static
 * page on the site into dynamic per-request rendering just for one nav
 * label.
 */
export function CoachNavLink() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadRole(u: User) {
      const { role } = await getMyProfile(supabase, u.id);
      if (!cancelled) setRole(role);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) loadRole(session.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) loadRole(session.user);
      else setRole(null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!user) return null;

  return (
    <Link
      href="/clients"
      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {role === "coach" ? "Clients" : "Become a coach"}
    </Link>
  );
}
