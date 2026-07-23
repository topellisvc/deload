import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClientLastActivity, getMyClients, getMyRole } from "@/lib/coaching/queries";
import { getRecentActivity } from "@/lib/dashboard/queries";
import { getProgramsForClient } from "@/lib/programs/queries";
import { getConversationMessages } from "@/lib/messaging/queries";
import { ClientDetail } from "@/components/clients/client-detail";
import { RecentActivitySection } from "@/components/dashboard/recent-activity-section";
import { NotesSection } from "@/components/coaching/notes-section";
import { MessageThread } from "@/components/coaching/message-thread";

export const metadata: Metadata = {
  title: "Athlete",
  robots: { index: false, follow: false },
};

interface AthletePageProps {
  params: Promise<{ id: string }>;
}

/**
 * The full per-athlete workspace the Coaching hub links out to: profile
 * summary + programs (ClientDetail, moved here unchanged from the old
 * /clients/[id] route), workout history, messages, and a notes
 * placeholder — everything the spec's "Client Detail" section calls for,
 * on one page instead of scattered across /clients and /programs.
 * `id` is the athlete's user id (coach_clients.client_id), not the
 * coach_clients row id.
 */
export default async function AthletePage({ params }: AthletePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/coaching/athletes/${id}`);
  }

  // getMyClients doesn't depend on the role check's result, only on the
  // gate passing — run both concurrently and check afterward. Worst case
  // (someone who isn't a coach) fetches one extra query that goes unused;
  // best case (the common path) saves a full round-trip.
  const [role, clients] = await Promise.all([getMyRole(supabase, user.id), getMyClients(supabase, user.id)]);
  if (role !== "coach") notFound();

  const client = clients.find((c) => c.client_id === id && c.status === "active");
  // Covers both "not actually one of this coach's clients" and "invite
  // still pending" (no linked user yet, so there's nothing here to show).
  if (!client) notFound();

  const [programs, lastActivityOn, activityEvents, messages] = await Promise.all([
    getProgramsForClient(supabase, user.id, id),
    getClientLastActivity(supabase, id),
    getRecentActivity(supabase, id),
    getConversationMessages(supabase, client.id),
  ]);

  const activeClients = clients.filter((c) => c.status === "active");

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <Link
        href="/coaching"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Coaching
      </Link>

      <div className="flex flex-col gap-8">
        <ClientDetail coachId={user.id} client={client} programs={programs} lastActivityOn={lastActivityOn} activeClients={activeClients} />

        <RecentActivitySection events={activityEvents} title="Workout history" />

        <MessageThread
          coachClientId={client.id}
          currentUserId={user.id}
          otherPartyId={id}
          otherPartyLabel={client.client_email}
          initialMessages={messages}
        />

        <NotesSection />
      </div>
    </div>
  );
}
