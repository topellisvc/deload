"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { removeClient } from "@/lib/coaching/mutations";
import type { CoachClient } from "@/lib/supabase/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface PendingSentInvitesProps {
  invites: CoachClient[];
  onCancelled: (id: string) => void;
}

/**
 * The coach's own view of invites they've sent that haven't been accepted
 * yet — was folded into ClientsManager's single roster list before; split
 * out here since a pending invite and an active athlete need different UI
 * (no program/activity to show for someone who hasn't accepted). Reuses
 * removeClient exactly as ClientsManager's "remove" button did.
 */
export function PendingSentInvites({ invites, onCancelled }: PendingSentInvitesProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function handleCancel(id: string) {
    setBusyId(id);
    setError(null);
    const supabase = createClient();
    const { error: removeError } = await removeClient(supabase, id);
    setBusyId(null);
    if (removeError) {
      setError(removeError);
      return;
    }
    onCancelled(id);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Awaiting response</h2>
      <ul className="flex flex-col divide-y divide-border">
        {invites.map((invite) => (
          <li key={invite.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{invite.client_email}</span>
                <span className="text-xs text-muted-foreground">Sent {formatDate(invite.created_at)}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancel(invite.id)}
              disabled={busyId === invite.id}
              aria-label={`Cancel invite to ${invite.client_email}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <div className="mt-3 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
