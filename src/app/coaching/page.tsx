import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyProfileDetails } from "@/lib/profile/queries";
import { getCoachingDashboard, getLinkedProfile, getMyClients, getMyCoaches, getPendingInvitesForMe } from "@/lib/coaching/queries";
import { getProgramSummaries } from "@/lib/programs/queries";
import { getConversationMessages } from "@/lib/messaging/queries";
import { PendingInvitations } from "@/components/coaching/pending-invitations";
import { YourCoachCard } from "@/components/coaching/your-coach-card";
import { SharedProgramsSection } from "@/components/coaching/shared-programs-section";
import { RecentFeedbackSection } from "@/components/coaching/recent-feedback-section";
import { MessageThread } from "@/components/coaching/message-thread";
import { CoachingCoachView } from "@/components/coaching/coaching-coach-view";
import { BecomeCoachCta } from "@/components/coaching/become-coach-cta";

export const metadata: Metadata = {
  title: "Coaching",
  robots: { index: false, follow: false },
};

/**
 * The single hub for everything coach<->athlete: pending invitations up
 * top, then the athlete's view of their own coach(es) if they're coached,
 * then the coach's view of their own roster if they coach anyone. Both
 * views can render for the same person (a coach can also have their own
 * coach) — neither is an either/or with the other, matching the spec's
 * "If the logged-in user is being coached..." / "If the logged-in user
 * coaches athletes..." framing (independent conditions, not a switch).
 */
export default async function CoachingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/coaching");
  }

  const profile = await getMyProfileDetails(supabase, user.id);
  const isCoach = profile.role === "coach";

  const [pendingInvites, myCoaches, programs] = await Promise.all([
    getPendingInvitesForMe(supabase),
    getMyCoaches(supabase, user.id),
    getProgramSummaries(supabase, user.id),
  ]);

  const activeCoaches = myCoaches.filter((c) => c.status === "active" && c.client_id);
  const hasActiveCoaches = activeCoaches.length > 0;

  // Per-relationship profile + conversation lookups, fetched together
  // rather than sequentially — each relationship's card is independent of
  // the others.
  const [linkedProfiles, conversations] = await Promise.all([
    Promise.all(activeCoaches.map((c) => getLinkedProfile(supabase, c.coach_id))),
    Promise.all(activeCoaches.map((c) => getConversationMessages(supabase, c.id))),
  ]);

  let coachDashboard: Awaited<ReturnType<typeof getCoachingDashboard>> | null = null;
  let sentPendingInvites: Awaited<ReturnType<typeof getMyClients>> = [];
  let knownEmails: string[] = [];
  if (isCoach) {
    const [dashboard, clients] = await Promise.all([getCoachingDashboard(supabase, user.id), getMyClients(supabase, user.id)]);
    coachDashboard = dashboard;
    sentPendingInvites = clients.filter((c) => c.status === "pending");
    knownEmails = clients.map((c) => c.client_email);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Coaching</h1>
        <p className="text-muted-foreground">Everything about your coaching relationships, in one place.</p>
      </div>

      <PendingInvitations invites={pendingInvites} userId={user.id} />

      {hasActiveCoaches ? (
        <div className="flex flex-col gap-8">
          {activeCoaches.map((coach, i) => {
            const linkedProfile = linkedProfiles[i] ?? null;
            const sharedPrograms = programs.filter((p) => p.owner_id === coach.coach_id);
            const activeProgramCount = sharedPrograms.filter((p) => p.is_active).length;
            const messages = conversations[i] ?? [];
            const coachLabel = linkedProfile?.display_name || coach.coach_email;
            return (
              <div key={coach.id} className="flex flex-col gap-6">
                <YourCoachCard coach={coach} profile={linkedProfile} activeProgramCount={activeProgramCount} />
                <SharedProgramsSection programs={sharedPrograms} />
                <RecentFeedbackSection messages={messages} coachId={coach.coach_id} />
                <MessageThread
                  coachClientId={coach.id}
                  currentUserId={user.id}
                  otherPartyId={coach.coach_id}
                  otherPartyLabel={coachLabel}
                  initialMessages={messages}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
          <Users className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No coach assigned.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {pendingInvites.length > 0
              ? "Accept a pending invitation above to get started."
              : "You'll see your coach, shared programs, and messages here once a coach invites you."}
          </p>
        </div>
      )}

      {isCoach && coachDashboard ? (
        <CoachingCoachView
          coachId={user.id}
          coachEmail={user.email ?? null}
          dashboard={coachDashboard}
          sentPendingInvites={sentPendingInvites}
          knownEmails={knownEmails}
        />
      ) : (
        <BecomeCoachCta userId={user.id} />
      )}
    </div>
  );
}
