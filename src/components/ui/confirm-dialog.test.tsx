// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * ConfirmDialog replaced window.confirm() everywhere in the app (see its
 * own doc comment) specifically because the native dialog couldn't be
 * driven or asserted on reliably during live browser testing. These tests
 * cover exactly the behavior every one of those call sites depends on:
 * it's hidden when closed, Cancel backs out without running the action,
 * Confirm runs it, and the dialog stays open and disabled for the
 * duration of an async onConfirm rather than closing early or allowing a
 * double-submit.
 */
describe("ConfirmDialog", () => {
  function noop() {}

  it("renders nothing when closed", () => {
    render(<ConfirmDialog open={false} onClose={noop} onConfirm={noop} title="Delete session?" description="This can't be undone." />);
    expect(screen.queryByText("Delete session?")).not.toBeInTheDocument();
  });

  it("shows the title and description when open", () => {
    render(<ConfirmDialog open onClose={noop} onConfirm={noop} title="Delete session?" description="This can't be undone." />);
    expect(screen.getByText("Delete session?")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it("uses the default Cancel/Confirm labels when none are given", () => {
    render(<ConfirmDialog open onClose={noop} onConfirm={noop} title="t" description="d" />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("calls onClose, not onConfirm, when Cancel is clicked", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="t" description="d" />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm when the confirm button (with its custom label) is clicked", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ConfirmDialog open onClose={noop} onConfirm={onConfirm} title="Delete program?" description="d" confirmLabel="Delete" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables Cancel and Confirm and shows a busy label while an async onConfirm is pending, then re-enables once it resolves", async () => {
    let resolvePending: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePending = resolve;
        })
    );
    const user = userEvent.setup();
    render(<ConfirmDialog open onClose={noop} onConfirm={onConfirm} title="t" description="d" confirmLabel="Delete" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    // Busy state: the confirm button now reads "Working…" and is
    // disabled — nothing here calls onConfirm a second time (a click
    // during a real network write shouldn't fire the mutation twice).
    const busyButton = screen.getByRole("button", { name: "Working…" });
    expect(busyButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    resolvePending();

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).not.toBeDisabled());
  });

  it("does not show the danger styling/icon when destructive is false", () => {
    render(<ConfirmDialog open onClose={noop} onConfirm={noop} title="Switch exercise type?" description="d" destructive={false} confirmLabel="Switch" />);
    // No AlertTriangle icon (rendered as an svg with no accessible name) —
    // simplest reliable check is that the confirm button doesn't carry the
    // danger border/text classes used everywhere else in the app for a
    // destructive action.
    const confirmButton = screen.getByRole("button", { name: "Switch" });
    expect(confirmButton.className).not.toContain("text-danger");
  });
});
