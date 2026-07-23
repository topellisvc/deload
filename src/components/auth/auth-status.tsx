"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";

/**
 * Auth state for the header — sign-in link when signed out, email +
 * sign-out button when signed in.
 *
 * Deliberately a client component, not a server one that reads cookies.
 * This lives in the root layout's header, so if it read auth state
 * server-side, every single page on the site (including every static
 * calculator page) would be forced into dynamic, per-request rendering
 * just to know whether one nav item should say "Sign in" — a real
 * performance and cost regression for pages that have nothing to do with
 * auth. Checking client-side keeps the rest of the site fully static; the
 * cost is a brief loading state before the auth widget resolves, which is
 * the right tradeoff here.
 */
export function AuthStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
