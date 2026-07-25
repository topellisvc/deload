// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyTemplatesSection } from "./my-templates-section";
import type { ProgramTemplateRow } from "@/lib/programs/types";
import type { CoachClient } from "@/lib/supabase/types";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/programs/mutations", () => ({
  createProgramFromSavedTemplate: vi.fn(),
  deleteProgramTemplate: vi.fn(),
}));

import { createProgramFromSavedTemplate, deleteProgramTemplate } from "@/lib/programs/mutations";

function makeTemplate(overrides: Partial<ProgramTemplateRow> = {}): ProgramTemplateRow {
  return {
    id: "template-1",
    owner_id: "user-1",
    name: "My Strength Template",
    discipline: "resistance",
    template_data: { weeks: [{ id: "w1" } as never, { id: "w2" } as never] },
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeClient(overrides: Partial<CoachClient> = {}): CoachClient {
  return {
    id: "cc-1",
    coach_id: "user-1",
    client_id: "client-1",
    client_email: "client@example.com",
    coach_email: "user-1@example.com",
    status: "active",
    invite_message: null,
    accepted_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MyTemplatesSection", () => {
  beforeEach(() => {
    routerMock.push.mockClear();
    vi.mocked(createProgramFromSavedTemplate).mockReset();
    vi.mocked(deleteProgramTemplate).mockReset();
  });

  it("renders nothing when there are no templates", () => {
    const { container } = render(<MyTemplatesSection templates={[]} userId="user-1" activeClients={[]} onDeleted={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the template's week count and, with no active clients, creates directly for the caller", async () => {
    vi.mocked(createProgramFromSavedTemplate).mockResolvedValue({ program: { id: "prog-new" } as never, error: null });
    const user = userEvent.setup();
    render(<MyTemplatesSection templates={[makeTemplate()]} userId="user-1" activeClients={[]} onDeleted={vi.fn()} />);

    expect(screen.getByText("2 weeks")).toBeInTheDocument();
    // No client roster passed in, so there's no "for" picker to choose from.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use template" }));

    expect(createProgramFromSavedTemplate).toHaveBeenCalledWith(expect.anything(), {
      template: makeTemplate(),
      userId: "user-1",
      athleteId: undefined,
    });
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/programs/prog-new"));
  });

  it("creates the program for the chosen client when a 'for' picker is available", async () => {
    vi.mocked(createProgramFromSavedTemplate).mockResolvedValue({ program: { id: "prog-new" } as never, error: null });
    const user = userEvent.setup();
    render(
      <MyTemplatesSection templates={[makeTemplate()]} userId="user-1" activeClients={[makeClient()]} onDeleted={vi.fn()} />
    );

    await user.selectOptions(screen.getByRole("combobox"), "client-1");
    await user.click(screen.getByRole("button", { name: "Use template" }));

    expect(createProgramFromSavedTemplate).toHaveBeenCalledWith(expect.anything(), {
      template: makeTemplate(),
      userId: "user-1",
      athleteId: "client-1",
    });
  });

  it("shows an error and doesn't navigate when creating from a template fails", async () => {
    vi.mocked(createProgramFromSavedTemplate).mockResolvedValue({ program: null, error: "Something went wrong." });
    const user = userEvent.setup();
    render(<MyTemplatesSection templates={[makeTemplate()]} userId="user-1" activeClients={[]} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Use template" }));

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("deletes a template after confirming, and reports it back via onDeleted", async () => {
    vi.mocked(deleteProgramTemplate).mockResolvedValue({ error: null });
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<MyTemplatesSection templates={[makeTemplate()]} userId="user-1" activeClients={[]} onDeleted={onDeleted} />);

    await user.click(screen.getByRole("button", { name: "Delete template" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteProgramTemplate).toHaveBeenCalledWith(expect.anything(), "template-1");
    expect(onDeleted).toHaveBeenCalledWith("template-1");
  });
});
