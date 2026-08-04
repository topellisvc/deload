import type { SupabaseClient } from "@supabase/supabase-js";
import type { Food, Meal, MealItem, MealOption, NutritionDay, NutritionPlan } from "@/lib/supabase/types";
import type { MealItemRow, MealOptionRow, MealRow, NutritionDayRow, NutritionPlanSummary, NutritionPlanTree } from "@/lib/nutrition/types";

/**
 * The meal plan tree is four tables deep (plan -> days -> meals -> options
 * -> items), one level flatter than the program tree (getProgramTree,
 * lib/programs/queries.ts) since there's no weeks layer here — see
 * migration 0058's header for why. Same flat-query-and-stitch approach as
 * that function: one indexed query per level rather than a deep PostgREST
 * embedded select, plus a final batch lookup against `foods` (mirrors that
 * function's own exercise-name lookup) so every MealItemRow already has its
 * food joined in — the macro helpers (lib/nutrition/macros.ts) require it.
 */
export async function getMealPlanTree(supabase: SupabaseClient, planId: string): Promise<NutritionPlanTree | null> {
  const { data: plan, error: planError } = await supabase
    .from("nutrition_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle<NutritionPlan>();

  if (planError || !plan) return null;

  const { data: daysData } = await supabase
    .from("nutrition_days")
    .select("*")
    .eq("plan_id", planId)
    .order("position", { ascending: true });
  const days = (daysData ?? []) as NutritionDay[];
  const dayIds = days.map((d) => d.id);

  const { data: mealsData } = dayIds.length
    ? await supabase.from("meals").select("*").in("day_id", dayIds).order("position", { ascending: true })
    : { data: [] };
  const meals = (mealsData ?? []) as Meal[];
  const mealIds = meals.map((m) => m.id);

  const { data: optionsData } = mealIds.length
    ? await supabase.from("meal_options").select("*").in("meal_id", mealIds).order("position", { ascending: true })
    : { data: [] };
  const options = (optionsData ?? []) as MealOption[];
  const optionIds = options.map((o) => o.id);

  const { data: itemsData } = optionIds.length
    ? await supabase.from("meal_items").select("*").in("meal_option_id", optionIds).order("position", { ascending: true })
    : { data: [] };
  const items = (itemsData ?? []) as MealItem[];

  const foodIds = [...new Set(items.map((i) => i.food_id))];
  const { data: foodsData } = foodIds.length ? await supabase.from("foods").select("*").in("id", foodIds) : { data: [] };
  const foodsById = new Map(((foodsData ?? []) as Food[]).map((f) => [f.id, f]));

  const itemsByOption = groupBy(items, (i) => i.meal_option_id);
  const optionsByMeal = groupBy(options, (o) => o.meal_id);
  const mealsByDay = groupBy(meals, (m) => m.day_id);

  const dayRows: NutritionDayRow[] = days.map((day) => ({
    ...day,
    meals: (mealsByDay.get(day.id) ?? []).map((meal): MealRow => ({
      ...meal,
      options: (optionsByMeal.get(meal.id) ?? []).map((option): MealOptionRow => ({
        ...option,
        // A dangling food_id (a custom food the owner deleted out from
        // under an old item — RLS lets an owner delete their own unused
        // ones, but not one still referenced; this is just defensive) is
        // dropped rather than rendered with a null food, since every macro
        // helper assumes MealItemRow.food is always present.
        items: (itemsByOption.get(option.id) ?? []).flatMap((item): MealItemRow[] => {
          const food = foodsById.get(item.food_id);
          return food ? [{ ...item, food }] : [];
        }),
      })),
    })),
  }));

  return { ...plan, days: dayRows };
}

/**
 * Shared by getMealPlanSummaries and getMealPlansForClient — "how many
 * days, how many meals" per plan without pulling the whole tree. Mirrors
 * getWeekDayCounts in lib/programs/queries.ts.
 */
async function getDayMealCounts(supabase: SupabaseClient, planIds: string[]): Promise<Map<string, { dayCount: number; mealCount: number }>> {
  const counts = new Map<string, { dayCount: number; mealCount: number }>();
  if (planIds.length === 0) return counts;

  const { data: daysData } = await supabase.from("nutrition_days").select("id, plan_id").in("plan_id", planIds);
  const days = (daysData ?? []) as { id: string; plan_id: string }[];
  const dayIds = days.map((d) => d.id);

  const { data: mealsData } = dayIds.length ? await supabase.from("meals").select("id, day_id").in("day_id", dayIds) : { data: [] };
  const meals = (mealsData ?? []) as { id: string; day_id: string }[];

  const daysByPlan = groupBy(days, (d) => d.plan_id);
  const mealCountByDay = groupBy(meals, (m) => m.day_id);

  for (const planId of planIds) {
    const planDays = daysByPlan.get(planId) ?? [];
    const mealCount = planDays.reduce((sum, day) => sum + (mealCountByDay.get(day.id)?.length ?? 0), 0);
    counts.set(planId, { dayCount: planDays.length, mealCount });
  }
  return counts;
}

/** Every meal plan the caller can see (owner or athlete), newest-updated
 * first — the /nutrition list page. Mirrors getProgramSummaries, including
 * its "an athlete's removed copy stays hidden from them but visible to the
 * coach" filter. */
export async function getMealPlanSummaries(supabase: SupabaseClient, userId: string): Promise<NutritionPlanSummary[]> {
  const { data: plans } = await supabase
    .from("nutrition_plans")
    .select("*")
    .or(`owner_id.eq.${userId},athlete_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  const list = ((plans ?? []) as NutritionPlan[]).filter((p) => !(p.athlete_id === userId && p.removed_by_athlete_at));
  if (list.length === 0) return [];

  const counts = await getDayMealCounts(supabase, list.map((p) => p.id));

  const crossAssigned = list.filter((p) => p.owner_id !== p.athlete_id);
  let relationships: { coach_id: string; client_id: string | null; client_email: string; coach_email: string }[] = [];
  if (crossAssigned.length > 0) {
    const { data } = await supabase
      .from("coach_clients")
      .select("coach_id, client_id, client_email, coach_email")
      .or(`coach_id.eq.${userId},client_id.eq.${userId}`);
    relationships = data ?? [];
  }

  return list.map((plan) => {
    const { dayCount, mealCount } = counts.get(plan.id) ?? { dayCount: 0, mealCount: 0 };

    let assignmentLabel: string | null = null;
    if (plan.owner_id !== plan.athlete_id) {
      if (plan.owner_id === userId) {
        const rel = relationships.find((r) => r.coach_id === userId && r.client_id === plan.athlete_id);
        assignmentLabel = rel ? `For ${rel.client_email}` : "For a client";
      } else {
        const rel = relationships.find((r) => r.client_id === userId && r.coach_id === plan.owner_id);
        assignmentLabel = rel ? `From ${rel.coach_email}` : "From your coach";
      }
    }

    return { ...plan, dayCount, mealCount, assignmentLabel };
  });
}

/** Every meal plan a coach has assigned to one specific client — the
 * Nutrition tab on the Coaching hub's client detail panel. Mirrors
 * getProgramsForClient. */
export async function getMealPlansForClient(supabase: SupabaseClient, coachId: string, clientId: string): Promise<NutritionPlanSummary[]> {
  const { data: plans } = await supabase
    .from("nutrition_plans")
    .select("*")
    .eq("owner_id", coachId)
    .eq("athlete_id", clientId)
    .order("updated_at", { ascending: false });

  const list = (plans ?? []) as NutritionPlan[];
  if (list.length === 0) return [];

  const counts = await getDayMealCounts(supabase, list.map((p) => p.id));

  return list.map((plan) => {
    const { dayCount, mealCount } = counts.get(plan.id) ?? { dayCount: 0, mealCount: 0 };
    return { ...plan, dayCount, mealCount, assignmentLabel: null };
  });
}

/**
 * The food search field's single data source — a plain `ilike` prefix/
 * substring match against `name`, capped to a small page. RLS already
 * scopes results to global (owner_id null) foods plus the caller's own
 * custom ones, so there's no separate "my library vs. global" merge to do
 * client-side the way searchExercises (lib/programs/exercise-search.ts)
 * merges an in-memory catalog with a coach's saved list — foods are a real
 * table, one query covers both. Custom (coach-owned) matches are listed
 * ahead of global USDA ones on the theory that a coach's own reused food is
 * more likely what they're after, same ordering rationale
 * searchExercises' own doc comment gives for its own library-first order.
 */
export async function searchFoods(supabase: SupabaseClient, query: string, limit = 25): Promise<Food[]> {
  const trimmed = query.trim();
  let request = supabase.from("foods").select("*").eq("is_archived", false);
  if (trimmed) request = request.ilike("name", `%${trimmed}%`);

  const { data } = await request.order("name", { ascending: true }).limit(200);
  const results = (data ?? []) as Food[];
  results.sort((a, b) => {
    if (a.source !== b.source) return a.source === "custom" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return results.slice(0, limit);
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const existing = map.get(k);
    if (existing) existing.push(item);
    else map.set(k, [item]);
  }
  return map;
}
