// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetaAccessToggle } from "./beta-access-toggle";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("@/lib/admin/mutations", () => ({
  setBetaAccess: vi.fn(),
}));

import { setBetaAccess } from "@/lib/admin/mutations";

function renderToggle(initialEnabled: boolean) {
  return render(
    <ToastProvider>
      <BetaAccessToggle userId="user-1" initialEnabled={initialEnabled} />
    </ToastProvider>
  );
}

describe("BetaAccessToggle", () => {
  beforeEach(() => {
    vi.mocked(setBetaAccess).mockReset();
  });

  it("grants access: flips from 'Beta off' to 'Beta on' and calls setBetaAccess(userId, true)", async () => {
    vi.mocked(setBetaAccess).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderToggle(false);

    expect(screen.getByRole("button", { name: "Beta off" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Beta off" }));

    expect(setBetaAccess).toHaveBeenCalledWith("user-1", true);
    await waitFor(() => expect(screen.getByRole("button", { name: "Beta on" })).toBeInTheDocument());
  });

  it("revokes access: flips from 'Beta on' to 'Beta off' and calls setBetaAccess(userId, false)", async () => {
    vi.mocked(setBetaAccess).mockResolvedValue({ error: null });
    const user = userEvent.setup();
    renderToggle(true);

    await user.click(screen.getByRole("button", { name: "Beta on" }));

    expect(setBetaAccess).toHaveBeenCalledWith("user-1", false);
    await waitFor(() => expect(screen.getByRole("button", { name: "Beta off" })).toBeInTheDocument());
  });

  it("rolls back the optimistic flip and shows the error when the request fails", async () => {
    vi.mocked(setBetaAccess).mockResolvedValue({ error: "Network error" });
    const user = userEvent.setup();
    renderToggle(false);

    await user.click(screen.getByRole("button", { name: "Beta off" }));

    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
    // Rolled back to its original state rather than left looking granted.
    expect(screen.getByRole("button", { name: "Beta off" })).toBeInTheDocument();
  });
});
