import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClients, getMyRole } from "@/lib/coaching/queries";
import { ClientsManager } from "@/components/clients/clients-manager";
import { UpgradePrompt } from "@/components/clients/upgrade-prompt";

export const metadata: Metadata = {
  title: "Clients",
  robots: { index: false, follow: false },
};

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/clients");
  }

  const role = await getMyRole(supabase, user.id);
  if (role !== "coach") {
    return <UpgradePrompt userId={user.id} />;
  }

  const clients = await getMyClients(supabase, user.id);

  return <ClientsManager clients={clients} coachId={user.id} coachEmail={user.email ?? null} />;
}
