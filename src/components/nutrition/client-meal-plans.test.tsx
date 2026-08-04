// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientMealPlans } from "./client-meal-plans";
import type { NutritionPlanSummary } from "@/lib/nutrition/types";
import type { CoachClient } from "@/lib/supabase/types";

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
vi.mock("@/lib/nutrition/mutations", () => ({ deleteMealPlan: vi.fn(), setActiveMealPlan: vi.fn() }));

import { deleteMealPlan, setActiveMealPlan } from "@/lib/nutrition/mutations";

function makeClient(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    id: "rel-1",
    coach_id: "coach-1",
    client_id: "athlete-1",
    client_email: "athlete@example.com",
    coach_email: "coach@example.com",
    status: "active",
    invite_message: null,
    accepted_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

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

describe("ClientMealPlans", () => {
  beforeEach(() => {
    vi.mocked(deleteMealPlan).mockReset();
    vi.mocked(setActiveMealPlan).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("shows an empty state when the client has no meal plans", () => {
    render(<ClientMealPlans coachId="coach-1" client={makeClient()} plans={[]} activeClients={[]} />);
    expect(screen.getByText("No meal plans assigned yet.")).toBeInTheDocument();
  });

  it("renders a card per plan and deletes via deleteMealPlan on confirm", async () => {
    vi.mocked(deleteMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<ClientMealPlans coachId="coach-1" client={makeClient()} plans={[makePlan()]} activeClients={[]} />);

    expect(screen.getByText("Cutting plan")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteMealPlan).toHaveBeenCalledWith({}, "plan-1");
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("calls setActiveMealPlan and refreshes on success", async () => {
    vi.mocked(setActiveMealPlan).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<ClientMealPlans coachId="coach-1" client={makeClient()} plans={[makePlan({ is_active: false })]} activeClients={[]} />);

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    expect(setActiveMealPlan).toHaveBeenCalledWith({}, "plan-1");
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("hides Set as active for a plan the client already removed their own copy of", () => {
    render(
      <ClientMealPlans coachId="coach-1" client={makeClient()} plans={[makePlan({ removed_by_athlete_at: "2026-07-25T10:00:00.000Z" })]} activeClients={[]} />
    );
    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
  });
});
