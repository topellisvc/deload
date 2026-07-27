"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Users, Newspaper, UserRound } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useUnreadNotificationCount } from "@/lib/notifications/use-unread-count";
import { isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: typeof Home;
  /** Small dot shown on this tab's icon — currently only Home, badged
   * with unread notifications. Not the exact count (no room for a number
   * next to a 20px icon at this label size) — just "something's new,"
   * same purpose as a phone's app-icon badge. Open the bell in the header
   * for the actual list. */
  showDot?: boolean;
}

/**
 * Native-app-style bottom tab bar — mobile/tablet only (lg:hidden, the
 * same breakpoint SiteHeader collapses its own nav into a hamburger at).
 * This is what makes the Capacitor wrapper (capacitor.config.ts,
 * MOBILE_APP.md) feel like an app instead of a browser tab pointed at a
 * website, which is both a real usability upgrade and the thing App
 * Store review is most likely to ding a bare WebView wrapper for.
 *
 * Five fixed tabs regardless of sign-in state. Every destination here
 * already redirects to /sign-in?redirect_to=... when signed out (see
 * app/programs/page.tsx, app/coaching/page.tsx) and back again after, so
 * there's no dead end — a signed-out visitor tapping "Coaching" just gets
 * routed through sign-in first. Keeping the tab count and order constant
 * avoids the bar visibly reflowing the moment auth state resolves, which
 * matters more for a persistent fixed bar than it ever did for the old
 * hamburger dropdown. Only the Home and Profile hrefs themselves change
 * with auth state: Home goes to /dashboard once signed in (see
 * home-redirect.tsx for why "/" itself immediately bounces a signed-in
 * visitor away from the marketing page), and Profile becomes a Sign in
 * prompt when signed out rather than disappearing.
 *
 * History and Tools stay reachable from the header's menu rather than
 * getting a tab here — five is roughly the practical ceiling before
 * labels get cramped on a small screen, and both are lower-frequency
 * destinations than the ones that made the cut.
 */
export function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const unreadCount = useUnreadNotificationCount();

  const tabs: Tab[] = [
    { href: user ? "/dashboard" : "/", label: "Home", icon: Home, showDot: unreadCount > 0 },
    { href: "/programs", label: "Programs", icon: ClipboardList },
    { href: "/coaching", label: "Coaching", icon: Users },
    { href: "/insights", label: "Insights", icon: Newspaper },
    { href: user ? "/profile" : "/sign-in", label: user ? "Profile" : "Sign in", icon: UserRound },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-stretch justify-around">
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              aria-label={tab.showDot ? `${tab.label} (unread notifications)` : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                active && "text-primary"
              )}
            >
              <span className="relative">
                <Icon className="size-5" strokeWidth={active ? 2.25 : 2} />
                {tab.showDot && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-background"
                  />
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
