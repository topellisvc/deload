"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthStatus } from "@/components/auth/auth-status";
import { AuthNavLink } from "@/components/auth-nav-link";
import { isActivePath, navLinkActiveClassName, navLinkClassName } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Dashboard, Programs, History, Coaching, Tools, Profile, plus auth status
 * and the theme toggle — eight items total once everything's auth-gated in,
 * too many to stay inline once the viewport narrows. Collapses into a
 * hamburger below `lg` (1024px); at `lg` and above it's the same flat row
 * as before. Every item — auth-gated ones via AuthNavLink, the two static
 * ones (Programs, Tools) inline here — highlights itself as the current
 * page via lib/nav.ts's isActivePath, so it's always clear where you are.
 */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const programsActive = isActivePath(pathname, "/programs");
  const toolsActive = isActivePath(pathname, "/tools");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
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
        <nav className="hidden items-center gap-1 lg:flex">
          <AuthNavLink href="/dashboard" label="Dashboard" />
          <Link href="/programs" aria-current={programsActive ? "page" : undefined} className={cn(navLinkClassName, programsActive && navLinkActiveClassName)}>
            Programs
          </Link>
          <AuthNavLink href="/history" label="History" />
          <AuthNavLink href="/coaching" label="Coaching" />
          <Link href="/tools" aria-current={toolsActive ? "page" : undefined} className={cn(navLinkClassName, toolsActive && navLinkActiveClassName)}>
            Tools
          </Link>
          <AuthNavLink href="/profile" label="Profile" />
          <AuthStatus />
          <ThemeToggle />
        </nav>

        {/* Mobile: theme toggle stays reachable without opening the menu, hamburger reveals everything else. */}
        <div className="flex items-center gap-1 lg:hidden">
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
