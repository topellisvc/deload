// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendMealPlanDialog } from "./send-meal-plan-dialog";
import type { NutritionPlanTree } from "@/lib/nutrition/types";
import type { CoachClient } from "@/lib/supabase/types";

const { routerMock, showToastMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn() }, showToastMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: showToastMock }) }));
vi.mock("@/lib/nutrition/mutations", () => ({ cloneMealPlan: vi.fn() }));

import * as m from "@/lib/nutrition/mutations";

const plan: NutritionPlanTree = {
  id: "plan-1",
  owner_id: "coach-1",
  athlete_id: "coach-1",
  name: "Cutting plan",
  notes: null,
  daily_calories_target: null,
  daily_protein_target_g: null,
  daily_carbs_target_g: null,
  daily_fat_target_g: null,
  is_active: false,
  removed_by_athlete_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  days: [],
};

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

describe("SendMealPlanDialog", () => {
  beforeEach(() => {
    vi.mocked(m.cloneMealPlan).mockReset();
    routerMock.push.mockReset();
    showToastMock.mockReset();
  });

  it("defaults the copy's name to '<plan name> (copy)'", () => {
    render(<SendMealPlanDialog open onClose={vi.fn()} plan={plan} currentUserId="coach-1" activeClients={[]} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Cutting plan (copy)");
  });

  it("clones for myself by default, toasts, and navigates to the copy's edit page", async () => {
    vi.mocked(m.cloneMealPlan).mockResolvedValue({ plan: { id: "plan-2" } as never, error: null });
    const user = userEvent.setup();
    render(<SendMealPlanDialog open onClose={vi.fn()} plan={plan} currentUserId="coach-1" activeClients={[]} />);

    await user.click(screen.getByRole("button", { name: "Send copy" }));

    expect(m.cloneMealPlan).toHaveBeenCalledWith(expect.anything(), {
      sourcePlan: plan,
      ownerId: "coach-1",
      athleteId: "coach-1",
      name: "Cutting plan (copy)",
    });
    expect(showToastMock).toHaveBeenCalledWith('"Cutting plan (copy)" copied for you');
    expect(routerMock.push).toHaveBeenCalledWith("/nutrition/plan-2/edit");
  });

  it("clones to the selected client and toasts their email", async () => {
    vi.mocked(m.cloneMealPlan).mockResolvedValue({ plan: { id: "plan-3" } as never, error: null });
    const user = userEvent.setup();
    render(<SendMealPlanDialog open onClose={vi.fn()} plan={plan} currentUserId="coach-1" activeClients={[client]} />);

    await user.selectOptions(screen.getByLabelText("For"), "athlete-1");
    await user.click(screen.getByRole("button", { name: "Send copy" }));

    expect(m.cloneMealPlan).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ athleteId: "athlete-1" }));
    expect(showToastMock).toHaveBeenCalledWith("Sent to athlete@example.com");
  });
});
