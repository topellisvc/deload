// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MealPlansList } from "./meal-plans-list";
import type { NutritionPlanSummary } from "@/lib/nutrition/types";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/nutrition/send-meal-plan-dialog", () => ({ SendMealPlanDialog: () => null }));
vi.mock("@/components/nutrition/new-meal-plan-dialog", () => ({ NewMealPlanDialog: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/nutrition/mutations", () => ({
  deleteMealPlan: vi.fn(),
  removeAssignedMealPlan: vi.fn(),
  setActiveMealPlan: vi.fn(),
}));

import { deleteMealPlan, removeAssignedMealPlan, setActiveMealPlan } from "@/lib/nutrition/mutations";

function makePlan(overrides: Partial<NutritionPlanSummary> = {}): NutritionPlanSummary {
  return {
    id: "plan-1",
    owner_id: "user-1",
    athlete_id: "user-1",
    name: "My Cutting Plan",
    notes: null,
    daily_calories_target: null,
    daily_protein_target_g: null,
    daily_carbs_target_g: null,
    daily_fat_target_g: null,
    is_active: false,
    removed_by_athlete_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    dayCount: 3,
    mealCount: 9,
    assignmentLabel: null,
    ...overrides,
  };
}

/** Same owner/athlete delete branching + set-active optimistic update as
 * ProgramsList's own test — mirrors it exactly for the meal-plan
 * equivalents. */
describe("MealPlansList", () => {
  beforeEach(() => {
    vi.mocked(deleteMealPlan).mockReset();
    vi.mocked(removeAssignedMealPlan).mockReset();
    vi.mocked(setActiveMealPlan).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("calls deleteMealPlan and optimistically removes the card when the owner deletes their own plan", async () => {
    vi.mocked(deleteMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<MealPlansList plans={[makePlan()]} userId="user-1" activeClients={[]} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete meal plan?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteMealPlan).toHaveBeenCalledWith(expect.anything(), "plan-1");
    expect(removeAssignedMealPlan).not.toHaveBeenCalled();
    expect(screen.queryByText("My Cutting Plan")).not.toBeInTheDocument();
  });

  it("calls removeAssignedMealPlan, not deleteMealPlan, when the viewer is only the assigned athlete", async () => {
    vi.mocked(removeAssignedMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <MealPlansList
        plans={[makePlan({ owner_id: "coach-1", athlete_id: "user-1", assignmentLabel: "From coach@example.com" })]}
        userId="user-1"
        activeClients={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Remove meal plan?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(removeAssignedMealPlan).toHaveBeenCalledWith(expect.anything(), "plan-1");
    expect(deleteMealPlan).not.toHaveBeenCalled();
  });

  it("optimistically deactivates every other plan for the same athlete when one is set active", async () => {
    vi.mocked(setActiveMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <MealPlansList
        plans={[
          makePlan({ id: "plan-1", name: "Plan A", athlete_id: "user-1", is_active: true }),
          makePlan({ id: "plan-2", name: "Plan B", athlete_id: "user-1", is_active: false }),
        ]}
        userId="user-1"
        activeClients={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    expect(setActiveMealPlan).toHaveBeenCalledWith(expect.anything(), "plan-2");
    expect(screen.getAllByRole("button", { name: /set as active/i })).toHaveLength(1);
    expect(screen.getByText("Active")).toBeInTheDocument();
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });

  it("rolls back the optimistic activation and shows the error when setActiveMealPlan fails", async () => {
    vi.mocked(setActiveMealPlan).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    render(<MealPlansList plans={[makePlan({ is_active: false })]} userId="user-1" activeClients={[]} />);

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /set as active/i })).toBeInTheDocument();
  });
});
