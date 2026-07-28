"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { isActivePath, navLinkActiveClassName, navLinkClassName } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * "Add a new page called Exercise Library... Initially this page should
 * only be visible to coaches and administrators" (spec). AuthNavLink's
 * shared session state only knows *whether* someone's signed in, not their
 * role, so this is its own small component with its own lightweight
 * profile fetch rather than widening AuthProvider's context for one nav
 * item — RLS is the real access boundary either way (see /exercises/
 * page.tsx's own redirect guard); this is purely "don't show the link to
 * someone who'd immediately bounce off it."
 */
export function ExerciseLibraryNavLink({ className }: { className?: string }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [canSee, setCanSee] = useState(false);

  useEffect(() => {
    if (!user) {
      setCanSee(false);
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
        if (!cancelled) setCanSee(data ? data.role === "coach" || data.is_admin : false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!canSee) return null;

  const active = isActivePath(pathname, "/exercises");

  return (
    <Link href="/exercises" aria-current={active ? "page" : undefined} className={cn(navLinkClassName, active && navLinkActiveClassName, className)}>
      Exercise Library
    </Link>
  );
}
