// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveDayTemplateDialog } from "./save-day-template-dialog";
import type { DayRow } from "@/lib/programs/types";

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: showToastMock }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/programs/day-templates", () => ({ saveDayAsTemplate: vi.fn() }));

import { saveDayAsTemplate } from "@/lib/programs/day-templates";

const day: DayRow = {
  id: "day-1",
  week_id: "week-1",
  position: 1,
  label: "Upper Strength",
  is_rest_day: false,
  blocks: [],
};

describe("SaveDayTemplateDialog", () => {
  beforeEach(() => {
    vi.mocked(saveDayAsTemplate).mockReset();
    showToastMock.mockClear();
  });

  it("defaults the name to the day's label and saves it on submit", async () => {
    vi.mocked(saveDayAsTemplate).mockResolvedValue({
      template: { id: "t-1", owner_id: "user-1", name: "Upper Strength", template_data: { blocks: [] }, created_at: "2026-01-01T00:00:00.000Z" },
      error: null,
    });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(<SaveDayTemplateDialog open day={day} currentUserId="user-1" onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByLabelText("Name")).toHaveValue("Upper Strength");
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(saveDayAsTemplate).toHaveBeenCalledWith(expect.anything(), {
      ownerId: "user-1",
      name: "Upper Strength",
      day,
    });
    expect(showToastMock).toHaveBeenCalledWith('Saved "Upper Strength" as a template');
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("falls back to 'Day <position>' when the day has no label", () => {
    render(<SaveDayTemplateDialog open day={{ ...day, label: null }} currentUserId="user-1" onClose={vi.fn()} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Day 1");
  });

  it("shows an error and doesn't close when the save fails", async () => {
    vi.mocked(saveDayAsTemplate).mockResolvedValue({ template: null, error: "Something went wrong." });
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<SaveDayTemplateDialog open day={day} currentUserId="user-1" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requires a non-empty name", async () => {
    const user = userEvent.setup();
    render(<SaveDayTemplateDialog open day={day} currentUserId="user-1" onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(await screen.findByText("Give the template a name.")).toBeInTheDocument();
    expect(saveDayAsTemplate).not.toHaveBeenCalled();
  });
});
