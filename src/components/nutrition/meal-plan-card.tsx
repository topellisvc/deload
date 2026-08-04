import Link from "next/link";
import { CalendarDays, Send, Trash2, UserX, UsersRound, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NutritionPlanSummary } from "@/lib/nutrition/types";

interface MealPlanCardProps {
  plan: NutritionPlanSummary;
  /** Owner-only — sending a copy edits/creates a meal plan, same reasoning
   * as ProgramCard's canSend. */
  canSend: boolean;
  sendingCopy: boolean;
  onSend: (planId: string) => void;
  /** Owner OR assigned athlete — an athlete can remove their own copy of a
   * coach-assigned plan. No removeAssignedMealPlan RPC exists yet (see
   * lib/nutrition/mutations.ts's deleteMealPlan doc comment) — for now this
   * only ever fires for the owner; the prop stays generically named to
   * match ProgramCard's shape for when that gap gets filled in. */
  canDelete: boolean;
  deleting: boolean;
  onDelete: (planId: string) => void;
}

/** Mirrors ProgramCard, minus the discipline badge and "set active" control
 * — meal plans have no discipline concept, and nothing reads
 * nutrition_plans.is_active yet (no Training-Mode equivalent consuming a
 * "current" meal plan), so surfacing an activate button here would toggle a
 * column nothing else looks at. Worth adding alongside whatever eventually
 * reads it. */
export function MealPlanCard({ plan, canSend, sendingCopy, onSend, canDelete, deleting, onDelete }: MealPlanCardProps) {
  return (
    <Link href={`/nutrition/${plan.id}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="transition-colors hover:bg-surface-hover">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UtensilsCrossed className="size-3.5" />
            Meal plan
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
          {(canSend || canDelete) && (
            <div className="mt-1 flex flex-wrap gap-2">
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
