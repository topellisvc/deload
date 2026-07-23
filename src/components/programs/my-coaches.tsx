"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { declineInvite } from "@/lib/coaching/mutations";
import type { CoachClient } from "@/lib/supabase/types";

interface MyCoachesProps {
  coaches: CoachClient[];
}

/**
 * A small "who's coaching me" list — someone with multiple active coaches
 * previously had no way to see that except piecing it together from each
 * program's "Assigned by" badge individually. "Leave" reuses declineInvite
 * (a plain delete of the coach_clients row): the client-side delete RLS
 * policy already covers both declining a pending invite and leaving an
 * active relationship, and the unassign-on-removal trigger
 * (0005_unassign_on_relationship_removed.sql) means leaving also
 * correctly revokes access to any programs that coach had assigned.
 */
export function MyCoaches({ coaches }: MyCoachesProps) {
  const router = useRouter();
  const [list, setList] = useState(coaches);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLeave(coachClientId: string, coachEmail: string) {
    if (!window.confirm(`Stop being coached by ${coachEmail}? You'll lose access to any programs they assigned you.`)) {
      return;
    }
    setBusyId(coachClientId);
    setError(null);
    const supabase = createClient();
    const { error: leaveError } = await declineInvite(supabase, coachClientId);
    setBusyId(null);

    if (leaveError) {
      setError(leaveError);
      return;
    }
    setList((prev) => prev.filter((c) => c.id !== coachClientId));
    router.refresh();
  }

  if (list.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Coached by
      </h2>
      <div className="flex flex-wrap gap-2">
        {list.map((coach) => (
          <div
            key={coach.id}
            className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-3 pr-1.5 text-sm text-foreground"
          >
            <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-[16rem] truncate">{coach.coach_email}</span>
            <button
              type="button"
              onClick={() => handleLeave(coach.id, coach.coach_email)}
              disabled={busyId === coach.id}
              aria-label={`Stop being coached by ${coach.coach_email}`}
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
