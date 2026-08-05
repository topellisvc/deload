import type {
  Food,
  Meal,
  MealItem,
  MealOption,
  MealTemplate,
  MealTemplateItem,
  NutritionDay,
  NutritionPlan,
  PlanTemplate,
  PlanTemplateDay,
  PlanTemplateMeal,
} from "@/lib/supabase/types";

export type { Food, Meal, MealItem, MealOption, MealTemplate, MealTemplateItem, NutritionDay, NutritionPlan, PlanTemplate, PlanTemplateDay, PlanTemplateMeal };

/**
 * The full nested shape the meal plan builder works with — fetched once
 * server-side (queries.ts stitches it together from flat table reads) and
 * mutated locally as the source of truth for the UI, with each edit fired
 * off to Supabase in the background (mutations.ts). Mirrors
 * lib/programs/types.ts's ProgramTree/WeekRow/DayRow/... nesting pattern,
 * just one layer flatter (no weeks — see migration 0058's header for why).
 */
export interface MealItemRow extends MealItem {
  /** Resolved from the foods table at fetch time — always present once
   * loaded through getMealPlanTree; a MealItemRow should never exist in the
   * builder's in-memory tree without its food already joined in, since
   * every macro total the UI shows is computed from this. */
  food: Food;
}

export interface MealOptionRow extends MealOption {
  items: MealItemRow[];
}

export interface MealRow extends Meal {
  options: MealOptionRow[];
}

export interface NutritionDayRow extends NutritionDay {
  meals: MealRow[];
}

export interface NutritionPlanTree extends NutritionPlan {
  days: NutritionDayRow[];
}

/** Lightweight shape for the nutrition list page — no nested tree needed. */
export interface NutritionPlanSummary extends NutritionPlan {
  dayCount: number;
  mealCount: number;
  /** e.g. "For jane@example.com" or "From coach@example.com" — null when
   * owner_id === athlete_id (self-built, the common case). Same convention
   * as ProgramSummary.assignmentLabel. */
  assignmentLabel: string | null;
}

/** Summed macros for one meal option, one day, or an entire plan — the
 * "running totals" half of Ellis's live-macro-tracking ask. Computed
 * client-side from quantity_g * food's per-100g values, never persisted. */
export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** A day's totals alongside its (possibly plan-inherited) targets, for the
 * builder's "X / Y target" display. */
export interface DayMacroSummary {
  totals: MacroTotals;
  targets: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  };
}

// ============================================================
// Meal/plan template library (migration 0062) — see lib/supabase/types.ts'
// own header comment on MealTemplate for the shape's rationale.
// ============================================================

export interface MealTemplateItemRow extends MealTemplateItem {
  /** Resolved from the foods table at fetch time, same guarantee
   * MealItemRow.food carries — every macro helper assumes it's present. */
  food: Food;
}

export interface MealTemplateWithItems extends MealTemplate {
  items: MealTemplateItemRow[];
}

export interface PlanTemplateMealRow extends PlanTemplateMeal {
  /** Denormalized at query time from the referenced meal_templates row —
   * just enough to render "Breakfast: Greek Yogurt & Berries Bowl" in the
   * plan-template picker without a second round trip per meal. */
  mealTemplateName: string;
  mealTemplateCategory: MealTemplate["category"];
}

export interface PlanTemplateDayRow extends PlanTemplateDay {
  meals: PlanTemplateMealRow[];
}

export interface PlanTemplateTree extends PlanTemplate {
  days: PlanTemplateDayRow[];
}
