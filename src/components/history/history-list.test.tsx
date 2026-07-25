// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryList } from "./history-list";
import type { SessionHistoryEntry } from "@/lib/logging/queries";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/logging/mutations", () => ({ deleteSessionLog: vi.fn() }));

import { deleteSessionLog } from "@/lib/logging/mutations";

function makeEntry(overrides: Partial<SessionHistoryEntry> = {}, logOverrides: Partial<SessionHistoryEntry["log"]> = {}): SessionHistoryEntry {
  return {
    log: {
      id: "log-1",
      training_day_id: "day-1",
      athlete_id: "athlete-1",
      performed_on: "2026-07-20",
      note: null,
      skipped: false,
      completed_at: "2026-07-20T10:00:00.000Z",
      created_at: "2026-07-20T10:00:00.000Z",
      ...logOverrides,
    },
    programId: "prog-1",
    programName: "Push Pull Legs",
    dayLabel: "Day 1",
    blocks: [],
    ...overrides,
  };
}

/**
 * The delete flow (confirm, optimistic removal, error rollback) — same
 * pattern as ProgramsList/ProgramViewer, just for session logs. Expand/
 * collapse and the read-only SessionPerformanceEditor detail view aren't
 * covered here; they're display-only and were already exercised live.
 */
describe("HistoryList delete", () => {
  beforeEach(() => {
    vi.mocked(deleteSessionLog).mockReset();
  });

  it("removes the entry after confirming delete succeeds", async () => {
    vi.mocked(deleteSessionLog).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<HistoryList entries={[makeEntry()]} loggedSetsByExercise={{}} />);

    await user.click(screen.getByRole("button", { name: /Delete session from/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete session?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteSessionLog).toHaveBeenCalledWith(expect.anything(), "log-1");
    await waitFor(() => expect(screen.getByText("Nothing logged yet.")).toBeInTheDocument());
  });

  it("keeps the entry and shows the error when delete fails", async () => {
    vi.mocked(deleteSessionLog).mockResolvedValue({ error: "Couldn't remove this log. Try again." });
    const user = userEvent.setup();
    render(<HistoryList entries={[makeEntry()]} loggedSetsByExercise={{}} />);

    await user.click(screen.getByRole("button", { name: /Delete session from/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByText("Couldn't remove this log. Try again.")).toBeInTheDocument());
    expect(screen.getByText("Push Pull Legs · Day 1")).toBeInTheDocument();
  });

  it("only removes the deleted entry, leaving the rest of the list intact", async () => {
    vi.mocked(deleteSessionLog).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(
      <HistoryList
        entries={[
          makeEntry({ programName: "Program A" }, { id: "log-1", performed_on: "2026-07-20" }),
          makeEntry({ programName: "Program B" }, { id: "log-2", performed_on: "2026-07-19" }),
        ]}
        loggedSetsByExercise={{}}
      />
    );

    const deleteButtons = screen.getAllByRole("button", { name: /Delete session from/i });
    await user.click(deleteButtons[0]!);
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteSessionLog).toHaveBeenCalledWith(expect.anything(), "log-1");
    await waitFor(() => expect(screen.queryByText("Program A · Day 1")).not.toBeInTheDocument());
    expect(screen.getByText("Program B · Day 1")).toBeInTheDocument();
  });
});
