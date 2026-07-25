// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SharedProgramsSection } from "./shared-programs-section";
import type { ProgramSummary } from "@/lib/programs/types";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/programs/mutations", () => ({
  removeAssignedProgram: vi.fn(),
  setActiveProgram: vi.fn(),
}));

import { removeAssignedProgram, setActiveProgram } from "@/lib/programs/mutations";

function makeProgram(overrides: Partial<ProgramSummary> = {}): ProgramSummary {
  return {
    id: "prog-1",
    owner_id: "coach-1",
    athlete_id: "athlete-1",
    name: "Push Pull Legs",
    discipline: "hybrid",
    is_active: false,
    removed_by_athlete_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    weekCount: 2,
    dayCount: 3,
    assignmentLabel: null,
    ...overrides,
  };
}

/**
 * This section is always the athlete's own view of a coach-assigned
 * program — never the owner's — so removeAssignedProgram is the only
 * delete-family mutation it ever calls, and canSend is permanently off (see
 * the component's own comment). The defensive athlete_id filter in state
 * init is also covered here since it's the one thing standing between a
 * caller bug and rendering a program that isn't the viewer's to manage.
 */
describe("SharedProgramsSection", () => {
  beforeEach(() => {
    vi.mocked(removeAssignedProgram).mockReset();
    vi.mocked(setActiveProgram).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("never shows a Send a copy button", () => {
    render(<SharedProgramsSection programs={[makeProgram()]} userId="athlete-1" />);
    expect(screen.queryByRole("button", { name: /send a copy/i })).not.toBeInTheDocument();
  });

  it("filters out any program where the viewer isn't the athlete_id, even if the caller passed one in", () => {
    render(
      <SharedProgramsSection
        programs={[makeProgram({ id: "prog-2", name: "Not mine", athlete_id: "someone-else" })]}
        userId="athlete-1"
      />
    );
    expect(screen.getByText(/hasn't assigned you any programs yet/i)).toBeInTheDocument();
  });

  it("calls removeAssignedProgram and optimistically removes the card on confirm", async () => {
    vi.mocked(removeAssignedProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SharedProgramsSection programs={[makeProgram()]} userId="athlete-1" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Remove "Push Pull Legs"/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(removeAssignedProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    await waitFor(() => expect(screen.getByText(/hasn't assigned you any programs yet/i)).toBeInTheDocument());
  });

  it("rolls back and shows the error when removeAssignedProgram fails", async () => {
    vi.mocked(removeAssignedProgram).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    render(<SharedProgramsSection programs={[makeProgram()]} userId="athlete-1" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
  });

  it("calls setActiveProgram and refreshes on success", async () => {
    vi.mocked(setActiveProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SharedProgramsSection programs={[makeProgram({ is_active: false })]} userId="athlete-1" />);

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    expect(setActiveProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });

  it("hides Set as active and Delete once the athlete has already removed their own copy", () => {
    render(
      <SharedProgramsSection
        programs={[makeProgram({ removed_by_athlete_at: "2026-07-25T10:00:00.000Z" })]}
        userId="athlete-1"
      />
    );

    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
