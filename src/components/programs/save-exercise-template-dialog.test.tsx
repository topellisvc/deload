// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveExerciseTemplateDialog } from "./save-exercise-template-dialog";
import type { BlockExerciseRow } from "@/lib/programs/types";

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: showToastMock }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/programs/exercise-templates", () => ({ saveExerciseAsTemplate: vi.fn() }));

import { saveExerciseAsTemplate } from "@/lib/programs/exercise-templates";

const exercise: BlockExerciseRow = {
  id: "ex-1",
  block_id: "block-1",
  position: 1,
  exercise_id: null,
  custom_name: "Bench Press",
  notes: null,
  exercise_category: "strength",
  sets: [],
};

describe("SaveExerciseTemplateDialog", () => {
  beforeEach(() => {
    vi.mocked(saveExerciseAsTemplate).mockReset();
    showToastMock.mockClear();
  });

  it("defaults the name to the exercise's display name and saves it on submit", async () => {
    vi.mocked(saveExerciseAsTemplate).mockResolvedValue({
      template: { id: "t-1", owner_id: "user-1", name: "Bench Press", exercise_category: "strength", template_data: exercise, created_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(<SaveExerciseTemplateDialog open exercise={exercise} currentUserId="user-1" onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Bench Press");
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(saveExerciseAsTemplate).toHaveBeenCalledWith(expect.anything(), {
      ownerId: "user-1",
      name: "Bench Press",
      exercise,
    });
    expect(showToastMock).toHaveBeenCalledWith('Saved "Bench Press" as a template');
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error and doesn't close when the save fails", async () => {
    vi.mocked(saveExerciseAsTemplate).mockResolvedValue({ template: null, error: "Something went wrong." });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<SaveExerciseTemplateDialog open exercise={exercise} currentUserId="user-1" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requires a non-empty name", async () => {
    const user = userEvent.setup();
    render(<SaveExerciseTemplateDialog open exercise={exercise} currentUserId="user-1" onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(await screen.findByText("Give the template a name.")).toBeInTheDocument();
    expect(saveExerciseAsTemplate).not.toHaveBeenCalled();
  });
});
