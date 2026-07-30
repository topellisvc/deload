// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgramViewer } from "./program-viewer";
import type { ProgramTree } from "@/lib/programs/types";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
// Out of scope here — SendProgramDialog needs a ToastProvider and its own
// mutation, and only ever renders for isOwner. Its own behavior isn't
// what these tests are about.
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
  addWeek: vi.fn(),
}));
vi.mock("@/lib/logging/mutations", () => ({ skipRemainingDays: vi.fn() }));

import { deleteProgram, removeAssignedProgram, setActiveProgram, addWeek } from "@/lib/programs/mutations";
import { skipRemainingDays } from "@/lib/logging/mutations";

function makeProgram(overrides: Partial<ProgramTree> = {}): ProgramTree {
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
    weeks: [],
    ...overrides,
  };
}

function makeWeekWithDays(): ProgramTree["weeks"][number] {
  return {
    id: "week-1",
    program_id: "prog-1",
    position: 1,
    label: "Week 1",
    based_on_week_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    days: [
      { id: "day-1", week_id: "week-1", position: 1, label: "Day 1", is_rest_day: false, blocks: [] },
      { id: "day-2", week_id: "week-1", position: 2, label: "Rest", is_rest_day: true, blocks: [] },
      { id: "day-3", week_id: "week-1", position: 3, label: "Day 2", is_rest_day: false, blocks: [] },
    ],
  };
}

function renderViewer(overrides: Partial<Parameters<typeof ProgramViewer>[0]> = {}) {
  return render(
    <ProgramViewer
      program={makeProgram()}
      assignedByEmail={null}
      currentUserId="coach-1"
      logsByDay={{}}
      loggedSetsByExercise={{}}
      personalRecords={[]}
      activeClients={[]}
      draftDayIds={[]}
      {...overrides}
    />
  );
}

/**
 * The highest-stakes logic this session shipped: which mutation runs (a
 * real delete vs. removeAssignedProgram's soft delete), which confirm
 * copy shows, and when the management buttons disappear entirely — see
 * migrations 0017/0018 and this component's own canManage comment. These
 * tests exercise that branching directly rather than relying on the live
 * click-through testing alone.
 */
