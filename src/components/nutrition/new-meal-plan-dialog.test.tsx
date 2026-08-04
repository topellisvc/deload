// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewMealPlanDialog } from "./new-meal-plan-dialog";
import type { CoachClient } from "@/lib/supabase/types";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/nutrition/mutations", () => ({ createMealPlan: vi.fn() }));

import * as m from "@/lib/nutrition/mutations";

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

describe("NewMealPlanDialog", () => {
  beforeEach(() => {
    vi.mocked(m.createMealPlan).mockReset();
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
});
