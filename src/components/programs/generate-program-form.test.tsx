// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GenerateProgramForm } from "./generate-program-form";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/programs/mutations", () => ({ createProgramFromParsedProgram: vi.fn() }));

import { createProgramFromParsedProgram } from "@/lib/programs/mutations";

function mockFetchOnce(response: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(response),
    })
  );
}

describe("GenerateProgramForm", () => {
  beforeEach(() => {
    routerMock.push.mockClear();
    vi.mocked(createProgramFromParsedProgram).mockReset();
    vi.unstubAllGlobals();
  });

  it("submits the default (already-valid) answers and shows a review screen with warnings on success", async () => {
    const user = userEvent.setup();
    mockFetchOnce({
      name: "Get Stronger — Beginner",
      discipline: "resistance",
      weeks: [{ id: "", program_id: "", position: 1, label: "Week 1", based_on_week_id: null, created_at: "", days: [] }],
      warnings: ["A 2-day week is a maintenance dose for an advanced lifter."],
      recommendConsultation: null,
    });

    render(<GenerateProgramForm userId="user-1" />);
    await user.click(screen.getByRole("button", { name: "Generate program" }));

    await waitFor(() => expect(screen.getByText("Get Stronger — Beginner")).toBeInTheDocument());
    expect(screen.getByText("A 2-day week is a maintenance dose for an advanced lifter.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create this program" })).toBeInTheDocument();
  });

  it("shows the recommend-consultation banner prominently when it fires", async () => {
    const user = userEvent.setup();
    mockFetchOnce({
      name: "Conservative Full Body",
      discipline: "resistance",
      weeks: [],
      warnings: [],
      recommendConsultation: { reason: "Shoulder and lower back are both flagged." },
    });

    render(<GenerateProgramForm userId="user-1" />);
    await user.click(screen.getByRole("button", { name: "Generate program" }));

    await waitFor(() => expect(screen.getByText("Shoulder and lower back are both flagged.")).toBeInTheDocument());
  });

  it("shows a stop screen for needsHumanReason with no way to resubmit the same form", async () => {
    const user = userEvent.setup();
    mockFetchOnce({ needsHumanReason: "Pain that wakes you at night needs a clinical assessment before training." });

    render(<GenerateProgramForm userId="user-1" />);
    await user.click(screen.getByRole("button", { name: "Generate program" }));

    await waitFor(() => expect(screen.getByText(/needs a real coach/i)).toBeInTheDocument());
    expect(screen.getByText("Pain that wakes you at night needs a clinical assessment before training.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate program" })).not.toBeInTheDocument();
  });

  it("shows an inline error and keeps the form editable when the combination can't produce a sound plan", async () => {
    const user = userEvent.setup();
    mockFetchOnce({ error: "Marathon goal needs at least 24 weeks of lead time without an existing running base." });

    render(<GenerateProgramForm userId="user-1" />);
    await user.click(screen.getByRole("button", { name: "Generate program" }));

    await waitFor(() => expect(screen.getByText("Marathon goal needs at least 24 weeks of lead time without an existing running base.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Generate program" })).toBeInTheDocument();
  });

  it("confirming from the review screen creates the program and navigates to its editor", async () => {
    const user = userEvent.setup();
    const weeks = [{ id: "", program_id: "", position: 1, label: "Week 1", based_on_week_id: null, created_at: "", days: [] }];
    mockFetchOnce({ name: "Get Stronger — Beginner", discipline: "resistance", weeks, warnings: [], recommendConsultation: null });
    vi.mocked(createProgramFromParsedProgram).mockResolvedValue({ program: { id: "prog-1" } as never, error: null });

    render(<GenerateProgramForm userId="user-1" />);
    await user.click(screen.getByRole("button", { name: "Generate program" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create this program" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Create this program" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/programs/prog-1/edit"));
    expect(createProgramFromParsedProgram).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: "Get Stronger — Beginner", discipline: "resistance", weeks, userId: "user-1" })
    );
  });

  it("reveals the bodybuilding lagging-muscle-group section only for that goal", async () => {
    const user = userEvent.setup();
    render(<GenerateProgramForm userId="user-1" />);
    expect(screen.queryByText("Lagging muscle groups")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Goal"), "build_muscle_bodybuilding");
    expect(screen.getByText("Lagging muscle groups")).toBeInTheDocument();
  });

  it("reveals running-history fields for a run goal and hybrid priority fields for hybrid", async () => {
    const user = userEvent.setup();
    render(<GenerateProgramForm userId="user-1" />);

    await user.selectOptions(screen.getByLabelText("Goal"), "run_10k");
    expect(screen.getByText("Running history")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Goal"), "hybrid");
    expect(screen.getByText("Hybrid priority")).toBeInTheDocument();
  });

  it("reveals a follow-up presentation picker only once an injury is flagged", async () => {
    const user = userEvent.setup();
    render(<GenerateProgramForm userId="user-1" />);
    expect(screen.queryByText("Not sure")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Lower back"));
    expect(screen.getAllByText("Not sure").length).toBeGreaterThan(0);
  });
});
