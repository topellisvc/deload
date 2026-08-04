"use client";

import { useState } from "react";
import { MealPlanCard } from "@/components/nutrition/meal-plan-card";
import type { NutritionPlanSummary } from "@/lib/nutrition/types";

interface SharedMealPlansSectionProps {
  plans: NutritionPlanSummary[];
  /** Every plan passed in is one this coach assigned to *this* viewer (see
   * the /coaching page's own filter: owner_id === coach.coach_id), so the
   * viewer is always the athlete_id side. Mirrors SharedProgramsSection's
   * own userId prop/defensive filter. */
  userId: string;
}

/**
 * The athlete's view of meal plans a specific coach assigned them — mirrors
 * SharedProgramsSection, minus the set-active/remove actions that one
 * offers: no setActiveMealPlan or removeAssignedMealPlan RPC exists yet
 * (see lib/nutrition/mutations.ts's deleteMealPlan doc comment on the
 * latter), so this is view-only for now — MealPlanCard already links out to
 * /nutrition/[id], which is where the swap-toggle (if allowed) and macro
 * tracking actually live.
 */
export function SharedMealPlansSection({ plans: initialPlans, userId }: SharedMealPlansSectionProps) {
  const [plans] = useState(initialPlans.filter((p) => p.athlete_id === userId));

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Shared meal plans</h2>

      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your coach hasn&apos;t assigned you any meal plans yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <MealPlanCard key={plan.id} plan={plan} canSend={false} sendingCopy={false} onSend={() => {}} canDelete={false} deleting={false} onDelete={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}
