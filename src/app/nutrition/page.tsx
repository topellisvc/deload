import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMealPlanSummaries } from "@/lib/nutrition/queries";
import { getMyClients } from "@/lib/coaching/queries";
import { MealPlansList } from "@/components/nutrition/meal-plans-list";

export const metadata: Metadata = {
  title: "Nutrition",
  robots: { index: false, follow: false },
};

/** Mirrors app/programs/page.tsx — this only needs enough client data to
 * power the "assign to" picker in New Meal Plan / Send a Copy. */
export default async function NutritionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?redirect_to=/nutrition");
  }

  const [plans, clients] = await Promise.all([getMealPlanSummaries(supabase, user.id), getMyClients(supabase, user.id)]);
  const activeClients = clients.filter((c) => c.status === "active");

  return <MealPlansList plans={plans} userId={user.id} activeClients={activeClients} />;
}
