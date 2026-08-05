import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMealPlanTree, getMealTemplates } from "@/lib/nutrition/queries";
import { MealPlanBuilder } from "@/components/nutrition/meal-plan-builder";

export const metadata: Metadata = {
  title: "Edit meal plan",
  robots: { index: false, follow: false },
};

interface EditMealPlanPageProps {
  params: Promise<{ id: string }>;
}

/** Mirrors app/programs/[id]/edit/page.tsx — owner-only structural editing. */
export default async function EditMealPlanPage({ params }: EditMealPlanPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?redirect_to=/nutrition/${id}/edit`);
  }

  const plan = await getMealPlanTree(supabase, id);
  if (!plan) notFound();

  if (plan.owner_id !== user.id) {
    redirect(`/nutrition/${id}`);
  }

  const mealTemplates = await getMealTemplates(supabase);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <MealPlanBuilder initialPlan={plan} mealTemplates={mealTemplates} />
    </div>
  );
}
