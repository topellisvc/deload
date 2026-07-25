// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgramCard } from "./program-card";
import type { ProgramSummary } from "@/lib/programs/types";

// ProgramCard renders next/link's <Link>, which normally needs an App
// Router context to do its prefetch/navigation work — not present in a
// bare RTL render. Swapping in a plain <a> keeps these tests about
// ProgramCard's own rendering/permission logic instead of Next's router
// internals.
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

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

function noop() {}

/**
 * ProgramCard is the one place canSetActive/canSend/canDelete (computed
 * differently per caller — programs-list.tsx, client-detail.tsx,
 * shared-programs-section.tsx, all with their own owner/athlete/removed
 * logic) actually turn into visible buttons. These tests pin down that
 * each flag independently controls its own button, that a click always
 * carries the program's id back to the caller, and that the "removed by
 * the athlete" note (migration 0018) renders from the row's own data
 * regardless of what the caller passed for the action flags.
 */
describe("ProgramCard", () => {
  it("shows all three actions when allowed and the program isn't active yet", () => {
    render(
      <ProgramCard
        program={makeProgram()}
        canSetActive
        settingActive={false}
        onSetActive={noop}
        canSend
        sendingCopy={false}
        onSend={noop}
        canDelete
        deleting={false}
        onDelete={noop}
      />
    );
    expect(screen.getByRole("button", { name: /set as active/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send a copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("hides every action button when none are allowed", () => {
    render(
      <ProgramCard
        program={makeProgram()}
        canSetActive={false}
        settingActive={false}
        onSetActive={noop}
        canSend={false}
        sendingCopy={false}
        onSend={noop}
        canDelete={false}
        deleting={false}
        onDelete={noop}
      />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("hides Set as active once the program is already active, even if canSetActive is true", () => {
    render(
      <ProgramCard
        program={makeProgram({ is_active: true })}
        canSetActive
        settingActive={false}
        onSetActive={noop}
        canSend={false}
        sendingCopy={false}
        onSend={noop}
        canDelete={false}
        deleting={false}
        onDelete={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /set as active/i })).not.toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("calls onSetActive with the program's id, not just a bare handler", async () => {
    const onSetActive = vi.fn();
    const user = userEvent.setup();
    render(
      <ProgramCard
        program={makeProgram({ id: "prog-42" })}
        canSetActive
        settingActive={false}
        onSetActive={onSetActive}
        canSend={false}
        sendingCopy={false}
        onSend={noop}
        canDelete={false}
        deleting={false}
        onDelete={noop}
      />
    );
    await user.click(screen.getByRole("button", { name: /set as active/i }));
    expect(onSetActive).toHaveBeenCalledWith("prog-42");
  });

  it("calls onDelete with the program's id", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ProgramCard
        program={makeProgram({ id: "prog-99" })}
        canSetActive={false}
        settingActive={false}
        onSetActive={noop}
        canSend={false}
        sendingCopy={false}
        onSend={noop}
        canDelete
        deleting={false}
        onDelete={onDelete}
      />
    );
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("prog-99");
  });

  it("shows 'Save as template' only when canSaveAsTemplate is passed, and calls the handler with the program's id", async () => {
    const onSaveAsTemplate = vi.fn();
    const user = userEvent.setup();
    render(
      <ProgramCard
        program={makeProgram({ id: "prog-7" })}
        canSetActive={false}
        settingActive={false}
        onSetActive={noop}
        canSend={false}
        sendingCopy={false}
        onSend={noop}
        canSaveAsTemplate
        savingTemplate={false}
        onSaveAsTemplate={onSaveAsTemplate}
        canDelete={false}
        deleting={false}
        onDelete={noop}
      />
    );
    await user.click(screen.getByRole("button", { name: "Save as template" }));
    expect(onSaveAsTemplate).toHaveBeenCalledWith("prog-7");
  });

  it("omits 'Save as template' when canSaveAsTemplate isn't passed (defaults to hidden)", () => {
    render(
      <ProgramCard
        program={makeProgram()}
        canSetActive={false}
        settingActive={false}
        onSetActive={noop}
        canSend={false}
        sendingCopy={false}
        onSend={noop}
        canDelete={false}
        deleting={false}
        onDelete={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /save as template/i })).not.toBeInTheDocument();
  });

  it("shows the assignment label on a coach's client program", () => {
    render(
      <ProgramCard
        program={makeProgram({ assignmentLabel: "For jane@example.com" })}
        canSetActive={false}
        settingActive={false}
        onSetActive={noop}
        canSend={false}
        sendingCopy={false}
        onSend={noop}
        canDelete={false}
        deleting={false}
        onDelete={noop}
      />
    );
    expect(screen.getByText("For jane@example.com")).toBeInTheDocument();
  });

  it("shows a 'Removed by' note using the client's email once the athlete has removed their assigned copy", () => {
    render(
      <ProgramCard
        program={makeProgram({
          assignmentLabel: "For jane@example.com",
          removed_by_athlete_at: "2026-07-25T10:00:00.000Z",
        })}
        canSetActive={false}
        settingActive={false}
        onSetActive={noop}
        canSend
        sendingCopy={false}
        onSend={noop}
        canDelete
        deleting={false}
        onDelete={noop}
      />
    );
    expect(screen.getByText(/Removed by jane@example\.com on/)).toBeInTheDocument();
  });

  it("falls back to generic wording for the 'Removed by' note when there's no assignment label to pull a name from", () => {
    render(
      <ProgramCard
        program={makeProgram({ removed_by_athlete_at: "2026-07-25T10:00:00.000Z" })}
        canSetActive={false}
        settingActive={false}
        onSetActive={noop}
        canSend={false}
        sendingCopy={false}
        onSend={noop}
        canDelete={false}
        deleting={false}
        onDelete={noop}
      />
    );
    expect(screen.getByText(/Removed by the assigned athlete on/)).toBeInTheDocument();
  });
});
