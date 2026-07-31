// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProgramDialog } from "./new-program-dialog";

const { routerMock } = vi.hoisted(() => ({ routerMock: { push: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/programs/mutations", () => ({ createProgram: vi.fn() }));

import * as m from "@/lib/programs/mutations";

describe("NewProgramDialog — training days per week field", () => {
  beforeEach(() => {
    vi.mocked(m.createProgram).mockReset();
    routerMock.push.mockReset();
  });

  it("defaults to 4 and lets a single digit 2-6 be typed after clearing the field", async () => {
    const user = userEvent.setup();
    render(<NewProgramDialog open onClose={vi.fn()} userId="coach-1" activeClients={[]} />);

    const field = screen.getByLabelText("Training days per week");
    expect(field).toHaveValue(4);

    // Regression test for the actual reported bug: the old handler clamped
    // Number(e.target.value) || 1 on every keystroke, so backspacing the
    // field snapped it straight to "1" before the replacement digit ever
    // landed. The next real keystroke then inserted into that "1" — typing
    // "3" produced "13" in the DOM, not "3" — which clamped to the max of
    // 7, so any single digit 2-6 typed after clearing the field landed on
    // 1 or 7. userEvent (not fireEvent with an explicit final value) is
    // required here: it types character-by-character against whatever the
    // DOM's current value actually is, the same as a real keyboard, which
    // is the only way this reproduces — driving fireEvent.change straight
    // to "3" bypasses the accumulation bug entirely.
    await user.clear(field);
    await user.type(field, "3");

    expect(field).toHaveValue(3);
  });

  it("reconciles an empty field back to the last valid value on blur, not before", async () => {
    const user = userEvent.setup();
    render(<NewProgramDialog open onClose={vi.fn()} userId="coach-1" activeClients={[]} />);

    const field = screen.getByLabelText("Training days per week");
    await user.clear(field);
    // Still blank while focused — clamping mid-edit is exactly what broke
    // this the first time.
    expect(field).toHaveValue(null);

    await user.tab();
    expect(field).toHaveValue(4);
  });

  it("clamps a typed out-of-range number (e.g. 12) back to 7 on blur", async () => {
    const user = userEvent.setup();
    render(<NewProgramDialog open onClose={vi.fn()} userId="coach-1" activeClients={[]} />);

    const field = screen.getByLabelText("Training days per week");
    await user.clear(field);
    await user.type(field, "12");
    await user.tab();

    expect(field).toHaveValue(7);
  });

  it("submits with the number of days actually shown, not a stale default", async () => {
    vi.mocked(m.createProgram).mockResolvedValue({
      program: { id: "prog-1" } as never,
      error: null,
    });
    const user = userEvent.setup();
    render(<NewProgramDialog open onClose={vi.fn()} userId="coach-1" activeClients={[]} />);

    await user.type(screen.getByLabelText("Name"), "Off-season block");
    const field = screen.getByLabelText("Training days per week");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.change(field, { target: { value: "5" } });
    expect(field).toHaveValue(5);

    await user.click(screen.getByRole("button", { name: "Create program" }));

    expect(m.createProgram).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dayLabels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"] })
    );
  });
});
