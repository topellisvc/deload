"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Dumbbell, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { getMyProfile } from "@/lib/coaching/queries";
import { chooseRole } from "@/lib/coaching/mutations";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * A one-time "coach or athlete?" prompt shown right after someone signs
 * in for the first time (profiles.role_selected still false). Lives in
 * the root layout as a client-only island, same reasoning as AuthStatus.
 *
 * Reads the signed-in user from the shared AuthProvider instead of running
 * its own session subscription (this used to be a sixth independent copy
 * of that same check); the profile-role lookup below is specific to this
 * component so it still runs its own fetch, just keyed off `user` from
 * context instead of a locally-tracked session.
 *
 * Athletes can still become coaches later via the "Become a coach" nav
 * link (CoachNavLink) — this only decides what they see first, not a
 * permanent lock-in.
 */
export function RoleOnboarding() {
  const { user } = useAuth();
  const [needsSelection, setNeedsSelection] = useState(false);
  const [submitting, setSubmitting] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setNeedsSelection(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();

    getMyProfile(supabase, user.id).then(({ roleSelected }) => {
      if (!cancelled) setNeedsSelection(!roleSelected);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function choose(role: UserRole) {
    if (!user) return;
    setSubmitting(role);
    setError(null);
    const supabase = createClient();
    const { error: chooseError } = await chooseRole(supabase, user.id, role);
    if (chooseError) {
      setSubmitting(null);
      setError(chooseError);
      return;
    }
    // A full reload rather than router.refresh() so every client island
    // that already fetched the old role (CoachNavLink, this component)
    // re-runs from scratch instead of needing bespoke re-fetch wiring for
    // what's a one-time event.
    window.location.reload();
  }

  if (!needsSelection) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-lg">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">How will you use Deload?</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          You can switch to coaching later too — this just decides what you see first.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => choose("athlete")}
            disabled={submitting !== null}
            className={cn(
              "flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors",
              "hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            <Dumbbell className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {submitting === "athlete" ? "Setting you up…" : "Train myself"}
              </span>
              <span className="text-xs text-muted-foreground">Build and follow my own programs</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose("coach")}
            disabled={submitting !== null}
            className={cn(
              "flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors",
              "hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {submitting === "coach" ? "Setting you up…" : "Coach others"}
              </span>
              <span className="text-xs text-muted-foreground">Invite clients and build programs for them — free for now</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
