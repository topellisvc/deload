"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MealPlanCard } from "@/components/nutrition/meal-plan-card";
import { NewMealPlanDialog } from "@/components/nutrition/new-meal-plan-dialog";
import { SendMealPlanDialog } from "@/components/nutrition/send-meal-plan-dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteMealPlan, setActiveMealPlan } from "@/lib/nutrition/mutations";
import { getMealPlanTree } from "@/lib/nutrition/queries";
import type { NutritionPlanSummary, NutritionPlanTree } from "@/lib/nutrition/types";
import type { CoachClient } from "@/lib/supabase/types";

interface ClientMealPlansProps {
  coachId: string;
  client: CoachClient;
  plans: NutritionPlanSummary[];
  activeClients: CoachClient[];
}

/**
 * One client's own meal plans — the Nutrition tab on AthleteDetailPanel.
 * Mirrors ClientDetail (programs) exactly, including the "set active"
 * control.
 */
export function ClientMealPlans({ coachId, client, plans: initialPlans, activeClients }: ClientMealPlansProps) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [loadingSendId, setLoadingSendId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<NutritionPlanTree | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  async function handleSend(planId: string) {
    setSendError(null);
    setLoadingSendId(planId);
    const supabase = createClient();
    const tree = await getMealPlanTree(supabase, planId);
    setLoadingSendId(null);
    if (!tree) {
      setSendError("Couldn't load this meal plan to copy it.");
      return;
    }
    setSendTarget(tree);
  }

  function handleDeleteClick(planId: string) {
    const target = plans.find((p) => p.id === planId);
    if (target) setConfirmTarget(target);
  }

  async function handleDelete() {
    if (!confirmTarget) return;
    const planId = confirmTarget.id;
    const previous = plans;
    setDeleteError(null);
    setDeletingId(planId);
    setPlans((current) => current.filter((p) => p.id !== planId));

    const supabase = createClient();
    const { error } = await deleteMealPlan(supabase, planId);
    setDeletingId(null);
    setConfirmTarget(null);
    if (error) {
      setPlans(previous);
      setDeleteError(error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus className="size-4" />
          New meal plan
        </Button>
      </div>

      {(activeError || sendError || deleteError) && (
        <div className="mb-6 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{activeError || sendError || deleteError}</p>
        </div>
      )}

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <UtensilsCrossed className="size-8 text-muted-foreground" />
            <p className="text-foreground">No meal plans assigned yet.</p>
            <p className="text-sm text-muted-foreground">Create one for them, or open an existing meal plan and send them a copy.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {plans.map((plan) => (
            <MealPlanCard
              key={plan.id}
              plan={plan}
              // A client who removed their assigned copy is no longer
              // using it — reactivating it for them without their say-so
              // would be surprising, same guard ClientDetail's own
              // ProgramCard usage applies.
              canSetActive={!plan.removed_by_athlete_at}
              settingActive={settingActiveId === plan.id}
              onSetActive={handleSetActive}
              canSend
              sendingCopy={loadingSendId === plan.id}
              onSend={handleSend}
              canDelete
              deleting={deletingId === plan.id}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      <NewMealPlanDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        userId={coachId}
        activeClients={activeClients}
        defaultAthleteId={client.client_id ?? undefined}
      />

      {sendTarget && (
        <SendMealPlanDialog open={!!sendTarget} onClose={() => setSendTarget(null)} plan={sendTarget} currentUserId={coachId} activeClients={activeClients} />
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleDelete}
        title="Delete meal plan?"
        description={`Delete "${confirmTarget?.name}"? This removes every day and meal in it — this can't be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
