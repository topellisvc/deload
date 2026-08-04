import type { SupabaseClient } from "@supabase/supabase-js";
import type { Food } from "@/lib/supabase/types";
import type { MealItemRow, MealOptionRow, MealRow, NutritionDayRow, NutritionPlanTree } from "@/lib/nutrition/types";
import { getMealPlanTree } from "@/lib/nutrition/queries";
import { notifyMealPlanAssigned } from "@/lib/notifications/mutations";

function newId(): string {
  return crypto.randomUUID();
}

// ============================================================
// Meal plans
// ============================================================

/**
 * Creates a brand-new meal plan with a single starter day ("Day 1") —
 * mirrors createProgram's own "one week, day skeleton" starting point, just
 * one day instead of a whole week of labelled days, since a meal plan's day
 * count isn't fixed up front the way a program's training split is (see
 * migration 0058's header on why there's no weeks layer here).
 */
export async function createMealPlan(
  supabase: SupabaseClient,
  params: { userId: string; name: string; athleteId?: string }
): Promise<{ plan: NutritionPlanTree | null; error: string | null }> {
  const planId = newId();
  const dayId = newId();
  const now = new Date().toISOString();
  const athleteId = params.athleteId ?? params.userId;

  const { error: planError } = await supabase.from("nutrition_plans").insert({
    id: planId,
    owner_id: params.userId,
    athlete_id: athleteId,
    name: params.name,
  });
  if (planError) return { plan: null, error: planError.message };

  const { error: dayError } = await supabase.from("nutrition_days").insert({
    id: dayId,
    plan_id: planId,
    position: 1,
    label: "Day 1",
  });
  if (dayError) return { plan: null, error: dayError.message };

  const plan: NutritionPlanTree = {
    id: planId,
    owner_id: params.userId,
    athlete_id: athleteId,
    name: params.name,
    notes: null,
    daily_calories_target: null,
    daily_protein_target_g: null,
    daily_carbs_target_g: null,
    daily_fat_target_g: null,
    is_active: false,
    removed_by_athlete_at: null,
    created_at: now,
    updated_at: now,
    days: [
      {
        id: dayId,
        plan_id: planId,
        position: 1,
        label: "Day 1",
        notes: null,
        calories_target: null,
        protein_target_g: null,
        carbs_target_g: null,
        fat_target_g: null,
        created_at: now,
        meals: [],
      },
    ],
  };

  // Only a real assignment to someone else counts as "a coach sent a meal
  // plan" — self-building (the default, athleteId omitted) never notifies
  // yourself. Same rule createProgram's own comment explains.
  if (athleteId !== params.userId) {
    await notifyMealPlanAssigned(supabase, { coachId: params.userId, athleteId, planId, planName: params.name });
  }

  return { plan, error: null };
}

/**
 * Deep-copies an entire meal plan (every day/meal/option/item) into a
 * brand-new plan row for `athleteId` — the same "copy, not share" send
 * model cloneProgram uses (lib/programs/mutations.ts), for the same
 * reason: each recipient gets their own independent, separately-editable
 * copy rather than N athletes reading one shared row.
 */
export async function cloneMealPlan(
  supabase: SupabaseClient,
  params: { sourcePlan: NutritionPlanTree; ownerId: string; athleteId: string; name: string }
): Promise<{ plan: NutritionPlanTree | null; error: string | null }> {
  const planId = newId();

  const { error: planError } = await supabase.from("nutrition_plans").insert({
    id: planId,
    owner_id: params.ownerId,
    athlete_id: params.athleteId,
    name: params.name,
    notes: params.sourcePlan.notes,
    daily_calories_target: params.sourcePlan.daily_calories_target,
    daily_protein_target_g: params.sourcePlan.daily_protein_target_g,
    daily_carbs_target_g: params.sourcePlan.daily_carbs_target_g,
    daily_fat_target_g: params.sourcePlan.daily_fat_target_g,
  });
  if (planError) return { plan: null, error: planError.message };

  // Sequential rather than Promise.all: a low-frequency action where
  // simplicity matters more than shaving round trips — same tradeoff
  // cloneProgram's own weekly loop makes.
  for (const day of params.sourcePlan.days) {
    const { error } = await cloneDayInto(supabase, { sourceDay: day, planId });
    if (error) return { plan: null, error };
  }

  const cloned = await getMealPlanTree(supabase, planId);
  if (!cloned) return { plan: null, error: "Meal plan was cloned, but couldn't be loaded back." };

  if (params.athleteId !== params.ownerId) {
    await notifyMealPlanAssigned(supabase, { coachId: params.ownerId, athleteId: params.athleteId, planId, planName: params.name });
  }

  return { plan: cloned, error: null };
}