describe("ProgramViewer delete/remove", () => {
  beforeEach(() => {
    vi.mocked(deleteProgram).mockReset();
    vi.mocked(removeAssignedProgram).mockReset();
    vi.mocked(setActiveProgram).mockReset();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
  });

  it("calls deleteProgram, not removeAssignedProgram, when the owner deletes their program", async () => {
    vi.mocked(deleteProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderViewer({
      currentUserId: "coach-1",
      program: makeProgram({ owner_id: "coach-1", athlete_id: "coach-1" }),
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Delete "Push Pull Legs"/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    expect(removeAssignedProgram).not.toHaveBeenCalled();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/programs"));
  });

  it("calls removeAssignedProgram, not deleteProgram, when the athlete removes their assigned copy", async () => {
    vi.mocked(removeAssignedProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderViewer({
      currentUserId: "athlete-1",
      program: makeProgram({ owner_id: "coach-1", athlete_id: "athlete-1" }),
    });

    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/won't affect your coach's original/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(removeAssignedProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    expect(deleteProgram).not.toHaveBeenCalled();
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/programs"));
  });

  it("shows the owner a note once the assigned athlete has removed their copy, and hides Set as active", () => {
    renderViewer({
      currentUserId: "coach-1",
      program: makeProgram({
        owner_id: "coach-1",
        athlete_id: "athlete-1",
        removed_by_athlete_at: "2026-07-25T10:00:00.000Z",
      }),
    });

    expect(screen.getByText(/removed this from their own list/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
    // The owner can still clean the row up.
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("hides every management button for the athlete once they've already removed their own copy", () => {
    renderViewer({
      currentUserId: "athlete-1",
      program: makeProgram({
        owner_id: "coach-1",
        athlete_id: "athlete-1",
        removed_by_athlete_at: "2026-07-25T10:00:00.000Z",
      }),
    });

    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("shows the error and does not navigate away when the delete mutation fails", async () => {
    vi.mocked(deleteProgram).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    renderViewer({
      currentUserId: "coach-1",
      program: makeProgram({ owner_id: "coach-1", athlete_id: "coach-1" }),
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("calls setActiveProgram with the program id when Set as active is clicked", async () => {
    vi.mocked(setActiveProgram).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderViewer({
      currentUserId: "coach-1",
      program: makeProgram({ owner_id: "coach-1", athlete_id: "coach-1", is_active: false }),
    });

    await user.click(screen.getByRole("button", { name: /set as active/i }));

    expect(setActiveProgram).toHaveBeenCalledWith(expect.anything(), "prog-1");
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });
});

/**
 * Rule 2 of the autoregulation design (coach-answers §2 Rule 2) — "repeat
 * this week" / "skip ahead," an athlete self-service action on whichever
 * week is currently selected. addWeek's insert-side RLS only allows a
 * self-programmer (owner_id === athlete_id) today (see program-viewer.tsx's
 * own comment on why), so these tests exercise both that working case and
 * the coach-assigned case's honest fallback explanation.
 */
describe("ProgramViewer week actions (Rule 2)", () => {
  beforeEach(() => {
    vi.mocked(addWeek).mockReset();
    vi.mocked(skipRemainingDays).mockReset();
    routerMock.refresh.mockClear();
  });

  it("shows a working 'Repeat this week' for a self-programmer, and calls addWeek with this week as the source", async () => {
    vi.mocked(addWeek).mockResolvedValue({
      week: { id: "week-2", program_id: "prog-1", position: 2, label: "Week 2", based_on_week_id: "week-1", created_at: "2026-01-01T00:00:00.000Z", days: [] },
      error: null,
    });
    const user = userEvent.setup();
    renderViewer({
      currentUserId: "athlete-1",
      program: makeProgram({ owner_id: "athlete-1", athlete_id: "athlete-1", weeks: [makeWeekWithDays()] }),
    });

    await user.click(screen.getByRole("button", { name: "Repeat this week" }));

    expect(addWeek).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ programId: "prog-1", position: 2, sourceWeek: expect.objectContaining({ id: "week-1" }) })
    );
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });

  it("replaces 'Repeat this week' with an explanatory note for the athlete on a coach-assigned program", () => {
    renderViewer({
      currentUserId: "athlete-1",
      program: makeProgram({ owner_id: "coach-1", athlete_id: "athlete-1", weeks: [makeWeekWithDays()] }),
    });

    expect(screen.queryByRole("button", { name: "Repeat this week" })).not.toBeInTheDocument();
    expect(screen.getByText(/ask your coach to add another week/i)).toBeInTheDocument();
    expect(addWeek).not.toHaveBeenCalled();
  });

  it("skips only the non-rest days without a log yet, leaving rest days and already-logged days alone", async () => {
    vi.mocked(skipRemainingDays).mockResolvedValue({ skippedCount: 1, error: null });
    const user = userEvent.setup();
    renderViewer({
      currentUserId: "athlete-1",
      program: makeProgram({ owner_id: "coach-1", athlete_id: "athlete-1", weeks: [makeWeekWithDays()] }),
      logsByDay: {
        "day-1": [
          {
            id: "log-1",
            training_day_id: "day-1",
            athlete_id: "athlete-1",
            performed_on: "2026-07-29",
            note: null,
            skipped: false,
            completed_at: "2026-07-29T10:00:00.000Z",
            created_at: "2026-07-29T10:00:00.000Z",
          },
        ],
      },
    });

    await user.click(screen.getByRole("button", { name: "Skip rest of this week" }));

    expect(skipRemainingDays).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ trainingDayIds: ["day-3"], athleteId: "athlete-1" })
    );
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalled());
  });

  it("does not render either week action for a non-athlete viewer (e.g. a coach reviewing their own build)", () => {
    renderViewer({
      currentUserId: "coach-1",
      program: makeProgram({ owner_id: "coach-1", athlete_id: "athlete-1", weeks: [makeWeekWithDays()] }),
    });

    expect(screen.queryByRole("button", { name: "Repeat this week" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip rest of this week" })).not.toBeInTheDocument();
  });
});
