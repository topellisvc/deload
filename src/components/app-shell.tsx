"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Home, ClipboardList, History, Users, Library, Newspaper, Wrench } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { AccountMenu } from "@/components/auth/account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/programs", label: "Programs", icon: ClipboardList },
  { href: "/history", label: "History", icon: History },
  { href: "/coaching", label: "Coaching", icon: Users },
  { href: "/insights", label: "Insights", icon: Newspaper },
  { href: "/tools", label: "Tools", icon: Wrench },
];

const navLinkBase =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const navLinkActive = "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary";

/**
 * Persistent left sidebar navigation — desktop only (lg+). Below lg, the
 * existing SiteHeader (hamburger) and BottomNav (tab bar) still own
 * navigation entirely unchanged; this doesn't touch either of those. Ellis
 * asked for the mockup's sidebar layout "site wide but only for desktop,"
 * so this replaces SiteHeader's old `lg:flex` desktop nav row rather than
 * living alongside it — see site-header.tsx's own `lg:hidden` for the other
 * half of that split.
 *
 * Nav items are the same real destinations SiteHeader's desktop row and
 * BottomNav's tabs already point at (Dashboard/Programs/History/Coaching/
 * Insights/Tools, plus Exercise Library for coaches/admins) — the mockup
 * Ellis shared also showed "Training," "Messages," and "Settings," but none
 * of those are real pages in this app yet, so they're deliberately left out
 * rather than linking somewhere that doesn't exist.
 *
 * Rendering (this sidebar, and the matching lg:pl-60 content offset below)
 * is gated on the same `useAuth()` user the rest of the app's auth-gated
 * chrome already reads, so a signed-out visitor on the marketing site never
 * sees an empty reserved column — both AppSidebar and AppShell derive from
 * the identical shared context value in the same render pass, so they can't
 * drift out of sync with each other.
 */
function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [canSeeLibrary, setCanSeeLibrary] = useState(false);

  useEffect(() => {
    if (!user) {
      setCanSeeLibrary(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .maybeSingle<{ role: string; is_admin: boolean }>()
      .then(({ data }) => {
        if (!cancelled) setCanSeeLibrary(data ? data.role === "coach" || data.is_admin : false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-5 py-5 text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
      >
        <Dumbbell className="size-5 text-primary" />
        Deload
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(navLinkBase, active && navLinkActive)}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        {canSeeLibrary && (
          <Link
            href="/exercises"
            aria-current={isActivePath(pathname, "/exercises") ? "page" : undefined}
            className={cn(navLinkBase, isActivePath(pathname, "/exercises") && navLinkActive)}
          >
            <Library className="size-4 shrink-0" />
            Exercise Library
          </Link>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <AccountMenu />
      </div>
    </aside>
  );
}

/**
 * Wraps the whole app (see layout.tsx) so the sidebar's presence and the
 * main content's left offset can never disagree — both read `user` from the
 * same AuthProvider context in the same component tree, rather than two
 * independent auth checks that could theoretically resolve on different
 * renders. Below lg this renders as a plain passthrough (no padding, no
 * sidebar) — SiteHeader/BottomNav own mobile nav entirely, unchanged.
 *
 * The slim lg-only bar above `children` is what NotificationBell moved into
 * once it left SiteHeader's now-hidden desktop row (see site-header.tsx) —
 * account/theme/sign-out moved into the sidebar's own AccountMenu instead of
 * needing a second copy up here.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <>
      <AppSidebar />
      <div className={cn("flex min-h-screen flex-col", user && "lg:pl-60")}>
        {user && (
          <div className="hidden items-center justify-end border-b border-border bg-background/80 px-6 py-2.5 backdrop-blur-md lg:flex">
            <NotificationBell />
          </div>
        )}
        {children}
      </div>
    </>
  );
}
