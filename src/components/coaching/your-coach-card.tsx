"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarCheck, ClipboardList, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { declineInvite } from "@/lib/coaching/mutations";
import { getInitials } from "@/lib/utils";
import type { CoachClient } from "@/lib/supabase/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

interface YourCoachCardProps {
  coach: CoachClient;
  profile: { display_name: string | null; bio: string | null } | null;
  activeProgramCount: number;
}

/**
 * "Leave" reuses declineInvite exactly like the old MyCoaches chip list
 * did — same plain-delete-the-row mutation covers both declining a
 * pending invite and leaving an active relationship. "View Profile" has
 * nowhere to go yet (no public coach profile page exists) — disabled
 * with an explanatory title rather than a link to nothing, same call as
 * AccountSettings' delete-account button.
 */
export function YourCoachCard({ coach, profile, activeProgramCount }: YourCoachCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);

  const name = profile?.display_name || coach.coach_email;
  const initials = getInitials(profile?.display_name, coach.coach_email);
  const since = coach.accepted_at ?? coach.created_at;

  async function handleLeave() {
    if (!window.confirm(`Stop being coached by ${coach.coach_email}? You'll lose access to any programs they assigned you.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: leaveError } = await declineInvite(supabase, coach.id);
    setBusy(false);
    if (leaveError) {
      setError(leaveError);
      return;
    }
    setLeft(true);
    router.refresh();
  }

  if (left) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Your coach</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary"
          >
            {initials}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-semibold text-foreground">{name}</p>
            <p className="max-w-md text-sm text-muted-foreground">{profile?.bio || "No bio yet."}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarCheck className="size-3.5" />
                Coaching since {formatDate(since)}
              </span>
              <span className="flex items-center gap-1">
                <ClipboardList className="size-3.5" />
                {activeProgramCount} active {activeProgramCount === 1 ? "program" : "programs"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 self-start">
          <Button variant="outline" size="sm" disabled title="Coach profiles aren't available yet">
            <UserRound className="size-3.5" />
            View Profile
          </Button>
          <Button variant="outline" size="sm" onClick={handleLeave} disabled={busy}>
            {busy ? "Leaving…" : "Leave"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
