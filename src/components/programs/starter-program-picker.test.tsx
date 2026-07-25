// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StarterProgramPicker } from "./starter-program-picker";
import { STARTER_PROGRAM_TEMPLATES } from "@/lib/programs/starter-templates";

/** Index within STARTER_PROGRAM_TEMPLATES — all 3 cards render an
 * identically-labeled "Start this program" button, so tests pick the right
 * one by template order rather than fragile DOM traversal up from a
 * heading. */
function templateIndex(slug: string): number {
  return STARTER_PROGRAM_TEMPLATES.findIndex((t) => t.slug === slug);
}

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/programs/mutations", () => ({ createProgramFromTemplate: vi.fn() }));

import { createProgramFromTemplate } from "@/lib/programs/mutations";

/**
 * Same picker UI either way (see the component's own doc comment) — these
 * tests cover the one thing that actually differs by mode: what clicking
 * "Start this program" does.
 */
describe("StarterProgramPicker", () => {
  beforeEach(() => {
    routerMock.push.mockClear();
    vi.mocked(createProgramFromTemplate).mockReset();
  });

  it("mode='redirect': navigates to sign-in with the chosen slug carried through as the post-auth redirect target", async () => {
    const user = userEvent.setup();
    render(<StarterProgramPicker mode="redirect" />);

    const buttons = screen.getAllByRole("button", { name: "Start this program" });
    await user.click(buttons[templateIndex("full-body-strength")]!);

    expect(createProgramFromTemplate).not.toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith(
      `/sign-in?redirect_to=${encodeURIComponent("/dashboard?start=full-body-strength")}`
    );
  });

  it("mode='create': creates the program directly and navigates to it", async () => {
    vi.mocked(createProgramFromTemplate).mockResolvedValue({
      program: { id: "prog-123" } as never,
      error: null,
    });
    const user = userEvent.setup();
    render(<StarterProgramPicker mode="create" userId="user-1" />);

    const buttons = screen.getAllByRole("button", { name: "Start this program" });
    await user.click(buttons[templateIndex("5k-base-builder")]!);

    expect(createProgramFromTemplate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "user-1", template: expect.objectContaining({ slug: "5k-base-builder" }) })
    );
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/programs/prog-123"));
  });

  it("mode='create': shows an error and doesn't navigate when the mutation fails", async () => {
    vi.mocked(createProgramFromTemplate).mockResolvedValue({ program: null, error: "Something went wrong." });
    const user = userEvent.setup();
    render(<StarterProgramPicker mode="create" userId="user-1" />);

    const buttons = screen.getAllByRole("button", { name: "Start this program" });
    await user.click(buttons[templateIndex("push-pull-legs")]!);

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
