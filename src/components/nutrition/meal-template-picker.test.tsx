// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MealTemplatePicker } from "./meal-template-picker";
import type { MealTemplateWithItems } from "@/lib/nutrition/types";
import type { Food } from "@/lib/supabase/types";

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

const tuna: Food = { ...oats, id: "usda:tuna", name: "Tuna, canned in water", calories: 116, protein_g: 25.51, carbs_g: 0, fat_g: 0.82 };

function makeTemplate(overrides: Partial<MealTemplateWithItems> = {}): MealTemplateWithItems {
  return {
    id: "template-1",
    name: "Protein Oats",
    description: "Oats with banana and peanut butter.",
    category: "breakfast",
    tags: ["high_carb"],
    position: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    items: [{ id: "ti-1", template_id: "template-1", position: 1, food_id: oats.id, quantity_g: 80, display_label: "Oats (dry)", food: oats }],
    ...overrides,
  };
}

/** Small, purely local component — the whole library is passed in already
 * loaded (no debounced remote search like FoodSearchField), so these tests
 * just cover grouping-by-category, the macro hint, and that selecting an
 * item fires onSelect with the full template and closes the popover. */
describe("MealTemplatePicker", () => {
  it("renders nothing when there are no templates", () => {
    const { container } = render(<MealTemplatePicker templates={[]} onSelect={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("groups templates under their category heading", async () => {
    const user = userEvent.setup();
    const lunchTemplate = makeTemplate({ id: "template-2", name: "Tuna Salad Bowl", category: "lunch", items: [{ id: "ti-2", template_id: "template-2", position: 1, food_id: tuna.id, quantity_g: 120, display_label: null, food: tuna }] });
    render(<MealTemplatePicker templates={[makeTemplate(), lunchTemplate]} onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /templates/i }));

    expect(screen.getByText("Breakfast")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /protein oats/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /tuna salad bowl/i })).toBeInTheDocument();
  });

  it("shows a macro hint computed from the template's own items", async () => {
    const user = userEvent.setup();
    render(<MealTemplatePicker templates={[makeTemplate()]} onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /templates/i }));

    // 80g of oats (389 cal/100g) = 311.2 -> rounds to 311.
    expect(screen.getByText(/311 cal/)).toBeInTheDocument();
  });

  it("calls onSelect with the full template and closes the popover", async () => {
    const onSelect = vi.fn();
    const template = makeTemplate();
    const user = userEvent.setup();
    render(<MealTemplatePicker templates={[template]} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /templates/i }));
    await user.click(screen.getByRole("option", { name: /protein oats/i }));

    expect(onSelect).toHaveBeenCalledWith(template);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
