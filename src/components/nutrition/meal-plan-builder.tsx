"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Food } from "@/lib/supabase/types";
import type { NutritionPlanTree } from "@/lib/nutrition/types";
import { daySummary } from "@/lib/nutrition/macros";
import * as m from "@/lib/nutrition/mutations";
import { searchFoods } from "@/lib/nutrition/queries";
import { MealCard } from "@/components/nutrition/meal-card";
import { CustomFoodDialog } from "@/components/nutrition/custom-food-dialog";
import { InlineNumberField, InlineTextField } from "@/components/programs/inline-fields";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

/** Same "position isn't the same as count" reasoning as programs' own
 * nextPosition (program-builder.tsx) — deletes never renumber siblings
 * under `unique(parent_id, position)`, so a new row's position has to be
 * based on the real max, not items.length. */
function nextPosition(items: { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), 0) + 1;
}

function optionLetter(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

interface MealPlanBuilderProps {
  initialPlan: NutritionPlanTree;
}

/**
 * Owns the whole meal plan tree as local state, same optimistic-update
 * shape as ProgramBuilder (edit local state immediately, fire the matching
 * Supabase write in the background) — just flatter, since there's no weeks
 * layer here (migration 0058's header) and no drag-and-drop reordering for
 * v1: meals/options/items append at the end and stay there, which covers
 * the actual ask (build a day's meals, edit gram amounts, compare swap
 * options) without pulling in dnd-kit for a feature that doesn't need it
 * yet. Worth adding later the same way program-builder.tsx does it if
 * reordering turns out to matter in practice.
 */
export function MealPlanBuilder({ initialPlan }: MealPlanBuilderProps) {
  const supabase = useMemo(() => createClient(), []);
  const [plan, setPlan] = useState(initialPlan);
  const [selectedDayId, setSelectedDayId] = useState(initialPlan.days[0]?.id ?? "");
  const [nameDraft, setNameDraft] = useState(initialPlan.name);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState<string | null>(null);
  // Which meal option's "Add as custom food" was clicked, if any — the
  // dialog itself lives here (not in MealCard) since creating the food and
  // adding it to that option both need this component's own addMealItem
  // handler once the dialog resolves.
  const [customFoodRequest, setCustomFoodRequest] = useState<{ mealId: string; optionId: string; query: string } | null>(null);

  const search = useMemo(() => (query: string) => searchFoods(supabase, query), [supabase]);

  function fail(message: string) {
    setSaveError(message);
  }

  const day = plan.days.find((d) => d.id === selectedDayId) ?? plan.days[0];

  // ---- immutable tree-update helpers ----
  function updateDayState(dayId: string, updater: (d: NutritionPlanTree["days"][number]) => NutritionPlanTree["days"][number]) {
    setPlan((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? updater(d) : d)) }));
  }
  function updateMealState(dayId: string, mealId: string, updater: (meal: NutritionPlanTree["days"][number]["meals"][number]) => NutritionPlanTree["days"][number]["meals"][number]) {
    updateDayState(dayId, (d) => ({ ...d, meals: d.meals.map((meal) => (meal.id === mealId ? updater(meal) : meal)) }));
  }

  // ---- plan-level ----
  async function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === plan.name) {
      setNameDraft(plan.name);
      return;
    }
    setPlan((p) => ({ ...p, name: trimmed }));
    const { error } = await m.updateMealPlan(supabase, plan.id, { name: trimmed });
    if (error) fail(error);
  }

  function handlePlanTargetChange(field: "daily_calories_target" | "daily_protein_target_g" | "daily_carbs_target_g" | "daily_fat_target_g", value: number | null) {
    setPlan((p) => ({ ...p, [field]: value }));
    m.updateMealPlan(supabase, plan.id, { [field]: value }).then(({ error }) => {
      if (error) fail(error);
    });
  }

  // ---- days ----
  async function handleAddDay() {
    const { day: newDay, error } = await m.addDay(supabase, { planId: plan.id, position: nextPosition(plan.days), label: `Day ${plan.days.length + 1}` });
    if (error || !newDay) {
      fail(error ?? "Couldn't add a new day.");
      return;
    }
    setPlan((p) => ({ ...p, days: [...p.days, newDay] }));
    setSelectedDayId(newDay.id);
  }

  function handleDeleteDay(dayId: string) {
    if (plan.days.length <= 1) return;
    setPlan((p) => ({ ...p, days: p.days.filter((d) => d.id !== dayId) }));
    if (selectedDayId === dayId) {
      const remaining = plan.days.filter((d) => d.id !== dayId);
      setSelectedDayId(remaining[0]?.id ?? "");
    }
    setConfirmDeleteDay(null);
    m.deleteDay(supabase, dayId).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleUpdateDayLabel(dayId: string, label: string | null) {
    updateDayState(dayId, (d) => ({ ...d, label }));
    m.updateDay(supabase, dayId, { label }).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleUpdateDayTarget(
    dayId: string,
    field: "calories_target" | "protein_target_g" | "carbs_target_g" | "fat_target_g",
    value: number | null
  ) {
    updateDayState(dayId, (d) => ({ ...d, [field]: value }));
    m.updateDay(supabase, dayId, { [field]: value }).then(({ error }) => {
      if (error) fail(error);
    });
  }

  // ---- meals ----
  async function handleAddMeal(dayId: string) {
    const targetDay = plan.days.find((d) => d.id === dayId);
    if (!targetDay) return;
    const { meal, error } = await m.addMeal(supabase, { dayId, position: nextPosition(targetDay.meals), name: "New meal" });
    if (error || !meal) {
      fail(error ?? "Couldn't add meal.");
      return;
    }
    updateDayState(dayId, (d) => ({ ...d, meals: [...d.meals, meal] }));
  }

  function handleUpdateMeal(dayId: string, mealId: string, patch: { name?: string; notes?: string | null; allow_athlete_swap?: boolean }) {
    updateMealState(dayId, mealId, (meal) => ({ ...meal, ...patch }));
    m.updateMeal(supabase, mealId, patch).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleDeleteMeal(dayId: string, mealId: string) {
    updateDayState(dayId, (d) => ({ ...d, meals: d.meals.filter((meal) => meal.id !== mealId) }));
    m.deleteMeal(supabase, mealId).then(({ error }) => {
      if (error) fail(error);
    });
  }

  // ---- meal options ----
  async function handleAddOption(dayId: string, mealId: string) {
    const meal = plan.days.find((d) => d.id === dayId)?.meals.find((mm) => mm.id === mealId);
    if (!meal) return;
    const { option, error } = await m.addMealOption(supabase, {
      mealId,
      position: nextPosition(meal.options),
      label: `Option ${optionLetter(meal.options.length)}`,
    });
    if (error || !option) {
      fail(error ?? "Couldn't add option.");
      return;
    }
    updateMealState(dayId, mealId, (mm) => ({ ...mm, options: [...mm.options, option] }));
  }

  function handleUpdateOption(dayId: string, mealId: string, optionId: string, patch: { label?: string; notes?: string | null }) {
    updateMealState(dayId, mealId, (meal) => ({
      ...meal,
      options: meal.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
    }));
    m.updateMealOption(supabase, optionId, patch).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleDeleteOption(dayId: string, mealId: string, optionId: string) {
    const meal = plan.days.find((d) => d.id === dayId)?.meals.find((mm) => mm.id === mealId);
    if (!meal || meal.options.length <= 1) return;
    // Mirrors the DB's own `on delete set null` for meals.selected_option_id
    // (migration 0058) — clear it locally too so resolvedMealOption falls
    // back to position-1 immediately, no refetch needed.
    updateMealState(dayId, mealId, (mm) => ({
      ...mm,
      selected_option_id: mm.selected_option_id === optionId ? null : mm.selected_option_id,
      options: mm.options.filter((o) => o.id !== optionId),
    }));
    m.deleteMealOption(supabase, optionId).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleSelectOption(dayId: string, mealId: string, optionId: string) {
    updateMealState(dayId, mealId, (meal) => ({ ...meal, selected_option_id: optionId }));
    m.selectMealOption(supabase, { mealId, optionId }).then(({ error }) => {
      if (error) fail(error);
    });
  }

  // ---- meal items ----
  async function handleAddItem(dayId: string, mealId: string, optionId: string, food: Food, quantityG: number) {
    const option = plan.days.find((d) => d.id === dayId)?.meals.find((mm) => mm.id === mealId)?.options.find((o) => o.id === optionId);
    if (!option) return;
    const { item, error } = await m.addMealItem(supabase, { mealOptionId: optionId, position: nextPosition(option.items), food, quantityG });
    if (error || !item) {
      fail(error ?? "Couldn't add that food.");
      return;
    }
    updateMealState(dayId, mealId, (meal) => ({
      ...meal,
      options: meal.options.map((o) => (o.id === optionId ? { ...o, items: [...o.items, item] } : o)),
    }));
  }

  function handleUpdateItemQuantity(dayId: string, mealId: string, itemId: string, quantityG: number) {
    updateMealState(dayId, mealId, (meal) => ({
      ...meal,
      options: meal.options.map((o) => ({ ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, quantity_g: quantityG } : i)) })),
    }));
    m.updateMealItem(supabase, itemId, { quantity_g: quantityG }).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleDeleteItem(dayId: string, mealId: string, itemId: string) {
    updateMealState(dayId, mealId, (meal) => ({
      ...meal,
      options: meal.options.map((o) => ({ ...o, items: o.items.filter((i) => i.id !== itemId) })),
    }));
    m.deleteMealItem(supabase, itemId).then(({ error }) => {
      if (error) fail(error);
    });
  }

  function handleCustomFoodCreated(food: Food) {
    if (!customFoodRequest || !day) return;
    handleAddItem(day.id, customFoodRequest.mealId, customFoodRequest.optionId, food, food.default_serving_g ?? 100);
    setCustomFoodRequest(null);
  }

  if (!day) return null;

  const summary = daySummary(day, plan);

  return (
    <div className="flex flex-col gap-6">
      {saveError && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{saveError}</p>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <input
          aria-label="Meal plan name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          className="w-full rounded-md border border-transparent bg-transparent px-1 text-xl font-semibold text-foreground transition-colors hover:border-border focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
        />
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-medium text-muted-foreground">Daily targets</span>
          <InlineNumberField label="Daily calorie target" unit="cal" width="w-20" value={plan.daily_calories_target} min={0} onCommit={(v) => handlePlanTargetChange("daily_calories_target", v)} />
          <InlineNumberField label="Daily protein target" unit="p" width="w-16" value={plan.daily_protein_target_g} min={0} onCommit={(v) => handlePlanTargetChange("daily_protein_target_g", v)} />
          <InlineNumberField label="Daily carbs target" unit="c" width="w-16" value={plan.daily_carbs_target_g} min={0} onCommit={(v) => handlePlanTargetChange("daily_carbs_target_g", v)} />
          <InlineNumberField label="Daily fat target" unit="f" width="w-16" value={plan.daily_fat_target_g} min={0} onCommit={(v) => handlePlanTargetChange("daily_fat_target_g", v)} />
        </div>
      </div>

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
        <button
          type="button"
          onClick={handleAddDay}
          className="flex items-center gap-1 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add day
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <InlineTextField label="Day label" value={day.label} onCommit={(v) => handleUpdateDayLabel(day.id, v)} className="max-w-xs font-medium" placeholder={`Day ${day.position}`} />
            <div className="flex flex-wrap items-center gap-3">
              <InlineNumberField label="Day calorie target override" unit="cal" width="w-20" value={day.calories_target} min={0} onCommit={(v) => handleUpdateDayTarget(day.id, "calories_target", v)} />
              <InlineNumberField label="Day protein target override" unit="p" width="w-16" value={day.protein_target_g} min={0} onCommit={(v) => handleUpdateDayTarget(day.id, "protein_target_g", v)} />
              <InlineNumberField label="Day carbs target override" unit="c" width="w-16" value={day.carbs_target_g} min={0} onCommit={(v) => handleUpdateDayTarget(day.id, "carbs_target_g", v)} />
              <InlineNumberField label="Day fat target override" unit="f" width="w-16" value={day.fat_target_g} min={0} onCommit={(v) => handleUpdateDayTarget(day.id, "fat_target_g", v)} />
            </div>
          </div>
          {plan.days.length > 1 && (
            <button
              type="button"
              onClick={() => setConfirmDeleteDay(day.id)}
              aria-label="Delete day"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        <MacroSummaryBar summary={summary} />

        <div className="flex flex-col gap-4">
          {day.meals
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                search={search}
                onUpdateMeal={(patch) => handleUpdateMeal(day.id, meal.id, patch)}
                onDeleteMeal={() => handleDeleteMeal(day.id, meal.id)}
                onAddOption={() => handleAddOption(day.id, meal.id)}
                onUpdateOption={(optionId, patch) => handleUpdateOption(day.id, meal.id, optionId, patch)}
                onDeleteOption={(optionId) => handleDeleteOption(day.id, meal.id, optionId)}
                onSelectOption={(optionId) => handleSelectOption(day.id, meal.id, optionId)}
                onAddItem={(optionId, food, quantityG) => handleAddItem(day.id, meal.id, optionId, food, quantityG)}
                onUpdateItemQuantity={(itemId, quantityG) => handleUpdateItemQuantity(day.id, meal.id, itemId, quantityG)}
                onDeleteItem={(itemId) => handleDeleteItem(day.id, meal.id, itemId)}
                onRequestCustomFood={(optionId, query) => setCustomFoodRequest({ mealId: meal.id, optionId, query })}
              />
            ))}
        </div>

        <Button type="button" variant="secondary" onClick={() => handleAddMeal(day.id)} className="w-fit">
          <Plus className="size-4" />
          Add meal
        </Button>
      </div>

      {confirmDeleteDay && (
        <ConfirmDialog
          open
          onClose={() => setConfirmDeleteDay(null)}
          onConfirm={() => handleDeleteDay(confirmDeleteDay)}
          title="Delete day?"
          description="Delete this day and everything in it? This can't be undone."
          confirmLabel="Delete"
        />
      )}

      {customFoodRequest && (
        <CustomFoodDialog
          open
          onClose={() => setCustomFoodRequest(null)}
          ownerId={plan.owner_id}
          initialName={customFoodRequest.query}
          onCreated={handleCustomFoodCreated}
        />
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
