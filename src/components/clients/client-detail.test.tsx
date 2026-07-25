// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientDetail } from "./client-detail";
import type { ProgramSummary } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/programs/send-program-dialog", () => ({ SendProgramDialog: () => null }));
vi.mock("@/components/programs/new-program-dialog", () => ({ NewProgramDialog: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/programs/mutations", () => ({
  deleteProgram: vi.fn(),
  setActiveProgram: vi.fn(),
}));

import { deleteProgram, setActiveProgram } from "@/lib/programs/mutations";

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
 * This is a coach-only page — unlike ProgramsList/ProgramViewer, there's no
 * owner-vs-athlete branch: deleteProgram is the only delete path here, and
 * canSetActive is the one thing removed_by_athlete_at still turns off (see
 * the comment above ProgramCard in client-detail.tsx).
 */
describe("ClientDetail", () => {
  beforeEach(() => {
    vi.mocked(deleteProgram).mockReset();
    vi.mocked(setActiveProgram).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("always calls deleteProgram (never removeAssignedProgram) since this page is coach-only", async () => {
    vi.mocked(deleteProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <ClientDetail
        coachId="coach-1"
        client={makeClient()}
        programs={[makeProgram()]}
        lastActivityOn={null}
        activeClients={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Delete "Push Pull Legs"/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    await waitFor(() => expect(screen.queryByText("Push Pull Legs")).not.toBeInTheDocument());
  });

  it("hides Set as active once the client has removed their own copy, but keeps Delete available", () => {
    render(
      <ClientDetail
        coachId="coach-1"
        client={makeClient()}
        programs={[makeProgram({ removed_by_athlete_at: "2026-07-25T10:00:00.000Z" })]}
        lastActivityOn={null}
        activeClients={[]}
      />
    );

    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByText(/Removed by the assigned athlete/i)).toBeInTheDocument();
  });

  it("rolls back the optimistic delete and shows the error when deleteProgram fails", async () => {
    vi.mocked(deleteProgram).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    render(
      <ClientDetail
        coachId="coach-1"
        client={makeClient()}
        programs={[makeProgram()]}
        lastActivityOn={null}
        activeClients={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
  });

  it("calls setActiveProgram and refreshes on success", async () => {
    vi.mocked(setActiveProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <ClientDetail
        coachId="coach-1"
        client={makeClient()}
        programs={[makeProgram({ is_active: false })]}
        lastActivityOn={null}
        activeClients={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    expect(setActiveProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });
});
