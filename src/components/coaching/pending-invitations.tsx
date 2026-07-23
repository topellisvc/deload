"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { acceptInvite, declineInvite } from "@/lib/coaching/mutations";
import type { CoachClient } from "@/lib/supabase/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface PendingInvitationsProps {
  invites: CoachClient[];
  userId: string;
}

/**
 * Moved here from ProgramsList (was PendingInvites) — coaching invitations
 * now live only on /coaching, at the top of the page per spec. Reuses the
 * same acceptInvite/declineInvite mutations as before; this is a richer
 * presentational layer on top of them (coach identity, date sent, optional
 * message, an explanation of what accepting actually means), not a second
 * copy of the accept/decline logic.
 *
 * "Coach name" is shown as coach_email: the profiles RLS exception that
 * would expose a coach's display_name/bio only opens once client_id is
 * set (i.e. the invite is accepted) — see getLinkedProfile's comment.
 * Showing a name pulled from anywhere else pre-acceptance isn't possible
 * without loosening that policy, which is explicitly out of scope here.
 */
export function PendingInvitations({ invites, userId }: PendingInvitationsProps) {
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
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {list.length === 1 ? "Pending invitation" : `Pending invitations (${list.length})`}
      </h2>

      {list.map((invite) => (
        <Card key={invite.id} className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{invite.coach_email}</p>
                <p className="text-xs text-muted-foreground">Sent {formatDate(invite.created_at)}</p>
              </div>
            </div>

            {invite.invite_message && (
              <p className="rounded-lg border border-border bg-surface p-3 text-sm italic text-foreground">
                &ldquo;{invite.invite_message}&rdquo;
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              Accepting this invitation allows this coach to coach you within the platform. They&rsquo;ll be
              able to create and manage your training programs, review your workout logs, and monitor your
              progress. You can remove this relationship later.
            </p>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleDecline(invite.id)}
                disabled={busyId === invite.id}
              >
                Decline invitation
              </Button>
              <Button type="button" size="sm" onClick={() => handleAccept(invite.id)} disabled={busyId === invite.id}>
                Accept invitation
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
