"use client";

import { Check, Plus, Star, Trash2, Users, X } from "lucide-react";
import type { Food } from "@/lib/supabase/types";
import type { MealItemRow, MealRow } from "@/lib/nutrition/types";
import { itemMacros, resolvedMealOption, sumMacros } from "@/lib/nutrition/macros";
import { FoodSearchField } from "@/components/nutrition/food-search-field";
import { InlineNumberField, InlineTextField } from "@/components/programs/inline-fields";
import { cn } from "@/lib/utils";

interface MealCardProps {
  meal: MealRow;
  search: (query: string) => Promise<Food[]>;
  onUpdateMeal: (patch: { name?: string; notes?: string | null; allow_athlete_swap?: boolean }) => void;
  onDeleteMeal: () => void;
  onAddOption: () => void;
  onUpdateOption: (optionId: string, patch: { label?: string; notes?: string | null }) => void;
  onDeleteOption: (optionId: string) => void;
  onSelectOption: (optionId: string) => void;
  onAddItem: (optionId: string, food: Food, quantityG: number) => void;
  onUpdateItemQuantity: (itemId: string, quantityG: number) => void;
  onDeleteItem: (itemId: string) => void;
  onRequestCustomFood: (optionId: string, query: string) => void;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * One meal slot ("Breakfast," "Lunch"). Per Ellis's direct feedback on the
 * mockup ("coach should show all at once"): every option renders
 * side-by-side here, unlike the athlete-facing tabbed swap toggle — a coach
 * building the plan needs to compare options while editing them, not pick
 * one at a time. `allow_athlete_swap` only controls whether the athlete
 * later gets that toggle; it has no effect on this view.
 */
export function MealCard({
  meal,
  search,
  onUpdateMeal,
  onDeleteMeal,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onSelectOption,
  onAddItem,
  onUpdateItemQuantity,
  onDeleteItem,
  onRequestCustomFood,
}: MealCardProps) {
  const defaultOption = resolvedMealOption(meal);
  const sortedOptions = [...meal.options].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InlineTextField
          label="Meal name"
          value={meal.name}
          onCommit={(v) => onUpdateMeal({ name: v ?? meal.name })}
          className="max-w-xs text-base font-semibold"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={meal.allow_athlete_swap}
              onChange={(e) => onUpdateMeal({ allow_athlete_swap: e.target.checked })}
              className="size-3.5 rounded border-border-strong text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <Users className="size-3.5" />
            Athlete can swap options
          </label>
          <button
            type="button"
            onClick={onDeleteMeal}
            aria-label="Delete meal"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className={cn("grid gap-3", sortedOptions.length > 1 ? "sm:grid-cols-2" : "grid-cols-1")}>
        {sortedOptions.map((option) => {
          const isDefault = option.id === defaultOption?.id;
          const totals = sumMacros(option.items.map(itemMacros));
          return (
            <div
              key={option.id}
              className={cn("flex flex-col gap-2 rounded-lg border p-3", isDefault ? "border-primary/40 bg-primary/5" : "border-border")}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectOption(option.id)}
                    aria-pressed={isDefault}
                    title={isDefault ? "Default option" : "Make this the default option"}
                    className={cn(
                      "shrink-0 rounded-md p-1 transition-colors",
                      isDefault ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Star className={cn("size-4", isDefault && "fill-current")} />
                  </button>
                  <InlineTextField
                    label="Option label"
                    value={option.label}
                    onCommit={(v) => onUpdateOption(option.id, { label: v ?? option.label })}
                    className="text-sm font-medium"
                  />
                </div>
                {sortedOptions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteOption(option.id)}
                    aria-label={`Delete ${option.label}`}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <ul className="flex flex-col gap-1.5">
                {option.items.map((item) => (
                  <MealItemRowView key={item.id} item={item} onUpdateQuantity={onUpdateItemQuantity} onDelete={onDeleteItem} />
                ))}
                {option.items.length === 0 && <li className="text-xs text-muted-foreground">No foods added yet.</li>}
              </ul>

              <FoodSearchField
                onSelect={(food) => onAddItem(option.id, food, food.default_serving_g ?? 100)}
                search={search}
                onAddCustomFood={(query) => onRequestCustomFood(option.id, query)}
              />

              {option.items.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round(totals.calories)} cal · {round(totals.protein_g)}p / {round(totals.carbs_g)}c / {round(totals.fat_g)}f
                </p>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddOption}
        className="flex w-fit items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <Plus className="size-3.5" />
        Add another option
      </button>
    </div>
  );
}

function MealItemRowView({
  item,
  onUpdateQuantity,
  onDelete,
}: {
  item: MealItemRow;
  onUpdateQuantity: (itemId: string, quantityG: number) => void;
  onDelete: (itemId: string) => void;
}) {
  const macros = itemMacros(item);
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
      <Check className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.display_label || item.food.name}</span>
      <InlineNumberField
        label={`${item.food.name} quantity in grams`}
        unit="g"
        value={item.quantity_g}
        min={0}
        width="w-16"
        onCommit={(v) => {
          if (v !== null) onUpdateQuantity(item.id, v);
        }}
      />
      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{Math.round(macros.calories)} cal</span>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label={`Remove ${item.food.name}`}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
