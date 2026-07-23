"use client";

import { useState } from "react";
import { ClientOverviewSection } from "@/components/coaching/client-overview-section";
import { ClientListSection } from "@/components/coaching/client-list-section";
import { InviteClientForm } from "@/components/coaching/invite-client-form";
import { PendingSentInvites } from "@/components/coaching/pending-sent-invites";
import type { CoachingDashboardData } from "@/lib/coaching/types";
import type { CoachClient } from "@/lib/supabase/types";

interface CoachingCoachViewProps {
  coachId: string;
  coachEmail: string | null;
  dashboard: CoachingDashboardData;
  sentPendingInvites: CoachClient[];
  knownEmails: string[];
}

/**
 * Everything a coach manages about their athletes, as one client
 * component so invite-form state, the "awaiting response" list, and the
 * dup-email check all stay in sync with each other — mirrors the same
 * single-orchestrator pattern ProgramsList already uses for its own
 * cross-component state.
 */
export function CoachingCoachView({
  coachId,
  coachEmail,
  dashboard,
  sentPendingInvites: initialSent,
  knownEmails: initialKnownEmails,
}: CoachingCoachViewProps) {
  const [sentInvites, setSentInvites] = useState(initialSent);
  const [knownEmails, setKnownEmails] = useState(initialKnownEmails);

  function handleInvited(invite: CoachClient) {
    setSentInvites((prev) => [invite, ...prev]);
    setKnownEmails((prev) => [...prev, invite.client_email]);
  }

  function handleCancelled(id: string) {
    setSentInvites((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coaching athletes</h2>
      <ClientOverviewSection data={dashboard} />
      <InviteClientForm coachId={coachId} coachEmail={coachEmail} existingEmails={knownEmails} onInvited={handleInvited} />
      <PendingSentInvites invites={sentInvites} onCancelled={handleCancelled} />
      <ClientListSection clients={dashboard.clients} />
    </div>
  );
}
