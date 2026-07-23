"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { isActivePath, navLinkActiveClassName, navLinkClassName } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * One auth-gated header nav item (hidden entirely when signed out) —
 * consolidates what were four near-identical files (DashboardNavLink,
 * HistoryNavLink, CoachingNavLink, ProfileNavLink), each repeating the same
 * session-check-then-render-or-null logic and only ever used once, in
 * SiteHeader. Also highlights itself when its href is the current page
 * (see lib/nav.ts).
 *
 * Reads auth state from the shared AuthProvider (see that file) rather
 * than running its own supabase.auth.getSession() subscription — four of
 * these render on every page at once, so that used to mean four redundant
 * session checks per navigation.
 */
export function AuthNavLink({ href, label }: { href: string; label: string }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const active = isActivePath(pathname, href);

  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(navLinkClassName, active && navLinkActiveClassName)}>
      {label}
    </Link>
  );
}
