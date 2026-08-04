"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { MealPlanCard } from "@/components/nutrition/meal-plan-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { removeAssignedMealPlan, setActiveMealPlan } from "@/lib/nutrition/mutations";
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
 * SharedProgramsSection exactly, now that setActiveMealPlan and
 * removeAssignedMealPlan (migration 0060) exist. canSend stays false here:
 * sending a copy edits/creates a meal plan, which only the owner (the
 * coach) can do — this section is always the *athlete's* view of plans a
 * coach owns.
 */
export function SharedMealPlansSection({ plans: initialPlans, userId }: SharedMealPlansSectionProps) {
  const router = useRouter();
  // Defensive, not just documentation: canSetActive/canDelete below assume
  // every card here belongs to the viewer as its athlete_id (never its
  // owner_id) — this guards that assumption instead of silently trusting
  // the caller's own filter.
  const [plans, setPlans] = useState(initialPlans.filter((p) => p.athlete_id === userId));
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<NutritionPlanSummary | null>(null);

  async function handleSetActive(planId: string) {
    const target = plans.find((p) => p.id === planId);
    if (!target) return;

    const previous = plans;
    setActiveError(null);
    setSettingActiveId(planId);
    setPlans((current) =>
      current.map((p) => (p.id === planId ? { ...p, is_active: true } : p.athlete_id === target.athlete_id ? { ...p, is_active: false } : p))
    );

    const supabase = createClient();
    const { error } = await setActiveMealPlan(supabase, planId);
    setSettingActiveId(null);
    if (error) {
      setPlans(previous);
      setActiveError(error);
      return;
    }
    router.refresh();
  }

  async function handleRemove() {
    if (!confirmTarget) return;
    const planId = confirmTarget.id;

    const previous = plans;
    setRemoveError(null);
    setRemovingId(planId);
    setPlans((current) => current.filter((p) => p.id !== planId));

    const supabase = createClient();
    const { error } = await removeAssignedMealPlan(supabase, planId);
    setRemovingId(null);
    setConfirmTarget(null);
    if (error) {
      setPlans(previous);
      setRemoveError(error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Shared meal plans</h2>

      {(activeError || removeError) && (
        <div className="mb-4 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{activeError || removeError}</p>
        </div>
      )}

      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your coach hasn&apos;t assigned you any meal plans yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <MealPlanCard
              key={plan.id}
              plan={plan}
              canSetActive={!plan.removed_by_athlete_at}
              settingActive={settingActiveId === plan.id}
              onSetActive={handleSetActive}
              canSend={false}
              sendingCopy={false}
              onSend={() => {}}
              canDelete={!plan.removed_by_athlete_at}
              deleting={removingId === plan.id}
              onDelete={(planId) => {
                const target = plans.find((p) => p.id === planId);
                if (target) setConfirmTarget(target);
              }}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleRemove}
        title="Remove meal plan?"
        description={`Remove "${confirmTarget?.name}"? This only removes your own copy — it won't affect your coach's original.`}
        confirmLabel="Remove"
      />
    </div>
  );
}
