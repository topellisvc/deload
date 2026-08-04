"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Send, Star, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NutritionPlanTree } from "@/lib/nutrition/types";
import { daySummary, itemMacros, resolvedMealOption, sumMacros } from "@/lib/nutrition/macros";
import { selectMealOption } from "@/lib/nutrition/mutations";
import { SendMealPlanDialog } from "@/components/nutrition/send-meal-plan-dialog";
import { Button } from "@/components/ui/button";
import type { CoachClient } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface MealPlanViewerProps {
  plan: NutritionPlanTree;
  /** Only set (and only shown) when the viewer is the athlete on a
   * coach-assigned plan — mirrors ProgramViewer's own assignedByEmail. */
  assignedByEmail: string | null;
  currentUserId: string;
  activeClients: CoachClient[];
}

/**
 * The read-only landing page for a meal plan — the coach's own view and the
 * athlete's view both land here; structural editing (add/remove days,
 * meals, options, items) lives at /nutrition/[id]/edit, owner-only, same
 * split as ProgramViewer/ProgramBuilder.
 *
 * Unlike the builder (which shows every option side by side so a coach can
 * compare while editing — Ellis's explicit correction on the mockup), this
 * view shows only the meal's *current* option, with a tabbed swap toggle
 * when there's more than one — the athlete-facing mental model Ellis
 * confirmed was right. Tapping a tab is only wired to actually change the
 * selection for whoever's allowed to (the owner always; the athlete only
 * when allow_athlete_swap is set) — enforce_meal_update_permissions
 * (migration 0058) is the real backstop either way.
 */
export function MealPlanViewer({ plan: initialPlan, assignedByEmail, currentUserId, activeClients }: MealPlanViewerProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [plan, setPlan] = useState(initialPlan);
  const [selectedDayId, setSelectedDayId] = useState(initialPlan.days[0]?.id ?? "");
  const [sendOpen, setSendOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = plan.owner_id === currentUserId;
  const isAthlete = plan.athlete_id === currentUserId;
  const day = plan.days.find((d) => d.id === selectedDayId) ?? plan.days[0];

  function handleSelectOption(mealId: string, optionId: string) {
    setPlan((p) => ({
      ...p,
      days: p.days.map((d) => ({ ...d, meals: d.meals.map((meal) => (meal.id === mealId ? { ...meal, selected_option_id: optionId } : meal)) })),
    }));
    selectMealOption(supabase, { mealId, optionId }).then(({ error: e }) => {
      if (e) setError(e);
    });
  }

  if (!day) return null;
  const summary = daySummary(day, plan);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/nutrition" className="text-sm text-muted-foreground hover:text-foreground">
            ← Nutrition
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{plan.name}</h1>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSendOpen(true)}>
              <Send className="size-4" />
              Send a copy
            </Button>
            <Button onClick={() => router.push(`/nutrition/${plan.id}/edit`)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{error}</p>
        </div>
      )}

      {!isOwner && isAthlete && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground">Assigned by {assignedByEmail ?? "your coach"} — only they can edit its days and meals.</p>
        </div>
      )}

      {!isOwner && !isAthlete && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
          <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-foreground">Viewing as admin — read-only, no changes can be made from here.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {plan.days
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDayId(d.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                d.id === selectedDayId ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-surface-hover"
              )}
            >
              {d.label || `Day ${d.position}`}
            </button>
          ))}
      </div>

      <MacroSummaryBar summary={summary} />

      <div className="flex flex-col gap-4">
        {day.meals
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((meal) => {
            const current = resolvedMealOption(meal);
            const sortedOptions = [...meal.options].sort((a, b) => a.position - b.position);
            const canSwap = isOwner || (isAthlete && meal.allow_athlete_swap);
            const totals = current ? sumMacros(current.items.map(itemMacros)) : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

            return (
              <div key={meal.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-foreground">{meal.name}</h3>
                  {meal.allow_athlete_swap && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      Swappable
                    </span>
                  )}
                </div>

                {sortedOptions.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sortedOptions.map((option) => {
                      const isCurrent = option.id === current?.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={!canSwap}
                          onClick={() => handleSelectOption(meal.id, option.id)}
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            isCurrent ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                            canSwap && !isCurrent && "hover:bg-surface-hover",
                            !canSwap && "cursor-default opacity-70"
                          )}
                        >
                          {isCurrent && <Star className="size-3 fill-current" />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <ul className="flex flex-col gap-1.5">
                  {current?.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 text-sm text-foreground">
                      <span className="min-w-0 truncate">
                        {item.display_label || item.food.name}
                        <span className="text-muted-foreground"> · {item.quantity_g}g</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{Math.round(itemMacros(item).calories)} cal</span>
                    </li>
                  ))}
                  {(!current || current.items.length === 0) && <li className="text-xs text-muted-foreground">No foods added yet.</li>}
                </ul>

                {current && current.items.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Math.round(totals.calories)} cal · {Math.round(totals.protein_g)}p / {Math.round(totals.carbs_g)}c / {Math.round(totals.fat_g)}f
                  </p>
                )}
              </div>
            );
          })}
        {day.meals.length === 0 && <p className="text-sm text-muted-foreground">No meals added to this day yet.</p>}
      </div>

      {sendOpen && (
        <SendMealPlanDialog open onClose={() => setSendOpen(false)} plan={plan} currentUserId={currentUserId} activeClients={activeClients} />
      )}
    </div>
  );
}

function MacroSummaryBar({ summary }: { summary: ReturnType<typeof daySummary> }) {
  const rows: { label: string; total: number; target: number | null }[] = [
    { label: "Calories", total: summary.totals.calories, target: summary.targets.calories },
    { label: "Protein", total: summary.totals.protein_g, target: summary.targets.protein_g },
    { label: "Carbs", total: summary.totals.carbs_g, target: summary.targets.carbs_g },
    { label: "Fat", total: summary.totals.fat_g, target: summary.targets.fat_g },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4">
      {rows.map((row) => {
        const pct = row.target ? Math.min(100, Math.round((row.total / row.target) * 100)) : null;
        return (
          <div key={row.label} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
            <span className="text-sm font-semibold text-foreground">
              {Math.round(row.total)}
              {row.target != null && <span className="font-normal text-muted-foreground"> / {Math.round(row.target)}</span>}
            </span>
            {pct !== null && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
