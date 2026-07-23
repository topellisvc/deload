"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isActivePath, navLinkActiveClassName, navLinkClassName } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * One auth-gated header nav item (hidden entirely when signed out) —
 * consolidates what were four near-identical files (DashboardNavLink,
 * HistoryNavLink, CoachingNavLink, ProfileNavLink), each repeating the same
 * session-check-then-render-or-null logic and only ever used once, in
 * SiteHeader. Also now highlights itself when its href is the current page
 * (see lib/nav.ts) — the reason for touching all four at once, since
 * duplicating that same "what counts as active" rule four times is exactly
 * the kind of drift a shared component avoids.
 *
 * Deliberately still a client component reading auth state client-side
 * rather than a server one — see AuthStatus for why (keeps the rest of the
 * site's static pages static).
 */
export function AuthNavLink({ href, label }: { href: string; label: string }) {
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();

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

  const active = isActivePath(pathname, href);

  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(navLinkClassName, active && navLinkActiveClassName)}>
      {label}
    </Link>
  );
}
