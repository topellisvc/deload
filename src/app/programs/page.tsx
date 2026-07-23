import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProgramSummaries } from "@/lib/programs/queries";
import { getMyClients, resolvePendingInvites } from "@/lib/coaching/queries";
import { ProgramsList } from "@/components/programs/programs-list";

export const metadata: Metadata = {
  title: "Programs",
  robots: { index: false, follow: false },
};

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/programs");
  }

  // If a coach invited this email before this account existed (or before
  // they'd ever signed in), link the pending roster row to this user id
  // now that we have it. Cheap no-op after the first successful run — see
  // resolvePendingInvites for why this can't happen at invite time.
  if (user.email) {
    await resolvePendingInvites(supabase, user.id, user.email);
  }

  const programs = await getProgramSummaries(supabase, user.id);
  const clients = await getMyClients(supabase, user.id);
  const activeClients = clients.filter((c) => c.status === "active");

  return <ProgramsList programs={programs} userId={user.id} activeClients={activeClients} />;
}
