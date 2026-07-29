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
import { isActivePath, navLinkActiveClassName, navLinkClassName } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Dashboard, Programs, History, Coaching, Exercises, Insights, Tools, plus
 * the bell and account menu — still a lot once everything's auth-gated in,
 * too many to stay inline once the viewport narrows. Collapses into a
 * hamburger below `lg` (1024px); at `lg` and above it's the same flat row
 * as before. Every link — auth-gated ones via AuthNavLink, the static ones
 * (Programs, Insights, Tools) inline here — highlights itself as the
 * current page via lib/nav.ts's isActivePath, so it's always clear where
 * you are.
 *
 * Desktop's email/Profile/sign-out/theme-toggle cluster lives behind
 * AccountMenu's single avatar trigger instead of four separate items (see
 * that file) — Profile and the email both pointed at the same page, so
 * showing both was redundant. The mobile hamburger panel below still uses
 * AuthStatus directly; it's a vertical list already, not a crowded row.
 */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const programsActive = isActivePath(pathname, "/programs");
  const insightsActive = isActivePath(pathname, "/insights");
  const toolsActive = isActivePath(pathname, "/tools");

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md"
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
