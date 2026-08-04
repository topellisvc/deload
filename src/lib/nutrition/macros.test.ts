import { describe, expect, it } from "vitest";
import { dayMacros, daySummary, itemMacros, mealMacros, resolvedMealOption, sumMacros } from "./macros";
import type { Food, MealItemRow, MealOptionRow, MealRow, NutritionDayRow, NutritionPlan } from "@/lib/nutrition/types";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name: "Chicken breast",
    brand: null,
    source: "usda",
    fdc_id: 5064,
    calories: 165,
    protein_g: 31,
    carbs_g: 0,
    fat_g: 3.6,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 74,
    default_serving_g: 100,
    default_serving_label: "100 g",
    owner_id: null,
    is_archived: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeItem(overrides: Partial<MealItemRow> = {}): MealItemRow {
  return {
    id: "item-1",
    meal_option_id: "option-1",
    position: 1,
    food_id: "food-1",
    quantity_g: 100,
    display_label: null,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    food: makeFood(),
    ...overrides,
  };
}

function makeOption(overrides: Partial<MealOptionRow> = {}): MealOptionRow {
  return {
    id: "option-1",
    meal_id: "meal-1",
    position: 1,
    label: "Option A",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    items: [makeItem()],
    ...overrides,
  };
}

function makeMeal(overrides: Partial<MealRow> = {}): MealRow {
  return {
    id: "meal-1",
    day_id: "day-1",
    position: 1,
    name: "Breakfast",
    notes: null,
    allow_athlete_swap: false,
    selected_option_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    options: [makeOption()],
    ...overrides,
  };
}

function makeDay(overrides: Partial<NutritionDayRow> = {}): NutritionDayRow {
  return {
    id: "day-1",
    plan_id: "plan-1",
    position: 1,
    label: "Day 1",
    notes: null,
    calories_target: null,
    protein_target_g: null,
    carbs_target_g: null,
    fat_target_g: null,
    created_at: "2026-01-01T00:00:00.000Z",
    meals: [makeMeal()],
    ...overrides,
  };
}

function makePlan(overrides: Partial<NutritionPlan> = {}): NutritionPlan {
  return {
    id: "plan-1",
    owner_id: "coach-1",
    athlete_id: "athlete-1",
    name: "Cutting Plan",
    notes: null,
    daily_calories_target: 2000,
    daily_protein_target_g: 180,
    daily_carbs_target_g: 200,
    daily_fat_target_g: 60,
    is_active: true,
    removed_by_athlete_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("itemMacros", () => {
  it("scales a food's per-100g values by quantity_g", () => {
    expect(itemMacros(makeItem({ quantity_g: 200 }))).toEqual({
      calories: 330,
      protein_g: 62,
      carbs_g: 0,
      fat_g: 7.2,
    });
  });

  it("halves macros for a 50g quantity", () => {
    expect(itemMacros(makeItem({ quantity_g: 50 }))).toEqual({
      calories: 82.5,
      protein_g: 15.5,
      carbs_g: 0,
      fat_g: 1.8,
    });
  });
});

describe("sumMacros", () => {
  it("adds every field across a list of totals", () => {
    expect(
      sumMacros([
        { calories: 100, protein_g: 10, carbs_g: 5, fat_g: 2 },
        { calories: 50, protein_g: 5, carbs_g: 10, fat_g: 1 },
      ])
    ).toEqual({ calories: 150, protein_g: 15, carbs_g: 15, fat_g: 3 });
  });

  it("returns zeroed totals for an empty list", () => {
    expect(sumMacros([])).toEqual({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });
});

describe("resolvedMealOption", () => {
  it("returns the position-1 option when nothing is selected", () => {
    const meal = makeMeal({
      selected_option_id: null,
      options: [makeOption({ id: "opt-b", position: 2, label: "Option B" }), makeOption({ id: "opt-a", position: 1, label: "Option A" })],
    });
    expect(resolvedMealOption(meal)?.id).toBe("opt-a");
  });

  it("returns the selected option when it exists on this meal", () => {
    const meal = makeMeal({
      selected_option_id: "opt-b",
      options: [makeOption({ id: "opt-a", position: 1 }), makeOption({ id: "opt-b", position: 2 })],
    });
    expect(resolvedMealOption(meal)?.id).toBe("opt-b");
  });

  it("falls back to position 1 if selected_option_id doesn't match any option on this meal (stale reference)", () => {
    const meal = makeMeal({
      selected_option_id: "some-other-meal-option",
      options: [makeOption({ id: "opt-a", position: 1 })],
    });
    expect(resolvedMealOption(meal)?.id).toBe("opt-a");
  });
});

describe("mealMacros", () => {
  it("sums only the resolved option's items, not every option", () => {
    const meal = makeMeal({
      selected_option_id: "opt-a",
      options: [
        makeOption({ id: "opt-a", position: 1, items: [makeItem({ quantity_g: 100 })] }),
        makeOption({ id: "opt-b", position: 2, items: [makeItem({ quantity_g: 1000 })] }),
      ],
    });
    expect(mealMacros(meal).calories).toBe(165);
  });
});

describe("dayMacros", () => {
  it("sums every meal's resolved macros", () => {
    const day = makeDay({
      meals: [makeMeal({ id: "m1" }), makeMeal({ id: "m2" })],
    });
    expect(dayMacros(day).calories).toBe(330);
  });
});

describe("daySummary", () => {
  it("falls back to the plan's default targets when the day has no overrides", () => {
    const summary = daySummary(makeDay(), makePlan());
    expect(summary.targets).toEqual({ calories: 2000, protein_g: 180, carbs_g: 200, fat_g: 60 });
  });

  it("prefers the day's own target over the plan default when set", () => {
    const summary = daySummary(makeDay({ calories_target: 2500 }), makePlan());
    expect(summary.targets.calories).toBe(2500);
    expect(summary.targets.protein_g).toBe(180);
  });

  it("includes live totals alongside targets", () => {
    const summary = daySummary(makeDay(), makePlan());
    expect(summary.totals.calories).toBe(165);
  });
});
