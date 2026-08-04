"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NewMealPlanDialog } from "@/components/nutrition/new-meal-plan-dialog";
import { SendMealPlanDialog } from "@/components/nutrition/send-meal-plan-dialog";
import { MealPlanCard } from "@/components/nutrition/meal-plan-card";
import { createClient } from "@/lib/supabase/client";
import { deleteMealPlan } from "@/lib/nutrition/mutations";
import { getMealPlanTree } from "@/lib/nutrition/queries";
import type { NutritionPlanSummary, NutritionPlanTree } from "@/lib/nutrition/types";
import type { CoachClient } from "@/lib/supabase/types";

interface MealPlansListProps {
  plans: NutritionPlanSummary[];
  userId: string;
  activeClients: CoachClient[];
}

/** Mirrors ProgramsList, minus templates/starter-plan pickers/AI generation
 * — none of those exist for meal plans yet. Same own/client-section split
 * and card grid. */
export function MealPlansList({ plans: initialPlans, userId, activeClients }: MealPlansListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [plans, setPlans] = useState(initialPlans);
  const [loadingSendId, setLoadingSendId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<NutritionPlanTree | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<NutritionPlanSummary | null>(null);

  // MealPlanCard only has the lightweight NutritionPlanSummary shape — a
  // one-time full-tree fetch before SendMealPlanDialog can clone it, same
  // reasoning as ProgramsList's own handleSend.
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
    const target = confirmTarget;
    if (!target) return;
    const planId = target.id;
    const previous = plans;
    setDeleteError(null);
    setDeletingId(planId);
    setPlans((current) => current.filter((p) => p.id !== planId));

    const supabase = createClient();
    // Owner-only for now — see MealPlanCard's own doc comment on
    // canDelete/removeAssignedMealPlan.
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

  const ownPlans = plans.filter((p) => !p.assignmentLabel?.startsWith("For "));
  const clientPlans = plans.filter((p) => p.assignmentLabel?.startsWith("For "));

  function renderGrid(list: NutritionPlanSummary[]) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((plan) => (
          <MealPlanCard
            key={plan.id}
            plan={plan}
            canSend={plan.owner_id === userId}
            sendingCopy={loadingSendId === plan.id}
            onSend={handleSend}
            canDelete={plan.owner_id === userId}
            deleting={deletingId === plan.id}
            onDelete={handleDeleteClick}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Nutrition</h1>
          <p className="text-muted-foreground">Build meal plans — days, meals, and swappable options, with live macro tracking.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="self-start sm:self-auto">
          <Plus className="size-4" />
          New meal plan
        </Button>
      </div>

      {(sendError || deleteError) && (
        <div className="mb-6 flex gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{sendError || deleteError}</p>
        </div>
      )}

      {plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <UtensilsCrossed className="size-8 text-muted-foreground" />
            <p className="text-foreground">You don&apos;t have any meal plans yet.</p>
            <p className="text-sm text-muted-foreground">Create one to start building out days and meals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          {ownPlans.length > 0 && (
            <section>
              {clientPlans.length > 0 && <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Your meal plans</h2>}
              {renderGrid(ownPlans)}
            </section>
          )}
          {clientPlans.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">Client meal plans</h2>
              {renderGrid(clientPlans)}
            </section>
          )}
        </div>
      )}

      <NewMealPlanDialog open={dialogOpen} onClose={() => setDialogOpen(false)} userId={userId} activeClients={activeClients} />

      {sendTarget && (
        <SendMealPlanDialog open={!!sendTarget} onClose={() => setSendTarget(null)} plan={sendTarget} currentUserId={userId} activeClients={activeClients} />
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
