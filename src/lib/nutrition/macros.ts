import type { DayMacroSummary, Food, MacroTotals, MealRow, NutritionDayRow, NutritionPlan } from "@/lib/nutrition/types";

/**
 * Which MealOption a meal is currently "showing" — the selected one if set
 * and it still belongs to this meal, otherwise whichever option sits at
 * position 1. A meal always has at least one option by construction (see
 * createMeal in mutations.ts), so this only returns undefined for a
 * malformed/empty meal that should never occur in practice.
 */
export function resolvedMealOption(meal: MealRow) {
  const sorted = [...meal.options].sort((a, b) => a.position - b.position);
  if (meal.selected_option_id) {
    const match = sorted.find((o) => o.id === meal.selected_option_id);
    if (match) return match;
  }
  return sorted[0];
}

const ZERO_MACROS: MacroTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

/** One line item's macros, scaled from the food's per-100g values by
 * quantity_g. Never reads display_label — that field is cosmetic only.
 * Takes just the two fields it needs (structural, not MealItemRow) so
 * MealTemplateItemRow — same shape, no meal_option_id/notes/created_at —
 * can reuse it too, for the Templates picker's own macro hint. */
export function itemMacros(item: { quantity_g: number; food: Food }): MacroTotals {
  const factor = item.quantity_g / 100;
  return {
    calories: item.food.calories * factor,
    protein_g: item.food.protein_g * factor,
    carbs_g: item.food.carbs_g * factor,
    fat_g: item.food.fat_g * factor,
  };
}

export function sumMacros(totals: MacroTotals[]): MacroTotals {
  return totals.reduce(
    (acc, t) => ({
      calories: acc.calories + t.calories,
      protein_g: acc.protein_g + t.protein_g,
      carbs_g: acc.carbs_g + t.carbs_g,
      fat_g: acc.fat_g + t.fat_g,
    }),
    ZERO_MACROS
  );
}

/** A meal's macros come from whichever option is currently resolved/selected
 * — never every option summed together, since only one is ever "the" meal
 * at a time (that's the whole point of the swap feature). */
export function mealMacros(meal: MealRow): MacroTotals {
  const option = resolvedMealOption(meal);
  return option ? sumMacros(option.items.map(itemMacros)) : ZERO_MACROS;
}

export function dayMacros(day: NutritionDayRow): MacroTotals {
  return sumMacros(day.meals.map(mealMacros));
}

/** A day's targets, falling back to the plan's own defaults for any field
 * the day hasn't overridden — see NutritionDay's column comments. */
export function dayTargets(day: NutritionDayRow, plan: NutritionPlan): DayMacroSummary["targets"] {
  return {
    calories: day.calories_target ?? plan.daily_calories_target,
    protein_g: day.protein_target_g ?? plan.daily_protein_target_g,
    carbs_g: day.carbs_target_g ?? plan.daily_carbs_target_g,
    fat_g: day.fat_target_g ?? plan.daily_fat_target_g,
  };
}

/** The builder's "X / Y target" display for one day — live running totals
 * (Ellis's explicit ask) paired with whatever targets actually apply. */
export function daySummary(day: NutritionDayRow, plan: NutritionPlan): DayMacroSummary {
  return { totals: dayMacros(day), targets: dayTargets(day, plan) };
}
