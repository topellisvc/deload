"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { acceptInvite, declineInvite } from "@/lib/coaching/mutations";
import type { CoachClient } from "@/lib/supabase/types";

interface PendingInvitesProps {
  invites: CoachClient[];
  userId: string;
}

/**
 * A pending coach_clients row naming this user, requiring an explicit
 * accept/decline. Nothing links this account to a coach's roster until
 * the person actually clicks a button here — see acceptInvite for why
 * that matters (a coach shouldn't be able to link themselves to someone
 * just because that person happened to sign in for unrelated reasons).
 */
export function PendingInvites({ invites, userId }: PendingInvitesProps) {
  const router = useRouter();
  const [list, setList] = useState(invites);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept(coachClientId: string) {
    setBusyId(coachClientId);
    setError(null);
    const supabase = createClient();
    const { error: acceptError } = await acceptInvite(supabase, { coachClientId, userId });
    setBusyId(null);

    if (acceptError) {
      setError(acceptError);
      return;
    }
    setList((prev) => prev.filter((i) => i.id !== coachClientId));
    router.refresh();
  }

  async function handleDecline(coachClientId: string) {
    setBusyId(coachClientId);
    setError(null);
    const supabase = createClient();
    const { error: declineError } = await declineInvite(supabase, coachClientId);
    setBusyId(null);

    if (declineError) {
      setError(declineError);
      return;
    }
    setList((prev) => prev.filter((i) => i.id !== coachClientId));
  }

  if (list.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-2">
      {list.map((invite) => (
        <Card key={invite.id} className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-primary" />
              <p className="text-sm text-foreground">
                <span className="font-medium">{invite.coach_email}</span> wants you as a client — they&apos;ll be
                able to build and assign you programs.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleDecline(invite.id)}
                disabled={busyId === invite.id}
              >
                Decline
              </Button>
              <Button type="button" size="sm" onClick={() => handleAccept(invite.id)} disabled={busyId === invite.id}>
                Accept
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {error && (
        <div className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
