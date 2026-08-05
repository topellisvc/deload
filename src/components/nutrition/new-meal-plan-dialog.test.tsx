// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewMealPlanDialog } from "./new-meal-plan-dialog";
import type { CoachClient } from "@/lib/supabase/types";
import type { PlanTemplateTree } from "@/lib/nutrition/types";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/nutrition/mutations", () => ({ createMealPlan: vi.fn(), instantiatePlanTemplate: vi.fn() }));
vi.mock("@/lib/nutrition/queries", () => ({ getMealTemplatesByIds: vi.fn().mockResolvedValue([]) }));

import * as m from "@/lib/nutrition/mutations";
import * as q from "@/lib/nutrition/queries";

const client: CoachClient = {
  id: "rel-1",
  coach_id: "coach-1",
  client_id: "athlete-1",
  client_email: "athlete@example.com",
  coach_email: "coach@example.com",
  status: "active",
  invite_message: null,
  accepted_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

const balancedMaintenance: PlanTemplateTree = {
  id: "plan-template-1",
  name: "Balanced Maintenance",
  description: "A straightforward three-day rotation.",
  goal: "maintenance",
  position: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  days: [
    {
      id: "ptd-1",
      template_id: "plan-template-1",
      position: 1,
      label: "Day 1",
      meals: [
        { id: "ptm-1", day_id: "ptd-1", position: 1, name: "Breakfast", meal_template_id: "mt-1", mealTemplateName: "Greek Yogurt & Berries Bowl", mealTemplateCategory: "breakfast" },
      ],
    },
  ],
};

describe("NewMealPlanDialog", () => {
  beforeEach(() => {
    vi.mocked(m.createMealPlan).mockReset();
    vi.mocked(m.instantiatePlanTemplate).mockReset();
    vi.mocked(q.getMealTemplatesByIds).mockReset().mockResolvedValue([]);
    routerMock.push.mockReset();
  });

  it("requires a name before submitting", async () => {
    const user = userEvent.setup();
    render(<NewMealPlanDialog open onClose={vi.fn()} userId="coach-1" activeClients={[]} />);

    await user.click(screen.getByRole("button", { name: "Create meal plan" }));

    expect(await screen.findByText("Give the meal plan a name.")).toBeInTheDocument();
    expect(m.createMealPlan).not.toHaveBeenCalled();
  });

  it("creates a plan for myself by default and navigates to its edit page", async () => {
    vi.mocked(m.createMealPlan).mockResolvedValue({ plan: { id: "plan-1" } as never, error: null });
    const user = userEvent.setup();
    render(<NewMealPlanDialog open onClose={vi.fn()} userId="coach-1" activeClients={[]} />);

    await user.type(screen.getByLabelText("Name"), "Cutting plan");
    await user.click(screen.getByRole("button", { name: "Create meal plan" }));

    expect(m.createMealPlan).toHaveBeenCalledWith(expect.anything(), { userId: "coach-1", name: "Cutting plan", athleteId: undefined });
    expect(routerMock.push).toHaveBeenCalledWith("/nutrition/plan-1/edit");
  });

  it("passes the selected client's id as athleteId when assigning to a client", async () => {
    vi.mocked(m.createMealPlan).mockResolvedValue({ plan: { id: "plan-2" } as never, error: null });
    const user = userEvent.setup();
    render(<NewMealPlanDialog open onClose={vi.fn()} userId="coach-1" activeClients={[client]} />);

    await user.type(screen.getByLabelText("Name"), "Bulking plan");
    await user.selectOptions(screen.getByLabelText("For"), "athlete-1");
    await user.click(screen.getByRole("button", { name: "Create meal plan" }));

    expect(m.createMealPlan).toHaveBeenCalledWith(expect.anything(), { userId: "coach-1", name: "Bulking plan", athleteId: "athlete-1" });
  });

  it("hides the Start from picker entirely when no plan templates were passed in", () => {
    render(<NewMealPlanDialog open onClose={vi.fn()} userId="coach-1" activeClients={[]} />);
    expect(screen.queryByLabelText("Start from")).not.toBeInTheDocument();
  });

  it("calls instantiatePlanTemplate instead of createMealPlan when a template is picked", async () => {
    vi.mocked(q.getMealTemplatesByIds).mockResolvedValue([]);
    vi.mocked(m.instantiatePlanTemplate).mockResolvedValue({ plan: { id: "plan-3" } as never, error: null });
    const user = userEvent.setup();
    render(<NewMealPlanDialog open onClose={vi.fn()} userId="coach-1" activeClients={[]} planTemplates={[balancedMaintenance]} />);

    await user.type(screen.getByLabelText("Name"), "My new plan");
    await user.selectOptions(screen.getByLabelText("Start from"), "plan-template-1");
    await user.click(screen.getByRole("button", { name: "Create meal plan" }));

    expect(q.getMealTemplatesByIds).toHaveBeenCalledWith(expect.anything(), ["mt-1"]);
    expect(m.instantiatePlanTemplate).toHaveBeenCalledWith(expect.anything(), {
      userId: "coach-1",
      athleteId: undefined,
      name: "My new plan",
      planTemplate: balancedMaintenance,
      mealTemplatesById: new Map(),
    });
    expect(m.createMealPlan).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith("/nutrition/plan-3/edit");
  });
});
