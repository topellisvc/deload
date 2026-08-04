// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddBlockMenu } from "./add-block-menu";

describe("AddBlockMenu", () => {
  it("opens the type picker and lists every real block type plus a coming-soon section", async () => {
    const user = userEvent.setup();
    render(<AddBlockMenu role="main" label="Add exercise" onAddBlock={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add exercise" }));
    expect(screen.getByRole("menu", { name: "Choose block type" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Single Exercise/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Circuit/ })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByText("Drop Set")).toBeInTheDocument();
  });

  it("calls onAddBlock with the chosen block type and closes", async () => {
    const user = userEvent.setup();
    const onAddBlock = vi.fn();
    render(<AddBlockMenu role="warmup" label="Add warm-up" onAddBlock={onAddBlock} />);
    await user.click(screen.getByRole("button", { name: "Add warm-up" }));
    await user.click(screen.getByRole("menuitem", { name: /Circuit/ }));
    expect(onAddBlock).toHaveBeenCalledWith("warmup", "circuit");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  /**
   * Regression test for the menu getting clipped mid-list when its trigger
   * sits inside a horizontally-scrollable row (the Program Builder's
   * day-columns row, `lg:overflow-x-auto`) — per the CSS Overflow spec, that
   * row's overflow-y silently computes to 'auto' too even though it's
   * declared 'visible' (see add-block-menu.tsx's own doc comment), which
   * clips anything absolutely positioned that extends past the row's own
   * box. The fix portals the menu into document.body instead — this
   * reproduces the exact ancestor shape (an overflow-x-auto row) and
   * asserts the menu escapes it, landing as a direct child of body rather
   * than nested inside that row.
   */
  it("portals the dropdown out of an overflow-x-auto ancestor instead of rendering clipped inside it", async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="scroll-row" className="overflow-x-auto">
        <AddBlockMenu role="main" label="Add exercise" onAddBlock={vi.fn()} />
      </div>
    );
    await user.click(screen.getByRole("button", { name: "Add exercise" }));
    const menu = screen.getByRole("menu", { name: "Choose block type" });
    const scrollRow = screen.getByTestId("scroll-row");
    expect(scrollRow.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
  });
});
