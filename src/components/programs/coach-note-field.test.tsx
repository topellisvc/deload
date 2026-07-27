// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoachNoteField } from "./coach-note-field";

describe("CoachNoteField", () => {
  it("collapses to a '+ Add coach note' affordance when there's no note yet", () => {
    render(<CoachNoteField value={null} onCommit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add coach note/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the textarea directly, already expanded, when a note already exists", () => {
    render(<CoachNoteField value="Focus on bar speed." onCommit={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: /coach note/i })).toHaveValue("Focus on bar speed.");
    expect(screen.queryByRole("button", { name: /add coach note/i })).not.toBeInTheDocument();
  });

  it("expands into an editable textarea after clicking 'Add coach note'", async () => {
    const user = userEvent.setup();
    render(<CoachNoteField value={null} onCommit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /add coach note/i }));
    expect(screen.getByRole("textbox", { name: /coach note/i })).toBeInTheDocument();
  });

  it("commits the trimmed text on blur", async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<CoachNoteField value={null} onCommit={onCommit} />);
    await user.click(screen.getByRole("button", { name: /add coach note/i }));
    await user.type(screen.getByRole("textbox", { name: /coach note/i }), "  Leave 2 in reserve.  ");
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith("Leave 2 in reserve.");
  });

  it("collapses back to the affordance if cleared to empty", async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<CoachNoteField value="Old note" onCommit={onCommit} />);
    const textarea = screen.getByRole("textbox", { name: /coach note/i });
    await user.clear(textarea);
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(null);
  });
});
