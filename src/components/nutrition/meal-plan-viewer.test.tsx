// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MealPlanViewer } from "./meal-plan-viewer";
import type { NutritionPlanTree } from "@/lib/nutrition/types";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
// Out of scope here — SendMealPlanDialog needs its own mutation and only
// ever renders for isOwner. Its own behavior isn't what these tests are
// about, same reasoning as program-viewer.test.tsx's own mock.
vi.mock("@/components/nutrition/send-meal-plan-dialog", () => ({ SendMealPlanDialog: () => null }));
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
  selectMealOption: vi.fn(),
}));

import { deleteMealPlan, removeAssignedMealPlan, setActiveMealPlan } from "@/lib/nutrition/mutations";

function makePlan(overrides: Partial<NutritionPlanTree> = {}): NutritionPlanTree {
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
    days: [{ id: "day-1", plan_id: "plan-1", position: 1, label: "Day 1", notes: null, calories_target: null, protein_target_g: null, carbs_target_g: null, fat_target_g: null, created_at: "2026-01-01T00:00:00.000Z", meals: [] }],
    ...overrides,
  };
}

function renderViewer(overrides: Partial<Parameters<typeof MealPlanViewer>[0]> = {}) {
  return render(<MealPlanViewer plan={makePlan()} assignedByEmail={null} currentUserId="coach-1" activeClients={[]} {...overrides} />);
}

/**
 * Mirrors program-viewer.test.tsx's own "delete/remove" describe block —
 * which mutation runs, which confirm copy shows, and when the management
 * buttons disappear, now that MealPlanViewer has the same set-active/
 * delete-vs-remove branching as ProgramViewer (migration 0060).
 */
describe("MealPlanViewer delete/remove", () => {
  beforeEach(() => {
    vi.mocked(deleteMealPlan).mockReset();
    vi.mocked(removeAssignedMealPlan).mockReset();
    vi.mocked(setActiveMealPlan).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("calls deleteMealPlan, not removeAssignedMealPlan, when the owner deletes their plan", async () => {
    vi.mocked(deleteMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderViewer({ currentUserId: "coach-1", plan: makePlan({ owner_id: "coach-1", athlete_id: "coach-1" }) });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Delete "Cutting plan"/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteMealPlan).toHaveBeenCalledWith(expect.anything(), "plan-1");
    expect(removeAssignedMealPlan).not.toHaveBeenCalled();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/nutrition"));
  });

  it("calls removeAssignedMealPlan, not deleteMealPlan, when the athlete removes their assigned copy", async () => {
    vi.mocked(removeAssignedMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderViewer({ currentUserId: "athlete-1", plan: makePlan({ owner_id: "coach-1", athlete_id: "athlete-1" }) });

    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/won't affect your coach's original/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(removeAssignedMealPlan).toHaveBeenCalledWith(expect.anything(), "plan-1");
    expect(deleteMealPlan).not.toHaveBeenCalled();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/nutrition"));
  });

  it("shows the owner a note once the assigned athlete has removed their copy, and hides Set as active", () => {
    renderViewer({
      currentUserId: "coach-1",
      plan: makePlan({ owner_id: "coach-1", athlete_id: "athlete-1", removed_by_athlete_at: "2026-07-25T10:00:00.000Z" }),
    });

    expect(screen.getByText(/removed this from their own list/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("hides every management button for the athlete once they've already removed their own copy", () => {
    renderViewer({
      currentUserId: "athlete-1",
      plan: makePlan({ owner_id: "coach-1", athlete_id: "athlete-1", removed_by_athlete_at: "2026-07-25T10:00:00.000Z" }),
    });

    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("shows the error and does not navigate away when the delete mutation fails", async () => {
    vi.mocked(deleteMealPlan).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    renderViewer({ currentUserId: "coach-1", plan: makePlan({ owner_id: "coach-1", athlete_id: "coach-1" }) });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("calls setActiveMealPlan with the plan id when Set as active is clicked", async () => {
    vi.mocked(setActiveMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderViewer({ currentUserId: "coach-1", plan: makePlan({ owner_id: "coach-1", athlete_id: "coach-1", is_active: false }) });

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    expect(setActiveMealPlan).toHaveBeenCalledWith(expect.anything(), "plan-1");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });
});
