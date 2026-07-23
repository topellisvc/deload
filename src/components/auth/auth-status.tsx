"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { buttonVariants } from "@/components/ui/button";

/**
 * Auth state for the header — sign-in link when signed out, email +
 * sign-out button when signed in.
 *
 * Reads from the shared AuthProvider (see that file for why this is
 * client-side rather than server-rendered — same reasoning as before this
 * was consolidated, just now shared with the other five components that
 * needed the same session check instead of each running its own).
 */
export function AuthStatus() {
  const { user, loading } = useAuth();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  if (loading) {
    return <div className="h-9 w-20" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/profile"
        className="hidden rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline"
      >
        {user.email}
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        aria-label="Sign out"
      >
        <LogOut className="size-3.5" />
        Sign out
      </button>
    </div>
  );
}