/**
 * Clones one day's full contents (meals -> options -> items) with fresh ids
 * into `planId`. Options are inserted before the day's meals' own
 * selected_option_id can be restored — same "insert both halves of the
 * mutual meals<->meal_options reference, then patch the FK back in" order
 * migration 0058 itself uses for the schema's own circular dependency.
 */
async function cloneDayInto(supabase: SupabaseClient, params: { sourceDay: NutritionDayRow; planId: string }): Promise<{ error: string | null }> {
  const dayId = newId();
  const { error: dayError } = await supabase.from("nutrition_days").insert({
    id: dayId,
    plan_id: params.planId,
    position: params.sourceDay.position,
    label: params.sourceDay.label,
    notes: params.sourceDay.notes,
    calories_target: params.sourceDay.calories_target,
    protein_target_g: params.sourceDay.protein_target_g,
    carbs_target_g: params.sourceDay.carbs_target_g,
    fat_target_g: params.sourceDay.fat_target_g,
  });
  if (dayError) return { error: dayError.message };

  for (const meal of params.sourceDay.meals) {
    const mealId = newId();
    const { error: mealError } = await supabase.from("meals").insert({
      id: mealId,
      day_id: dayId,
      position: meal.position,
      name: meal.name,
      notes: meal.notes,
      allow_athlete_swap: meal.allow_athlete_swap,
    });
    if (mealError) return { error: mealError.message };

    let clonedSelectedOptionId: string | null = null;

    for (const option of meal.options) {
      const optionId = newId();
      const { error: optionError } = await supabase.from("meal_options").insert({
        id: optionId,
        meal_id: mealId,
        position: option.position,
        label: option.label,
        notes: option.notes,
      });
      if (optionError) return { error: optionError.message };

      if (meal.selected_option_id === option.id) clonedSelectedOptionId = optionId;

      if (option.items.length > 0) {
        const { error: itemsError } = await supabase.from("meal_items").insert(
          option.items.map((item) => ({
            id: newId(),
            meal_option_id: optionId,
            position: item.position,
            food_id: item.food_id,
            quantity_g: item.quantity_g,
            display_label: item.display_label,
            notes: item.notes,
          }))
        );
        if (itemsError) return { error: itemsError.message };
      }
    }

    if (clonedSelectedOptionId) {
      const { error: selectError } = await supabase.from("meals").update({ selected_option_id: clonedSelectedOptionId }).eq("id", mealId);
      if (selectError) return { error: selectError.message };
    }
  }

  return { error: null };
}

