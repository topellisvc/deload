import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMealPlanTree } from "@/lib/nutrition/queries";
import { getCoachEmail, getMyClients } from "@/lib/coaching/queries";
import { MealPlanViewer } from "@/components/nutrition/meal-plan-viewer";

export const metadata: Metadata = {
  title: "Meal plan",
  robots: { index: false, follow: false },
};

interface MealPlanPageProps {
  params: Promise<{ id: string }>;
}

/** Mirrors app/programs/[id]/page.tsx — the default landing page for any
 * meal plan, read-only for everyone; structural editing lives at
 * /nutrition/[id]/edit, owner-only. */
export default async function MealPlanPage({ params }: MealPlanPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/nutrition/${id}`);
  }

  // RLS means a plan another user owns simply won't come back here — no
  // separate "forbidden" case, just "not found".
  const plan = await getMealPlanTree(supabase, id);
  if (!plan) notFound();

  const [assignedByEmail, clients] = await Promise.all([
    plan.owner_id !== user.id ? getCoachEmail(supabase, { coachId: plan.owner_id, clientId: user.id }) : Promise.resolve(null),
    getMyClients(supabase, user.id),
  ]);
  const activeClients = clients.filter((c) => c.status === "active");

  return <MealPlanViewer plan={plan} assignedByEmail={assignedByEmail} currentUserId={user.id} activeClients={activeClients} />;
}
