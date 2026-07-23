import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthStatus } from "@/components/auth/auth-status";
import { CoachingNavLink } from "@/components/coaching-nav-link";
import { DashboardNavLink } from "@/components/dashboard-nav-link";
import { ProfileNavLink } from "@/components/profile-nav-link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
        >
          <Dumbbell className="size-5 text-primary" />
          Deload
        </Link>
        {/* Dashboard, Programs, Coaching, Tools, Profile — Dashboard/Coaching/Profile
            are auth-gated islands (hidden when signed out); Tools and Programs
            are static links, same as before. */}
        <nav className="flex items-center gap-1">
          <DashboardNavLink />
          <Link
            href="/programs"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Programs
          </Link>
          <CoachingNavLink />
          <Link
            href="/tools"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Tools
          </Link>
          <ProfileNavLink />
          <AuthStatus />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
