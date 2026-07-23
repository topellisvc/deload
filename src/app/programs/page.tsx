import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProgramSummaries } from "@/lib/programs/queries";
import { getMyClients } from "@/lib/coaching/queries";
import { ProgramsList } from "@/components/programs/programs-list";

export const metadata: Metadata = {
  title: "Programs",
  robots: { index: false, follow: false },
};

/**
 * Invitations and the "my coaches" roster used to surface here too — both
 * moved to /coaching as part of the Coaching hub, so this page now only
 * needs enough client data to power "assign to" pickers in the New
 * Program / Send a Copy dialogs.
 */
export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/programs");
  }

  const programs = await getProgramSummaries(supabase, user.id);
  const clients = await getMyClients(supabase, user.id);
  const activeClients = clients.filter((c) => c.status === "active");

  return <ProgramsList programs={programs} userId={user.id} activeClients={activeClients} />;
}