export async function updateMealPlan(
  supabase: SupabaseClient,
  planId: string,
  patch: {
    name?: string;
    notes?: string | null;
    daily_calories_target?: number | null;
    daily_protein_target_g?: number | null;
    daily_carbs_target_g?: number | null;
    daily_fat_target_g?: number | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("nutrition_plans")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", planId);
  return { error: error?.message ?? null };
}

/** Deletes a plan row outright — RLS restricts this to the plan's owner,
 * same as deleteProgram. Call sites should route the athlete's own
 * "delete/remove" action through removeAssignedMealPlan instead — this
 * one's for the owner clearing out a plan (theirs, or a leftover removed
 * client copy) for real. */
export async function deleteMealPlan(supabase: SupabaseClient, planId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("nutrition_plans").delete().eq("id", planId);
  return { error: error?.message ?? null };
}

/**
 * The athlete-side counterpart to deleteMealPlan: soft-removes their own
 * copy of a coach-assigned meal plan (migration 0060's
 * remove_assigned_meal_plan function) instead of deleting the row. Since
 * it's a SECURITY DEFINER function with its own auth.uid() = athlete_id
 * check (same pattern as set_active_meal_plan below), this can only ever
 * touch the caller's own assigned copy — never the coach's original or
 * another client's copy, same guarantee deleteMealPlan had, just without
 * erasing the coach's visibility into the assignment. Mirrors
 * removeAssignedProgram exactly.
 */
export async function removeAssignedMealPlan(supabase: SupabaseClient, planId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("remove_assigned_meal_plan", { p_plan_id: planId });
  return { error: error?.message ?? null };
}

/**
 * Makes `planId` the athlete's one active meal plan, deactivating whatever
 * was active before it. Goes through the `set_active_meal_plan` Postgres
 * function (migration 0060) rather than two separate client updates, so
 * there's never a window with zero or two active plans for the same
 * athlete — mirrors setActiveProgram exactly, including that either the
 * plan's owner (a coach) or its assigned athlete may call this.
 */
export async function setActiveMealPlan(supabase: SupabaseClient, planId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_active_meal_plan", { p_plan_id: planId });
  return { error: error?.message ?? null };
}

/**
 * Turns off a meal plan's active flag without making another one active —
 * "I don't want a dashboard right now" rather than "switch to a different
 * plan." No RPC needed: unlike activating, deactivating can't collide with
 * the one-active-per-athlete invariant, so a plain RLS-scoped update is
 * enough — mirrors deactivateProgram.
 */
export async function deactivateMealPlan(supabase: SupabaseClient, planId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("nutrition_plans").update({ is_active: false }).eq("id", planId);
  return { error: error?.message ?? null };
}

// ============================================================
// Days
// ============================================================

export async function addDay(
  supabase: SupabaseClient,
  params: { planId: string; position: number; label?: string | null }
): Promise<{ day: NutritionDayRow | null; error: string | null }> {
  const dayId = newId();
  const label = params.label ?? null;
  const { error } = await supabase.from("nutrition_days").insert({
    id: dayId,
    plan_id: params.planId,
    position: params.position,
    label,
  });
  if (error) return { day: null, error: error.message };
  return {
    day: {
      id: dayId,
      plan_id: params.planId,
      position: params.position,
      label,
      notes: null,
      calories_target: null,
      protein_target_g: null,
      carbs_target_g: null,
      fat_target_g: null,
      created_at: new Date().toISOString(),
      meals: [],
    },
    error: null,
  };
}

export async function updateDay(
  supabase: SupabaseClient,
  dayId: string,
  patch: {
    label?: string | null;
    notes?: string | null;
    calories_target?: number | null;
    protein_target_g?: number | null;
    carbs_target_g?: number | null;
    fat_target_g?: number | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("nutrition_days").update(patch).eq("id", dayId);
  return { error: error?.message ?? null };
}

/** Cascades to that day's meals/options/items at the DB level, same FK
 * cascade every other delete in this tree relies on. */
export async function deleteDay(supabase: SupabaseClient, dayId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("nutrition_days").delete().eq("id", dayId);
  return { error: error?.message ?? null };
}

/** Staged-negative-position reorder — same pattern as reorderBlocks/
 * reorderSets (lib/programs/mutations.ts): writing final positions
 * directly risks a transient collision with `unique(plan_id, position)`
 * if any two rows are swapping. */
export async function reorderDays(supabase: SupabaseClient, days: { id: string; position: number }[]): Promise<{ error: string | null }> {
  for (const day of days) {
    const tempPosition = -(1 + Math.floor(Math.random() * 1_000_000));
    const { error } = await supabase.from("nutrition_days").update({ position: tempPosition }).eq("id", day.id);
    if (error) return { error: error.message };
  }
  for (const day of days) {
    const { error } = await supabase.from("nutrition_days").update({ position: day.position }).eq("id", day.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}

// ============================================================
// Meals
// ============================================================

/** A meal is never created bare — it always gets a first MealOption
 * ("Option A") in the same call, since resolvedMealOption
 * (lib/nutrition/macros.ts) assumes every meal has at least one. */
export async function addMeal(
  supabase: SupabaseClient,
  params: { dayId: string; position: number; name: string }
): Promise<{ meal: MealRow | null; error: string | null }> {
  const mealId = newId();
  const optionId = newId();
  const now = new Date().toISOString();

  const { error: mealError } = await supabase.from("meals").insert({
    id: mealId,
    day_id: params.dayId,
    position: params.position,
    name: params.name,
  });
  if (mealError) return { meal: null, error: mealError.message };

  const { error: optionError } = await supabase.from("meal_options").insert({
    id: optionId,
    meal_id: mealId,
    position: 1,
    label: "Option A",
  });
  if (optionError) return { meal: null, error: optionError.message };

  return {
    meal: {
      id: mealId,
      day_id: params.dayId,
      position: params.position,
      name: params.name,
      notes: null,
      allow_athlete_swap: false,
      selected_option_id: null,
      created_at: now,
      options: [{ id: optionId, meal_id: mealId, position: 1, label: "Option A", notes: null, created_at: now, items: [] }],
    },
    error: null,
  };
}

export async function updateMeal(
  supabase: SupabaseClient,
  mealId: string,
  patch: { name?: string; notes?: string | null; allow_athlete_swap?: boolean }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("meals").update(patch).eq("id", mealId);
  return { error: error?.message ?? null };
}

export async function deleteMeal(supabase: SupabaseClient, mealId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("meals").delete().eq("id", mealId);
  return { error: error?.message ?? null };
}

export async function reorderMeals(supabase: SupabaseClient, meals: { id: string; position: number }[]): Promise<{ error: string | null }> {
  for (const meal of meals) {
    const tempPosition = -(1 + Math.floor(Math.random() * 1_000_000));
    const { error } = await supabase.from("meals").update({ position: tempPosition }).eq("id", meal.id);
    if (error) return { error: error.message };
  }
  for (const meal of meals) {
    const { error } = await supabase.from("meals").update({ position: meal.position }).eq("id", meal.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}

// ============================================================
// Meal options
// ============================================================

export async function addMealOption(
  supabase: SupabaseClient,
  params: { mealId: string; position: number; label: string }
): Promise<{ option: MealOptionRow | null; error: string | null }> {
  const optionId = newId();
  const { error } = await supabase.from("meal_options").insert({
    id: optionId,
    meal_id: params.mealId,
    position: params.position,
    label: params.label,
  });
  if (error) return { option: null, error: error.message };
  return {
    option: { id: optionId, meal_id: params.mealId, position: params.position, label: params.label, notes: null, created_at: new Date().toISOString(), items: [] },
    error: null,
  };
}

export async function updateMealOption(
  supabase: SupabaseClient,
  optionId: string,
  patch: { label?: string; notes?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("meal_options").update(patch).eq("id", optionId);
  return { error: error?.message ?? null };
}

/** Callers (the builder UI) should keep at least one option per meal —
 * nothing at the DB level stops deleting the last one, but resolvedMealOption
 * would then have nothing to resolve to, so the "delete option" action
 * should stay disabled/hidden whenever a meal has only one. */
export async function deleteMealOption(supabase: SupabaseClient, optionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("meal_options").delete().eq("id", optionId);
  return { error: error?.message ?? null };
}

/**
 * Sets which option is currently "the" version of a meal — the one
 * mutation both the coach and (when allow_athlete_swap is true) the
 * athlete themselves can call. RLS lets both roles reach an UPDATE on
 * meals; enforce_meal_update_permissions (migration 0058) is what actually
 * restricts an athlete's call to touching only this column, and only when
 * the meal allows it — see that trigger for the exact rules. A caller that
 * isn't allowed just gets a Postgres exception back as `error`.
 */
export async function selectMealOption(supabase: SupabaseClient, params: { mealId: string; optionId: string }): Promise<{ error: string | null }> {
  const { error } = await supabase.from("meals").update({ selected_option_id: params.optionId }).eq("id", params.mealId);
  return { error: error?.message ?? null };
}

// ============================================================
// Meal items
// ============================================================

/** `food` is the full Food row the caller already has in hand (from the
 * search field or a just-created custom food) — passed in rather than
 * re-fetched so the returned MealItemRow can be dropped straight into
 * local state with its macros immediately computable, no extra round
 * trip. */
export async function addMealItem(
  supabase: SupabaseClient,
  params: { mealOptionId: string; position: number; food: Food; quantityG: number; displayLabel?: string | null }
): Promise<{ item: MealItemRow | null; error: string | null }> {
  const itemId = newId();
  const { error } = await supabase.from("meal_items").insert({
    id: itemId,
    meal_option_id: params.mealOptionId,
    position: params.position,
    food_id: params.food.id,
    quantity_g: params.quantityG,
    display_label: params.displayLabel ?? null,
  });
  if (error) return { item: null, error: error.message };
  return {
    item: {
      id: itemId,
      meal_option_id: params.mealOptionId,
      position: params.position,
      food_id: params.food.id,
      quantity_g: params.quantityG,
      display_label: params.displayLabel ?? null,
      notes: null,
      created_at: new Date().toISOString(),
      food: params.food,
    },
    error: null,
  };
}

export async function updateMealItem(
  supabase: SupabaseClient,
  itemId: string,
  patch: { quantity_g?: number; display_label?: string | null; notes?: string | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("meal_items").update(patch).eq("id", itemId);
  return { error: error?.message ?? null };
}

export async function deleteMealItem(supabase: SupabaseClient, itemId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("meal_items").delete().eq("id", itemId);
  return { error: error?.message ?? null };
}

export async function reorderMealItems(supabase: SupabaseClient, items: { id: string; position: number }[]): Promise<{ error: string | null }> {
  for (const item of items) {
    const tempPosition = -(1 + Math.floor(Math.random() * 1_000_000));
    const { error } = await supabase.from("meal_items").update({ position: tempPosition }).eq("id", item.id);
    if (error) return { error: error.message };
  }
  for (const item of items) {
    const { error } = await supabase.from("meal_items").update({ position: item.position }).eq("id", item.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}

// ============================================================
// Foods
// ============================================================

/**
 * "Import foods that aren't in the database" — a coach adding their own
 * food straight from the meal builder when a search comes up empty.
 * owner_id = the coach, so RLS scopes it to only ever be visible to them
 * (mirrors exercises' owner-scoped custom entries, minus the review_status
 * moderation queue — see migration 0058's header on why foods skips that).
 * All macro fields are per-100g, same convention as every seeded USDA row.
 */
export async function createCustomFood(
  supabase: SupabaseClient,
  params: {
    ownerId: string;
    name: string;
    brand?: string | null;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
    default_serving_g?: number | null;
    default_serving_label?: string | null;
  }
): Promise<{ food: Food | null; error: string | null }> {
  const foodId = newId();
  const now = new Date().toISOString();
  const { error } = await supabase.from("foods").insert({
    id: foodId,
    name: params.name,
    brand: params.brand ?? null,
    source: "custom",
    owner_id: params.ownerId,
    calories: params.calories,
    protein_g: params.protein_g,
    carbs_g: params.carbs_g,
    fat_g: params.fat_g,
    fiber_g: params.fiber_g ?? null,
    sugar_g: params.sugar_g ?? null,
    sodium_mg: params.sodium_mg ?? null,
    default_serving_g: params.default_serving_g ?? null,
    default_serving_label: params.default_serving_label ?? null,
  });
  if (error) return { food: null, error: error.message };
  return {
    food: {
      id: foodId,
      name: params.name,
      brand: params.brand ?? null,
      source: "custom",
      fdc_id: null,
      calories: params.calories,
      protein_g: params.protein_g,
      carbs_g: params.carbs_g,
      fat_g: params.fat_g,
      fiber_g: params.fiber_g ?? null,
      sugar_g: params.sugar_g ?? null,
      sodium_mg: params.sodium_mg ?? null,
      default_serving_g: params.default_serving_g ?? null,
      default_serving_label: params.default_serving_label ?? null,
      owner_id: params.ownerId,
      is_archived: false,
      created_at: now,
      updated_at: now,
    },
    error: null,
  };
}
