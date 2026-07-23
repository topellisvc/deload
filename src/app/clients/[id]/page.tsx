import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientLastActivity, getMyClients, getMyRole } from "@/lib/coaching/queries";
import { getProgramsForClient } from "@/lib/programs/queries";
import { ClientDetail } from "@/components/clients/client-detail";

export const metadata: Metadata = {
  title: "Client",
  robots: { index: false, follow: false },
};

interface ClientPageProps {
  params: Promise<{ id: string }>;
}

/**
 * One client's page — programs assigned to them, editable/sendable from
 * here instead of hunting through the flat /programs list. `id` is the
 * client's user id (coach_clients.client_id), not the coach_clients row id.
 */
export default async function ClientPage({ params }: ClientPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/clients/${id}`);
  }

  const role = await getMyRole(supabase, user.id);
  if (role !== "coach") notFound();

  const clients = await getMyClients(supabase, user.id);
  const client = clients.find((c) => c.client_id === id && c.status === "active");
  // Covers both "not actually one of this coach's clients" and "invite
  // still pending" (no linked user yet, so there's nothing here to show).
  if (!client) notFound();

  const [programs, lastActivityOn] = await Promise.all([
    getProgramsForClient(supabase, user.id, id),
    getClientLastActivity(supabase, id),
  ]);

  const activeClients = clients.filter((c) => c.status === "active");

  return (
    <ClientDetail
      coachId={user.id}
      client={client}
      programs={programs}
      lastActivityOn={lastActivityOn}
      activeClients={activeClients}
    />
  );
}
