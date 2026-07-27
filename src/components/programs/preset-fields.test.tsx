// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestPresetField, DistancePresetField } from "./preset-fields";

describe("RestPresetField", () => {
  it("marks the matching preset as selected", () => {
    render(<RestPresetField value={90} onCommit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "90 sec" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "60 sec" })).toHaveAttribute("aria-pressed", "false");
  });

  it("commits the preset's seconds value on click", async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<RestPresetField value={null} onCommit={onCommit} />);
    await user.click(screen.getByRole("button", { name: "2 min" }));
    expect(onCommit).toHaveBeenCalledWith(120);
  });

  it("opens straight into Custom, with the field pre-filled, for a value that matches no preset", () => {
    render(<RestPresetField value={45} onCommit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Rest" })).toHaveValue("45");
  });
});

describe("DistancePresetField", () => {
  it("marks the matching preset as selected", () => {
    render(<DistancePresetField value={5000} onCommit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "5km" })).toHaveAttribute("aria-pressed", "true");
  });

  it("commits meters for the clicked preset", async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<DistancePresetField value={null} onCommit={onCommit} />);
    await user.click(screen.getByRole("button", { name: "400m" }));
    expect(onCommit).toHaveBeenCalledWith(400);
  });

  it("falls back to Custom for a distance that isn't one of the presets", () => {
    render(<DistancePresetField value={3000} onCommit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
  });
});
