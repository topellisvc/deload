// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedMealPlansSection } from "./shared-meal-plans-section";
import type { NutritionPlanSummary } from "@/lib/nutrition/types";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/nutrition/mutations", () => ({
  removeAssignedMealPlan: vi.fn(),
  setActiveMealPlan: vi.fn(),
}));

import { removeAssignedMealPlan, setActiveMealPlan } from "@/lib/nutrition/mutations";

function makePlan(overrides: Partial<NutritionPlanSummary> = {}): NutritionPlanSummary {
  return {
    id: "plan-1",
    owner_id: "coach-1",
    athlete_id: "athlete-1",
    name: "Cutting plan",
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

/**
 * Mirrors shared-programs-section.test.tsx exactly, one layer over for
 * meal plans — this section is always the athlete's own view of a
 * coach-assigned plan, never the owner's, so removeAssignedMealPlan is the
 * only delete-family mutation it ever calls, and canSend is permanently off.
 */
describe("SharedMealPlansSection", () => {
  beforeEach(() => {
    vi.mocked(removeAssignedMealPlan).mockReset();
    vi.mocked(setActiveMealPlan).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("never shows a Send a copy button", () => {
    render(<SharedMealPlansSection plans={[makePlan()]} userId="athlete-1" />);
    expect(screen.queryByRole("button", { name: /send a copy/i })).not.toBeInTheDocument();
  });

  it("filters out any plan where the viewer isn't the athlete_id, even if the caller passed one in", () => {
    render(<SharedMealPlansSection plans={[makePlan({ id: "plan-2", name: "Not mine", athlete_id: "someone-else" })]} userId="athlete-1" />);
    expect(screen.getByText(/hasn't assigned you any meal plans yet/i)).toBeInTheDocument();
  });

  it("calls removeAssignedMealPlan and optimistically removes the card on confirm", async () => {
    vi.mocked(removeAssignedMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SharedMealPlansSection plans={[makePlan()]} userId="athlete-1" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Remove "Cutting plan"/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(removeAssignedMealPlan).toHaveBeenCalledWith(expect.anything(), "plan-1");
    await waitFor(() => expect(screen.getByText(/hasn't assigned you any meal plans yet/i)).toBeInTheDocument());
  });

  it("rolls back and shows the error when removeAssignedMealPlan fails", async () => {
    vi.mocked(removeAssignedMealPlan).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    render(<SharedMealPlansSection plans={[makePlan()]} userId="athlete-1" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    expect(screen.getByText("Cutting plan")).toBeInTheDocument();
  });

  it("calls setActiveMealPlan and refreshes on success", async () => {
    vi.mocked(setActiveMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SharedMealPlansSection plans={[makePlan({ is_active: false })]} userId="athlete-1" />);

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    expect(setActiveMealPlan).toHaveBeenCalledWith(expect.anything(), "plan-1");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });

  it("hides Set as active and Delete once the athlete has already removed their own copy", () => {
    render(<SharedMealPlansSection plans={[makePlan({ removed_by_athlete_at: "2026-07-25T10:00:00.000Z" })]} userId="athlete-1" />);

    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
