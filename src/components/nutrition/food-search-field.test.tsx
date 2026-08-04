// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FoodSearchField } from "./food-search-field";
import type { Food } from "@/lib/supabase/types";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
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
    ...overrides,
  } as Food;
}

describe("FoodSearchField", () => {
  it("shows an 'Add food' trigger when closed", () => {
    render(<FoodSearchField onSelect={vi.fn()} search={vi.fn().mockResolvedValue([])} />);
    expect(screen.getByRole("button", { name: /add food/i })).toBeInTheDocument();
  });

  it("opens on click, searches as you type, and lists the results it gets back", async () => {
    const user = userEvent.setup();
    const search = vi.fn().mockResolvedValue([makeFood({ name: "Chicken breast, raw" })]);
    render(<FoodSearchField onSelect={vi.fn()} search={search} />);

    await user.click(screen.getByRole("button", { name: /add food/i }));
    const listbox = await screen.findByRole("listbox");

    await user.type(screen.getByRole("textbox"), "chicken");
    await waitFor(() => expect(within(listbox).getByText("Chicken breast, raw")).toBeInTheDocument());
    expect(search).toHaveBeenCalledWith("chicken");
  });

  it("selecting a result calls onSelect with the full food and closes", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const search = vi.fn().mockResolvedValue([makeFood({ id: "usda:2002", name: "Oats, dry" })]);
    render(<FoodSearchField onSelect={onSelect} search={search} />);

    await user.click(screen.getByRole("button", { name: /add food/i }));
    await user.type(screen.getByRole("textbox"), "oats");
    await user.click(await screen.findByRole("option", { name: /oats, dry/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "usda:2002", name: "Oats, dry" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("offers 'Add as custom food' once there's a query, and fires onAddCustomFood with the typed text", async () => {
    const onAddCustomFood = vi.fn();
    const user = userEvent.setup();
    const search = vi.fn().mockResolvedValue([]);
    render(<FoodSearchField onSelect={vi.fn()} search={search} onAddCustomFood={onAddCustomFood} />);

    await user.click(screen.getByRole("button", { name: /add food/i }));
    await user.type(screen.getByRole("textbox"), "Grandma's Protein Bars");
    const createOption = await screen.findByRole("option", { name: /add.*grandma's protein bars.*custom food/i });
    await user.click(createOption);

    expect(onAddCustomFood).toHaveBeenCalledWith("Grandma's Protein Bars");
  });

  it("closes without calling onSelect when Escape is pressed", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FoodSearchField onSelect={onSelect} search={vi.fn().mockResolvedValue([])} />);

    await user.click(screen.getByRole("button", { name: /add food/i }));
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
