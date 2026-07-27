// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrescriptionTypePicker } from "./prescription-type-picker";

describe("PrescriptionTypePicker", () => {
  it("renders one option per prescription type available for the category, each with its example text", () => {
    render(<PrescriptionTypePicker category="strength" value="fixed_weight" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /fixed weight/i })).toBeInTheDocument();
    expect(screen.getByText("4 × 6 @ 100kg")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /% of 1rm/i })).toBeInTheDocument();
  });

  it("marks the current value as checked", () => {
    render(<PrescriptionTypePicker category="strength" value="rpe" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /^rpe/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /fixed weight/i })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the clicked type's value", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PrescriptionTypePicker category="strength" value="fixed_weight" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: /rep range/i }));
    expect(onChange).toHaveBeenCalledWith("rep_range");
  });

  it("shows a different option set for a different category", () => {
    render(<PrescriptionTypePicker category="running" value="distance" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /heart rate zone/i })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /fixed weight/i })).not.toBeInTheDocument();
  });
});
