// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MealPlanBuilder } from "./meal-plan-builder";
import type { MealTemplateWithItems, NutritionPlanTree } from "@/lib/nutrition/types";
import type { Food } from "@/lib/supabase/types";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const chicken: Food = {
  id: "usda:1001",
  name: "Chicken breast, raw",
  brand: null,
  source: "usda",
  fdc_id: 1001,
  calories: 120,
  protein_g: 22,
  carbs_g: 0,
  fat_g: 3,
  fiber_g: 0,
  sugar_g: 0,
  sodium_mg: 60,
  default_serving_g: 100,
  default_serving_label: "100g",
  owner_id: null,
  is_archived: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const oats: Food = {
  id: "usda:staple-oats",
  name: "Oats",
  brand: null,
  source: "usda",
  fdc_id: null,
  calories: 389,
  protein_g: 16.89,
  carbs_g: 66.27,
  fat_g: 6.9,
  fiber_g: 10.6,
  sugar_g: null,
  sodium_mg: null,
  default_serving_g: 100,
  default_serving_label: "100 g",
  owner_id: null,
  is_archived: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const proteinOatsTemplate: MealTemplateWithItems = {
  id: "template-b03",
  name: "Protein Oats",
  description: "Oats cooked in milk with banana and peanut butter.",
  category: "breakfast",
  tags: ["high_carb"],
  position: 3,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  items: [{ id: "ti-1", template_id: "template-b03", position: 1, food_id: oats.id, quantity_g: 80, display_label: "Oats (dry)", food: oats }],
};

const { mutationMocks } = vi.hoisted(() => ({
  mutationMocks: {
    updateMealPlan: vi.fn().mockResolvedValue({ error: null }),
    addDay: vi.fn(),
    updateDay: vi.fn().mockResolvedValue({ error: null }),
    deleteDay: vi.fn().mockResolvedValue({ error: null }),
    addMeal: vi.fn(),
    updateMeal: vi.fn().mockResolvedValue({ error: null }),
    deleteMeal: vi.fn().mockResolvedValue({ error: null }),
    addMealOption: vi.fn(),
    updateMealOption: vi.fn().mockResolvedValue({ error: null }),
    deleteMealOption: vi.fn().mockResolvedValue({ error: null }),
    selectMealOption: vi.fn().mockResolvedValue({ error: null }),
    addMealItem: vi.fn(),
    applyMealTemplate: vi.fn(),
    updateMealItem: vi.fn().mockResolvedValue({ error: null }),
    deleteMealItem: vi.fn().mockResolvedValue({ error: null }),
    createCustomFood: vi.fn(),
  },
}));
vi.mock("@/lib/nutrition/mutations", () => mutationMocks);
vi.mock("@/lib/nutrition/queries", () => ({ searchFoods: vi.fn().mockResolvedValue([]) }));

function makePlan(): NutritionPlanTree {
  return {
    id: "plan-1",
    owner_id: "coach-1",
    athlete_id: "coach-1",
    name: "Cutting plan",
    notes: null,
    daily_calories_target: 2200,
    daily_protein_target_g: 180,
    daily_carbs_target_g: null,
    daily_fat_target_g: null,
    is_active: false,
    removed_by_athlete_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    days: [
      {
        id: "day-1",
        plan_id: "plan-1",
        position: 1,
        label: "Day 1",
        notes: null,
        calories_target: null,
        protein_target_g: null,
        carbs_target_g: null,
        fat_target_g: null,
        created_at: "2026-01-01T00:00:00Z",
        meals: [
          {
            id: "meal-1",
            day_id: "day-1",
            position: 1,
            name: "Breakfast",
            notes: null,
            allow_athlete_swap: true,
            selected_option_id: null,
            created_at: "2026-01-01T00:00:00Z",
            options: [
              {
                id: "option-a",
                meal_id: "meal-1",
                position: 1,
                label: "Option A",
                notes: null,
                created_at: "2026-01-01T00:00:00Z",
                items: [
                  {
                    id: "item-1",
                    meal_option_id: "option-a",
                    position: 1,
                    food_id: chicken.id,
                    quantity_g: 200,
                    display_label: null,
                    notes: null,
                    created_at: "2026-01-01T00:00:00Z",
                    food: chicken,
                  },
                ],
              },
              {
                id: "option-b",
                meal_id: "meal-1",
                position: 2,
                label: "Option B",
                notes: null,
                created_at: "2026-01-01T00:00:00Z",
                items: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mutationMocks.updateMealPlan.mockResolvedValue({ error: null });
  mutationMocks.updateDay.mockResolvedValue({ error: null });
  mutationMocks.deleteDay.mockResolvedValue({ error: null });
  mutationMocks.updateMeal.mockResolvedValue({ error: null });
  mutationMocks.deleteMeal.mockResolvedValue({ error: null });
  mutationMocks.updateMealOption.mockResolvedValue({ error: null });
  mutationMocks.deleteMealOption.mockResolvedValue({ error: null });
  mutationMocks.selectMealOption.mockResolvedValue({ error: null });
  mutationMocks.updateMealItem.mockResolvedValue({ error: null });
  mutationMocks.deleteMealItem.mockResolvedValue({ error: null });
});

describe("MealPlanBuilder", () => {
  it("shows both meal options at once for the coach view, not tabbed", () => {
    render(<MealPlanBuilder initialPlan={makePlan()} />);
    expect(screen.getByDisplayValue("Option A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option B")).toBeInTheDocument();
    expect(screen.getByText("Chicken breast, raw")).toBeInTheDocument();
  });

  it("lets the coach directly edit an item's gram amount", async () => {
    const user = userEvent.setup();
    render(<MealPlanBuilder initialPlan={makePlan()} />);

    const gramsInput = screen.getByLabelText("Chicken breast, raw quantity in grams");
    await user.clear(gramsInput);
    await user.type(gramsInput, "150");
    await user.tab();

    await waitFor(() => expect(mutationMocks.updateMealItem).toHaveBeenCalledWith({}, "item-1", { quantity_g: 150 }));
  });

  it("adds a meal via the Add meal button", async () => {
    mutationMocks.addMeal.mockResolvedValue({
      meal: {
        id: "meal-2",
        day_id: "day-1",
        position: 2,
        name: "New meal",
        notes: null,
        allow_athlete_swap: false,
        selected_option_id: null,
        created_at: "2026-01-01T00:00:00Z",
        options: [{ id: "option-c", meal_id: "meal-2", position: 1, label: "Option A", notes: null, created_at: "2026-01-01T00:00:00Z", items: [] }],
      },
      error: null,
    });
    const user = userEvent.setup();
    render(<MealPlanBuilder initialPlan={makePlan()} />);

    await user.click(screen.getByRole("button", { name: /add meal/i }));

    await waitFor(() => expect(mutationMocks.addMeal).toHaveBeenCalledWith({}, { dayId: "day-1", position: 2, name: "New meal" }));
    expect(await screen.findAllByDisplayValue("New meal")).toHaveLength(1);
  });

  it("marking a different option as default calls selectMealOption", async () => {
    const user = userEvent.setup();
    render(<MealPlanBuilder initialPlan={makePlan()} />);

    const optionBCard = screen.getByDisplayValue("Option B").closest("div")!.parentElement!;
    const starButton = within(optionBCard).getByTitle("Make this the default option");
    await user.click(starButton);

    await waitFor(() => expect(mutationMocks.selectMealOption).toHaveBeenCalledWith({}, { mealId: "meal-1", optionId: "option-b" }));
  });

  it("does not show a delete-day control when there's only one day", () => {
    render(<MealPlanBuilder initialPlan={makePlan()} />);
    expect(screen.queryByLabelText("Delete day")).not.toBeInTheDocument();
  });

  it("inserting a meal template adds every one of its items to that option via applyMealTemplate", async () => {
    mutationMocks.applyMealTemplate.mockResolvedValue({
      items: [
        {
          id: "item-from-template",
          meal_option_id: "option-a",
          position: 2,
          food_id: oats.id,
          quantity_g: 80,
          display_label: "Oats (dry)",
          notes: null,
          created_at: "2026-01-01T00:00:00Z",
          food: oats,
        },
      ],
      error: null,
    });
    const user = userEvent.setup();
    render(<MealPlanBuilder initialPlan={makePlan()} mealTemplates={[proteinOatsTemplate]} />);

    // Option A already has one item (chicken, position 1) — the picker
    // button sits next to Option A's own FoodSearchField, two levels below
    // the header div the "Option A" input itself lives in.
    const optionACard = screen.getByDisplayValue("Option A").closest("div")!.parentElement!.parentElement!;
    await user.click(within(optionACard).getByRole("button", { name: /templates/i }));
    await user.click(await screen.findByRole("option", { name: /protein oats/i }));

    await waitFor(() =>
      expect(mutationMocks.applyMealTemplate).toHaveBeenCalledWith({}, { mealOptionId: "option-a", startPosition: 2, template: proteinOatsTemplate })
    );
    expect(await screen.findByText("Oats (dry)")).toBeInTheDocument();
  });

  it("hides the Templates button entirely when no templates were passed in", () => {
    render(<MealPlanBuilder initialPlan={makePlan()} />);
    expect(screen.queryByRole("button", { name: /templates/i })).not.toBeInTheDocument();
  });
});
