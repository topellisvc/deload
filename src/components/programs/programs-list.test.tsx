// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgramsList } from "./programs-list";
import type { ProgramSummary } from "@/lib/programs/types";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/programs/send-program-dialog", () => ({ SendProgramDialog: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/programs/mutations", () => ({
  deleteProgram: vi.fn(),
  removeAssignedProgram: vi.fn(),
  setActiveProgram: vi.fn(),
  createProgram: vi.fn(),
}));

import { deleteProgram, removeAssignedProgram, setActiveProgram } from "@/lib/programs/mutations";

function makeProgram(overrides: Partial<ProgramSummary> = {}): ProgramSummary {
  return {
    id: "prog-1",
    owner_id: "user-1",
    athlete_id: "user-1",
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
 * Same owner/athlete delete branching as program-viewer.test.tsx, but
 * exercised from the list page — plus the set-active optimistic update
 * (and its rollback on error), which only lives here and in
 * client-detail.tsx/shared-programs-section.tsx.
 */
describe("ProgramsList", () => {
  beforeEach(() => {
    vi.mocked(deleteProgram).mockReset();
    vi.mocked(removeAssignedProgram).mockReset();
    vi.mocked(setActiveProgram).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("calls deleteProgram and optimistically removes the card when the owner deletes their own program", async () => {
    vi.mocked(deleteProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<ProgramsList programs={[makeProgram()]} userId="user-1" activeClients={[]} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete program?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    expect(removeAssignedProgram).not.toHaveBeenCalled();
    expect(screen.queryByText("Push Pull Legs")).not.toBeInTheDocument();
  });

  it("calls removeAssignedProgram, not deleteProgram, when the viewer is only the assigned athlete", async () => {
    vi.mocked(removeAssignedProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <ProgramsList
        programs={[makeProgram({ owner_id: "coach-1", athlete_id: "user-1", assignmentLabel: "From coach@example.com" })]}
        userId="user-1"
        activeClients={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Remove program?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(removeAssignedProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    expect(deleteProgram).not.toHaveBeenCalled();
  });

  it("puts the card back and shows the error when the delete mutation fails", async () => {
    vi.mocked(deleteProgram).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    render(<ProgramsList programs={[makeProgram()]} userId="user-1" activeClients={[]} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
  });

  it("optimistically deactivates every other program for the same athlete when one is set active", async () => {
    vi.mocked(setActiveProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <ProgramsList
        programs={[
          makeProgram({ id: "prog-1", name: "Program A", athlete_id: "user-1", is_active: true }),
          makeProgram({ id: "prog-2", name: "Program B", athlete_id: "user-1", is_active: false }),
        ]}
        userId="user-1"
        activeClients={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    expect(setActiveProgram).toHaveBeenCalledWith(expect.anything(), "prog-2");
    // Program B is now active (badge shown, no more "Set as active" button on
    // its own card), and Program A flipped the other way — it lost its badge
    // and now offers the button instead. Net: exactly one "Set as active"
    // button in the DOM, now on A's card rather than B's.
    expect(screen.getAllByRole("button", { name: /set as active/i })).toHaveLength(1);
    expect(screen.getByText("Active")).toBeInTheDocument();
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });

  it("rolls back the optimistic activation and shows the error when setActiveProgram fails", async () => {
    vi.mocked(setActiveProgram).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    render(<ProgramsList programs={[makeProgram({ is_active: false })]} userId="user-1" activeClients={[]} />);

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    // Rolled back: the button is offered again instead of the program
    // being stuck looking active.
    expect(screen.getByRole("button", { name: /set as active/i })).toBeInTheDocument();
  });
});
