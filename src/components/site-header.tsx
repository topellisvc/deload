"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthStatus } from "@/components/auth/auth-status";
import { AccountMenu } from "@/components/auth/account-menu";
import { AuthNavLink } from "@/components/auth-nav-link";
import { ExerciseLibraryNavLink } from "@/components/exercise-library-nav-link";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuth } from "@/components/providers/auth-provider";
import { isActivePath, navLinkActiveClassName, navLinkClassName } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Two different jobs depending on who's looking and how wide the screen is:
 *
 * - Signed IN, at `lg` and above (1024px+): renders nothing (`lg:hidden`
 *   kicks in once `user` is set). AppSidebar (app-shell.tsx) is the real
 *   navigation there now — a persistent left sidebar, not this horizontal
 *   row — since Ellis asked for the sidebar to replace desktop nav entirely
 *   ("site wide but only for desktop").
 * - Everyone else — signed out at any width, or signed in below `lg` —
 *   still gets this component exactly as before: the flat desktop row at
 *   `lg`+, collapsing into the hamburger panel below it. Signed-out visitors
 *   specifically still need this at desktop width too: AppSidebar renders
 *   nothing for them (there's no account to navigate), and Programs/
 *   Insights/Tools need to stay visible and crawlable for search engines
 *   regardless of auth state — that requirement predates the sidebar and
 *   isn't specific to signed-in users.
 *
 * Every link — auth-gated ones via AuthNavLink, the static ones (Programs,
 * Insights, Tools) inline here — highlights itself as the current page via
 * lib/nav.ts's isActivePath, so it's always clear where you are.
 */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  const programsActive = isActivePath(pathname, "/programs");
  const insightsActive = isActivePath(pathname, "/insights");
  const toolsActive = isActivePath(pathname, "/tools");

  return (
    <header
      className={cn("sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md", user && "lg:hidden")}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Only bites once wrapped by Capacitor with viewport-fit=cover
          (see layout.tsx's viewport export) — env(safe-area-inset-top)
          is 0px in an ordinary mobile browser tab, so this is a no-op
          there. Keeps the sticky header clear of the iPhone notch/Dynamic
          Island in the native app instead of drawing under it. */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
        >
          <Dumbbell className="size-5 text-primary" />
          Deload
        </Link>

        {/* Desktop nav — Dashboard/Coaching/Profile are auth-gated islands
            (hidden when signed out); Tools and Programs are static links. */}
        <nav className="hidden items-center gap-0.5 xl:gap-1 lg:flex">
          <AuthNavLink href="/dashboard" label="Dashboard" />
          <Link href="/programs" aria-current={programsActive ? "page" : undefined} className={cn(navLinkClassName, programsActive && navLinkActiveClassName)}>
            Programs
          </Link>
          <AuthNavLink href="/history" label="History" />
          <AuthNavLink href="/coaching" label="Coaching" />
          <ExerciseLibraryNavLink />
          {/* Static link, not AuthNavLink — Insights must be visible and
              crawlable for signed-out visitors and search engines (the
              spec's whole SEO/discovery goal depends on that), unlike the
              rest of the app's auth-gated islands. */}
          <Link href="/insights" aria-current={insightsActive ? "page" : undefined} className={cn(navLinkClassName, insightsActive && navLinkActiveClassName)}>
            Insights
          </Link>
          <Link href="/tools" aria-current={toolsActive ? "page" : undefined} className={cn(navLinkClassName, toolsActive && navLinkActiveClassName)}>
            Tools
          </Link>
          <NotificationBell />
          <AccountMenu />
        </nav>

        {/* Mobile: theme toggle and the notification bell stay reachable
            without opening the menu (the bell renders nothing when signed
            out, same as AuthNavLink), hamburger reveals everything else. */}
        <div className="flex items-center gap-1 lg:hidden">
          <NotificationBell />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        // A flex-col container stretches its children to fill the cross
        // axis by default (align-items: stretch), so these render as
        // full-width tap targets with no extra styling needed. Clicking
        // anywhere in the panel (including a link, before navigation
        // completes) closes it.
        <nav onClick={() => setMobileOpen(false)} className="flex flex-col gap-0.5 border-t border-border bg-background px-4 py-3 lg:hidden">
          <AuthNavLink href="/dashboard" label="Dashboard" />
          <Link href="/programs" aria-current={programsActive ? "page" : undefined} className={cn(navLinkClassName, programsActive && navLinkActiveClassName)}>
            Programs
          </Link>
          <AuthNavLink href="/history" label="History" />
          <AuthNavLink href="/coaching" label="Coaching" />
          <ExerciseLibraryNavLink />
          {/* Static link, not AuthNavLink — Insights must be visible and
              crawlable for signed-out visitors and search engines (the
              spec's whole SEO/discovery goal depends on that), unlike the
              rest of the app's auth-gated islands. */}
          <Link href="/insights" aria-current={insightsActive ? "page" : undefined} className={cn(navLinkClassName, insightsActive && navLinkActiveClassName)}>
            Insights
          </Link>
          <Link href="/tools" aria-current={toolsActive ? "page" : undefined} className={cn(navLinkClassName, toolsActive && navLinkActiveClassName)}>
            Tools
          </Link>
          <AuthNavLink href="/profile" label="Profile" />
          <div className="mt-2 border-t border-border pt-2">
            <AuthStatus />
          </div>
        </nav>
      )}
    </header>
  );
}
