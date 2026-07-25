// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveAsTemplateDialog } from "./save-as-template-dialog";
import type { ProgramTree } from "@/lib/programs/types";

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: showToastMock }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/programs/mutations", () => ({ saveProgramAsTemplate: vi.fn() }));

import { saveProgramAsTemplate } from "@/lib/programs/mutations";

const program: ProgramTree = {
  id: "prog-1",
  owner_id: "user-1",
  athlete_id: "user-1",
  name: "Full Body Strength",
  discipline: "resistance",
  is_active: false,
  removed_by_athlete_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  weeks: [],
};

describe("SaveAsTemplateDialog", () => {
  beforeEach(() => {
    vi.mocked(saveProgramAsTemplate).mockReset();
    showToastMock.mockClear();
  });

  it("defaults the name to '<program name> template' and saves it on submit", async () => {
    vi.mocked(saveProgramAsTemplate).mockResolvedValue({
      template: { id: "t-1", owner_id: "user-1", name: "Full Body Strength template", discipline: "resistance", template_data: { weeks: [] }, created_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(<SaveAsTemplateDialog open program={program} currentUserId="user-1" onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Full Body Strength template");
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(saveProgramAsTemplate).toHaveBeenCalledWith(expect.anything(), {
      program,
      ownerId: "user-1",
      name: "Full Body Strength template",
    });
    expect(showToastMock).toHaveBeenCalledWith('Saved "Full Body Strength template" as a template');
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error and doesn't close when the save fails", async () => {
    vi.mocked(saveProgramAsTemplate).mockResolvedValue({ template: null, error: "Something went wrong." });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<SaveAsTemplateDialog open program={program} currentUserId="user-1" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requires a non-empty name", async () => {
    const user = userEvent.setup();
    render(<SaveAsTemplateDialog open program={program} currentUserId="user-1" onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(await screen.findByText("Give the template a name.")).toBeInTheDocument();
    expect(saveProgramAsTemplate).not.toHaveBeenCalled();
  });
});
