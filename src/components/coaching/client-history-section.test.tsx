// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientHistorySection } from "./client-history-section";
import type { SessionHistoryEntry } from "@/lib/logging/queries";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/logging/mutations", () => ({ deleteSessionLog: vi.fn() }));

function makeEntry(overrides: Partial<SessionHistoryEntry> = {}): SessionHistoryEntry {
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
    },
    programId: "prog-1",
    programName: "Push Pull Legs",
    dayLabel: "Day 1",
    blocks: [],
    ...overrides,
  };
}

/**
 * This is a thin wrapper around HistoryList — the delete/expand behavior
 * is already covered by history-list.test.tsx. What's specific to this
 * component, and worth its own test, is the one thing it's for: a coach
 * gets the "Workout history" heading like every other athlete-detail
 * section, but never a delete button — deleting a client's real training
 * record isn't a coach action (see HistoryList's canDelete comment).
 */
describe("ClientHistorySection", () => {
  it("shows the Workout history heading and full session detail, with no delete affordance", () => {
    render(<ClientHistorySection entries={[makeEntry()]} loggedSetsByExercise={{}} />);

    expect(screen.getByText("Workout history")).toBeInTheDocument();
    expect(screen.getByText("Push Pull Legs · Day 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete session from/i })).not.toBeInTheDocument();
  });

  it("still shows HistoryList's own empty state when the client has nothing logged", () => {
    render(<ClientHistorySection entries={[]} loggedSetsByExercise={{}} />);

    expect(screen.getByText("Nothing logged yet.")).toBeInTheDocument();
  });
});
