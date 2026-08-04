import Link from "next/link";
import { CalendarDays, CheckCircle2, Send, Trash2, UserX, UsersRound, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NutritionPlanSummary } from "@/lib/nutrition/types";

interface MealPlanCardProps {
  plan: NutritionPlanSummary;
  /** The owner OR the assigned athlete can flip is_active (set_active_meal_plan,
   * migration 0060) — mirrors ProgramCard's own canSetActive. */
  canSetActive: boolean;
  settingActive: boolean;
  onSetActive: (planId: string) => void;
  /** Owner-only — sending a copy edits/creates a meal plan, same reasoning
   * as ProgramCard's canSend. */
  canSend: boolean;
  sendingCopy: boolean;
  onSend: (planId: string) => void;
  /** Owner OR assigned athlete (migration 0060's additive remove_assigned_meal_plan
   * RPC) — an athlete can remove their own copy of a coach-assigned plan.
   * Since every assigned plan is its own independent row (cloneMealPlan),
   * this can never affect the coach's original or another client's copy. */
  canDelete: boolean;
  deleting: boolean;
  onDelete: (planId: string) => void;
}

/** Mirrors ProgramCard, minus the discipline badge — meal plans have no
 * discipline concept. */
export function MealPlanCard({ plan, canSetActive, settingActive, onSetActive, canSend, sendingCopy, onSend, canDelete, deleting, onDelete }: MealPlanCardProps) {
  // Same "For X" convention as ProgramCard: a coach's combined list can
  // show several active plans at once (one per client) — that's normal,
  // not a bug, so it gets its own color/wording to make clear "active"
  // here means active *for that client*, not for the viewer.
  const activeForClient = plan.is_active && plan.assignmentLabel?.startsWith("For ") ? plan.assignmentLabel.slice(4) : null;

  return (
    <Link href={`/nutrition/${plan.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card
        className={cn(
          "transition-colors hover:bg-surface-hover",
          plan.is_active && (activeForClient ? "border-success/50" : "border-primary/50")
        )}
      >
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <UtensilsCrossed className="size-3.5" />
              Meal plan
            </span>
            {plan.is_active && (
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                  activeForClient ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
                )}
              >
                <CheckCircle2 className="size-3.5 shrink-0" />
                {activeForClient ? <span className="truncate">Active for {activeForClient}</span> : "Active"}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{plan.name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {plan.dayCount} {plan.dayCount === 1 ? "day" : "days"} · {plan.mealCount} {plan.mealCount === 1 ? "meal" : "meals"}
          </div>
          {plan.assignmentLabel && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary">
              <UsersRound className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{plan.assignmentLabel}</span>
            </div>
          )}
          {plan.removed_by_athlete_at && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <UserX className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {plan.assignmentLabel?.startsWith("For ") ? `Removed by ${plan.assignmentLabel.slice(4)}` : "Removed by the assigned athlete"} on{" "}
                {new Date(plan.removed_by_athlete_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {(canSetActive || canSend || canDelete) && (
            <div className="mt-1 flex flex-wrap gap-2">
              {canSetActive && !plan.is_active && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={settingActive}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSetActive(plan.id);
                  }}
                >
                  {settingActive ? "Setting active…" : "Set as active"}
                </Button>
              )}
              {canSend && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sendingCopy}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSend(plan.id);
                  }}
                >
                  <Send className="size-3.5" />
                  {sendingCopy ? "Loading…" : "Send a copy"}
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  className={cn("border-danger/30 text-danger hover:border-danger hover:bg-danger/10")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(plan.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
